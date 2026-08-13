import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAllegroPublicationReadback } from '../src/backend/lib/domain/allegro-publication-readback.mjs';

const tiger = { id: '1001082', nazwa: 'Puzzle drewniane Peace and Harmony – Tygrys, 400 el. Alexander', ean: '5906018050608', externalId: '5060', allegroOfferId: '18819388168' };
const elephant = { id: '1000506', nazwa: 'Puzzle drewniane Peace & Harmony – Słoń – 400 elementów (iWood)', ean: '5906018050608', externalId: '5060', allegroOfferId: '18819388168' };
const offer = { id: '18819388168', name: 'Puzzle drewniane Peace and Harmony Tygrys 400 el', ean: '5906018050608', externalId: '5060', status: 'ACTIVE' };

test('odczyt stanu wybiera jedną właściwą kartotekę przy wspólnym EAN i SKU', () => {
  const correct = evaluateAllegroPublicationReadback({ task: { productId: tiger.id, operation: 'activate' }, product: tiger, products: [elephant, tiger], offer });
  const duplicate = evaluateAllegroPublicationReadback({ task: { productId: elephant.id, operation: 'activate' }, product: elephant, products: [elephant, tiger], offer });
  assert.equal(correct.confirmed, true);
  assert.equal(correct.selectedProductId, tiger.id);
  assert.equal(duplicate.confirmed, false);
  assert.equal(duplicate.errorCode, 'allegro_catalog_identity_conflict');
  assert.equal(duplicate.selectedProductId, tiger.id);
});

test('prawidłowa tożsamość nie zamyka zadania, gdy Allegro nie osiągnęło oczekiwanego statusu', () => {
  const result = evaluateAllegroPublicationReadback({
    task: { productId: tiger.id, operation: 'activate' },
    product: tiger,
    products: [tiger],
    offer: { ...offer, status: 'INACTIVE' },
  });
  assert.equal(result.confirmed, false);
  assert.match(result.reason, /INACTIVE/);
});
