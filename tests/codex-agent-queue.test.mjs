import test from 'node:test';
import assert from 'node:assert/strict';
import { createCodexAgentQueue } from '../src/backend/lib/domain/codex-agent-queue.mjs';

function repository(initial = { items: [], updatedAt: null }) {
  let value = structuredClone(initial), etag = 'v1', writes = 0;
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

test('kolejka przyjmuje wyłącznie polecenia panelu, deduplikuje je i zapisuje wynik', async () => {
  const repo = repository();
  const queue = createCodexAgentQueue({
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
    now: () => new Date('2026-07-28T08:00:00.000Z'),
    token: () => 'panel-claim',
  });
  const input = { requestId: 'panel-100', text: 'sprawdź jakość strony', channel: 'panel', user: 'admin' };
  const first = await queue.enqueue(input);
  const duplicate = await queue.enqueue(input);
  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(first.job.channel, 'panel');
  assert.equal(repo.read().items.length, 1);

  const claimed = await queue.claim('worker-vps');
  assert.equal(claimed.job.text, input.text);
  assert.equal(claimed.job.claimToken, 'panel-claim');
  await queue.prepareDelivery({
    id: claimed.job.id,
    claimToken: claimed.job.claimToken,
    response: 'Kontrola zakończona. Nie znaleziono błędów krytycznych.',
  });
  await queue.markDelivered({ id: claimed.job.id, claimToken: claimed.job.claimToken });
  const result = await queue.result(first.job.id);
  assert.equal(result.status, 'completed');
  assert.match(result.response, /Kontrola zakończona/);
  assert.equal(repo.read().items[0].text, '');
  assert.equal(repo.read().items[0].context, '');
});

test('historyczne zadania spoza panelu są usuwane podczas migracji kolejki', async () => {
  const repo = repository({
    items: [
      { id: 'old-external', requestId: 'old-external', channel: 'external', status: 'queued', text: 'stare polecenie' },
      { id: 'panel-ok', requestId: 'panel-ok', channel: 'panel', status: 'queued', text: 'kontrola strony', createdAt: '2026-07-28T08:00:00.000Z' },
    ],
    updatedAt: '2026-07-28T08:00:00.000Z',
  });
  const queue = createCodexAgentQueue({
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
    now: () => new Date('2026-07-28T08:01:00.000Z'),
    token: () => 'migration-claim',
  });
  const claimed = await queue.claim('worker-vps');
  assert.equal(claimed.job.id, 'panel-ok');
  assert.equal(repo.read().items.some((item) => item.id === 'old-external'), false);
});

test('ponowiony claim tego samego procesu zwraca ten sam lease', async () => {
  const repo = repository();
  let issued = 0;
  const queue = createCodexAgentQueue({
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
    now: () => new Date('2026-07-28T09:00:00.000Z'),
    token: () => `claim-${++issued}`,
  });
  await queue.enqueue({ requestId: 'lost-http-response', text: 'sprawdź katalog' });
  const first = await queue.claim('worker-vps');
  const retry = await queue.claim('worker-vps');
  assert.equal(first.job.id, retry.job.id);
  assert.equal(first.job.claimToken, retry.job.claimToken);
  assert.equal(issued, 1);
});

test('heartbeat przedłuża pracę, a wygasły lease może przejąć nowy proces', async () => {
  const repo = repository();
  let time = new Date('2026-07-28T10:00:00.000Z'), tokenNo = 0;
  const queue = createCodexAgentQueue({
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
    now: () => new Date(time),
    token: () => `claim-${++tokenNo}`,
  });
  await queue.enqueue({ requestId: 'lease-1', text: 'sprawdź diagnostykę' });
  const first = await queue.claim('worker-a');
  time = new Date(time.getTime() + 60_000);
  assert.equal((await queue.heartbeat({ id: first.job.id, claimToken: first.job.claimToken })).extended, true);
  time = new Date(time.getTime() + 121_000);
  const second = await queue.claim('worker-b');
  assert.notEqual(second.job.claimToken, first.job.claimToken);
  await assert.rejects(
    queue.prepareDelivery({ id: second.job.id, claimToken: first.job.claimToken, response: 'stary wynik' }),
    /Wygasło prawo/,
  );
});

test('błąd jest ponawiany najwyżej trzy razy i nie tworzy fałszywego sukcesu', async () => {
  const repo = repository();
  let time = new Date('2026-07-28T11:00:00.000Z'), tokenNo = 0;
  const queue = createCodexAgentQueue({
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
    now: () => new Date(time),
    token: () => `retry-${++tokenNo}`,
  });
  await queue.enqueue({ requestId: 'retry-1', text: 'wykonaj kontrolę strony' });
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const claimed = await queue.claim('worker-vps');
    const failed = await queue.fail({ id: claimed.job.id, claimToken: claimed.job.claimToken, error: 'kontrola nie zakończyła się' });
    assert.equal(failed.retry, attempt < 3);
    time = new Date(time.getTime() + 61_000);
  }
  const stored = repo.read().items[0];
  assert.equal(stored.status, 'failed');
  assert.equal(stored.text, '');
  assert.equal((await queue.result(stored.id)).status, 'failed');
});

test('status pokazuje obecność procesu bez ujawniania jego identyfikatora', async () => {
  const repo = repository();
  let time = new Date('2026-07-28T12:00:00.000Z');
  const queue = createCodexAgentQueue({
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
    now: () => new Date(time),
  });
  await queue.claim('sekretny-worker-vps');
  const online = await queue.status();
  assert.equal(online.workerOnline, true);
  assert.equal(Object.hasOwn(online, 'workerId'), false);
  time = new Date(time.getTime() + 76_000);
  assert.equal((await queue.status()).workerOnline, false);
});
