import test from 'node:test';
import assert from 'node:assert/strict';
import { codexAgentApprovalReplyTarget, createTelegramRouter } from '../src/backend/lib/telegram-router.mjs';
import { createCodexAgentQueue } from '../src/backend/lib/domain/codex-agent-queue.mjs';
import { telegramSafeAgentHtml } from '../src/backend/lib/domain/telegram-communication.mjs';

test('naturalna wiadomość webhooka trafia do kolejki Codex, a nie do uproszczonej odpowiedzi', async () => {
  let queued = null, centerCalls = 0, audit = null;
  const router = createTelegramRouter({
    center: {
      inbound: async () => { centerCalls += 1; return { message: 'fallback' }; },
      recordInboundAudit: async (value) => { audit = value; return value; },
    },
    codexQueue: { enqueue: async (job) => { queued = job; return { job: { id: 'CX-test' }, duplicate: false, status: 'queued', workerOnline: true }; } },
    getOperationalCenter: async () => { centerCalls += 1; return {}; },
    inventoryCommand: async () => null,
    isAdmin: () => true,
    respond: (payload, status = 200) => ({ payload, status }),
    sessionOf: () => ({ email: 'admin@example.test' }),
    publicOrigin: () => 'https://artwaytm.pl',
    supplierTables: () => [],
    text: (value, limit = 500) => String(value || '').slice(0, limit),
  });
  const request = new Request('https://artwaytm.pl/api/store?action=telegram-inbound-command', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: 'sprawdź, co wymaga dziś działania', intent: 'unknown', source: 'telegram-webhook', deferToCodex: true,
      requestId: 'update-55', chatId: '123', messageThreadId: 9, replyTo: 88, user: 'Artway', userId: '700',
      broadcastChatIds: ['123', '456'], conversationRoom: 'team',
      context: 'Poprzednie pytanie klienta', media: { kind: 'voice', fileId: 'voice-1', mimeType: 'audio/ogg', fileName: '' }, kind: 'voice',
    }),
  });
  const result = await router(request, new URL(request.url), 'telegram-inbound-command');
  assert.equal(result.payload.deferred, true);
  assert.equal(result.payload.jobId, 'CX-test');
  assert.equal(queued.requestId, 'update-55');
  assert.equal(queued.text, 'sprawdź, co wymaga dziś działania');
  assert.equal(queued.replyTo, 88);
  assert.equal(queued.messageThreadId, 9);
  assert.equal(queued.userId, '700');
  assert.deepEqual(queued.broadcastChatIds, ['123', '456']);
  assert.equal(queued.conversationRoom, 'team');
  assert.equal(queued.kind, 'voice');
  assert.equal(queued.context, 'Poprzednie pytanie klienta');
  assert.deepEqual(queued.media, { kind: 'voice', fileId: 'voice-1', mimeType: 'audio/ogg', fileName: '' });
  assert.deepEqual(audit, {
    accepted: true, deferred: true, kind: 'voice',
    preview: 'sprawdź, co wymaga dziś działania', fromLabel: 'Artway', messageId: 88,
    threadId: 9, conversationKey: 'telegram:123:9',
  });
  assert.equal(centerCalls, 0);
});

test('endpoint audytu zapisuje wyłącznie metadane akceptacji albo odrzucenia', async () => {
  let input = null;
  const router = createTelegramRouter({
    center: { recordInboundAudit: async (value) => { input = value; return { ...value, counts: { accepted: 1, deferred: 0, rejected: 1 } }; } },
    codexQueue: null, getOperationalCenter: async () => ({}), inventoryCommand: async () => null,
    isAdmin: () => true, respond: (payload, status = 200) => ({ payload, status }), sessionOf: () => null,
    publicOrigin: () => 'https://artwaytm.pl', supplierTables: () => [],
    text: (value, limit = 500) => String(value || '').slice(0, limit),
  });
  const request = routingRequest({ accepted: false, deferred: false, kind: 'voice', actorHash: 'abcdef1234567890abcdef12', text: 'TA TREŚĆ NIE MOŻE TRAFIĆ DO AUDYTU', userId: '700' }, 'telegram-inbound-audit');
  const result = await router(request, new URL(request.url), 'telegram-inbound-audit');
  assert.deepEqual(input, { accepted: false, deferred: false, kind: 'voice', actorHash: 'abcdef1234567890abcdef12' });
  assert.equal(JSON.stringify(result.payload).includes('TA TREŚĆ'), false);
  assert.equal(JSON.stringify(result.payload).includes('700'), false);
});

