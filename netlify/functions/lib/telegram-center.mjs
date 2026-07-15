import crypto from 'node:crypto';
import {
  editTelegramHtml,
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

const SETTINGS_KEY = 'telegram_communication_settings';
const STATE_KEY = 'telegram_communication_state';
const OPEN_STATES = new Set(['open', 'acknowledged', 'snoozed']);

function clean(value = '', limit = 500) { return String(value ?? '').replace(/\u0000/g, '').slice(0, limit); }
function nowIso() { return new Date().toISOString(); }
function plusMinutes(iso, minutes) { return new Date(Date.parse(iso) + Math.max(0, Number(minutes) || 0) * 60000).toISOString(); }
function emptyState() {
  return {
    initializedAt: '', updatedAt: '', lastDispatchAt: '', lastDigestAt: '', lastDigestSlot: '', events: {}, history: [], outbox: [],
    dashboard: { messageId: null, chatId: '', updatedAt: '', createdAt: '' },
    health: { lastCycleAt: '', lastSuccessAt: '', lastErrorAt: '', lastError: '', consecutiveErrors: 0 },
  };
}

function compactEvents(events = {}) {
  const cutoff = Date.now() - 30 * 86400000;
  return Object.fromEntries(Object.entries(events).filter(([, record]) => record?.status !== 'resolved' || Date.parse(record.resolvedAt || record.lastSeenAt || 0) >= cutoff).sort(([, a], [, b]) => String(b.lastSeenAt || '').localeCompare(String(a.lastSeenAt || ''))).slice(0, 1000));
}

function hashEvent(event = {}) {
  return crypto.createHash('sha256').update(JSON.stringify([event.key, event.category, event.severity, event.count, event.title, event.description, event.facts, event.items])).digest('hex').slice(0, 24);
}

function auditEntry(input = {}) {
  return {
    id: crypto.randomUUID(), at: nowIso(), direction: input.direction || 'out', kind: clean(input.kind || 'event', 60),
    status: clean(input.status || 'sent', 40), category: clean(input.category || 'operations', 40), severity: clean(input.severity || 'info', 30),
    title: clean(input.title || 'Telegram', 240), reason: clean(input.reason || '', 300), messageId: input.messageId ?? null,
    source: clean(input.source || 'system', 100), chatId: clean(input.chatId || '', 100), incidentId: clean(input.incidentId || '', 40),
  };
}

function incidentStatus(record = {}, now = new Date()) {
  if (record.status === 'snoozed' && Date.parse(record.snoozedUntil || '') <= now.getTime()) return 'open';
  return ['open', 'acknowledged', 'snoozed', 'resolved'].includes(record.status) ? record.status : 'open';
}

function incidentOverdue(record = {}, now = new Date()) {
  return ['open', 'acknowledged'].includes(incidentStatus(record, now)) && !!record.dueAt && Date.parse(record.dueAt) <= now.getTime();
}

function compactLine(value = '', limit = 220) {
  const line = clean(value, limit * 2).replace(/\s+/g, ' ').trim();
  return line.length > limit ? `${line.slice(0, limit - 1).trimEnd()}…` : line;
}

function polishForm(value, one, few, many) {
  const count = Math.abs(Number(value) || 0), last = count % 10, lastTwo = count % 100;
  if (count === 1) return one;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return few;
  return many;
}

function warsawDayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function shortMoment(value, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' });
  const today = warsawDayKey(now), target = warsawDayKey(date);
  const tomorrow = warsawDayKey(new Date(now.getTime() + 86400000));
  if (target === today) return time;
  if (target === tomorrow) return `jutro ${time}`;
  return `${date.toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit' })} ${time}`;
}

function cleanCustomMessage(value = '') {
  return clean(value, 3300)
    .replace(/(?:^|\n)(?:Otwórz|Panel):\s*https?:\/\/\S+/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function incidentFromEvent(event = {}, previous = null, settings = {}, timestamp = nowIso()) {
  const fingerprint = clean(event.fingerprint || hashEvent(event), 80), changed = !!previous && previous.fingerprint !== fingerprint;
  const reopened = !previous || (changed && ['acknowledged', 'snoozed', 'resolved'].includes(previous.status));
  const status = reopened ? 'open' : incidentStatus(previous || {}, new Date(timestamp));
  const slaMinutes = telegramSlaMinutes(event, settings), firstSeenAt = reopened ? timestamp : (previous?.firstSeenAt || timestamp);
  return {
    ...(previous || {}), id: previous?.id || telegramIncidentId(event.key), key: event.key, fingerprint, category: event.category || 'operations',
    severity: event.severity || 'warning', count: Math.max(1, Number(event.count) || 1), title: clean(event.title || 'Zdarzenie', 240),
    description: clean(event.description || '', 700), doneWhen: clean(event.doneWhen || '', 500), href: clean(event.href || '', 500),
    facts: (Array.isArray(event.facts) ? event.facts : []).map((item) => compactLine(item, 100)).filter(Boolean).slice(0, 4),
    items: (Array.isArray(event.items) ? event.items : []).map((item) => compactLine(item, 140)).filter(Boolean).slice(0, 8),
    status, firstSeenAt, lastSeenAt: timestamp, dueAt: reopened ? (slaMinutes ? plusMinutes(timestamp, slaMinutes) : '') : (previous?.dueAt || (slaMinutes ? plusMinutes(previous?.firstSeenAt || timestamp, slaMinutes) : '')),
    slaMinutes, owner: reopened ? null : (previous?.owner || null), acknowledgedAt: reopened ? '' : (previous?.acknowledgedAt || ''),
    snoozedUntil: status === 'snoozed' ? previous?.snoozedUntil || '' : '', resolvedAt: status === 'resolved' ? previous?.resolvedAt || '' : '',
    resolutionReason: status === 'resolved' ? previous?.resolutionReason || '' : '', workflowEnabled: settings.incidentWorkflow !== false, escalationLevel: reopened ? 0 : Math.max(0, Number(previous?.escalationLevel) || 0),
    lastEscalatedAt: reopened ? '' : (previous?.lastEscalatedAt || ''), customText: changed ? '' : clean(previous?.customText || '', 3300),
  };
}

function incidentLabel(record = {}) {
  if (record.status === 'resolved') return '✅ Załatwiona';
  if (record.status === 'snoozed') return `⏸ Odłożona${record.snoozedUntil ? ` do ${shortMoment(record.snoozedUntil)}` : ''}`;
  if (record.status === 'acknowledged') return `👤 ${record.owner?.name || 'Przyjęta'}`;
  return '🔔 Nowa';
}

export function telegramIncidentCard(record = {}, heading = '') {
  const status = incidentStatus(record), overdue = incidentOverdue(record), custom = cleanCustomMessage(record.customText || '');
  const icon = heading.includes('Eskalacja') || overdue ? '⏱' : record.severity === 'critical' ? '🔴' : '🟠';
  const facts = (Array.isArray(record.facts) ? record.facts : []).filter(Boolean).map((item) => telegramHtml(item)).join(' · ');
  const items = (Array.isArray(record.items) ? record.items : []).filter(Boolean).map((item) => `• ${telegramHtml(item)}`).join('\n');
  const description = compactLine(record.description || '', 220);
  const content = custom || [
    `<b>${icon} ${telegramHtml(compactLine(record.title || 'Sprawa', 120))}</b>${Number(record.count) > 1 ? ` · ${Number(record.count)}` : ''}`,
    facts,
    description ? `<blockquote>${telegramHtml(description)}</blockquote>` : '',
    items,
  ].filter(Boolean).join('\n');
  const meta = [
    status === 'open' ? '' : incidentLabel({ ...record, status }),
    status !== 'resolved' && status !== 'snoozed' && overdue ? '⏱ Po terminie' : '',
    status !== 'resolved' && status !== 'snoozed' && !overdue && record.dueAt ? `⏱ do ${shortMoment(record.dueAt)}` : '',
  ].filter(Boolean).join(' · ');
  return `${content}${meta ? `\n\n${telegramHtml(meta)}` : ''}`;
}

export function telegramIncidentKeyboard(record = {}) {
  const id = record.id || telegramIncidentId(record.key), open = { text: 'Otwórz', url: record.href || 'https://artwaytm.pl/#/admin/agent-ai/telegram' };
  if (record.workflowEnabled === false) return { inline_keyboard: [[open]] };
  if (record.status === 'resolved') return { inline_keyboard: [[{ text: '↩ Przywróć', callback_data: `tg:reopen:${id}` }, open]] };
  if (record.status === 'open') return { inline_keyboard: [[{ text: '👤 Przyjmuję', callback_data: `tg:ack:${id}` }, open]] };
  return { inline_keyboard: [[{ text: '✅ Załatwione', callback_data: `tg:resolve:${id}` }, open]] };
}

export function telegramAgentReport(center = {}) {
  const summary = center.summary || {}, priorities = (Array.isArray(center.priorities) ? center.priorities : []).filter((item) => Number(item.count) > 0).slice(0, 6);
  const icons = { critical: '🔴', warning: '🟡', info: '🔵' };
  const metrics = [
    [summary.newOrders, '📦', ['nowe zamówienie sklepu', 'nowe zamówienia sklepu', 'nowych zamówień sklepu']],
    [summary.activeAllegro, '🟠', ['zamówienie Allegro do obsługi', 'zamówienia Allegro do obsługi', 'zamówień Allegro do obsługi']],
    [summary.communicationWaiting, '💬', ['odpowiedź dla klienta', 'odpowiedzi dla klientów', 'odpowiedzi dla klientów']],
    [summary.shipmentsWithoutTracking, '🚚', ['wysyłka bez numeru', 'wysyłki bez numeru', 'wysyłek bez numeru']],
    [summary.companyOrdersWithoutInvoice, '🧾', ['faktura do wystawienia', 'faktury do wystawienia', 'faktur do wystawienia']],
    [summary.supplierNeedsDecision, '🏭', ['decyzja o dostępności', 'decyzje o dostępności', 'decyzji o dostępności']],
  ].filter(([value]) => Number(value) > 0).map(([value, icon, forms]) => `<b>${Number(value)}</b> ${icon} ${polishForm(value, ...forms)}`);
  const actions = priorities.map((item) => `${icons[item.severity] || '•'} <b>${telegramHtml(compactLine(item.title || 'Sprawa', 110))}</b>${Number(item.count) > 1 ? ` · ${Number(item.count)}` : ''}${item.action ? `\n${telegramHtml(compactLine(item.action, 150))}` : ''}`);
  if (!metrics.length && !actions.length) return `<b>✅ Sklep działa prawidłowo · ${center.score ?? 0}%</b>\nBrak spraw wymagających reakcji.`;
  return [`<b>📊 Raport operacyjny · ${center.score ?? 0}%</b>`, metrics.length ? metrics.join('\n') : '', actions.length ? `<b>Do zrobienia</b>\n${actions.join('\n\n')}` : ''].filter(Boolean).join('\n\n');
}

export function telegramDashboardCard(center = {}, incidents = []) {
  const active = incidents.filter((item) => OPEN_STATES.has(incidentStatus(item))), overdue = active.filter((item) => incidentOverdue(item));
  if (!active.length) return `<b>✅ Brak spraw wymagających reakcji</b>\nKondycja sklepu: ${center.score ?? 0}%`;
  const parts = [
    [active.filter((item) => incidentStatus(item) === 'open').length, ['nowa', 'nowe', 'nowych']],
    [active.filter((item) => incidentStatus(item) === 'acknowledged').length, ['w obsłudze', 'w obsłudze', 'w obsłudze']],
    [active.filter((item) => incidentStatus(item) === 'snoozed').length, ['odłożona', 'odłożone', 'odłożonych']],
    [overdue.length, ['po terminie', 'po terminie', 'po terminie']],
  ].filter(([value]) => value > 0).map(([value, forms]) => `${value} ${polishForm(value, ...forms)}`);
  return `<b>📡 Centrum operacyjne · ${center.score ?? 0}%</b>\n${parts.join(' · ')}`;
}

function escalationCard(record = {}) {
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(record.dueAt || Date.now())) / 60000));
  return `<b>⏱ ${minutes} min po terminie</b>\n${telegramHtml(compactLine(record.title || 'Pilna sprawa', 120))}${Number(record.count) > 1 ? ` · ${Number(record.count)}` : ''}\n${record.owner?.name ? `👤 ${telegramHtml(record.owner.name)}` : 'Nieprzypisana'}`;
}

