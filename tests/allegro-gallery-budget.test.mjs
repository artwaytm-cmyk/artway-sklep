import test from 'node:test';
import assert from 'node:assert/strict';
import { ALLEGRO_GALLERY_LIMIT, allegroGalleryBudget } from '../src/backend/lib/domain/allegro-gallery-budget.mjs';

test('limit galerii uwzględnia razem zdjęcia produktu katalogowego i oferty', () => {
  const result = allegroGalleryBudget({
    catalogProductId: 'catalog-1',
    catalogImages: Array.from({ length: 7 }, (_, index) => `https://catalog.test/${index}.jpg`),
    offerImages: Array.from({ length: 16 }, (_, index) => `https://artway.test/${index}.jpg`),
  });
  assert.equal(result.catalogImageCount, 7);
  assert.equal(result.ownImageCount, 9);
  assert.equal(result.totalExpected, ALLEGRO_GALLERY_LIMIT);
  assert.equal(result.omittedOwnImageCount, 7);
});

test('nieznana galeria potwierdzonego produktu katalogowego nie powoduje ryzyka przekroczenia limitu', () => {
  const result = allegroGalleryBudget({
    catalogProductId: 'catalog-1',
    offerImages: ['https://artway.test/main.jpg'],
  });
  assert.deepEqual(result.images, []);
  assert.equal(result.reservedForCatalog, ALLEGRO_GALLERY_LIMIT);
  assert.equal(result.mode, 'catalog_first');
});

test('produkt bez UUID może wykorzystać pełne 16 własnych zdjęć bez duplikatów', () => {
  const result = allegroGalleryBudget({
    offerImages: ['https://artway.test/main.jpg', 'https://artway.test/main.jpg', ...Array.from({ length: 20 }, (_, index) => `https://artway.test/${index}.jpg`)],
  });
  assert.equal(result.images.length, ALLEGRO_GALLERY_LIMIT);
  assert.equal(new Set(result.images).size, ALLEGRO_GALLERY_LIMIT);
  assert.equal(result.mode, 'offer_only');
});
