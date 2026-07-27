import test from 'node:test';
import assert from 'node:assert/strict';
import { preserveManualProductPrices, preserveNewerConfirmedMutation, preserveNewerManualPrices } from '../src/backend/lib/domain/catalog-product-price-merge.mjs';
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

test('spóźniona karta nie nadpisuje nowszej potwierdzonej operacji produktu', () => {
  const server = { nazwa: 'Nowa nazwa AI', opis: 'Nowy opis', cena: 49.9, lastAdminMutationAt: '2026-07-24T13:10:00.000Z', lastAdminMutationId: 'new', lastAdminMutationFields: ['nazwa', 'opis'] };
  const stale = { nazwa: 'Stara nazwa', opis: 'Stary opis', cena: 52.9, lastAdminMutationAt: '2026-07-24T13:00:00.000Z', lastAdminMutationId: 'old' };
  assert.deepEqual(preserveNewerConfirmedMutation(server, stale), { ...stale, nazwa: 'Nowa nazwa AI', opis: 'Nowy opis', lastAdminMutationAt: server.lastAdminMutationAt, lastAdminMutationId: 'new', lastAdminMutationFields: ['nazwa', 'opis'] });
  assert.equal(preserveNewerConfirmedMutation(server, stale).cena, 52.9);
  assert.equal(preserveNewerConfirmedMutation(server, { ...stale, lastAdminMutationAt: '2026-07-24T13:20:00.000Z' }).nazwa, 'Stara nazwa');
});

test('dedykowany zapis ceny wykonuje jeden potwierdzony zapis centralnego produktu bez podwójnej publikacji', async () => {
  let savedInput = null, publicationCalls = 0;
  const route = createStoreDataRoute({
    odpowiedz: (body, status = 200) => ({ body, status }),
    czyAdmin: () => true,
    tekst: (value, max = 400) => String(value || '').slice(0, max),
    requestSession: () => ({ email: 'admin@example.test' }),
    zapiszPolaProduktuCentralnie: async (input) => {
      savedInput = input;
      return { ...input, fields: { ...input.fields, lastAdminMutationId: input.mutationId }, confirmedAt: '2026-07-27T10:00:00.000Z', rev: 41 };
    },
    publikujPolaProduktuCentralnie: async () => { publicationCalls++; return { published: true }; },
  });
  const request = { method: 'POST', json: async () => ({ productId: '1000914', channel: 'store', value: '49,90' }) };
  const result = await route(request, new URL('https://artwaytm.pl/api/store?action=catalog-product-price-update'), 'catalog-product-price-update');
  assert.equal(result.status, 200);
  assert.equal(result.body.rev, 41);
  assert.equal(savedInput.productId, '1000914');
  assert.equal(savedInput.fields.cena, 49.9);
  assert.equal(savedInput.fields.cenaManualna, true);
  assert.match(savedInput.fields.cenaZrodlo, /admin@example\.test/);
  assert.equal(savedInput.area, 'assortment-inline-price');
  assert.equal(publicationCalls, 0);
  assert.equal(result.body.publication.published, true);
  assert.equal(result.body.publication.readbackConfirmed, true);
});
