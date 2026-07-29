import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ALLEGRO_PREPARATION_VERSION,
  allegroAutomaticPreparationDisposition,
  allegroPreparationAttemptDisposition,
  allegroPreparationRetryState,
  createAllegroPreparationQueue,
  selectAllegroPreparationCandidates,
} from '../src/backend/lib/domain/allegro-preparation-queue.mjs';
import { createAllegroPreparationWorker } from '../src/backend/lib/domain/allegro-preparation-worker.mjs';

function memoryRepository(initial = null) {
  let value = initial, version = 0;
  return {
    readVersioned: async (_key, fallback) => ({ value: value ?? fallback, version }),
    writeIfVersion: async (_key, next, expected) => {
      if (Number(expected.version) !== version) return { modified: false };
      value = structuredClone(next); version += 1;
      return { modified: true, version };
    },
    value: () => structuredClone(value),
  };
}

async function waitUntil(predicate, timeout = 1000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('timeout');
}

test('kolejka przygotowania kończy produkt albo po trzech próbach tworzy konkretną decyzję', async () => {
  const repository = memoryRepository(), calls = [];
  const queue = createAllegroPreparationQueue({
    ...repository,
    prepare: async (task) => {
      calls.push(task.productId);
      return { ready: task.productId !== '1', status: task.productId === '1' ? 'attention' : 'completed', name: `P${task.productId}`, missing: task.productId === '1' ? ['GPSR'] : [], mutationId: `m-${task.productId}` };
    },
  });
  const created = await queue.enqueue(['1', '2', '1'], { requestedBy: 'admin@example.test' });
  assert.equal(created.batches[0].total, 2);
  assert.equal(created.batches[0].duplicatesSkipped, 1);
  assert.deepEqual(created.batches[0].pendingProductIds, ['1', '2']);
  const finished = await waitUntil(async () => {
    const status = await queue.status();
    return !status.running && status.recent.length === 2 ? status : null;
  });
  assert.deepEqual(calls, ['1', '1', '1', '2']);
  assert.equal(finished.batches[0].completed, 1);
  assert.equal(finished.batches[0].attention, 0);
  assert.equal(finished.batches[0].decisionRequired, 1);
  assert.equal(finished.pending, 0);
});

test('błąd quota zatrzymuje tylko redakcję AI, a kolejne produkty nadal zapisują dane deterministyczne', async () => {
  const repository = memoryRepository(), calls = [];
  const queue = createAllegroPreparationQueue({
    ...repository,
    prepare: async (task) => {
      calls.push({ productId: task.productId, skipEditorial: task.skipEditorial });
      if (task.skipEditorial) return {
        ready: false,
        status: 'waiting_provider',
        missing: ['redakcja AI oczekuje'],
        savedFields: ['ean', 'allegroCategoryId'],
        providerUnavailable: true,
      };
      const error = new Error('You exceeded your current quota');
      error.code = 'insufficient_quota';
      throw error;
    },
    now: () => new Date('2026-07-26T12:00:00.000Z'),
  });
  await queue.enqueue(['1', '2', '3']);
  const blocked = await waitUntil(async () => {
    const status = await queue.status();
    return status.blockedUntil && !status.running ? status : null;
  });
  assert.deepEqual(calls, [
    { productId: '1', skipEditorial: false },
    { productId: '2', skipEditorial: true },
    { productId: '3', skipEditorial: true },
  ]);
  assert.equal(blocked.pending, 0);
  assert.equal(blocked.blockedReason, 'OpenAI API quota');
  assert.equal(blocked.blockedUntil, '2026-07-26T18:00:00.000Z');
});

