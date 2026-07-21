import { sendTelegramHtml, telegramApi, telegramHtml, telegramProfessionalAgentHtml } from './domain/telegram-communication.mjs';
import { telegramAgentReport } from './telegram-center.mjs';

const ACTIONS = new Set([
  'telegram-center-status', 'telegram-settings-save', 'telegram-register-webhook', 'telegram-dispatch', 'telegram-inbound-command',
  'telegram-inbound-audit', 'telegram-outbound-audit',
  'telegram-incident-action', 'telegram-delivery-action', 'telegram-dashboard-refresh', 'telegram-send-note', 'telegram-test', 'telegram-send-agent-report', 'telegram-send-supplier-order', 'telegram-supplier-order-preview',
  'codex-agent-claim', 'codex-agent-complete', 'codex-agent-fail', 'codex-agent-heartbeat', 'codex-agent-panel-enqueue', 'codex-agent-result',
  'agent-runtime-status', 'agent-runtime-report',
]);

const CODEX_FAILURE_NOTICE = '<b>⚠️ Nie udało się dokończyć tej prośby.</b>\nSpróbuj wysłać ją ponownie za chwilę.';

export function codexAgentApprovalReplyTarget(job = {}) {
  const text = String(job.text ?? '');
  const chatId = String(job.chatId ?? '').trim(), replyTo = Number(job.replyTo);
  if (job.channel === 'panel' || job.kind !== 'callback' || !/^aa:[cr]:AA[a-f0-9]{12}$/.test(text) || !chatId || !Number.isInteger(replyTo) || replyTo <= 0) return null;
  return { chatId, messageId: replyTo };
}

function invalidReplyTarget(error) {
  const status = Number(error?.status) || 0;
  const message = String(error?.message || error || '').toLowerCase();
  return status === 400 && /(?:reply|replied|message to be replied).*(?:not found|invalid)|message to be replied not found/.test(message);
}

async function deliverCodexFailureNotification(codexQueue, sendTelegram, sanitize) {
  if (!codexQueue || typeof codexQueue.claimFailureNotification !== 'function') {
    return { attempted: false, delivered: false, pending: false };
  }
  let leased;
  try {
    leased = await codexQueue.claimFailureNotification();
  } catch (error) {
    return { attempted: false, delivered: false, pending: true, error: sanitize(error?.message || error, 200) };
  }
  const notification = leased?.notification;
  if (!notification) return { attempted: false, delivered: false, pending: false };
  const options = {
    chatId: notification.chatId,
    replyTo: notification.replyTo,
    messageThreadId: notification.messageThreadId,
  };
  let sent, firstError = null, withoutReply = false;
  try {
    sent = await sendTelegram(CODEX_FAILURE_NOTICE, options);
  } catch (error) {
    firstError = error;
    // Telegram jednoznacznie odrzucił nieistniejący cel odpowiedzi, więc pierwsza
    // próba nie mogła zostać dostarczona. Tylko w takim przypadku bezpiecznie
    // ponawiamy od razu na tym samym czacie, lecz bez reply_parameters.
    if (notification.replyTo && invalidReplyTarget(error)) {
      withoutReply = true;
      try {
        sent = await sendTelegram(CODEX_FAILURE_NOTICE, {
          chatId: notification.chatId,
          messageThreadId: notification.messageThreadId,
        });
      } catch (fallbackError) {
        firstError = fallbackError;
      }
    }
  }
  if (sent) {
    try {
      await codexQueue.ackFailureNotification({
        id: notification.id,
        claimToken: notification.claimToken,
        telegramMessageId: sent?.message_id,
      });
      return { attempted: true, delivered: true, pending: false, withoutReply, messageId: sent?.message_id || null };
    } catch (error) {
      // Lease pozostaje trwały. Po jego wygaśnięciu outbox odzyska wpis CAS-em.
      return { attempted: true, delivered: false, pending: true, error: sanitize(error?.message || error, 200) };
    }
  }
  let retry = { retry: true };
  try {
    retry = await codexQueue.retryFailureNotification({
      id: notification.id,
      claimToken: notification.claimToken,
      error: firstError?.message || firstError,
      withoutReply,
    });
  } catch (error) {
    return { attempted: true, delivered: false, pending: true, error: sanitize(error?.message || error, 200) };
  }
  return {
    attempted: true,
    delivered: false,
    pending: retry.retry === true,
    exhausted: retry.exhausted === true,
    error: sanitize(firstError?.message || firstError, 200),
  };
}

