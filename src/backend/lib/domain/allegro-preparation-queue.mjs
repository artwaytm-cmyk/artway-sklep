import { createPostgresAllegroPreparationQueue } from './allegro-preparation-postgres-queue.mjs';
import crypto from 'node:crypto';
import { providerQuotaUnavailable } from './agent-specialists-support.mjs';
import { productPreparationQualityGap, productSalePriority } from './product-preparation-priority.mjs';
import { runAllegroPreparationDownstream } from './allegro-preparation-downstream.mjs';

export { productPreparationQualityGap } from './product-preparation-priority.mjs';

const STATE_KEY = 'allegro_preparation_queue';
const MAX_PENDING = 2000;
const MAX_RESULTS = 1000;
const MAX_ATTEMPTS = 10;
const MAX_AUTOMATIC_REMEDIATION_ATTEMPTS = 3;
export const ALLEGRO_PREPARATION_VERSION = 6;
const AUTO_RETRY_INTERVALS = Object.freeze([
  15_000,
  60_000,
  5 * 60_000,
]);

const clean = (value = '', limit = 500) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
const asArray = (value) => Array.isArray(value) ? value : [];
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

function initialState() {
  return {
    version: 1,
    pending: [],
    active: null,
    results: [],
    batches: [],
    blockedUntil: '',
    blockedReason: '',
    updatedAt: '',
  };
}

function normalizeTask(value = {}) {
  const source = asObject(value);
  return {
    id: clean(source.id || crypto.randomUUID(), 120),
    batchId: clean(source.batchId, 120),
    productId: clean(source.productId, 100),
    operation: clean(source.operation || 'allegro', 40),
    requestedBy: clean(source.requestedBy || 'administrator', 200),
    requestedAt: clean(source.requestedAt || new Date().toISOString(), 50),
    priority: Math.max(0, Math.min(10_000, Number(source.priority) || 0)),
    priorityReason: clean(source.priorityReason, 160),
    attempt: Math.max(0, Number(source.attempt) || 0),
    skipEditorial: source.skipEditorial === true,
  };
}

function normalizeState(value = {}) {
  const source = asObject(value);
  return {
    version: 1,
    pending: asArray(source.pending).map(normalizeTask).filter((item) => item.productId).slice(0, MAX_PENDING),
    active: source.active ? normalizeTask(source.active) : null,
    results: asArray(source.results).map((item) => ({ ...asObject(item), productId: clean(item?.productId, 100) })).filter((item) => item.productId).slice(0, MAX_RESULTS),
    batches: asArray(source.batches).map((item) => ({ ...asObject(item), id: clean(item?.id, 120) })).filter((item) => item.id).slice(0, 100),
    blockedUntil: clean(source.blockedUntil, 50),
    blockedReason: clean(source.blockedReason, 500),
    updatedAt: clean(source.updatedAt, 50),
  };
}