test('zapisany wynik z ostrzeżeniem quota przełącza pozostałe zadania w tryb bez redaktora', async () => {
  const repository = memoryRepository(), calls = [];
  const queue = createAllegroPreparationQueue({
    ...repository,
    prepare: async (task) => {
      calls.push({ productId: task.productId, skipEditorial: task.skipEditorial });
      if (task.skipEditorial) return {
        ready: false,
        status: 'waiting_provider',
        missing: ['redakcja AI oczekuje'],
        savedFields: ['allegroCategoryId', 'allegroParameters'],
        providerUnavailable: true,
      };
      return {
        ready: false,
        status: 'attention',
        missing: ['redakcja opisu Allegro przez Agenta'],
        savedFields: ['allegroCategoryId', 'allegroParameters'],
        providerUnavailable: true,
        error: 'You exceeded your current quota',
      };
    },
    now: () => new Date('2026-07-26T12:00:00.000Z'),
  });
  await queue.enqueue(['1', '2', '3']);
  const blocked = await waitUntil(async () => {
    const status = await queue.status();
    return status.blockedUntil && !status.running ? status : null;
  });
  assert.deepEqual(calls, [
    { productId: '1', skipEditorial: false },
    { productId: '2', skipEditorial: true },
    { productId: '3', skipEditorial: true },
  ]);
  assert.equal(blocked.recent[0].status, 'waiting_provider');
  assert.deepEqual(blocked.recent[0].savedFields, ['allegroCategoryId', 'allegroParameters']);
  assert.equal(blocked.pending, 0);
  assert.equal(blocked.blockedReason, 'OpenAI API quota');
});

test('kolejka po restarcie przywraca aktywny produkt przed oczekującymi', async () => {
  const repository = memoryRepository({
    version: 1,
    pending: [{ id: 'b', batchId: 'batch', productId: '2', operation: 'allegro' }],
    active: { id: 'a', batchId: 'batch', productId: '1', operation: 'allegro' },
    results: [],
    batches: [{ id: 'batch', total: 2 }],
  });
  const calls = [], queue = createAllegroPreparationQueue({
    ...repository,
    prepare: async (task) => { calls.push(task.productId); return { ready: true, status: 'completed' }; },
  });
  await queue.resume();
  await waitUntil(async () => !(await queue.status()).running);
  assert.deepEqual(calls, ['1', '2']);
  assert.equal(repository.value().active, null);
});

test('ponowne przygotowanie śledzi zajęte produkty zamiast tworzyć pustą partię', async () => {
  const repository = memoryRepository();
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  const queue = createAllegroPreparationQueue({
    ...repository,
    prepare: async (task) => {
      await blocked;
      return { ready: true, status: 'completed', name: `P${task.productId}` };
    },
  });
  await queue.enqueue(['1', '2']);
  await waitUntil(async () => (await queue.status()).running);
  const duplicate = await queue.enqueue(['1', '2']);
  assert.equal(duplicate.batches[0].total, 2);
  assert.equal(duplicate.batches[0].enqueued, 0);
  assert.equal(duplicate.batches[0].duplicatesSkipped, 2);
  assert.equal(duplicate.batches[0].pending + duplicate.batches[0].running, 2);
  assert.equal(duplicate.batches[0].trackedTaskIds.length, 2);
  release();
  const finished = await waitUntil(async () => {
    const status = await queue.status();
    return !status.running ? status : null;
  });
  assert.equal(finished.batches[0].completed, 2);
  assert.equal(finished.batches[0].failed, 0);
});

test('bieżący licznik nie dolicza historycznego ostrzeżenia po późniejszym sukcesie produktu', async () => {
  const repository = memoryRepository();
  let ready = false;
  const queue = createAllegroPreparationQueue({
    ...repository,
    prepare: async () => ready
      ? { ready: true, status: 'completed' }
      : { ready: false, status: 'attention', missing: ['GPSR'] },
  });
  await queue.enqueue(['17']);
  await waitUntil(async () => !(await queue.status()).running);
  ready = true;
  await queue.enqueue(['17']);
  const status = await waitUntil(async () => {
    const value = await queue.status();
    return !value.running && value.recent.length === 2 ? value : null;
  });
  assert.equal(status.recent.filter((item) => item.productId === '17').length, 2);
  assert.equal(status.currentSummary.total, 1);
  assert.equal(status.currentSummary.attention, 0);
  assert.equal(status.currentSummary.completed, 1);
  assert.equal(status.current.find((item) => item.productId === '17').status, 'completed');
});

