import test from 'node:test';
import assert from 'node:assert/strict';
import { INDEXNOW_KEY, INDEXNOW_KEY_LOCATION, eligiblePromotionProducts, normalizeIndexNowUrls, runIndexNowPromotion, submitIndexNow } from '../netlify/functions/lib/domain/indexnow.mjs';

test('IndexNow przyjmuje tylko bezpieczne, unikalne adresy głównej domeny', () => {
  assert.deepEqual(normalizeIndexNowUrls([
    'https://artwaytm.pl/',
    'https://artwaytm.pl/produkt/15#opis',
    'https://artwaytm.pl/produkt/15',
    'http://artwaytm.pl/produkt/16',
    'https://example.com/produkt/17',
  ]), ['https://artwaytm.pl/', 'https://artwaytm.pl/produkt/15']);
});

test('IndexNow wysyła prawidłowe zgłoszenie zbiorcze', async () => {
  let request = null;
  const result = await submitIndexNow(['https://artwaytm.pl/', '/produkt/22'], { fetchImpl: async (url, options) => {
    request = { url, options };
    return { status: 202 };
  } });
  assert.equal(result.accepted, true);
  assert.equal(result.count, 2);
  assert.equal(request.url, 'https://api.indexnow.org/indexnow');
  const body = JSON.parse(request.options.body);
  assert.equal(body.host, 'artwaytm.pl');
  assert.equal(body.key, INDEXNOW_KEY);
  assert.equal(body.keyLocation, INDEXNOW_KEY_LOCATION);
  assert.deepEqual(body.urlList, ['https://artwaytm.pl/', 'https://artwaytm.pl/produkt/22']);
});

test('IndexNow nie wysyła pustego zgłoszenia', async () => {
  const result = await submitIndexNow(['https://inna-domena.pl/produkt/1'], { fetchImpl: async () => { throw new Error('nie powinno zostać wywołane'); } });
  assert.equal(result.status, 'skipped');
  assert.equal(result.count, 0);
});

test('darmowa promocja obejmuje tylko aktywne i dostępne produkty z ceną', () => {
  const products = eligiblePromotionProducts({
    artway_produkty_katalog: [{ id: 1, cena: 20 }, { id: 2, cena: 30 }, { id: 3, cena: 40 }, { id: 4, cena: 50 }, { id: 5, cena: 0 }],
    artway_produkty_ukryte: [2],
    artway_dostepnosc: { 3: { status: 'niedostepny' }, 4: { status: 'niedostepny', decision: 'manual_available' } },
  });
  assert.deepEqual(products.map((product) => product.id), ['1', '4']);
});

test('pierwsze uruchomienie IndexNow zgłasza cały katalog, a kolejne tylko zmiany', async () => {
  const requests = [];
  const fetchImpl = async (_url, options) => { requests.push(JSON.parse(options.body)); return { status: 202 }; };
  const first = await runIndexNowPromotion({ catalogProducts: [{ id: 1 }, { id: 2 }], changedProducts: [{ id: 2 }], config: { indexNowEnabled: true }, fetchImpl });
  const next = await runIndexNowPromotion({ catalogProducts: [{ id: 1 }, { id: 2 }], changedProducts: [{ id: 2 }], config: { indexNowEnabled: true, indexNowFullCatalogAt: '2026-07-15T00:00:00.000Z' }, fetchImpl });
  assert.equal(first.scope, 'full-catalog');
  assert.equal(first.count, 3);
  assert.equal(next.scope, 'changed-products');
  assert.equal(next.count, 2);
  assert.deepEqual(requests[0].urlList, ['https://artwaytm.pl/', 'https://artwaytm.pl/produkt/1', 'https://artwaytm.pl/produkt/2']);
  assert.deepEqual(requests[1].urlList, ['https://artwaytm.pl/', 'https://artwaytm.pl/produkt/2']);
});