export function createTelegramRouter({ center, codexQueue, agentRuntime, getOperationalCenter, inventoryCommand, inventoryDecisions, isAdmin, read, respond, sessionOf, publicOrigin, supplierPreviews, text, sendTelegram = sendTelegramHtml, clearTelegramReplyMarkup = ({ chatId, messageId }) => telegramApi('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }) }) {
  return async function telegramRoute(req, url, action) {
    if (!ACTIONS.has(action)) return null;
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    if (action === 'telegram-center-status') {
      const [operational, agentWorker] = await Promise.all([
        getOperationalCenter(),
        codexQueue && typeof codexQueue.status === 'function'
          ? codexQueue.status()
          : Promise.resolve({ workerOnline: false, workerLastSeenAt: '', counts: {}, active: 0 }),
      ]);
      return respond({ ok: true, center: operational, agentWorker, ...(await center.view(operational, url.searchParams.get('live') === '1')) });
    }
    if (action === 'agent-runtime-status') {
      if (!agentRuntime || typeof agentRuntime.status !== 'function') return respond({ ok: false, error: 'Rejestr pracy Agenta nie jest dostępny', code: 'agent_runtime_unavailable' }, 503);
      const queue = codexQueue && typeof codexQueue.status === 'function'
        ? await codexQueue.status()
        : { workerOnline: false, workerLastSeenAt: '', counts: {}, active: 0 };
      return respond({ ok: true, runtime: await agentRuntime.status(queue) });
    }
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    const body = await req.json().catch(() => ({})), session = sessionOf(req), operator = session?.email || 'administrator';
    if (action === 'telegram-inbound-audit') {
      if (!center || typeof center.recordInboundAudit !== 'function') return respond({ ok: false, error: 'Audyt Telegram nie jest dostępny', code: 'telegram_audit_unavailable' }, 503);
      const accepted = body.accepted === true;
      return respond({ ok: true, audit: await center.recordInboundAudit({
        accepted, deferred: body.deferred === true, kind: body.kind, actorHash: body.actorHash,
        ...(accepted ? {
          preview: text(body.preview || body.text || '', 2400), fromLabel: text(body.fromLabel || body.user || 'Użytkownik Telegram', 160),
          toLabel: text(body.toLabel || 'Agent Artway-TM', 160), messageId: body.messageId,
          threadId: body.threadId || body.messageThreadId, conversationKey: text(body.conversationKey || 'telegram-main', 180),
        } : {}),
      }) });
    }
    if (action === 'telegram-outbound-audit') {
      if (!center || typeof center.recordOutboundAudit !== 'function') return respond({ ok: false, error: 'Audyt Telegram nie jest dostępny', code: 'telegram_audit_unavailable' }, 503);
      return respond({ ok: true, audit: await center.recordOutboundAudit({
        kind: text(body.kind || 'message', 60), status: text(body.status || 'sent', 40), category: text(body.category || 'conversation', 40),
        title: text(body.title || 'Odpowiedź Agenta', 240), preview: text(body.preview || '', 2400), messageId: body.messageId,
        fromLabel: text(body.fromLabel || 'Agent Artway-TM', 160), toLabel: text(body.toLabel || 'Główna grupa Telegram', 160),
        threadId: body.threadId || body.messageThreadId, conversationKey: text(body.conversationKey || 'telegram-main', 180), source: text(body.source || 'telegram-webhook', 100),
      }) });
    }
    if (action === 'agent-runtime-report') {
      if (!agentRuntime || typeof agentRuntime.report !== 'function') return respond({ ok: false, error: 'Rejestr pracy Agenta nie jest dostępny', code: 'agent_runtime_unavailable' }, 503);
      const runtime = await agentRuntime.report(body);
      return respond({ ok: true, updatedAt: runtime.updatedAt });
    }
    if (action === 'codex-agent-claim') {
      if (!codexQueue) return respond({ ok: false, error: 'Kolejka Codex nie jest dostępna', code: 'codex_queue_unavailable' }, 503);
      const claimed = await codexQueue.claim(text(body.workerId || '', 160));
      const failureNotification = claimed.failureNotificationPending
        ? await deliverCodexFailureNotification(codexQueue, sendTelegram, text)
        : { attempted: false, delivered: false, pending: false };
      return respond({ ok: true, ...claimed, failureNotification });
    }
    if (action === 'codex-agent-panel-enqueue') {
      if (!codexQueue) return respond({ ok: false, error: 'Kolejka Codex nie jest dostępna', code: 'codex_queue_unavailable' }, 503);
      const queued = await codexQueue.enqueue({ requestId: body.requestId, text: body.text, channel: 'panel', kind: 'panel', user: operator });
      const deferred = ['queued', 'processing', 'delivering'].includes(queued.status);
      return respond({
        ok: true, deferred, status: queued.status, workerOnline: queued.workerOnline === true,
        jobId: queued.job?.id || null, duplicate: queued.duplicate === true,
        ...(deferred ? {} : { error: queued.status === 'failed' ? 'Agent nie wykonał tego zadania. Uruchom je ponownie.' : '' }),
      });
    }
    if (action === 'codex-agent-heartbeat') {
      if (!codexQueue) return respond({ ok: false, error: 'Kolejka Codex nie jest dostępna', code: 'codex_queue_unavailable' }, 503);
      return respond({ ok: true, ...(await codexQueue.heartbeat(body)) });
    }
    if (action === 'codex-agent-result') {
      if (!codexQueue) return respond({ ok: false, error: 'Kolejka Codex nie jest dostępna', code: 'codex_queue_unavailable' }, 503);
      return respond({ ok: true, ...(await codexQueue.result(body.id)) });
    }
    if (action === 'codex-agent-complete') {
      if (!codexQueue) return respond({ ok: false, error: 'Kolejka Codex nie jest dostępna', code: 'codex_queue_unavailable' }, 503);
      const prepared = await codexQueue.prepareDelivery(body);
      if (prepared.alreadyDelivered) return respond({ ok: true, delivered: true, duplicate: true });
      if (prepared.alreadyDelivering) return respond({ ok: true, delivered: false, pending: true });
      if (prepared.job.channel === 'panel') {
        const completed = await codexQueue.markDelivered({ id: body.id, claimToken: body.claimToken, keepResponse: true });
        return respond({ ok: true, ...completed, panel: true });
      }
      let sent;
      try {
        const recipients = [...new Set([prepared.job.chatId, ...(Array.isArray(prepared.job.broadcastChatIds) ? prepared.job.broadcastChatIds : [])]
          .map((value) => String(value || '').trim()).filter(Boolean))];
        const formattedResponse = telegramProfessionalAgentHtml(prepared.job.response);
        const attempts = await Promise.allSettled(recipients.map((chatId) => sendTelegram(formattedResponse, {
          chatId,
          ...(chatId === prepared.job.chatId && prepared.job.replyTo ? { replyTo: prepared.job.replyTo } : {}),
          ...(chatId === prepared.job.chatId && prepared.job.messageThreadId ? { messageThreadId: prepared.job.messageThreadId } : {}),
          ...(chatId === prepared.job.chatId && prepared.job.replyMarkup ? { replyMarkup: prepared.job.replyMarkup } : {}),
        })));
        const delivered = attempts.flatMap((result, index) => result.status === 'fulfilled'
          ? [{ chatId: recipients[index], result: result.value }]
          : []);
        if (!delivered.length) throw attempts.find((result) => result.status === 'rejected')?.reason || new Error('Nie udało się dostarczyć odpowiedzi do zespołu.');
        const primary = delivered.find((item) => item.chatId === String(prepared.job.chatId)) || delivered[0];
        sent = { ...primary.result, message_ids: delivered.map((item) => ({ chat_id: item.chatId, message_id: item.result?.message_id || null })) };
      } catch (error) {
        // Po wywołaniu zewnętrznego API nie wiemy, czy odpowiedź nie zaginęła
        // już po przyjęciu wiadomości przez Telegram. Traktujemy wynik jako
        // niejednoznaczny i nie ponawiamy automatycznie, aby nie wysłać duplikatu.
        await codexQueue.fail({ id: body.id, claimToken: body.claimToken, error: error?.message || error }).catch(() => null);
        throw error;
      }
      // Po sukcesie Telegram nie ponawiamy wysyłki, nawet jeśli sam zapis
      // audytu chwilowo zawiedzie — chroni to rozmowę przed duplikatem.
      const completed = await codexQueue.markDelivered({ id: body.id, claimToken: body.claimToken, telegramMessageId: sent?.message_id });
      if (typeof center?.recordOutboundAudit === 'function') await center.recordOutboundAudit({
        kind: 'agent-reply', status: 'sent', category: 'agent', title: 'Odpowiedź Agenta na polecenie',
        preview: prepared.job.response, messageId: sent?.message_id, fromLabel: 'Agent Artway-TM',
        toLabel: prepared.job.broadcastChatIds?.length ? 'Wspólny pokój zespołu' : (prepared.job.user || 'Zespół Telegram'), threadId: prepared.job.messageThreadId,
        conversationKey: prepared.job.conversationRoom === 'team' ? 'telegram:team:0' : `telegram:${prepared.job.chatId || 'main'}:${prepared.job.messageThreadId || 0}`, source: 'codex-agent',
      }).catch(() => null);
      const approvalTarget = codexAgentApprovalReplyTarget(prepared.job);
      if (completed.delivered === true && approvalTarget) await clearTelegramReplyMarkup(approvalTarget).catch(() => null);
      return respond({ ok: true, ...completed, messageId: sent?.message_id || null });
    }
    if (action === 'codex-agent-fail') {
      if (!codexQueue) return respond({ ok: false, error: 'Kolejka Codex nie jest dostępna', code: 'codex_queue_unavailable' }, 503);
      const failed = await codexQueue.fail(body);
      const failureNotification = failed.notificationPending
        ? await deliverCodexFailureNotification(codexQueue, sendTelegram, text)
        : { attempted: false, delivered: false, pending: false };
      return respond({
        ok: true, ...failed,
        notified: failureNotification.delivered === true,
        notificationPending: failureNotification.pending === true,
        failureNotification,
      });
    }
    if (action === 'telegram-settings-save') return respond({ ok: true, settings: await center.saveSettings(body.settings || body, operator) });
    if (action === 'telegram-register-webhook') return respond({ ok: true, ...(await center.registerWebhook(publicOrigin(req))) });
    if (action === 'telegram-dispatch') {
      const operational = await getOperationalCenter(), dispatch = await center.dispatch(operational, { source: text(body.source || 'admin-panel', 80), force: body.force === true, forceDigest: body.forceDigest === true, retryOnly: body.retryOnly === true });
      let inventoryReminder = { due: false, reason: 'service_unavailable', messages: 0, decisions: 0 };
      if (inventoryDecisions && typeof inventoryDecisions.prepareReminder === 'function') {
        const reminder = await inventoryDecisions.prepareReminder(new Date());
        inventoryReminder = {
          due: reminder.due === true,
          reason: reminder.reason,
          slot: reminder.slot,
          claimExpiresAt: reminder.claimExpiresAt || null,
          messages: 0,
          decisions: reminder.decisions?.length || 0,
          completed: false,
          released: false,
          errors: [],
        };
        const messages = reminder.messages || [];
        for (const message of messages) {
          try {
            await sendTelegram(message.text, { replyMarkup: message.replyMarkup, messageThreadId: body.messageThreadId || null });
            inventoryReminder.messages += 1;
          } catch (error) {
            inventoryReminder.errors.push(text(error?.message || error, 300));
            break;
          }
        }
        if (reminder.due === true && reminder.claimToken) {
          if (inventoryReminder.errors.length === 0 && inventoryReminder.messages === messages.length) {
            try {
              const completed = await inventoryDecisions.completeReminder(reminder.claimToken, new Date());
              inventoryReminder.completed = completed?.completed === true;
              inventoryReminder.reason = inventoryReminder.completed ? 'sent' : inventoryReminder.reason;
            } catch (error) {
              inventoryReminder.errors.push(text(error?.message || error, 300));
            }
          }
          if (!inventoryReminder.completed && inventoryReminder.errors.length) {
            try {
              const released = await inventoryDecisions.releaseReminder(reminder.claimToken);
              inventoryReminder.released = released?.released === true;
              inventoryReminder.reason = inventoryReminder.released ? 'delivery_failed_retryable' : inventoryReminder.reason;
            } catch (error) {
              inventoryReminder.errors.push(text(error?.message || error, 300));
            }
          }
        }
      }
      return respond({ ok: true, dispatch, inventoryReminder, center: operational });
    }
    if (action === 'telegram-inbound-command') {
      const inventory = typeof inventoryCommand === 'function' ? await inventoryCommand(body.text || body.intent || '', {
        user: body.user, userId: body.userId, chatId: body.chatId, messageThreadId: body.messageThreadId,
        requestId: body.requestId, source: body.source, channel: body.source === 'telegram-webhook' ? 'telegram' : 'panel',
      }) : null;
      if (inventory) {
        if (typeof center?.recordInboundAudit === 'function') await center.recordInboundAudit({ accepted: true, deferred: false, kind: 'inventory', preview: body.text, fromLabel: body.fromLabel || body.user, messageId: body.replyTo, threadId: body.messageThreadId, conversationKey: `telegram:${body.chatId || 'main'}:${body.messageThreadId || 0}` });
        return respond({ ok: true, ...inventory });
      }
      if (body.deferToCodex === true && body.source === 'telegram-webhook' && codexQueue) {
        const queued = await codexQueue.enqueue({
          requestId: body.requestId, text: body.text, chatId: body.chatId, messageThreadId: body.messageThreadId,
          broadcastChatIds: body.broadcastChatIds, conversationRoom: body.conversationRoom,
          replyTo: body.replyTo, user: body.user, userId: body.userId, context: body.context, media: body.media, kind: body.kind, channel: 'telegram',
        });
        const deferred = ['queued', 'processing', 'delivering'].includes(queued.status);
        if (typeof center?.recordInboundAudit === 'function') await center.recordInboundAudit({ accepted: true, deferred, kind: body.kind || 'text', preview: body.text, fromLabel: body.fromLabel || body.user, messageId: body.replyTo, threadId: body.messageThreadId, conversationKey: `telegram:${body.chatId || 'main'}:${body.messageThreadId || 0}` });
        if (!deferred) {
          const completed = queued.status === 'completed';
          return respond({
            ok: true, deferred: false, status: queued.status, workerOnline: queued.workerOnline === true,
            jobId: queued.job?.id || null, duplicate: queued.duplicate === true,
            message: completed
              ? '✅ To polecenie zostało już obsłużone — nie uruchamiam go drugi raz.'
              : queued.workerOnline === false
                ? '⚠️ Agent na komputerze jest teraz offline. Polecenie nie zostało pozostawione do późniejszego wykonania. Uruchom Agenta i wyślij je ponownie.'
                : '⚠️ Poprzednia próba nie została wykonana. Wyślij polecenie ponownie.',
          });
        }
        return respond({
          ok: true, deferred: true, status: queued.status, workerOnline: queued.workerOnline === true,
          jobId: queued.job?.id || null, duplicate: queued.duplicate === true,
        });
      }
      const operational = await getOperationalCenter();
      return respond({ ok: true, ...(await center.inbound(text(body.intent || body.text, 1000), operational, { text: body.text, user: body.fromLabel || body.user, chatId: body.chatId, messageId: body.replyTo, messageThreadId: body.messageThreadId })) });
    }
    if (action === 'telegram-incident-action') {
      const actor = body.actor && typeof body.actor === 'object' ? body.actor : { name: operator, email: operator };
      return respond({ ok: true, ...(await center.incidentAction(text(body.id, 40), text(body.incidentAction || body.operation || body.eventAction, 30), actor, { direction: body.source === 'telegram-webhook' ? 'in' : 'out', source: body.source || 'admin-panel' })) });
    }
    if (action === 'telegram-delivery-action') return respond({ ok: true, ...(await center.deliveryAction(text(body.id, 80), text(body.deliveryAction, 30), operator)) });
    if (action === 'telegram-dashboard-refresh') {
      const operational = await getOperationalCenter();
      return respond({ ok: true, dashboard: await center.refreshDashboard(operational, { create: body.create === true, source: body.source || 'admin-panel' }) });
    }
    if (action === 'telegram-send-note') {
      const note = text(body.text, 1500).trim();
      if (note.length < 3) return respond({ ok: false, error: 'Wpisz treść notatki do zespołu', code: 'empty_note' }, 422);
      const sent = await center.sendManual(`<b>📌 Notatka</b>\n${telegramHtml(note)}`, { kind: 'note', title: 'Notatka administratora', source: operator, silent: body.silent === true });
      return respond({ ok: true, messageId: sent?.message_id || null, sentAt: new Date().toISOString() });
    }
    if (action === 'telegram-test') {
      const sent = await center.sendManual('<b>✅ Połączenie działa</b>\nCichy test został dostarczony.', { kind: 'test', title: 'Test połączenia', source: 'admin-panel', silent: true });
      return respond({ ok: true, messageId: sent?.message_id || null, sentAt: new Date().toISOString() });
    }
    if (action === 'telegram-send-agent-report') {
      const operational = await getOperationalCenter(), sent = await center.sendManual(telegramAgentReport(operational), { kind: 'report', title: 'Pełny raport centrum operacyjnego', source: 'admin-panel', replyMarkup: center.panelButtons() });
      return respond({ ok: true, sentAt: new Date().toISOString(), messageId: sent?.message_id || null, center: operational });
    }
    if (action === 'telegram-send-supplier-order' || action === 'telegram-supplier-order-preview') {
      if (typeof read !== 'function' || typeof supplierPreviews !== 'function') return respond({ ok: false, error: 'Kanoniczny Plan zatowarowania jest niedostępny', code: 'supplier_plan_unavailable' }, 503);
      const settingsRecord = await read('settings', { data: {}, rev: 0, updated_at: null });
      const tables = supplierPreviews(settingsRecord?.data || {}, {
        draftId: text(body.draftId || '', 160).trim(),
        supplier: text(body.supplier || '', 120).trim(),
        expectedRevision: body.expectedRevision,
        latestOnly: body.latestOnly === true,
      });
      if (!tables.length) return respond({ ok: false, error: 'Zlecenie nie ma pozycji dla wybranego dostawcy', code: 'empty_order' }, 422);
      if (action === 'telegram-supplier-order-preview') {
        return respond({
          ok: true,
          source: 'supplier-plan',
          rev: Math.max(0, Number(settingsRecord?.rev) || 0),
          updated_at: settingsRecord?.updated_at || null,
          messages: tables,
          documents: tables.flatMap((item) => Array.isArray(item.documents) ? item.documents.map((document) => ({
            draftId: item.draftId, supplier: item.supplier, filename: document.filename, kind: document.kind || 'document',
          })) : []),
          suppliers: [...new Set(tables.map((item) => item.supplier))],
        });
      }
      const messageIds = [], documentIds = [];
      for (const table of tables) {
        const sent = await center.sendManual(table.text, {
          kind: 'supplier-preview', category: 'supplier', title: `Podgląd zamówienia — ${table.supplier}`, source: 'admin-panel',
          replyMarkup: { inline_keyboard: [[{ text: '✏️ Edytuj w Planie zatowarowania', url: `${publicOrigin(req)}/#/admin/magazyn/plan` }]] },
        });
        if (sent?.message_id != null) messageIds.push(sent.message_id);
        if (typeof center.sendManualDocument === 'function') for (const document of Array.isArray(table.documents) ? table.documents : []) {
          const sentDocument = await center.sendManualDocument(document, {
            kind: document.kind || 'supplier-document', category: 'supplier', title: `Plik zamówienia — ${table.supplier}`, source: 'admin-panel',
            caption: document.kind === 'comarch-optima'
              ? `Comarch ERP Optima · ${table.documentNumber} · wersja ${table.revision}`
              : `Edytowalna tabela · ${table.documentNumber} · wersja ${table.revision}`,
          });
          if (sentDocument?.message_id != null) documentIds.push(sentDocument.message_id);
        }
      }
      return respond({ ok: true, sentAt: new Date().toISOString(), tables: tables.length, documents: documentIds.length, suppliers: [...new Set(tables.map((item) => item.supplier))], messageIds, documentIds });
    }
    return null;
  };
}
