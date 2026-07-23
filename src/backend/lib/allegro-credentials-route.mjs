const ACTION = 'allegro-credentials';

export function createAllegroCredentialsRoute({ manager, isAdmin, rateLimit, respond, refresh, status } = {}) {
  return async function allegroCredentialsRoute(req, url, action) {
    if (action !== ACTION) return null;
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    const limited = rateLimit(req, ACTION, 5, 15 * 60_000); if (limited) return limited;
    try {
      const saved = await manager.save(await req.json().catch(() => ({})));
      let refreshed = false, requiresOAuth = false;
      try { await refresh(req); refreshed = true; } catch (error) { requiresOAuth = ['invalid_grant', 'allegro_not_connected'].includes(error?.code); if (!requiresOAuth) throw error; }
      return respond({ ok: true, ...saved, refreshed, requiresOAuth, allegro: await status(req) });
    } catch (error) {
      return respond({ ok: false, error: String(error?.message || error), code: error?.code || 'allegro_credentials_error' }, Number(error?.status) || 500);
    }
  };
}
