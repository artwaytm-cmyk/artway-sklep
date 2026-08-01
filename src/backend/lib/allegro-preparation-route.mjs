import { createAllegroPreparationQueue, selectAllegroPreparationCandidates } from './domain/allegro-preparation-queue.mjs';
import { createAllegroPreparationWorker } from './domain/allegro-preparation-worker.mjs';

export function createAllegroPreparationRoute(deps = {}) {
  const {
    respond, isAdmin, sessionOf, text, readVersioned, writeIfVersion, runtime,
    pool = null, listenerPool = pool, namespace = 'artway-sklep',
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
  let backlogEnabled = false;
  let automaticPromise = null;
  async function runAutomaticPreparation(raw = {}) {
    if (automaticPromise) return automaticPromise;
    automaticPromise = (async () => {
      if (typeof workerDependencies?.loadProducts !== 'function') {
        backlogEnabled = false;
        return { skipped: true, reason: 'catalog_unavailable', candidates: [], enqueued: 0 };
      }
      const currentQueue = await queue.status();
      if (Number(currentQueue.pending || 0) > 0 || currentQueue.active) {
        return { skipped: true, reason: 'queue_busy', candidates: [], enqueued: 0, queue: currentQueue };
      }
      const products = await workerDependencies.loadProducts();
      const candidates = selectAllegroPreparationCandidates(products, {
        now: new Date(),
        limit: Math.max(1, Math.min(1000, Number(raw.batchSize) || 1000)),
        preparationCurrent: workerDependencies.preparationCurrent,
      });
      if (!candidates.length) {
        backlogEnabled = false;
        return { skipped: true, reason: 'catalog_ready', candidates: [], enqueued: 0, queue: currentQueue };
      }
      const state = await queue.enqueue(candidates.map((item) => item.id), {
        operation: 'product-full-review',
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
      if (enqueued <= 0) backlogEnabled = false;
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
    prepare,
    afterPrepare,
    onIdle: () => backlogEnabled ? runAutomaticPreparation({ batchSize: 1000 }) : null,
    report: ({ task, status, result = {} }) => runtime.report({
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
    }),
  });
  const resumeTimer = setTimeout(() => queue.resume().catch((error) => console.error('allegro_preparation_queue_resume', error)), 1500);
  resumeTimer.unref?.();

  async function prepareProducts(productIds = [], {
    operation = 'product-full-review',
    requestedBy = 'agent-zdarzeniowy',
    wait = false,
  } = {}) {
    const state = await queue.enqueue(productIds, { operation, requestedBy });
    if (wait) await queue.kick();
    return state;
  }

  async function startBacklog() {
    backlogEnabled = false;
    return {
      skipped: true,
      reason: 'automatic_backlog_disabled',
      candidates: [],
      enqueued: 0,
      queue: await queue.status(),
    };
  }

  const allegroPreparationRoute = async function allegroPreparationRoute(req, url, action) {
    if (!['allegro-preparation-queue-status', 'allegro-preparation-queue-enqueue', 'allegro-preparation-queue-auto'].includes(action)) return null;
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    if (action === 'allegro-preparation-queue-status') return respond({ ok: true, queue: await queue.status() });
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    const body = await req.json().catch(() => ({}));
    if (action === 'allegro-preparation-queue-auto') {
      const automatic = await startBacklog(body);
      return respond({ ok: true, automatic }, automatic.skipped ? 200 : 202);
    }
    const productIds = [...new Set((Array.isArray(body.productIds) ? body.productIds : []).map(String).filter(Boolean))];
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
      operation: text(body.operation || 'allegro', 40),
      requestedBy: assignment ? 'codex-koordinator' : text(sessionOf(req)?.email || 'administrator', 200),
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
      queue: state,
      coordinator: assignment
        ? { id: 'codex', scenarioId: assignment.scenarioId, scenarioVersion: assignment.scenarioVersion }
        : { id: 'codex', fallback: true, reason: coordinated?.reason || 'unavailable' },
    }, 202);
  };
  allegroPreparationRoute.prepareProducts = prepareProducts;
  allegroPreparationRoute.startBacklog = startBacklog;
  allegroPreparationRoute.status = () => queue.status();
  allegroPreparationRoute.resolveProduct = (productId, details = {}) => queue.resolveProduct(productId, details);
  return allegroPreparationRoute;
}
