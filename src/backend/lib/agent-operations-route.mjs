import crypto from 'node:crypto';

const ACTIONS = new Set(['agent-operations-summary', 'agent-action-runs', 'agent-run-safe-checks']);

export function createAgentOperationsRoute({ respond, isAdmin, text, read, write, getOperationalCenter, publicOrigin }) {
  return async function agentOperationsRoute(req, url, action) {
    if (!ACTIONS.has(action)) return null;
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);

    if (action === 'agent-operations-summary') return respond(await getOperationalCenter());

    if (action === 'agent-action-runs') {
      const history = await read('agent_action_runs', { items: [], updated_at: null });
      const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 30) || 30));
      return respond({ ok: true, items: (Array.isArray(history.items) ? history.items : []).slice(0, limit), updated_at: history.updated_at || null });
    }

    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    const body = await req.json().catch(() => ({})), requested = Array.isArray(body.areas) ? body.areas.map((x) => text(x, 80)) : [];
    const allowed = new Map([
      ['site-health', { action: '', label: 'Funkcjonalność strony i integracje', local: true }],
      ['allegro-orders', { action: 'allegro-sync-orders', label: 'Zamówienia Allegro' }],
      ['inpost', { action: 'inpost-sync-all', label: 'Statusy i numery InPost' }],
      ['infakt', { action: 'infakt-sync', label: 'Zadania inFakt i ceny zakupu' }],
    ]), selected = (requested.length ? requested : [...allowed.keys()]).filter((x) => allowed.has(x));
    const adminToken = String(process.env.ARTWAY_ADMIN_TOKEN || '').trim(), origin = publicOrigin(req), startedAt = new Date().toISOString();
    const results = await Promise.all(selected.map(async (area) => {
      const definition = allowed.get(area), started = Date.now();
      try {
        if (definition.local) {
          const center = await getOperationalCenter(), integrations = center.integrations || {}, missing = Object.entries(integrations).filter(([, ready]) => !ready).map(([name]) => name);
          return { area, label: definition.label, status: missing.length ? 'error' : 'completed', detail: missing.length ? `Wymagają konfiguracji: ${missing.join(', ')}` : `Integracje: ${Object.keys(integrations).join(', ')} • baza i API odpowiadają`, error: missing.length ? `Wymagają konfiguracji: ${missing.join(', ')}` : '', durationMs: Date.now() - started };
        }
        const response = await fetch(`${origin}/api/store?action=${encodeURIComponent(definition.action)}`, { method: 'POST', headers: { 'x-admin-token': adminToken, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ source: 'agent-safe-plan' }) });
        const responseText = await response.text(); let data = {}; try { data = responseText ? JSON.parse(responseText) : {}; } catch { data = {}; }
        if (!response.ok || data?.ok === false) throw new Error(text(data?.error || data?.message || `HTTP ${response.status}`, 500));
        const count = area === 'allegro-orders'
          ? (Number(data?.imported_new || 0) + Number(data?.refreshed || 0))
          : area === 'inpost'
            ? Number(data?.sprawdzone ?? data?.zmienione ?? 0) || 0
            : Number(data?.results?.length ?? data?.purchaseSync?.processedDocuments ?? data?.processed ?? 0) || 0;
        return { area, label: definition.label, status: 'completed', count, scanned: area === 'allegro-orders' ? Number(data?.fetched || 0) : count, newItems: area === 'allegro-orders' ? Number(data?.imported_new || 0) : 0, refreshed: area === 'allegro-orders' ? Number(data?.refreshed || 0) : 0, durationMs: Date.now() - started };
      } catch (error) {
        return { area, label: definition.label, status: 'error', error: text(error?.message || error, 500), durationMs: Date.now() - started };
      }
    }));
    const center = await getOperationalCenter(); results.forEach((result) => { if (result.area === 'allegro-orders') result.active = Number(center.summary?.activeAllegro || 0); });
    const run = { id: crypto.randomUUID(), source: text(body.source || 'admin-panel', 80), profile: text(body.profile || 'custom', 40), startedAt, completedAt: new Date().toISOString(), durationMs: Math.max(0, Date.now() - Date.parse(startedAt)), results, completed: results.filter((x) => x.status === 'completed').length, errors: results.filter((x) => x.status === 'error').length, scoreAfter: center.score };
    const history = await read('agent_action_runs', { items: [] }); history.items = [run, ...(Array.isArray(history.items) ? history.items : [])].slice(0, 100); history.updated_at = run.completedAt; await write('agent_action_runs', history);
    return respond({ ok: true, allCompleted: results.every((x) => x.status === 'completed'), run, center });
  };
}
