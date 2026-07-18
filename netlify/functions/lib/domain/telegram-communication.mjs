import crypto from 'node:crypto';
import { supplierProductIdentifier } from './supplier-order-email.mjs';

const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  mode: 'important',
  automaticCritical: true,
  customerMessages: true,
  supplierAlerts: false,
  operationalAlerts: true,
  digestEnabled: false,
  digestTimes: ['08:00', '16:00'],
  quietStart: '21:00',
  quietEnd: '07:00',
  criticalDuringQuiet: false,
  onlyChanges: true,
  repeatOpenHours: 24,
  cooldownMinutes: 720,
  maxItems: 8,
  incidentWorkflow: true,
  autoResolve: true,
  slaEnabled: true,
  criticalSlaMinutes: 60,
  warningSlaMinutes: 240,
  escalationEnabled: true,
  escalationRepeatMinutes: 120,
  maxEscalations: 2,
  topicRouting: false,
  topicCustomer: 0,
  topicOperations: 0,
  topicSupplier: 0,
  timezone: 'Europe/Warsaw',
});

const MODES = new Set(['important', 'digest', 'manual']);
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function text(value = '', limit = 500) {
  return String(value ?? '').replace(/\u0000/g, '').slice(0, limit);
}

function boolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function time(value, fallback) {
  const clean = text(value, 5).trim();
  return TIME_RE.test(clean) ? clean : fallback;
}

function polishForm(value, one, few, many) {
  const count = Math.abs(Number(value) || 0), last = count % 10, lastTwo = count % 100;
  if (count === 1) return one;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return few;
  return many;
}

export function telegramSettings(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const times = Array.isArray(source.digestTimes)
    ? [...new Set(source.digestTimes.map((value) => time(value, '')).filter(Boolean))].slice(0, 4)
    : DEFAULT_SETTINGS.digestTimes;
  return {
    enabled: boolean(source.enabled, DEFAULT_SETTINGS.enabled),
    mode: MODES.has(String(source.mode || '')) ? String(source.mode) : DEFAULT_SETTINGS.mode,
    automaticCritical: boolean(source.automaticCritical, DEFAULT_SETTINGS.automaticCritical),
    customerMessages: boolean(source.customerMessages, DEFAULT_SETTINGS.customerMessages),
    supplierAlerts: boolean(source.supplierAlerts, DEFAULT_SETTINGS.supplierAlerts),
    operationalAlerts: boolean(source.operationalAlerts, DEFAULT_SETTINGS.operationalAlerts),
    digestEnabled: boolean(source.digestEnabled, DEFAULT_SETTINGS.digestEnabled),
    digestTimes: times.length ? times.sort() : [...DEFAULT_SETTINGS.digestTimes],
    quietStart: time(source.quietStart, DEFAULT_SETTINGS.quietStart),
    quietEnd: time(source.quietEnd, DEFAULT_SETTINGS.quietEnd),
    criticalDuringQuiet: boolean(source.criticalDuringQuiet, DEFAULT_SETTINGS.criticalDuringQuiet),
    onlyChanges: boolean(source.onlyChanges, DEFAULT_SETTINGS.onlyChanges),
    repeatOpenHours: Math.max(1, Math.min(168, Number(source.repeatOpenHours) || DEFAULT_SETTINGS.repeatOpenHours)),
    cooldownMinutes: Math.max(15, Math.min(10080, Number(source.cooldownMinutes) || DEFAULT_SETTINGS.cooldownMinutes)),
    maxItems: Math.max(3, Math.min(20, Math.floor(Number(source.maxItems) || DEFAULT_SETTINGS.maxItems))),
    incidentWorkflow: boolean(source.incidentWorkflow, DEFAULT_SETTINGS.incidentWorkflow),
    autoResolve: boolean(source.autoResolve, DEFAULT_SETTINGS.autoResolve),
    slaEnabled: boolean(source.slaEnabled, DEFAULT_SETTINGS.slaEnabled),
    criticalSlaMinutes: Math.max(15, Math.min(1440, Math.floor(Number(source.criticalSlaMinutes) || DEFAULT_SETTINGS.criticalSlaMinutes))),
    warningSlaMinutes: Math.max(30, Math.min(10080, Math.floor(Number(source.warningSlaMinutes) || DEFAULT_SETTINGS.warningSlaMinutes))),
    escalationEnabled: boolean(source.escalationEnabled, DEFAULT_SETTINGS.escalationEnabled),
    escalationRepeatMinutes: Math.max(30, Math.min(10080, Math.floor(Number(source.escalationRepeatMinutes) || DEFAULT_SETTINGS.escalationRepeatMinutes))),
    maxEscalations: Math.max(1, Math.min(5, Math.floor(Number(source.maxEscalations) || DEFAULT_SETTINGS.maxEscalations))),
    topicRouting: boolean(source.topicRouting, DEFAULT_SETTINGS.topicRouting),
    topicCustomer: Math.max(0, Math.floor(Number(source.topicCustomer) || 0)),
    topicOperations: Math.max(0, Math.floor(Number(source.topicOperations) || 0)),
    topicSupplier: Math.max(0, Math.floor(Number(source.topicSupplier) || 0)),
    timezone: 'Europe/Warsaw',
  };
}

