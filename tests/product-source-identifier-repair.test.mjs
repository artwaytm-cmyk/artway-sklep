import test from 'node:test';
import assert from 'node:assert/strict';
import { officialManufacturerSourceCandidate, trustedSourceIdentifierPatch } from '../src/backend/lib/domain/product-source-identifier-repair.mjs';

test('naprawia błędny EAN na podstawie źródła o zgodnym kodzie producenta', () => {
  assert.deepEqual(trustedSourceIdentifierPatch(
    { kodProducenta: '2233', ean: '590601802339' },
    { kodProducenta: '2233', ean: '5906018022339' },
  ), { ean: '5906018022339', gtin: '5906018022339' });
});

test('rozpoznaje EAN omyłkowo opisany przez źródło jako kod producenta', () => {
  assert.deepEqual(trustedSourceIdentifierPatch(
    { kodProducenta: '2233', ean: '' },
    { parametryProducenta: { kodProducenta: '5906018022339' } },
  ), { ean: '5906018022339', gtin: '5906018022339' });
});

test('nie nadpisuje prawidłowego EAN ani danych obcego produktu', () => {
  assert.deepEqual(trustedSourceIdentifierPatch(
    { kodProducenta: '2233', ean: '5906018022339' },
    { kodProducenta: '9999', ean: '5906395300068' },
  ), {});
  assert.deepEqual(trustedSourceIdentifierPatch(
    { kodProducenta: '2233', ean: '590601802339' },
    { kodProducenta: '0006', ean: '5906395300068' },
  ), {});
});

test('naprawia wyłącznie cyfrę kontrolną oficjalnego GTIN przy dokładnie zgodnym kodzie produktu', () => {
  const patch = trustedSourceIdentifierPatch(
    { kodProducenta: '0009', ean: '5906395300095' },
    {
      kodProducenta: '0009',
      parametryZrodla: { ean: '5906395300095' },
      sourceUrl: 'https://multigra.com.pl/produkty/dinozaury/',
    },
  );
  assert.equal(patch.ean, '5906395300099');
  assert.equal(patch.gtin, '5906395300099');
  assert.equal(patch.identifierRepairEvidence.originalGtin, '5906395300095');
  assert.equal(patch.identifierRepairEvidence.method, 'official_source_gtin_checksum_correction');
  assert.deepEqual(trustedSourceIdentifierPatch(
    { kodProducenta: '0010', ean: '' },
    { kodProducenta: '0009', parametryZrodla: { ean: '5906395300095' } },
  ), {});
});

test('usuwa pojedyncze nadmiarowe zero z EAN producenta tylko przy jednoznacznym kodzie', () => {
  const patch = trustedSourceIdentifierPatch(
    { kodProducenta: '5018', ean: '59060180050189' },
    {
      kodProducenta: '5018',
      ean: '59060180050189',
      sourceUrl: 'https://www.sklep.alexander.com.pl/product-pol-1605-puzzle-rybka.html',
    },
  );
  assert.equal(patch.ean, '5906018050189');
  assert.equal(patch.gtin, '5906018050189');
  assert.equal(patch.identifierRepairEvidence.method, 'official_source_gtin_extra_zero_correction');
});

test('oficjalna karta jednostkowa zastępuje dawny GTIN-14 opakowania i naprawia markę z domeny producenta', () => {
  const patch = trustedSourceIdentifierPatch(
    { kodProducenta: '5018', ean: '59060180050185', producent: 'Alexander' },
    {
      kodProducenta: '5018',
      ean: '59060180050189',
      producent: 'Alexander',
      sourceUrl: 'https://www.milliwood.com/sklep/puzzle-drewniane/rybka/',
    },
  );
  assert.equal(patch.ean, '5906018050189');
  assert.equal(patch.gtin, '5906018050189');
  assert.equal(patch.producent, 'MilliWOOD');
  assert.equal(patch.marka, 'MilliWOOD');
  assert.equal(patch.identifierRepairEvidence.method, 'official_source_gtin_extra_zero_unit_correction');
  assert.equal(patch.identifierRepairEvidence.replacedStoredGtin, '59060180050185');
});

test('dokładna oficjalna domena poprawia producenta przy zgodnym kodzie bez zmiany prawidłowego GTIN', () => {
  assert.deepEqual(trustedSourceIdentifierPatch(
    { kodProducenta: '0528', ean: '5903796605280', producent: 'Alexander' },
    { kodProducenta: '0528', ean: '5903796605280', sourceUrl: 'https://multigra.com.pl/produkty/sloneczny-patrol/' },
  ), { producent: 'Multigra', marka: 'Multigra' });
});

test('stary sklep Alexandra prowadzi do dokładnej oficjalnej karty produktu, ale tylko dla marki Alexander', () => {
  assert.equal(officialManufacturerSourceCandidate(
    { producent: 'Alexander' },
    'https://sklep.alexander.com.pl/product-pol-27-Chinczyk-Warcaby.html',
  ), 'https://www.alexander.com.pl/produkty/chinczyk-warcaby/');
  assert.equal(officialManufacturerSourceCandidate(
    { producent: 'Multigra' },
    'https://sklep.alexander.com.pl/product-pol-27-Chinczyk-Warcaby.html',
  ), '');
});

test('oficjalna domena naprawia markę także po wcześniejszym zapisaniu poprawionego jednostkowego GTIN', () => {
  assert.deepEqual(trustedSourceIdentifierPatch(
    { kodProducenta: '5018', ean: '5906018050189', producent: 'Alexander' },
    { kodProducenta: '5018', ean: '59060180050189', sourceUrl: 'https://www.milliwood.com/sklep/puzzle/rybka/' },
  ), { producent: 'MilliWOOD', marka: 'MilliWOOD' });
});

test('aktualny dowód galerii z dokładnym kodem pozwala poprawić markę z tej samej oficjalnej domeny', () => {
  assert.deepEqual(trustedSourceIdentifierPatch(
    {
      kodProducenta: '5018', ean: '5906018050189', producent: 'Alexander',
      sourceEvidence: {
        imagePolicyVersion: 5,
        imageIdentityMode: 'producer_code',
        imageSourceUrl: 'https://www.milliwood.com/sklep/puzzle/rybka/',
      },
    },
    { kodProducenta: '', sourceUrl: 'https://www.milliwood.com/sklep/puzzle/rybka/' },
  ), { producent: 'MilliWOOD', marka: 'MilliWOOD' });
});