test('automatyczna kolejka najpierw wybiera braki, potem nowe produkty, a gotowe tylko do okresowej weryfikacji', () => {
  const selected = selectAllegroPreparationCandidates([
    {
      id: 'attention',
      allegroAgentPreparationStatus: 'needs_attention',
      allegroAgentPreparedAt: '2026-07-26T06:00:00.000Z',
    },
    { id: 'new', nazwa: 'Nowy produkt' },
    {
      id: 'fresh',
      allegroAgentPreparationStatus: 'ready',
      allegroAgentPreparedAt: '2026-07-27T07:00:00.000Z',
    },
    {
      id: 'old',
      allegroAgentPreparationStatus: 'ready',
      allegroAgentPreparedAt: '2026-06-01T07:00:00.000Z',
    },
  ], {
    now: new Date('2026-07-27T08:00:00.000Z'),
    preparationCurrent: (product) => product.allegroAgentPreparationStatus === 'ready',
  });
  assert.deepEqual(selected.map((item) => item.id), ['attention', 'new', 'old']);
  assert.deepEqual(selected.map((item) => item.reason), [
    'wymaga_uzupelnienia',
    'nieprzygotowany',
    'weryfikacja_okresowa',
  ]);
});

test('stara decyzja jest automatycznie ponawiana dokładnie po wdrożeniu nowszej wersji naprawy', () => {
  const base = {
    id: 'decision',
    allegroAgentPreparationStatus: 'decision_required',
    allegroAgentPreparedAt: '2026-07-27T07:00:00.000Z',
  };
  const selected = selectAllegroPreparationCandidates([
    { ...base, allegroAgentPreparationVersion: ALLEGRO_PREPARATION_VERSION - 1 },
    { ...base, id: 'current', allegroAgentPreparationVersion: ALLEGRO_PREPARATION_VERSION },
  ], { now: new Date('2026-07-29T08:00:00.000Z') });
  assert.deepEqual(selected.map((item) => item.id), ['decision']);
  assert.equal(selected[0].reason, 'nowa_wersja_automatycznej_naprawy');
});

test('aktywna powiązana oferta trafia tylko do lekkiej weryfikacji, a nie do ponownej redakcji', () => {
  const active = {
    id: 'active',
    allegroOfferId: '123456789',
    _catalog: { channels: { allegro: { offerId: '123456789', status: 'ACTIVE' } } },
  };
  assert.deepEqual(allegroAutomaticPreparationDisposition(active), {
    offerId: '123456789',
    status: 'ACTIVE',
    active: true,
    repairRequired: false,
    verificationOnly: true,
    reason: 'active_listing_verification_only',
  });
  assert.deepEqual(selectAllegroPreparationCandidates([active]), []);
});

test('rzeczywisty sygnał naprawy może ponownie otworzyć aktywną ofertę', () => {
  const active = {
    id: 'active',
    allegroOfferId: '123456789',
    allegroComplianceError: 'Treść wymaga usunięcia informacji o dostawie',
    _catalog: { channels: { allegro: { offerId: '123456789', status: 'ACTIVE' } } },
  };
  const selected = selectAllegroPreparationCandidates([active]);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].id, 'active');
});

