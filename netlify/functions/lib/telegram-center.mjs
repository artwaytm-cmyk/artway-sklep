import crypto from 'node:crypto';
import {
  sendTelegramHtml,
  telegramApi,
  telegramConfig,
  telegramDigestSlot,
  telegramEventDecision,
  telegramHtml,
  telegramNaturalIntent,
  telegramPriorityEvents,
  telegramQuietNow,
  telegramRenderEvents,
  telegramSettings,
  telegramWebhookSecret,
} from './domain/telegram-communication.mjs';

const SETTINGS_KEY = 'telegram_communication_settings';
const STATE_KEY = 'telegram_communication_state';

function clean(value = '', limit = 500) { return String(value ?? '').replace(/\u0000/g, '').slice(0, limit); }
function nowIso() { return new Date().toISOString(); }
function emptyState() { return { initializedAt: '', updatedAt: '', lastDispatchAt: '', lastDigestAt: '', lastDigestSlot: '', events: {}, history: [] }; }

function hashEvent(event = {}) {
  return crypto.createHash('sha256').update(JSON.stringify([event.key, event.category, event.severity, event.count, event.title, event.description])).digest('hex').slice(0, 24);
}

function auditEntry(input = {}) {
  return {
    id: crypto.randomUUID(), at: nowIso(), direction: input.direction || 'out', kind: clean(input.kind || 'event', 60),
    status: clean(input.status || 'sent', 40), category: clean(input.category || 'operations', 40), severity: clean(input.severity || 'info', 30),
    title: clean(input.title || 'Telegram', 240), reason: clean(input.reason || '', 300), messageId: input.messageId ?? null,
    source: clean(input.source || 'system', 80), chatId: clean(input.chatId || '', 100),
  };
}

export function telegramAgentReport(center = {}) {
  const summary = center.summary || {}, priorities = (Array.isArray(center.priorities) ? center.priorities : []).slice(0, 8);
  const icons = { critical: '🔴', warning: '🟡', info: '🔵' };
  const rows = priorities.length ? priorities.map((item, index) => `${index + 1}. ${icons[item.severity] || '•'} <b>${telegramHtml(item.title)}</b> — ${item.count}\n   ${item.execution === 'approval' ? '🔐 decyzja administratora' : item.execution === 'draft' ? '📝 agent przygotuje szkic' : '⚙️ agent może sprawdzić'} • termin ${item.deadlineMinutes || 240} min\n   ${telegramHtml(item.action || '')}\n   Gotowe, gdy: ${telegramHtml(item.doneWhen || 'temat zostanie zweryfikowany')}`).join('\n') : '✅ Brak aktywnych tematów wymagających reakcji.';
  return `<b>🤖 Centrum operacyjne Artway-TM — ${center.score ?? 0}%</b>\n${telegramHtml(new Date(center.generatedAt || Date.now()).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' }))}\n\n<b>Sprzedaż i obsługa</b>\nSklep: ${summary.newOrders || 0} nowych / ${summary.activeOrders || 0} aktywnych\nAllegro: ${summary.activeAllegro || 0} aktywnych • ${summary.communicationWaiting || 0} spraw do odpowiedzi\nWysyłki bez numeru: ${summary.shipmentsWithoutTracking || 0}\nFaktury: ${summary.companyOrdersWithoutInvoice || 0} firmowych bez dokumentu\nProducent: ${summary.supplierUnavailable || 0} braków • ${summary.supplierLow || 0} niskich stanów • ${summary.supplierNeedsDecision || 0} decyzji\n\n<b>Najważniejsze działania</b>\n${rows}\n\n<i>Agent nie wysyła odpowiedzi klientom ani zamówień producentom bez zatwierdzenia administratora.</i>`;
}

