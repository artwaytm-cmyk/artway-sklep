import test from 'node:test';
import assert from 'node:assert/strict';
import { createCodexAgentQueue, sanitizeCodexInboundKind, sanitizeCodexReplyMarkup } from '../netlify/functions/lib/domain/codex-agent-queue.mjs';

function repository() {
  let value = { items: [], updatedAt: null }, etag = 'v1', writes = 0;
  return {
    readVersioned: async () => ({ value: structuredClone(value), etag, exists: true }),
    writeIfVersion: async (_key, next, version) => {
      if (version.etag !== etag) return { modified: false };
      value = structuredClone(next);
      etag = `v${Number(etag.slice(1)) + 1}`;
      writes += 1;
      return { modified: true };
    },
    read: () => structuredClone(value),
    writeCount: () => writes,
  };
}

test('kolejka deduplikuje update, wydaje lease i czyści treść po dostarczeniu', async () => {
  const repo = repository();
  let time = new Date('2026-07-15T12:00:00.000Z');
  const queue = createCodexAgentQueue({
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
    now: () => new Date(time),
    token: () => 'claim-secret',
  });
  await queue.claim('mac-artway');
  const input = {
    requestId: 'update-100', text: '', chatId: '123', replyTo: 55, user: 'Artway', userId: '700',
    kind: 'voice',
    context: `Poprzednia wiadomość\u0000\n${'x'.repeat(1800)}`,
    media: { kind: 'voice', fileId: 'telegram-file-1', mimeType: 'audio/ogg', fileName: '' },
  };
  const first = await queue.enqueue(input);
  const duplicate = await queue.enqueue(input);
  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(repo.read().items.length, 1);

  const claimed = await queue.claim('mac-artway');
  assert.match(claimed.job.text, /wiadomość głosowa/i);
  assert.equal(claimed.job.claimToken, 'claim-secret');
  assert.equal(claimed.job.userId, '700');
  assert.equal(claimed.job.kind, 'voice');
  assert.equal(claimed.job.context.length, 1600);
  assert.equal(claimed.job.context.includes('\u0000'), false);
  assert.deepEqual(claimed.job.media, input.media);
  const prepared = await queue.prepareDelivery({ id: claimed.job.id, claimToken: claimed.job.claimToken, response: 'Gotowe.' });
  assert.equal(prepared.job.response, 'Gotowe.');
  const delivered = await queue.markDelivered({ id: claimed.job.id, claimToken: claimed.job.claimToken, telegramMessageId: '999' });
  assert.equal(delivered.delivered, true);
  assert.equal(repo.read().items[0].status, 'completed');
  assert.equal(repo.read().items[0].text, '');
  assert.equal(repo.read().items[0].response, '');
  assert.equal(repo.read().items[0].context, '');
  assert.equal(repo.read().items[0].media, null);
  const completedDuplicate = await queue.enqueue(input);
  assert.equal(completedDuplicate.duplicate, true);
  assert.equal(completedDuplicate.status, 'completed');
  assert.equal((await queue.claim('mac-artway')).job, null);
});

test('status kolejki pokazuje jednego aktywnego workera bez ujawniania jego identyfikatora', async () => {
  const repo = repository();
  let time = new Date('2026-07-17T12:00:00.000Z');
  const queue = createCodexAgentQueue({
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
    now: () => new Date(time),
  });
  await queue.claim('sekretny-worker-vps');
  const online = await queue.status();
  assert.equal(online.workerOnline, true);
  assert.equal(online.active, 0);
  assert.equal(Object.hasOwn(online, 'workerId'), false);
  time = new Date(time.getTime() + 76_000);
  assert.equal((await queue.status()).workerOnline, false);
});

