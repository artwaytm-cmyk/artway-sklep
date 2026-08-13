import {
  allegroPreparationProductExclusion,
  createAllegroPreparationQueue,
  productFullPreparationReport,
  selectAllegroPreparationCandidates,
} from './domain/allegro-preparation-queue.mjs';
import { createAllegroPreparationWorker } from './domain/allegro-preparation-worker.mjs';
import { ALLEGRO_PREPARATION_MAX_PENDING } from './domain/allegro-preparation-queue-state.mjs';
import {
  allegroPreparationResolutionOptions,
  createAllegroPreparationDecisionLearning,
  decorateAllegroPreparationStatus,
  selectAllegroPreparationPriorityProductIds,
} from './domain/allegro-preparation-decisions.mjs';

const PRIORITY_SCOPES = Object.freeze({
  allegro_repairs: 'Najpierw naprawy istniejących ofert Allegro',
  new_allegro: 'Najpierw nowe produkty bez oferty Allegro',
  von_halsky: 'Najpierw przygotowanie Von Halsky',
  full_review: 'Pełny przegląd kartotek według kolejki',
});
const FULL_PRODUCT_PREPARATION_OPERATION = 'product-full-review';

export function findAllegroPreparationDecisionTask(queueState = {}, taskId = '', productId = '') {
  return [...(queueState.current || []), ...(queueState.recent || [])]
    .find((item) => String(item.id) === String(taskId) && String(item.productId) === String(productId));
}

export async function loadAllegroPreparationDecisionTask(queue, queueState = {}, taskId = '', productId = '') {
  const visible = findAllegroPreparationDecisionTask(queueState, taskId, productId);
  if (visible) return visible;
  return typeof queue?.findTask === 'function' ? queue.findTask(taskId, productId) : null;
}

