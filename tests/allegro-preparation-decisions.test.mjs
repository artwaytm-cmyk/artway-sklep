import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allegroPreparationApplicabilityFeatures,
  allegroPreparationIssueSignature,
  allegroAutomaticIssuePolicy,
  allegroPreparationResolutionOptions,
  allegroPublicationIssueSignature,
  allegroPublicationResolutionOptions,
  createAllegroPreparationDecisionLearning,
  decorateAllegroPublicationStatus,
  decorateAllegroPreparationStatus,
  selectAllegroPreparationPriorityProductIds,
} from '../src/backend/lib/domain/allegro-preparation-decisions.mjs';
import {
  findAllegroPreparationDecisionTask,
  loadAllegroPreparationDecisionTask,
} from '../src/backend/lib/allegro-preparation-route.mjs';

function memoryRepository() {
  let value = null, version = 0;
  return {
    readVersioned: async (_key, fallback) => ({ value: value ?? fallback, version }),
    writeIfVersion: async (_key, next, expected) => {
      if (Number(expected.version) !== version) return { modified: false };
      value = structuredClone(next); version += 1;
      return { modified: true, version };
    },
  };
}

test('Agent rozpoznaje typ problemu i zawsze przedstawia trzy rzeczywiste warianty', () => {
  const task = { missing: ['informacja o bezpieczeństwie GPSR', 'parametr Allegro: Wiek dziecka'] };
  assert.equal(allegroPreparationIssueSignature(task), 'gpsr+parameters');
  const resolution = allegroPreparationResolutionOptions(task);
  assert.equal(resolution.options.length, 3);
  assert.equal(resolution.options[0].id, 'official_source');
  assert.equal(resolution.options[0].recommended, true);
  assert.deepEqual(new Set(resolution.options.map((item) => item.action)), new Set(['queue', 'editor']));
});

test('wybór administratora jest trwałą nauką i zmienia przyszłą rekomendację podobnego problemu', async () => {
  const learning = createAllegroPreparationDecisionLearning({
    ...memoryRepository(),
    now: () => new Date('2026-08-05T16:00:00.000Z'),
  });
  const task = { id: 'task-1', productId: '100', status: 'decision_required', missing: ['GPSR producenta'] };
  await learning.recordResolution({ task, resolutionId: 'manual_editor', selectedBy: 'admin@example.test' });
  const state = await learning.read();
  const decorated = decorateAllegroPreparationStatus({ current: [task], recent: [] }, state);
  assert.equal(decorated.current[0].resolution.learnedChoice, 'manual_editor');
  assert.equal(decorated.current[0].resolution.options[0].id, 'manual_editor');
  assert.equal(decorated.current[0].resolution.options[0].recommended, true);
  assert.equal(state.history[0].selectedBy, 'admin@example.test');
});

test('priorytet pracy wybiera wyłącznie oczekujące produkty pasujące do zakresu', () => {
  const queue = { current: [
    { productId: 'repair', status: 'pending' },
    { productId: 'new', status: 'pending' },
    { productId: 'vh', status: 'pending' },
    { productId: 'running', status: 'running' },
  ] };
  const products = [
    { id: 'repair', allegroOfferId: '123', allegroAgentPreparationStatus: 'attention', vonHalskyAgentStatus: 'ready' },
    { id: 'new', vonHalskyAgentStatus: 'ready' },
    { id: 'vh', allegroOfferId: '456', vonHalskyAgentStatus: 'attention' },
    { id: 'running', allegroOfferId: '789', allegroAgentPreparationStatus: 'failed' },
  ];
  assert.deepEqual(selectAllegroPreparationPriorityProductIds(queue, products, 'new_allegro'), ['new']);
  assert.deepEqual(selectAllegroPreparationPriorityProductIds(queue, products, 'von_halsky'), ['vh']);
  assert.deepEqual(selectAllegroPreparationPriorityProductIds(queue, products, 'full_review'), ['repair', 'new', 'vh']);
  assert.deepEqual(selectAllegroPreparationPriorityProductIds(queue, products, 'allegro_repairs'), ['repair', 'vh']);
});

