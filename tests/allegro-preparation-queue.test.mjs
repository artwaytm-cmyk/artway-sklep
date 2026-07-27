import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
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

test('kolejka przygotowania zapisuje i wykonuje produkty pojedynczo na serwerze', async () => {
  const repository = memoryRepository(), calls = [];
  const queue = createAllegroPreparationQueue({
    ...repository,
    prepare: async (task) => {
      calls.push(task.productId);
      return { ready: task.productId !== '2', status: task.productId === '2' ? 'attention' : 'completed', name: `P${task.productId}`, missing: task.productId === '2' ? ['GPSR'] : [], mutationId: `m-${task.productId}` };
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
  assert.deepEqual(calls, ['1', '2']);
  assert.equal(finished.batches[0].completed, 1);
  assert.equal(finished.batches[0].attention, 1);
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
        status: 'attention',
        missing: ['redakcja AI oczekuje'],
        savedFields: ['ean', 'allegroCategoryId'],
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
        status: 'attention',
        missing: ['redakcja AI oczekuje'],
        savedFields: ['allegroCategoryId', 'allegroParameters'],
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
  assert.equal(blocked.recent[0].status, 'attention');
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

test('nieudane uzupełnienia są ponawiane bez końcowego limitu, ale z bezpiecznym odstępem', () => {
  const first = allegroPreparationRetryState({}, ['GPSR'], {
    now: new Date('2026-07-27T08:00:00.000Z'),
  });
  assert.equal(first.retryCount, 1);
  assert.equal(first.nextRetryAt, '2026-07-27T08:15:00.000Z');
  const later = allegroPreparationRetryState({
    allegroAgentPreparationMissing: ['GPSR'],
    allegroAgentPreparationRetryCount: 20,
  }, ['GPSR'], {
    now: new Date('2026-07-27T08:00:00.000Z'),
  });
  assert.equal(later.retryCount, 21);
  assert.equal(later.nextRetryAt, '2026-07-28T08:00:00.000Z');
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
  const product = { id: '17', nazwa: 'Gra rodzinna', opisKrotki: 'Opis', opis: 'Opis pełny' };
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