test('zadanie już obecne w kolejce nie przepisuje aktywnej oferty po wdrożeniu blokady', async () => {
  const product = {
    id: 'active',
    nazwa: 'Gotowa oferta',
    allegroOfferId: '123456789',
    _catalog: { channels: { allegro: { offerId: '123456789', status: 'ACTIVE' } } },
  };
  let editorialCalls = 0, saveCalls = 0;
  const worker = createAllegroPreparationWorker({
    text: (value) => String(value ?? ''),
    readSettings: async () => ({ data: {} }),
    loadProducts: async () => new Map([['active', product]]),
    getCatalogProduct: async () => product,
    sourceUrlOf: () => '',
    inspectSource: async () => ({}),
    sourceImages: () => ({ ok: false }),
    editorialize: async (value) => { editorialCalls += 1; return { product: value, warnings: [] }; },
    prepareDraft: async () => ({ missing: [], payload: {}, autoFilled: {} }),
    enforceDraft: (draft) => ({ draft, compliance: { ok: true } }),
    verifyIdentity: async () => ({ ok: true }),
    preparationCurrent: () => false,
    preparationFingerprint: () => 'fingerprint',
    saveProduct: async () => { saveCalls += 1; return { product }; },
    requestFactory: () => new Request('https://artwaytm.pl/api/store'),
  });
  const result = await worker({
    id: 'task-active',
    productId: 'active',
    operation: 'allegro-auto-remediation',
  });
  assert.equal(result.verificationOnly, true);
  assert.equal(result.ready, true);
  assert.equal(editorialCalls, 0);
  assert.equal(saveCalls, 0);
});

test('rotacyjna konserwacja katalogu używa tej samej blokady aktywnych ofert', async () => {
  const source = await readFile('src/backend/lib/store-app.mjs', 'utf8');
  assert.match(source, /allegroAutomaticPreparationDisposition\(product\)/);
  assert.match(source, /automaticDisposition\.verificationOnly && !trackPublication/);
  assert.match(source, /report\.verified/);
});

test('automatyczne uzupełnienia są ponawiane szybko i kończą się jawną decyzją zamiast odkładania bez końca', () => {
  const first = allegroPreparationRetryState({}, ['GPSR'], {
    now: new Date('2026-07-27T08:00:00.000Z'),
  });
  assert.equal(first.retryCount, 1);
  assert.equal(first.nextRetryAt, '2026-07-27T08:00:15.000Z');
  const later = allegroPreparationRetryState({
    allegroAgentPreparationMissing: ['GPSR'],
    allegroAgentPreparationRetryCount: 20,
  }, ['GPSR'], {
    now: new Date('2026-07-27T08:00:00.000Z'),
  });
  assert.equal(later.retryCount, 21);
  assert.equal(later.nextRetryAt, '2026-07-27T08:05:00.000Z');
  assert.equal(allegroPreparationAttemptDisposition({ ready: false, attempt: 1 }), 'attention');
  assert.equal(allegroPreparationAttemptDisposition({ ready: false, attempt: 3 }), 'decision_required');
  assert.equal(allegroPreparationAttemptDisposition({ ready: false, providerUnavailable: true, attempt: 3 }), 'waiting_provider');
  assert.deepEqual(allegroPreparationRetryState({}, [], { ready: true }), {
    retryCount: 0,
    nextRetryAt: '',
  });
});

test('serwerowy wykonawca zawsze dostaje pełny adres żądania, także bez otwartej przeglądarki', async () => {
  const source = await readFile('src/backend/lib/store-app.mjs', 'utf8');
  assert.match(source, /ARTWAY_PUBLIC_ORIGIN\s*\|\|\s*'https:\/\/artwaytm\.pl'/);
  assert.doesNotMatch(source, /requestFactory:[^\n]*publicznyOrigin\(\)/);
});

