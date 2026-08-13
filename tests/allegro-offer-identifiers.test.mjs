import test from 'node:test';
import assert from 'node:assert/strict';
import { allegroOfferGtinCandidates, allegroOfferPrimaryGtin } from '../src/backend/lib/domain/allegro-offer-identifiers.mjs';

test('odczytuje EAN z parametru Allegro niezależnie od nazwy i miejsca', () => {
  const offer = { productSet: [{ product: { parameters: [{ id: '225693', name: 'GTIN (EAN)', values: ['05906018026788'] }] } }] };
  assert.equal(allegroOfferPrimaryGtin(offer), '05906018026788');
  assert.equal(allegroOfferGtinCandidates(offer)[0].canonical, '05906018026788');
});

test('odczytuje tablicę eans i pole oznaczone przez Allegro jako isGTIN', () => {
  const offer = { product: { eans: ['5906018026788'] }, parameters: [{ name: 'Numer produktu', valuesLabels: ['05906018026788'], options: { isGTIN: true } }] };
  const candidates = allegroOfferGtinCandidates(offer);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].canonical, '05906018026788');
});

test('nie uznaje dowolnego numeru ani błędnej sumy kontrolnej za EAN', () => {
  const offer = { parameters: [{ name: 'Liczba elementów', values: ['5906018026788'] }, { name: 'Kod kreskowy', values: ['5906018026789'] }] };
  assert.deepEqual(allegroOfferGtinCandidates(offer), []);
});
