import assert from 'node:assert/strict';
import test from 'node:test';
import { createAgentEventQueue } from '../src/backend/lib/domain/agent-event-queue.mjs';

function repository() {
  let value = null;
  let version = 0;
  return {
    readVersioned: async (_key, fallback) => ({
      value: value === null ? structuredClone(fallback) : structuredClone(value),
      etag: value === null ? '' : `"${version}"`,
      exists: value !== null,
    }),
    writeIfVersion: async (_key, next, current) => {
      const expected = current.exists === false ? 0 : Number(String(current.etag).replace(/\D/g, ''));
      if (expected !== version) return { modified: false };
      value = structuredClone(next);
      version += 1;
      return { modified: true };
    },
  };
}

test('zdarzenie uruchamia wyłącznie przypisany moduł i zostaje trwale rozliczone', async () => {
  const store = repository();
  const queue = createAgentEventQueue(store);
  const calls = [];
  queue.register('product.review', async (event) => {
    calls.push(event.entityId);
    return { message: 'zapisano', savedFields: ['opis'] };
  });
  await queue.enqueue({
    type: 'product.review',
    area: 'products',
    entityId: 'P-1',
    dedupeKey: 'product.review:P-1',
    payload: { productId: 'P-1' },
  });
  await queue.kick();
  const status = await queue.status();
  assert.deepEqual(calls, ['P-1']);
  assert.equal(status.scheduledCycles, false);
  assert.equal(status.active, 0);
  assert.equal(status.counts.completed, 1);
});

test('identyczny aktywny sygnał nie tworzy dwóch prac', async () => {
  const store = repository();
  const queue = createAgentEventQueue(store);
  let release;
  const wait = new Promise((resolve) => { release = resolve; });
  queue.register('order.store.received', async () => {
    await wait;
    return { message: 'obsłużono' };
  });
  const first = await queue.enqueue({
    type: 'order.store.received',
    area: 'orders',
    entityId: 'ATM-1',
    dedupeKey: 'order.store.received:ATM-1',
  });
  const second = await queue.enqueue({
    type: 'order.store.received',
    area: 'orders',
    entityId: 'ATM-1',
    dedupeKey: 'order.store.received:ATM-1',
  });
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  release();
  await queue.kick();
  const status = await queue.status();
  assert.equal(status.counts.completed, 1);
});

test('chwilowy błąd wykonawcy jest ponawiany w tej samej trwałej kolejce', async () => {
  const store = repository();
  const queue = createAgentEventQueue(store);
  let attempts = 0;
  queue.register('product.review', async () => {
    attempts += 1;
    if (attempts < 2) throw new Error('chwilowy konflikt zapisu');
    return { message: 'zapis potwierdzony' };
  });
  await queue.enqueue({
    type: 'product.review',
    area: 'products',
    entityId: 'P-2',
    dedupeKey: 'product.review:P-2',
  });
  await queue.kick();
  const status = await queue.status();
  assert.equal(attempts, 2);
  assert.equal(status.counts.completed, 1);
  assert.equal(status.counts.failed || 0, 0);
});
