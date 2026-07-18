import test from 'node:test';
import assert from 'node:assert/strict';
import telegramWebhook, {
  normalizeTelegramAgentInput,
  parseAgentApprovalCallback,
  parseInventoryDecisionText,
  telegramActorRef,
  telegramCallbackRoute,
  telegramCommandRoute,
  telegramInboundKind,
  telegramInventoryDecisionAllowed,
  telegramMessageMedia,
  telegramReplyContext,
  telegramGroupMessageUrl,
  telegramPrivateTeamRecipients,
  telegramSharedConversationTarget,
} from '../netlify/functions/telegram-webhook.mjs';

test('prywatne polecenia obu telefonów trafiają do jednej wspólnej grupy', () => {
  const config = { chatId: '-1009876543210' };
  assert.deepEqual(telegramSharedConversationTarget({
    message_id: 17,
    chat: { id: 123, type: 'private' },
  }, config), {
    sourceChatId: '123', chatId: '-1009876543210', messageThreadId: null, replyTo: null, bridged: true,
    sharedPrivate: false, broadcastChatIds: [], conversationRoom: '',
  });
  assert.deepEqual(telegramSharedConversationTarget({
    message_id: 18,
    message_thread_id: 4,
    chat: { id: -1009876543210, type: 'supergroup' },
  }, config), {
    sourceChatId: '-1009876543210', chatId: '-1009876543210', messageThreadId: 4, replyTo: 18, bridged: false,
    sharedPrivate: false, broadcastChatIds: [], conversationRoom: '',
  });
  assert.equal(telegramGroupMessageUrl('-1009876543210', 77), 'https://t.me/c/9876543210/77');
});

test('serwerowy pokój prywatny ma wspólny czat administratora i oba telefony jako odbiorców', () => {
  const config = {
    sharedMode: 'private-room',
    chatId: '-200',
    teamUserIds: new Set(['100', '300']),
    approverUserIds: new Set(['100']),
  };
  assert.deepEqual(telegramPrivateTeamRecipients(config, '300'), ['300', '100']);
  assert.deepEqual(telegramSharedConversationTarget({ message_id: 21, chat: { id: 300, type: 'private' } }, config), {
    sourceChatId: '300', chatId: '100', messageThreadId: null, replyTo: 21, bridged: false,
    sharedPrivate: true, broadcastChatIds: ['300', '100'], conversationRoom: 'team', chatLabel: 'Wspólny pokój zespołu',
  });
});