export function telegramConfig(env = process.env) {
  const bootstrapChats = new Set([
    env.TELEGRAM_NOTIFY_CHAT_ID,
    env.TELEGRAM_GROUP_ID,
    env.TELEGRAM_CHAT_ID,
  ].map((value) => String(value || '').trim()).filter(Boolean));
  const explicitChats = new Set(String(env.TELEGRAM_ALLOWED_CHAT_IDS || '').split(',').map((value) => String(value || '').trim()).filter(Boolean));
  const explicitUsers = new Set(String(env.TELEGRAM_ALLOWED_USER_IDS || '').split(',').map((value) => String(value || '').trim()).filter(Boolean));
  const ownerBootstrap = new Set([...bootstrapChats].filter((value) => /^\d+$/.test(value)));
  const approverBootstrap = new Set([String(env.TELEGRAM_CHAT_ID || '').trim()].filter((value) => /^[1-9]\d*$/.test(value)));
  const explicitApprovers = new Set(String(env.TELEGRAM_APPROVER_USER_IDS || '').split(',')
    .map((value) => String(value || '').trim()).filter((value) => /^[1-9]\d*$/.test(value)));
  const approverUserIds = new Set([...approverBootstrap, ...explicitApprovers]);
  return {
    token: text(env.TELEGRAM_BOT_TOKEN || '', 300).trim(),
    chatId: text(env.TELEGRAM_NOTIFY_CHAT_ID || env.TELEGRAM_GROUP_ID || env.TELEGRAM_CHAT_ID || '', 100).trim(),
    allowedChatIds: new Set([...bootstrapChats, ...explicitChats]),
    allowedUserIds: explicitUsers,
    approverUserIds,
    allowlistCounts: {
      chats: new Set([...bootstrapChats, ...explicitChats]).size,
      users: new Set([...ownerBootstrap, ...explicitUsers]).size,
      approvers: approverUserIds.size,
      ownerBootstrap: ownerBootstrap.size,
      chatBootstrap: bootstrapChats.size,
      explicitChats: explicitChats.size,
      explicitUsers: explicitUsers.size,
      explicitApprovers: explicitApprovers.size,
    },
  };
}