export function createTelegramCenter({ read, write, env = process.env } = {}) {
  if (typeof read !== 'function' || typeof write !== 'function') throw new Error('Telegram Center wymaga repozytorium read/write');

  async function loadSettings() { return telegramSettings(await read(SETTINGS_KEY, {})); }
  async function loadState() {
    const raw = await read(STATE_KEY, emptyState()), base = emptyState(), source = raw && typeof raw === 'object' ? raw : {};
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
    const config = telegramConfig(env), result = { configured: !!(config.token && config.chatId), chatConfigured: !!config.chatId, botConfigured: !!config.token, bot: null, webhook: null, error: '' };
    if (!live || !config.token) return result;
    try {
      const [bot, webhook] = await Promise.all([telegramApi('getMe', {}, env), telegramApi('getWebhookInfo', {}, env)]);
      result.bot = { id: bot?.id || null, username: bot?.username || '', name: [bot?.first_name, bot?.last_name].filter(Boolean).join(' ') };
      result.webhook = { active: !!webhook?.url, url: webhook?.url ? 'https://artwaytm.pl/.netlify/functions/telegram-webhook' : '', pending: Number(webhook?.pending_update_count || 0), lastErrorAt: webhook?.last_error_date || null, lastError: clean(webhook?.last_error_message || '', 300) };
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

  async function sendManual(message, options = {}) {
    const state = await loadState();
    try {
      const sent = await sendTelegramHtml(message, options, env);
      addHistory(state, { kind: options.kind || 'manual', status: 'sent', category: options.category || 'manual', severity: options.severity || 'info', title: options.title || 'Ręczna wiadomość', messageId: sent?.message_id, source: options.source || 'admin-panel' });
      await saveState(state); return sent;
    } catch (error) {
      addHistory(state, { kind: options.kind || 'manual', status: 'error', category: options.category || 'manual', severity: options.severity || 'info', title: options.title || 'Ręczna wiadomość', reason: error?.message || error, source: options.source || 'admin-panel' });
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
    const sent = await sendTelegramHtml(telegramIncidentCard(record, heading), { replyMarkup: telegramIncidentKeyboard(record), messageThreadId: telegramTopicId(settings, record.category) }, env);
    return sent;
  }

  function enqueue(state, record, error, heading = '') {
    const existing = state.outbox.find((item) => item.incidentId === record.id && item.status === 'retry');
    if (existing) { existing.lastError = clean(error?.message || error, 400); return; }
    state.outbox.unshift({ id: crypto.randomUUID(), incidentId: record.id, key: record.key, heading: clean(heading, 160), status: 'retry', attempts: 0, nextAttemptAt: plusMinutes(nowIso(), 15), lastError: clean(error?.message || error, 400), createdAt: nowIso() });
  }

  async function processOutbox(state, settings) {
    let sent = 0, failed = 0;
    for (const item of state.outbox.filter((entry) => entry.status === 'retry' && Date.parse(entry.nextAttemptAt || '') <= Date.now()).slice(0, 5)) {
      const record = Object.values(state.events).find((event) => event.id === item.incidentId);
      if (!record || record.status === 'resolved') { item.status = 'cancelled'; continue; }
      try {
        const result = await deliverIncident(record, settings, item.heading); record.messageId = result?.message_id || record.messageId; record.chatId = String(result?.chat?.id || record.chatId || '');
        record.sentAt = nowIso(); item.status = 'sent'; item.sentAt = nowIso(); sent += 1;
        addHistory(state, { kind: 'retry', status: 'sent', category: record.category, severity: record.severity, title: record.title, messageId: record.messageId, incidentId: record.id, source: 'delivery-queue' });
      } catch (error) {
        item.attempts = Number(item.attempts || 0) + 1; item.lastError = clean(error?.message || error, 400); failed += 1;
        if (item.attempts >= 3) item.status = 'dead'; else item.nextAttemptAt = plusMinutes(nowIso(), [15, 60, 240][item.attempts] || 240);
      }
    }
    state.outbox = state.outbox.filter((item) => item.status !== 'sent' && item.status !== 'cancelled').slice(0, 100);
    return { sent, failed };
  }

  async function managedEvent(eventInput = {}, message = '', options = {}) {
    const [settings, state] = await Promise.all([loadSettings(), loadState()]), timestamp = nowIso();
    const event = {
      key: clean(eventInput.key || eventInput.title || 'event', 140), category: eventInput.category || 'operations', severity: eventInput.severity || 'warning',
      count: Math.max(1, Number(eventInput.count) || 1), title: clean(eventInput.title || 'Nowe zdarzenie', 240), description: clean(eventInput.description || '', 700),
      href: clean(eventInput.href || '', 500), facts: Array.isArray(eventInput.facts) ? eventInput.facts : [], items: Array.isArray(eventInput.items) ? eventInput.items : [],
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
      addHistory(state, { kind: 'incident', status: 'sent', category: record.category, severity: record.severity, title: record.title, reason: decision.reason, messageId: record.messageId, incidentId: record.id, source: options.source || 'automation' });
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
      result = await sendTelegramHtml(text, { silent: true, replyMarkup: panelButtons(), messageThreadId: telegramTopicId(settings, 'operations') }, env);
      state.dashboard = { messageId: result?.message_id || null, chatId: String(result?.chat?.id || ''), createdAt: nowIso(), updatedAt: nowIso() };
      addHistory(state, { kind: 'dashboard', status: 'sent', title: 'Utworzono stały pulpit operacyjny', messageId: result?.message_id, source: options.source || 'admin-panel' });
    } else if (state.dashboard.messageId) state.dashboard.updatedAt = nowIso();
    await saveState(state); return { active: !!state.dashboard.messageId, created: !!result && options.create === true, messageId: state.dashboard.messageId, updatedAt: state.dashboard.updatedAt };
  }

  async function dispatch(center = {}, options = {}) {
    const [settings, state] = await Promise.all([loadSettings(), loadState()]), events = telegramPriorityEvents(center), timestamp = nowIso(), previousEvents = { ...(state.events || {}) };
    state.lastDispatchAt = timestamp; state.health.lastCycleAt = timestamp; const retry = await processOutbox(state, settings); const autoResolved = syncIncidents(state, events, settings, timestamp);
    for (const record of autoResolved.filter((item) => item.messageId).slice(0, 10)) await editIncidentMessage(record);
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
        addHistory(state, { kind: 'urgent', status: 'sent', category: record.category, severity: record.severity, title: record.title, messageId: record.messageId, incidentId: record.id, source: options.source || 'schedule' });
      } catch (error) { enqueue(state, record, error); addHistory(state, { kind: 'urgent', status: 'error', category: record.category, severity: record.severity, title: record.title, reason: error?.message || error, incidentId: record.id, source: options.source || 'schedule' }); }
    }
    const slot = options.forceDigest ? `manual-${Date.now()}` : telegramDigestSlot(settings, state);
    const digestRecords = Object.values(state.events).filter((record) => ['open', 'acknowledged'].includes(incidentStatus(record)) && record.digestFingerprint !== record.fingerprint && !delivered.includes(record.id)).slice(0, settings.maxItems);
    let digestSent = 0;
    if (slot && digestRecords.length) {
      try {
        const sent = await sendTelegramHtml(telegramRenderEvents(digestRecords, '📋 Nowe sprawy'), { silent: true, replyMarkup: panelButtons(), messageThreadId: telegramTopicId(settings, 'operations') }, env);
        for (const record of digestRecords) { record.digestFingerprint = record.fingerprint; record.digestSentAt = timestamp; }
        digestSent = digestRecords.length; state.lastDigestAt = timestamp; state.lastDigestSlot = slot; addHistory(state, { kind: 'digest', status: 'sent', category: 'operations', severity: 'info', title: `Raport zbiorczy: ${digestRecords.length} spraw`, messageId: sent?.message_id, source: options.source || 'schedule' });
      } catch (error) { addHistory(state, { kind: 'digest', status: 'error', title: 'Raport zbiorczy', reason: error?.message || error, source: options.source || 'schedule' }); }
    }
    const escalated = [];
    if (settings.escalationEnabled && !telegramQuietNow(settings)) for (const record of Object.values(state.events).filter((item) => item.severity === 'critical' && incidentOverdue(item)).slice(0, settings.maxItems)) {
      const elapsed = (Date.now() - Date.parse(record.lastEscalatedAt || 0)) / 60000;
      if (record.escalationLevel >= settings.maxEscalations || (record.lastEscalatedAt && elapsed < settings.escalationRepeatMinutes)) continue;
      try {
        const sent = await sendTelegramHtml(escalationCard(record), { replyMarkup: telegramIncidentKeyboard(record), messageThreadId: telegramTopicId(settings, record.category) }, env);
        record.escalationLevel = Number(record.escalationLevel || 0) + 1; record.lastEscalatedAt = timestamp; escalated.push(record.id);
        addHistory(state, { kind: 'escalation', status: 'sent', category: record.category, severity: record.severity, title: record.title, messageId: sent?.message_id, incidentId: record.id, source: options.source || 'schedule' });
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
    const url = `${String(origin || 'https://artwaytm.pl').replace(/\/$/, '')}/.netlify/functions/telegram-webhook`;
    const result = await telegramApi('setWebhook', { url, secret_token: secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true, max_connections: 20 }, env);
    const commands = [{ command: 'status', description: 'Najważniejsze sprawy i kondycja sklepu' }, { command: 'zamowienia', description: 'Nowe i aktywne zamówienia' }, { command: 'braki', description: 'Braki i zamówienia do producentów' }, { command: 'wiadomosci', description: 'Sprawy klientów do odpowiedzi' }, { command: 'wysylki', description: 'Wysyłki i numery InPost' }, { command: 'magazyn', description: 'Stan operacyjny magazynu' }, { command: 'settings', description: 'Ustawienia komunikacji i SLA' }, { command: 'pomoc', description: 'Przykłady zwykłych pytań' }];
    await telegramApi('setMyCommands', { commands }, env);
    await Promise.allSettled([
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
      const rows = [[summary.newOrders, 'nowe w sklepie'], [summary.activeAllegro, 'Allegro do obsługi'], [summary.shipmentsWithoutTracking, 'wysyłki bez numeru']].filter(([value]) => Number(value) > 0).map(([value, label]) => `<b>${Number(value)}</b> ${label}`);
      message = `<b>📦 Zamówienia</b>\n${rows.join('\n') || '✅ Brak nowych spraw.'}`; showButton = rows.length > 0;
    } else if (intent === 'shortages') { const rows = matching(/producent|magazyn|brak|dostawc/).slice(0, 8); message = telegramRenderEvents(rows, '🏭 Braki i producenci'); showButton = rows.length > 0; }
    else if (intent === 'communication') { showButton = Number(summary.communicationWaiting) > 0; message = `<b>💬 Klienci</b>\n${showButton ? `<b>${Number(summary.communicationWaiting)}</b> wymaga odpowiedzi.` : '✅ Nikt nie czeka na odpowiedź.'}`; }
    else if (intent === 'shipping') { showButton = Number(summary.shipmentsWithoutTracking) > 0; message = `<b>🚚 Wysyłki</b>\n${showButton ? `<b>${Number(summary.shipmentsWithoutTracking)}</b> bez numeru nadania.` : '✅ Wszystkie aktywne wysyłki mają numer.'}`; }
    else if (intent === 'warehouse') {
      const rows = [[summary.supplierUnavailable, 'braki u producentów'], [summary.supplierLow, 'niskie stany'], [summary.supplierNeedsDecision, 'decyzje']].filter(([value]) => Number(value) > 0).map(([value, label]) => `<b>${Number(value)}</b> ${label}`);
      message = `<b>🏬 Magazyn</b>\n${rows.join('\n') || '✅ Brak pilnych braków.'}`; showButton = rows.length > 0;
    } else if (intent === 'settings') message = '<b>⚙️ Telegram</b>\nUstawienia alertów, ciszy i SLA są w panelu.';
    else { message = '<b>🤖 Napisz zwykłym językiem</b>\nNp. „co jest pilne?”, „czy są nowe zamówienia?” albo „kto czeka na odpowiedź?”.'; showButton = false; }
    const state = await loadState(); state.health.lastWebhookAt = nowIso(); addHistory(state, { direction: 'in', kind: 'command', status: 'handled', category: intent, title: clean(meta.text || intentInput || intent, 240), source: clean(meta.user || 'telegram', 100), chatId: meta.chatId }); await saveState(state);
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

  return { connection, deliveryAction, dispatch, inbound, incidentAction, loadSettings, managedEvent, panelButtons, refreshDashboard, registerWebhook, saveSettings, sendManual, view };
}
