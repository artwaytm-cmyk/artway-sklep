import test from 'node:test';
import assert from 'node:assert/strict';
import {
  telegramDigestSlot,
  telegramEventDecision,
  telegramNaturalIntent,
  telegramPriorityEvents,
  telegramQuietNow,
  telegramSettings,
  telegramIncidentId,
  telegramRenderEvents,
  telegramSupplierTables,
  telegramTopicId,
} from '../netlify/functions/lib/domain/telegram-communication.mjs';
import {
  createTelegramCenter,
  telegramAgentReport,
  telegramDashboardCard,
  telegramIncidentCard,
  telegramIncidentKeyboard,
} from '../netlify/functions/lib/telegram-center.mjs';

test('Telegram domyślnie wysyła tylko ważne zmiany i chroni ciszę nocną', () => {
  const settings = telegramSettings({});
  assert.equal(settings.mode, 'important');
  assert.equal(settings.digestEnabled, false);
  assert.equal(settings.onlyChanges, true);
  assert.equal(settings.supplierAlerts, false);
  assert.equal(telegramQuietNow(settings, new Date('2026-07-15T21:30:00Z')), true);
});

test('ten sam krytyczny problem nie jest wysyłany ponownie', () => {
  const event = { key: 'orders', category: 'operations', severity: 'critical', fingerprint: 'same' };
  const previous = { fingerprint: 'same', sentAt: '2026-07-15T08:00:00.000Z' };
  const decision = telegramEventDecision(event, { quietStart: '23:59', quietEnd: '00:01', onlyChanges: true }, previous, new Date('2026-07-15T12:00:00.000Z'));
  assert.equal(decision.deliver, false);
  assert.equal(decision.reason, 'brak nowej zmiany');
});

test('pierwsza kontrola tworzy punkt odniesienia zamiast zalewać starymi alertami', () => {
  const event = { key: 'messages', category: 'customer', severity: 'critical', fingerprint: 'first' };
  const decision = telegramEventDecision(event, { quietStart: '23:59', quietEnd: '00:01' }, null, new Date('2026-07-15T12:00:00.000Z'));
  assert.equal(decision.deliver, false);
  assert.match(decision.reason, /punkt odniesienia/);
});

test('raport zbiorczy uruchamia się tylko raz w danym oknie', () => {
  const now = new Date('2026-07-15T06:05:00.000Z'); // 08:05 w Warszawie
  const slot = telegramDigestSlot({ digestEnabled: true, digestTimes: ['08:00'], quietStart: '21:00', quietEnd: '07:00' }, {}, now);
  assert.equal(slot, '2026-07-15T08:00');
  assert.equal(telegramDigestSlot({ digestEnabled: true, digestTimes: ['08:00'] }, { lastDigestSlot: slot }, now), null);
});

test('nowoczesna karta Telegram pokazuje decyzję bez technicznego szumu', () => {
  const card = telegramIncidentCard({
    id: 'abcdef12345678', key: 'message', severity: 'critical', status: 'open', title: 'Nowa wiadomość Allegro', count: 1,
    facts: ['Klient: tom90mio', 'Zam. 123456'], description: 'Czy paczka została już wysłana?', dueAt: '2099-07-15T12:40:00.000Z',
    href: 'https://artwaytm.pl/#/admin/allegro/wiadomosci',
  });
  assert.match(card, /Nowa wiadomość Allegro/);
  assert.match(card, /Klient: tom90mio · Zam\. 123456/);
  assert.doesNotMatch(card, /abcdef12345678|wyłącznie wewnętrzny|https:\/\/|<code>/);
  const buttons = telegramIncidentKeyboard({ id: 'abcdef12345678', status: 'open', href: 'https://artwaytm.pl/#/admin/allegro/wiadomosci' }).inline_keyboard.flat();
  assert.equal(buttons.length, 2);
  assert.deepEqual(buttons.map((item) => item.text), ['👤 Przyjmuję', 'Otwórz']);
});

test('digest i raport ręczny pomijają puste metryki oraz długie instrukcje', () => {
  const digest = telegramRenderEvents([{ severity: 'critical', title: 'Klient czeka', count: 2, description: 'Odpowiedz po sprawdzeniu zamówienia', doneWhen: 'odpowiedź wysłana' }], '📋 Nowe sprawy');
  assert.match(digest, /2 nowe sprawy|1 nowa sprawa/);
  assert.doesNotMatch(digest, /Gotowe, gdy|Działania zewnętrzne|\d{1,2}\.\d{1,2}\.\d{4}/);
  const report = telegramAgentReport({ score: 96, summary: { newOrders: 0, communicationWaiting: 2, shipmentsWithoutTracking: 0 }, priorities: [{ severity: 'critical', title: 'Odpowiedzi', count: 2, action: 'Sprawdź rozmowy', doneWhen: 'wysłane' }] });
  assert.match(report, /2<\/b> .*odpowiedzi dla klientów/);
  assert.doesNotMatch(report, /nowe zamówienia sklepu|wysyłki bez numeru|Gotowe, gdy|termin/);
});

