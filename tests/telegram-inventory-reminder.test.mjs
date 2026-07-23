import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramRouter } from '../src/backend/lib/telegram-router.mjs';

function request(body = {}) {
  return new Request('https://artwaytm.pl/api/store?action=telegram-dispatch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('cykl Telegram wysyła jedno grupowane przypomnienie z osobnymi decyzjami', async () => {
  const sent = [];
  const lifecycle = [];
  const reminderMessage = {
    text: '<b>🕓 Decyzje magazynowe do potwierdzenia</b>',
    replyMarkup: { inline_keyboard: [
      [{ text: '✅ #1 Potwierdzam', callback_data: 'iv:c:IVaaaaaaaaaaaaaa' }, { text: '❌ #1 Nie', callback_data: 'iv:r:IVaaaaaaaaaaaaaa' }],
      [{ text: '✅ #2 Potwierdzam', callback_data: 'iv:c:IVbbbbbbbbbbbbbb' }, { text: '❌ #2 Nie', callback_data: 'iv:r:IVbbbbbbbbbbbbbb' }],
    ] },
  };
  const router = createTelegramRouter({
    center: { dispatch: async () => ({ sent: false }) },
    inventoryDecisions: {
      prepareReminder: async () => ({ due: true, reason: 'pending_confirmations', slot: '2026-07-15T16:00', claimToken: 'claim-success', decisions: [{}, {}], messages: [reminderMessage] }),
      completeReminder: async (token) => { lifecycle.push(['complete', token]); return { completed: true }; },
      releaseReminder: async (token) => { lifecycle.push(['release', token]); return { released: true }; },
    },
    getOperationalCenter: async () => ({ score: 100 }),
    isAdmin: () => true,
    respond: (payload, status = 200) => ({ payload, status }),
    sessionOf: () => ({ email: 'admin@example.test' }),
    publicOrigin: () => 'https://artwaytm.pl',
    supplierTables: () => [],
    text: (value, limit = 500) => String(value || '').slice(0, limit),
    sendTelegram: async (message, options) => { sent.push({ message, options }); return { message_id: 10 }; },
  });
  const req = request({ source: 'scheduled-telegram-center' });
  const result = await router(req, new URL(req.url), 'telegram-dispatch');
  assert.equal(result.status, 200);
  assert.equal(result.payload.inventoryReminder.decisions, 2);
  assert.equal(result.payload.inventoryReminder.messages, 1);
  assert.equal(result.payload.inventoryReminder.completed, true);
  assert.equal(result.payload.inventoryReminder.released, false);
  assert.deepEqual(lifecycle, [['complete', 'claim-success']]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].options.replyMarkup.inline_keyboard.length, 2);
  assert.notEqual(sent[0].options.replyMarkup.inline_keyboard[0][0].callback_data, sent[0].options.replyMarkup.inline_keyboard[1][0].callback_data);
});

