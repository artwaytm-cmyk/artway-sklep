import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalGtin, canonicalProductCode, gtinEquivalent, isValidGtin, synchronizeProductIdentifierAliases } from '../src/backend/lib/domain/product-identifiers.mjs';
import { findBestAllegroOffer, mappingProductSnapshot, mappingVerifiedForSupplier, scoreAllegroProductMapping } from '../src/backend/lib/domain/allegro-product-mapping.mjs';

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

test('jeden kod producenta zasila zgodne aliasy techniczne bez utraty zer wiodących', () => {
  const product = synchronizeProductIdentifierAliases({ nazwa: 'Edukarty', numerReferencyjny: '0006' }, { overwrite: true });
  assert.equal(canonicalProductCode(product), '0006');
  assert.equal(product.kodProducenta, '0006');
  assert.equal(product.mpn, '0006');
  assert.equal(product.externalId, '0006');
  assert.equal(product.sku, '0006');
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

test('mapowanie rozpoznaje również alternatywne nazwy pól EAN po obu stronach', () => {
  const result = scoreAllegroProductMapping(
    { id: 121, nazwa: 'Gra logiczna', EAN: '5906018026788' },
    { id: 'OF-2', name: 'Gra logiczna', canonicalGtin: '05906018026788' },
  );
  assert.equal(result.score, 100);
  assert.equal(result.valid, true);
});

test('mapowanie rozpoznaje produkt, gdy właściwy EAN jest kolejnym GTIN oferty', () => {
  const result = scoreAllegroProductMapping(
    { id: 122, nazwa: 'Gra rodzinna', ean: '5906018026788' },
    { id: 'OF-3', name: 'Gra rodzinna', gtins: ['5906018003796', '05906018026788'] },
  );
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

test('serwer zawęża duży rejestr ofert i zachowuje dopasowanie po GTIN z zerem', () => {
  const offers = Array.from({ length: 642 }, (_, index) => ({ id: `OF-${index}`, name: `Produkt kontrolny ${index}`, externalId: `EXT-${index}` }));
  offers[517] = { ...offers[517], name: 'Puzzle magnetyczne Farma', gtins: ['5906018003796', '05906018026788'] };
  const product = { id: 20001, nazwa: 'Puzzle magnetyczne Farma', ean: '5906018026788' };
  const match = findBestAllegroOffer(product, offers, {});
  assert.equal(match.offer.id, 'OF-517');
  assert.equal(match.reason, 'identyczny EAN/GTIN');
});

test('zapisane mapowanie ma pierwszeństwo wyłącznie przy wiarygodnej ofercie', () => {
  const product = { id: 1000287, nazwa: 'Puzzle magnetyczne Farma', ean: '5906018026788' };
  const offers = [{ id: 'OF-1', name: 'Całkiem inna gra', gtin: '5906018003796' }, { id: 'OF-2', name: 'Puzzle magnetyczne Farma', gtin: '5906018026788' }];
  const match = findBestAllegroOffer(product, offers, { 'OF-1': { offerId: 'OF-1', productId: '1000287' } });
  assert.equal(match.offer.id, 'OF-2');
});

test('zakończona oferta i zablokowane mapowanie nie wracają do automatycznej aktualizacji', () => {
  const product = { id: 1000287, nazwa: 'Puzzle magnetyczne Farma', ean: '5906018026788' };
  const offers = [
    { id: 'OF-OLD', name: 'Puzzle magnetyczne Farma', gtin: '5906018026788', status: 'ENDED' },
    { id: 'OF-NEW', name: 'Puzzle magnetyczne Farma', gtin: '5906018026788', status: 'ACTIVE' },
  ];
  const match = findBestAllegroOffer(product, offers, { 'OF-OLD': { offerId: 'OF-OLD', productId: '1000287', blocked: true } });
  assert.equal(match.offer.id, 'OF-NEW');
});

test('niższy próg od 55% udostępnia słabszą sugestię bez silnego konfliktu', () => {
  const product = { id: 1000300, nazwa: 'Układanka edukacyjna zwierzęta leśne', producent: 'Alexander' };
  const offers = [{ id: 'OF-55', name: 'Układanka edukacyjna zwierzęta', brand: 'Alexander' }];
  const strict = findBestAllegroOffer(product, offers, {}, 88);
  const broader = findBestAllegroOffer(product, offers, {}, 55);
  assert.equal(strict, null);
  assert.equal(broader.offer.id, 'OF-55');
  assert.ok(broader.score >= 55);
});

test('identyczna nazwa bez identyfikatora nie może automatycznie podpiąć oferty', () => {
  const product = { id: 30001, nazwa: 'Eco Fun - Trylma', producent: 'Alexander' };
  const offers = [{ id: 'OF-KAJAK', name: 'Eco Fun - Trylma', productId: 'uuid-kajaka' }];
  assert.equal(findBestAllegroOffer(product, offers, {}), null);
  const suggestion = findBestAllegroOffer(product, offers, {}, 55);
  assert.equal(suggestion.offer.id, 'OF-KAJAK');
  assert.match(suggestion.reason, /wyłącznie sugestia/);
});

test('niepotwierdzone UUID katalogu bez EAN nie jest automatycznym dowodem', () => {
  const product = { id: 30002, nazwa: 'Gra edukacyjna', allegroProductId: 'uuid-123' };
  const offers = [{ id: 'OF-UUID', name: 'Inny produkt', productId: 'uuid-123' }];
  assert.equal(findBestAllegroOffer(product, offers, {}), null);
});

test('ręczne mapowanie administratora pozostaje dozwolone bez EAN', () => {
  const product = { id: 30003, nazwa: 'Produkt bez kodu' };
  const offers = [{ id: 'OF-MANUAL', name: 'Produkt bez kodu' }];
  const mappings = { 'OF-MANUAL': { offerId: 'OF-MANUAL', productId: '30003', operator: 'admin-manual-decision' } };
  const match = findBestAllegroOffer(product, offers, mappings);
  assert.equal(match.offer.id, 'OF-MANUAL');
  assert.equal(match.reason, 'ręczne mapowanie administratora');
});
