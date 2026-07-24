import test from 'node:test';
import assert from 'node:assert/strict';
import { preserveManualProductPrices, preserveNewerManualPrices } from '../src/backend/lib/domain/catalog-product-price-merge.mjs';
import { createStoreDataRoute } from '../src/backend/lib/store-data-route.mjs';

test('starsza karta przeglądarki nie usuwa ani nie cofa ręcznie zapisanej ceny', () => {
  const server = { cena: 49.9, cenaManualna: true, cenaZrodlo: 'ręczna edycja administratora', cenaZaktualizowanoAt: '2026-07-24T10:00:00.000Z', nazwa: 'Aktualna' };
  assert.deepEqual(preserveNewerManualPrices(server, { nazwa: 'Stara karta' }), { cena: 49.9, cenaManualna: true, cenaZrodlo: 'ręczna edycja administratora', cenaZaktualizowanoAt: '2026-07-24T10:00:00.000Z', nazwa: 'Stara karta' });
  const merged = preserveManualProductPrices({ artway_produkty_edytowane: { 1000914: { nazwa: 'Stara karta', cena: 300 } } }, { artway_produkty_edytowane: { 1000914: server } });
  assert.equal(merged.artway_produkty_edytowane[1000914].cena, 49.9);
});

test('nowsza świadoma zmiana ceny wygrywa z wartością serwera', () => {
  const result = preserveNewerManualPrices(
    { cena: 49.9, cenaZaktualizowanoAt: '2026-07-24T10:00:00.000Z' },
    { cena: 52.9, cenaManualna: true, cenaZaktualizowanoAt: '2026-07-24T11:00:00.000Z' },
  );
  assert.equal(result.cena, 52.9);
});

test('dedykowany zapis ceny wykonuje jedną atomową operację na centralnym produkcie', async () => {
  let operation = null;
  const route = createStoreDataRoute({
    odpowiedz: (body, status = 200) => ({ body, status }),
    czyAdmin: () => true,
    tekst: (value, max = 400) => String(value || '').slice(0, max),
    requestSession: () => ({ email: 'admin@example.test' }),
    zapiszOperacjeProduktow: async (operations) => {
      [operation] = operations;
      return { modified: true, appliedOperations: 1, skippedProductIds: [], value: { rev: 41 } };
    },
  });
  const request = { method: 'POST', json: async () => ({ productId: '1000914', channel: 'store', value: '49,90' }) };
  const result = await route(request, new URL('https://artwaytm.pl/api/store?action=catalog-product-price-update'), 'catalog-product-price-update');
  assert.equal(result.status, 200);
  assert.equal(result.body.rev, 41);
  assert.equal(operation.id, '1000914');
  assert.equal(operation.fields.cena, 49.9);
  assert.equal(operation.fields.cenaManualna, true);
  assert.match(operation.fields.cenaZrodlo, /admin@example\.test/);
});