test('wiadomość z drugiego telefonu i odpowiedź bota są widoczne na obu telefonach', { concurrency: false }, async (t) => {
  const previousFetch = globalThis.fetch;
  const envNames = ['TELEGRAM_WEBHOOK_SECRET', 'TELEGRAM_BOT_TOKEN', 'ARTWAY_ADMIN_TOKEN', 'TELEGRAM_CHAT_ID', 'TELEGRAM_GROUP_ID', 'TELEGRAM_ALLOWED_USER_IDS', 'TELEGRAM_SHARED_MODE'];
  const previousEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  t.after(() => {
    globalThis.fetch = previousFetch;
    for (const name of envNames) previousEnv[name] === undefined ? delete process.env[name] : process.env[name] = previousEnv[name];
  });
  Object.assign(process.env, {
    TELEGRAM_WEBHOOK_SECRET: 'shared-room-secret', TELEGRAM_BOT_TOKEN: 'bot-test-token', ARTWAY_ADMIN_TOKEN: 'admin-test-token',
    TELEGRAM_CHAT_ID: '100', TELEGRAM_GROUP_ID: '-200', TELEGRAM_ALLOWED_USER_IDS: '300', TELEGRAM_SHARED_MODE: 'private-room',
  });
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url), body = options.body ? JSON.parse(options.body) : null;
    calls.push({ href, body });
    if (href.includes('/api/store?action=telegram-inbound-command')) {
      return new Response(JSON.stringify({ ok: true, deferred: false, message: '<b>Braki:</b> Kasa Edukacyjna — 1 szt.' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    const messageNo = calls.filter((item) => item.href.includes('/sendMessage')).length;
    return new Response(JSON.stringify({ ok: true, result: href.includes('/sendMessage') ? { message_id: messageNo } : true }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await telegramWebhook(new Request('https://artwaytm.pl/.netlify/functions/telegram-webhook', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'shared-room-secret' },
    body: JSON.stringify({ update_id: 42, message: { message_id: 7, text: 'braki', from: { id: 300, first_name: 'Tomasz' }, chat: { id: 300, type: 'private' } } }),
  }));
  assert.equal(result.status, 200);
  const queued = calls.find((call) => call.href.includes('/api/store?action=telegram-inbound-command'));
  assert.equal(queued.body.chatId, '100');
  assert.deepEqual(queued.body.broadcastChatIds, ['300', '100']);
  assert.equal(queued.body.conversationRoom, 'team');
  const sent = calls.filter((call) => call.href.includes('/sendMessage'));
  assert.equal(sent.filter((call) => /Tomasz/.test(call.body.text)).length, 2);
  assert.equal(sent.filter((call) => /Kasa Edukacyjna/.test(call.body.text)).length, 2);
  assert.deepEqual(new Set(sent.filter((call) => /Kasa Edukacyjna/.test(call.body.text)).map((call) => String(call.body.chat_id))), new Set(['100', '300']));
  assert.equal(calls.some((call) => call.href.includes('/deleteMessage') && String(call.body.chat_id) === '300'), true);
});

test('webhook kieruje wzmiankę i awaryjne /agent do Codexa', () => {
  assert.deepEqual(normalizeTelegramAgentInput('@magazyn_artway_bot sprawdź stan ziemniaka'), { text: 'sprawdź stan ziemniaka', forceCodex: true });
  assert.deepEqual(normalizeTelegramAgentInput('@Magazyn_Artway_Bot: pokaż nowe zamówienia'), { text: 'pokaż nowe zamówienia', forceCodex: true });
  assert.deepEqual(normalizeTelegramAgentInput('/agent sprawdź zlecenia'), { text: 'sprawdź zlecenia', forceCodex: true });
  assert.deepEqual(normalizeTelegramAgentInput('/agent@magazyn_artway_bot sprawdź zlecenia'), { text: 'sprawdź zlecenia', forceCodex: true });
  assert.deepEqual(normalizeTelegramAgentInput('/agent@magazyn_artway_bot'), { text: 'Pokaż pomoc Agenta', forceCodex: true });
  assert.deepEqual(normalizeTelegramAgentInput('/status'), { text: '/status', forceCodex: false });
  assert.deepEqual(normalizeTelegramAgentInput('@inny_bot sprawdź zlecenia'), { text: '@inny_bot sprawdź zlecenia', forceCodex: false });
});

test('tylko szybkie komendy serwera zostają lokalne, a operacyjne trafiają do Agenta', () => {
  for (const command of ['/start', '/pomoc', '/settings', '/POMOC@magazyn_artway_bot']) {
    assert.equal(telegramCommandRoute(command), 'local', command);
  }
  for (const command of [
    '/agent sprawdź stan', '/centrum', '/decyzje', '/raport', '/wykonaj', '/produkty', '/producenci',
    '/diagnostyka', '/monitor', '/sprawdz', '/zlecenie', '/nadwyzki', '/linki', '/opisy', '/status',
    '/zamowienia', '/braki', '/wiadomosci', '/wysylki', '/magazyn', '/priorytety', '/dzis', '/dyskusje',
    '/inpost', '/dostawcy', '/integracje', '/telegram', '/dzialaj', '/check', '/zamow', '/przyjecia',
    '/url', '/producent', '/opis', '/help', 'sprawdź sklep',
  ]) assert.equal(telegramCommandRoute(command), 'agent', command);
});

test('webhook sanitizuje kontekst odpowiedzi i opisuje voice/audio bez pobierania pliku', () => {
  const context = telegramReplyContext({ text: ` Poprzednia\u0000 wiadomość\n${'x'.repeat(1800)} ` });
  assert.equal(context.includes('\u0000'), false);
  assert.equal(context.length, 1600);
  assert.deepEqual(telegramMessageMedia({ voice: { file_id: 'voice-1', mime_type: 'audio/ogg' } }), {
    kind: 'voice', fileId: 'voice-1', mimeType: 'audio/ogg', fileName: '',
  });
  assert.deepEqual(telegramMessageMedia({ audio: { file_id: 'audio-1', mime_type: 'audio/mpeg', file_name: 'polecenie.mp3' } }), {
    kind: 'audio', fileId: 'audio-1', mimeType: 'audio/mpeg', fileName: 'polecenie.mp3',
  });
  assert.equal(telegramMessageMedia({ document: { file_id: 'doc-1' } }), null);
  assert.equal(telegramInboundKind({ voice: { file_id: 'voice-1' } }), 'voice');
  assert.equal(telegramInboundKind({ text: '/status' }), 'command');
  assert.equal(telegramInboundKind({ text: 'status' }), 'text');
  assert.equal(telegramInboundKind({}, { id: 'callback' }), 'callback');
  const ref = telegramActorRef('700123', '-100999', 'webhook-secret');
  assert.match(ref, /^[a-f0-9]{24}$/);
  assert.equal(ref.includes('700123'), false);
  assert.equal(ref.includes('100999'), false);
});

test('webhook rozpoznaje wyłącznie ściśle zakotwiczoną decyzję administratora', () => {
  assert.deepEqual(parseInventoryDecisionText('Potwierdzam IVaaaaaaaaaaaaaa'), { action: 'confirm', id: 'IVaaaaaaaaaaaaaa' });
  assert.deepEqual(parseInventoryDecisionText('nie potwierdzam IVbbbbbbbbbbbbbb.'), { action: 'reject', id: 'IVbbbbbbbbbbbbbb' });
  assert.deepEqual(parseInventoryDecisionText('POTWIERDZAM ivABCDEFABCDEFAB'), { action: 'confirm', id: 'IVabcdefabcdefab' });
  for (const input of [
    'proszę potwierdzam IVaaaaaaaaaaaaaa',
    'potwierdzam IVaaaaaaaaaaaaaa później',
    'zatwierdzam IVaaaaaaaaaaaaaa',
    'potwierdzam',
    'nie potwierdzam wszystkich',
    'potwierdzam IVaaaaaaaaaaaaa',
    'potwierdzam IVaaaaaaaaaaaaaaa',
  ]) assert.equal(parseInventoryDecisionText(input), null, input);
});

test('callback zatwierdzenia Agenta ma zamknięty schemat, a decyzje magazynowe zachowują pierwszeństwo', () => {
  assert.deepEqual(parseAgentApprovalCallback('aa:c:AAabcdef123456'), { action: 'confirm', id: 'AAabcdef123456' });
  assert.deepEqual(parseAgentApprovalCallback('aa:r:AA012345abcdef'), { action: 'reject', id: 'AA012345abcdef' });
  assert.equal(telegramCallbackRoute('iv:c:IVaaaaaaaaaaaaaa'), 'inventory');
  assert.equal(telegramCallbackRoute('aa:c:AAabcdef123456'), 'agent-approval');
  assert.equal(telegramCallbackRoute('tg:resolve:abcdef12345678'), 'other');
  for (const input of [
    'AA:c:AAabcdef123456', 'aa:C:AAabcdef123456', 'aa:c:aaabcdef123456',
    'aa:c:AAabcdef12345', 'aa:c:AAabcdef1234567', 'aa:x:AAabcdef123456',
    'aa:c:AAabcdef123456:extra', ' aa:c:AAabcdef123456 ',
  ]) assert.equal(parseAgentApprovalCallback(input), null, input);
});

test('lokalizację może wskazać dozwolony operator, ale finalna decyzja wymaga roli zatwierdzającego', () => {
  const config = { approverUserIds: new Set(['100']) };
  assert.equal(telegramInventoryDecisionAllowed({ action: 'location' }, config, { userId: '300' }), true);
  assert.equal(telegramInventoryDecisionAllowed({ action: 'confirm' }, config, { userId: '300' }), false);
  assert.equal(telegramInventoryDecisionAllowed({ action: 'reject' }, config, { userId: '300' }), false);
  assert.equal(telegramInventoryDecisionAllowed({ action: 'confirm' }, config, { userId: '100' }), true);
  assert.equal(telegramInventoryDecisionAllowed({ action: 'reject' }, config, { userId: '100' }), true);
  assert.equal(telegramInventoryDecisionAllowed({ action: 'unknown' }, config, { userId: '100' }), false);
});

test('webhook przekazuje callback aa do kolejki Agenta i potwierdza kliknięcie w Telegram', { concurrency: false }, async (t) => {
  const previousFetch = globalThis.fetch;
  const envNames = ['TELEGRAM_WEBHOOK_SECRET', 'TELEGRAM_BOT_TOKEN', 'ARTWAY_ADMIN_TOKEN', 'TELEGRAM_CHAT_ID', 'TELEGRAM_GROUP_ID', 'TELEGRAM_ALLOWED_USER_IDS', 'TELEGRAM_APPROVER_USER_IDS'];
  const previousEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  t.after(() => {
    globalThis.fetch = previousFetch;
    for (const name of envNames) {
      if (previousEnv[name] === undefined) delete process.env[name];
      else process.env[name] = previousEnv[name];
    }
  });
  Object.assign(process.env, {
    TELEGRAM_WEBHOOK_SECRET: 'webhook-test-secret', TELEGRAM_BOT_TOKEN: 'bot-test-token',
    ARTWAY_ADMIN_TOKEN: 'admin-test-token', TELEGRAM_CHAT_ID: '100', TELEGRAM_GROUP_ID: '-200',
    TELEGRAM_ALLOWED_USER_IDS: '', TELEGRAM_APPROVER_USER_IDS: '',
  });
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url), body = options.body ? JSON.parse(options.body) : null;
    calls.push({ href, body });
    if (href.includes('/api/store?action=telegram-inbound-command')) {
      return new Response(JSON.stringify({ ok: true, deferred: true, status: 'queued', jobId: 'CX-approval' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: true, result: href.includes('/sendMessage') ? { message_id: 1 } : true }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
  const request = new Request('https://artwaytm.pl/.netlify/functions/telegram-webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'webhook-test-secret' },
    body: JSON.stringify({
      update_id: 9001,
      callback_query: {
        id: 'callback-1', from: { id: 100, first_name: 'Admin' }, data: 'aa:c:AAabcdef123456',
        message: { message_id: 77, message_thread_id: 9, text: 'Zmiana magazynowa oczekuje na decyzję', chat: { id: -200, type: 'supergroup' } },
      },
    }),
  });
  const result = await telegramWebhook(request);
  assert.equal(result.status, 200);
  const queued = calls.find((call) => call.href.includes('/api/store?action=telegram-inbound-command'));
  assert.ok(queued);
  assert.equal(queued.body.text, 'aa:c:AAabcdef123456');
  assert.equal(queued.body.deferToCodex, true);
  assert.equal(queued.body.kind, 'callback');
  assert.equal(queued.body.userId, '100');
  assert.equal(queued.body.context, 'Zmiana magazynowa oczekuje na decyzję');
  const answer = calls.find((call) => call.href.includes('/answerCallbackQuery'));
  assert.equal(answer.body.callback_query_id, 'callback-1');
  assert.match(answer.body.text, /Zatwierdzenie przekazane/);
  assert.equal(calls.some((call) => call.href.includes('/editMessageReplyMarkup')), false, 'enqueue nie usuwa przycisków przed wykonaniem zadania');
});

test('callback aa bez wiarygodnego zatwierdzającego nigdy nie trafia do kolejki ani zwykłego promptu', { concurrency: false }, async (t) => {
  const previousFetch = globalThis.fetch;
  const envNames = ['TELEGRAM_WEBHOOK_SECRET', 'TELEGRAM_BOT_TOKEN', 'ARTWAY_ADMIN_TOKEN', 'TELEGRAM_CHAT_ID', 'TELEGRAM_GROUP_ID', 'TELEGRAM_ALLOWED_USER_IDS', 'TELEGRAM_APPROVER_USER_IDS'];
  const previousEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  t.after(() => {
    globalThis.fetch = previousFetch;
    for (const name of envNames) {
      if (previousEnv[name] === undefined) delete process.env[name];
      else process.env[name] = previousEnv[name];
    }
  });
  Object.assign(process.env, {
    TELEGRAM_WEBHOOK_SECRET: 'webhook-deny-secret', TELEGRAM_BOT_TOKEN: 'bot-test-token',
    ARTWAY_ADMIN_TOKEN: 'admin-test-token', TELEGRAM_CHAT_ID: '100', TELEGRAM_GROUP_ID: '-200',
    TELEGRAM_ALLOWED_USER_IDS: '300', TELEGRAM_APPROVER_USER_IDS: '',
  });
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url), body = options.body ? JSON.parse(options.body) : null;
    calls.push({ href, body });
    return new Response(JSON.stringify({ ok: true, result: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const invoke = (from, callbackId, updateId) => telegramWebhook(new Request('https://artwaytm.pl/.netlify/functions/telegram-webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'webhook-deny-secret' },
    body: JSON.stringify({
      update_id: updateId,
      callback_query: {
        id: callbackId, from, data: 'aa:c:AAabcdef123456',
        message: { message_id: 77, text: 'Oczekuje na decyzję', chat: { id: -200, type: 'supergroup' } },
      },
    }),
  }));

  await invoke({ id: 300, first_name: 'Operator' }, 'callback-non-owner', 9101);
  await invoke({}, 'callback-no-actor', 9102);

  assert.equal(calls.some((call) => call.href.includes('action=telegram-inbound-command')), false);
  assert.equal(calls.some((call) => call.body?.text === 'aa:c:AAabcdef123456'), false);
  const answers = calls.filter((call) => call.href.includes('/answerCallbackQuery'));
  assert.equal(answers.length, 2);
  assert.match(answers[0].body.text, /administrator zatwierdzający/);
  assert.match(answers[1].body.text, /Nie masz uprawnień/);
  assert.equal(calls.some((call) => call.href.includes('/editMessageReplyMarkup')), false, 'odrzucony callback zachowuje przyciski');
  assert.equal(calls.filter((call) => call.href.includes('action=telegram-inbound-audit')).length, 1, 'brak aktora jest tylko audytowany');
});
