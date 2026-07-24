import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRequiredAllegroSalesConditions,
  createAllegroOfferStatusWaiter,
  createAllegroSalesConditionsLoader,
} from '../src/backend/lib/domain/allegro-sales-readiness.mjs';

test('przygotowanie nowej oferty blokuje brak cennika i warunków posprzedażowych', () => {
  const missing = applyRequiredAllegroSalesConditions([], {});
  assert.deepEqual(missing, ['cennik dostawy Allegro', 'warunki zwrotu Allegro', 'warunki reklamacji Allegro']);
});

test('warunki sprzedaży są pobierane raz i zachowywane dla finalnej publikacji', async () => {
  let calls = 0;
  const load = createAllegroSalesConditionsLoader({
    call: async (_req, path) => {
      calls++;
      if (path === '/sale/shipping-rates') return { shippingRates: [{ id: 'ship-1', name: 'InPost' }] };
      if (path.includes('return-policies')) return { returnPolicies: [{ id: 'return-1', name: 'Zwroty' }] };
      if (path.includes('implied-warranties')) return { impliedWarranties: [{ id: 'claim-1', name: 'Reklamacje' }] };
      return { warranties: [] };
    },
  });
  const first = await load({});
  const second = await load({});
  assert.equal(first.defaults.shippingRateId, 'ship-1');
  assert.equal(second.defaults.returnPolicyId, 'return-1');
  assert.equal(calls, 4);
});

test('status oferty jest potwierdzany na rzeczywistej ofercie, nie tylko operacji pośredniej', async () => {
  let checks = 0;
  const wait = createAllegroOfferStatusWaiter({
    call: async () => ({ id: 'offer-1', publication: { status: ++checks >= 3 ? 'ACTIVE' : 'INACTIVE' } }),
    maxChecks: 5,
  });
  const result = await wait({}, 'offer-1', 'ACTIVE');
  assert.equal(result.completed, true);
  assert.equal(result.checks, 3);
  assert.equal(result.offer.publication.status, 'ACTIVE');
});
