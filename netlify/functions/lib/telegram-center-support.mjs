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
import { applyTelegramAccountAccess } from './domain/telegram-account-access.mjs';

const SETTINGS_KEY = 'telegram_communication_settings';
const STATE_KEY = 'telegram_communication_state';
const ARCHIVE_V1_KEY = 'telegram_communication_archive_v1';
const OPEN_STATES = new Set(['open', 'acknowledged', 'snoozed']);
const TELEGRAM_PANEL_ORIGIN = 'https://artwaytm.pl/';

function clean(value = '', limit = 500) { return String(value ?? '').replace(/\u0000/g, '').slice(0, limit); }
function nowIso() { return new Date().toISOString(); }
function plusMinutes(iso, minutes) { return new Date(Date.parse(iso) + Math.max(0, Number(minutes) || 0) * 60000).toISOString(); }

function conversationText(value = '', limit = 2400) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  const plain = String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|blockquote|pre)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (_match, entity) => {
      if (entity[0] === '#') {
        const radix = entity[1]?.toLowerCase() === 'x' ? 16 : 10;
        const number = Number.parseInt(entity.replace(/^#x?/i, ''), radix);
        return Number.isFinite(number) ? String.fromCodePoint(number) : '';
      }
      return entities[entity.toLowerCase()] || '';
    })
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return plain.length > limit ? `${plain.slice(0, Math.max(1, limit - 1)).trimEnd()}…` : plain;
}

export function telegramPanelUrl(value = '', fallback = 'https://artwaytm.pl/#/admin/agent-ai/telegram') {
  try {
    const url = new URL(clean(value, 500).trim() || fallback, TELEGRAM_PANEL_ORIGIN);
    if (url.protocol !== 'https:' || !['artwaytm.pl', 'www.artwaytm.pl'].includes(url.hostname)) return fallback;
    url.hostname = 'artwaytm.pl';
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return fallback;
  }
}
function emptyState() {
  return {
    schemaVersion: 2,
    initializedAt: '', updatedAt: '', lastDispatchAt: '', lastDigestAt: '', lastDigestSlot: '', events: {}, history: [], outbox: [],
    dashboard: { messageId: null, chatId: '', updatedAt: '', createdAt: '' },
    health: {
      lastCycleAt: '', lastSuccessAt: '', lastErrorAt: '', lastError: '', consecutiveErrors: 0,
      lastWebhookAt: '', lastInboundKind: '', lastInboundStatus: '', inboundAccepted: 0, inboundDeferred: 0,
      inboundRejected: 0, lastRejectedAt: '', lastRejectedKind: '', lastRejectedRef: '',
    },
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
    preview: conversationText(input.preview || input.message || '', 2400),
    fromLabel: clean(input.fromLabel || (input.direction === 'in' ? 'Zespół Telegram' : 'Agent Artway-TM'), 160),
    toLabel: clean(input.toLabel || (input.direction === 'in' ? 'Agent Artway-TM' : 'Główna grupa Telegram'), 160),
    threadId: Math.max(0, Number(input.threadId) || 0) || null,
    conversationKey: clean(input.conversationKey || 'telegram-main', 180),
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
  const id = record.id || telegramIncidentId(record.key), open = { text: 'Otwórz', url: telegramPanelUrl(record.href) };
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

export { SETTINGS_KEY, STATE_KEY, ARCHIVE_V1_KEY, OPEN_STATES, TELEGRAM_PANEL_ORIGIN, clean, nowIso, plusMinutes, conversationText, emptyState, compactEvents, hashEvent, auditEntry, incidentStatus, incidentOverdue, compactLine, polishForm, warsawDayKey, shortMoment, cleanCustomMessage, incidentFromEvent, incidentLabel, escalationCard };