test('kind wejścia jest zamknięty, a literalny tekst AA pozostaje zwykłą wiadomością', async () => {
  assert.equal(sanitizeCodexInboundKind('callback'), 'callback');
  assert.equal(sanitizeCodexInboundKind(' CALLBACK '), 'callback');
  assert.equal(sanitizeCodexInboundKind('callback<script>'), 'text');
  assert.equal(sanitizeCodexInboundKind('callback', 'panel'), 'panel');
  const repo = repository();
  const queue = createCodexAgentQueue({ readVersioned: repo.readVersioned, writeIfVersion: repo.writeIfVersion, token: () => 'kind-claim' });
  await queue.claim('worker');
  await queue.enqueue({ requestId: 'literal-aa', text: 'aa:c:AAabcdef123456', chatId: '123', kind: 'text' });
  const claimed = (await queue.claim('worker')).job;
  assert.equal(claimed.text, 'aa:c:AAabcdef123456');
  assert.equal(claimed.kind, 'text');
});

test('replyMarkup Agenta przepuszcza wyłącznie ograniczone przyciski decyzji i jest jednorazowy', async () => {
  const repo = repository();
  const queue = createCodexAgentQueue({
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
    now: () => new Date('2026-07-15T12:00:00.000Z'),
    token: () => 'approval-claim',
  });
  const sanitized = sanitizeCodexReplyMarkup({
    inline_keyboard: [[
      { text: `✅ Zatwierdź\u0000${'x'.repeat(100)}`, callback_data: 'aa:c:AAabcdef123456', url: 'https://evil.example' },
      { text: '❌ Odrzuć', callback_data: 'aa:r:AAabcdef123456' },
      { text: 'Incydent', callback_data: 'tg:resolve:abcdef12345678' },
      { text: 'Link', url: 'https://example.test' },
    ]],
    resize_keyboard: true,
  });
  assert.equal(sanitized.inline_keyboard[0].length, 2);
  assert.equal([...sanitized.inline_keyboard[0][0].text].length, 64);
  assert.equal(sanitized.inline_keyboard[0][0].text.includes('\u0000'), false);
  assert.deepEqual(sanitized.inline_keyboard[0][0], {
    text: sanitized.inline_keyboard[0][0].text,
    callback_data: 'aa:c:AAabcdef123456',
  });
  assert.deepEqual(sanitized.inline_keyboard[0][1], { text: '❌ Odrzuć', callback_data: 'aa:r:AAabcdef123456' });
  assert.equal(sanitizeCodexReplyMarkup({ inline_keyboard: [[{ text: 'Za szeroko', callback_data: `aa:c:AA${'a'.repeat(60)}` }]] }), null);
  assert.equal(sanitizeCodexReplyMarkup({ keyboard: [[{ text: 'Zwykła klawiatura' }]] }), null);

  await queue.claim('worker');
  await queue.enqueue({ requestId: 'approval-1', text: 'przygotuj decyzję', chatId: '123' });
  const claimed = (await queue.claim('worker')).job;
  const prepared = await queue.prepareDelivery({
    id: claimed.id, claimToken: claimed.claimToken, response: 'Czy zatwierdzasz?',
    replyMarkup: { inline_keyboard: [[
      { text: '✅ Tak', callback_data: 'aa:c:AAabcdef123456' },
      { text: '❌ Nie', callback_data: 'javascript:alert(1)' },
    ]] },
  });
  assert.deepEqual(prepared.job.replyMarkup, { inline_keyboard: [[{ text: '✅ Tak', callback_data: 'aa:c:AAabcdef123456' }]] });
  assert.deepEqual(repo.read().items[0].replyMarkup, prepared.job.replyMarkup);
  await queue.markDelivered({ id: claimed.id, claimToken: claimed.claimToken, telegramMessageId: '501' });
  assert.equal(repo.read().items[0].replyMarkup, null);
});

