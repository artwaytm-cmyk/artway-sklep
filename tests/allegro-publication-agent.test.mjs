import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAllegroPublicationSuccessFields, createAllegroPublicationAgent } from '../src/backend/lib/domain/allegro-publication-agent.mjs';

test('potwierdzona oferta tworzy komplet pól zamykających przygotowanie i publikację', () => {
  const fields = buildAllegroPublicationSuccessFields({
    details: {
      offerId: '18793056852',
      verifiedOffer: { publication: { status: 'ACTIVE' } },
      draft: { stock: { available: 5 } },
    },
    link: { catalogProductId: 'catalog-1', categoryId: '123958', producent: 'Multigra' },
    now: '2026-07-26T08:00:00.000Z',
  });
  assert.equal(fields.allegroOfferId, '18793056852');
  assert.equal(fields.allegroStatus, 'ACTIVE');
  assert.equal(fields.allegroStock, 5);
  assert.equal(fields.allegroAgentPreparationStatus, 'published');
  assert.deepEqual(fields.allegroAgentPreparationMissing, []);
  assert.equal(fields.allegroPublicationAgentStatus, 'completed');
});

test('Operator publikacji zapisuje raport w zadaniu i bezpośrednio w kartotece produktu', async () => {
  const data = {}, savedProducts = [], specialistCalls = [];
  const service = createAllegroPublicationAgent({
    text: (value, limit = 1000) => String(value ?? '').slice(0, limit).trim(),
    canonicalGtin: (value) => String(value || '').replace(/\D/g, ''),
    linkFromPreparation: () => ({ producent: 'Alexander', categoryId: '6105', catalogProductId: 'catalog-1' }),
    runSpecialist: async (request) => {
      specialistCalls.push(request);
      return { id: 'gpt-publication-1', result: { summary: 'Kategoria wymaga korekty według metadanych API.' } };
    },
    mutateSettings: async (mutator) => { await mutator(data); return { modified: true }; },
    saveProductFields: async (payload) => { savedProducts.push(payload); return { confirmed: true }; },
    now: () => new Date('2026-07-24T14:00:00.000Z'),
  });
  const task = await service.recordFailure(
    { id: '1000253', nazwa: 'Łowcy', ean: '5906018027204', producent: 'Alexander' },
    {
      operationId: 'operation-1',
      errors: [{ code: 'CATEGORY_MISMATCH', message: 'Kategoria katalogu jest inna', metadata: { existingCategoryId: '6105' } }],
      prepared: { autoFilled: {}, catalogMatch: { selected: { id: 'catalog-1', name: 'DO DOMU ŁOWCY Alexander', categoryId: '6105', identity: { verified: true, gtinMatch: true } } } },
    },
  );
  assert.equal(task.specialist, 'allegro_publication');
  assert.equal(task.specialistRunId, 'gpt-publication-1');
  assert.equal(task.operationId, 'operation-1');
  assert.equal(data.artway_agent_ai_allegro_zadania[0].errors[0].code, 'CATEGORY_MISMATCH');
  assert.equal(specialistCalls[0].specialist, 'allegro_publication');
  assert.equal(savedProducts[0].fields.allegroPublicationAgentTaskId, task.id);
  assert.equal(savedProducts[0].fields.allegroPublicationLastErrorCode, 'CATEGORY_MISMATCH');
  assert.equal(savedProducts[0].fields.allegroPublicationFailureCount, 1);
});
