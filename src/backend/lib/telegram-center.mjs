import crypto from 'node:crypto';
import {
  editTelegramHtml,
  sendTelegramDocument,
  sendTelegramHtml,
  telegramApi,
  telegramConfig,
  telegramDigestSlot,
  telegramEventDecision,
  telegramHtml,
  telegramIncidentId,
  telegramNaturalIntent,
  telegramPriorityEvents,
  telegramQuietNow,
  telegramRenderEvents,
  telegramSettings,
  telegramSlaMinutes,
  telegramTopicId,
  telegramWebhookSecret,
} from './domain/telegram-communication.mjs';
import { applyTelegramAccountAccess } from './domain/telegram-account-access.mjs';
import { renderTelegramMetricCard } from './domain/telegram-message-content.mjs';

import { SETTINGS_KEY, STATE_KEY, ARCHIVE_V1_KEY, OPEN_STATES, TELEGRAM_PANEL_ORIGIN, clean, nowIso, plusMinutes, conversationText, telegramPanelUrl, emptyState, compactEvents, hashEvent, auditEntry, incidentStatus, incidentOverdue, compactLine, polishForm, warsawDayKey, shortMoment, cleanCustomMessage, incidentFromEvent, incidentLabel, telegramIncidentCard, telegramIncidentKeyboard, telegramAgentReport, telegramDashboardCard, escalationCard } from './telegram-center-support.mjs';