test('replyMarkup jest czyszczony także przy retry po błędzie dostawy', async () => {
  const repo = repository();
  const queue = createCodexAgentQueue({ readVersioned: repo.readVersioned, writeIfVersion: repo.writeIfVersion, token: () => 'retry-claim' });
  await queue.claim('worker');
  await queue.enqueue({ requestId: 'approval-retry', text: 'przygotuj zmianę', chatId: '123' });
  const claimed = (await queue.claim('worker')).job;
  await queue.prepareDelivery({
    id: claimed.id, claimToken: claimed.claimToken, response: 'Potwierdź',
    replyMarkup: { inline_keyboard: [[{ text: 'Tak', callback_data: 'iv:c:IVaaaaaaaaaaaaaa' }]] },
  });
  const failed = await queue.fail({ id: claimed.id, claimToken: claimed.claimToken, error: 'Telegram odrzucił żądanie', deliveryFailed: true });
  assert.equal(failed.retry, true);
  assert.equal(repo.read().items[0].status, 'queued');
  assert.equal(repo.read().items[0].replyMarkup, null);
});

test('wygasły lease może przejąć nowy worker, a błędny token nie kończy zadania', async () => {
  const repo = repository();
  let time = new Date('2026-07-15T12:00:00.000Z'), tokenNo = 0;
  const queue = createCodexAgentQueue({
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
    now: () => new Date(time),
    token: () => `claim-${++tokenNo}`,
  });
  await queue.claim('worker-a');
  await queue.enqueue({ requestId: 'update-101', text: 'sprawdź nowe zlecenia', chatId: '123' });
  const first = await queue.claim('worker-a');
  time = new Date(time.getTime() + 91_000);
  const second = await queue.claim('worker-b');
  assert.notEqual(second.job.claimToken, first.job.claimToken);
  await assert.rejects(
    queue.prepareDelivery({ id: second.job.id, claimToken: first.job.claimToken, response: 'stara odpowiedź' }),
    /Wygasło prawo/,
  );
  const failure = await queue.fail({ id: second.job.id, claimToken: second.job.claimToken, error: 'chwilowy błąd' });
  assert.equal(failure.retry, true);
  assert.equal(repo.read().items[0].status, 'queued');
});

test('panel może odebrać odpowiedź bez czatu Telegram', async () => {
  const repo = repository();
  const queue = createCodexAgentQueue({
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
    now: () => new Date('2026-07-15T12:00:00.000Z'),
    token: () => 'panel-claim',
  });
  const added = await queue.enqueue({ requestId: 'panel-1', text: 'wyjaśnij, co wymaga obsługi', channel: 'panel', user: 'admin' });
  const claimed = await queue.claim('mac-artway');
  assert.equal(claimed.job.channel, 'panel');
  assert.equal(claimed.job.chatId, '');
  await queue.prepareDelivery({ id: claimed.job.id, claimToken: claimed.job.claimToken, response: 'Dwie sprawy wymagają obsługi.' });
  await queue.markDelivered({ id: claimed.job.id, claimToken: claimed.job.claimToken, keepResponse: true });
  const result = await queue.result(added.job.id);
  assert.equal(result.status, 'completed');
  assert.equal(result.response, 'Dwie sprawy wymagają obsługi.');
  assert.equal(repo.read().items[0].text, '');
});

test('kolejka obsługuje najstarsze zadanie jako pierwsze', async () => {
  const repo = repository();
  const queue = createCodexAgentQueue({ readVersioned: repo.readVersioned, writeIfVersion: repo.writeIfVersion, token: () => 'fifo-token' });
  await queue.claim('worker');
  const first = await queue.enqueue({ requestId: 'fifo-1', text: 'pierwsze', chatId: '123' });
  await queue.enqueue({ requestId: 'fifo-2', text: 'drugie', chatId: '123' });
  const claimed = await queue.claim('worker');
  assert.equal(claimed.job.id, first.job.id);
  assert.equal(claimed.job.text, 'pierwsze');
});