test('stały pulpit Telegram mieści stan w jednej krótkiej karcie', () => {
  const text = telegramDashboardCard({ score: 93 }, [{ status: 'open', dueAt: '2099-07-15T12:00:00.000Z' }, { status: 'acknowledged', dueAt: '2099-07-15T12:00:00.000Z' }]);
  assert.match(text, /1 nowa · 1 w obsłudze/);
  assert.doesNotMatch(text, /Odłożone: 0|Po SLA: 0|Ta karta jest aktualizowana/);
});

test('kolejne wiadomości tej samej rozmowy tworzą jedną aktywną kartę', async () => {
  const data = new Map(), read = async (key, fallback) => structuredClone(data.has(key) ? data.get(key) : fallback), write = async (key, value) => data.set(key, structuredClone(value));
  const center = createTelegramCenter({ read, write, env: {} });
  await center.saveSettings({ enabled: false }, 'test');
  await center.managedEvent({ key: 'thread:77:old-message', fingerprint: 'old', category: 'customer', severity: 'critical', title: 'Stara karta' });
  await center.managedEvent({ key: 'allegro:thread:77', legacyPrefix: 'thread:77:', fingerprint: 'new', category: 'customer', severity: 'critical', title: 'Nowa wiadomość' });
  const view = await center.view({ priorities: [] }, false), active = view.incidents.filter((item) => item.status !== 'resolved');
  assert.equal(active.length, 1);
  assert.equal(active[0].key, 'allegro:thread:77');
});

test('nowa wiadomość w aktywnej rozmowie daje świeże powiadomienie bez duplikowania sprawy', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch, calls = [], data = new Map();
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), body: JSON.parse(options.body || '{}') });
    return new Response(JSON.stringify({ ok: true, result: { message_id: calls.length, chat: { id: -100 } } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const read = async (key, fallback) => structuredClone(data.has(key) ? data.get(key) : fallback), write = async (key, value) => data.set(key, structuredClone(value));
    const center = createTelegramCenter({ read, write, env: { TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_GROUP_ID: '-100' } });
    await center.saveSettings({ enabled: true, customerMessages: true, quietStart: '00:00', quietEnd: '00:00' }, 'test');
    await center.managedEvent({ key: 'allegro:thread:88', fingerprint: 'message-1', category: 'customer', severity: 'critical', title: 'Nowa wiadomość' });
    await center.managedEvent({ key: 'allegro:thread:88', fingerprint: 'message-2', category: 'customer', severity: 'critical', title: 'Nowa wiadomość' });
    assert.equal(calls.filter((item) => item.url.endsWith('/sendMessage')).length, 2);
    assert.equal(calls.filter((item) => item.url.endsWith('/editMessageText')).length, 1);
    const view = await center.view({ priorities: [] }, false);
    assert.equal(view.incidents.filter((item) => item.status !== 'resolved').length, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('alert pominięty przy wyłączonej komunikacji pozostaje do ponownej oceny', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch, data = new Map();
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, result: { message_id: 9, chat: { id: -100 } } }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const read = async (key, fallback) => structuredClone(data.has(key) ? data.get(key) : fallback), write = async (key, value) => data.set(key, structuredClone(value));
    const center = createTelegramCenter({ read, write, env: { TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_GROUP_ID: '-100' } });
    await center.saveSettings({ enabled: false, customerMessages: true, quietStart: '00:00', quietEnd: '00:00' }, 'test');
    const skipped = await center.managedEvent({ key: 'allegro:thread:99', fingerprint: 'message-1', category: 'customer', severity: 'critical', title: 'Nowa wiadomość' });
    assert.equal(skipped.skipped, true);
    assert.equal((await center.view({ priorities: [] }, false)).incidents[0].pendingNotification, true);
    await center.saveSettings({ enabled: true, customerMessages: true, quietStart: '00:00', quietEnd: '00:00' }, 'test');
    const sent = await center.managedEvent({ key: 'allegro:thread:99', fingerprint: 'message-1', category: 'customer', severity: 'critical', title: 'Nowa wiadomość' });
    assert.equal(sent.sent, true);
  } finally { globalThis.fetch = originalFetch; }
});

test('bot rozumie zwykłe pytania bez komend', () => {
  assert.equal(telegramNaturalIntent('Czy mamy jakieś nowe zamówienia?'), 'orders');
  assert.equal(telegramNaturalIntent('Kto czeka na odpowiedź?'), 'communication');
  assert.equal(telegramNaturalIntent('Pokaż co jest teraz pilne'), 'status');
});

test('kontrola połączenia zwraca stan Privacy Mode bota', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch, data = new Map();
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/getMe')) return new Response(JSON.stringify({ ok: true, result: { id: 7, username: 'magazyn_artway_bot', first_name: 'Magazyn Artway', can_read_all_group_messages: false } }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (String(url).endsWith('/getWebhookInfo')) return new Response(JSON.stringify({ ok: true, result: { url: 'https://artwaytm.pl/.netlify/functions/telegram-webhook', pending_update_count: 0 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    throw new Error(`Nieoczekiwane wywołanie: ${url}`);
  };
  try {
    const read = async (key, fallback) => structuredClone(data.has(key) ? data.get(key) : fallback), write = async (key, value) => data.set(key, structuredClone(value));
    const center = createTelegramCenter({ read, write, env: { TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_GROUP_ID: '-100' } });
    const view = await center.view({ priorities: [] }, true);
    assert.equal(view.status.bot.username, 'magazyn_artway_bot');
    assert.equal(view.status.bot.can_read_all_group_messages, false);
    assert.deepEqual(view.status.allowlist, { chats: 1, users: 0, approvers: 0, ownerBootstrap: 0, chatBootstrap: 1, explicitChats: 0, explicitUsers: 0, explicitApprovers: 0 });
  } finally { globalThis.fetch = originalFetch; }
});

