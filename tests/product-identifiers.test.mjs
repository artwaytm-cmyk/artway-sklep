import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalGtin, gtinEquivalent, isValidGtin } from '../netlify/functions/lib/domain/product-identifiers.mjs';
import { findBestAllegroOffer, mappingProductSnapshot, mappingVerifiedForSupplier, scoreAllegroProductMapping } from '../netlify/functions/lib/domain/allegro-product-mapping.mjs';

test('EAN-13 i odpowiadający GTIN-14 z zerem wiodącym są tym samym produktem', () => {
  assert.equal(isValidGtin('5906018026788'), true);
  assert.equal(isValidGtin('05906018026788'), true);
  assert.equal(canonicalGtin('5906018026788'), '05906018026788');
  assert.equal(gtinEquivalent('5906018026788', '0 5906018026788'), true);
});

test('zer nie usuwa się z dowolnych SKU ani z błędnych kodów', () => {
  assert.equal(canonicalGtin('001234'), '');
  assert.equal(gtinEquivalent('001234', '1234'), false);
  assert.equal(gtinEquivalent('5906018026789', '05906018026789'), false);
});

test('ocena mapowania Allegro nie zgłasza konfliktu dla równoważnych GTIN', () => {
  const result = scoreAllegroProductMapping(
    { id: 120, nazwa: 'Puzzle magnetyczne Farma', ean: '5906018026788' },
    { id: 'OF-1', name: 'Puzzle magnetyczne Farma', gtin: '05906018026788' },
  );
  assert.equal(result.valid, true);
  assert.equal(result.score, 100);
  assert.deepEqual(result.conflicts, []);
});

test('ręczne mapowanie jest trwałym dowodem, a migawka zachowuje dane zakupowe', () => {
  assert.equal(mappingVerifiedForSupplier({ operator: 'admin-validated' }), true);
  const snapshot = mappingProductSnapshot(
    { id: 120, nazwa: 'Puzzle magnetyczne Farma', externalId: '2678', ean: '5906018026788', producent: 'Alexander' },
    { artway_magazyn_produkty: { 120: { dostawca: 'Alexander' } } },
  );
  assert.equal(snapshot.externalId, '2678');
  assert.equal(snapshot.dostawca, 'Alexander');
  assert.equal(snapshot.canonicalGtin, '05906018026788');
});

test('pewne mapowanie wybiera ofertę po EAN niezależnie od wysokiego ID importu', () => {
  const product = { id: 1000287, nazwa: 'Puzzle magnetyczne Farma', ean: '5906018026788' };
  const offers = [{ id: 'OF-1', name: 'Puzzle magnetyczne Farma', gtin: '05906018026788' }, { id: 'OF-2', name: 'Inny produkt', gtin: '5906018003796' }];
  const match = findBestAllegroOffer(product, offers, {});
  assert.equal(match.offer.id, 'OF-1');
  assert.equal(match.score, 92);
  assert.equal(match.reason, 'identyczny EAN/GTIN');
});

test('zapisane mapowanie ma pierwszeństwo wyłącznie przy wiarygodnej ofercie', () => {
  const product = { id: 1000287, nazwa: 'Puzzle magnetyczne Farma', ean: '5906018026788' };
  const offers = [{ id: 'OF-1', name: 'Całkiem inna gra', gtin: '5906018003796' }, { id: 'OF-2', name: 'Puzzle magnetyczne Farma', gtin: '5906018026788' }];
  const match = findBestAllegroOffer(product, offers, { 'OF-1': { offerId: 'OF-1', productId: '1000287' } });
  assert.equal(match.offer.id, 'OF-2');
});
