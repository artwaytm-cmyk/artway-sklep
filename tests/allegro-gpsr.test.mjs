import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { allegroApplyProductSetSafety, allegroBuildContentProductSet, allegroCatalogParametersForPatch, allegroMergeGpsrMissing, allegroResponsibleProducerDirectory, allegroSelectResponsibleProducer, allegroSyncEditorialOffer } from '../src/backend/lib/domain/allegro-gpsr.mjs';

test('GPSR dobiera wyłącznie jednoznacznego producenta po nazwie lub nazwie handlowej', () => {
  const match = allegroSelectResponsibleProducer({ producent: 'Multigra' }, [
    { id: 'producer-1', name: 'multigra', tradeName: 'MULTIGRA sp. z o.o.' },
    { id: 'producer-2', name: 'Alexander', tradeName: 'Z.P. Alexander' },
  ]);
  assert.equal(match.id, 'producer-1');
  assert.equal(allegroSelectResponsibleProducer({ producent: 'Nieznany' }, [{ id: 'producer-1', name: 'Multigra' }]), null);
});

test('sprzeczne automatyczne powiązanie nie zapisuje treści do obcej oferty', async () => {
  let writes = 0;
  const result = await allegroSyncEditorialOffer({
    offerId: 'offer-1', product: { id: '88' },
    prepared: { existingOffer: { offer: { id: 'offer-1', productId: 'catalog-obcy' } }, catalogMatch: { selected: { id: 'catalog-wlasny' } } },
    patchFromDraft: () => ({}), writePatch: async () => { writes++; return {}; },
  });
  assert.equal(result.skipped, 'catalog_identity_conflict');
  assert.equal(writes, 0);
});

test('błąd starych parametrów ponawia zapis samego opisu bez productSet', async () => {
  const writes = [];
  const prepared = {
    payload: { name: 'Gra', productSet: [{ product: { id: 'catalog-1' } }], category: { id: '6106' } },
    existingOffer: { offer: { id: 'offer-1', productId: 'catalog-1', categoryId: '6106', productSet: [{ product: { id: 'catalog-1' }, responsibleProducer: { id: 'producer-1' } }] } },
    catalogMatch: { selected: { id: 'catalog-1', categoryId: '6106' } },
  };
  const result = await allegroSyncEditorialOffer({
    offerId: 'offer-1', prepared, product: { allegroOfferId: 'offer-1' },
    patchFromDraft: (_draft, options) => options.includeCatalogProduct ? { productSet: [{ product: { id: 'catalog-1' } }] } : { description: { sections: [] } },
    writePatch: async (patch) => { writes.push(patch); if (writes.length === 1) throw new Error('InvalidParameterIdsInCategory'); return { location: '' }; },
  });
  assert.equal(result.skipped, '');
  assert.equal(writes.length, 2);
  assert.equal(writes[1].productSet, undefined);
});

test('migracja starej kategorii przekazuje tylko wypełnione parametry katalogowe', () => {
  assert.deepEqual(allegroCatalogParametersForPatch([
    { id: '1', name: 'Puste', values: null, valuesIds: null },
    { id: '2', name: 'Nazwa', values: ['Gra'] },
    { id: '3', name: 'Słownik', values: ['Multigra'], valuesIds: ['3_1'] },
  ]), [
    { id: '2', values: ['Gra'] },
    { id: '3', values: ['Multigra'], valuesIds: ['3_1'] },
  ]);
});

test('katalog producentów GPSR normalizuje odpowiedź Allegro i korzysta z pamięci', async () => {
  let calls = 0;
  const call = async () => { calls++; return { responsibleProducers: [{ id: 'id-1', name: 'Multigra', producerData: { tradeName: 'Multigra sp. z o.o.' } }] }; };
  const first = await allegroResponsibleProducerDirectory(call, 1_000);
  const second = await allegroResponsibleProducerDirectory(call, 2_000);
  assert.deepEqual(first, [{ id: 'id-1', name: 'Multigra', tradeName: 'Multigra sp. z o.o.' }]);
  assert.deepEqual(second, first);
  assert.equal(calls, 1);
});

test('aktualizacja treści zachowuje GPSR i ilość zestawu, ale nie kopiuje parametrów katalogowych', () => {
  const productSet = allegroBuildContentProductSet({
    draftItem: { product: { id: 'catalog-123' } },
    existingItem: {
      product: { id: 'catalog-123', parameters: [{ id: 'unsafe-copy' }] },
      quantity: { value: 1 },
      safetyInformation: { type: 'TEXT', description: 'Używać pod nadzorem osoby dorosłej.' },
      marketedBeforeGPSRObligation: false,
      deposits: [],
    },
    responsibleProducer: { id: 'producer-1' },
  });
  assert.deepEqual(productSet, [{
    product: { id: 'catalog-123' },
    quantity: { value: 1 },
    responsibleProducer: { type: 'ID', id: 'producer-1' },
    safetyInformation: { type: 'TEXT', description: 'Używać pod nadzorem osoby dorosłej.' },
    marketedBeforeGPSRObligation: false,
    deposits: [],
  }]);
});

