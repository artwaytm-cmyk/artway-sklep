import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scoreAllegroProductMapping } from '../netlify/functions/lib/domain/allegro-product-mapping.mjs';

const ecoFunOffer = {
  id: '14227220550',
  name: 'ECO FUN - TRYLMA',
  ean: '5906018025309',
  externalId: '39931-uniw',
  manufacturerCode: '2530',
  productId: '13d89194-77b2-4743-a5d1-3a9de93a5d53',
};

test('Eco Fun Trylma korzysta z poprawnego EAN z parametrów źródłowych', () => {
  const product = {
    id: 1000070,
    nazwa: 'ECO FUN - TRYLMA',
    ean: '590608025309', // błędny, skrócony odczyt strony producenta
    externalId: '2530',
    kodProducenta: '2530',
    allegroProductId: ecoFunOffer.productId,
    parametryProducenta: { kodProducenta: '5906018025309' },
  };
  const result = scoreAllegroProductMapping(product, ecoFunOffer);
  assert.equal(result.score, 100);
  assert.equal(result.valid, true);
  assert.equal(result.strongConflict, false);
  assert.match(result.reason, /EAN\/GTIN/);
});

test('błędny niekanoniczny EAN nie obniża zgodności mocnych identyfikatorów do 35%', () => {
  const product = {
    nazwa: 'ECO FUN - TRYLMA',
    ean: '590608025309',
    kodProducenta: '2530',
    allegroProductId: ecoFunOffer.productId,
  };
  const result = scoreAllegroProductMapping(product, ecoFunOffer);
  assert.equal(result.score, 99);
  assert.equal(result.valid, true);
  assert.equal(result.strongConflict, false);
  assert.deepEqual(result.conflicts, []);
});

test('rozbieżny poprawny EAN pozostaje blokadą bez innych silnych dowodów', () => {
  const result = scoreAllegroProductMapping(
    { nazwa: 'Trylma', ean: '5906018001693' },
    { name: 'Trylma', ean: '5906018025309' },
  );
  assert.equal(result.score, 35);
  assert.equal(result.valid, false);
  assert.equal(result.strongConflict, true);
});

test('frontend rozdziela pewność tożsamości od duplikatu oferty', async () => {
  const [mapping, mappingIndex, management] = await Promise.all([
    readFile(new URL('../src/frontend/11-allegro-and-orders.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/frontend/11-allegro-mapping-index.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/frontend/11-allegro-offer-management.js', import.meta.url), 'utf8'),
  ]);
  assert.match(mappingIndex, /occupiedMatch/);
  assert.match(mappingIndex, /parametryProducenta/);
  assert.match(management, /pewność tożsamości/);
  assert.match(management, /możliwy duplikat oferty/);
});
