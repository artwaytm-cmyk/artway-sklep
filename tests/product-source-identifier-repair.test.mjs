import test from 'node:test';
import assert from 'node:assert/strict';
import { trustedSourceIdentifierPatch } from '../src/backend/lib/domain/product-source-identifier-repair.mjs';

test('naprawia błędny EAN na podstawie źródła o zgodnym kodzie producenta', () => {
  assert.deepEqual(trustedSourceIdentifierPatch(
    { kodProducenta: '2233', ean: '590601802339' },
    { kodProducenta: '2233', ean: '5906018022339' },
  ), { ean: '5906018022339', gtin: '5906018022339' });
});

test('rozpoznaje EAN omyłkowo opisany przez źródło jako kod producenta', () => {
  assert.deepEqual(trustedSourceIdentifierPatch(
    { kodProducenta: '2233', ean: '' },
    { parametryProducenta: { kodProducenta: '5906018022339' } },
  ), { ean: '5906018022339', gtin: '5906018022339' });
});

test('nie nadpisuje prawidłowego EAN ani danych obcego produktu', () => {
  assert.deepEqual(trustedSourceIdentifierPatch(
    { kodProducenta: '2233', ean: '5906018022339' },
    { kodProducenta: '9999', ean: '5906395300068' },
  ), {});
  assert.deepEqual(trustedSourceIdentifierPatch(
    { kodProducenta: '2233', ean: '590601802339' },
    { kodProducenta: '0006', ean: '5906395300068' },
  ), {});
});