function publicState(value = {}) {
  const state = normalizeState(value);
  const batchById = new Map(state.batches.map((batch) => [batch.id, {
    ...batch, pending: 0, running: 0, completed: 0, attention: 0, waitingProvider: 0, decisionRequired: 0, failed: 0,
    pendingProductIds: [], activeProductId: '', unknown: 0,
  }]));
  const taskState = new Map();
  for (const item of state.pending) {
    taskState.set(item.id, { status: 'pending', item });
    const batch = batchById.get(item.batchId);
    if (batch) {
      batch.pending += 1;
      batch.pendingProductIds.push(item.productId);
    }
  }
  if (state.active) {
    taskState.set(state.active.id, { status: 'running', item: state.active });
    const batch = batchById.get(state.active.batchId);
    if (batch) {
      batch.running += 1;
      batch.activeProductId = state.active.productId;
    }
  }
  for (const item of state.results) {
    if (!taskState.has(item.id)) taskState.set(item.id, { status: item.status, item });
    const batch = batchById.get(item.batchId);
    if (!batch) continue;
    if (item.status === 'completed') batch.completed += 1;
    else if (item.status === 'attention') batch.attention += 1;
    else if (item.status === 'waiting_provider') batch.waitingProvider += 1;
    else if (item.status === 'decision_required') batch.decisionRequired += 1;
    else if (item.status === 'failed') batch.failed += 1;
  }
  // Nowe partie zapamiętują dokładne identyfikatory zadań. Dzięki temu
  // ponowne kliknięcie tych samych produktów śledzi istniejącą pracę,
  // zamiast tworzyć pusty raport albo pokazywać historyczne błędy.
  for (const batch of batchById.values()) {
    const trackedTaskIds = [...new Set(asArray(batch.trackedTaskIds).map((id) => clean(id, 120)).filter(Boolean))];
    if (!trackedTaskIds.length) continue;
    Object.assign(batch, {
      pending: 0, running: 0, completed: 0, attention: 0, waitingProvider: 0, decisionRequired: 0, failed: 0,
      pendingProductIds: [], activeProductId: '', unknown: 0,
    });
    for (const taskId of trackedTaskIds) {
      const tracked = taskState.get(taskId);
      if (!tracked) {
        batch.unknown += 1;
        continue;
      }
      if (tracked.status === 'pending') {
        batch.pending += 1;
        batch.pendingProductIds.push(tracked.item.productId);
      } else if (tracked.status === 'running') {
        batch.running += 1;
        batch.activeProductId = tracked.item.productId;
      } else if (tracked.status === 'completed') batch.completed += 1;
      else if (tracked.status === 'attention') batch.attention += 1;
      else if (tracked.status === 'waiting_provider') batch.waitingProvider += 1;
      else if (tracked.status === 'decision_required') batch.decisionRequired += 1;
      else if (tracked.status === 'failed') batch.failed += 1;
    }
  }
  // Historia partii pozostaje dostępna, ale bieżący licznik produktu musi
  // uwzględniać wyłącznie jego najnowsze zadanie. Dawne "attention" nie może
  // wracać do licznika po późniejszym, poprawnym przygotowaniu.
  const currentByProduct = new Map();
  if (state.active) currentByProduct.set(state.active.productId, { ...state.active, status: 'running' });
  for (const item of state.pending) {
    if (!currentByProduct.has(item.productId)) currentByProduct.set(item.productId, { ...item, status: 'pending' });
  }
  for (const item of state.results) {
    if (!currentByProduct.has(item.productId)) currentByProduct.set(item.productId, item);
  }
  const current = [...currentByProduct.values()];
  const currentSummary = {
    total: current.length,
    pending: current.filter((item) => item.status === 'pending').length,
    running: current.filter((item) => item.status === 'running').length,
    completed: current.filter((item) => item.status === 'completed').length,
    attention: current.filter((item) => item.status === 'attention').length,
    waitingProvider: current.filter((item) => item.status === 'waiting_provider').length,
    decisionRequired: current.filter((item) => item.status === 'decision_required').length,
    failed: current.filter((item) => item.status === 'failed').length,
  };
  return {
    running: !!state.active || state.pending.length > 0,
    active: state.active,
    pending: state.pending.length,
    recent: state.results.slice(0, 100),
    current: current.slice(0, MAX_RESULTS),
    currentSummary,
    batches: [...batchById.values()].slice(0, 20),
    blockedUntil: state.blockedUntil,
    blockedReason: state.blockedReason,
    updatedAt: state.updatedAt,
  };
}