export function telegramActorAllowed(config = {}, actor = {}) {
  const chatId = String(actor.chatId || '').trim(), userId = String(actor.userId || '').trim();
  const chats = config.allowedChatIds instanceof Set ? config.allowedChatIds : new Set();
  const users = config.allowedUserIds instanceof Set ? config.allowedUserIds : new Set();
  if (!chatId || !userId) return false;
  const privateChat = actor.chatType === 'private' || chatId === userId;
  // Jawnie dozwolony użytkownik może rozmawiać z botem również prywatnie;
  // nie trzeba powielać tego samego ID na liście czatów. W prywatnym czacie
  // Telegram używa identycznego ID rozmowy i użytkownika.
  if (privateChat) return chatId === userId && (chats.has(chatId) || users.has(userId));
  // W grupie muszą być dozwolone jednocześnie grupa i konkretny nadawca.
  // Jawna lista TELEGRAM_ALLOWED_USER_IDS rozszerza, a nie zastępuje
  // prywatne ID właściciela i dodatkowych osób z allowedChatIds. Dzięki temu
  // dopisanie członka zespołu nie odbiera dostępu wcześniej dozwolonej osobie.
  return chats.has(chatId) && (users.has(userId) || chats.has(userId));
}

export function telegramApproverAllowed(config = {}, actor = {}) {
  const userId = String(actor.userId || '').trim();
  const approvers = config.approverUserIds instanceof Set ? config.approverUserIds : new Set();
  return /^[1-9]\d*$/.test(userId) && approvers.has(userId);
}

export function telegramHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function telegramSafeAgentHtml(value = '', limit = 3900) {
  const source = String(value ?? ''), maxLength = Math.max(64, Math.min(4000, Number(limit) || 3900));
  const allowed = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'code', 'pre']);
  const stack = [];
  let output = '', cursor = 0, truncated = false;
  const closingLength = () => stack.reduce((sum, tag) => sum + tag.length + 3, 0);
  const appendText = (textValue = '') => {
    for (const character of String(textValue)) {
      const escaped = character === '&' ? '&amp;' : character === '<' ? '&lt;' : character === '>' ? '&gt;' : character;
      if (output.length + escaped.length + closingLength() + 1 > maxLength) {
        truncated = true;
        return false;
      }
      output += escaped;
    }
    return true;
  };
  const tagPattern = /<[^>]*>/g;
  let match;
  while (!truncated && (match = tagPattern.exec(source))) {
    if (!appendText(source.slice(cursor, match.index))) break;
    const raw = match[0], parsed = raw.match(/^<(\/)?(b|strong|i|em|u|s|code|pre)>$/i);
    if (!parsed || !allowed.has(parsed[2].toLowerCase())) {
      if (!appendText(raw)) break;
    } else {
      const tag = parsed[2].toLowerCase();
      if (parsed[1]) {
        if (stack.at(-1) === tag) {
          output += `</${tag}>`;
          stack.pop();
        } else if (!appendText(raw)) break;
      } else {
        const opening = `<${tag}>`, closing = `</${tag}>`;
        if (output.length + opening.length + closingLength() + closing.length + 1 > maxLength) {
          truncated = true;
          break;
        }
        output += opening;
        stack.push(tag);
      }
    }
    cursor = tagPattern.lastIndex;
  }
  if (!truncated) appendText(source.slice(cursor));
  if (truncated && output.length + closingLength() + 1 <= maxLength) output += '…';
  while (stack.length) output += `</${stack.pop()}>`;
  return output;
}

export function telegramCell(value, width) {
  const clean = String(value ?? '—').replace(/\s+/g, ' ').trim() || '—';
  return clean.length > width ? `${clean.slice(0, Math.max(1, width - 1))}…` : clean.padEnd(width, ' ');
}