test('wadliwy wynik jednego redaktora jest ponawiany przed oznaczeniem produktu jako wymagającego uwagi', async () => {
  const product = {
    id: '17',
    nazwa: 'Gra rodzinna',
    opisKrotki: 'Opis',
    opis: 'Opis pełny',
    forceEditorialRefresh: true,
    allegroComplianceError: 'editorial_quality_gate_failed',
  };
  let editorialCalls = 0, saved = null;
  const worker = createAllegroPreparationWorker({
    text: (value) => String(value ?? ''),
    readSettings: async () => ({ data: {} }),
    loadProducts: async () => new Map([['17', product]]),
    getCatalogProduct: async () => product,
    sourceUrlOf: () => '',
    inspectSource: async () => ({}),
    sourceImages: () => ({ ok: false }),
    editorialize: async (value) => {
      editorialCalls += 1;
      const ready = editorialCalls > 1;
      return {
        product: {
          ...value,
          contentEditorial: { channelStates: {
            store: { status: ready ? 'ready' : 'needs_review' },
            allegro: { status: 'ready' },
            vonHalsky: { status: 'ready' },
          } },
        },
        warnings: ready ? [] : ['Redakcja sklepu: nieprawidłowy wynik strukturalny'],
      };
    },
    prepareDraft: async () => ({ missing: [], payload: { description: { sections: [] } }, autoFilled: {}, existingOffer: null }),
    enforceDraft: (draft) => ({ draft, compliance: { ok: true, policyId: 'test', checkedAt: '2026-07-26T09:00:00.000Z' } }),
    verifyIdentity: async () => ({ ok: true }),
    preparationCurrent: () => false,
    preparationFingerprint: () => 'fingerprint',
    saveProduct: async (input) => {
      saved = input;
      return { product: { ...product, ...input.fields } };
    },
    requestFactory: () => new Request('https://artwaytm.pl/api/store?action=allegro-preparation-worker'),
  });
  const result = await worker({ id: 'task-17', productId: '17', requestedBy: 'admin@example.test' });
  assert.equal(editorialCalls, 2);
  assert.equal(result.ready, true);
  assert.equal(result.status, 'completed');
  assert.equal(saved.fields.allegroAgentPreparationStatus, 'ready');
  assert.equal(saved.fields.forceEditorialRefresh, false);
  assert.equal(saved.fields.allegroComplianceError, '');
  assert.equal(saved.fields.allegroPreparationManifest.version, 1);
  assert.equal(saved.fields.allegroPreparationManifest.operation, 'create');
  assert.equal(saved.fields.allegroPreparationManifest.descriptionSectionCount, 0);
});

test('brak dostępu do redaktora AI nie odkłada produktu, gdy potwierdzone źródło wystarcza do bezpiecznej redakcji lokalnej', async () => {
  const product = {
    id: '17b',
    nazwa: 'Gra edukacyjna Litery',
    opisKrotki: 'Gra edukacyjna do nauki liter dla dzieci i całej rodziny.',
    opis: 'Gra edukacyjna Litery pomaga ćwiczyć rozpoznawanie znaków, koncentrację i spostrzegawczość. Zestaw umożliwia kilka wariantów spokojnej zabawy, dzięki czemu sprawdzi się podczas wspólnego czasu dzieci i dorosłych.',
    sourceMaterial: {
      longDescription: 'Gra edukacyjna Litery pomaga ćwiczyć rozpoznawanie znaków, koncentrację i spostrzegawczość. Zestaw umożliwia kilka wariantów spokojnej zabawy, dzięki czemu sprawdzi się podczas wspólnego czasu dzieci i dorosłych.\nDostawa kurierem w 24 godziny. Skontaktuj się z nami przed zakupem.',
      shortDescription: 'Gra edukacyjna do nauki liter dla dzieci i całej rodziny.',
    },
  };
  let preparedProduct = null, saved = null;
  const worker = createAllegroPreparationWorker({
    text: (value) => String(value ?? ''),
    readSettings: async () => ({ data: {} }),
    loadProducts: async () => new Map([['17b', product]]),
    getCatalogProduct: async () => product,
    sourceUrlOf: () => '',
    inspectSource: async () => ({}),
    sourceImages: () => ({ ok: false }),
    editorialize: async () => { throw new Error('redaktor nie powinien zostać wywołany'); },
    prepareDraft: async (_request, value) => {
      preparedProduct = value;
      return { missing: [], payload: { description: { sections: [] } }, autoFilled: {}, existingOffer: null };
    },
    enforceDraft: (draft) => ({ draft, compliance: { ok: true, policyId: 'test' } }),
    verifyIdentity: async () => ({ ok: true }),
    preparationCurrent: () => false,
    preparationFingerprint: () => 'fingerprint',
    saveProduct: async (input) => {
      saved = input;
      return { product: { ...product, ...input.fields } };
    },
    requestFactory: () => new Request('https://artwaytm.pl/api/store?action=allegro-preparation-worker'),
  });
  const result = await worker({ id: 'task-17b', productId: '17b', requestedBy: 'admin@example.test', skipEditorial: true, attempt: 1 });
  assert.equal(result.status, 'completed');
  assert.equal(result.ready, true);
  assert.equal(result.providerUnavailable, false);
  assert.equal(saved.fields.contentEditorialSource, 'deterministic-source-policy');
  assert.doesNotMatch(preparedProduct.allegroDescription, /dostaw|kontakt/i);
});