export function createAllegroPreparationRoute(deps = {}) {
  const {
    respond, isAdmin, sessionOf, text, readVersioned, writeIfVersion, runtime,
    pool = null, listenerPool = pool, namespace = 'artway-sklep',
    workerConcurrency = 1,
    worker: workerDependencies,
    afterPrepare = null,
    coordinate = null,
  } = deps;
  const prepare = createAllegroPreparationWorker({
    ...workerDependencies,
    reportProgress: (work) => runtime.report({
      event: 'work_progress',
      source: 'allegro-preparation-worker',
      work,
    }),
  });
  let queue = null;
  let automaticPromise = null;
  const decisionLearning = createAllegroPreparationDecisionLearning({ readVersioned, writeIfVersion });
  const statusWithDecisions = async (source = null) => decorateAllegroPreparationStatus(source || await queue.status(), await decisionLearning.read());
  async function runAutomaticPreparation(raw = {}) {
    if (automaticPromise) return automaticPromise;
    automaticPromise = (async () => {
      if (typeof workerDependencies?.loadProducts !== 'function') {
        return { skipped: true, reason: 'catalog_unavailable', candidates: [], enqueued: 0 };
      }
      const currentQueue = await queue.status();
      if (Number(currentQueue.pending || 0) > 0 || currentQueue.active) {
        return { skipped: true, reason: 'queue_busy', candidates: [], enqueued: 0, queue: currentQueue };
      }
      const products = await workerDependencies.loadProducts();
      const requestedBatchSize = Math.max(1, Math.min(1000, Number(raw.batchSize) || 25));
      const timestamp = Date.now();
      const blockedProductIds = (Array.isArray(currentQueue.current) ? currentQueue.current : [])
        .filter((item) => {
          const status = String(item?.status || '').toLowerCase();
          if (['decision_required', 'failed'].includes(status)) return true;
          if (status !== 'waiting_provider') return false;
          const retryAt = Date.parse(String(item?.nextRetryAt || ''));
          return !Number.isFinite(retryAt) || retryAt > timestamp;
        })
        .map((item) => String(item.productId || ''))
        .filter(Boolean);
      const candidates = selectAllegroPreparationCandidates(products, {
        now: new Date(),
        limit: requestedBatchSize,
        preparationCurrent: workerDependencies.preparationCurrent,
        blockedProductIds,
      });
      if (!candidates.length) {
        return { skipped: true, reason: 'catalog_ready', candidates: [], enqueued: 0, queue: currentQueue };
      }
      const state = await queue.enqueue(candidates.map((item) => item.id), {
        operation: FULL_PRODUCT_PREPARATION_OPERATION,
        requestedBy: 'agent-zdarzeniowy',
        priorityByProduct: Object.fromEntries(candidates.map((item) => [item.id, item.priority])),
        priorityReasonByProduct: Object.fromEntries(candidates.map((item) => [
          item.id,
          `${item.reason}: luka jakości ${item.qualityGap}`,
        ])),
        inputFingerprintByProduct: Object.fromEntries(candidates.map((item) => [item.id, item.inputFingerprint || ''])),
        defaultPriority: 100,
      });
      const enqueued = Number(state.batches?.find((batch) => batch.id === state.batchId)?.enqueued ?? 0);
      return {
        skipped: false,
        candidates,
        enqueued,
        queue: state,
      };
    })();
    try {
      return await automaticPromise;
    } finally {
      automaticPromise = null;
    }
  }
  queue = createAllegroPreparationQueue({
    readVersioned,
    writeIfVersion,
    pool,
    listenerPool,
    namespace,
    workerConcurrency,
    prepare,
    afterPrepare,
    // Po opróżnieniu partii kolejka od razu dobiera następne niegotowe
    // kartoteki. Nie czeka na pięciominutowy zegar panelowego workera i nie
    // wymaga ponownego kliknięcia administratora.
    onIdle: () => runAutomaticPreparation({ batchSize: 100 }),
    verifyCompleted: async (task) => {
      if (typeof workerDependencies?.getCatalogProduct !== 'function') return { ready: true, missing: [] };
      const product = await workerDependencies.getCatalogProduct(task.productId);
      if (!product) {
        return {
          ready: false,
          missing: ['centralProduct'],
          code: 'central_product_missing_after_preparation',
          error: 'Centralna kartoteka zniknęła przed końcowym odczytem przygotowania.',
        };
      }
      return productFullPreparationReport(product);
    },
    report: async ({ task, status, result = {} }) => {
      const resolvedIssues = Array.isArray(result.resolvedIssues) ? result.resolvedIssues : [];
      if (status === 'completed' && resolvedIssues.length) {
        await decisionLearning.recordAutomaticSuccess({
          task: {
            ...task,
            name: result.name || '',
            missing: resolvedIssues,
          },
          resolutionId: 'official_source',
        }).catch(() => {});
      }
      return runtime.report({
        event: 'work_progress',
        source: 'allegro-preparation-queue',
        work: {
        id: `allegro-preparation:${task.productId}`,
        productId: task.productId,
        productName: result.name || '',
        channel: 'allegro',
        action: 'przygotowanie produktu do Allegro',
        phase: status,
        status: status === 'completed'
          ? 'confirmed'
          : status === 'waiting_provider'
            ? 'waiting_provider'
            : status === 'decision_required'
              ? 'decision_required'
              : status === 'attention'
                ? 'pending'
                : status,
        fields: result.savedFields || [],
        error: result.error || '',
        message: status === 'running'
          ? 'Agent serwerowy przygotowuje i zapisuje jeden produkt.'
          : status === 'completed'
            ? `Produkt został zapisany i potwierdzony odczytem z centralnej kartoteki.${(result.savedFields || []).length ? ` Zmieniono: ${(result.savedFields || []).join(', ')}.` : ''}`
            : status === 'pending' || status === 'attention'
              ? (result.message || `Automatyczna korekta trwa: ${(result.missing || []).join(', ')}`)
              : status === 'waiting_provider'
                ? `Pewne dane zapisano. Redakcja oczekuje na odnowienie dostępu AI do ${result.nextRetryAt || 'najbliższego automatycznego wznowienia'}.`
                : status === 'decision_required'
                  ? `Automatyczne metody zostały wyczerpane. Administrator musi rozstrzygnąć wyłącznie: ${(result.missing || []).join(', ')}`
              : 'Przygotowanie produktu nie zostało potwierdzone.',
        },
      });
    },
  });
  const resumeTimer = setTimeout(async () => {
    try {
      const current = await queue.status();
      // Ręczne wstrzymanie jest trwałą decyzją administratora. Restart usługi
      // nie może sam uruchomić kolejki; aktywne zadanie odzyskamy przy wznowieniu.
      if (!current.paused) await queue.resume({ recoverRunning: true });
    } catch (error) {
      console.error('allegro_preparation_queue_resume', error);
    }
  }, 1500);
  resumeTimer.unref?.();

  async function prepareProducts(productIds = [], {
    operation = 'product-full-review',
    requestedBy = 'agent-zdarzeniowy',
    wait = false,
    defaultPriority = 1000,
    prioritize = false,
    priorityReason = '',
    replaceExistingPriority = true,
  } = {}) {
    const requestedOperation = text(operation || FULL_PRODUCT_PREPARATION_OPERATION, 40);
    const requestedIds = [...new Set((Array.isArray(productIds) ? productIds : []).map(String).filter(Boolean))];
    const products = typeof workerDependencies?.loadProducts === 'function'
      ? await workerDependencies.loadProducts()
      : new Map();
    const excludedProductIds = requestedIds.filter((productId) => (
      allegroPreparationProductExclusion(products.get(productId)).excluded
    ));
    const eligibleProductIds = requestedIds.filter((productId) => !excludedProductIds.includes(productId));
    if (excludedProductIds.length) {
      await Promise.all(excludedProductIds.map((productId) => queue.resolveProduct(productId, {
        reason: 'product_in_trash',
      })));
    }
    if (!eligibleProductIds.length) {
      return {
        ...(await queue.status()),
        batchId: '',
        excludedProductIds,
        excludedCount: excludedProductIds.length,
      };
    }
    let state = await queue.enqueue(eligibleProductIds, {
      operation: FULL_PRODUCT_PREPARATION_OPERATION,
      requestedBy,
      defaultPriority,
    });
    if (prioritize) state = await queue.prioritize(eligibleProductIds, { priority: defaultPriority, reason: priorityReason || `requested:${requestedOperation}`, replaceExisting: replaceExistingPriority });
    if (wait) await queue.kick();
    return {
      ...state,
      excludedProductIds,
      excludedCount: excludedProductIds.length,
    };
  }

  async function startBacklog(raw = {}) {
    // Jedno wywołanie dodaje wyłącznie jedną ograniczoną partię. Kolejną
    // dobiera stała usługa Agenta dopiero po opróżnieniu kolejki. Chroni to
    // produkcję przed dawną, natychmiastową pętlą całego katalogu.
    return runAutomaticPreparation({ batchSize: raw.batchSize });
  }

  const allegroPreparationRoute = async function allegroPreparationRoute(req, url, action) {
    if (![
      'allegro-preparation-queue-status',
      'allegro-preparation-queue-enqueue',
      'allegro-preparation-queue-auto',
      'allegro-preparation-queue-control',
      'allegro-preparation-queue-prioritize',
      'allegro-preparation-decision',
      'allegro-preparation-solution',
    ].includes(action)) return null;
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    if (action === 'allegro-preparation-queue-status') return respond({ ok: true, queue: await statusWithDecisions() });
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    const body = await req.json().catch(() => ({}));
    const requestedBy = text(sessionOf(req)?.email || 'administrator', 200);
    if (action === 'allegro-preparation-solution') {
      const taskId = text(body.taskId, 120), productId = text(body.productId, 100);
      const decisionQueueState = await queue.status();
      const task = await loadAllegroPreparationDecisionTask(queue, decisionQueueState, taskId, productId);
      if (!task || !['decision_required', 'failed'].includes(String(task.status || '').toLowerCase())) {
        return respond({ ok: false, error: 'Problem został już rozwiązany albo zastąpiony nowszym wynikiem.', code: 'stale_allegro_preparation_solution' }, 409);
      }
      const learning = await decisionLearning.addSolution({
        task,
        title: body.title,
        description: body.description,
        baseResolutionId: text(body.baseResolutionId || 'official_source', 50),
        createdBy: requestedBy,
      });
      return respond({
        ok: true,
        signature: learning.signature,
        solution: learning.solution,
        queue: await statusWithDecisions(),
      }, 201);
    }
    if (action === 'allegro-preparation-decision') {
      const taskId = text(body.taskId, 120), productId = text(body.productId, 100);
      const resolutionId = text(body.resolutionId, 50);
      const decisionQueueState = await queue.status();
      const task = await loadAllegroPreparationDecisionTask(queue, decisionQueueState, taskId, productId);
      if (!task || !['decision_required', 'failed'].includes(String(task.status || '').toLowerCase())) {
        return respond({ ok: false, error: 'Ta decyzja została już wykonana albo zastąpiona nowszym wynikiem.', code: 'stale_allegro_preparation_decision' }, 409);
      }
      const learningState = await decisionLearning.read();
      const resolution = allegroPreparationResolutionOptions(task, learningState).options.find((item) => item.id === resolutionId);
      if (!resolution) return respond({ ok: false, error: 'Nieznany wariant rozwiązania.', code: 'invalid_allegro_resolution' }, 422);
      const baseResolutionId = resolution.baseResolutionId || resolution.id;
      let queueState = await queue.status();
      if (resolution.action === 'queue') {
        queueState = await queue.enqueue([productId], {
          operation: FULL_PRODUCT_PREPARATION_OPERATION,
          requestedBy,
          priorityByProduct: { [productId]: 120_000 },
          priorityReasonByProduct: { [productId]: `decyzja_administratora:${resolutionId}` },
          skipEditorialByProduct: { [productId]: baseResolutionId === 'verified_data' },
          defaultPriority: 120_000,
        });
      }
      const learning = await decisionLearning.recordResolution({
        task,
        resolutionId,
        selectedBy: requestedBy,
        remember: body.remember !== false,
      });
      await runtime.report({
        event: 'work_progress',
        source: 'administrator-allegro-resolution',
        work: {
          id: `allegro-resolution:${productId}:${Date.now().toString(36)}`,
          productId,
          channel: 'allegro',
          action: resolution.title,
          phase: resolution.action === 'queue' ? 'queued_as_next' : 'manual_editor',
          status: 'confirmed',
          target: 'naprawa oferty Allegro',
          message: body.remember === false ? 'Wariant wykonano jednorazowo.' : `Wariant wykonano i zapamiętano dla problemu ${learning.signature}.`,
        },
      }).catch(() => {});
      return respond({
        ok: true,
        openEditor: resolution.action === 'editor',
        remembered: learning.remembered,
        queue: await statusWithDecisions(queueState),
      }, resolution.action === 'queue' ? 202 : 200);
    }
    if (action === 'allegro-preparation-queue-prioritize') {
      const scope = text(body.scope, 40);
      const label = PRIORITY_SCOPES[scope];
      if (!label) return respond({ ok: false, error: 'Nieznany rodzaj pracy priorytetowej.', code: 'invalid_preparation_priority_scope' }, 422);
      if (typeof workerDependencies?.loadProducts !== 'function') return respond({ ok: false, error: 'Katalog produktów jest chwilowo niedostępny.', code: 'catalog_unavailable' }, 503);
      const rawQueue = await queue.status();
      const products = await workerDependencies.loadProducts();
      const productIds = selectAllegroPreparationPriorityProductIds(rawQueue, products, scope);
      const prioritized = await queue.prioritize(productIds, { priority: 100_000, reason: `administrator_scope:${scope}` });
      await decisionLearning.recordPriorityPolicy({ scope, label, matched: productIds.length, selectedBy: requestedBy });
      await runtime.report({
        event: 'work_progress',
        source: 'administrator-preparation-priority',
        work: {
          id: `allegro-preparation-priority:${Date.now().toString(36)}`,
          channel: 'system',
          action: label,
          phase: 'queue_priority',
          status: 'confirmed',
          target: 'kolejka przygotowania produktów',
          message: `Ustawiono ${productIds.length} oczekujących produktów. Bieżąca pozycja kończy się bezpiecznie.`,
        },
      }).catch(() => {});
      return respond({ ok: true, matched: productIds.length, queue: await statusWithDecisions(prioritized) });
    }
    if (action === 'allegro-preparation-queue-control') {
      const controlAction = text(body.action, 20).toLowerCase();
      if (!['pause', 'resume', 'cancel', 'cancel_previous'].includes(controlAction)) return respond({ ok: false, error: 'Nieznana operacja kolejki', code: 'invalid_queue_control' }, 422);
      const controlled = controlAction === 'pause'
        ? await queue.pause({ requestedBy })
        : controlAction === 'resume'
          ? await queue.resume({ recoverRunning: true })
          : controlAction === 'cancel_previous'
            ? await queue.cancelPrevious({ beforeBatchId: text(body.batchId, 120), requestedBy })
            : await queue.cancel({ batchId: text(body.batchId, 120), requestedBy });
      await runtime.report({
        event: 'work_progress',
        source: 'administrator-queue-control',
        work: {
          id: `allegro-preparation-control:${Date.now().toString(36)}`,
          channel: 'system',
          action: controlAction === 'pause' ? 'wstrzymanie kolejki produktów' : controlAction === 'resume' ? 'wznowienie kolejki produktów' : controlAction === 'cancel_previous' ? 'anulowanie wcześniejszych zadań produktów' : 'anulowanie oczekujących zadań produktów',
          phase: 'queue_control',
          status: 'confirmed',
          target: 'trwała kolejka przygotowania produktów',
          targetRef: text(body.batchId, 120),
          message: `Administrator wykonał operację ${controlAction}; stan zapisano w PostgreSQL.`,
        },
      }).catch(() => {});
      return respond({ ok: true, queue: await statusWithDecisions(controlled) });
    }
    if (action === 'allegro-preparation-queue-auto') {
      const automatic = await startBacklog(body);
      return respond({ ok: true, automatic }, automatic.skipped ? 200 : 202);
    }
    const productIds = [...new Set((Array.isArray(body.productIds) ? body.productIds : []).map(String).filter(Boolean))];
    if (productIds.length > ALLEGRO_PREPARATION_MAX_PENDING) {
      return respond({
        ok: false,
        error: `Jedna kolejka może zawierać maksymalnie ${ALLEGRO_PREPARATION_MAX_PENDING} produktów. Nie uruchomiono częściowej kolejki.`,
        code: 'allegro_preparation_batch_too_large',
      }, 422);
    }
    const coordinationId = `codex-batch:${Date.now().toString(36)}`;
    await runtime.report({
      event: 'work_progress',
      source: 'codex-coordinator',
      work: {
        id: coordinationId,
        channel: 'system',
        action: `koordynacja partii ${productIds.length} produktów`,
        phase: 'planning',
        status: 'running',
        target: 'trwała kolejka przygotowania produktów',
        message: 'Codex ustala kolejność i przekazuje ograniczone zadania agentom pomocniczym.',
      },
    }).catch(() => {});
    const coordinated = typeof coordinate === 'function'
      ? await coordinate({ kind: 'product.review', productIds }).catch((error) => ({
        ok: false,
        reason: text(error?.message || error, 240),
        plan: null,
      }))
      : { ok: false, reason: 'coordinator_not_configured', plan: null };
    const assignment = coordinated?.plan?.assignments?.find((item) => item.scenarioId === 'catalog-editorial') || null;
    const state = await prepareProducts(productIds, {
      operation: FULL_PRODUCT_PREPARATION_OPERATION,
      requestedBy: assignment ? 'codex-koordinator' : requestedBy,
      // Kliknięcie administratora nie jest zwykłym dopisaniem do backlogu.
      // Całe zaznaczenie ma rozpocząć się tuż po bezpiecznym dokończeniu
      // aktualnej kartoteki i pozostać przed automatycznymi zakresami napraw.
      defaultPriority: 200_000,
      prioritize: true,
      replaceExistingPriority: false,
      priorityReason: 'administrator_manual_selection',
    });
    await runtime.report({
      event: 'work_progress',
      source: 'codex-coordinator',
      work: {
        id: coordinationId,
        channel: 'system',
        action: `koordynacja partii ${productIds.length} produktów`,
        phase: assignment ? 'delegated' : 'safe_fallback',
        status: 'confirmed',
        target: 'trwała kolejka przygotowania produktów',
        targetRef: state.batchId,
        message: assignment
          ? `Codex przydzielił ${assignment.scenarioId} v${assignment.scenarioVersion}; wykonanie trwa na serwerze.`
          : `Plan Codex był niedostępny (${coordinated?.reason || 'brak odpowiedzi'}); bezpieczna kolejka deterministyczna została uruchomiona.`,
      },
    }).catch(() => {});
    return respond({
      ok: true,
      queued: true,
      startsAfterCurrent: true,
      priority: 200_000,
      queue: await statusWithDecisions(state),
      coordinator: assignment
        ? { id: 'codex', scenarioId: assignment.scenarioId, scenarioVersion: assignment.scenarioVersion }
        : { id: 'codex', fallback: true, reason: coordinated?.reason || 'unavailable' },
    }, 202);
  };
  allegroPreparationRoute.prepareProducts = prepareProducts;
  allegroPreparationRoute.startBacklog = startBacklog;
  allegroPreparationRoute.status = statusWithDecisions;
  allegroPreparationRoute.resolveProduct = (productId, details = {}) => queue.resolveProduct(productId, details);
  return allegroPreparationRoute;
}