function parsedDate(value = '') {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function activeAllegroOffer(product = {}) {
  const catalogChannel = asObject(asObject(product?._catalog).channels).allegro;
  const offerId = clean(
    product?.allegroOfferId || product?.offerId || catalogChannel?.offerId,
    120,
  );
  const status = clean(
    product?.allegroStatus || product?.allegroPublicationStatus || catalogChannel?.status,
    80,
  ).toUpperCase();
  return {
    offerId,
    status,
    active: Boolean(offerId) && !['ENDED', 'INACTIVE', 'ARCHIVED', 'DELETED'].includes(status),
  };
}

function explicitAllegroRepairSignal(product = {}) {
  const editorial = asObject(product?.contentEditorial);
  const queuedSourceUpdate = clean(editorial.status, 60).toLowerCase() === 'queued'
    && clean(editorial.queuedReason, 100).toLowerCase() === 'source_updated';
  return product?.forceEditorialRefresh === true
    || product?.allegroPublicationIntent === true
    || product?.allegroPreparationForce === true
    || queuedSourceUpdate
    || Boolean(clean(product?.allegroComplianceError, 1000))
    || Boolean(clean(product?.allegroPublicationLastErrorCode, 300));
}

/**
 * Aktywna, powiązana oferta jest już produktem sprzedażowym, a nie kandydatem
 * do ciągłej redakcji. Jej status i obecność kontroluje lekka synchronizacja
 * Allegro. Do ciężkiej kolejki wraca wyłącznie po jawnym sygnale naprawy.
 */
export function allegroAutomaticPreparationDisposition(product = {}) {
  const offer = activeAllegroOffer(product);
  const repairRequired = explicitAllegroRepairSignal(product);
  return {
    ...offer,
    repairRequired,
    verificationOnly: offer.active && !repairRequired,
    reason: offer.active && !repairRequired
      ? 'active_listing_verification_only'
      : repairRequired
        ? 'explicit_repair_signal'
        : 'not_active_on_allegro',
  };
}

function productFullReviewCurrent(product = {}) {
  const editorial = asObject(product?.contentEditorial);
  const channels = asObject(editorial.channelStates);
  const storeReady = channels.store?.status === 'ready';
  const allegroReady = channels.allegro?.status === 'ready';
  const vonHalskyReady = channels.vonHalsky?.status === 'ready'
    || clean(product?.vonHalskyAgentStatus, 40).toLowerCase() === 'ready';
  const activeAllegroVerified = allegroAutomaticPreparationDisposition(product).verificationOnly;
  return vonHalskyReady && ((storeReady && allegroReady) || activeAllegroVerified);
}

/**
 * Wybiera pracę dla serwerowego Agenta bez dziennego limitu. Limit parametru
 * to wyłącznie rozmiar jednej bezpiecznej partii; po jej opróżnieniu kolejka
 * natychmiast pobiera następną bez zegara i bez cyklu czasowego.
 */
export function selectAllegroPreparationCandidates(products = [], {
  now = new Date(),
  limit = 50,
  verificationAgeMs = 30 * 24 * 60 * 60_000,
  preparationCurrent = null,
} = {}) {
  const timestamp = now instanceof Date ? now.getTime() : parsedDate(now) || Date.now();
  const rows = products instanceof Map ? [...products.values()] : asArray(products);
  const candidates = [];
  for (const product of rows) {
    const id = clean(product?.id ?? product?.productId, 100);
    if (!id || asObject(product?._catalog).recordStatus === 'trash') continue;
    // Aktywne, kanonicznie powiązane oferty są weryfikowane przez okresową
    // synchronizację ofert. Nie wolno przepisywać ich opisów tylko dlatego,
    // że pochodzą sprzed wprowadzenia technicznego pokwitowania Agenta.
    if (allegroAutomaticPreparationDisposition(product).verificationOnly && productFullReviewCurrent(product)) continue;
    const status = clean(product?.allegroAgentPreparationStatus, 40).toLowerCase();
    const preparationVersion = Math.max(0, Number(product?.allegroAgentPreparationVersion) || 0);
    const preparedAt = parsedDate(product?.allegroAgentPreparedAt || product?.allegroAgentPreparationConfirmedAt);
    const sourceChangedAt = Math.max(
      parsedDate(product?.sourceRefreshedAt),
    );
    const nextRetryAt = parsedDate(product?.allegroAgentPreparationNextRetryAt);
    const implementationChanged = preparationVersion < ALLEGRO_PREPARATION_VERSION;
    const retryDue = implementationChanged || !nextRetryAt || nextRetryAt <= timestamp || sourceChangedAt > preparedAt;
    const current = typeof preparationCurrent === 'function'
      ? preparationCurrent(product)
      : ['ready', 'published'].includes(status) && !asArray(product?.allegroAgentPreparationMissing).length;

    const qualityGap = productPreparationQualityGap(product);
    let priority = 0, reason = '';
    if (status === 'decision_required') {
      if (implementationChanged) {
        priority = 550 + qualityGap.score + productSalePriority(product);
        reason = 'nowa_wersja_automatycznej_naprawy';
      } else if (sourceChangedAt > preparedAt) {
        priority = 340 + qualityGap.score + productSalePriority(product);
        reason = 'nowe_dane_po_decyzji';
      }
    } else if (['needs_attention', 'attention', 'retrying', 'failed', 'waiting_provider'].includes(status) && retryDue) {
      priority = 500 + qualityGap.score + productSalePriority(product);
      reason = status === 'waiting_provider' ? 'wznowienie_po_dostawcy' : 'wymaga_uzupelnienia';
    } else if (!productFullReviewCurrent(product)) {
      priority = 360 + qualityGap.score + productSalePriority(product);
      reason = 'pelny_przeglad_edytora_i_von_halsky';
    } else if (!status || status === 'new' || status === 'queued' || !preparedAt) {
      priority = 200 + qualityGap.score + productSalePriority(product);
      reason = 'nieprzygotowany';
    } else if (!current && retryDue) {
      priority = 260 + qualityGap.score + productSalePriority(product);
      reason = 'nieaktualne_przygotowanie';
    } else if (current && (
      sourceChangedAt > preparedAt
      || !preparedAt
      || timestamp - preparedAt >= verificationAgeMs
    )) {
      priority = 100 + qualityGap.score + productSalePriority(product);
      reason = sourceChangedAt > preparedAt ? 'zmienione_zrodlo' : 'weryfikacja_okresowa';
    }
    if (!priority) continue;
    candidates.push({
      id,
      priority,
      reason,
      qualityGap: qualityGap.score,
      qualityScore: qualityGap.completeness,
      qualityMissing: qualityGap.missing,
      preparedAt: preparedAt ? new Date(preparedAt).toISOString() : '',
      nextRetryAt: nextRetryAt ? new Date(nextRetryAt).toISOString() : '',
      retryCount: Math.max(0, Number(product?.allegroAgentPreparationRetryCount) || 0),
    });
  }
  return candidates
    .sort((left, right) => right.priority - left.priority
      || parsedDate(left.preparedAt) - parsedDate(right.preparedAt)
      || left.id.localeCompare(right.id, 'pl', { numeric: true }))
    .slice(0, Math.max(1, Math.min(1000, Number(limit) || 50)));
}

export function allegroPreparationRetryState(previous = {}, missing = [], {
  ready = false,
  now = new Date(),
} = {}) {
  if (ready) return { retryCount: 0, nextRetryAt: '' };
  const currentMissing = [...new Set(asArray(missing).map((item) => clean(item, 500)).filter(Boolean))].sort();
  const previousMissing = [...new Set(asArray(previous?.allegroAgentPreparationMissing).map((item) => clean(item, 500)).filter(Boolean))].sort();
  const same = JSON.stringify(currentMissing) === JSON.stringify(previousMissing);
  const retryCount = same ? Math.max(0, Number(previous?.allegroAgentPreparationRetryCount) || 0) + 1 : 1;
  const delay = AUTO_RETRY_INTERVALS[Math.min(AUTO_RETRY_INTERVALS.length - 1, retryCount - 1)];
  const timestamp = now instanceof Date ? now.getTime() : parsedDate(now) || Date.now();
  return { retryCount, nextRetryAt: new Date(timestamp + delay).toISOString() };
}

export function allegroPreparationAttemptDisposition({
  ready = false,
  providerUnavailable = false,
  attempt = 1,
} = {}) {
  if (ready) return 'completed';
  if (providerUnavailable) return 'waiting_provider';
  if (Math.max(1, Number(attempt) || 1) >= MAX_AUTOMATIC_REMEDIATION_ATTEMPTS) return 'decision_required';
  return 'attention';
}

export function createAllegroPreparationQueue({
  readVersioned,
  writeIfVersion,
  prepare,
  report = null,
  onIdle = null,
  afterPrepare = null,
  now = () => new Date(),
  pool = null,
  namespace = 'artway-sklep',
} = {}) {
  if (pool) {
    return createPostgresAllegroPreparationQueue({
      pool, namespace, readVersioned, prepare, report, onIdle, afterPrepare, now,
    }, {
      clean, asArray, asObject, initialState, normalizeTask, normalizeState,
      publicState, providerQuotaUnavailable, MAX_AUTOMATIC_REMEDIATION_ATTEMPTS,
    });
  }
  if (typeof readVersioned !== 'function' || typeof writeIfVersion !== 'function' || typeof prepare !== 'function') {
    throw new Error('Kolejka przygotowania Allegro wymaga trwałego repozytorium i wykonawcy.');
  }

  let workerPromise = null;
  let editorialProviderUnavailable = false;

  async function mutate(callback) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const version = await readVersioned(STATE_KEY, initialState());
      const previous = normalizeState(version.value);
      const next = normalizeState(callback(previous));
      next.updatedAt = now().toISOString();
      const write = await writeIfVersion(STATE_KEY, next, version);
      if (write?.modified) return next;
    }
    const error = new Error('Nie udało się bezpiecznie zapisać kolejki przygotowania Allegro.');
    error.code = 'allegro_preparation_queue_conflict';
    throw error;
  }

  async function read() {
    const version = await readVersioned(STATE_KEY, initialState());
    return normalizeState(version.value);
  }

  async function enqueue(productIds = [], {
    operation = 'allegro',
    requestedBy = 'administrator',
    priorityByProduct = {},
    priorityReasonByProduct = {},
    defaultPriority = 1000,
  } = {}) {
    const requestedIds = asArray(productIds).map((id) => clean(id, 100)).filter(Boolean);
    const ids = [...new Set(requestedIds)].slice(0, 1000);
    if (!ids.length) {
      const error = new Error('Zaznacz co najmniej jeden produkt.');
      error.status = 422;
      throw error;
    }
    const batchId = `allegro-prep-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`, requestedAt = now().toISOString();
    const next = await mutate((state) => {
      const occupied = new Map([
        ...state.pending.map((item) => [item.productId, item]),
        ...(state.active ? [[state.active.productId, state.active]] : []),
      ]);
      const tasks = ids.filter((id) => !occupied.has(id)).map((productId) => normalizeTask({
        id: crypto.randomUUID(), batchId, productId, operation, requestedBy, requestedAt,
        priority: Number(priorityByProduct?.[productId]) || defaultPriority,
        priorityReason: priorityReasonByProduct?.[productId] || '',
      }));
      const createdByProduct = new Map(tasks.map((task) => [task.productId, task]));
      const trackedTasks = ids.map((productId) => occupied.get(productId) || createdByProduct.get(productId)).filter(Boolean);
      return {
        ...state,
        pending: [...state.pending, ...tasks].slice(0, MAX_PENDING),
        batches: [{
          id: batchId,
          operation: clean(operation, 40),
          requestedBy: clean(requestedBy, 200),
          requestedAt,
          total: trackedTasks.length,
          enqueued: tasks.length,
          duplicatesSkipped: requestedIds.length - tasks.length,
          requestedProductIds: trackedTasks.map((task) => task.productId),
          trackedTaskIds: trackedTasks.map((task) => task.id),
        }, ...state.batches].slice(0, 100),
      };
    });
    kick();
    return { batchId, ...publicState(next) };
  }

  async function claim() {
    let claimed = null;
    await mutate((state) => {
      if (state.active || !state.pending.length) return state;
      claimed = normalizeTask({
        ...state.pending[0],
        attempt: Number(state.pending[0].attempt || 0) + 1,
        skipEditorial: editorialProviderUnavailable,
      });
      return {
        ...state,
        active: claimed,
        pending: state.pending.slice(1),
        blockedUntil: '',
        blockedReason: '',
      };
    });
    return claimed;
  }

  async function finish(task, result) {
    return mutate((state) => {
      const item = {
        id: task.id,
        batchId: task.batchId,
        productId: task.productId,
        operation: task.operation,
        requestedAt: task.requestedAt,
        completedAt: now().toISOString(),
        status: result?.status || (result?.ready === false ? 'attention' : 'completed'),
        ready: result?.ready === true,
        name: clean(result?.name, 300),
        missing: asArray(result?.missing).map((entry) => clean(entry, 500)).filter(Boolean).slice(0, 50),
        savedFields: asArray(result?.savedFields).map((entry) => clean(entry, 120)).filter(Boolean).slice(0, 100),
        mutationId: clean(result?.mutationId, 160),
        error: clean(result?.error, 1000),
        nextRetryAt: clean(result?.nextRetryAt, 50),
        decision: asObject(result?.decision),
        downstream: asObject(result?.downstream),
      };
      return { ...state, active: state.active?.id === task.id ? null : state.active, results: [item, ...state.results].slice(0, MAX_RESULTS) };
    });
  }

  async function requeue(task) {
    return mutate((state) => ({
      ...state,
      active: state.active?.id === task.id ? null : state.active,
      pending: [normalizeTask(task), ...state.pending].slice(0, MAX_PENDING),
    }));
  }

  async function run() {
    while (true) {
      const task = await claim();
      if (!task) {
        const refill = typeof onIdle === 'function' ? await onIdle() : null;
        if (Number(refill?.enqueued || 0) > 0) continue;
        break;
      }
      if (typeof report === 'function') await report({ task, status: 'running' }).catch(() => {});
      try {
        let result = await prepare(task);
        const continueAutomatically = result?.status === 'attention'
          && result?.providerUnavailable !== true
          && Number(task.attempt || 0) < MAX_AUTOMATIC_REMEDIATION_ATTEMPTS;
        if (continueAutomatically) {
          await requeue(task);
          if (typeof report === 'function') await report({
            task,
            status: 'pending',
            result: {
              ...result,
              message: `Automatyczna korekta trwa — próba ${Number(task.attempt || 0) + 1} z ${MAX_AUTOMATIC_REMEDIATION_ATTEMPTS} została już ustawiona w tej samej kolejce.`,
            },
          }).catch(() => {});
          continue;
        }
        if (result?.status === 'attention') {
          result = {
            ...result,
            status: 'decision_required',
            decision: {
              reason: 'automatic_remediation_exhausted',
              missing: asArray(result?.missing),
              attempts: Number(task.attempt || 0),
            },
          };
        }
        if (typeof afterPrepare === 'function' && result?.ready === true) {
          const downstream = await runAllegroPreparationDownstream({ afterPrepare, task, result, clean });
          result = {
            ...result,
            downstream: asObject(downstream),
          };
        }
        await finish(task, result);
        if (typeof report === 'function') await report({ task, status: result?.status || (result?.ready === false ? 'decision_required' : 'completed'), result }).catch(() => {});
        // Redaktorzy zapisują bezpieczne pola nawet wtedy, gdy dostawca AI zwróci
        // limit rozliczeniowy. Taki wynik nie jest wyjątkiem, dlatego kolejka musi
        // rozpoznać go jawnie i kontynuować bez redakcji dla kolejnych produktów.
        if (result?.providerUnavailable === true || providerQuotaUnavailable(result?.error)) {
          editorialProviderUnavailable = true;
          continue;
        }
      } catch (error) {
        const quotaUnavailable = providerQuotaUnavailable(error);
        const result = {
          status: quotaUnavailable
            ? 'waiting_provider'
            : Number(task.attempt || 0) < MAX_AUTOMATIC_REMEDIATION_ATTEMPTS
              ? 'pending'
              : 'decision_required',
          ready: false,
          providerUnavailable: quotaUnavailable,
          error: clean(error?.message || error, 1000),
          nextRetryAt: quotaUnavailable ? new Date(now().getTime() + 6 * 60 * 60_000).toISOString() : '',
          decision: quotaUnavailable || Number(task.attempt || 0) < MAX_AUTOMATIC_REMEDIATION_ATTEMPTS
            ? null
            : {
                reason: 'automatic_execution_failed',
                attempts: Number(task.attempt || 0),
                error: clean(error?.message || error, 1000),
              },
        };
        if (!quotaUnavailable && Number(task.attempt || 0) < MAX_AUTOMATIC_REMEDIATION_ATTEMPTS) {
          await requeue(task);
          if (typeof report === 'function') await report({ task, status: 'pending', result }).catch(() => {});
          continue;
        }
        await finish(task, result);
        if (typeof report === 'function') await report({ task, status: result.status, result }).catch(() => {});
        if (quotaUnavailable) {
          editorialProviderUnavailable = true;
          continue;
        }
      }
    }
  }

  function kick() {
    if (workerPromise) return workerPromise;
    workerPromise = Promise.resolve().then(run).finally(() => { workerPromise = null; });
    return workerPromise;
  }

  async function resume() {
    editorialProviderUnavailable = false;
    await mutate((state) => state.active
      ? {
          ...state,
          pending: [{ ...state.active, attempt: Number(state.active.attempt || 0) }, ...state.pending],
          active: null,
          blockedUntil: '',
          blockedReason: '',
        }
      : { ...state, blockedUntil: '', blockedReason: '' });
    kick();
    return status();
  }

  async function status() {
    return publicState(await read());
  }

  return Object.freeze({ enqueue, status, resume, kick });
}