export function createTelegramCenter({ read, write, env = process.env } = {}) {
  if (typeof read !== 'function' || typeof write !== 'function') throw new Error('Telegram Center wymaga repozytorium read/write');

  async function accountConfig() {
    const record = await read('users', { items: [] });
    return applyTelegramAccountAccess(telegramConfig(env), record?.items || []);
  }

  async function sendTeamHtml(message, options = {}) {
    const config = await accountConfig();
    return sendTelegramHtml(message, { ...options, teamUserIds: [...config.teamUserIds] }, env);
  }

  async function loadSettings() { return telegramSettings(await read(SETTINGS_KEY, {})); }
  async function loadState() {
    const raw = await read(STATE_KEY, emptyState()), base = emptyState(), source = raw && typeof raw === 'object' ? raw : {};
    if (Number(source.schemaVersion || 1) < 2) {
      const existingArchive = await read(ARCHIVE_V1_KEY, null);
      if (!existingArchive) await write(ARCHIVE_V1_KEY, {
        archivedAt: nowIso(), reason: 'Migracja do jednego centrum komunikacji v2',
        history: Array.isArray(source.history) ? source.history : [], outbox: Array.isArray(source.outbox) ? source.outbox : [],
        events: source.events && typeof source.events === 'object' ? source.events : {}, dashboard: source.dashboard || {}, health: source.health || {},
      });
      return {
        ...base, initializedAt: source.initializedAt || '', updatedAt: nowIso(),
        events: source.events && typeof source.events === 'object' ? source.events : {},
        outbox: Array.isArray(source.outbox) ? source.outbox : [],
        dashboard: { ...base.dashboard, ...(source.dashboard || {}) }, health: { ...base.health, ...(source.health || {}) },
        migration: { from: 1, archivedAt: nowIso(), archiveKey: ARCHIVE_V1_KEY },
      };
    }
    return {
      ...base, ...source, events: source.events && typeof source.events === 'object' ? source.events : {}, history: Array.isArray(source.history) ? source.history : [],
      outbox: Array.isArray(source.outbox) ? source.outbox : [], dashboard: { ...base.dashboard, ...(source.dashboard || {}) }, health: { ...base.health, ...(source.health || {}) },
    };
  }
  async function saveState(state) {
    const next = { ...emptyState(), ...state, events: compactEvents(state.events || {}), history: (state.history || []).slice(0, 400), outbox: (state.outbox || []).slice(0, 100), updatedAt: nowIso() };
    await write(STATE_KEY, next); return next;
  }
  function addHistory(state, entry) { state.history = [auditEntry(entry), ...(state.history || [])].slice(0, 400); }

  function syncIncidents(state, events, settings, timestamp = nowIso()) {
    const active = new Set();
    for (const event of events) {
      active.add(event.key);
      state.events[event.key] = incidentFromEvent(event, state.events[event.key] || null, settings, timestamp);
    }
    const resolved = [];
    if (settings.autoResolve) for (const [key, record] of Object.entries(state.events)) {
      if (active.has(key) || record.managed === true || !OPEN_STATES.has(incidentStatus(record))) continue;
      state.events[key] = { ...record, status: 'resolved', resolvedAt: timestamp, resolutionReason: 'Problem zniknął z aktywnej kontroli', lastSeenAt: record.lastSeenAt || timestamp };
      resolved.push(state.events[key]);
    }
    return resolved;
  }

  async function connection(live = false) {
    const config = await accountConfig(), result = {
      configured: !!(config.token && (config.chatId || config.teamUserIds?.size)), chatConfigured: !!(config.chatId || config.teamUserIds?.size), botConfigured: !!config.token,
      allowlist: { ...(config.allowlistCounts || { chats: config.allowedChatIds.size, users: config.allowedUserIds.size }) },
      bot: null, webhook: null, error: '',
    };
    if (!live || !config.token) return result;
    try {
      const [bot, webhook, target] = await Promise.all([
        telegramApi('getMe', {}, env),
        telegramApi('getWebhookInfo', {}, env),
        config.sharedMode === 'private-room' && config.teamUserIds?.size
          ? Promise.resolve({ reachable: true, type: 'server-room', name: 'Wspólny pokój zespołu', members: config.teamUserIds.size, error: '' })
          : config.chatId
          ? telegramApi('getChat', { chat_id: config.chatId }, env).then((chat) => ({ reachable: true, type: clean(chat?.type || '', 40), name: clean(chat?.title || chat?.first_name || '', 120), error: '' })).catch((error) => ({ reachable: false, type: '', name: '', error: clean(error?.message || error, 240) }))
          : Promise.resolve({ reachable: false, type: '', name: '', error: 'Brak kanału docelowego' }),
      ]);
      result.bot = {
        id: bot?.id || null,
        username: bot?.username || '',
        name: [bot?.first_name, bot?.last_name].filter(Boolean).join(' '),
        can_read_all_group_messages: bot?.can_read_all_group_messages === true,
      };
      result.webhook = { active: !!webhook?.url, url: webhook?.url ? 'https://artwaytm.pl/api/telegram/webhook' : '', pending: Number(webhook?.pending_update_count || 0), lastErrorAt: webhook?.last_error_date || null, lastError: clean(webhook?.last_error_message || '', 300) };
      result.target = target;
    } catch (error) { result.error = clean(error?.message || error, 400); }
    return result;
  }

  function operationalStats(state, incidents) {
    const now = new Date(), active = incidents.filter((item) => OPEN_STATES.has(incidentStatus(item, now)));
    const delivered = state.history.filter((item) => item.status === 'sent').length, failed = state.history.filter((item) => item.status === 'error').length;
    return {
      active: active.length, new: active.filter((item) => incidentStatus(item, now) === 'open').length,
      acknowledged: active.filter((item) => incidentStatus(item, now) === 'acknowledged').length,
      snoozed: active.filter((item) => incidentStatus(item, now) === 'snoozed').length,
      overdue: active.filter((item) => incidentOverdue(item, now)).length, resolved: incidents.filter((item) => item.status === 'resolved').length,
      retrying: state.outbox.filter((item) => item.status === 'retry').length, deadLetters: state.outbox.filter((item) => item.status === 'dead').length,
      deliveryRate: delivered + failed ? Math.round((delivered / (delivered + failed)) * 1000) / 10 : 100,
    };
  }

  async function view(center = {}, live = false) {
    const [settings, state, status] = await Promise.all([loadSettings(), loadState(), connection(live)]), events = telegramPriorityEvents(center);
    syncIncidents(state, events, settings); await saveState(state);
    const incidents = Object.values(state.events).sort((a, b) => Number(incidentOverdue(b)) - Number(incidentOverdue(a)) || String(b.lastSeenAt || '').localeCompare(String(a.lastSeenAt || '')));
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date());
    const sentToday = state.history.filter((item) => item.status === 'sent' && new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date(item.at)) === today).length;
    return {
      settings, status, events, incidents, quietNow: telegramQuietNow(settings),
      stats: { ...operationalStats(state, incidents), critical: events.filter((item) => item.severity === 'critical').length, sentToday, history: state.history.length },
      state: { initializedAt: state.initializedAt, updatedAt: state.updatedAt, lastDispatchAt: state.lastDispatchAt, lastDigestAt: state.lastDigestAt, lastDigestSlot: state.lastDigestSlot, dashboard: state.dashboard, health: state.health },
      history: state.history.slice(0, 120), outbox: state.outbox.slice(0, 50),
    };
  }

  async function saveSettings(raw = {}, operator = 'administrator') {
    const settings = telegramSettings(raw);
    await write(SETTINGS_KEY, { ...settings, updatedAt: nowIso(), updatedBy: clean(operator, 160) });
    const state = await loadState(); addHistory(state, { kind: 'settings', status: 'saved', title: 'Zmieniono ustawienia komunikacji', reason: `tryb ${settings.mode}`, source: operator });
    await saveState(state); return settings;
  }

  async function recordInboundAudit(input = {}) {
    const state = await loadState(), at = nowIso(), accepted = input.accepted === true, deferred = accepted && input.deferred === true;
    const kind = clean(input.kind || 'unknown', 40).replace(/[^a-z0-9_-]/gi, '') || 'unknown';
    const actorRef = clean(input.actorHash || '', 64).toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 24);
    state.health.lastWebhookAt = at;
    state.health.lastInboundKind = kind;
    state.health.lastInboundStatus = accepted ? (deferred ? 'deferred' : 'accepted') : 'rejected';
    if (accepted) state.health.inboundAccepted = Math.max(0, Number(state.health.inboundAccepted) || 0) + 1;
    if (deferred) state.health.inboundDeferred = Math.max(0, Number(state.health.inboundDeferred) || 0) + 1;
    if (!accepted) {
      state.health.inboundRejected = Math.max(0, Number(state.health.inboundRejected) || 0) + 1;
      state.health.lastRejectedAt = at;
      state.health.lastRejectedKind = kind;
      state.health.lastRejectedRef = actorRef;
    }
    addHistory(state, {
      direction: 'in', kind: 'webhook', status: state.health.lastInboundStatus, category: kind,
      title: accepted ? (deferred ? 'Przekazano wiadomość do Agenta' : 'Obsłużono wiadomość lokalnie') : 'Odrzucono wiadomość przez kontrolę dostępu',
      reason: !accepted && actorRef ? `ref ${actorRef}` : '',
      source: 'telegram-webhook',
      preview: accepted ? input.preview : '',
      fromLabel: accepted ? clean(input.fromLabel || 'Użytkownik Telegram', 160) : 'Nieuprawniony nadawca',
      toLabel: accepted ? clean(input.toLabel || 'Agent Artway-TM', 160) : 'Kontrola dostępu',
      messageId: accepted ? input.messageId : null,
      threadId: accepted ? input.threadId : null,
      conversationKey: accepted ? input.conversationKey : 'telegram-security',
    });
    await saveState(state);
    return {
      accepted, deferred, kind, at,
      counts: {
        accepted: state.health.inboundAccepted,
        deferred: state.health.inboundDeferred,
        rejected: state.health.inboundRejected,
      },
    };
  }

  async function recordOutboundAudit(input = {}) {
    const state = await loadState();
    addHistory(state, {
      direction: 'out', kind: input.kind || 'message', status: input.status || 'sent',
      category: input.category || 'conversation', severity: input.severity || 'info',
      title: input.title || 'Wiadomość Telegram', reason: input.reason || '',
      messageId: input.messageId, source: input.source || 'system', preview: input.preview,
      fromLabel: input.fromLabel || 'Agent Artway-TM', toLabel: input.toLabel || 'Główna grupa Telegram',
      threadId: input.threadId, conversationKey: input.conversationKey || 'telegram-main',
    });
    await saveState(state);
    return { recorded: true };
  }

  async function sendManual(message, options = {}) {
    const state = await loadState();
    try {
      const sent = await sendTeamHtml(message, options);
      addHistory(state, { kind: options.kind || 'manual', status: 'sent', category: options.category || 'manual', severity: options.severity || 'info', title: options.title || 'Ręczna wiadomość', messageId: sent?.message_id, source: options.source || 'admin-panel', preview: message, fromLabel: options.fromLabel || 'Panel administratora', toLabel: options.toLabel || 'Główna grupa Telegram', threadId: options.messageThreadId, conversationKey: options.conversationKey || 'telegram-main' });
      await saveState(state); return sent;
    } catch (error) {
      addHistory(state, { kind: options.kind || 'manual', status: 'error', category: options.category || 'manual', severity: options.severity || 'info', title: options.title || 'Ręczna wiadomość', reason: error?.message || error, source: options.source || 'admin-panel', preview: message, fromLabel: options.fromLabel || 'Panel administratora', toLabel: options.toLabel || 'Główna grupa Telegram', threadId: options.messageThreadId, conversationKey: options.conversationKey || 'telegram-main' });
      await saveState(state); throw error;
    }
  }

  async function sendManualDocument(document = {}, options = {}) {
    const state = await loadState();
    try {
      const config = await accountConfig();
      const sent = await sendTelegramDocument(document, { ...options, teamUserIds: [...config.teamUserIds] }, env);
      addHistory(state, {
        kind: options.kind || 'document', status: 'sent', category: options.category || 'manual', severity: options.severity || 'info',
        title: options.title || 'Dokument', messageId: sent?.message_id, source: options.source || 'admin-panel',
        preview: document?.filename || 'dokument', fromLabel: options.fromLabel || 'Panel administratora',
        toLabel: options.toLabel || 'Główna grupa Telegram', threadId: options.messageThreadId,
        conversationKey: options.conversationKey || 'telegram-main',
      });
      await saveState(state); return sent;
    } catch (error) {
      addHistory(state, {
        kind: options.kind || 'document', status: 'error', category: options.category || 'manual', severity: options.severity || 'info',
        title: options.title || 'Dokument', reason: error?.message || error, source: options.source || 'admin-panel',
        preview: document?.filename || 'dokument', fromLabel: options.fromLabel || 'Panel administratora',
        toLabel: options.toLabel || 'Główna grupa Telegram', threadId: options.messageThreadId,
        conversationKey: options.conversationKey || 'telegram-main',
      });
      await saveState(state); throw error;
    }
  }

  async function editIncidentMessage(record, heading = '') {
    if (!record.messageId) return false;
    try {
      await editTelegramHtml(telegramIncidentCard(record, heading), { messageId: record.messageId, chatId: record.chatId, replyMarkup: telegramIncidentKeyboard(record) }, env); return true;
    } catch (error) {
      if (/message is not modified/i.test(String(error?.message || ''))) return true;
      return false;
    }
  }

  async function archiveSupersededMessage(record) {
    if (!record?.messageId) return false;
    const facts = (Array.isArray(record.facts) ? record.facts : []).filter(Boolean).slice(0, 2).map((item) => telegramHtml(item)).join(' · ');
    const text = [`<b>↪ Nowsza wiadomość w tej rozmowie</b>`, telegramHtml(compactLine(record.title || 'Sprawa klienta', 120)), facts].filter(Boolean).join('\n');
    try {
      await editTelegramHtml(text, { messageId: record.messageId, chatId: record.chatId, replyMarkup: telegramIncidentKeyboard({ ...record, workflowEnabled: false }) }, env);
      return true;
    } catch (error) { return /message is not modified/i.test(String(error?.message || '')); }
  }

  async function deliverIncident(record, settings, heading = '') {
    if (record.messageId && await editIncidentMessage(record, heading)) return { message_id: record.messageId, chat: { id: record.chatId }, edited: true };
    const sent = await sendTeamHtml(telegramIncidentCard(record, heading), { replyMarkup: telegramIncidentKeyboard(record), messageThreadId: telegramTopicId(settings, record.category) });
    return sent;
  }

  function enqueue(state, record, error, heading = '') {
    const existing = state.outbox.find((item) => item.incidentId === record.id && item.status === 'retry');
    if (existing) { existing.lastError = clean(error?.message || error, 400); return; }
    state.outbox.unshift({ id: crypto.randomUUID(), incidentId: record.id, key: record.key, heading: clean(heading, 160), status: 'retry', attempts: 0, nextAttemptAt: plusMinutes(nowIso(), 15), lastError: clean(error?.message || error, 400), createdAt: nowIso() });
  }

  async function processOutbox(state, settings) {
    let sent = 0, failed = 0;
    const deliveredIncidentIds = [];
    for (const item of state.outbox.filter((entry) => entry.status === 'retry' && Date.parse(entry.nextAttemptAt || '') <= Date.now()).slice(0, 5)) {
      const record = Object.values(state.events).find((event) => event.id === item.incidentId);
      if (!record || record.status === 'resolved') { item.status = 'cancelled'; continue; }
      try {
        const result = await deliverIncident(record, settings, item.heading); record.messageId = result?.message_id || record.messageId; record.chatId = String(result?.chat?.id || record.chatId || '');
        record.sentAt = nowIso(); item.status = 'sent'; item.sentAt = nowIso(); sent += 1;
        deliveredIncidentIds.push(record.id);
        addHistory(state, { kind: 'retry', status: 'sent', category: record.category, severity: record.severity, title: record.title, messageId: record.messageId, incidentId: record.id, source: 'delivery-queue', preview: telegramIncidentCard(record, item.heading), fromLabel: 'Automatyka Artway-TM' });
      } catch (error) {
        item.attempts = Number(item.attempts || 0) + 1; item.lastError = clean(error?.message || error, 400); failed += 1;
        if (item.attempts >= 3) item.status = 'dead'; else item.nextAttemptAt = plusMinutes(nowIso(), [15, 60, 240][item.attempts] || 240);
      }
    }
    state.outbox = state.outbox.filter((item) => item.status !== 'sent' && item.status !== 'cancelled').slice(0, 100);
    return { sent, failed, deliveredIncidentIds };
  }

  async function managedEvent(eventInput = {}, message = '', options = {}) {
    const [settings, state] = await Promise.all([loadSettings(), loadState()]), timestamp = nowIso();
    const event = {
      key: clean(eventInput.key || eventInput.title || 'event', 140), category: eventInput.category || 'operations', severity: eventInput.severity || 'warning',
      count: Math.max(1, Number(eventInput.count) || 1), title: clean(eventInput.title || 'Nowe zdarzenie', 240), description: clean(eventInput.description || '', 700),
      doneWhen: clean(eventInput.doneWhen || '', 500), href: clean(eventInput.href || '', 500),
      facts: Array.isArray(eventInput.facts) ? eventInput.facts : [], items: Array.isArray(eventInput.items) ? eventInput.items : [],
    };
    event.fingerprint = clean(eventInput.fingerprint || hashEvent(event), 80);
    const previous = state.events[event.key] || null, changed = !!previous && previous.fingerprint !== event.fingerprint;
    const record = incidentFromEvent(event, previous, settings, timestamp); record.customText = clean(message, 3300); record.managed = true; state.events[event.key] = record;
    const legacyPrefix = clean(eventInput.legacyPrefix || '', 140), superseded = legacyPrefix ? Object.entries(state.events).filter(([key, item]) => key !== event.key && key.startsWith(legacyPrefix) && OPEN_STATES.has(incidentStatus(item))).slice(0, 10) : [];
    for (const [, item] of superseded) {
      item.status = 'resolved'; item.resolvedAt = timestamp; item.resolutionReason = 'Zastąpiona nowszą wiadomością w tej samej sprawie';
      await editIncidentMessage(item);
    }
    const freshCustomerNotification = event.category === 'customer' && (!previous || changed || previous.pendingNotification === true);
    const decision = telegramEventDecision(event, settings, freshCustomerNotification ? null : previous, new Date(), { newEvent: !previous || freshCustomerNotification });
    if (record.status !== 'open' || !decision.deliver) {
      record.pendingNotification = record.status === 'open' && freshCustomerNotification;
      const edited = !freshCustomerNotification && record.status === 'open' && changed && record.messageId ? await editIncidentMessage(record) : false;
      await saveState(state); return { sent: false, edited, skipped: true, reason: record.status !== 'open' ? `stan ${record.status}` : decision.reason, incidentId: record.id };
    }
    try {
      if (freshCustomerNotification && previous?.messageId) {
        await archiveSupersededMessage(previous); record.messageId = null; record.chatId = '';
      }
      const sent = await deliverIncident(record, settings); record.messageId = sent?.message_id || record.messageId; record.chatId = String(sent?.chat?.id || record.chatId || ''); record.sentAt = timestamp;
      record.pendingNotification = false;
      addHistory(state, { kind: 'incident', status: 'sent', category: record.category, severity: record.severity, title: record.title, reason: decision.reason, messageId: record.messageId, incidentId: record.id, source: options.source || 'automation', preview: telegramIncidentCard(record), fromLabel: 'Automatyka Artway-TM' });
      await saveState(state); return { sent: true, messageId: record.messageId, incidentId: record.id, edited: sent?.edited === true };
    } catch (error) {
      enqueue(state, record, error); addHistory(state, { kind: 'incident', status: 'error', category: record.category, severity: record.severity, title: record.title, reason: error?.message || error, incidentId: record.id, source: options.source || 'automation' });
      await saveState(state); return { sent: false, queued: true, reason: 'błąd dostarczenia — zapisano do ponowienia', incidentId: record.id };
    }
  }

  async function refreshDashboard(center = {}, options = {}) {
    const [settings, state] = await Promise.all([loadSettings(), loadState()]), events = telegramPriorityEvents(center); syncIncidents(state, events, settings);
    const incidents = Object.values(state.events), text = telegramDashboardCard(center, incidents);
    let result = null;
    if (state.dashboard.messageId) {
      try { result = await editTelegramHtml(text, { messageId: state.dashboard.messageId, chatId: state.dashboard.chatId, replyMarkup: panelButtons() }, env); }
      catch (error) { if (!/message is not modified/i.test(String(error?.message || ''))) state.dashboard.messageId = null; }
    }
    if (!state.dashboard.messageId && options.create === true) {
      result = await sendTeamHtml(text, { silent: true, replyMarkup: panelButtons(), messageThreadId: telegramTopicId(settings, 'operations') });
      state.dashboard = { messageId: result?.message_id || null, chatId: String(result?.chat?.id || ''), createdAt: nowIso(), updatedAt: nowIso() };
      addHistory(state, { kind: 'dashboard', status: 'sent', title: 'Utworzono stały pulpit operacyjny', messageId: result?.message_id, source: options.source || 'admin-panel', preview: text, fromLabel: 'Automatyka Artway-TM' });
    } else if (state.dashboard.messageId) state.dashboard.updatedAt = nowIso();
    await saveState(state); return { active: !!state.dashboard.messageId, created: !!result && options.create === true, messageId: state.dashboard.messageId, updatedAt: state.dashboard.updatedAt };
  }

  async function dispatch(center = {}, options = {}) {
    const [settings, state] = await Promise.all([loadSettings(), loadState()]), events = telegramPriorityEvents(center), timestamp = nowIso(), previousEvents = { ...(state.events || {}) };
    state.lastDispatchAt = timestamp; state.health.lastCycleAt = timestamp; const retry = await processOutbox(state, settings); const autoResolved = syncIncidents(state, events, settings, timestamp);
    for (const record of autoResolved.filter((item) => item.messageId).slice(0, 10)) await editIncidentMessage(record);
    if (options.retryOnly === true) {
      state.health.lastSuccessAt = timestamp;
      state.health.consecutiveErrors = 0;
      state.health.lastError = '';
      await saveState(state);
      return { sent: retry.sent > 0, delivered: [], urgent: 0, digest: 0, escalated: 0, resolved: autoResolved.length, retry, events: events.length, quietNow: telegramQuietNow(settings), reason: retry.sent ? 'ponowiono wyłącznie wcześniej niedostarczone alerty' : 'brak alertów gotowych do ponowienia' };
    }
    if (!state.initializedAt && !options.force) {
      state.initializedAt = timestamp; for (const event of events) state.events[event.key].digestFingerprint = event.fingerprint;
      state.health.lastSuccessAt = timestamp; state.health.consecutiveErrors = 0; addHistory(state, { kind: 'baseline', status: 'saved', title: 'Utworzono punkt odniesienia bez wysyłania starych alertów', reason: `${events.length} aktywnych spraw`, source: options.source || 'schedule' });
      await saveState(state); return { sent: false, baseline: true, events: events.length, retry, reason: 'Pierwsze uruchomienie nie wysyła zaległych komunikatów.' };
    }
    const urgent = [];
    for (const event of events) {
      const record = state.events[event.key], previous = previousEvents[event.key] || null;
      const decision = telegramEventDecision(event, settings, previous, new Date(), { newEvent: !previous }); record.lastDecision = decision.reason;
      if (record.status === 'open' && decision.deliver) urgent.push(record);
    }
    const delivered = [];
    for (const record of urgent.slice(0, settings.maxItems)) {
      try {
        const sent = await deliverIncident(record, settings); record.messageId = sent?.message_id || record.messageId; record.chatId = String(sent?.chat?.id || record.chatId || ''); record.sentAt = timestamp; record.digestFingerprint = record.fingerprint; delivered.push(record.id);
        addHistory(state, { kind: 'urgent', status: 'sent', category: record.category, severity: record.severity, title: record.title, messageId: record.messageId, incidentId: record.id, source: options.source || 'schedule', preview: telegramIncidentCard(record), fromLabel: 'Automatyka Artway-TM' });
      } catch (error) { enqueue(state, record, error); addHistory(state, { kind: 'urgent', status: 'error', category: record.category, severity: record.severity, title: record.title, reason: error?.message || error, incidentId: record.id, source: options.source || 'schedule' }); }
    }
    const slot = options.forceDigest ? `manual-${Date.now()}` : telegramDigestSlot(settings, state);
    const digestRecords = Object.values(state.events).filter((record) => ['open', 'acknowledged'].includes(incidentStatus(record)) && record.digestFingerprint !== record.fingerprint && !delivered.includes(record.id)).slice(0, settings.maxItems);
    let digestSent = 0;
    if (slot && digestRecords.length) {
      try {
        const sent = await sendTeamHtml(telegramRenderEvents(digestRecords, '📋 Nowe sprawy'), { silent: true, replyMarkup: panelButtons(), messageThreadId: telegramTopicId(settings, 'operations') });
        for (const record of digestRecords) { record.digestFingerprint = record.fingerprint; record.digestSentAt = timestamp; }
        digestSent = digestRecords.length; state.lastDigestAt = timestamp; state.lastDigestSlot = slot; addHistory(state, { kind: 'digest', status: 'sent', category: 'operations', severity: 'info', title: `Raport zbiorczy: ${digestRecords.length} spraw`, messageId: sent?.message_id, source: options.source || 'schedule', preview: telegramRenderEvents(digestRecords, '📋 Nowe sprawy'), fromLabel: 'Automatyka Artway-TM' });
      } catch (error) { addHistory(state, { kind: 'digest', status: 'error', title: 'Raport zbiorczy', reason: error?.message || error, source: options.source || 'schedule' }); }
    }
    const deliveredThisCycle = new Set([...(retry.deliveredIncidentIds || []), ...delivered]);
    const escalated = [];
    if (settings.escalationEnabled && !telegramQuietNow(settings)) for (const record of Object.values(state.events).filter((item) => item.severity === 'critical' && incidentOverdue(item)).slice(0, settings.maxItems)) {
      if (deliveredThisCycle.has(record.id)) continue;
      const elapsed = (Date.now() - Date.parse(record.lastEscalatedAt || 0)) / 60000;
      if (record.escalationLevel >= settings.maxEscalations || (record.lastEscalatedAt && elapsed < settings.escalationRepeatMinutes)) continue;
      try {
        const sent = await sendTeamHtml(escalationCard(record), { replyMarkup: telegramIncidentKeyboard(record), messageThreadId: telegramTopicId(settings, record.category) });
        record.escalationLevel = Number(record.escalationLevel || 0) + 1; record.lastEscalatedAt = timestamp; escalated.push(record.id);
        addHistory(state, { kind: 'escalation', status: 'sent', category: record.category, severity: record.severity, title: record.title, messageId: sent?.message_id, incidentId: record.id, source: options.source || 'schedule', preview: escalationCard(record), fromLabel: 'Automatyka Artway-TM' });
      } catch (error) { enqueue(state, record, error, '⏱️ Eskalacja SLA'); }
    }
    if (state.dashboard.messageId) {
      const dashboardText = telegramDashboardCard(center, Object.values(state.events));
      try { await editTelegramHtml(dashboardText, { messageId: state.dashboard.messageId, chatId: state.dashboard.chatId, replyMarkup: panelButtons() }, env); state.dashboard.updatedAt = timestamp; } catch (error) { if (!/message is not modified/i.test(String(error?.message || ''))) state.health.lastError = clean(error?.message || error, 400); }
    }
    state.health.lastSuccessAt = timestamp; state.health.consecutiveErrors = 0; state.health.lastError = '';
    await saveState(state);
    return { sent: delivered.length > 0 || digestSent > 0 || escalated.length > 0, delivered, urgent: urgent.length, digest: digestSent, escalated: escalated.length, resolved: autoResolved.length, retry, events: events.length, quietNow: telegramQuietNow(settings), reason: delivered.length || escalated.length ? 'obsłużono wyłącznie nowe lub przeterminowane sprawy' : 'brak nowych informacji spełniających politykę wysyłki' };
  }

  async function incidentAction(id, action, actor = {}, options = {}) {
    const state = await loadState(), record = Object.values(state.events).find((item) => item.id === id);
    if (!record) { const error = new Error('Nie znaleziono sprawy albo została już usunięta z rejestru.'); error.status = 404; throw error; }
    const at = nowIso(), name = clean(actor.name || actor.username || actor.email || 'administrator', 120), userId = clean(actor.id || '', 80);
    if (action === 'ack') { record.status = 'acknowledged'; record.owner = { id: userId, name }; record.acknowledgedAt = at; record.snoozedUntil = ''; record.pendingNotification = false; }
    else if (action === 's1' || action === 's24') { record.status = 'snoozed'; record.owner = { id: userId, name }; record.snoozedUntil = plusMinutes(at, action === 's1' ? 60 : 1440); record.pendingNotification = false; }
    else if (action === 'resolve') { record.status = 'resolved'; record.resolvedAt = at; record.resolutionReason = 'Oznaczono jako załatwione wewnętrznie'; record.owner = { id: userId, name }; record.snoozedUntil = ''; record.pendingNotification = false; }
    else if (action === 'reopen') { record.status = 'open'; record.resolvedAt = ''; record.resolutionReason = ''; record.snoozedUntil = ''; record.dueAt = plusMinutes(at, record.slaMinutes || 60); record.escalationLevel = 0; record.pendingNotification = false; }
    else { const error = new Error('Nieobsługiwana akcja sprawy.'); error.status = 422; throw error; }
    addHistory(state, { direction: options.direction || 'in', kind: 'incident-action', status: record.status, category: record.category, severity: record.severity, title: record.title, reason: `${action} • ${name}`, incidentId: record.id, source: options.source || 'telegram' });
    await editIncidentMessage(record); await saveState(state);
    return { incident: record, notice: action === 'ack' ? 'Sprawa przypisana do Ciebie.' : action === 'resolve' ? 'Sprawa oznaczona jako załatwiona wewnętrznie.' : action === 'reopen' ? 'Sprawa przywrócona do obsługi.' : `Sprawa odłożona: ${incidentLabel(record)}.` };
  }

  async function deliveryAction(id, action, operator = 'administrator') {
    const state = await loadState(), item = state.outbox.find((entry) => entry.id === id);
    if (!item) { const error = new Error('Nie znaleziono wpisu kolejki dostarczeń.'); error.status = 404; throw error; }
    if (action === 'retry') { item.status = 'retry'; item.attempts = 0; item.nextAttemptAt = nowIso(); item.lastError = ''; }
    else if (action === 'dismiss') state.outbox = state.outbox.filter((entry) => entry.id !== id);
    else { const error = new Error('Nieobsługiwana akcja kolejki.'); error.status = 422; throw error; }
    addHistory(state, { kind: 'delivery-action', status: action === 'retry' ? 'saved' : 'dismissed', title: action === 'retry' ? 'Ponowiono dostarczenie' : 'Usunięto martwy wpis kolejki', reason: `#${item.incidentId || '—'}`, source: operator });
    await saveState(state); return { action, id };
  }

  async function registerWebhook(origin = 'https://artwaytm.pl') {
    const secret = telegramWebhookSecret(env); if (!secret) throw new Error('Nie można zabezpieczyć webhooka bez tokenu Telegram.');
    const url = `${String(origin || 'https://artwaytm.pl').replace(/\/$/, '')}/api/telegram/webhook`;
    const result = await telegramApi('setWebhook', { url, secret_token: secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true, max_connections: 20 }, env);
    const commands = [
      { command: 'agent', description: 'Przekaż zwykłe polecenie Agentowi Codex' },
      { command: 'centrum', description: 'Centrum operacyjne sklepu' },
      { command: 'decyzje', description: 'Decyzje oczekujące na zatwierdzenie' },
      { command: 'raport', description: 'Przygotuj raport na żądanie' },
      { command: 'wykonaj', description: 'Wykonaj kontrolowane zadanie' },
      { command: 'produkty', description: 'Produkty i kartoteki' },
      { command: 'producenci', description: 'Producenci i dostępność' },
      { command: 'diagnostyka', description: 'Diagnostyka sklepu i integracji' },
      { command: 'monitor', description: 'Monitoring najważniejszych spraw' },
      { command: 'sprawdz', description: 'Sprawdź wskazaną rzecz' },
      { command: 'zlecenie', description: 'Obsługa wskazanego zlecenia' },
      { command: 'nadwyzki', description: 'Nadwyżki i decyzje magazynowe' },
      { command: 'linki', description: 'Kontrola linków producentów' },
      { command: 'opisy', description: 'Kontrola opisów produktów' },
      { command: 'status', description: 'Najważniejsze sprawy i kondycja sklepu' },
      { command: 'zamowienia', description: 'Nowe i aktywne zamówienia' },
      { command: 'braki', description: 'Braki i zamówienia do producentów' },
      { command: 'wiadomosci', description: 'Sprawy klientów do odpowiedzi' },
      { command: 'wysylki', description: 'Wysyłki i numery InPost' },
      { command: 'magazyn', description: 'Stan operacyjny magazynu' },
      { command: 'start', description: 'Uruchom pomoc bota' },
      { command: 'pomoc', description: 'Przykłady zwykłych pytań' },
      { command: 'settings', description: 'Ustawienia komunikacji i SLA' },
    ];
    await telegramApi('setMyCommands', { commands }, env);
    await Promise.allSettled([
      telegramApi('setMyName', { name: 'Artway Centrum Operacyjne' }, env),
      telegramApi('setMyName', { name: 'Artway Centrum Operacyjne', language_code: 'pl' }, env),
      telegramApi('setMyDescription', { description: 'Centrum operacyjne Artway-TM: zamówienia, Allegro, InPost, magazyn, producenci i komunikacja zespołu.' }, env),
      telegramApi('setMyShortDescription', { short_description: 'Najważniejsze sprawy sklepu bez chaosu i powtórzeń.' }, env),
      telegramApi('setChatMenuButton', { menu_button: { type: 'commands' } }, env),
    ]);
    const state = await loadState(); addHistory(state, { kind: 'webhook', status: 'saved', title: 'Podłączono interaktywną komunikację przez stronę', source: 'admin-panel' }); await saveState(state);
    return { registered: result === true, url };
  }

  async function inbound(intentInput = '', center = {}, meta = {}) {
    const intent = ['help', 'status', 'orders', 'shortages', 'communication', 'shipping', 'warehouse', 'settings'].includes(intentInput) ? intentInput : telegramNaturalIntent(intentInput);
    const summary = center.summary || {}, events = telegramPriorityEvents(center), matching = (pattern) => events.filter((event) => pattern.test(`${event.key} ${event.category} ${event.title}`));
    let message, showButton = true;
    if (intent === 'status') { message = telegramRenderEvents(events.slice(0, 8), `🤖 Centrum · ${center.score ?? 0}%`); showButton = events.length > 0; }
    else if (intent === 'orders') {
      const metrics = [
        { value: summary.newOrders, label: 'nowych zamówień w sklepie' },
        { value: summary.activeAllegro, label: 'zamówień Allegro do obsługi' },
        { value: summary.shipmentsWithoutTracking, label: 'wysyłek bez numeru nadania' },
      ];
      showButton = metrics.some((item) => Number(item.value) > 0);
      message = renderTelegramMetricCard({
        title: '📦 Zamówienia · stan bieżący', empty: 'Brak nowych zamówień i zaległych wysyłek.', metrics,
        action: showButton ? 'Obsłuż najstarsze aktywne zamówienie.' : '',
      });
    } else if (intent === 'shortages') { const rows = matching(/producent|magazyn|brak|dostawc/).slice(0, 8); message = telegramRenderEvents(rows, '🏭 Braki i producenci'); showButton = rows.length > 0; }
    else if (intent === 'communication') {
      showButton = Number(summary.communicationWaiting) > 0;
      message = renderTelegramMetricCard({
        title: '💬 Komunikacja z klientami', empty: 'Nikt nie czeka na odpowiedź.',
        metrics: [{ value: summary.communicationWaiting, label: 'rozmów wymaga odpowiedzi' }],
        action: showButton ? 'Otwórz najstarszą rozmowę; Agent sprawdzi zamówienie i przesyłkę przed przygotowaniem odpowiedzi.' : '',
      });
    }
    else if (intent === 'shipping') {
      showButton = Number(summary.shipmentsWithoutTracking) > 0;
      message = renderTelegramMetricCard({
        title: '🚚 Wysyłki InPost', empty: 'Wszystkie aktywne wysyłki mają numer nadania.',
        metrics: [{ value: summary.shipmentsWithoutTracking, label: 'wysyłek nie ma numeru nadania' }],
        action: showButton ? 'Uzupełnij najstarszą wysyłkę bez numeru nadania.' : '',
      });
    }
    else if (intent === 'warehouse') {
      const metrics = [
        { value: summary.supplierUnavailable, label: 'produktów niedostępnych u producentów' },
        { value: summary.supplierLow, label: 'produktów z niską dostępnością' },
        { value: summary.supplierNeedsDecision, label: 'spraw wymaga decyzji administratora' },
      ];
      showButton = metrics.some((item) => Number(item.value) > 0);
      message = renderTelegramMetricCard({
        title: '🏬 Magazyn i dostępność', empty: 'Brak pilnych braków i decyzji.', metrics,
        action: showButton ? 'Sprawdź najpierw braki powiązane z aktywnymi zamówieniami.' : '',
      });
    } else if (intent === 'settings') message = '<b>⚙️ Ustawienia Telegram</b>\nAlerty, cisza nocna i terminy reakcji są zarządzane w jednym miejscu w panelu.';
    else { message = '<b>🤖 Agent Artway-TM</b>\nNapisz konkretnie, czego potrzebujesz, np. „pokaż nowe zamówienia”, „kto czeka na odpowiedź?” lub „pokaż braki do aktywnych zamówień”.'; showButton = false; }
    await recordInboundAudit({
      accepted: true, deferred: false, kind: 'local_command', preview: meta.text,
      fromLabel: meta.user || 'Użytkownik Telegram', messageId: meta.messageId,
      threadId: meta.messageThreadId, conversationKey: `telegram:${meta.chatId || 'main'}:${meta.messageThreadId || 0}`,
    });
    return { intent, message, replyMarkup: showButton ? panelButtons(intent) : undefined };
  }

  function panelButtons(intent = 'status') {
    const targets = {
      orders: ['Otwórz zamówienia', 'https://artwaytm.pl/#/admin/zamowienia'], shortages: ['Otwórz braki', 'https://artwaytm.pl/#/admin/magazyn/plan'],
      communication: ['Otwórz wiadomości', 'https://artwaytm.pl/#/admin/allegro/wiadomosci'], shipping: ['Otwórz wysyłki', 'https://artwaytm.pl/#/admin/wysylki'],
      warehouse: ['Otwórz magazyn', 'https://artwaytm.pl/#/admin/magazyn/stany'], settings: ['Otwórz ustawienia', 'https://artwaytm.pl/#/admin/agent-ai/telegram'],
      status: ['Otwórz centrum', 'https://artwaytm.pl/#/admin/agent-ai'], help: ['Otwórz Agenta', 'https://artwaytm.pl/#/admin/agent-ai'],
    };
    const [label, url] = targets[intent] || targets.status;
    return { inline_keyboard: [[{ text: label, url }]] };
  }

  return { connection, deliveryAction, dispatch, inbound, incidentAction, loadSettings, managedEvent, panelButtons, recordInboundAudit, recordOutboundAudit, refreshDashboard, registerWebhook, saveSettings, sendManual, sendManualDocument, view };
}

export { telegramPanelUrl, telegramIncidentCard, telegramIncidentKeyboard, telegramAgentReport, telegramDashboardCard };