test('niepewna dostawa wygasa bez ponownej wysyłki i czyści treść', async () => {
  const repo = repository();
  let time = new Date('2026-07-15T12:00:00.000Z');
  const queue = createCodexAgentQueue({
    readVersioned: repo.readVersioned, writeIfVersion: repo.writeIfVersion,
    now: () => new Date(time), token: () => 'delivery-token',
  });
  await queue.claim('worker');
  await queue.enqueue({ requestId: 'delivery-1', text: 'wiadomość prywatna', chatId: '123' });
  const claimed = await queue.claim('worker');
  await queue.prepareDelivery({ id: claimed.job.id, claimToken: claimed.job.claimToken, response: 'odpowiedź' });
  time = new Date(time.getTime() + 91_000);
  const recovered = await queue.claim('worker');
  assert.equal(recovered.recoveredDelivery, true);
  assert.equal(recovered.job, null);
  assert.equal(repo.read().items[0].status, 'failed');
  assert.equal(repo.read().items[0].text, '');
  assert.equal(repo.read().items[0].response, '');
  assert.equal(recovered.failureNotificationPending, true);
  const notification = await queue.claimFailureNotification();
  assert.equal(notification.notification.chatId, '123');
  assert.equal(notification.notification.attempts, 1);
});

test('heartbeat przedłuża lease i blokuje równoległe przejęcie zadania', async () => {
  const repo = repository();
  let time = new Date('2026-07-15T12:00:00.000Z');
  const queue = createCodexAgentQueue({
    readVersioned: repo.readVersioned, writeIfVersion: repo.writeIfVersion,
    now: () => new Date(time), token: () => 'heartbeat-token',
  });
  await queue.claim('worker-a');
  await queue.enqueue({ requestId: 'heartbeat-1', text: 'dłuższa kontrola', chatId: '123' });
  const claimed = await queue.claim('worker-a');
  time = new Date(time.getTime() + 80_000);
  const beat = await queue.heartbeat({ id: claimed.job.id, claimToken: claimed.job.claimToken });
  assert.equal(beat.extended, true);
  time = new Date(time.getTime() + 20_000);
  assert.equal((await queue.claim('worker-b')).job, null);
});

test('zadanie panelu wygasa bez późniejszego cichego wykonania', async () => {
  const repo = repository();
  let time = new Date('2026-07-15T12:00:00.000Z');
  const queue = createCodexAgentQueue({
    readVersioned: repo.readVersioned, writeIfVersion: repo.writeIfVersion,
    now: () => new Date(time), token: () => 'panel-expiry-token',
  });
  const added = await queue.enqueue({ requestId: 'panel-expiry', text: 'wykonaj później', channel: 'panel', user: 'admin' });
  time = new Date(time.getTime() + 46_000);
  const result = await queue.result(added.job.id);
  assert.equal(result.status, 'failed');
  assert.match(result.error, /wygasło/i);
  const claim = await queue.claim('worker');
  assert.equal(claim.job, null);
  assert.equal(claim.expiredPanel, true);
  assert.equal(repo.read().items[0].status, 'failed');
  assert.equal(repo.read().items[0].text, '');
});

test('jeden claim czyści cały backlog 50 wygasłych paneli i od razu bierze najstarszy Telegram', async () => {
  const repo = repository();
  let time = new Date('2026-07-15T12:00:00.000Z'), tokenNo = 0;
  const queue = createCodexAgentQueue({
    readVersioned: repo.readVersioned, writeIfVersion: repo.writeIfVersion,
    now: () => new Date(time), token: () => `backlog-${++tokenNo}`,
  });
  await queue.claim('worker');
  for (let index = 0; index < 50; index += 1) {
    await queue.enqueue({ requestId: `panel-old-${index}`, text: `panel ${index}`, channel: 'panel', user: 'admin' });
  }
  const telegram = await queue.enqueue({ requestId: 'telegram-ready', text: 'ważna wiadomość', chatId: '123' });
  time = new Date(time.getTime() + 46_000);
  const writesBefore = repo.writeCount();
  const claimed = await queue.claim('worker');
  assert.equal(claimed.job.id, telegram.job.id);
  assert.equal(claimed.expiredPanelCount, 50);
  assert.equal(claimed.recoveredDeliveryCount, 0);
  assert.equal(repo.writeCount(), writesBefore + 1, 'sprzątanie i claim muszą być jednym CAS');
  assert.equal(repo.read().items.filter((item) => item.channel === 'panel' && item.status === 'failed').length, 50);
});

