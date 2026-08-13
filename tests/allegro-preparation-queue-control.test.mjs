import test from 'node:test';
import assert from 'node:assert/strict';
import { publicAllegroPreparationState } from '../src/backend/lib/domain/allegro-preparation-queue-state.mjs';

test('publiczny stan kolejki rozróżnia trwałe wstrzymanie i anulowane zadania', () => {
  const state = publicAllegroPreparationState({
    blockedReason: 'admin_paused',
    pending: [{ id: 'p1', batchId: 'b1', productId: '1' }],
    results: [{ id: 'c1', batchId: 'b1', productId: '2', status: 'cancelled' }],
    batches: [{ id: 'b1', trackedTaskIds: ['p1', 'c1'] }],
  });
  assert.equal(state.paused, true);
  assert.equal(state.running, false);
  assert.equal(state.pending, 1);
  assert.equal(state.currentSummary.cancelled, 1);
  assert.equal(state.batches[0].pending, 1);
  assert.equal(state.batches[0].cancelled, 1);
});

test('publiczny stan pokazuje wszystkie równolegle wykonywane produkty i zgodny licznik partii', () => {
  const first = { id: 'a1', batchId: 'b1', productId: '101' };
  const state = publicAllegroPreparationState({
    active: first,
    activeItems: [
      first,
      { id: 'a2', batchId: 'b1', productId: '102' },
      { id: 'a3', batchId: 'b1', productId: '103' },
    ],
    pending: [{ id: 'p1', batchId: 'b1', productId: '104' }],
    batches: [{ id: 'b1', trackedTaskIds: ['a1', 'a2', 'a3', 'p1'] }],
  });
  assert.equal(state.running, true);
  assert.equal(state.active.productId, '101');
  assert.deepEqual(state.activeItems.map((item) => item.productId), ['101', '102', '103']);
  assert.equal(state.currentSummary.running, 3);
  assert.equal(state.batches[0].running, 3);
  assert.deepEqual(state.batches[0].activeProductIds, ['101', '102', '103']);
});

test('aktywna duża partia pozostaje widoczna przed nowszą historią małych zadań', () => {
  const historical = Array.from({ length: 25 }, (_, index) => ({
    id: `history-${index}`,
    trackedTaskIds: [`done-${index}`],
  }));
  const state = publicAllegroPreparationState({
    pending: [{ id: 'live-task', batchId: 'full-catalog', productId: '1169' }],
    results: historical.map((batch, index) => ({
      id: batch.trackedTaskIds[0], batchId: batch.id, productId: `done-product-${index}`, status: 'completed',
    })),
    batches: [...historical, { id: 'full-catalog', trackedTaskIds: ['live-task'] }],
  });
  assert.equal(state.batches[0].id, 'full-catalog');
  assert.equal(state.batches[0].pending, 1);
  assert.equal(state.batches.length, 20);
});

test('lekki odczyt kolejki nie wysyła do panelu setek zakończonych kartotek', () => {
  const completed = Array.from({ length: 300 }, (_, index) => ({
    id: `done-${index}`, productId: `product-${index}`, status: 'completed', result: { description: 'x'.repeat(2000) },
  }));
  const state = publicAllegroPreparationState({
    pending: [{ id: 'pending-1', productId: 'pending-product' }],
    results: [{ id: 'failed-1', productId: 'failed-product', status: 'failed' }, ...completed],
  });
  assert.equal(state.currentSummary.total, 302);
  assert.equal(state.currentSummary.completed, 300);
  assert.equal(state.current.length, 302);
  assert.equal(state.current.find((item) => item.productId === 'product-0').status, 'completed');
  assert.equal(state.current.find((item) => item.productId === 'product-0').result, undefined);
  assert.equal(state.current.find((item) => item.productId === 'failed-product').status, 'failed');
  assert.equal(state.recent.length, 100);
});