test('worker nie oznacza produktu jako gotowy, gdy fallback zawiera urwany tekst strony źródłowej', async () => {
  const product = {
    id: '17c',
    nazwa: ':{',
    opisKrotki: 'Produkt [...]Read More...',
    opis: '5.00/5.00 Opinie (1) Produkt [...]Read More...',
    sourceMaterial: {
      title: ':{',
      shortDescription: 'Produkt [...]Read More...',
      longDescription: '5.00/5.00 Opinie (1) Produkt [...]Read More...',
    },
  };
  let saved = null;
  const worker = createAllegroPreparationWorker({
    text: (value) => String(value ?? ''),
    readSettings: async () => ({ data: {} }),
    loadProducts: async () => new Map([['17c', product]]),
    getCatalogProduct: async () => product,
    sourceUrlOf: () => '',
    inspectSource: async () => ({}),
    sourceImages: () => ({ ok: false }),
    editorialize: async (value) => ({
      product: {
        ...value,
        contentEditorial: {
          channelStates: {
            store: { status: 'needs_review' },
            allegro: { status: 'needs_review' },
            vonHalsky: { status: 'needs_review' },
          },
        },
      },
      warnings: ['niepełny wynik'],
    }),
    prepareDraft: async () => ({ missing: [], payload: { description: { sections: [] } }, autoFilled: {}, existingOffer: null }),
    enforceDraft: (draft) => ({ draft, compliance: { ok: true, policyId: 'test' } }),
    verifyIdentity: async () => ({ ok: true }),
    preparationCurrent: () => false,
    preparationFingerprint: () => 'fingerprint',
    saveProduct: async (input) => {
      saved = input;
      return { product: { ...product, ...input.fields } };
    },
    requestFactory: () => new Request('https://artwaytm.pl/api/store?action=allegro-preparation-worker'),
  });
  const result = await worker({ id: 'task-17c', productId: '17c', requestedBy: 'admin@example.test', attempt: 1 });
  assert.equal(result.ready, false);
  assert.notEqual(saved.fields.allegroAgentPreparationStatus, 'ready');
  assert.ok(result.missing.some((item) => /redakcja opisu sklepu/i.test(item)));
  assert.ok(result.missing.some((item) => /redakcja opisu Allegro/i.test(item)));
});

