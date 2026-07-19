import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyProductSaleDecisionBatch } from '../netlify/functions/lib/domain/product-sale-decisions.mjs';

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

test('monitor producentów ma zaznaczanie i identyczny wybór decyzji pojedynczej oraz grupowej', async () => {
  const [state, availability, inventory, backend] = await Promise.all([
    readFile(new URL('../src/frontend/02-runtime-state.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/frontend/05-catalog-inventory.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/admin.js', import.meta.url), 'utf8'),
    readFile(new URL('../netlify/functions/lib/store-app.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(state, /zaznaczoneDostepnoscProducentow=new Set\(\)/);
  assert.match(availability, /DECYZJE_PRODUCENTA_OPCJE/);
  assert.match(availability, /data-supplier-decision=.*decyzjaProducentaOpcjeHTML/);
  assert.match(availability, /data-supplier-bulk-decision.*decyzjaProducentaOpcjeHTML/);
  assert.match(availability, /body:\{items\}/);
  assert.match(inventory, /adminOperacjeWynikowHTML\(\{id:"supplier-availability"/);
  assert.match(inventory, /ustawZaznaczenieDostepnosciProducentow\('strona'\)/);
  assert.match(backend, /applyProductSaleDecisionBatch/);
});