test('audyt webhooka zapisuje wyłącznie bezpieczne metadane i licznik odrzuceń', async () => {
  const data = new Map();
  const read = async (key, fallback) => structuredClone(data.has(key) ? data.get(key) : fallback);
  const write = async (key, value) => data.set(key, structuredClone(value));
  const center = createTelegramCenter({ read, write, env: { TELEGRAM_GROUP_ID: '-100', TELEGRAM_ALLOWED_USER_IDS: '7,8' } });
  await center.recordInboundAudit({ accepted: true, deferred: true, kind: 'voice', text: 'tajna treść', userId: '7' });
  await center.recordInboundAudit({ accepted: false, deferred: false, kind: 'command', actorHash: 'abcdef1234567890abcdef12', text: 'inna tajna treść', userId: '999' });
  const view = await center.view({ priorities: [] }, false);
  assert.equal(view.state.health.inboundAccepted, 1);
  assert.equal(view.state.health.inboundDeferred, 1);
  assert.equal(view.state.health.inboundRejected, 1);
  assert.equal(view.state.health.lastRejectedKind, 'command');
  assert.equal(view.state.health.lastRejectedRef, 'abcdef1234567890abcdef12');
  assert.ok(view.state.health.lastRejectedAt);
  assert.deepEqual(view.status.allowlist, { chats: 1, users: 2, approvers: 0, ownerBootstrap: 0, chatBootstrap: 1, explicitChats: 0, explicitUsers: 2, explicitApprovers: 0 });
  assert.equal(JSON.stringify(view).includes('tajna treść'), false);
  assert.equal(JSON.stringify(view).includes('999'), false);
});

test('kolejka Telegram obejmuje tylko aktywne ostrzeżenia', () => {
  const events = telegramPriorityEvents({ priorities: [
    { actionId: 'one', severity: 'critical', count: 2, title: 'Nowe zamówienia', action: 'Sprawdź' },
    { actionId: 'two', severity: 'info', count: 4, title: 'Informacja' },
    { actionId: 'three', severity: 'warning', count: 0, title: 'Brak' },
  ] });
  assert.equal(events.length, 1);
  assert.equal(events[0].key, 'one');
});