function routingRequest(body = {}, action = 'telegram-inbound-command') {
  return new Request(`https://artwaytm.pl/api/store?action=${action}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

function baseRouter(codexQueue, sendTelegram = async () => ({ message_id: 1 }), clearTelegramReplyMarkup = async () => true) {
  return createTelegramRouter({
    center: { inbound: async () => ({ message: 'fallback' }) }, codexQueue,
    getOperationalCenter: async () => ({}), inventoryCommand: async () => null,
    isAdmin: () => true, respond: (payload, status = 200) => ({ payload, status }), sessionOf: () => null,
    publicOrigin: () => 'https://artwaytm.pl', supplierTables: () => [],
    text: (value, limit = 500) => String(value || '').slice(0, limit), sendTelegram, clearTelegramReplyMarkup,
  });
}

test('odpowiedź Agenta zachowuje tylko bezpieczny rich text bez linków i atrybutów', () => {
  assert.equal(
    telegramSafeAgentHtml('<b>Gotowe</b> <code>EXTERNAL_ID: 1410</code>'),
    '<b>Gotowe</b> <code>EXTERNAL_ID: 1410</code>',
  );
  const unsafe = telegramSafeAgentHtml('<a href="https://evil.example">kliknij</a> <b onclick="steal()">ważne</b> <i>bezpieczne</i>');
  assert.equal(unsafe.includes('<a '), false);
  assert.equal(unsafe.includes('<b onclick'), false);
  assert.match(unsafe, /&lt;a href="https:\/\/evil\.example"&gt;kliknij&lt;\/a&gt;/);
  assert.match(unsafe, /&lt;b onclick="steal\(\)"&gt;ważne&lt;\/b&gt;/);
  assert.match(unsafe, /<i>bezpieczne<\/i>/);
});

test('tylko dokładny callback AA z wiarygodnym replyTo wskazuje klawiaturę do usunięcia', () => {
  assert.deepEqual(codexAgentApprovalReplyTarget({ channel: 'telegram', kind: 'callback', text: 'aa:c:AAabcdef123456', chatId: '-200', replyTo: 77 }), { chatId: '-200', messageId: 77 });
  for (const job of [
    { channel: 'telegram', kind: 'callback', text: ' aa:c:AAabcdef123456', chatId: '-200', replyTo: 77 },
    { channel: 'telegram', kind: 'callback', text: 'aa:c:AAabcdef123456 dodatkowe', chatId: '-200', replyTo: 77 },
    { channel: 'telegram', kind: 'callback', text: 'sprawdź status', chatId: '-200', replyTo: 77 },
    { channel: 'telegram', kind: 'text', text: 'aa:r:AAabcdef123456', chatId: '-200', replyTo: 77 },
    { channel: 'telegram', kind: 'callback', text: 'aa:r:AAabcdef123456', chatId: '', replyTo: 77 },
    { channel: 'telegram', kind: 'callback', text: 'aa:r:AAabcdef123456', chatId: '-200', replyTo: 0 },
    { channel: 'panel', kind: 'panel', text: 'aa:r:AAabcdef123456', chatId: '-200', replyTo: 77 },
  ]) assert.equal(codexAgentApprovalReplyTarget(job), null);
});

test('complete przekazuje jednorazową klawiaturę zatwierdzeń do Telegram i dopiero potem kończy zadanie', async () => {
  const calls = [];
  const safeMarkup = { inline_keyboard: [[
    { text: '✅ Zatwierdź', callback_data: 'aa:c:AAabcdef123456' },
    { text: '❌ Odrzuć', callback_data: 'aa:r:AAabcdef123456' },
  ]] };
  const codexQueue = {
    prepareDelivery: async (body) => {
      calls.push({ kind: 'prepare', body });
      return {
        job: {
          channel: 'telegram', kind: 'callback', text: 'aa:c:AAabcdef123456', response: '<b>Czy zatwierdzasz zmianę?</b> <code>1410</code>', chatId: '123', broadcastChatIds: ['456'], conversationRoom: 'team', replyTo: 77, messageThreadId: 9,
          replyMarkup: safeMarkup,
        },
      };
    },
    markDelivered: async (body) => { calls.push({ kind: 'delivered', body }); return { delivered: true, duplicate: false }; },
    fail: async () => { throw new Error('fail nie powinien zostać wywołany'); },
  };
  const sent = [];
  const cleared = [];
  const router = baseRouter(codexQueue, async (message, options) => {
    sent.push({ message, options });
    return { message_id: 501 };
  }, async (target) => { cleared.push(target); calls.push({ kind: 'cleared', target }); return true; });
  const request = routingRequest({
    id: 'CX-approval', claimToken: 'claim-1', response: '<b>Czy zatwierdzasz zmianę?</b> <code>1410</code>',
    replyMarkup: { inline_keyboard: [[{ text: '✅ Zatwierdź', callback_data: 'aa:c:AAabcdef123456' }]] },
  }, 'codex-agent-complete');
  const result = await router(request, new URL(request.url), 'codex-agent-complete');
  assert.equal(result.payload.delivered, true);
  assert.deepEqual(sent, [
    {
      message: '<b>Czy zatwierdzasz zmianę?</b> <code>1410</code>',
      options: { chatId: '123', replyTo: 77, messageThreadId: 9, replyMarkup: safeMarkup },
    },
    {
      message: '<b>Czy zatwierdzasz zmianę?</b> <code>1410</code>',
      options: { chatId: '456' },
    },
  ]);
  assert.deepEqual(sent[0].options.replyMarkup.inline_keyboard[0].map((button) => button.callback_data), [
    'aa:c:AAabcdef123456', 'aa:r:AAabcdef123456',
  ]);
  assert.equal(calls[0].body.replyMarkup.inline_keyboard[0][0].callback_data, 'aa:c:AAabcdef123456');
  assert.deepEqual(calls[1], { kind: 'delivered', body: { id: 'CX-approval', claimToken: 'claim-1', telegramMessageId: 501 } });
  assert.deepEqual(calls[2], { kind: 'cleared', target: { chatId: '123', messageId: 77 } });
  assert.deepEqual(cleared, [{ chatId: '123', messageId: 77 }]);
});

test('błąd dostawy odpowiedzi AA pozostawia oryginalne przyciski', async () => {
  let failed = 0, cleared = 0;
  const codexQueue = {
    prepareDelivery: async () => ({ job: {
      channel: 'telegram', kind: 'callback', text: 'aa:r:AAabcdef123456', response: 'Odrzucono', chatId: '123', replyTo: 77, replyMarkup: null,
    } }),
    markDelivered: async () => { throw new Error('nie wolno kończyć po błędzie wysyłki'); },
    fail: async () => { failed += 1; return { terminal: true }; },
  };
  const router = baseRouter(codexQueue, async () => { throw new Error('Telegram offline'); }, async () => { cleared += 1; });
  const request = routingRequest({ id: 'CX-failed-approval', claimToken: 'claim-2', response: 'Odrzucono' }, 'codex-agent-complete');
  await assert.rejects(router(request, new URL(request.url), 'codex-agent-complete'), /Telegram offline/);
  assert.equal(failed, 1);
  assert.equal(cleared, 0);
});

test('nieaktywny worker daje jasny fallback i nie udaje deferred', async () => {
  const router = baseRouter({
    enqueue: async () => ({ job: { id: 'CX-offline' }, duplicate: false, status: 'failed', workerOnline: false }),
  });
  const request = routingRequest({
    text: 'sprawdź zamówienia', source: 'telegram-webhook', deferToCodex: true,
    requestId: 'offline-update', chatId: '123', replyTo: 88,
  });
  const result = await router(request, new URL(request.url), 'telegram-inbound-command');
  assert.equal(result.payload.deferred, false);
  assert.equal(result.payload.workerOnline, false);
  assert.match(result.payload.message, /offline/i);
});

test('duplicate failed nigdy nie jest zwracany jako deferred', async () => {
  const router = baseRouter({
    enqueue: async () => ({ job: { id: 'CX-failed' }, duplicate: true, status: 'failed', workerOnline: true }),
  });
  const request = routingRequest({
    text: 'powtórzone', source: 'telegram-webhook', deferToCodex: true,
    requestId: 'failed-update', chatId: '123', replyTo: 88,
  });
  const result = await router(request, new URL(request.url), 'telegram-inbound-command');
  assert.equal(result.payload.deferred, false);
  assert.equal(result.payload.duplicate, true);
  assert.equal(result.payload.status, 'failed');
  assert.ok(result.payload.message.trim().length > 0);
});

test('duplicate completed nie uruchamia pracy drugi raz i zwraca niepustą odpowiedź', async () => {
  const router = baseRouter({
    enqueue: async () => ({ job: { id: 'CX-completed' }, duplicate: true, status: 'completed', workerOnline: true }),
  });
  const request = routingRequest({
    text: 'powtórzone', source: 'telegram-webhook', deferToCodex: true,
    requestId: 'completed-update', chatId: '123', replyTo: 88,
  });
  const result = await router(request, new URL(request.url), 'telegram-inbound-command');
  assert.equal(result.payload.deferred, false);
  assert.equal(result.payload.duplicate, true);
  assert.equal(result.payload.status, 'completed');
  assert.ok(result.payload.message.trim().length > 0);
});

function versionedRepository() {
  let value = { items: [], updatedAt: null }, etag = 'v1';
  return {
    readVersioned: async () => ({ value: structuredClone(value), etag, exists: true }),
    writeIfVersion: async (_key, next, version) => {
      if (version.etag !== etag) return { modified: false };
      value = structuredClone(next);
      etag = `v${Number(etag.slice(1)) + 1}`;
      return { modified: true };
    },
    read: () => structuredClone(value),
  };
}

test('pierwszy błąd wysyłki terminalnego alertu trafia do outbox, kolejny claim ponawia, a ack blokuje duplikat', async () => {
  const repository = versionedRepository();
  let tokenNo = 0, time = new Date('2026-07-15T12:00:00.000Z');
  const queue = createCodexAgentQueue({
    readVersioned: repository.readVersioned,
    writeIfVersion: repository.writeIfVersion,
    now: () => new Date(time),
    token: () => `lease-${++tokenNo}`,
  });
  await queue.claim('worker');
  await queue.enqueue({ requestId: 'terminal-route-1', text: 'tajne polecenie użytkownika', chatId: '123', replyTo: 77, messageThreadId: 9 });
  const job = (await queue.claim('worker')).job;
  const sent = [];
  let sends = 0;
  const router = baseRouter(queue, async (message, options) => {
    sent.push({ message, options });
    sends += 1;
    if (sends === 1) {
      const error = new Error('Telegram chwilowo niedostępny');
      error.status = 503;
      throw error;
    }
    return { message_id: 10 };
  });
  const firstRequest = routingRequest({ id: job.id, claimToken: job.claimToken, error: 'błąd', expired: true }, 'codex-agent-fail');
  const first = await router(firstRequest, new URL(firstRequest.url), 'codex-agent-fail');
  assert.equal(first.payload.notified, false);
  assert.equal(first.payload.notificationPending, true);
  assert.equal(sent.length, 1);
  assert.equal(repository.read().items[0].failureNotification.status, 'pending');
  assert.equal(repository.read().items[0].text, '');
  assert.equal(JSON.stringify(repository.read().items[0].failureNotification).includes('tajne polecenie'), false);

  const duringBackoffRequest = routingRequest({ workerId: 'worker' }, 'codex-agent-claim');
  const duringBackoff = await router(duringBackoffRequest, new URL(duringBackoffRequest.url), 'codex-agent-claim');
  assert.equal(duringBackoff.payload.failureNotification.attempted, false);
  assert.equal(sent.length, 1);

  time = new Date(time.getTime() + 10_000);
  const retryRequest = routingRequest({ workerId: 'worker' }, 'codex-agent-claim');
  const retry = await router(retryRequest, new URL(retryRequest.url), 'codex-agent-claim');
  assert.equal(retry.payload.failureNotification.delivered, true);
  assert.equal(sent.length, 2);
  assert.equal(repository.read().items[0].failureNotification.status, 'sent');

  const afterAckRequest = routingRequest({ workerId: 'worker' }, 'codex-agent-claim');
  const afterAck = await router(afterAckRequest, new URL(afterAckRequest.url), 'codex-agent-claim');
  assert.equal(afterAck.payload.failureNotification.attempted, false);
  assert.equal(sent.length, 2, 'ackowany outbox nie może wysłać duplikatu');
  assert.ok(sent[0].message.length < 180);
  assert.deepEqual(sent[0].options, { chatId: '123', replyTo: 77, messageThreadId: 9 });
});

test('pierwszy claim po awarii workera wygasza Telegram TTL i dostarcza trwały alert z outbox', async () => {
  const repository = versionedRepository();
  let time = new Date('2026-07-15T12:00:00.000Z'), tokenNo = 0;
  const queue = createCodexAgentQueue({
    readVersioned: repository.readVersioned,
    writeIfVersion: repository.writeIfVersion,
    now: () => new Date(time),
    token: () => `ttl-${++tokenNo}`,
  });
  await queue.claim('worker-before-crash');
  await queue.enqueue({ requestId: 'ttl-route', text: 'polecenie po awarii', chatId: '123', replyTo: 55 });
  time = new Date(time.getTime() + 121_000);
  const sent = [];
  const router = baseRouter(queue, async (message, options) => {
    sent.push({ message, options });
    return { message_id: 12 };
  });
  const request = routingRequest({ workerId: 'worker-after-crash' }, 'codex-agent-claim');
  const result = await router(request, new URL(request.url), 'codex-agent-claim');
  assert.equal(result.payload.expiredTelegram, true);
  assert.equal(result.payload.failureNotification.delivered, true);
  assert.equal(sent.length, 1);
  const stored = repository.read().items[0];
  assert.equal(stored.status, 'failed');
  assert.equal(stored.failureNotification.status, 'sent');
  assert.equal(stored.text, '');
  assert.equal(JSON.stringify(stored.failureNotification).includes('polecenie po awarii'), false);
});

test('claim odzyskujący wygasłe delivering tworzy i dostarcza terminalny alert Telegram', async () => {
  const repository = versionedRepository();
  let time = new Date('2026-07-15T12:00:00.000Z'), tokenNo = 0;
  const queue = createCodexAgentQueue({
    readVersioned: repository.readVersioned,
    writeIfVersion: repository.writeIfVersion,
    now: () => new Date(time),
    token: () => `delivery-${++tokenNo}`,
  });
  await queue.claim('worker');
  await queue.enqueue({ requestId: 'delivery-route', text: 'polecenie', chatId: '123', replyTo: 56 });
  const job = (await queue.claim('worker')).job;
  await queue.prepareDelivery({ id: job.id, claimToken: job.claimToken, response: 'gotowa odpowiedź' });
  time = new Date(time.getTime() + 91_000);
  const sent = [];
  const router = baseRouter(queue, async (message, options) => {
    sent.push({ message, options });
    return { message_id: 13 };
  });
  const request = routingRequest({ workerId: 'worker-recovery' }, 'codex-agent-claim');
  const result = await router(request, new URL(request.url), 'codex-agent-claim');
  assert.equal(result.payload.recoveredDelivery, true);
  assert.equal(result.payload.failureNotification.delivered, true);
  assert.equal(sent.length, 1);
  const stored = repository.read().items[0];
  assert.equal(stored.status, 'failed');
  assert.equal(stored.failureNotification.status, 'sent');
  assert.equal(stored.response, '');
  assert.equal(JSON.stringify(stored.failureNotification).includes('gotowa odpowiedź'), false);
});

test('nieprawidłowy reply target jest bezpiecznie ponawiany bez reply i ackowany raz', async () => {
  const repository = versionedRepository();
  let tokenNo = 0;
  const queue = createCodexAgentQueue({
    readVersioned: repository.readVersioned,
    writeIfVersion: repository.writeIfVersion,
    now: () => new Date('2026-07-15T12:00:00.000Z'),
    token: () => `reply-${++tokenNo}`,
  });
  await queue.claim('worker');
  await queue.enqueue({ requestId: 'bad-reply', text: 'polecenie', chatId: '123', replyTo: 404, messageThreadId: 9 });
  const job = (await queue.claim('worker')).job;
  const sent = [];
  const router = baseRouter(queue, async (_message, options) => {
    sent.push(options);
    if (options.replyTo) {
      const error = new Error('Bad Request: message to be replied not found');
      error.status = 400;
      throw error;
    }
    return { message_id: 11 };
  });
  const request = routingRequest({ id: job.id, claimToken: job.claimToken, error: 'błąd', expired: true }, 'codex-agent-fail');
  const result = await router(request, new URL(request.url), 'codex-agent-fail');
  assert.equal(result.payload.notified, true);
  assert.equal(result.payload.failureNotification.withoutReply, true);
  assert.deepEqual(sent, [
    { chatId: '123', replyTo: 404, messageThreadId: 9 },
    { chatId: '123', messageThreadId: 9 },
  ]);
  const claimRequest = routingRequest({ workerId: 'worker' }, 'codex-agent-claim');
  await router(claimRequest, new URL(claimRequest.url), 'codex-agent-claim');
  assert.equal(sent.length, 2);
});
