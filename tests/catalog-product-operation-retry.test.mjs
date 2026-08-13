import test from 'node:test';
import assert from 'node:assert/strict';
import { createCentralCatalogProductOperationWriter } from '../src/backend/lib/domain/catalog-product-operation-rebase.mjs';

test('centralny zapis produktu ponawia przejściowy timeout blokady PostgreSQL z tym samym mutationId', async () => {
  const calls = [], waits = [];
  const writer = createCentralCatalogProductOperationWriter({
    catalog: {
      get: async () => ({ id: '375' }),
      patchProductFields: async (id, fields, remove, options) => {
        calls.push({ id, fields, remove, options });
        if (calls.length === 1) throw Object.assign(new Error('lock timeout'), { code: '55P03' });
        return { updated: true, id };
      },
    },
    wait: async (milliseconds) => { waits.push(milliseconds); },
    maxAttempts: 3,
  });
  const result = await writer([{ id: 375, fields: { name: 'Poprawiony produkt' } }], '2026-08-02T20:00:00.000Z');
  assert.equal(result.modified, true);
  assert.equal(result.attempts, 2);
  assert.equal(result.appliedOperations, 1);
  assert.deepEqual(waits, [75]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.mutationId, calls[1].options.mutationId);
});

test('centralny zapis produktu nie ponawia błędu trwałego', async () => {
  let calls = 0;
  const writer = createCentralCatalogProductOperationWriter({
    catalog: {
      get: async () => ({ id: '375' }),
      patchProductFields: async () => {
        calls += 1;
        throw Object.assign(new Error('validation failed'), { code: '22000' });
      },
    },
    wait: async () => {},
  });
  await assert.rejects(() => writer([{ id: 375, fields: { name: '' } }]), /validation failed/);
  assert.equal(calls, 1);
});