export function telegramSupplierTables(order = {}, onlySupplier = '') {
  const rows = (Array.isArray(order?.pozycje) ? order.pozycje : []).map((item) => ({
    code: text(supplierProductIdentifier(item).value || 'BRAK KODU', 80).trim(),
    name: text(item?.nazwa || 'Produkt', 180).trim(),
    quantity: Math.max(0, Number(item?.iloscPotrzebna ?? item?.ilosc) || 0),
    supplier: text(item?.dostawca || 'Bez przypisanego dostawcy', 120).trim() || 'Bez przypisanego dostawcy',
  })).filter((item) => item.quantity > 0 && (!onlySupplier || item.supplier === onlySupplier));
  const groups = new Map();
  for (const item of rows) {
    if (!groups.has(item.supplier)) groups.set(item.supplier, []);
    groups.get(item.supplier).push(item);
  }
  const messages = [];
  for (const [supplier, items] of groups.entries()) {
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    for (let offset = 0; offset < items.length; offset += 18) {
      const part = items.slice(offset, offset + 18);
      const partNumber = Math.floor(offset / 18) + 1, partCount = Math.ceil(items.length / 18);
      const table = [
        `${telegramCell('KOD', 15)} ${telegramCell('NAZWA', 30)} ${telegramCell('POTRZEBNA ILOŚĆ', 16)}`,
        `${'-'.repeat(15)} ${'-'.repeat(30)} ${'-'.repeat(16)}`,
        ...part.map((item) => `${telegramCell(item.code, 15)} ${telegramCell(item.name, 30)} ${telegramCell(item.quantity, 16)}`),
      ].join('\n');
      messages.push({
        supplier,
        text: [
          `<b>🏭 Zamówienie do producenta · ${telegramHtml(supplier)}</b>`,
          `<b>${telegramHtml(order?.numer || order?.id || 'Zlecenie producenta')}</b> · ${items.length} pozycji · ${telegramHtml(totalQuantity)} szt.${partCount > 1 ? ` · część ${partNumber}/${partCount}` : ''}`,
          '',
          'Cześć,',
          'przesyłamy dzisiejsze zamówienie:',
          '',
          `<pre>${telegramHtml(table)}</pre>`,
          partNumber === partCount ? 'Pozdrowienia dla całej ekipy!\n<b>Artway-TM</b>' : '<i>Dalsza część tabeli w następnej wiadomości.</i>',
          '',
          '<i>Podgląd wewnętrzny — ta wiadomość nie wysyła zamówienia producentowi.</i>',
        ].join('\n'),
      });
    }
  }
  return messages;
}