test('błąd publikacji dostaje cztery warianty dopasowane do przyczyny', () => {
  const task = { errorCode: 'GallerySizeException', error: 'maksymalnie 16 zdjęć' };
  assert.equal(allegroPublicationIssueSignature(task), 'publication:gallery_limit');
  const resolution = allegroPublicationResolutionOptions(task);
  assert.equal(resolution.options.length, 4);
  assert.equal(resolution.options[0].id, 'repair_then_review');
  assert.match(resolution.options[0].description, /16 zdjęć/);
  assert.deepEqual(new Set(resolution.options.map((item) => item.action)), new Set(['queue_repair', 'queue_verification', 'editor', 'confirm_publication']));
});

test('Agent uczy się osobno decyzji dotyczącej błędu publikacji', async () => {
  const learning = createAllegroPreparationDecisionLearning({
    ...memoryRepository(),
    now: () => new Date('2026-08-05T16:30:00.000Z'),
  });
  const task = { id: 'publication-1', productId: '200', status: 'decision_required', errorCode: 'allegro_publication_unconfirmed' };
  await learning.recordResolution({ task, kind: 'publication', resolutionId: 'verify_remote_state', selectedBy: 'admin@example.test' });
  const decorated = decorateAllegroPublicationStatus({ current: [task], recent: [] }, await learning.read());
  assert.equal(decorated.current[0].resolution.signature, 'publication:unconfirmed_state');
  assert.equal(decorated.current[0].resolution.learnedChoice, 'verify_remote_state');
  assert.equal(decorated.current[0].resolution.options[0].id, 'verify_remote_state');
  assert.equal(decorated.current[0].automaticPolicy.id, 'remote_readback_before_retry');
});

test('każdy znany błąd ma wykonywalną bezpieczną regułę Agenta bez publikacji', () => {
  const gallery = allegroAutomaticIssuePolicy({ errorCode: 'GallerySizeException', error: 'maksymalnie 16 zdjęć' }, 'publication');
  const gpsr = allegroAutomaticIssuePolicy({ missing: ['informacja o bezpieczeństwie GPSR'] }, 'preparation');
  assert.equal(gallery.id, 'shared_gallery_budget');
  assert.equal(gallery.externalPublication, false);
  assert.equal(gpsr.id, 'catalog_gpsr_first');
  assert.equal(gpsr.automatic, true);
});

test('Agent pamięta skuteczną automatyczną naprawę parametrów tylko raz', async () => {
  const learning = createAllegroPreparationDecisionLearning({
    ...memoryRepository(),
    now: () => new Date('2026-08-06T11:00:00.000Z'),
  });
  const task = {
    id: 'task-parameter-repair',
    productId: '1000744',
    name: 'X-Press Me - brelok DIY Garbus',
    missing: ['parametr Allegro: Materiał'],
  };

  const policy = allegroAutomaticIssuePolicy(task, 'preparation');
  assert.equal(policy.id, 'reselect_exact_category_and_schema');

  await learning.recordAutomaticSuccess({ task });
  await learning.recordAutomaticSuccess({ task });
  const state = await learning.read();
  const options = allegroPreparationResolutionOptions(task, state);

  assert.equal(options.signature, 'parameters');
  assert.equal(options.learnedChoice, 'official_source');
  assert.equal(options.learnedCount, 1);
  assert.equal(state.history.filter((item) => item.taskId === task.id).length, 1);
});

