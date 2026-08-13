import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ALLEGRO_PREPARATION_VERSION,
  allegroAutomaticPreparationDisposition,
  allegroPreparationAttemptDisposition,
  allegroPreparationProductExclusion,
  allegroPreparationRequiredVersion,
  allegroPreparationRetryState,
  createAllegroPreparationQueue,
  productAgentReviewCurrent,
  productFullPreparationReport,
  productPreparationQualityGap,
  selectAllegroPreparationCandidates,
} from '../src/backend/lib/domain/allegro-preparation-queue.mjs';
import { createAllegroPreparationWorker } from '../src/backend/lib/domain/allegro-preparation-worker.mjs';
import { SOURCE_IMAGE_POLICY_VERSION } from '../src/backend/lib/domain/source-product-images.mjs';

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

test('produkcja domyślnie ogranicza ciężkie przygotowanie do dwóch workerów', async () => {
  const source = await readFile(new URL('../src/backend/lib/store-app.mjs', import.meta.url), 'utf8');
  assert.match(source, /ALLEGRO_PREPARATION_WORKERS\s*\|\|\s*2/);
});

test('produkcja natychmiast dobiera kolejną partię po opróżnieniu kolejki', async () => {
  const source = await readFile(new URL('../src/backend/lib/allegro-preparation-route.mjs', import.meta.url), 'utf8');
  assert.match(source, /onIdle:\s*\(\)\s*=>\s*runAutomaticPreparation\(\{\s*batchSize:\s*100\s*\}\)/);
});

test('pusta kolejka wykonuje automatycznie dobraną następną partię bez drugiego kliknięcia', async () => {
  const repository = memoryRepository(), completed = [], refills = [];
  let queue;
  queue = createAllegroPreparationQueue({
    ...repository,
    prepare: async (task) => {
      completed.push(task.productId);
      return { ready: true, status: 'completed', name: `P${task.productId}` };
    },
    onIdle: async () => {
      refills.push(completed.length);
      if (completed.length !== 1) return { enqueued: 0 };
      const state = await queue.enqueue(['2'], { requestedBy: 'agent-zdarzeniowy' });
      return { enqueued: state.batches[0].enqueued };
    },
  });
  await queue.enqueue(['1'], { requestedBy: 'administrator' });
  const finished = await waitUntil(async () => {
    const status = await queue.status();
    return !status.running && status.pending === 0 && status.recent.length === 2 ? status : null;
  });
  assert.deepEqual(completed, ['1', '2']);
  assert.deepEqual(refills, [1, 2]);
  assert.equal(finished.batches.length, 2);
});

async function waitUntil(predicate, timeout = 1000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('timeout');
}

function fullyReviewedActiveProduct(overrides = {}) {
  const description = 'Pełny opis produktu zawiera potwierdzone cechy, przeznaczenie, zawartość zestawu oraz informacje potrzebne klientowi do świadomego i bezpiecznego wyboru.';
  return {
    id: 'reviewed',
    nazwa: 'Gra edukacyjna Alexander',
    opisKrotki: 'Czytelny krótki opis najważniejszych cech produktu.',
    opis: description,
    allegroTitle: 'Gra edukacyjna Alexander dla całej rodziny',
    allegroDescription: description,
    allegroOfferId: '123456789',
    producent: 'Alexander',
    ean: '5906018000030',
    zdjecie: '/produkt.webp',
    cena: 49.9,
    externalId: '3157',
    vonHalskyTitle: 'Gra edukacyjna Alexander dla całej rodziny',
    vonHalskyShortDescription: 'Czytelny krótki opis najważniejszych cech produktu.',
    vonHalskyDescription: description,
    vonHalskyCategoryId: '33333333-3333-4333-8333-333333333333',
    vonHalskyCategoryTreeValid: true,
    vonHalskyDoesNotRequireGpsrInfo: true,
    vonHalskyAttributeDefinitions: [],
    vonHalskyAgentStatus: 'ready',
    vonHalskyAgentSaveState: 'confirmed',
    vonHalskyAgentReadbackConfirmed: true,
    vonHalskyAgentMissingAttributes: [],
    vonHalskyRequiredAttributesMissing: [],
    agentQualityReviewStatus: 'confirmed',
    agentQualityReadbackConfirmed: true,
    contentEditorial: { channelStates: {
      store: { status: 'ready' },
      allegro: { status: 'ready' },
      vonHalsky: { status: 'ready' },
    } },
    _agentReview: {
      status: 'confirmed',
      confirmedAt: '2026-07-30T08:00:00.000Z',
      verificationDueAt: '2026-08-29T08:00:00.000Z',
    },
    _catalog: { channels: { allegro: { offerId: '123456789', status: 'ACTIVE' } } },
    ...overrides,
  };
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
  const finished = await waitUntil(async () => {
    const status = await queue.status();
    return !status.running && status.pending === 0 && status.recent.length === 3 ? status : null;
  });
  assert.deepEqual(calls, [
    { productId: '1', skipEditorial: false },
    { productId: '2', skipEditorial: true },
    { productId: '3', skipEditorial: true },
  ]);
  assert.equal(finished.pending, 0);
  assert.equal(finished.blockedReason, '');
  assert.equal(finished.blockedUntil, '');
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
  const finished = await waitUntil(async () => {
    const status = await queue.status();
    return !status.running && status.pending === 0 && status.recent.length === 3 ? status : null;
  });
  assert.deepEqual(calls, [
    { productId: '1', skipEditorial: false },
    { productId: '2', skipEditorial: true },
    { productId: '3', skipEditorial: true },
  ]);
  assert.equal(finished.recent[0].status, 'waiting_provider');
  assert.deepEqual(finished.recent[0].savedFields, ['allegroCategoryId', 'allegroParameters']);
  assert.equal(finished.pending, 0);
  assert.equal(finished.blockedReason, '');
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
  await waitUntil(async () => {
    const status = await queue.status();
    return !status.running && status.pending === 0 && status.recent.length === 2;
  });
  assert.deepEqual(calls, ['1', '2']);
  assert.equal(repository.value().active, null);
});

