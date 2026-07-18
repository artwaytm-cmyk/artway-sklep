import test from 'node:test';
import assert from 'node:assert/strict';
import { allegroBuildContentProductSet, allegroCatalogParametersForPatch, allegroResponsibleProducerDirectory, allegroSelectResponsibleProducer, allegroSyncEditorialOffer } from '../netlify/functions/lib/domain/allegro-gpsr.mjs';

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
