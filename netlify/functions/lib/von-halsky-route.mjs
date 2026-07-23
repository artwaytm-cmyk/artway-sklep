import {
  normalizeVonHalskySettings,
  vonHalskyDefaultSettings,
  vonHalskyPublicConfig,
} from './domain/von-halsky-catalog.mjs';

const STORE_KEY = 'inpost_von_halsky_channel';

function initialState() {
  return {
    settings: vonHalskyDefaultSettings(),
    sync: { status: 'not_connected', lastCatalogAt: null, lastOrdersAt: null, lastError: '' },
    updatedAt: null,
  };
}

function cleanState(value = {}) {
  const initial = initialState();
  return {
    ...initial,
    ...(value && typeof value === 'object' ? value : {}),
    settings: normalizeVonHalskySettings(value?.settings || {}, { ...initial.settings, ...(value?.settings || {}) }),
    sync: { ...initial.sync, ...(value?.sync || {}) },
  };
}

export function createVonHalskyRoute({
  respond,
  isAdmin,
  readVersioned,
  writeIfVersion,
  env = () => process.env,
} = {}) {
  async function mutate(mutator) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const version = await readVersioned(STORE_KEY, initialState());
      const current = cleanState(version.value);
      const next = await mutator(structuredClone(current));
      if (!next) return current;
      next.updatedAt = new Date().toISOString();
      const result = await writeIfVersion(STORE_KEY, next, version);
      if (result?.modified) return next;
    }
    const error = new Error('Konfiguracja Von Halsky zmieniła się w trakcie zapisu. Ponów próbę.');
    error.code = 'von_halsky_write_conflict';
    error.status = 409;
    throw error;
  }

  return async function vonHalskyRoute(req, url, action) {
    if (!String(action || '').startsWith('von-halsky-')) return null;
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);

    if (action === 'von-halsky-overview') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const state = cleanState((await readVersioned(STORE_KEY, initialState())).value);
      return respond({
        ok: true,
        config: vonHalskyPublicConfig(env()),
        settings: state.settings,
        sync: state.sync,
        updatedAt: state.updatedAt,
        channel: 'InPost Von Halsky',
      });
    }

    if (action === 'von-halsky-settings') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const state = await mutate((current) => {
        current.settings = normalizeVonHalskySettings(body, current.settings);
        return current;
      });
      return respond({ ok: true, settings: state.settings, config: vonHalskyPublicConfig(env()), updatedAt: state.updatedAt });
    }

    if (action === 'von-halsky-connection-check') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const state = cleanState((await readVersioned(STORE_KEY, initialState())).value);
      if (state.settings.integrationMethod === 'integrator') {
        const ready = Boolean(state.settings.integrator && state.settings.onboarding.catalogConnection);
        return respond({
          ok: ready,
          connected: ready,
          mode: 'integrator',
          integrator: state.settings.integrator,
          error: ready ? '' : 'Wybierz integratora i potwierdź zakończenie autoryzacji w Portalu Merchanta.',
        }, ready ? 200 : 422);
      }
      const config = vonHalskyPublicConfig(env());
      if (!config.configured) return respond({
        ok: false,
        connected: false,
        mode: 'api',
        config,
        missingEnv: config.missingEnv,
        error: 'Brakuje prywatnej dokumentacji lub danych API wydanych w Portalu Merchanta InPost Von Halsky.',
        code: 'von_halsky_not_configured',
      }, 503);
      return respond({
        ok: true,
        connected: false,
        credentialsReady: true,
        mode: 'api',
        config,
        message: 'Dane serwerowe są kompletne. Właściwy test endpointu zostanie uruchomiony po wskazaniu ścieżki z prywatnej dokumentacji technicznej InPost.',
      });
    }

    return respond({ ok: false, error: `Nieznana akcja Von Halsky: ${action}` }, 404);
  };
}