test('administrator może dodać trwałe rozwiązanie dla klasy problemu i nauczyć nim Agenta', async () => {
  const learning = createAllegroPreparationDecisionLearning({
    ...memoryRepository(),
    now: () => new Date('2026-08-06T09:00:00.000Z'),
  });
  const task = { id: 'task-custom', productId: '300', status: 'decision_required', missing: ['błędny EAN produktu'] };
  const added = await learning.addSolution({
    task,
    title: 'Napraw cyfrę kontrolną z oficjalnego źródła',
    description: 'Koryguj wyłącznie cyfrę kontrolną GTIN, gdy kod producenta w kartotece i na oficjalnej stronie jest identyczny.',
    baseResolutionId: 'official_source',
    createdBy: 'admin@example.test',
  });
  assert.match(added.solution.id, /^solution-/);
  let decorated = decorateAllegroPreparationStatus({ current: [task], recent: [] }, await learning.read());
  const custom = decorated.current[0].resolution.options.find((item) => item.id === added.solution.id);
  assert.equal(custom.custom, true);
  assert.equal(custom.action, 'queue');
  assert.equal(custom.baseResolutionId, 'official_source');
  await learning.recordResolution({ task, resolutionId: added.solution.id, selectedBy: 'admin@example.test' });
  decorated = decorateAllegroPreparationStatus({ current: [task], recent: [] }, await learning.read());
  assert.equal(decorated.current[0].resolution.options[0].id, added.solution.id);
  assert.equal(decorated.current[0].resolution.options[0].learnedCount, 1);
});

test('rozwiązanie własne jest proponowane tylko dla zgodnej rzeczywistej przyczyny', async () => {
  const learning = createAllegroPreparationDecisionLearning({
    ...memoryRepository(),
    now: () => new Date('2026-08-06T10:00:00.000Z'),
  });
  const ageTask = {
    id: 'task-age', productId: '401', status: 'decision_required',
    name: 'X-Press Me brelok DIY',
    missing: ['Brak kategorii Von Halsky', 'wymagany parametr: minimalny wiek'],
  };
  const added = await learning.addSolution({
    task: ageTask,
    title: 'Użyj wieku z oficjalnego opakowania',
    description: 'Odczytaj minimalny wiek wyłącznie z oficjalnego opakowania dokładnie tego produktu.',
    baseResolutionId: 'official_source',
  });
  await learning.recordResolution({ task: ageTask, resolutionId: added.solution.id });
  const state = await learning.read();
  const anotherAge = allegroPreparationResolutionOptions({
    name: 'X-Press Me brelok DIY Krab',
    missing: ['Brak kategorii Von Halsky', 'parametr wiek'],
  }, state);
  const unrelated = allegroPreparationResolutionOptions({
    name: 'Kapibary na Start',
    missing: ['Brak kategorii Von Halsky', 'Nie pobrano parametrów kategorii'],
  }, state);
  assert.deepEqual(allegroPreparationApplicabilityFeatures(ageTask), ['category', 'official_packaging_age', 'parameters', 'xpress_diy']);
  assert.equal(anotherAge.options[0].id, added.solution.id);
  assert.equal(unrelated.options.some((item) => item.id === added.solution.id), false);
  assert.equal(unrelated.options[0].id, 'official_source');
});

test('decyzja pozostaje wykonywalna poza pierwszą stroną dużej kolejki', () => {
  const task = { id: 'task-after-page', productId: '1169', status: 'decision_required' };
  const found = findAllegroPreparationDecisionTask({
    current: Array.from({ length: 1000 }, (_, index) => ({ id: `task-${index}`, productId: String(index) })),
    recent: [task],
  }, task.id, task.productId);
  assert.equal(found, task);
});

test('decyzja spoza skróconego widoku jest odczytywana bezpośrednio z trwałej kolejki', async () => {
  const durable = { id: 'task-beyond-page', productId: '1000951', status: 'decision_required', missing: ['GPSR'] };
  let requested = null;
  const found = await loadAllegroPreparationDecisionTask({
    findTask: async (taskId, productId) => {
      requested = { taskId, productId };
      return durable;
    },
  }, { current: [], recent: [] }, durable.id, durable.productId);
  assert.deepEqual(requested, { taskId: durable.id, productId: durable.productId });
  assert.equal(found, durable);
});
