const ACTIONS = new Set([
  'codex-agent-claim',
  'codex-agent-complete',
  'codex-agent-fail',
  'codex-agent-heartbeat',
  'codex-agent-panel-enqueue',
  'codex-agent-result',
  'agent-runtime-status',
  'agent-runtime-report',
  'agent-product-report',
]);

export function createAgentRuntimeRoute({
  queue,
  events = null,
  runtime,
  integrationStatus = null,
  productReport = null,
  isAdmin,
  respond,
  sessionOf,
  text,
}) {
  return async function agentRuntimeRoute(req, url, action) {
    if (!ACTIONS.has(action)) return null;
    if (!isAdmin(req, url)) {
      return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    }
    if (action === 'agent-runtime-status') {
      const [queueStatus, eventStatus, integrations] = await Promise.all([
        queue && typeof queue.status === 'function'
          ? queue.status()
          : { workerOnline: false, workerLastSeenAt: '', counts: {}, active: 0 },
        events && typeof events.status === 'function'
          ? events.status()
          : Promise.resolve({ mode: 'event_driven', scheduledCycles: false, active: 0, queued: 0, running: 0, recent: [] }),
        typeof integrationStatus === 'function'
          ? Promise.resolve().then(() => integrationStatus(req)).catch(() => ({}))
          : Promise.resolve({}),
      ]);
      return respond({
        ok: true,
        runtime: {
          ...(await runtime.status(queueStatus, eventStatus, integrations)),
          eventQueue: eventStatus,
          automationMode: 'event_driven',
        },
      });
    }
    if (action === 'agent-product-report') {
      const report = productReport && typeof productReport.query === 'function'
        ? await productReport.query(Object.fromEntries(url.searchParams.entries()))
        : { available: false, summary: {}, items: [], total: 0, revision: '' };
      return respond({ ok: true, report });
    }
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    const body = await req.json().catch(() => ({}));
    if (action === 'agent-runtime-report') {
      const updated = await runtime.report(body);
      return respond({ ok: true, updatedAt: updated.updatedAt });
    }
    if (action === 'codex-agent-claim') {
      return respond({
        ok: true,
        ...(await queue.claim(text(body.workerId || '', 160), {
          waitMs: Math.max(0, Math.min(55_000, Number(body.waitMs) || 0)),
        })),
      });
    }
    if (action === 'codex-agent-panel-enqueue') {
      const session = sessionOf(req);
      const queued = await queue.enqueue({
        requestId: body.requestId,
        text: body.text,
        context: body.context,
        channel: 'panel',
        user: session?.email || 'administrator',
      });
      return respond({
        ok: true,
        deferred: ['queued', 'processing', 'delivering'].includes(queued.status),
        status: queued.status,
        workerOnline: queued.workerOnline === true,
        jobId: queued.job?.id || null,
        duplicate: queued.duplicate === true,
      });
    }
    if (action === 'codex-agent-heartbeat') {
      return respond({ ok: true, ...(await queue.heartbeat(body)) });
    }
    if (action === 'codex-agent-result') {
      return respond({ ok: true, ...(await queue.result(body.id)) });
    }
    if (action === 'codex-agent-complete') {
      const prepared = await queue.prepareDelivery(body);
      if (prepared.alreadyDelivered) return respond({ ok: true, delivered: true, duplicate: true });
      if (prepared.alreadyDelivering) return respond({ ok: true, delivered: false, pending: true });
      const completed = await queue.markDelivered({ id: body.id, claimToken: body.claimToken });
      return respond({ ok: true, ...completed, panel: true });
    }
    if (action === 'codex-agent-fail') {
      return respond({ ok: true, ...(await queue.fail(body)) });
    }
    return null;
  };
}