test('błąd etapu Von Halsky nie daje fałszywego sukcesu i po próbach tworzy decyzję', async () => {
  const repository = memoryRepository();
  let downstreamAttempts = 0;
  const queue = createAllegroPreparationQueue({
    ...repository,
    prepare: async () => ({ ready: true, status: 'completed', savedFields: ['opis'] }),
    afterPrepare: async () => {
      downstreamAttempts += 1;
      throw new Error('Von Halsky nie potwierdził jeszcze zapisu');
    },
  });
  await queue.enqueue(['multi-channel']);
  const status = await waitUntil(async () => {
    const value = await queue.status();
    return !value.running && value.recent.length === 1 ? value : null;
  });
  assert.equal(downstreamAttempts, 3);
  assert.equal(status.recent[0].status, 'decision_required');
  assert.equal(status.recent[0].ready, false);
  assert.equal(status.recent[0].downstream.channel, 'vonHalsky');
  assert.equal(status.recent[0].downstream.status, 'retry');
  assert.match(status.recent[0].downstream.error, /nie potwierdził/);
});

test('Von Halsky jest wykonywany synchronicznie dopiero po gotowym Allegro', async () => {
  const repository = memoryRepository(), downstreamProducts = [];
  const queue = createAllegroPreparationQueue({
    ...repository,
    prepare: async (task) => task.productId === 'decision'
      ? { ready: false, status: 'decision_required', missing: ['EAN'] }
      : { ready: true, status: 'completed', reused: true },
    afterPrepare: async (task) => {
      downstreamProducts.push(task.productId);
      return { channel: 'vonHalsky', status: 'ready', ready: true, readbackConfirmed: true, qualityConfirmed: true };
    },
  });
  await queue.enqueue(['decision', 'reused']);
  await waitUntil(async () => !(await queue.status()).running);
  assert.deepEqual(downstreamProducts, ['reused']);
  const status = await queue.status();
  assert.equal(status.current.find((item) => item.productId === 'decision').status, 'decision_required');
  assert.equal(status.current.find((item) => item.productId === 'reused').status, 'completed');
});