export async function telegramApi(method, payload = {}, env = process.env) {
  const config = telegramConfig(env);
  if (!config.token) {
    const error = new Error('Telegram nie jest skonfigurowany na serwerze. Brakuje TELEGRAM_BOT_TOKEN.');
    error.code = 'telegram_not_configured'; error.status = 503; throw error;
  }
  const response = await fetch(`https://api.telegram.org/bot${config.token}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    const error = new Error(text(data?.description || `Telegram HTTP ${response.status}`, 500));
    error.code = 'telegram_error'; error.status = response.status || 502; throw error;
  }
  return data.result;
}

export async function sendTelegramHtml(message, options = {}, env = process.env) {
  const config = telegramConfig(env);
  if (!config.chatId && !options.chatId) {
    const error = new Error('Telegram nie ma ustawionego czatu docelowego. Ustaw TELEGRAM_GROUP_ID lub TELEGRAM_CHAT_ID.');
    error.code = 'telegram_not_configured'; error.status = 503; throw error;
  }
  return telegramApi('sendMessage', {
    chat_id: options.chatId || config.chatId,
    text: String(message || '').slice(0, 4090),
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    disable_notification: options.silent === true,
    ...(options.replyTo ? { reply_parameters: { message_id: Number(options.replyTo) } } : {}),
    ...(Number(options.messageThreadId) > 0 ? { message_thread_id: Number(options.messageThreadId) } : {}),
    ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
  }, env);
}

export async function editTelegramHtml(message, options = {}, env = process.env) {
  if (!options.messageId) throw new Error('Brakuje identyfikatora wiadomości Telegram do aktualizacji.');
  const config = telegramConfig(env);
  if (!config.chatId && !options.chatId) throw new Error('Telegram nie ma ustawionego czatu docelowego.');
  return telegramApi('editMessageText', {
    chat_id: options.chatId || config.chatId,
    message_id: Number(options.messageId),
    text: String(message || '').slice(0, 4090),
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
  }, env);
}

export function telegramIncidentId(value = '') {
  return crypto.createHash('sha256').update(String(value || 'incident')).digest('hex').slice(0, 14);
}

export function telegramSlaMinutes(event = {}, settingsInput = {}) {
  const settings = telegramSettings(settingsInput);
  if (!settings.slaEnabled) return 0;
  return event.severity === 'critical' ? settings.criticalSlaMinutes : settings.warningSlaMinutes;
}

export function telegramTopicId(settingsInput = {}, category = 'operations') {
  const settings = telegramSettings(settingsInput);
  if (!settings.topicRouting) return 0;
  if (category === 'customer') return settings.topicCustomer;
  if (category === 'supplier') return settings.topicSupplier;
  return settings.topicOperations;
}

function warsawParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).reduce((result, item) => ({ ...result, [item.type]: item.value }), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

function timeMinutes(value) {
  const [hour, minute] = String(value).split(':').map(Number);
  return hour * 60 + minute;
}

export function telegramQuietNow(settingsInput = {}, now = new Date()) {
  const settings = telegramSettings(settingsInput), current = warsawParts(now).minutes;
  const start = timeMinutes(settings.quietStart), end = timeMinutes(settings.quietEnd);
  if (start === end) return false;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

function priorityCategory(priority = {}) {
  const area = String(priority.area || '').toLowerCase();
  if (/komunik|wiadomo|dyskus/.test(area)) return 'customer';
  if (/producent|dostawc/.test(area)) return 'supplier';
  return 'operations';
}

export function telegramPriorityEvents(center = {}) {
  return (Array.isArray(center.priorities) ? center.priorities : []).filter((item) => Number(item?.count) > 0 && ['critical', 'warning'].includes(String(item?.severity))).map((item) => {
    const key = text(item.actionId || item.area || item.title || 'event', 120).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify([key, item.severity, Number(item.count), item.title, item.action, item.doneWhen])).digest('hex').slice(0, 24);
    return {
      key, fingerprint, category: priorityCategory(item), severity: item.severity,
      count: Number(item.count), title: text(item.title, 240), description: text(item.action, 500),
      doneWhen: text(item.doneWhen, 500), href: text(item.href || '', 500),
    };
  });
}

function eventCategoryEnabled(event, settings) {
  if (event.category === 'customer') return settings.customerMessages;
  if (event.category === 'supplier') return settings.supplierAlerts;
  return settings.operationalAlerts;
}

export function telegramEventDecision(event = {}, settingsInput = {}, previous = null, now = new Date(), options = {}) {
  const settings = telegramSettings(settingsInput);
  if (options.manual) return { deliver: true, reason: 'manual' };
  if (!settings.enabled) return { deliver: false, reason: 'system wyłączony' };
  if (settings.mode === 'manual') return { deliver: false, reason: 'tryb tylko ręczny' };
  if (!eventCategoryEnabled(event, settings)) return { deliver: false, reason: 'kategoria wyłączona' };
  if (telegramQuietNow(settings, now) && !(event.severity === 'critical' && settings.criticalDuringQuiet)) return { deliver: false, reason: 'cisza nocna' };
  if (event.severity !== 'critical' || !settings.automaticCritical || settings.mode === 'digest') return { deliver: false, reason: 'zdarzenie trafi do raportu zbiorczego' };
  if (!previous && options.newEvent === true) return { deliver: true, reason: 'nowe pilne zdarzenie' };
  if (!previous) return { deliver: false, reason: 'pierwsza kontrola tworzy bezpieczny punkt odniesienia' };
  const sentAt = Date.parse(previous.sentAt || ''), ageMinutes = Number.isFinite(sentAt) ? (now.getTime() - sentAt) / 60000 : Infinity;
  if (previous.fingerprint === event.fingerprint) {
    if (settings.onlyChanges || ageMinutes < settings.repeatOpenHours * 60) return { deliver: false, reason: 'brak nowej zmiany' };
  }
  if (ageMinutes < settings.cooldownMinutes) return { deliver: false, reason: 'aktywny czas ochronny' };
  return { deliver: true, reason: 'nowe pilne zdarzenie' };
}

export function telegramDigestSlot(settingsInput = {}, state = {}, now = new Date()) {
  const settings = telegramSettings(settingsInput), local = warsawParts(now);
  if (!settings.enabled || !settings.digestEnabled || settings.mode === 'manual' || telegramQuietNow(settings, now)) return null;
  const due = settings.digestTimes.find((value) => {
    const distance = local.minutes - timeMinutes(value);
    return distance >= 0 && distance < 15;
  });
  if (!due) return null;
  const slot = `${local.date}T${due}`;
  return state.lastDigestSlot === slot ? null : slot;
}

export function telegramRenderEvents(events = [], heading = '🔔 Ważne sprawy Artway-TM') {
  const icons = { critical: '🔴', warning: '🟡', info: '🔵' };
  const compact = (value = '', limit = 160) => {
    const clean = text(value, limit * 2).replace(/\s+/g, ' ').trim();
    return clean.length > limit ? `${clean.slice(0, limit - 1).trimEnd()}…` : clean;
  };
  const rows = events.slice(0, 8).map((event) => {
    const count = Math.max(1, Number(event.count) || 1), description = compact(event.description || '');
    return `${icons[event.severity] || '•'} <b>${telegramHtml(compact(event.title || 'Sprawa', 100))}</b>${count > 1 ? ` · ${count}` : ''}${description ? `\n${telegramHtml(description)}` : ''}`;
  }).join('\n\n');
  return rows
    ? `<b>${telegramHtml(heading)}</b>\n${events.length} ${polishForm(events.length, 'nowa sprawa', 'nowe sprawy', 'nowych spraw')}\n\n${rows}`
    : `<b>${telegramHtml(heading)}</b>\n✅ Brak nowych spraw.`;
}

export function telegramWebhookSecret(env = process.env) {
  const configured = text(env.TELEGRAM_WEBHOOK_SECRET || '', 256).trim();
  if (configured) return configured.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 256);
  const config = telegramConfig(env);
  if (!config.token) return '';
  return crypto.createHash('sha256').update(`${config.token}|${env.ARTWAY_ADMIN_TOKEN || 'artway'}`).digest('hex');
}

export function telegramNaturalIntent(input = '') {
  const raw = text(input, 1000).trim(), normalized = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9/]+/g, ' ').trim();
  const first = normalized.split(/\s+/)[0]?.split('@')[0] || '';
  if (['/start', '/help', '/pomoc'].includes(first) || /co potraf|pomoc|instrukcj/.test(normalized)) return 'help';
  if (['/status', '/centrum', '/dzis'].includes(first) || /status|pilne|co mam zrobic|plan dnia|centrum/.test(normalized)) return 'status';
  if (first === '/zamowienia' || /zamowien|zlecen/.test(normalized)) return 'orders';
  if (first === '/braki' || /brak|zamowic|zatowar/.test(normalized)) return 'shortages';
  if (['/wiadomosci', '/dyskusje'].includes(first) || /wiadom|dyskus|odpis|odpowiedz/.test(normalized)) return 'communication';
  if (['/wysylki', '/inpost'].includes(first) || /wysyl|inpost|etykiet|nadani/.test(normalized)) return 'shipping';
  if (first === '/magazyn' || /magazyn|stan produkt/.test(normalized)) return 'warehouse';
  if (first === '/settings' || /ustawien|reguly telegram|polityk/.test(normalized)) return 'settings';
  return 'unknown';
}

export { DEFAULT_SETTINGS as TELEGRAM_DEFAULT_SETTINGS };
