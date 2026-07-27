import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyProductSaleDecisionBatch } from '../src/backend/lib/domain/product-sale-decisions.mjs';
import { createProductAvailabilityRoute } from '../src/backend/lib/product-availability-route.mjs';

test('decyzja grupowa zapisuje tę samą opcję dla wielu produktów w jednym rekordzie', () => {
  const now = new Date('2026-07-16T18:00:00.000Z');
  const result = applyProductSaleDecisionBatch({
    now,
    data: { artway_dostepnosc: { 'p-1': { history: [{ decision: 'auto' }] } } },
    body: { items: [
      { productId: 'p-1', decision: 'grace', days: 2, producerStatus: 'brak' },
      { productId: 'p-2', decision: 'grace', days: 2, producerStatus: 'niski', producerQuantity: 8 },
    ] },
  });
  assert.equal(result.results.length, 2);
  assert.equal(result.data.artway_dostepnosc['p-1'].decision, 'grace');
  assert.equal(result.data.artway_dostepnosc['p-2'].decision, 'grace');
  assert.equal(result.data.artway_dostepnosc['p-1'].expiresAt, '2026-07-18T18:00:00.000Z');
  assert.equal(result.data.artway_dostepnosc['p-1'].history.length, 2);
  assert.equal(result.checks.every((item) => item.preserveDecision === true && item.available === true), true);
});

test('błędna pozycja odrzuca całą decyzję przed zapisem', () => {
  const original = { artway_dostepnosc: { p1: { status: 'dostepny' } } };
  assert.throws(() => applyProductSaleDecisionBatch({ data: original, body: { items: [
    { productId: 'p1', decision: 'hide_manual', producerStatus: 'brak' },
    { productId: '', decision: 'hide_manual', producerStatus: 'brak' },
  ] } }), /Nieprawidłowa decyzja/);
  assert.deepEqual(original, { artway_dostepnosc: { p1: { status: 'dostepny' } } });
});

test('błąd jednego kanału nie cofa poprawnych decyzji z tej samej partii', async () => {
  const latestData = { artway_dostepnosc: { p2: { status: 'dostepny', decision: 'manual_available' } }, artway_agent_ai_historia: [] };
  let genericWrites = 0;
  const route = createProductAvailabilityRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    text: (value, max = 500) => String(value ?? '').slice(0, max),
    read: async (key, fallback) => key === 'settings' ? { data: structuredClone(latestData), rev: 7, updated_at: null } : fallback,
    write: async () => { genericWrites++; },
    mutateSettings: async (mutator) => {
      await mutator(latestData);
      return { modified: true };
    },
    syncSaleChannels: async (req, checks, data, { previousAvailability }) => {
      data.artway_dostepnosc.p2 = previousAvailability.p2;
      return {
        complete: false,
        siteHidden: 1,
        siteRestored: 0,
        allegroHidden: 1,
        allegroRestored: 0,
        errors: [{ productId: 'p2', offerId: 'o2', error: 'Allegro odrzuciło zmianę' }],
      };
    },
  });
  const request = {
    method: 'POST',
    json: async () => ({ items: [
      { productId: 'p1', decision: 'wait_available', producerStatus: 'brak' },
      { productId: 'p2', decision: 'wait_available', producerStatus: 'brak' },
    ] }),
  };
  const response = await route(request, new URL('https://artwaytm.pl/api/store?action=product-sale-decision'), 'product-sale-decision');
  assert.equal(response.status, 200);
  assert.equal(response.body.partial, true);
  assert.equal(response.body.changed, 1);
  assert.equal(response.body.failed, 1);
  assert.equal(response.body.results[0].productId, 'p1');
  assert.equal(response.body.failures[0].productId, 'p2');
  assert.equal(latestData.artway_dostepnosc.p1.decision, 'wait_available');
  assert.equal(latestData.artway_dostepnosc.p2.decision, 'manual_available');
  assert.equal(genericWrites, 0);
});

test('monitor producentów ma zaznaczanie i identyczny wybór decyzji pojedynczej oraz grupowej', async () => {
  const [state, availability, inventory, backend, cloud] = await Promise.all([
    readFile(new URL('../src/frontend/02-runtime-state.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/admin.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/backend/lib/product-availability-route.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/frontend/03-cloud-sync.js', import.meta.url), 'utf8'),
  ]);
  assert.match(state, /zaznaczoneDostepnoscProducentow=new Set\(\)/);
  assert.match(availability, /DECYZJE_PRODUCENTA_OPCJE/);
  assert.match(availability, /data-supplier-decision=.*decyzjaProducentaOpcjeHTML/);
  assert.match(availability, /data-supplier-bulk-decision.*decyzjaProducentaOpcjeHTML/);
  assert.match(availability, /body:\{items:partia\}/);
  assert.match(inventory, /adminOperacjeWynikowHTML\(\{id:"supplier-availability"/);
  assert.match(inventory, /ustawZaznaczenieDostepnosciProducentow\('strona'\)/);
  assert.match(backend, /applyProductSaleDecisionBatch/);
  assert.match(backend, /authoritativeAvailability/);
  assert.match(availability, /nalozPotwierdzonaDostepnoscSerwera/);
  assert.match(availability, /const rozmiarPartii=40/);
  assert.match(cloud, /CHMURA_WERSJA_WIDOCZNOSCI_DOMEN=2/);
});
