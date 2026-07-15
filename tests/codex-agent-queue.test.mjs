import test from 'node:test';
import assert from 'node:assert/strict';
import { createCodexAgentQueue } from '../netlify/functions/lib/domain/codex-agent-queue.mjs';

function repository() {
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

test('kolejka deduplikuje update, wydaje lease i czyści treść po dostarczeniu', async () => {
  const repo = repository();
  let time = new Date('2026-07-15T12:00:00.000Z');
  const queue = createCodexAgentQueue({
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
    now: () => new Date(time),
    token: () => 'claim-secret',
  });
  const input = { requestId: 'update-100', text: 'co trzeba dziś zrobić?', chatId: '123', replyTo: 55, user: 'Artway' };
  const first = await queue.enqueue(input);
  const duplicate = await queue.enqueue(input);
  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(repo.read().items.length, 1);

  const claimed = await queue.claim('mac-artway');
  assert.equal(claimed.job.text, input.text);
  assert.equal(claimed.job.claimToken, 'claim-secret');
  const prepared = await queue.prepareDelivery({ id: claimed.job.id, claimToken: claimed.job.claimToken, response: 'Gotowe.' });
  assert.equal(prepared.job.response, 'Gotowe.');
  const delivered = await queue.markDelivered({ id: claimed.job.id, claimToken: claimed.job.claimToken, telegramMessageId: '999' });
  assert.equal(delivered.delivered, true);
  assert.equal(repo.read().items[0].status, 'completed');
  assert.equal(repo.read().items[0].text, '');
  assert.equal(repo.read().items[0].response, '');
  assert.equal((await queue.claim('mac-artway')).job, null);
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
});

test('heartbeat przedłuża lease i blokuje równoległe przejęcie zadania', async () => {
  const repo = repository();
  let time = new Date('2026-07-15T12:00:00.000Z');
  const queue = createCodexAgentQueue({
    readVersioned: repo.readVersioned, writeIfVersion: repo.writeIfVersion,
    now: () => new Date(time), token: () => 'heartbeat-token',
  });
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
