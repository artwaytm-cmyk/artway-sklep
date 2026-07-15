import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramRouter } from '../netlify/functions/lib/telegram-router.mjs';

test('naturalna wiadomość webhooka trafia do kolejki Codex, a nie do uproszczonej odpowiedzi', async () => {
  let queued = null, centerCalls = 0;
  const router = createTelegramRouter({
    center: { inbound: async () => { centerCalls += 1; return { message: 'fallback' }; } },
    codexQueue: { enqueue: async (job) => { queued = job; return { job: { id: 'CX-test' }, duplicate: false }; } },
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
      requestId: 'update-55', chatId: '123', replyTo: 88, user: 'Artway',
    }),
  });
  const result = await router(request, new URL(request.url), 'telegram-inbound-command');
  assert.equal(result.payload.deferred, true);
  assert.equal(result.payload.jobId, 'CX-test');
  assert.equal(queued.requestId, 'update-55');
  assert.equal(queued.text, 'sprawdź, co wymaga dziś działania');
  assert.equal(queued.replyTo, 88);
  assert.equal(centerCalls, 0);
});
