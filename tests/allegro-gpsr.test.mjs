import test from 'node:test';
import assert from 'node:assert/strict';
import { allegroBuildContentProductSet, allegroResponsibleProducerDirectory, allegroSelectResponsibleProducer } from '../netlify/functions/lib/domain/allegro-gpsr.mjs';

test('GPSR dobiera wyłącznie jednoznacznego producenta po nazwie lub nazwie handlowej', () => {
  const match = allegroSelectResponsibleProducer({ producent: 'Multigra' }, [
    { id: 'producer-1', name: 'multigra', tradeName: 'MULTIGRA sp. z o.o.' },
    { id: 'producer-2', name: 'Alexander', tradeName: 'Z.P. Alexander' },
  ]);
  assert.equal(match.id, 'producer-1');
  assert.equal(allegroSelectResponsibleProducer({ producent: 'Nieznany' }, [{ id: 'producer-1', name: 'Multigra' }]), null);
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
