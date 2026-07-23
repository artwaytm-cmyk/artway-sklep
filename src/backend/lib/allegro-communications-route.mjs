import crypto from 'node:crypto';
import { buildContextualAllegroReply, improvePolishReplyStyle } from './domain/allegro-reply-assistant.mjs';

const ACTIONS = new Set([
  'allegro-communications-data', 'allegro-communication-resolve', 'allegro-communications-settings',
  'allegro-reply-suggestion', 'allegro-send-reply', 'allegro-sync-communications',
]);

export function createAllegroCommunicationsRoute(deps) {
  const {
    respond, isAdmin, read, write, text, allegroStatus, applyInternalStatuses, normalizeSettings,
    caseKey, latestCustomerMessage, messageKey, learnedReplyStyle, fullReplyCase, previousCustomerCases,
    checkReplyContext, callAllegro, betaJson, normalizeIssueMessage, normalizeThreadMessage,
    rememberManualReplyStyle, fetchCommunications, markNewCommunications, sendTelegramReminders, sendAutoReplies,
  } = deps;
  return async function allegroCommunicationsRoute(req, url, action) {
    if (!ACTIONS.has(action)) return null;
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);

    if (action === 'allegro-communications-data') {
      const comm = await read('allegro_communications', { threads: [], issues: [], updated_at: null, errors: [] });
      const internalRec = await read('allegro_communication_internal', { items: {}, updated_at: null });
      const applied = applyInternalStatuses(comm, internalRec);
      const settings = normalizeSettings(await read('allegro_communication_settings', {}));
      const replies = await read('allegro_auto_replies', { items: {}, updated_at: null });
      return respond({
        ok: true, allegro: await allegroStatus(req), threads: Array.isArray(applied.data.threads) ? applied.data.threads : [],
        issues: Array.isArray(applied.data.issues) ? applied.data.issues : [], errors: Array.isArray(comm.errors) ? comm.errors : [],
        updated_at: comm.updated_at || null, lastSyncSummary: comm.lastSyncSummary || null, settings,
        autoReplies: replies.items && typeof replies.items === 'object' ? replies.items : {}, autoRepliesUpdatedAt: replies.updated_at || null,
        requiresReauth: Array.isArray(comm.errors) && comm.errors.some((error) => Number(error?.status) === 403),
      });
    }

    if (action === 'allegro-communication-resolve') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const requests = (Array.isArray(body.items) ? body.items : [body]).slice(0, 200).map((item) => ({ type: item?.type === 'issue' ? 'issue' : 'thread', id: text(item?.id, 120).trim(), resolved: item?.resolved !== false, note: text(item?.note || body.note || '', 1000).trim() })).filter((item) => item.id);
      if (!requests.length) return respond({ ok: false, error: 'Wybierz co najmniej jedną sprawę', code: 'validation' }, 422);
      const [comm, internalRec, historyRec] = await Promise.all([
        read('allegro_communications', { threads: [], issues: [], updated_at: null, errors: [] }),
        read('allegro_communication_internal', { items: {}, updated_at: null }),
        read('allegro_communication_internal_history', { items: [], updated_at: null }),
      ]);
      const internalItems = internalRec.items && typeof internalRec.items === 'object' ? { ...internalRec.items } : {};
      const history = Array.isArray(historyRec.items) ? [...historyRec.items] : [];
      const now = new Date().toISOString(), results = [];
      for (const request of requests) {
        const listKey = request.type === 'issue' ? 'issues' : 'threads';
        const list = Array.isArray(comm[listKey]) ? comm[listKey] : [];
        const index = list.findIndex((item) => String(item?.id) === request.id);
        if (index < 0) { results.push({ ...request, ok: false, error: 'Nie znaleziono sprawy' }); continue; }
        const item = list[index], sourceMessageKey = messageKey(latestCustomerMessage(item)), key = caseKey(request.type, request.id);
        const state = { ...(internalItems[key] || {}), type: request.type, id: request.id, resolved: request.resolved, note: request.note, sourceMessageKey, updatedAt: now, updatedBy: 'administrator', ...(request.resolved ? { resolvedAt: now, reopenedAt: null, reopenReason: '' } : { resolvedAt: null, reopenedAt: now, reopenReason: 'manual' }) };
        internalItems[key] = state;
        list[index] = request.resolved
          ? { ...item, internalResolved: true, internalResolution: state, needsReply: false, humanReplyNeeded: false, newIncomingCount: 0 }
          : { ...item, internalResolved: false, internalResolution: state, humanReplyNeeded: true, needsReply: !!latestCustomerMessage(item) };
        comm[listKey] = list;
        history.unshift({ id: crypto.randomUUID(), at: now, ...request, sourceMessageKey, action: request.resolved ? 'resolved_internal' : 'reopened_internal', sentExternally: false });
        results.push({ ...request, ok: true, state });
      }
      comm.updated_at = now;
      await Promise.all([
        write('allegro_communications', comm),
        write('allegro_communication_internal', { items: internalItems, updated_at: now }),
        write('allegro_communication_internal_history', { items: history.slice(0, 5000), updated_at: now }),
      ]);
      return respond({ ok: true, results, threads: comm.threads || [], issues: comm.issues || [], updated_at: now, sentExternally: false });
    }

    if (action === 'allegro-communications-settings') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({})), settings = normalizeSettings(body.settings || body);
      await write('allegro_communication_settings', { ...settings, updated_at: new Date().toISOString() });
      return respond({ ok: true, settings });
    }

    if (action === 'allegro-reply-suggestion') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({})), type = body.type === 'issue' ? 'issue' : 'thread';
      const id = text(body.id, 120).trim(), mode = body.mode === 'style' ? 'style' : (body.mode === 'improve' ? 'improve' : 'context'), draft = text(body.draft, 20000).trim();
      const [comm, ordersRec, storeOrdersRec, styleMemory] = await Promise.all([
        read('allegro_communications', { threads: [], issues: [] }), read('allegro_orders', { items: [] }),
        read('orders', { items: [] }), read('allegro_reply_style_memory', { items: [], updated_at: null }),
      ]);
      const list = type === 'issue' ? comm.issues : comm.threads, item = (Array.isArray(list) ? list : []).find((entry) => String(entry?.id) === id);
      if (!item) return respond({ ok: false, error: 'Nie znaleziono rozmowy Allegro', code: 'not_found' }, 404);
      const learnedStyle = learnedReplyStyle(comm, styleMemory);
      if (mode === 'style') {
        if (!draft) return respond({ ok: false, error: 'Najpierw wpisz treść, którą Agent ma poprawić stylistycznie', code: 'validation' }, 422);
        return respond({ ok: true, type, id, mode, suggestion: improvePolishReplyStyle(draft, { ensureReplyFrame: true, styleProfile: learnedStyle.profile }), context: { mode, verifiedAt: new Date().toISOString(), draftOnly: true, styleProfile: learnedStyle.profile }, sentExternally: false });
      }
      const full = await fullReplyCase(req, type, item);
      if (!latestCustomerMessage(full.item)) return respond({ ok: false, error: 'Ta sprawa zawiera wyłącznie komunikaty Allegro — nie ma wiadomości klienta, na którą można przygotować odpowiedź.', code: 'no_customer_message', sentExternally: false }, 422);
      const relatedItems = previousCustomerCases(comm, type, full.item), checked = await checkReplyContext(req, full.item, ordersRec.items, storeOrdersRec.items);
      const prepared = buildContextualAllegroReply({ type, item: full.item, context: checked.context, draft, relatedItems, styleProfile: learnedStyle.profile });
      return respond({ ok: true, type, id, mode, suggestion: prepared.suggestion, conversation: prepared.conversation, context: { ...checked.context, mode, conversation: prepared.conversation, styleProfile: learnedStyle.profile, history: { live: full.live, pages: full.pages, truncated: full.truncated, error: full.error } }, basedOn: { order: checked.context.orderFound, liveOrder: checked.context.checks.liveOrder, shipments: checked.context.checks.shipments, localShipping: checked.context.checks.localShipping, warehouse: checked.context.checks.warehouse, wholeConversation: true, fullHistoryLive: full.live, historyPages: full.pages, historyTruncated: full.truncated, historyError: full.error, messageCount: prepared.conversation.messageCount, previousCustomerConversations: prepared.conversation.relatedConversationCount, learnedStyleExamples: learnedStyle.profile.exampleCount }, sentExternally: false });
    }

    if (action === 'allegro-send-reply') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({})), type = body.type === 'issue' ? 'issue' : 'thread';
      const id = text(body.id, 120).trim(), replyText = text(body.text, 20000).trim();
      if (!id || !replyText) return respond({ ok: false, error: 'Wybierz rozmowę i wpisz treść odpowiedzi', code: 'validation' }, 422);
      let raw;
      if (type === 'issue') raw = await callAllegro(req, `/sale/issues/${encodeURIComponent(id)}/message`, { method: 'POST', accept: betaJson, contentType: betaJson, bodyObj: { text: replyText, attachments: [], type: 'REGULAR' } });
      else {
        raw = await callAllegro(req, `/messaging/threads/${encodeURIComponent(id)}/messages`, { method: 'POST', bodyObj: { text: replyText, attachments: [] } });
        try { await callAllegro(req, `/messaging/threads/${encodeURIComponent(id)}/read`, { method: 'PUT', bodyObj: { read: true } }); } catch {}
      }
      const comm = await read('allegro_communications', { threads: [], issues: [], updated_at: null, errors: [] }), key = type === 'issue' ? 'issues' : 'threads';
      const list = Array.isArray(comm[key]) ? [...comm[key]] : [], index = list.findIndex((item) => String(item?.id) === id);
      const normalizedRaw = type === 'issue' ? normalizeIssueMessage(raw, id) : normalizeThreadMessage(raw, id);
      const normalized = { ...normalizedRaw, role: normalizedRaw.role || 'SELLER', authorType: 'seller', incoming: false, seller: true, system: false };
      if (index >= 0) {
        const current = list[index], messages = [...(Array.isArray(current.messages) ? current.messages : []), normalized].filter((message, position, all) => !message.id || all.findIndex((entry) => entry.id === message.id) === position);
        list[index] = { ...current, messages, lastMessage: normalized, read: true, needsReply: false, humanReplyNeeded: false, humanReplySource: null, newIncomingCount: 0, latestNewIncoming: null, latestNewIncomingKey: '', manualReplyAt: new Date().toISOString() };
      }
      const saved = { ...comm, [key]: list, updated_at: new Date().toISOString(), lastManualReply: { type, id, messageId: normalized.id || '', sent_at: new Date().toISOString() } };
      await write('allegro_communications', saved);
      let styleProfile = null, styleLearned = false;
      try { styleProfile = await rememberManualReplyStyle({ type, id, text: replyText, messageId: normalized.id || '' }); styleLearned = true; } catch {}
      return respond({ ok: true, type, id, message: normalized, styleLearned, styleProfile, threads: saved.threads || [], issues: saved.issues || [], updated_at: saved.updated_at });
    }

    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    const body = await req.json().catch(() => ({})), settings = normalizeSettings(await read('allegro_communication_settings', {}));
    const previous = await read('allegro_communications', { threads: [], issues: [], updated_at: null, errors: [] });
    const rawData = await fetchCommunications(req, { limit: body.limit || 20 }), marked = markNewCommunications(rawData, previous);
    const internalRec = await read('allegro_communication_internal', { items: {}, updated_at: null }), internalApplied = applyInternalStatuses(marked, internalRec), data = internalApplied.data;
    const freshCommunication = [...(data.threads || []), ...(data.issues || [])].filter((item) => !item?.cachedOlder);
    const syncSummary = {
      newBuyerMessages: freshCommunication.reduce((sum, item) => sum + Math.max(0, Number(item?.newIncomingCount || 0)), 0),
      newThreads: (data.threads || []).filter((item) => !item?.cachedOlder && Number(item?.newIncomingCount || 0) > 0).length,
      newIssues: (data.issues || []).filter((item) => !item?.cachedOlder && Number(item?.newIncomingCount || 0) > 0).length,
      allegroSystemMessages: freshCommunication.reduce((sum, item) => sum + Math.max(0, Number(item?.systemCount || 0)), 0),
    };
    if (internalApplied.changed) await write('allegro_communication_internal', { items: internalApplied.items, updated_at: new Date().toISOString() });
    const telegramReminders = await sendTelegramReminders(data, settings);
    let autoReply = { sent: [], skipped: [], items: {} };
    if (body.autoReply !== false && settings.enabled) autoReply = await sendAutoReplies(req, data, settings);
    const rec = { threads: data.threads, issues: data.issues, errors: data.errors || [], requiresReauth: !!data.requiresReauth, updated_at: new Date().toISOString(), autoReplyLastRun: autoReply.sent?.length || 0, lastSyncSummary: syncSummary };
    await write('allegro_communications', rec);
    return respond({ ok: true, allegro: await allegroStatus(req), ...rec, settings, autoReply, telegramReminders, syncSummary });
  };
}
