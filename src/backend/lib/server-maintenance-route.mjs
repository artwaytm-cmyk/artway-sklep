import { buildServerCleanupPlan, collectServerStatus, executeServerCleanup } from './server-maintenance.mjs';

function publicPlan(plan) {
  const { internalCandidates, ...safe } = plan;
  return safe;
}

export function createServerMaintenanceRoute({ respond, isAdmin, sessionOf = () => null } = {}) {
  let cachedStatus = null, cachedAt = 0, running = null;
  return async function serverMaintenanceRoute(req, url, action) {
    if (!['server-status', 'server-cleanup-preview', 'server-cleanup-run'].includes(action)) return null;
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);

    if (action === 'server-status') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (url.searchParams.has('refresh') || !cachedStatus || Date.now() - cachedAt > 30_000) {
        cachedStatus = await collectServerStatus();
        cachedAt = Date.now();
      }
      return respond({ ok: true, status: cachedStatus });
    }

    if (action === 'server-cleanup-preview') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const plan = await buildServerCleanupPlan();
      return respond({ ok: true, plan: publicPlan(plan) });
    }

    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    const body = await req.json().catch(() => ({}));
    if (body.confirm !== 'safe-server-cleanup') {
      return respond({ ok: false, error: 'Najpierw wykonaj podgląd bezpiecznego czyszczenia.', code: 'confirmation_required' }, 400);
    }
    if (running) return respond({ ok: false, error: 'Czyszczenie już trwa.', code: 'maintenance_busy' }, 409);
    const actor = String(sessionOf(req)?.email || 'administrator').slice(0, 180);
    running = executeServerCleanup().then((result) => ({ ...result, actor })).finally(() => { running = null; });
    const result = await running;
    cachedStatus = null;
    return respond({ ok: result.ok, result }, result.ok ? 200 : 500);
  };
}
