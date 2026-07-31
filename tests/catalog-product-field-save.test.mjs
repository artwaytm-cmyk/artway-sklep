import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogProductFieldSaver, createPublishedCatalogProductFieldSaver, sanitizeCatalogProductFields } from '../src/backend/lib/domain/catalog-product-field-save.mjs';
import { createCentralProductFieldPublisher } from '../src/backend/lib/domain/central-product-field-publication.mjs';
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
  assert.equal(result.product.allegroDescription, 'Potwierdzony opis');
});

test('identyczna wartość nie tworzy mutacji ani nowego pokwitowania Agenta', async () => {
  const stored = { id: '17', nazwa: 'Ta sama nazwa', opis: 'Ten sam opis' };
  let writes = 0;
  const save = createCatalogProductFieldSaver({
    now: () => '2026-07-31T15:00:00.000Z',
    writeOperations: async () => {
      writes += 1;
      return { modified: true, skippedProductIds: [] };
    },
    readProduct: async () => stored,
  });
  const result = await save({
    productId: '17',
    fields: { nazwa: 'Ta sama nazwa', opis: 'Ten sam opis' },
    mutationId: 'duplicate-agent-write',
  });
  assert.equal(writes, 0);
  assert.equal(result.modified, false);
  assert.equal(result.idempotent, true);
  assert.deepEqual(result.changedFields, []);
  assert.equal(result.product, stored);
});

test('każda ścieżka zapisu synchronizuje kod produktu, EAN i zweryfikowany profil producenta', async () => {
  let stored = { id: '18', nazwa: 'Gra', producent: 'MilliWOOD', marka: 'MilliWOOD' };
  const save = createCatalogProductFieldSaver({
    now: () => '2026-07-29T12:00:00.000Z',
    writeOperations: async ([operation]) => {
      stored = { ...stored, ...operation.fields };
      return { modified: true, value: { rev: 92, data: {} }, skippedProductIds: [] };
    },
    readProduct: () => stored,
  });
  const result = await save({
    productId: '18',
    fields: { kodProducenta: '00123', gtin: '5906018023456' },
    mutationId: 'identity-18',
  });
  assert.equal(result.product.kodProducenta, '00123');
  assert.equal(result.product.numerReferencyjny, '00123');
  assert.equal(result.product.mpn, '00123');
  assert.equal(result.product.externalId, '00123');
  assert.equal(result.product.sku, '00123');
  assert.equal(result.product.ean, '5906018023456');
  assert.equal(result.product.producent, 'Alexander');
  assert.equal(result.product.marka, 'MilliWOOD');
  assert.equal(result.product.manufacturerProfileId, 'alexander');
  assert.ok(result.product.manufacturerProfile.address);
});

test('zmiana producenta nie może zachować starego profilu GPSR', async () => {
  let stored = {
    id: '19',
    producent: 'Alexander',
    manufacturerProfileId: 'alexander',
    manufacturerProfile: { id: 'alexander', legalName: 'Zakład Produkcyjny "Alexander" Piotr Pundzis' },
  };
  const save = createCatalogProductFieldSaver({
    now: () => '2026-07-29T12:30:00.000Z',
    writeOperations: async ([operation]) => {
      for (const field of operation.remove) delete stored[field];
      stored = { ...stored, ...operation.fields };
      return { modified: true, value: { rev: 93, data: {} }, skippedProductIds: [] };
    },
    readProduct: async () => stored,
  });
  const result = await save({
    productId: '19',
    fields: { producent: 'Multigra', marka: 'Multigra' },
    remove: ['manufacturerProfileId', 'manufacturerProfile'],
    mutationId: 'manufacturer-change-19',
  });
  assert.equal(result.product.producent, 'Multigra');
  assert.equal(result.product.manufacturerProfileId, 'multigra');
  assert.equal(result.product.manufacturerProfile.legalName, 'MultiGra Sp. z o.o.');
});