test('poll workera jest trwały, ale pusty claim zapisuje obecność najwyżej raz na minutę', async () => {
  const repo = repository();
  let time = new Date('2026-07-15T12:00:00.000Z');
  const queue = createCodexAgentQueue({ readVersioned: repo.readVersioned, writeIfVersion: repo.writeIfVersion, now: () => new Date(time) });
  const first = await queue.claim('worker-live');
  assert.equal(first.workerOnline, true);
  assert.equal(repo.read().lastWorkerId, 'worker-live');
  const writes = repo.writeCount();
  time = new Date(time.getTime() + 3_000);
  await queue.claim('worker-live');
  assert.equal(repo.writeCount(), writes);
  time = new Date(time.getTime() + 58_000);
  await queue.claim('worker-live');
  assert.equal(repo.writeCount(), writes + 1);
});

test('enqueue raportuje obecność workera, a offline nie zostawia zadania do późniejszej wysyłki', async () => {
  const repo = repository();
  let time = new Date('2026-07-15T12:00:00.000Z');
  const queue = createCodexAgentQueue({ readVersioned: repo.readVersioned, writeIfVersion: repo.writeIfVersion, now: () => new Date(time) });
  await queue.claim('worker-live');
  const online = await queue.enqueue({ requestId: 'online-1', text: 'pierwsza', chatId: '123' });
  assert.equal(online.workerOnline, true);
  assert.equal(online.status, 'queued');
  time = new Date(time.getTime() + 76_000);
  const offline = await queue.enqueue({ requestId: 'offline-1', text: 'druga', chatId: '123' });
  assert.equal(offline.workerOnline, false);
  assert.equal(offline.status, 'failed');
  const stored = repo.read().items.find((item) => item.requestId === 'offline-1');
  assert.equal(stored.text, '');
  assert.equal(stored.status, 'failed');
});

test('Telegram nie wykonuje po godzinach zadania przyjętego tuż przed awarią workera', async () => {
  const repo = repository();
  let time = new Date('2026-07-15T12:00:00.000Z');
  const queue = createCodexAgentQueue({
    readVersioned: repo.readVersioned, writeIfVersion: repo.writeIfVersion,
    now: () => new Date(time), token: () => 'restart-token',
  });
  await queue.claim('worker-before-crash');
  time = new Date(time.getTime() + 10_000);
  const queued = await queue.enqueue({ requestId: 'telegram-before-crash', text: 'wykonaj zmianę magazynową', chatId: '123' });
  assert.equal(queued.workerOnline, true);
  assert.equal(queued.status, 'queued');

  time = new Date(time.getTime() + 60 * 60 * 1_000);
  const afterRestart = await queue.claim('worker-after-restart');
  assert.equal(afterRestart.job, null);
  assert.equal(afterRestart.expiredTelegram, true);
  assert.equal(afterRestart.expiredTelegramCount, 1);
  const stored = repo.read().items.find((item) => item.requestId === 'telegram-before-crash');
  assert.equal(stored.status, 'failed');
  assert.equal(stored.failureKind, 'telegram_expired');
  assert.equal(stored.text, '');
  assert.match(stored.lastError, /Telegram.*wygasło/i);
  assert.equal(afterRestart.failureNotificationPending, true);
  const notification = await queue.claimFailureNotification();
  assert.equal(notification.notification.chatId, '123');
  assert.equal(notification.notification.attempts, 1);
  assert.equal(JSON.stringify(stored.failureNotification).includes('wykonaj zmianę magazynową'), false);
});