export function createTelegramCenter({ read, write, env = process.env } = {}) {
  if (typeof read !== 'function' || typeof write !== 'function') throw new Error('Telegram Center wymaga repozytorium read/write');

  async function loadSettings() { return telegramSettings(await read(SETTINGS_KEY, {})); }
  async function loadState() {
    const raw = await read(STATE_KEY, emptyState());
    return { ...emptyState(), ...(raw && typeof raw === 'object' ? raw : {}), events: raw?.events && typeof raw.events === 'object' ? raw.events : {}, history: Array.isArray(raw?.history) ? raw.history : [] };
  }
  async function saveState(state) {
    const next = { ...emptyState(), ...state, events: state.events || {}, history: (state.history || []).slice(0, 300), updatedAt: nowIso() };
    await write(STATE_KEY, next); return next;
  }
  function addHistory(state, entry) { state.history = [auditEntry(entry), ...(state.history || [])].slice(0, 300); }

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

  async function view(center = {}, live = false) {
    const [settings, state, status] = await Promise.all([loadSettings(), loadState(), connection(live)]);
    const events = telegramPriorityEvents(center), today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date());
    const sentToday = state.history.filter((item) => item.status === 'sent' && String(item.at || '').startsWith(today)).length;
    return {
      settings, status, events, quietNow: telegramQuietNow(settings),
      stats: { active: events.length, critical: events.filter((item) => item.severity === 'critical').length, sentToday, history: state.history.length },
      state: { initializedAt: state.initializedAt, updatedAt: state.updatedAt, lastDispatchAt: state.lastDispatchAt, lastDigestAt: state.lastDigestAt, lastDigestSlot: state.lastDigestSlot },
      history: state.history.slice(0, 100),
    };
  }

  async function saveSettings(raw = {}, operator = 'administrator') {
    const settings = telegramSettings(raw);
    await write(SETTINGS_KEY, { ...settings, updatedAt: nowIso(), updatedBy: clean(operator, 160) });
    const state = await loadState();
    addHistory(state, { kind: 'settings', status: 'saved', title: 'Zmieniono ustawienia komunikacji', reason: `tryb ${settings.mode}`, source: operator });
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

  async function managedEvent(eventInput = {}, message = '', options = {}) {
    const [settings, state] = await Promise.all([loadSettings(), loadState()]);
    const event = {
      key: clean(eventInput.key || eventInput.title || 'event', 140), category: eventInput.category || 'operations',
      severity: eventInput.severity || 'warning', count: Math.max(1, Number(eventInput.count) || 1),
      title: clean(eventInput.title || 'Nowe zdarzenie', 240), description: clean(eventInput.description || '', 500),
    };
    event.fingerprint = clean(eventInput.fingerprint || hashEvent(event), 80);
    const previous = state.events[event.key] || null;
    const decision = telegramEventDecision(event, settings, previous, new Date(), { newEvent: !previous });
    state.events[event.key] = { ...(previous || {}), fingerprint: event.fingerprint, lastSeenAt: nowIso(), title: event.title, category: event.category, severity: event.severity };
    if (!decision.deliver) { await saveState(state); return { sent: false, skipped: true, reason: decision.reason }; }
    try {
      const sent = await sendTelegramHtml(message, { silent: options.silent === true, replyMarkup: options.replyMarkup }, env);
      state.events[event.key] = { ...state.events[event.key], sentAt: nowIso(), messageId: sent?.message_id || null };
      addHistory(state, { kind: 'event', status: 'sent', category: event.category, severity: event.severity, title: event.title, reason: decision.reason, messageId: sent?.message_id, source: options.source || 'automation' });
      await saveState(state); return { sent: true, messageId: sent?.message_id || null };
    } catch (error) {
      addHistory(state, { kind: 'event', status: 'error', category: event.category, severity: event.severity, title: event.title, reason: error?.message || error, source: options.source || 'automation' });
      await saveState(state); throw error;
    }
  }

  async function dispatch(center = {}, options = {}) {
    const [settings, state] = await Promise.all([loadSettings(), loadState()]);
    const events = telegramPriorityEvents(center), timestamp = nowIso(), previousEvents = { ...(state.events || {}) };
    state.lastDispatchAt = timestamp;
    if (!state.initializedAt && !options.force) {
      state.initializedAt = timestamp;
      for (const event of events) state.events[event.key] = { fingerprint: event.fingerprint, digestFingerprint: event.fingerprint, lastSeenAt: timestamp, title: event.title, category: event.category, severity: event.severity };
      addHistory(state, { kind: 'baseline', status: 'saved', title: 'Utworzono punkt odniesienia bez wysyłania starych alertów', reason: `${events.length} aktywnych spraw`, source: options.source || 'schedule' });
      await saveState(state); return { sent: false, baseline: true, events: events.length, reason: 'Pierwsze uruchomienie nie wysyła zaległych komunikatów.' };
    }
    const urgent = [];
    for (const event of events) {
      const previous = previousEvents[event.key] || null;
      const decision = telegramEventDecision(event, settings, previous, new Date(), { newEvent: !previous });
      state.events[event.key] = { ...(previous || {}), fingerprint: event.fingerprint, lastSeenAt: timestamp, title: event.title, category: event.category, severity: event.severity, lastDecision: decision.reason };
      if (decision.deliver) urgent.push(event);
    }
    const delivered = [];
    if (urgent.length) {
      const selected = urgent.slice(0, settings.maxItems), sent = await sendTelegramHtml(telegramRenderEvents(selected, '🚨 Nowe pilne sprawy Artway-TM'), { replyMarkup: panelButtons() }, env);
      for (const event of selected) state.events[event.key] = { ...state.events[event.key], sentAt: timestamp, messageId: sent?.message_id || null, digestFingerprint: event.fingerprint };
      delivered.push(...selected.map((event) => event.key));
      addHistory(state, { kind: 'urgent', status: 'sent', category: 'operations', severity: 'critical', title: `Nowe pilne sprawy: ${selected.length}`, messageId: sent?.message_id, source: options.source || 'schedule' });
    }
    const slot = options.forceDigest ? `manual-${Date.now()}` : telegramDigestSlot(settings, state);
    const digestEvents = events.filter((event) => state.events[event.key]?.digestFingerprint !== event.fingerprint && !delivered.includes(event.key)).slice(0, settings.maxItems);
    if (slot && digestEvents.length) {
      const sent = await sendTelegramHtml(telegramRenderEvents(digestEvents, '📋 Zbiorcze podsumowanie Artway-TM'), { silent: true, replyMarkup: panelButtons() }, env);
      for (const event of digestEvents) state.events[event.key] = { ...state.events[event.key], digestFingerprint: event.fingerprint, digestSentAt: timestamp, messageId: sent?.message_id || null };
      state.lastDigestAt = timestamp; state.lastDigestSlot = slot;
      delivered.push(...digestEvents.map((event) => event.key));
      addHistory(state, { kind: 'digest', status: 'sent', category: 'operations', severity: 'info', title: `Raport zbiorczy: ${digestEvents.length} spraw`, messageId: sent?.message_id, source: options.source || 'schedule' });
    }
    await saveState(state);
    return { sent: delivered.length > 0, delivered, urgent: urgent.length, digest: digestEvents.length, events: events.length, quietNow: telegramQuietNow(settings), reason: delivered.length ? 'wysłano tylko nowe istotne informacje' : 'brak nowych informacji spełniających politykę wysyłki' };
  }

  async function registerWebhook(origin = 'https://artwaytm.pl') {
    const secret = telegramWebhookSecret(env);
    if (!secret) throw new Error('Nie można zabezpieczyć webhooka bez tokenu Telegram.');
    const url = `${String(origin || 'https://artwaytm.pl').replace(/\/$/, '')}/.netlify/functions/telegram-webhook`;
    const result = await telegramApi('setWebhook', { url, secret_token: secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true }, env);
    await telegramApi('setMyCommands', { commands: [{ command: 'status', description: 'Najważniejsze sprawy i kondycja sklepu' }, { command: 'zamowienia', description: 'Nowe i aktywne zamówienia' }, { command: 'braki', description: 'Braki i zamówienia do producentów' }, { command: 'wiadomosci', description: 'Sprawy klientów do odpowiedzi' }, { command: 'wysylki', description: 'Wysyłki i numery InPost' }, { command: 'magazyn', description: 'Stan operacyjny magazynu' }, { command: 'pomoc', description: 'Przykłady zwykłych pytań' }] }, env);
    const state = await loadState(); addHistory(state, { kind: 'webhook', status: 'saved', title: 'Podłączono odbieranie wiadomości przez stronę', source: 'admin-panel' }); await saveState(state);
    return { registered: result === true, url };
  }

  async function inbound(intentInput = '', center = {}, meta = {}) {
    const intent = ['help', 'status', 'orders', 'shortages', 'communication', 'shipping', 'warehouse'].includes(intentInput) ? intentInput : telegramNaturalIntent(intentInput);
    const summary = center.summary || {}, events = telegramPriorityEvents(center), matching = (pattern) => events.filter((event) => pattern.test(`${event.key} ${event.category} ${event.title}`));
    let message;
    if (intent === 'status') message = telegramRenderEvents(events.slice(0, 8), `🤖 Centrum operacyjne — ${center.score ?? 0}%`);
    else if (intent === 'orders') message = `<b>📦 Zamówienia</b>\nSklep: ${summary.newOrders || 0} nowych / ${summary.activeOrders || 0} aktywnych\nAllegro: ${summary.activeAllegro || 0} do obsługi\nWysyłki bez numeru: ${summary.shipmentsWithoutTracking || 0}`;
    else if (intent === 'shortages') message = telegramRenderEvents(matching(/producent|magazyn|brak|dostawc/).slice(0, 8), '🏭 Braki i producenci');
    else if (intent === 'communication') message = `<b>💬 Komunikacja z klientami</b>\nDo odpowiedzi: ${summary.communicationWaiting || 0}\n\nOdpowiedź przygotuj i zatwierdź w panelu. Bot nie wysyła odpowiedzi klientowi samodzielnie.`;
    else if (intent === 'shipping') message = `<b>🚚 Wysyłki InPost</b>\nAktywne bez numeru nadania: ${summary.shipmentsWithoutTracking || 0}\n\nEtykiety i zmianę statusu zatwierdzasz w Centrum wysyłek.`;
    else if (intent === 'warehouse') message = `<b>🏬 Magazyn</b>\nBraki producentów: ${summary.supplierUnavailable || 0}\nNiskie stany u producentów: ${summary.supplierLow || 0}\nDecyzje dostępności: ${summary.supplierNeedsDecision || 0}`;
    else message = `<b>🤖 Agent Artway-TM</b>\nMożesz pisać zwykłym językiem, np.:\n• co jest teraz pilne?\n• czy są nowe zamówienia?\n• czego brakuje do zamówień?\n• czy ktoś czeka na odpowiedź?\n• co z wysyłkami InPost?\n• pokaż stan magazynu\n\nDziałania zewnętrzne wymagają zatwierdzenia w panelu.`;
    const state = await loadState(); addHistory(state, { direction: 'in', kind: 'command', status: 'handled', category: intent, title: clean(meta.text || intentInput || intent, 240), source: clean(meta.user || 'telegram', 100), chatId: meta.chatId }); await saveState(state);
    return { intent, message, replyMarkup: panelButtons() };
  }

  function panelButtons() {
    return { inline_keyboard: [[{ text: '🤖 Agent', url: 'https://artwaytm.pl/#/admin/agent-ai' }, { text: '📦 Zamówienia', url: 'https://artwaytm.pl/#/admin/zamowienia' }], [{ text: '🏬 Magazyn', url: 'https://artwaytm.pl/#/admin/magazyn/stany' }, { text: '🚚 Wysyłki', url: 'https://artwaytm.pl/#/admin/wysylki' }]] };
  }

  return { connection, dispatch, inbound, loadSettings, managedEvent, panelButtons, registerWebhook, saveSettings, sendManual, view };
}