test('pełny wynik przygotowania dopuszcza źródło, parametry, SEO i sygnaturę wersji', () => {
  const fields = sanitizeCatalogProductFields({
    sourceUrl: 'https://example.test/product',
    externalId: 'SKU-17',
    parametryProducenta: { wiek: '8+' },
    seoTitle: 'Gra edukacyjna',
    allegroAgentPreparationFingerprint: 'allegro-preparation-v3-a1b2c3d4',
    allegroAgentPreparationVersion: 3,
    auxiliarySources: [
      { url: 'https://supplier.test/product', label: 'Hurtownia', origin: 'agent', verifiedAt: '2026-07-29T10:00:00Z' },
      { url: 'javascript:alert(1)', label: 'Błędne źródło' },
      { url: 'https://supplier.test/product', label: 'Duplikat' },
    ],
  });
  assert.equal(fields.sourceUrl, 'https://example.test/product');
  assert.equal(fields.parametryProducenta.wiek, '8+');
  assert.equal(fields.allegroAgentPreparationVersion, 3);
  assert.deepEqual(fields.auxiliarySources, [
    { url: 'https://supplier.test/product', label: 'Hurtownia', origin: 'agent', verifiedAt: '2026-07-29T10:00:00Z' },
  ]);
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

test('serwerowy Agent kończy zapis dopiero po odczycie tej samej wersji z opublikowanej kartoteki', async () => {
  let published = { id: '17', opis: 'Stary opis' };
  const save = createPublishedCatalogProductFieldSaver({
    saveFields: async (input) => ({
      productId: input.productId,
      fields: { ...input.fields, lastAdminMutationId: input.mutationId },
      mutationId: input.mutationId,
      confirmedAt: '2026-07-26T07:00:00.000Z',
      product: { id: input.productId, ...input.fields },
    }),
    publishFields: async ({ fields }) => {
      published = { ...published, ...fields };
      return { published: true, revision: 'catalog-agent-17' };
    },
    readPublishedProduct: async () => published,
  });
  const result = await save({
    productId: '17',
    fields: { opis: 'Opis zapisany przez serwerowego Agenta' },
    mutationId: 'agent-editorial:gpt-17:store',
  });
  assert.equal(result.publication.published, true);
  assert.equal(result.publication.readbackConfirmed, true);
  assert.equal(result.product.opis, 'Opis zapisany przez serwerowego Agenta');
});

test('serwerowy Agent akceptuje obiekt JSONB mimo innej kolejności jego kluczy', async () => {
  const contentEditorial = {
    status: 'partial_ready',
    channelStates: {
      store: {
        status: 'ready',
        compliance: { status: 'passed', violations: [] },
      },
    },
  };
  const save = createPublishedCatalogProductFieldSaver({
    saveFields: async () => ({
      productId: '124',
      fields: { contentEditorial },
      confirmedAt: '2026-07-26T06:26:19.347Z',
    }),
    publishFields: async () => ({ published: true }),
    readPublishedProduct: async () => ({
      id: '124',
      contentEditorial: {
        channelStates: {
          store: {
            compliance: { violations: [], status: 'passed' },
            status: 'ready',
          },
        },
        status: 'partial_ready',
      },
    }),
  });

  const result = await save({ productId: '124', fields: { contentEditorial } });
  assert.equal(result.publication.readbackConfirmed, true);
});

test('brak zgodnego odczytu po publikacji nie może zostać uznany za wykonaną pracę Agenta', async () => {
  const save = createPublishedCatalogProductFieldSaver({
    saveFields: async (input) => ({
      productId: input.productId, fields: input.fields, mutationId: input.mutationId,
      confirmedAt: '2026-07-26T07:05:00.000Z',
    }),
    publishFields: async () => ({ published: true, revision: 'catalog-stale' }),
    readPublishedProduct: async () => ({ id: '17', opis: 'Nadal stary opis' }),
  });
  await assert.rejects(
    () => save({ productId: '17', fields: { opis: 'Nowy opis' }, mutationId: 'agent-editorial:gpt-17:store' }),
    (error) => error.code === 'catalog_product_publication_readback_mismatch' && error.mismatches.includes('opis'),
  );
});

test('centralna kartoteka jest publikowana jednym zapisem bez ukrytego drugiego PATCH', async () => {
  let saveCalls = 0;
  let publishCalls = 0;
  const stored = { id: '91', opis: 'Trwale zapisany opis' };
  const save = createPublishedCatalogProductFieldSaver({
    saveFields: async (input) => {
      saveCalls += 1;
      return {
        productId: input.productId,
        fields: input.fields,
        mutationId: input.mutationId,
        confirmedAt: '2026-07-29T18:00:00.000Z',
        rev: 104,
        product: stored,
      };
    },
    publishFields: async () => {
      publishCalls += 1;
      return { published: true };
    },
    readPublishedProduct: async () => stored,
    saveIsPublished: true,
  });
  const result = await save({
    productId: '91',
    fields: { opis: 'Trwale zapisany opis' },
    mutationId: 'agent-editorial:91',
  });
  assert.equal(saveCalls, 1);
  assert.equal(publishCalls, 0);
  assert.equal(result.publication.central, true);
  assert.equal(result.publication.readbackConfirmed, true);
});

test('Agent nie może zapisać interfejsu strony producenta jako opisu produktu', async () => {
  const save = createCatalogProductFieldSaver({
    writeOperations: async () => {
      throw new Error('writer nie powinien zostać wywołany');
    },
    readProduct: async () => ({ id: '92' }),
  });
  await assert.rejects(
    () => save({
      productId: '92',
      area: 'allegro-preparation',
      fields: {
        opis: 'Gra rodzinna. Rozmiar uniwersalny 42 szt. 39,00 zł brutto / 1 szt. Najniższa cena z 30 dni przed obniżką: 0,00 zł / 1 szt. Możesz kupić za pkt.',
      },
    }),
    (error) => error.code === 'catalog_product_editorial_source_noise'
      && error.fields.includes('opis'),
  );
});

test('brak produktu w projekcji uruchamia synchroniczną odbudowę i dopiero potem potwierdza publikację', async () => {
  let attempts = 0;
  const publish = createCentralProductFieldPublisher({
    catalog: {
      patchProductFields: async () => {
        attempts += 1;
        return attempts === 1 ? { updated: false, reason: 'not_found' } : { updated: true, syncedAt: '2026-07-26T07:20:00.000Z' };
      },
    },
    revisionState: async () => ({ sourceRevision: 'rev-agent-20' }),
    synchronize: async ({ force, revision }) => {
      assert.equal(force, true);
      assert.equal(revision.sourceRevision, 'rev-agent-20');
    },
  });
  const result = await publish({ productId: '20', fields: { opis: 'Opis' } });
  assert.equal(attempts, 2);
  assert.equal(result.published, true);
  assert.equal(result.recovered, true);
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

test('endpoint uznaje przygotowanie za zakończone dopiero po publikacji centralnej kartoteki', async () => {
  const route = createStoreDataRoute({
    odpowiedz: (body, status = 200) => ({ body, status }),
    czyAdmin: () => true,
    tekst: (value, max = 400) => String(value || '').slice(0, max),
    requestSession: () => ({ email: 'admin@example.test' }),
    zapiszPolaProduktuCentralnie: async (input) => ({
      productId: input.productId, fields: input.fields, product: { id: input.productId, ...input.fields },
      confirmedFields: Object.keys(input.fields), mutationId: input.mutationId, confirmedAt: '2026-07-24T14:10:00.000Z', rev: 93,
    }),
    publikujPolaProduktuCentralnie: async () => ({ published: true, queued: false, revision: 'catalog-rev-93' }),
  });
  const request = { method: 'POST', json: async () => ({ productId: '17', fields: { opis: 'Opis opublikowany' }, mutationId: 'agent-17-run-3' }) };
  const response = await route(request, new URL('https://artwaytm.pl/api/store?action=catalog-product-fields-update'), 'catalog-product-fields-update');
  assert.equal(response.status, 200);
  assert.equal(response.body.confirmed, true);
  assert.equal(response.body.publication.published, true);
  assert.equal(response.body.product.opis, 'Opis opublikowany');
});

test('frontend zapisuje każdy przygotowany produkt atomowo i dopiero potem liczy sukces', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) => readFile('src/frontend/12a-product-actions.js', 'utf8'));
  assert.match(source, /catalog-product-fields-update/);
  assert.match(source, /result\?\.confirmed!==true/);
  assert.match(source, /result\.publication\?\.published!==true/);
  assert.match(source, /asortymentPobierzPelnyProdukt/);
  assert.match(source, /allegroAgentPreparationFingerprint/);
  const prepare = source.slice(source.indexOf('async function asortymentPrzygotujProduktDoAllegro'), source.indexOf('async function asortymentAgentPrzetworzProdukt'));
  assert.match(prepare, /allegro-preparation-queue-enqueue/);
  assert.match(prepare, /allegro-preparation-queue-status/);
  assert.match(prepare, /asortymentPobierzPelnyProdukt/);
  assert.doesNotMatch(prepare, /zapiszPolaProduktuLokalnie|allegroZapiszAutoUzupelnienia|allegro-description-improve|automatyczniePobierzDaneZrodlaProduktu/);
});

test('sukces wystawienia Allegro kończy się dopiero po publikacji w centralnej kartotece', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) => readFile('src/backend/lib/store-app.mjs', 'utf8'));
  const start = source.indexOf('async function allegroZapiszPowiazanieProduktu');
  const end = source.indexOf('\nconst ALLEGRO_AUTO_REPLY_DEFAULT', start);
  assert.ok(start >= 0 && end > start);
  const finalization = source.slice(start, end);
  assert.match(finalization, /buildAllegroPublicationSuccessFields/);
  assert.match(finalization, /await zapiszIOpublikujPolaProduktuCentralnie/);
  assert.doesNotMatch(finalization, /await zapiszPolaProduktuCentralnie\(/);
  assert.match(source, /verifiedOffer,\s*imagePublication,\s*expectedStatus:/);
});