test('worker wykorzystuje potwierdzone GPSR tego samego producenta i ostrzeżenie ze źródła', async () => {
  const product = {
    id: '18',
    nazwa: 'Gra Alexander',
    producent: 'Alexander',
    parametryProducenta: { ostrzezenie: 'Nieodpowiednie dla dzieci poniżej 3 lat.' },
  };
  let preparedProduct = null;
  const worker = createAllegroPreparationWorker({
    text: (value) => String(value ?? ''),
    readSettings: async () => ({ data: {} }),
    loadProducts: async () => new Map([
      ['18', product],
      ['19', { id: '19', producent: 'Alexander', allegroResponsibleProducer: { id: 'gpsr-alexander', name: 'Alexander' } }],
    ]),
    getCatalogProduct: async () => product,
    sourceUrlOf: () => '',
    inspectSource: async () => ({}),
    sourceImages: () => ({ ok: false }),
    editorialize: async (value) => ({
      product: { ...value, contentEditorial: { channelStates: { store: { status: 'ready' }, allegro: { status: 'ready' } } } },
      warnings: [],
    }),
    prepareDraft: async (_request, value) => {
      preparedProduct = value;
      return {
        missing: [],
        payload: { description: { sections: [] } },
        autoFilled: {
          allegroResponsibleProducer: value.allegroResponsibleProducer,
          allegroSafetyInformation: value.allegroSafetyInformation,
        },
        existingOffer: null,
      };
    },
    enforceDraft: (draft) => ({ draft, compliance: { ok: true, policyId: 'test' } }),
    verifyIdentity: async () => ({ ok: true }),
    preparationCurrent: () => false,
    preparationFingerprint: () => 'fingerprint',
    saveProduct: async ({ fields }) => ({ product: { ...product, ...fields } }),
    requestFactory: () => new Request('https://artwaytm.pl/api/store?action=allegro-preparation-worker'),
  });
  const result = await worker({ id: 'task-18', productId: '18', requestedBy: 'admin@example.test' });
  assert.equal(result.ready, true);
  assert.equal(preparedProduct.allegroResponsibleProducer.id, 'gpsr-alexander');
  assert.deepEqual(preparedProduct.allegroSafetyInformation, {
    type: 'TEXT',
    description: 'Nieodpowiednie dla dzieci poniżej 3 lat.',
  });
});

test('worker łączy lekki indeks z pełną kartoteką, aby nie zgubić zapisanych opisów kanałowych', async () => {
  const indexed = { id: '20', nazwa: 'Puzzle 150 elementów', producent: 'Alexander' };
  const central = {
    ...indexed,
    opisKrotki: 'Drewniane puzzle do spokojnej i kreatywnej zabawy.',
    opis: 'Drewniane puzzle składają się ze 150 elementów i rozwijają spostrzegawczość oraz koncentrację.',
    allegroTitle: 'Puzzle drewniane 150 elementów Alexander',
    allegroDescription: 'Drewniane puzzle składają się ze 150 elementów. Układanie rozwija spostrzegawczość, koncentrację i cierpliwość.',
  };
  let editorialInput = null;
  const worker = createAllegroPreparationWorker({
    text: (value) => String(value ?? ''),
    readSettings: async () => ({ data: {} }),
    loadProducts: async () => new Map([['20', indexed]]),
    getCatalogProduct: async () => central,
    sourceUrlOf: () => '',
    inspectSource: async () => ({}),
    sourceImages: () => ({ ok: false }),
    editorialize: async (value) => {
      editorialInput = value;
      return { product: { ...value, contentEditorial: { channelStates: { store: { status: 'ready' }, allegro: { status: 'ready' } } } }, warnings: [] };
    },
    prepareDraft: async () => ({ missing: [], payload: { description: { sections: [] } }, autoFilled: {}, existingOffer: null }),
    enforceDraft: (draft) => ({ draft, compliance: { ok: true, policyId: 'test' } }),
    verifyIdentity: async () => ({ ok: true }),
    preparationCurrent: () => false,
    preparationFingerprint: () => 'fingerprint',
    saveProduct: async ({ fields }) => ({ product: { ...central, ...fields } }),
    requestFactory: () => new Request('https://artwaytm.pl/api/store?action=allegro-preparation-worker'),
  });
  const result = await worker({ id: 'task-20', productId: '20', requestedBy: 'admin@example.test' });
  assert.equal(result.ready, true);
  assert.equal(editorialInput.allegroDescription, central.allegroDescription);
  assert.equal(editorialInput.opis, central.opis);
});