test('terminalny fail Telegram zapisuje trwały outbox bez treści polecenia i ack nie dubluje', async () => {
  const repo = repository();
  const queue = createCodexAgentQueue({ readVersioned: repo.readVersioned, writeIfVersion: repo.writeIfVersion, token: () => 'terminal-token' });
  await queue.claim('worker');
  await queue.enqueue({
    requestId: 'terminal-1', text: 'trudne zadanie', chatId: '123', replyTo: 77, messageThreadId: 9,
    context: 'poufny kontekst odpowiedzi', media: { kind: 'audio', fileId: 'secret-file', mimeType: 'audio/mpeg', fileName: 'zadanie.mp3' },
  });
  const claimed = await queue.claim('worker');
  const first = await queue.fail({ id: claimed.job.id, claimToken: claimed.job.claimToken, error: 'koniec', expired: true });
  assert.equal(first.terminal, true);
  assert.equal(first.notificationPending, true);
  assert.equal(repo.read().items[0].text, '');
  assert.equal(repo.read().items[0].context, '');
  assert.equal(repo.read().items[0].media, null);
  assert.equal(JSON.stringify(repo.read().items[0].failureNotification).includes('trudne zadanie'), false);
  const repeated = await queue.fail({ id: claimed.job.id, claimToken: claimed.job.claimToken, error: 'ponowienie', expired: true });
  assert.equal(repeated.duplicate, true);
  assert.equal(repeated.notificationPending, undefined);

  const leased = await queue.claimFailureNotification();
  assert.deepEqual(leased.notification, {
    id: claimed.job.id, claimToken: 'terminal-token', chatId: '123', replyTo: 77, messageThreadId: 9, attempts: 1,
  });
  const ack = await queue.ackFailureNotification({ id: claimed.job.id, claimToken: 'terminal-token', telegramMessageId: 10 });
  assert.equal(ack.delivered, true);
  assert.equal((await queue.claimFailureNotification()).notification, null);
  assert.equal(repo.read().items[0].failureNotification.status, 'sent');
  assert.equal(repo.read().items[0].failureNotification.chatId, '');
});

test('outbox terminalnego alertu kończy ponawianie po trzech nieudanych próbach', async () => {
  const repo = repository();
  let tokenNo = 0, time = new Date('2026-07-15T12:00:00.000Z');
  const queue = createCodexAgentQueue({
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
    now: () => new Date(time),
    token: () => `notification-${++tokenNo}`,
  });
  await queue.claim('worker');
  await queue.enqueue({ requestId: 'terminal-max', text: 'polecenie', chatId: '123', replyTo: 77 });
  const job = (await queue.claim('worker')).job;
  await queue.fail({ id: job.id, claimToken: job.claimToken, error: 'koniec', expired: true });
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const leased = await queue.claimFailureNotification();
    assert.equal(leased.notification.attempts, attempt);
    const retried = await queue.retryFailureNotification({
      id: leased.notification.id,
      claimToken: leased.notification.claimToken,
      error: 'chwilowy błąd Telegram',
    });
    assert.equal(retried.retry, attempt < 3);
    assert.equal(retried.exhausted, attempt === 3);
    if (attempt === 1) time = new Date(time.getTime() + 10_000);
    if (attempt === 2) time = new Date(time.getTime() + 60_000);
  }
  assert.equal((await queue.claimFailureNotification()).notification, null);
  assert.equal(repo.read().items[0].failureNotification.status, 'exhausted');
  assert.equal(repo.read().items[0].failureNotification.chatId, '');
});

test('terminalny fail ze stanu delivering również tworzy alert bez odpowiedzi i polecenia', async () => {
  const repo = repository();
  const queue = createCodexAgentQueue({
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
    now: () => new Date('2026-07-15T12:00:00.000Z'),
    token: () => 'delivery-fail-token',
  });
  await queue.claim('worker');
  await queue.enqueue({ requestId: 'delivery-fail', text: 'poufne polecenie', chatId: '123', replyTo: 88 });
  const job = (await queue.claim('worker')).job;
  await queue.prepareDelivery({ id: job.id, claimToken: job.claimToken, response: 'poufna odpowiedź' });
  const failed = await queue.fail({ id: job.id, claimToken: job.claimToken, error: 'błąd wysyłki' });
  assert.equal(failed.terminal, true);
  assert.equal(failed.notificationPending, true);
  const stored = repo.read().items[0];
  assert.equal(stored.status, 'failed');
  assert.equal(stored.failureNotification.status, 'pending');
  assert.equal(stored.text, '');
  assert.equal(stored.response, '');
  assert.equal(JSON.stringify(stored.failureNotification).includes('poufne'), false);
});