test('błąd jednej części zwalnia claim i pozwala kolejnemu cronowi ponowić wysyłkę', async () => {
  const lifecycle = [], attempts = [];
  const messages = [1, 2, 3].map((number) => ({
    text: `<b>Część ${number}</b>`,
    replyMarkup: { inline_keyboard: [[{ text: `#${number}`, callback_data: `iv:c:IV${String(number).padStart(14, '0')}` }]] },
  }));
  let claimed = false, attempt = 0;
  const inventoryDecisions = {
    prepareReminder: async () => {
      if (claimed) return { due: false, reason: 'already_claimed', messages: [], decisions: [] };
      claimed = true;
      attempt += 1;
      return { due: true, reason: 'pending_confirmations', slot: '2026-07-15T16:00', claimToken: `claim-${attempt}`, decisions: [{}, {}, {}], messages };
    },
    completeReminder: async (token) => { lifecycle.push(['complete', token]); claimed = false; return { completed: true }; },
    releaseReminder: async (token) => { lifecycle.push(['release', token]); claimed = false; return { released: true }; },
  };
  let sendNo = 0;
  const router = createTelegramRouter({
    center: { dispatch: async () => ({ sent: false }) },
    inventoryDecisions,
    getOperationalCenter: async () => ({}),
    isAdmin: () => true,
    respond: (payload, status = 200) => ({ payload, status }),
    sessionOf: () => null,
    publicOrigin: () => 'https://artwaytm.pl',
    supplierTables: () => [],
    text: (value, limit = 500) => String(value || '').slice(0, limit),
    sendTelegram: async (message) => {
      attempts.push(message);
      sendNo += 1;
      if (sendNo === 2) throw new Error('chwilowy błąd Telegrama');
      return { message_id: sendNo };
    },
  });

  const failed = await router(request(), new URL('https://artwaytm.pl/api/store?action=telegram-dispatch'), 'telegram-dispatch');
  assert.equal(failed.payload.inventoryReminder.messages, 1);
  assert.equal(failed.payload.inventoryReminder.completed, false);
  assert.equal(failed.payload.inventoryReminder.released, true);
  assert.equal(failed.payload.inventoryReminder.reason, 'delivery_failed_retryable');
  assert.equal(attempts.length, 2, 'po błędzie nie wysyłamy dalszych części');
  assert.deepEqual(lifecycle, [['release', 'claim-1']]);

  sendNo = 10;
  const retried = await router(request(), new URL('https://artwaytm.pl/api/store?action=telegram-dispatch'), 'telegram-dispatch');
  assert.equal(retried.payload.inventoryReminder.messages, 3);
  assert.equal(retried.payload.inventoryReminder.completed, true);
  assert.deepEqual(lifecycle, [['release', 'claim-1'], ['complete', 'claim-2']]);
});

test('równoległe dispatchery wysyłają przypomnienie tylko z procesu posiadającego claim', async () => {
  let claim = null, sends = 0, completes = 0;
  const inventoryDecisions = {
    prepareReminder: async () => {
      if (claim) return { due: false, reason: 'already_claimed', messages: [], decisions: [] };
      claim = 'parallel-claim';
      return { due: true, reason: 'pending_confirmations', slot: '2026-07-15T16:00', claimToken: claim, decisions: [{}], messages: [{ text: 'jedno', replyMarkup: { inline_keyboard: [] } }] };
    },
    completeReminder: async (token) => {
      assert.equal(token, claim);
      completes += 1;
      return { completed: true };
    },
    releaseReminder: async () => ({ released: true }),
  };
  const router = createTelegramRouter({
    center: { dispatch: async () => ({ sent: false }) },
    inventoryDecisions,
    getOperationalCenter: async () => ({}),
    isAdmin: () => true,
    respond: (payload, status = 200) => ({ payload, status }),
    sessionOf: () => null,
    publicOrigin: () => 'https://artwaytm.pl',
    supplierTables: () => [],
    text: (value, limit = 500) => String(value || '').slice(0, limit),
    sendTelegram: async () => { sends += 1; await new Promise((resolve) => setTimeout(resolve, 5)); return { message_id: 1 }; },
  });
  const url = new URL('https://artwaytm.pl/api/store?action=telegram-dispatch');
  const [first, second] = await Promise.all([router(request(), url, 'telegram-dispatch'), router(request(), url, 'telegram-dispatch')]);
  assert.equal(sends, 1);
  assert.equal(completes, 1);
  assert.deepEqual([first.payload.inventoryReminder.due, second.payload.inventoryReminder.due].sort(), [false, true]);
});

test('cykl poza oknem przypomnienia niczego nie wysyła', async () => {
  let sends = 0;
  const router = createTelegramRouter({
    center: { dispatch: async () => ({ sent: false }) },
    inventoryDecisions: { prepareReminder: async () => ({ due: false, reason: 'outside_window', slot: null, decisions: [], messages: [] }) },
    getOperationalCenter: async () => ({}),
    isAdmin: () => true,
    respond: (payload, status = 200) => ({ payload, status }),
    sessionOf: () => null,
    publicOrigin: () => 'https://artwaytm.pl',
    supplierTables: () => [],
    text: (value, limit = 500) => String(value || '').slice(0, limit),
    sendTelegram: async () => { sends += 1; },
  });
  const req = request();
  const result = await router(req, new URL(req.url), 'telegram-dispatch');
  assert.equal(result.payload.inventoryReminder.reason, 'outside_window');
  assert.equal(sends, 0);
});