test('zadanie kończy się dopiero po centralnym odczycie wszystkich kanałów', async () => {
  const repository = memoryRepository();
  let preparationAttempts = 0;
  const queue = createAllegroPreparationQueue({
    ...repository,
    prepare: async () => {
      preparationAttempts += 1;
      return { ready: true, status: 'completed', savedFields: ['allegroParameterResolution'] };
    },
    afterPrepare: async () => ({
      channel: 'vonHalsky', status: 'ready', ready: true,
      readbackConfirmed: true, qualityConfirmed: true,
    }),
    verifyCompleted: async () => preparationAttempts >= 2
      ? { ready: true, missing: [] }
      : { ready: false, missing: ['allegroPreparation'] },
  });
  await queue.enqueue(['central-readback']);
  const status = await waitUntil(async () => {
    const value = await queue.status();
    return !value.running && value.recent.length === 1 ? value : null;
  });
  assert.equal(preparationAttempts, 2);
  assert.equal(status.recent[0].status, 'completed');
  assert.equal(status.recent[0].ready, true);
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

test('ręczne przygotowanie przyjmuje pełne zaznaczenie 400 produktów bez cichego limitu', async () => {
  const repository = memoryRepository();
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  const queue = createAllegroPreparationQueue({
    ...repository,
    prepare: async () => {
      await blocked;
      return { ready: true, status: 'completed' };
    },
  });
  const ids = Array.from({ length: 400 }, (_, index) => `product-${index + 1}`);
  const created = await queue.enqueue(ids);
  assert.equal(created.batches[0].total, 400);
  assert.equal(created.batches[0].enqueued, 400);
  assert.equal(created.batches[0].trackedTaskIds.length, 400);
  assert.equal(created.batches[0].pending + created.batches[0].running, 400);
  release();
  await waitUntil(async () => !(await queue.status()).running, 3000);
});

test('wybrany priorytet naprawdę ustawia produkty jako następne, a bieżący kończy się bezpiecznie', async () => {
  const repository = memoryRepository(), calls = [];
  let release;
  const firstBlocked = new Promise((resolve) => { release = resolve; });
  const queue = createAllegroPreparationQueue({
    ...repository,
    prepare: async (task) => {
      calls.push({ productId: task.productId, skipEditorial: task.skipEditorial });
      if (task.productId === 'first') await firstBlocked;
      return { ready: true, status: 'completed' };
    },
  });
  await queue.enqueue(['first', 'ordinary', 'chosen'], {
    skipEditorialByProduct: { chosen: true },
  });
  await waitUntil(async () => (await queue.status()).active?.productId === 'first');
  const prioritized = await queue.prioritize(['chosen'], { reason: 'administrator_scope:allegro_repairs' });
  assert.equal(prioritized.priority.matched, 1);
  assert.equal(prioritized.priority.activeFinishesSafely, true);
  release();
  await waitUntil(async () => !(await queue.status()).running);
  assert.deepEqual(calls, [
    { productId: 'first', skipEditorial: false },
    { productId: 'chosen', skipEditorial: true },
    { productId: 'ordinary', skipEditorial: false },
  ]);
});

test('zbyt duża partia jest odrzucana w całości zamiast przycinania identyfikatorów', async () => {
  const repository = memoryRepository();
  const queue = createAllegroPreparationQueue({
    ...repository,
    prepare: async () => ({ ready: true, status: 'completed' }),
  });
  const ids = Array.from({ length: 2001 }, (_, index) => `product-${index + 1}`);
  await assert.rejects(queue.enqueue(ids), (error) => {
    assert.equal(error.code, 'allegro_preparation_batch_too_large');
    assert.equal(error.status, 422);
    return true;
  });
  assert.equal(repository.value(), null);
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

test('ciągła kolejka najpierw wybiera braki, a potem domyka pełny przegląd wszystkich kanałów', () => {
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
  assert.deepEqual(selected.map((item) => item.id), ['attention', 'old', 'fresh', 'new']);
  assert.deepEqual(selected.map((item) => item.reason), [
    'wymaga_uzupelnienia',
    'pelny_przeglad_edytora_i_von_halsky',
    'pelny_przeglad_edytora_i_von_halsky',
    'pelny_przeglad_edytora_i_von_halsky',
  ]);
});

test('produkt w koszu jest wykluczony z automatycznej kolejki', () => {
  const trashed = { id: 'trash', _catalog: { recordStatus: 'trash' } };
  assert.deepEqual(allegroPreparationProductExclusion(trashed), {
    excluded: true,
    reason: 'product_in_trash',
    recordStatus: 'trash',
  });
  assert.deepEqual(selectAllegroPreparationCandidates([
    trashed,
    { id: 'active', _catalog: { recordStatus: 'active' } },
  ]).map((item) => item.id), ['active']);
});

test('worker anuluje stare zadanie produktu z kosza bez redakcji i bez zapisu', async () => {
  const product = {
    id: 'trash-worker',
    nazwa: 'Usunięty produkt',
    _catalog: { recordStatus: 'trash' },
  };
  let editorialCalls = 0;
  let draftCalls = 0;
  let saveCalls = 0;
  const worker = createAllegroPreparationWorker({
    text: (value) => String(value ?? ''),
    readSettings: async () => ({ data: {} }),
    loadProducts: async () => new Map([['trash-worker', product]]),
    getCatalogProduct: async () => product,
    sourceUrlOf: () => '',
    inspectSource: async () => ({}),
    sourceImages: () => ({ ok: false }),
    editorialize: async (value) => { editorialCalls += 1; return { product: value, warnings: [] }; },
    prepareDraft: async () => { draftCalls += 1; return { missing: [], payload: {} }; },
    enforceDraft: (draft) => ({ draft, compliance: { ok: true } }),
    verifyIdentity: async () => ({ ok: true }),
    preparationCurrent: () => false,
    preparationFingerprint: () => 'fingerprint',
    saveProduct: async () => { saveCalls += 1; return { product }; },
    requestFactory: () => new Request('https://artwaytm.pl/api/store?action=allegro-preparation-worker'),
  });
  const result = await worker({ id: 'trash-task', productId: 'trash-worker', attempt: 1 });
  assert.equal(result.status, 'cancelled');
  assert.equal(result.reason, 'product_in_trash');
  assert.equal(result.ready, false);
  assert.equal(editorialCalls, 0);
  assert.equal(draftCalls, 0);
  assert.equal(saveCalls, 0);
});

test('Agent zaczyna od kartoteki z największą potwierdzoną luką jakości', () => {
  const weak = {
    id: 'weak',
    nazwa: '',
    opis: '',
    opisKrotki: '',
    contentEditorial: { channelStates: {} },
  };
  const stronger = {
    id: 'stronger',
    nazwa: 'Gra edukacyjna',
    opisKrotki: 'Krótki opis produktu gotowy dla klienta.',
    opis: 'Długi opis produktu zawierający wszystkie najważniejsze informacje o grze, jej przeznaczeniu oraz zasadach użytkowania.',
    zdjecie: '/images/game.jpg',
    ean: '5906018000030',
    producent: 'Alexander',
    kategoria: 'Gry',
    allegroCategoryId: '123',
    vonHalskyCategoryId: 'games',
    vonHalskyShortDescription: 'Krótki opis produktu gotowy dla klienta.',
    vonHalskyDescription: 'Długi opis produktu zawierający wszystkie najważniejsze informacje o grze, jej przeznaczeniu oraz zasadach użytkowania.',
    vonHalskyResponsibleProducer: { legalName: 'Alexander', address: 'adres', email: 'test@example.test', phone: '123' },
    contentEditorial: { channelStates: { store: { status: 'ready' }, allegro: { status: 'ready' }, vonHalsky: { status: 'ready' } } },
  };
  assert.ok(productPreparationQualityGap(weak).score > productPreparationQualityGap(stronger).score);
  const selected = selectAllegroPreparationCandidates([stronger, weak]);
  assert.equal(selected[0].id, 'weak');
  assert.ok(selected[0].qualityGap > selected[1].qualityGap);
});

test('stara decyzja jest automatycznie ponawiana dokładnie po wdrożeniu nowszej wersji naprawy', () => {
  const base = {
    id: 'decision',
    allegroAgentPreparationStatus: 'decision_required',
    allegroAgentPreparedAt: '2026-07-27T07:00:00.000Z',
    allegroProductSet: [{ productId: 'catalog-product-1', quantity: 1 }],
  };
  const selected = selectAllegroPreparationCandidates([
    { ...base, allegroAgentPreparationVersion: ALLEGRO_PREPARATION_VERSION - 1 },
    { ...base, id: 'current', allegroAgentPreparationVersion: ALLEGRO_PREPARATION_VERSION },
  ], { now: new Date('2026-07-29T08:00:00.000Z') });
  assert.deepEqual(selected.map((item) => item.id), ['decision']);
  assert.equal(selected[0].reason, 'nowa_wersja_automatycznej_naprawy');
});

test('worker nie uznaje starej wersji przygotowania za bieżącą i zapisuje nowe pokwitowanie Allegro', async () => {
  const product = {
    id: 'legacy-ready',
    nazwa: 'Gra edukacyjna Alexander',
    opisKrotki: 'Rodzinna gra edukacyjna rozwijająca spostrzegawczość i koncentrację.',
    opis: 'Rodzinna gra edukacyjna Alexander zawiera potwierdzone elementy do wspólnej zabawy. Rozgrywka pomaga ćwiczyć spostrzegawczość, koncentrację i logiczne myślenie.',
    allegroDescription: 'Rodzinna gra edukacyjna Alexander zawiera potwierdzone elementy do wspólnej zabawy. Rozgrywka pomaga ćwiczyć spostrzegawczość, koncentrację i logiczne myślenie.',
    allegroAgentPreparationStatus: 'ready',
    allegroAgentPreparationVersion: ALLEGRO_PREPARATION_VERSION - 1,
    allegroProductSet: [{ productId: 'catalog-product-1', quantity: 1 }],
    lastAdminMutationId: 'von-halsky-reconcile-missing:legacy-ready:command:old',
    contentEditorial: { channelStates: {
      store: { status: 'ready' },
      allegro: { status: 'ready' },
      vonHalsky: { status: 'ready' },
    } },
  };
  let saved = null;
  const worker = createAllegroPreparationWorker({
    text: (value) => String(value ?? ''),
    readSettings: async () => ({ data: {} }),
    loadProducts: async () => new Map([['legacy-ready', product]]),
    getCatalogProduct: async () => product,
    sourceUrlOf: () => '',
    inspectSource: async () => ({}),
    sourceImages: () => ({ ok: false }),
    editorialize: async (value) => ({ product: value, warnings: [] }),
    prepareDraft: async () => ({ missing: [], payload: { description: { sections: [] } }, autoFilled: {}, existingOffer: null }),
    enforceDraft: (draft) => ({ draft, compliance: { ok: true, policyId: 'test' } }),
    verifyIdentity: async () => ({ ok: true }),
    preparationCurrent: () => true,
    preparationFingerprint: () => 'allegro-preparation-v5-current',
    saveProduct: async (input) => {
      saved = input;
      return { product: { ...product, ...input.fields } };
    },
    requestFactory: () => new Request('https://artwaytm.pl/api/store?action=allegro-preparation-worker'),
  });
  const result = await worker({ id: 'task-new-rules', productId: 'legacy-ready', requestedBy: 'admin@example.test', attempt: 1 });
  assert.equal(result.ready, true);
  assert.equal(saved.fields.allegroAgentPreparationVersion, ALLEGRO_PREPARATION_VERSION);
  assert.equal(saved.fields.agentOnboardingStatus, 'completed');
  assert.equal(saved.fields.agentOnboardingCompletedAt, saved.fields.allegroAgentPreparationConfirmedAt);
  assert.deepEqual(saved.fields.agentOnboardingMissing, []);
  assert.match(result.mutationId, /^allegro-preparation:legacy-ready:task-new-rules:attempt-1$/);
  assert.notEqual(result.mutationId, product.lastAdminMutationId);
});

test('wersja ofert wieloproduktowych nie wymusza ciężkiej migracji zwykłych kartotek', () => {
  assert.equal(allegroPreparationRequiredVersion({}), ALLEGRO_PREPARATION_VERSION - 3);
  assert.equal(allegroPreparationRequiredVersion({ allegroProductSet: [] }), ALLEGRO_PREPARATION_VERSION - 3);
  assert.equal(allegroPreparationRequiredVersion({ allegroProductSet: [{ productId: 'bundle-part' }] }), ALLEGRO_PREPARATION_VERSION);
  assert.equal(allegroPreparationRequiredVersion({ nazwa: 'Kuferek świąteczny Alexander' }), ALLEGRO_PREPARATION_VERSION);
  assert.equal(allegroPreparationRequiredVersion({ sourceMaterial: { longDescription: 'W ZESTAWIE ZNAJDZIESZ:\nGra A\nGra B' } }), ALLEGRO_PREPARATION_VERSION);
});

test('pełna kontrola używa świeżego potwierdzonego źródła bez ponownego obciążania producenta', async () => {
  const sourceUrl = 'https://producer.example.test/product-verified';
  const product = {
    id: 'verified-source',
    nazwa: 'Gra edukacyjna Alexander',
    opisKrotki: 'Gra edukacyjna rozwijająca koncentrację i spostrzegawczość dzieci.',
    opis: 'Gra edukacyjna Alexander zawiera potwierdzone elementy do wspólnej zabawy. Rozgrywka pomaga ćwiczyć spostrzegawczość, koncentrację i logiczne myślenie.',
    allegroDescription: 'Gra edukacyjna Alexander zawiera potwierdzone elementy do wspólnej zabawy. Rozgrywka pomaga ćwiczyć spostrzegawczość, koncentrację i logiczne myślenie.',
    ean: '5906018000030',
    producent: 'Alexander',
    sourceUrl,
    sourceEvidence: {
      requestedUrl: sourceUrl,
      canonicalUrl: sourceUrl,
      imageSourceUrl: sourceUrl,
      imagePolicyVersion: SOURCE_IMAGE_POLICY_VERSION,
      imageUrls: ['https://producer.example.test/media/product-verified.jpg'],
      fetchedAt: new Date().toISOString(),
    },
    contentEditorial: { channelStates: {
      store: { status: 'ready' },
      allegro: { status: 'ready' },
      vonHalsky: { status: 'ready' },
    } },
    allegroAgentPreparationStatus: 'ready',
    allegroAgentPreparationVersion: ALLEGRO_PREPARATION_VERSION - 2,
  };
  let inspectionCalls = 0;
  let saved = null;
  const worker = createAllegroPreparationWorker({
    text: (value) => String(value ?? ''),
    readSettings: async () => ({ data: {} }),
    loadProducts: async () => new Map([[product.id, product]]),
    getCatalogProduct: async () => product,
    sourceUrlOf: (value) => value.sourceUrl,
    inspectSource: async () => { inspectionCalls += 1; return {}; },
    sourceImages: () => ({ ok: false }),
    editorialize: async (value) => ({ product: value, warnings: [] }),
    prepareDraft: async () => ({ missing: [], payload: { description: { sections: [] } }, autoFilled: {}, existingOffer: null }),
    enforceDraft: (draft) => ({ draft, compliance: { ok: true, policyId: 'test' } }),
    verifyIdentity: async () => ({ ok: true }),
    preparationCurrent: () => true,
    preparationFingerprint: () => 'current',
    saveProduct: async (input) => {
      saved = input;
      return { product: { ...product, ...input.fields } };
    },
    requestFactory: () => new Request('https://artwaytm.pl/api/store?action=allegro-preparation-worker'),
  });
  const result = await worker({ id: 'verified-source-task', productId: product.id, attempt: 1 });
  assert.equal(inspectionCalls, 0);
  assert.equal(result.ready, true);
  assert.equal(saved.fields.allegroAgentPreparationVersion, ALLEGRO_PREPARATION_VERSION);
});

test('zielony status Allegro nie pomija odświeżenia starego dowodu zdjęć producenta', async () => {
  const sourceUrl = 'https://producer.example.test/product-pol-2530-ECO-FUN-TRYLMA.html';
  const image = 'https://producer.example.test/media/pol_pm_ECO-FUN-TRYLMA-1164_1.jpg';
  const product = {
    id: 'legacy-source-images',
    nazwa: 'Trylma ECO FUN - chińskie warcaby',
    opisKrotki: 'Strategiczna gra planszowa dla całej rodziny, rozwijająca logiczne myślenie.',
    opis: 'Trylma ECO FUN to strategiczna gra planszowa dla całej rodziny. Rozgrywka na planszy w kształcie gwiazdy pomaga ćwiczyć planowanie, koncentrację i logiczne myślenie.',
    allegroDescription: 'Trylma ECO FUN to strategiczna gra planszowa dla całej rodziny. Rozgrywka na planszy w kształcie gwiazdy pomaga ćwiczyć planowanie, koncentrację i logiczne myślenie.',
    ean: '5906018025309',
    producent: 'Alexander',
    sourceUrl,
    sourceEvidence: {
      requestedUrl: sourceUrl,
      canonicalUrl: sourceUrl,
      imageSourceUrl: sourceUrl,
      imagePolicyVersion: SOURCE_IMAGE_POLICY_VERSION - 1,
      imageUrls: [],
      fetchedAt: new Date().toISOString(),
    },
    contentEditorial: { channelStates: {
      store: { status: 'ready' },
      allegro: { status: 'ready' },
      vonHalsky: { status: 'ready' },
    } },
    allegroAgentPreparationStatus: 'ready',
    allegroAgentPreparationVersion: ALLEGRO_PREPARATION_VERSION,
  };
  let inspectionCalls = 0;
  let saved = null;
  const worker = createAllegroPreparationWorker({
    text: (value) => String(value ?? ''),
    readSettings: async () => ({ data: {} }),
    loadProducts: async () => new Map([[product.id, product]]),
    getCatalogProduct: async () => product,
    sourceUrlOf: (value) => value.sourceUrl,
    inspectSource: async () => {
      inspectionCalls += 1;
      return { product: { ...product, zdjecie: image, sourceEvidence: { imageUrls: [image] } } };
    },
    sourceImages: () => ({
      ok: true,
      patch: {
        zdjecie: image,
        zdjecia: [],
        sourceEvidence: {
          ...product.sourceEvidence,
          imagePolicyVersion: SOURCE_IMAGE_POLICY_VERSION,
          imageUrls: [image],
        },
      },
    }),
    editorialize: async (value) => ({ product: value, warnings: [] }),
    prepareDraft: async () => ({ missing: [], payload: { description: { sections: [] } }, autoFilled: {}, existingOffer: { id: 'active-offer' } }),
    enforceDraft: (draft) => ({ draft, compliance: { ok: true, policyId: 'test' } }),
    verifyIdentity: async () => ({ ok: true }),
    preparationCurrent: () => true,
    preparationFingerprint: () => 'current',
    saveProduct: async (input) => {
      saved = input;
      return { product: { ...product, ...input.fields } };
    },
    requestFactory: () => new Request('https://artwaytm.pl/api/store?action=allegro-preparation-worker'),
  });
  const result = await worker({ id: 'legacy-source-task', productId: product.id, attempt: 1 });
  assert.equal(inspectionCalls, 1);
  assert.equal(result.ready, true);
  assert.equal(saved.fields.zdjecie, image);
  assert.equal(saved.fields.sourceEvidence.imagePolicyVersion, SOURCE_IMAGE_POLICY_VERSION);
  assert.deepEqual(saved.fields.sourceEvidence.imageUrls, [image]);
});

test('worker zapisuje odcisk z centralnego odczytu po normalizacji kartoteki', async () => {
  const product = {
    id: 'canonical-readback',
    nazwa: 'Gra logiczna Alexander',
    opisKrotki: 'Rodzinna gra logiczna rozwijająca koncentrację i planowanie.',
    opis: 'Rodzinna gra logiczna Alexander pomaga ćwiczyć koncentrację, planowanie oraz przewidywanie kolejnych ruchów podczas wspólnej rozgrywki.',
    allegroDescription: 'Rodzinna gra logiczna Alexander pomaga ćwiczyć koncentrację, planowanie oraz przewidywanie kolejnych ruchów podczas wspólnej rozgrywki.',
    ean: '5906018000030',
    producent: 'Alexander',
    contentEditorial: { channelStates: {
      store: { status: 'ready' },
      allegro: { status: 'ready' },
      vonHalsky: { status: 'ready' },
    } },
  };
  const saves = [];
  const worker = createAllegroPreparationWorker({
    text: (value) => String(value ?? ''),
    readSettings: async () => ({ data: {} }),
    loadProducts: async () => new Map([[product.id, product]]),
    getCatalogProduct: async () => product,
    sourceUrlOf: () => '',
    inspectSource: async () => ({}),
    sourceImages: () => ({ ok: false }),
    editorialize: async (value) => ({ product: value, warnings: [] }),
    prepareDraft: async () => ({
      missing: [],
      payload: { description: { sections: [] } },
      autoFilled: { allegroCategoryId: 'draft-category' },
      existingOffer: null,
    }),
    enforceDraft: (draft) => ({ draft, compliance: { ok: true, policyId: 'test' } }),
    verifyIdentity: async () => ({ ok: true }),
    preparationCurrent: () => false,
    preparationFingerprint: (value) => `fingerprint-${value.allegroCategoryId || 'empty'}`,
    saveProduct: async (input) => {
      saves.push(input);
      if (saves.length === 1) {
        return { product: { ...product, ...input.fields, allegroCategoryId: 'canonical-category' } };
      }
      return { product: { ...product, allegroCategoryId: 'canonical-category', ...input.fields } };
    },
    requestFactory: () => new Request('https://artwaytm.pl/api/store?action=allegro-preparation-worker'),
  });
  const result = await worker({ id: 'canonical-readback-task', productId: product.id, attempt: 1 });
  assert.equal(result.ready, true);
  assert.equal(saves.length, 2);
  assert.equal(saves[0].fields.allegroAgentPreparationFingerprint, 'fingerprint-draft-category');
  assert.deepEqual(saves[1].fields, { allegroAgentPreparationFingerprint: 'fingerprint-canonical-category' });
  assert.match(saves[1].mutationId, /:fingerprint-readback$/);
  assert.equal(saves[1].area, 'allegro-preparation-readback');
});

test('szybka ponowna kontrola domyka wdrożenie i przekazuje rozwiązane problemy do nauki Agenta', async () => {
  const product = {
    id: 'ready-after-von-halsky-repair',
    nazwa: 'Szablony kieszonkowe Zabawa - Alexander',
    allegroTitle: 'Szablony kieszonkowe Zabawa Alexander 4 sztuki i notes',
    opisKrotki: 'Kieszonkowy zestaw kreatywny do rysowania dla dzieci.',
    opis: 'Kieszonkowy zestaw kreatywny zawiera cztery szablony oraz notes do rysowania. Mały format ułatwia zabranie kompletu w podróż i pozwala dziecku ćwiczyć odwzorowywanie kształtów.',
    allegroDescription: 'Kieszonkowy zestaw kreatywny zawiera cztery szablony oraz notes do rysowania. Mały format ułatwia zabranie kompletu w podróż i pozwala dziecku ćwiczyć odwzorowywanie kształtów.',
    allegroAgentPreparationVersion: ALLEGRO_PREPARATION_VERSION - 1,
    agentOnboardingStatus: 'processing',
    vonHalskyAgentIssues: ['Brak kategorii Von Halsky'],
    contentEditorial: { channelStates: {
      store: { status: 'ready' },
      allegro: { status: 'ready' },
      vonHalsky: { status: 'ready' },
    } },
  };
  let saved = null;
  const worker = createAllegroPreparationWorker({
    text: (value) => String(value ?? ''),
    readSettings: async () => ({ data: {} }),
    loadProducts: async () => new Map([[product.id, product]]),
    getCatalogProduct: async () => product,
    sourceUrlOf: () => '', inspectSource: async () => ({}), sourceImages: () => ({ ok: false }),
    editorialize: async () => { throw new Error('aktualna kartoteka nie wymaga redakcji'); },
    prepareDraft: async () => { throw new Error('aktualna kartoteka nie wymaga szkicu'); },
    enforceDraft: (draft) => ({ draft }), verifyIdentity: async () => ({ ok: true }),
    preparationCurrent: () => true, preparationFingerprint: () => 'current',
    saveProduct: async (input) => {
      saved = input;
      return { product: { ...product, ...input.fields } };
    },
    requestFactory: () => new Request('https://artwaytm.pl/api/store?action=allegro-preparation-worker'),
  });
  const result = await worker({ id: 'retry-after-vh', productId: product.id, attempt: 1 });
  assert.equal(result.reused, true);
  assert.equal(saved.fields.agentOnboardingStatus, 'completed');
  assert.equal(saved.area, 'product-onboarding-readback');
  assert.deepEqual(saved.fields.agentOnboardingMissing, []);
  assert.deepEqual(result.resolvedIssues, ['Von Halsky: Brak kategorii Von Halsky']);
});

test('ciągły Agent nie dobiera ponownie nierozstrzygniętej kartoteki z tej samej kolejki', () => {
  const products = [
    { id: 'blocked', nazwa: 'Wymaga decyzji' },
    { id: 'next', nazwa: 'Następna kartoteka' },
  ];
  const selected = selectAllegroPreparationCandidates(products, {
    blockedProductIds: ['blocked'],
    limit: 10,
  });
  assert.deepEqual(selected.map((item) => item.id), ['next']);
});

test('aktywna oferta jest lekko weryfikowana, ale brak karty Von Halsky uruchamia jeden pełny przegląd', () => {
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
  const selected = selectAllegroPreparationCandidates([active]);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].reason, 'pelny_przeglad_edytora_i_von_halsky');
  assert.deepEqual(selectAllegroPreparationCandidates([
    fullyReviewedActiveProduct({ id: 'active' }),
  ], { now: new Date('2026-07-31T08:00:00.000Z') }), []);
});

test('historyczny zielony status nie ukrywa niepublikowalnej karty Von Halsky', () => {
  const falseReady = fullyReviewedActiveProduct({
    id: 'false-ready',
    vonHalskyAttributeDefinitions: undefined,
  });
  const report = productFullPreparationReport(falseReady, new Date('2026-07-31T08:00:00.000Z'));
  assert.equal(report.ready, false);
  assert.equal(report.checks.vonHalskyReadback, true);
  assert.equal(report.checks.vonHalskyPublishable, false);
  assert.ok(report.missing.includes('vonHalskyPublishable'));
  const selected = selectAllegroPreparationCandidates([falseReady], {
    now: new Date('2026-07-31T08:00:00.000Z'),
  });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].reason, 'pelny_przeglad_edytora_i_von_halsky');
});