test('tabela producenta zawiera tylko kod, nazwę i potrzebną ilość', () => {
  const tables = telegramSupplierTables({ id: 'Z-1', pozycje: [{ kod: 'ABC', nazwa: 'Gra testowa', ilosc: 3, dostawca: 'Alexander', ean: '123' }] });
  assert.equal(tables.length, 1);
  assert.match(tables[0].text, /KOD/);
  assert.match(tables[0].text, /NAZWA/);
  assert.match(tables[0].text, /POTRZEBNA ILOŚĆ/);
  assert.doesNotMatch(tables[0].text, /123/);
  const explicitBusiness = telegramSupplierTables({ id: 'Z-2', pozycje: [{ produktId: '18', externalId: '18', sku: '18', kodProducenta: '18', kod: '18', nazwa: 'Jawny kod biznesowy', ilosc: 2, dostawca: 'Alexander' }] });
  assert.match(explicitBusiness[0].text, /\b18\b/);
  assert.doesNotMatch(explicitBusiness[0].text, /BRAK KODU/);
  const localOnly = telegramSupplierTables({ id: 'Z-3', pozycje: [{ produktId: '19', kod: '19', nazwa: 'Tylko lokalne ID', ilosc: 1, dostawca: 'Alexander' }] });
  assert.match(localOnly[0].text, /BRAK KODU/);
  assert.doesNotMatch(localOnly[0].text, /\b19\b/);
  const large = telegramSupplierTables({ id: 'Z-501', pozycje: Array.from({ length: 501 }, (_value, index) => ({ externalId: `EXT-${String(index + 1).padStart(3, '0')}`, nazwa: `Produkt ${index + 1}`, ilosc: 1, dostawca: 'Alexander' })) });
  assert.equal(large.length, 28);
  assert.match(large.at(-1).text, /EXT-501/);
});

test('ustawienia profesjonalnego obiegu mają SLA, eskalację i opcjonalne tematy grupy', () => {
  const settings = telegramSettings({ criticalSlaMinutes: 45, warningSlaMinutes: 360, topicRouting: true, topicCustomer: 12, maxEscalations: 3 });
  assert.equal(settings.incidentWorkflow, true);
  assert.equal(settings.autoResolve, true);
  assert.equal(settings.criticalSlaMinutes, 45);
  assert.equal(settings.warningSlaMinutes, 360);
  assert.equal(settings.maxEscalations, 3);
  assert.equal(telegramTopicId(settings, 'customer'), 12);
  assert.equal(telegramTopicId(settings, 'operations'), 0);
  assert.equal(telegramIncidentId('orders'), telegramIncidentId('orders'));
  assert.notEqual(telegramIncidentId('orders'), telegramIncidentId('messages'));
});

test('sprawę można przyjąć, odłożyć, zamknąć wewnętrznie i przywrócić', async () => {
  const data = new Map(), read = async (key, fallback) => structuredClone(data.has(key) ? data.get(key) : fallback), write = async (key, value) => data.set(key, structuredClone(value));
  const center = createTelegramCenter({ read, write, env: {} });
  const operational = { priorities: [{ actionId: 'orders', severity: 'critical', count: 2, title: 'Nowe zamówienia', action: 'Sprawdź zamówienia' }] };
  const view = await center.view(operational, false), id = view.incidents[0].id;
  let result = await center.incidentAction(id, 'ack', { id: '1', name: 'Tomasz' });
  assert.equal(result.incident.status, 'acknowledged');
  assert.equal(result.incident.owner.name, 'Tomasz');
  result = await center.incidentAction(id, 's1', { id: '1', name: 'Tomasz' });
  assert.equal(result.incident.status, 'snoozed');
  assert.ok(Date.parse(result.incident.snoozedUntil) > Date.now());
  result = await center.incidentAction(id, 'resolve', { id: '1', name: 'Tomasz' });
  assert.equal(result.incident.status, 'resolved');
  result = await center.incidentAction(id, 'reopen', { id: '1', name: 'Tomasz' });
  assert.equal(result.incident.status, 'open');
});

test('znikający problem jest zamykany, a prawdziwa nowa zmiana ponownie go otwiera', async () => {
  const data = new Map(), read = async (key, fallback) => structuredClone(data.has(key) ? data.get(key) : fallback), write = async (key, value) => data.set(key, structuredClone(value));
  const center = createTelegramCenter({ read, write, env: {} });
  const first = { priorities: [{ actionId: 'shipping', severity: 'warning', count: 1, title: 'Wysyłka bez numeru', action: 'Uzupełnij numer' }] };
  let view = await center.view(first, false);
  const id = view.incidents[0].id;
  view = await center.view({ priorities: [] }, false);
  assert.equal(view.incidents.find((item) => item.id === id).status, 'resolved');
  view = await center.view({ priorities: [{ actionId: 'shipping', severity: 'warning', count: 2, title: 'Wysyłki bez numeru', action: 'Uzupełnij numery' }] }, false);
  assert.equal(view.incidents.find((item) => item.id === id).status, 'open');
});
