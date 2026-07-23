import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectedSourceImages,
  sourceProductIdentity,
  verifiedSourceImages,
} from '../netlify/functions/lib/domain/source-product-images.mjs';
import { mergeImportedProductSourceRefresh } from '../netlify/functions/lib/domain/imported-product-catalog.mjs';

const sourceUrl = 'https://hurtownia.example.pl/product-pol-1188-ORIGAMI-3D-KWIATY.html';
const product = {
  id: '1188',
  nazwa: 'Origami 3D Kwiaty',
  ean: '5906018011883',
  sourceUrl,
  zdjecie: 'https://wrong.example.pl/kajak.jpg',
};
const inspection = {
  canonicalUrl: sourceUrl,
  product: {
    nazwa: 'ORIGAMI 3D KWIATY',
    ean: '5906018011883',
    sourceUrl,
    zdjecie: 'https://cdn.example.pl/1188-main.jpg',
    zdjecia: ['https://cdn.example.pl/1188-side.jpg'],
    sourceEvidence: { imagePolicyVersion: 2, imageSourceType: 'product_source_page', imageSourceUrl: sourceUrl },
  },
};

test('galeria z konkretnego linku źródłowego zastępuje błędne stare zdjęcie', () => {
  const result = inspectedSourceImages(product, inspection);
  assert.equal(result.ok, true);
  assert.deepEqual(result.images, ['https://cdn.example.pl/1188-main.jpg', 'https://cdn.example.pl/1188-side.jpg']);
  assert.equal(result.patch.zdjecie, 'https://cdn.example.pl/1188-main.jpg');
  assert.deepEqual(verifiedSourceImages({ ...product, ...result.patch }), result.images);
});

test('sprzeczny EAN blokuje przypisanie galerii z innego produktu', () => {
  const conflict = inspectedSourceImages(product, { ...inspection, product: { ...inspection.product, ean: '5906018000030' } });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.identity.mode, 'ean_conflict');
  assert.equal(sourceProductIdentity(product, { ...inspection.product, ean: '5906018000030' }).ok, false);
});

test('stary cache bez nowej informacji o pochodzeniu zdjęć jest odrzucany', () => {
  const legacy = inspectedSourceImages(product, { ...inspection, fromCache: true, product: { ...inspection.product, sourceEvidence: {} } });
  assert.equal(legacy.ok, false);
  assert.equal(legacy.identity.mode, 'legacy_cache_rejected');
});

test('aktualizacja z linku nadpisuje zdjęcie nawet gdy kartoteka miała wcześniej inną grafikę', () => {
  const refreshed = mergeImportedProductSourceRefresh(product, {
    ...inspection.product,
    sourceEvidence: {
      ...inspection.product.sourceEvidence,
      imageUrls: ['https://cdn.example.pl/1188-main.jpg', 'https://cdn.example.pl/1188-side.jpg'],
    },
  });
  assert.equal(refreshed.zdjecie, 'https://cdn.example.pl/1188-main.jpg');
  assert.deepEqual(refreshed.zdjecia, ['https://cdn.example.pl/1188-side.jpg']);
});
