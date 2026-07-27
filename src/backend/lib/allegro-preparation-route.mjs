import { createAllegroPreparationQueue, selectAllegroPreparationCandidates } from './domain/allegro-preparation-queue.mjs';
import { createAllegroPreparationWorker } from './domain/allegro-preparation-worker.mjs';

export function createAllegroPreparationRoute(deps = {}) {
  const {
    respond, isAdmin, sessionOf, text, readVersioned, writeIfVersion, runtime,
    pool = null, namespace = 'artway-sklep',
    worker: workerDependencies,
  } = deps;
  const prepare = createAllegroPreparationWorker({
    ...workerDependencies,
    reportProgress: (work) => runtime.report({
      event: 'work_progress',
      source: 'allegro-preparation-worker',
      work,
    }),
  });
  const queue = createAllegroPreparationQueue({
    readVersioned,
    writeIfVersion,
    pool,
    namespace,
    prepare,
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
        status: status === 'failed' ? 'failed' : status === 'attention' ? 'attention' : status === 'completed' ? 'confirmed' : status,
        fields: result.savedFields || [],
        error: result.error || '',
        message: status === 'running'
          ? 'Agent serwerowy przygotowuje i zapisuje jeden produkt.'
          : status === 'completed'
            ? `Produkt został zapisany i potwierdzony odczytem z centralnej kartoteki.${(result.savedFields || []).length ? ` Zmieniono: ${(result.savedFields || []).join(', ')}.` : ''}`
            : status === 'attention'
              ? `Produkt zapisano, ale wymaga uzupełnienia: ${(result.missing || []).join(', ')}`
              : 'Przygotowanie produktu nie zostało potwierdzone.',
      },
    }),
  });
  const resumeTimer = setTimeout(() => queue.resume().catch((error) => console.error('allegro_preparation_queue_resume', error)), 1500);
  resumeTimer.unref?.();

  let automaticPromise = null;
  async function runAutomaticPreparation(raw = {}) {
    if (automaticPromise) return { skipped: true, reason: 'already_running', candidates: [] };
    automaticPromise = (async () => {
      if (typeof workerDependencies?.loadProducts !== 'function') {
        return { skipped: true, reason: 'catalog_unavailable', candidates: [] };
      }
      const currentQueue = await queue.status();
      if (Number(currentQueue.pending || 0) >= 100) {
        return { skipped: true, reason: 'queue_busy', candidates: [], queue: currentQueue };
      }
      const products = await workerDependencies.loadProducts();
      const candidates = selectAllegroPreparationCandidates(products, {
        now: new Date(),
        limit: Math.max(1, Math.min(250, Number(raw.batchSize) || 50)),
        preparationCurrent: workerDependencies.preparationCurrent,
      });
      if (!candidates.length) return { skipped: true, reason: 'catalog_ready', candidates: [], queue: currentQueue };
      const state = await queue.enqueue(candidates.map((item) => item.id), {
        operation: 'allegro-auto-remediation',
        requestedBy: 'agent-serwerowy',
      });
      return { skipped: false, candidates, queue: state };
    })();
    try {
      return await automaticPromise;
    } finally {
      automaticPromise = null;
    }
  }

  // Backend sam zasila kolejkę. Przeglądarka służy wyłącznie do obserwacji
  // i ręcznego nadawania priorytetu, więc zamknięcie panelu nie zatrzymuje pracy.
  const automaticTimer = setInterval(() => {
    runAutomaticPreparation({ batchSize: 50 }).catch((error) => console.error('allegro_preparation_auto', error));
  }, 15 * 60_000);
  automaticTimer.unref?.();
  const automaticStartupTimer = setTimeout(() => {
    runAutomaticPreparation({ batchSize: 50 }).catch((error) => console.error('allegro_preparation_auto_startup', error));
  }, 5000);
  automaticStartupTimer.unref?.();

  return async function allegroPreparationRoute(req, url, action) {
    if (!['allegro-preparation-queue-status', 'allegro-preparation-queue-enqueue', 'allegro-preparation-queue-auto'].includes(action)) return null;
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    if (action === 'allegro-preparation-queue-status') return respond({ ok: true, queue: await queue.status() });
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    const body = await req.json().catch(() => ({}));
    if (action === 'allegro-preparation-queue-auto') {
      const automatic = await runAutomaticPreparation(body);
      return respond({ ok: true, automatic }, automatic.skipped ? 200 : 202);
    }
    const state = await queue.enqueue(Array.isArray(body.productIds) ? body.productIds : [], {
      operation: text(body.operation || 'allegro', 40),
      requestedBy: text(sessionOf(req)?.email || 'administrator', 200),
    });
    return respond({ ok: true, queued: true, queue: state }, 202);
  };
}
