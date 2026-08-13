import { createPostgresAllegroPreparationQueue } from './allegro-preparation-postgres-queue.mjs';
import crypto from 'node:crypto';
import { providerQuotaUnavailable } from './agent-specialists-support.mjs';
import { productPreparationQualityGap, productSalePriority } from './product-preparation-priority.mjs';
import { finalizeFullProductPreparation } from './allegro-preparation-downstream.mjs';
import { productAgentReviewCurrent } from './product-agent-review-state.mjs';
import { centralAllegroPreparationCurrent } from './central-product-preparation-state.mjs';
import { editorialProductContentReport } from './product-editorial-safety.mjs';
import { vonHalskyProductReadiness } from './von-halsky-catalog.mjs';
import { SOURCE_IMAGE_POLICY_VERSION, sourcePageUrl } from './source-product-images.mjs';
import {
  ALLEGRO_PREPARATION_MAX_PENDING as MAX_PENDING,
  ALLEGRO_PREPARATION_MAX_RESULTS as MAX_RESULTS,
  allegroPreparationInitialState as initialState,
  normalizeAllegroPreparationState as normalizeState,
  normalizeAllegroPreparationTask as normalizeTask,
  publicAllegroPreparationState as publicState,
} from './allegro-preparation-queue-state.mjs';

export { productPreparationQualityGap } from './product-preparation-priority.mjs';
export { productAgentReviewCurrent } from './product-agent-review-state.mjs';
const STATE_KEY = 'allegro_preparation_queue';
const MAX_ATTEMPTS = 10;
const MAX_AUTOMATIC_REMEDIATION_ATTEMPTS = 3;
export const ALLEGRO_PREPARATION_VERSION = 18;
const ALLEGRO_PREPARATION_BASE_VERSION = 15;
const AUTO_RETRY_INTERVALS = Object.freeze([
  15_000,
  60_000,
  5 * 60_000,
]);

const clean = (value = '', limit = 500) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
const asArray = (value) => Array.isArray(value) ? value : [];
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

/**
 * Wersja 14 dodała obsługę ofert z wieloma produktami. Wersja bazowa 15
 * dodaje wspólne przekazanie zweryfikowanych dowodów parametrów do Allegro
 * i Von Halsky. Kartoteki z wersji 14 muszą więc przejść jeden pełny odczyt,
 * aby finisher kanału nie ominął nowej reguły przez wcześniejszy szybki zwrot.
 * Wersja 18 przelicza tylko zestawy z deklarowanymi składnikami, ponieważ ich
 * GPSR musi pochodzić z aktualnie rozpoznanego składu, a nie ze starego wyniku.
 */
export function allegroPreparationRequiredVersion(product = {}) {
  const bundleText = [
    product?.nazwa, product?.name, product?.opis,
    asObject(product?.sourceMaterial).longDescription,
    asObject(product?.allegroSafetyInformationProvenance).source,
  ].filter(Boolean).join(' ').toLowerCase();
  const declaredBundle = /kuferek|w zestawie znajdziesz|sk[łl]ad zestawu|rozpoznanych sk[łl]adnik[oó]w zestawu/.test(bundleText);
  return asArray(product?.allegroProductSet).length || declaredBundle
    ? ALLEGRO_PREPARATION_VERSION
    : ALLEGRO_PREPARATION_BASE_VERSION;
}

/**
 * Produkt przeniesiony do kosza nie jest kandydatem do przygotowania żadnego
 * kanału sprzedaży. Reguła jest wspólna dla automatycznego doboru, ręcznej
 * partii i wykonawcy, aby stare zadanie nie mogło ponownie ożywić usuniętej
 * kartoteki ani fałszować liczników braków.
 */
