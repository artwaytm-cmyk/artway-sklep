import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogProductFieldSaver } from '../src/backend/lib/domain/catalog-product-field-save.mjs';
import { createStoreDataRoute } from '../src/backend/lib/store-data-route.mjs';

test('zapis pól produktu kończy się dopiero po zgodnym odczycie centralnej kartoteki', async () => {
  let stored = { id: '17', nazwa: 'Przed zmianą' };
  const save = createCatalogProductFieldSaver({
    now: () => '2026-07-24T14:00:00.000Z',
    writeOperations: async ([operation]) => {
      stored = { ...stored, ...operation.fields };
      return { modified: true, value: { rev: 91, data: {} }, skippedProductIds: [] };
    },
    readProduct: async () => stored,
  });
  const result = await save({
    productId: '17',
    fields: { nazwa: 'Nowa nazwa', allegroDescription: 'Potwierdzony opis' },
    mutationId: 'agent-17-run-1',
    actor: 'admin@example.test',
  });
  assert.equal(result.rev, 91);
  assert.equal(result.mutationId, 'agent-17-run-1');
  assert.equal(result.fields.lastAdminMutationAt, '2026-07-24T14:00:00.000Z');
  assert.equal(stored.allegroDescription, 'Potwierdzony opis');
});

test('rozbieżny odczyt nie może zostać zgłoszony jako udany zapis', async () => {
  const save = createCatalogProductFieldSaver({
    writeOperations: async () => ({ modified: true, value: { rev: 2, data: {} }, skippedProductIds: [] }),
    readProduct: async () => ({ id: '17', nazwa: 'Stara nazwa' }),
  });
  await assert.rejects(
    () => save({ productId: '17', fields: { nazwa: 'Nowa nazwa' }, mutationId: 'mismatch' }),
    (error) => error.code === 'catalog_product_readback_mismatch' && error.mismatches.includes('nazwa'),
  );
});

test('endpoint panelu zwraca confirmed wyłącznie po trwałym zapisie', async () => {
  const route = createStoreDataRoute({
    odpowiedz: (body, status = 200) => ({ body, status }),
    czyAdmin: () => true,
    tekst: (value, max = 400) => String(value || '').slice(0, max),
    requestSession: () => ({ email: 'admin@example.test' }),
    zapiszPolaProduktuCentralnie: async (input) => ({
      productId: input.productId,
      fields: { ...input.fields, lastAdminMutationId: input.mutationId },
      confirmedFields: Object.keys(input.fields),
      mutationId: input.mutationId,
      confirmedAt: '2026-07-24T14:10:00.000Z',
      rev: 92,
    }),
  });
  const request = { method: 'POST', json: async () => ({ productId: '17', fields: { opis: 'Opis zapisany' }, mutationId: 'agent-17-run-2' }) };
  const response = await route(request, new URL('https://artwaytm.pl/api/store?action=catalog-product-fields-update'), 'catalog-product-fields-update');
  assert.equal(response.status, 200);
  assert.equal(response.body.confirmed, true);
  assert.equal(response.body.rev, 92);
});

test('frontend zapisuje każdy przygotowany produkt atomowo i dopiero potem liczy sukces', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) => readFile('src/frontend/12a-product-actions.js', 'utf8'));
  assert.match(source, /catalog-product-fields-update/);
  assert.match(source, /result\?\.confirmed!==true/);
  assert.match(source, /const persistence=await asortymentZapiszProduktCentralnie/);
  assert.match(source, /chmuraZapiszUstawienia\(\{flush:true\}\)/);
});
