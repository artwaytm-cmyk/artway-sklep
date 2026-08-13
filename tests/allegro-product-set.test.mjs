import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  allegroConfiguredProductSet,
  allegroProductSetIdentityMatches,
  allegroProductSetPayload,
} from '../src/backend/lib/domain/allegro-product-set.mjs';

const first = 'b531fb52-242f-4325-ada9-0d09091319be';
const second = '03da7507-c928-4619-9587-edf9dcd5e049';

test('potwierdzony zestaw Allegro zachowuje każdy produkt i jego ilość', () => {
  const product = { allegroProductSet: [
    { productId: first, quantity: 1, identityVerified: true, storeProductId: '1000146' },
    { productId: second, quantity: 2, identityVerified: true, storeProductId: '1000179' },
  ] };
  assert.deepEqual(allegroProductSetPayload(product).productSet, [
    { product: { id: first }, quantity: { value: 1 } },
    { product: { id: second }, quantity: { value: 2 } },
  ]);
  assert.equal(allegroProductSetIdentityMatches(product, allegroProductSetPayload(product).productSet).ok, true);
});

test('zestaw odrzuca niepotwierdzone ID i duplikaty zamiast pomijać je po cichu', () => {
  const result = allegroConfiguredProductSet({ allegroProductSet: [
    { productId: first, identityVerified: true },
    { productId: second, identityVerified: false },
    { productId: first, identityVerified: true },
  ] });
  assert.equal(result.ready, false);
  assert.equal(result.items.length, 1);
  assert.match(result.missing.join(' '), /tożsamość katalogowa/);
  assert.match(result.missing.join(' '), /drugi raz/);
});

test('zmiana produktu albo ilości w szkicu łamie bramkę tożsamości zestawu', () => {
  const product = { allegroProductSet: [
    { productId: first, quantity: 1, identityVerified: true },
    { productId: second, quantity: 1, identityVerified: true },
  ] };
  assert.equal(allegroProductSetIdentityMatches(product, [
    { product: { id: first }, quantity: { value: 1 } },
    { product: { id: second }, quantity: { value: 2 } },
  ]).ok, false);
});

test('generator szkicu i bramka publikacji używają kanonicznej obsługi zestawu', async () => {
  const source = await readFile('src/backend/lib/store-app.mjs', 'utf8');
  assert.match(source, /configuredProductSet\.productSet/);
  assert.match(source, /mode: 'verified_product_set'/);
  assert.match(source, /configuredProductSet\.ready\s*\? \[\]/);
});