export function allegroPreparationProductExclusion(product = {}) {
  const recordStatus = clean(
    asObject(product?._catalog).recordStatus || product?.recordStatus,
    40,
  ).toLowerCase();
  return recordStatus === 'trash'
    ? { excluded: true, reason: 'product_in_trash', recordStatus }
    : { excluded: false, reason: '', recordStatus: recordStatus || 'active' };
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

/**
 * Jedna końcowa bramka całej kartoteki. Historyczny napis `ready` nie jest
 * dowodem gotowości: kontrolujemy bieżący zapis Allegro, faktyczną
 * publikowalność Von Halsky oraz dwa niezależne pokwitowania odczytu.
 * Aktywnej oferty Allegro nie przepisujemy — jej kanoniczne powiązanie jest
 * wystarczającym odczytem kontrolnym, o ile nie ma jawnego sygnału naprawy.
 */
export function productFullPreparationReport(product = {}, now = new Date()) {
  const editorial = asObject(product?.contentEditorial);
  const channels = asObject(editorial.channelStates);
  const disposition = allegroAutomaticPreparationDisposition(product);
  const version = Math.max(0, Number(product?.allegroAgentPreparationVersion) || 0);
  const requiredVersion = allegroPreparationRequiredVersion(product);
  const vonReadiness = vonHalskyProductReadiness(product);
  const primaryImage = clean(product?.zdjecie || product?.image, 3000);
  const galleryImages = asArray(product?.zdjecia || product?.images)
    .map((value) => clean(value && typeof value === 'object' ? value.url : value, 3000))
    .filter(Boolean);
  const checks = Object.freeze({
    storeEditorial: channels.store?.status === 'ready'
      && editorialProductContentReport(product, 'store').ready,
    allegroEditorial: channels.allegro?.status === 'ready'
      && editorialProductContentReport(product, 'allegro').ready,
    allegroPreparation: disposition.verificationOnly
      || (version >= requiredVersion && centralAllegroPreparationCurrent(product)),
    vonHalskyEditorial: channels.vonHalsky?.status === 'ready'
      && editorialProductContentReport(product, 'vonHalsky').ready,
    vonHalskyPublishable: vonReadiness.publishable === true,
    vonHalskyReadback: clean(product?.vonHalskyAgentStatus, 40).toLowerCase() === 'ready'
      && clean(product?.vonHalskyAgentSaveState, 40).toLowerCase() === 'confirmed'
      && product?.vonHalskyAgentReadbackConfirmed === true
      && asArray(product?.vonHalskyAgentMissingAttributes).length === 0
      && asArray(product?.vonHalskyRequiredAttributesMissing).length === 0,
    qualityReadback: clean(product?.agentQualityReviewStatus, 40).toLowerCase() === 'confirmed'
      && product?.agentQualityReadbackConfirmed === true,
    reviewCurrent: productAgentReviewCurrent(product, now),
    imageGalleryUnique: (!primaryImage || !galleryImages.includes(primaryImage))
      && new Set(galleryImages).size === galleryImages.length,
    sourceImageEvidenceCurrent: !sourcePageUrl(product)
      || (Number(product?.sourceEvidence?.imagePolicyVersion) || 0) >= SOURCE_IMAGE_POLICY_VERSION,
  });
  const missing = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
  return Object.freeze({
    ready: missing.length === 0,
    checks,
    missing: Object.freeze(missing),
    allegro: Object.freeze({
      verificationOnly: disposition.verificationOnly,
      repairRequired: disposition.repairRequired,
      version,
      requiredVersion,
    }),
    vonHalsky: Object.freeze({
      publishable: vonReadiness.publishable,
      issues: Object.freeze([...vonReadiness.issues, ...vonReadiness.publicationIssues]),
    }),
  });
}

function productFullReviewCurrent(product = {}, now = new Date()) {
  return productFullPreparationReport(product, now).ready;
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
  blockedProductIds = [],
} = {}) {
  const timestamp = now instanceof Date ? now.getTime() : parsedDate(now) || Date.now();
  const rows = products instanceof Map ? [...products.values()] : asArray(products);
  const blocked = new Set(asArray(blockedProductIds).map((id) => clean(id, 100)).filter(Boolean));
  const candidates = [];
  for (const product of rows) {
    const id = clean(product?.id ?? product?.productId, 100);
    if (!id || blocked.has(id) || allegroPreparationProductExclusion(product).excluded) continue;
    const fullReviewCurrent = productFullReviewCurrent(product, new Date(timestamp));
    if (fullReviewCurrent && !explicitAllegroRepairSignal(product)) continue;
    // Aktywne, kanonicznie powiązane oferty są weryfikowane przez okresową
    // synchronizację ofert. Nie wolno przepisywać ich opisów tylko dlatego,
    // że pochodzą sprzed wprowadzenia technicznego pokwitowania Agenta.
    if (allegroAutomaticPreparationDisposition(product).verificationOnly && fullReviewCurrent) continue;
    const status = clean(product?.allegroAgentPreparationStatus, 40).toLowerCase();
    const preparationVersion = Math.max(0, Number(product?.allegroAgentPreparationVersion) || 0);
    const preparedAt = parsedDate(product?.allegroAgentPreparedAt || product?.allegroAgentPreparationConfirmedAt);
    const sourceChangedAt = Math.max(
      parsedDate(product?.sourceRefreshedAt),
    );
    const nextRetryAt = parsedDate(product?.allegroAgentPreparationNextRetryAt);
    const implementationChanged = preparationVersion < allegroPreparationRequiredVersion(product);
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
    } else if (!fullReviewCurrent) {
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
      inputFingerprint: clean(product?._agentReview?.inputFingerprint, 160)
        || preparationFingerprintForCandidate(product),
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

function preparationFingerprintForCandidate(product = {}) {
  return crypto.createHash('sha256').update(JSON.stringify({
    name: product.nazwa || product.name || '',
    short: product.opisKrotki || product.krotkiOpis || '',
    long: product.opis || product.description || '',
    producer: product.producent || product.marka || '',
    ean: product.ean || product.gtin || '',
    code: product.kodProducenta || product.mpn || product.externalId || product.sku || '',
    source: product.sourceUrl || product.producentUrl || '',
    images: product.zdjecia || product.zdjecie || [],
    category: product.kategoria || product.category || '',
    allegroCategory: product.allegroCategoryId || '',
    vonHalskyCategory: product.vonHalskyCategoryId || '',
    sourceParameters: product.parametryZrodla || {},
    manufacturerParameters: product.parametryProducenta || {},
    packagingFacts: product.productPackagingFacts || {},
    productSet: product.allegroProductSet || [],
  })).digest('hex');
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
  verifyCompleted = null,
  now = () => new Date(),
  pool = null,
  listenerPool = pool,
  namespace = 'artway-sklep',
  workerConcurrency = 1,
} = {}) {
  if (pool) {
    return createPostgresAllegroPreparationQueue({
      pool, listenerPool, namespace, readVersioned, prepare, report, onIdle, afterPrepare, verifyCompleted, workerConcurrency, now,
    }, {
      clean, asArray, asObject, initialState, normalizeTask, normalizeState,
      publicState, providerQuotaUnavailable, MAX_AUTOMATIC_REMEDIATION_ATTEMPTS, MAX_PENDING,
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
    inputFingerprintByProduct = {},
    skipEditorialByProduct = {},
    defaultPriority = 1000,
  } = {}) {
    const requestedIds = asArray(productIds).map((id) => clean(id, 100)).filter(Boolean);
    const ids = [...new Set(requestedIds)];
    if (!ids.length) {
      const error = new Error('Zaznacz co najmniej jeden produkt.');
      error.status = 422;
      throw error;
    }
    if (ids.length > MAX_PENDING) {
      const error = new Error(`Jedna kolejka może zawierać maksymalnie ${MAX_PENDING} produktów. Nie uruchomiono częściowej kolejki.`);
      error.status = 422;
      error.code = 'allegro_preparation_batch_too_large';
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
        inputFingerprint: inputFingerprintByProduct?.[productId] || '',
        skipEditorial: skipEditorialByProduct?.[productId] === true,
      }));
      const createdByProduct = new Map(tasks.map((task) => [task.productId, task]));
      const trackedTasks = ids.map((productId) => occupied.get(productId) || createdByProduct.get(productId)).filter(Boolean);
      if (state.pending.length + tasks.length > MAX_PENDING) {
        const error = new Error(`Trwała kolejka ma miejsce na ${Math.max(0, MAX_PENDING - state.pending.length)} produktów. Nie dodano części zaznaczenia.`);
        error.status = 409;
        error.code = 'allegro_preparation_queue_capacity';
        throw error;
      }
      return {
        ...state,
        pending: [...state.pending, ...tasks],
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
      const ordered = [...state.pending].sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0)
        || String(left.requestedAt || '').localeCompare(String(right.requestedAt || '')));
      const selected = ordered[0];
      claimed = normalizeTask({
        ...selected,
        attempt: Number(selected.attempt || 0) + 1,
        skipEditorial: selected.skipEditorial === true || editorialProviderUnavailable,
      });
      return {
        ...state,
        active: claimed,
        pending: state.pending.filter((item) => item.id !== selected.id),
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
        result = await finalizeFullProductPreparation({ afterPrepare, verifyCompleted, task, result, clean });
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
          // Zadanie przerwane restartem było już wykonywane. Odtwarzamy je
          // przed zwykłymi oczekującymi pozycjami niezależnie od daty, którą
          // stara wersja stanu dopisała podczas normalizacji.
          pending: [{
            ...state.active,
            attempt: Number(state.active.attempt || 0),
            priority: 200_000,
            priorityReason: 'recovered_active_after_restart',
          }, ...state.pending],
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

  async function prioritize(productIds = [], {
    priority = 100_000,
    reason = 'administrator_priority',
  } = {}) {
    const ids = new Set(asArray(productIds).map((id) => clean(id, 100)).filter(Boolean));
    if (!ids.size) return { ...(await status()), priority: { matched: 0, activeFinishesSafely: true } };
    let matched = 0;
    const selectedPriority = Math.max(10_001, Math.min(200_000, Number(priority) || 100_000));
    await mutate((state) => ({
      ...state,
      pending: state.pending.map((task) => {
        if (ids.has(task.productId)) {
          matched++;
          return normalizeTask({ ...task, priority: selectedPriority, priorityReason: reason });
        }
        return task.priority > 10_000
          ? normalizeTask({ ...task, priority: 10_000, priorityReason: 'previous_administrator_priority' })
          : task;
      }),
    }));
    kick();
    return { ...(await status()), priority: { matched, activeFinishesSafely: true } };
  }

  async function resolveProduct(productId, {
    reason = 'confirmed_outside_preparation_queue',
    offerId = '',
  } = {}) {
    const id = clean(productId, 100);
    if (!id) return { modified: 0 };
    let modified = 0;
    await mutate((state) => {
      const pending = state.pending.filter((task) => {
        const keep = String(task.productId) !== id;
        if (!keep) modified++;
        return keep;
      });
      const activeMatches = String(state.active?.productId || '') === id;
      if (activeMatches) modified++;
      const existing = state.results.filter((item) => String(item.productId) !== id);
      const resolved = {
        id: `resolved:${id}:${Date.now().toString(36)}`,
        productId: id,
        status: 'completed',
        ready: true,
        completedAt: now().toISOString(),
        missing: [],
        error: '',
        reason: clean(reason, 160),
        offerId: clean(offerId, 120),
      };
      return {
        ...state,
        pending,
        active: activeMatches ? null : state.active,
        results: [resolved, ...existing].slice(0, MAX_RESULTS),
      };
    });
    return { modified };
  }

  async function findTask(taskId = '', productId = '') {
    const state = await read();
    return [state.active, ...state.pending, ...state.results]
      .filter(Boolean)
      .find((item) => String(item.id) === String(taskId) && String(item.productId) === String(productId)) || null;
  }

  return Object.freeze({ enqueue, status, prioritize, resume, kick, resolveProduct, findTask });
}