test('pełna bramka nie akceptuje zdjęcia głównego zdublowanego w galerii', () => {
  const image = 'https://cdn.example.test/product.jpg';
  const report = productFullPreparationReport(fullyReviewedActiveProduct({
    zdjecie: image,
    zdjecia: [image],
  }), new Date('2026-07-31T08:00:00.000Z'));
  assert.equal(report.ready, false);
  assert.equal(report.checks.imageGalleryUnique, false);
  assert.ok(report.missing.includes('imageGalleryUnique'));
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

test('potwierdzona pełna kontrola nie wraca natychmiast do kolejki po zmianie ceny lub stanu', () => {
  const product = fullyReviewedActiveProduct({
    cena: 49.9,
    stan: 8,
  });
  assert.equal(productAgentReviewCurrent(product, new Date('2026-07-31T08:00:00.000Z')), true);
  assert.deepEqual(selectAllegroPreparationCandidates([product], {
    now: new Date('2026-07-31T08:00:00.000Z'),
  }), []);
  assert.equal(selectAllegroPreparationCandidates([{ ...product, allegroComplianceError: 'błąd kanału' }], {
    now: new Date('2026-07-31T08:00:00.000Z'),
  }).length, 1);
  assert.equal(productAgentReviewCurrent(product, new Date('2026-08-30T08:00:00.000Z')), false);
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
    allegroAgentPreparationMissing: ['redakcja opisu sklepu'],
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
  assert.deepEqual(result.resolvedIssues, ['redakcja opisu sklepu']);
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
  assert.equal(saved.fields.contentEditorial.channelStates.vonHalsky.status, 'ready');
  assert.equal(saved.fields.vonHalskyContentMode, 'custom');
  assert.ok(saved.fields.vonHalskyDescription.length >= 100);
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

test('worker uzupełnia puste wartości starego obiektu parametrów faktami ze źródła', async () => {
  const product = {
    id: '18b',
    nazwa: 'Puzzle drewniane Górska Chata 580 elementów',
    producent: 'Alexander',
    sourceUrl: 'https://producer.example.test/puzzle-5032',
    parametryProducenta: { ean: '', kodProducenta: '', wiek: '', liczbaElementow: '', zachowaj: 'wartość ręczna' },
    parametryZrodla: { wiek: '' },
  };
  let saved = null;
  const worker = createAllegroPreparationWorker({
    text: (value) => String(value ?? ''),
    readSettings: async () => ({ data: {} }),
    loadProducts: async () => new Map([['18b', product]]),
    getCatalogProduct: async () => product,
    sourceUrlOf: (value) => value.sourceUrl,
    inspectSource: async () => ({ product: {
      nazwa: product.nazwa,
      ean: '5906018050325',
      gtin: '5906018050325',
      kodProducenta: '5032',
      producent: 'Alexander',
      sourceUrl: product.sourceUrl,
      parametryProducenta: { ean: '5906018050325', kodProducenta: '5032', wiek: '12+', liczbaElementow: '580' },
      parametryZrodla: { 'kod ean': '5906018050325', wiek: '12+', 'ilosc puzzli': '580' },
    } }),
    sourceImages: () => ({ ok: false }),
    editorialize: async (value) => ({
      product: { ...value, contentEditorial: { channelStates: { store: { status: 'ready' }, allegro: { status: 'ready' }, vonHalsky: { status: 'ready' } } } },
      warnings: [],
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
  const result = await worker({ id: 'task-18b', productId: '18b', requestedBy: 'admin@example.test' });
  assert.equal(result.ready, true);
  assert.deepEqual(saved.fields.parametryProducenta, {
    ean: '5906018050325', kodProducenta: '5032', wiek: '12+', liczbaElementow: '580', zachowaj: 'wartość ręczna',
  });
  assert.equal(saved.fields.parametryZrodla['ilosc puzzli'], '580');
});

test('worker nie zapisuje zdjęcia głównego drugi raz w galerii', async () => {
  const image = 'https://a.allegroimg.com/original/Magiczne-Mozaiki-0663';
  const sourceUrl = 'https://sklep.alexander.com.pl/product-pol-0663-Magiczne-Mozaiki-700.html';
  const product = {
    id: 'image-0663',
    nazwa: 'Magiczne Mozaiki 700 Alexander',
    opisKrotki: 'Kreatywny zestaw do układania kolorowych wzorów.',
    opis: 'Kreatywny zestaw edukacyjny zawiera planszę, walizkę, album oraz siedemset elementów do układania kolorowych wzorów i obrazów.',
    producent: 'Alexander',
    ean: '5906018006636',
    kodProducenta: '0663',
    sourceUrl,
    zdjecie: sourceUrl,
    zdjecia: [image],
  };
  let saved = null;
  const worker = createAllegroPreparationWorker({
    text: (value) => String(value ?? ''),
    readSettings: async () => ({ data: {} }),
    loadProducts: async () => new Map([[product.id, product]]),
    getCatalogProduct: async () => product,
    sourceUrlOf: (value) => value.sourceUrl,
    inspectSource: async () => ({ product: { ...product, zdjecie: image, zdjecia: [], sourceEvidence: { imageUrls: [image] } } }),
    sourceImages: () => ({ ok: true, patch: { zdjecie: image, zdjecia: [], sourceEvidence: { imageUrls: [image] } } }),
    editorialize: async (value) => ({
      product: { ...value, allegroTitle: value.nazwa, allegroDescription: value.opis, contentEditorial: { channelStates: { store: { status: 'ready' }, allegro: { status: 'ready' }, vonHalsky: { status: 'ready' } } } },
      warnings: [],
    }),
    prepareDraft: async () => ({ missing: [], payload: { description: { sections: [] } }, autoFilled: { zdjecie: image, zdjecia: [image] }, existingOffer: null }),
    enforceDraft: (draft) => ({ draft, compliance: { ok: true, policyId: 'test' } }),
    verifyIdentity: async () => ({ ok: true }),
    preparationCurrent: () => false,
    preparationFingerprint: () => 'fingerprint',
    saveProduct: async (input) => { saved = input; return { product: { ...product, ...input.fields } }; },
    requestFactory: () => new Request('https://artwaytm.pl/api/store?action=allegro-preparation-worker'),
  });
  const result = await worker({ id: 'task-image-0663', productId: product.id, requestedBy: 'admin@example.test' });
  assert.equal(result.ready, true);
  assert.equal(saved.fields.zdjecie, image);
  assert.deepEqual(saved.fields.zdjecia, []);
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