test('przygotowanie nowej oferty pobiera GPSR z dokładnego produktu katalogowego', () => {
  const result = allegroApplyProductSetSafety({
    draft: { productSet: [{ product: { id: 'catalog-1' } }] },
    product: { producent: 'Alexander', marka: 'Alexander' },
    catalog: {
      productSafety: {
        responsibleProducers: [{ id: 'producer-1', name: 'Alexander.' }],
        safetyInformation: { type: 'TEXT', description: 'Używać zgodnie z instrukcją.' },
      },
    },
  });
  assert.equal(result.ready, true);
  assert.deepEqual(result.draft.productSet[0].responsibleProducer, { type: 'ID', id: 'producer-1' });
  assert.deepEqual(result.draft.productSet[0].safetyInformation, { type: 'TEXT', description: 'Używać zgodnie z instrukcją.' });
});

test('dokładny product.id korzysta z GPSR katalogu także gdy skrócony wynik wyszukiwania nie zwrócił productSafety', () => {
  const result = allegroApplyProductSetSafety({
    draft: { productSet: [{ product: { id: 'catalog-1' } }] },
    product: { producent: 'Alexander', marka: 'Alexander' },
    catalog: {},
  });
  assert.equal(result.catalogManagedSafety, true);
  assert.equal(result.ready, true);
  assert.deepEqual(result.missing, []);
  assert.equal(result.source, 'katalog Allegro');
  assert.equal(result.draft.productSet[0].safetyInformation, undefined);
});

test('produkt bez potwierdzonego UUID nadal wymaga pełnych danych GPSR ze źródła', () => {
  const result = allegroApplyProductSetSafety({
    draft: { productSet: [{ product: { id: '5901234123457', idType: 'GTIN' } }] },
    product: { producent: 'Alexander' },
  });
  assert.equal(result.catalogManagedSafety, false);
  assert.deepEqual(result.missing, ['odpowiedzialny producent GPSR', 'informacja o bezpieczeństwie GPSR']);
});

test('przygotowanie korzysta z potwierdzonego producenta GPSR zapisanego w kartotece', () => {
  const result = allegroApplyProductSetSafety({
    draft: { productSet: [{ product: { id: 'catalog-1' } }] },
    product: {
      producent: 'Alexander',
      allegroResponsibleProducer: { id: 'producer-confirmed', name: 'Alexander.', score: 100 },
      allegroSafetyInformation: { type: 'TEXT', description: 'Używać zgodnie z instrukcją.' },
    },
    catalog: {},
    responsibleProducers: [],
  });
  assert.equal(result.ready, true);
  assert.deepEqual(result.draft.productSet[0].responsibleProducer, { type: 'ID', id: 'producer-confirmed' });
});

test('nowa oferta produktu nie wysyła historycznego wyjątku GPSR przeznaczonego dla rzeczy używanych', () => {
  const result = allegroApplyProductSetSafety({
    draft: { productSet: [{ product: { id: 'catalog-1' }, marketedBeforeGPSRObligation: true }] },
    product: {
      producent: 'Alexander',
      marketedBeforeGPSRObligation: true,
      allegroResponsibleProducer: { id: 'producer-1', name: 'Alexander' },
      allegroSafetyInformation: { type: 'TEXT', description: 'Używać zgodnie z instrukcją.' },
    },
  });
  assert.equal(Object.hasOwn(result.draft.productSet[0], 'marketedBeforeGPSRObligation'), false);
  assert.equal(result.marketedBeforeGpsrIgnored, true);
  assert.equal(result.ready, true);
});

test('przygotowanie odrzuca stary GPSR obcej firmy po zmianie producenta produktu', () => {
  const result = allegroApplyProductSetSafety({
    draft: { productSet: [{ product: { id: 'catalog-1' } }] },
    product: {
      producent: 'Multigra',
      marka: 'Multigra',
      allegroResponsibleProducer: { id: 'producer-old', name: 'Alexander.', score: 100 },
      allegroSafetyInformation: { type: 'TEXT', description: 'Używać zgodnie z instrukcją.' },
    },
    catalog: {},
    responsibleProducers: [
      { id: 'producer-old', name: 'Alexander.' },
      { id: 'producer-current', name: 'Multigra', tradeName: 'MultiGra Sp. z o.o.' },
    ],
  });
  assert.equal(result.ready, true);
  assert.deepEqual(result.draft.productSet[0].responsibleProducer, { type: 'ID', id: 'producer-current' });
  assert.equal(result.responsibleProducer.name, 'Multigra');
});

test('ponowna kontrola GPSR usuwa stary brak, gdy pole zostało już uzupełnione', () => {
  assert.deepEqual(allegroMergeGpsrMissing(
    ['odpowiedzialny producent GPSR', 'informacja o bezpieczeństwie GPSR', 'wymagany parametr: Wysokość produktu'],
    ['informacja o bezpieczeństwie GPSR'],
  ), ['wymagany parametr: Wysokość produktu', 'informacja o bezpieczeństwie GPSR']);
});

test('bramka nowej oferty nie omija GPSR na podstawie starej flagi kartoteki', async () => {
  const source = await readFile(new URL('../src/backend/lib/store-app.mjs', import.meta.url), 'utf8');
  assert.match(source, /if \(!existingOffer\) \{\s*draft\.missing = allegroMergeGpsrMissing/);
  assert.match(source, /gpsrReady: gpsr\.ready \|\| !!existingOffer/);
  assert.doesNotMatch(source, /gpsrReady:[^\n]+marketedBeforeGPSRObligation/);
});
