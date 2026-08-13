import test from 'node:test';
import assert from 'node:assert/strict';
import { createCentralProductPatchBuffer } from '../src/backend/lib/domain/central-product-patch-buffer.mjs';

test('cykliczna synchronizacja nie zapisuje pól identycznych z centralną kartoteką', () => {
  const products = new Map([['17', {
    id: '17',
    allegroOfferId: '123',
    allegroEditorialSyncPending: true,
    allegroEditorialSyncPendingAt: '2026-07-29T12:00:00.000Z',
    sourceMaterial: { allegroOfferDescription: 'Opis' },
  }]]);
  const buffer = createCentralProductPatchBuffer(products);
  const changed = buffer.apply('17', {
    allegroOfferId: '123',
    allegroEditorialSyncPending: true,
    allegroEditorialSyncPendingAt: '2026-07-29T12:00:00.000Z',
    sourceMaterial: { allegroOfferDescription: 'Opis' },
  });
  assert.equal(changed, false);
  assert.equal(buffer.size, 0);
  assert.deepEqual(buffer.operations(), []);
});

test('bufor łączy faktyczne poprawki produktu bez pełnego snapshotu i bez oczekiwania starej wersji', () => {
  const products = new Map([['17', { id: '17', producent: 'Alexander', status: 'stary' }]]);
  const buffer = createCentralProductPatchBuffer(products);
  assert.equal(buffer.apply('17', { producent: 'Alexander', status: 'nowy' }), true);
  assert.equal(buffer.apply('17', { allegroOfferId: '123' }, ['status']), true);
  assert.deepEqual(buffer.operations(), [{
    id: '17',
    fields: { allegroOfferId: '123' },
    remove: ['status'],
    expectedFields: {
      status: { present: true, value: 'stary' },
      allegroOfferId: { present: false, value: undefined },
    },
  }]);
  assert.equal(products.get('17').producent, 'Alexander');
  assert.equal(products.get('17').allegroOfferId, '123');
  assert.equal(Object.hasOwn(products.get('17'), 'status'), false);
});
