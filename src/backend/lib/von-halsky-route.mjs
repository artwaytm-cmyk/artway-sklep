import {
  deduplicateVonHalskyOffers,
  normalizeVonHalskySettings,
  summarizeVonHalskyCatalog,
  vonHalskyDefaultSettings,
  vonHalskyOfferProjection,
  vonHalskyPublicConfig,
} from './domain/von-halsky-catalog.mjs';
import { createVonHalskyApiClient } from './domain/von-halsky-api-client.mjs';

const STORE_KEY = 'inpost_von_halsky_channel';

function initialState() {
  return {
    settings: vonHalskyDefaultSettings(),
    sync: {
      status: 'not_connected',
      lastConnectionAt: null,
      lastCatalogAt: null,
      lastCatalogCount: 0,
      lastOrdersAt: null,
      lastError: '',
      lastRequestId: '',
    },
    diagnostics: [],
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
    diagnostics: Array.isArray(value?.diagnostics) ? value.diagnostics.slice(0, 30) : [],
  };
}

function safeError(error) {
  return {
    message: String(error?.message || error || 'Nieznany błąd').slice(0, 800),
    code: String(error?.code || 'von_halsky_error').slice(0, 120),
    status: Math.max(400, Math.min(599, Number(error?.status) || 502)),
    details: error?.details && typeof error.details === 'object' ? error.details : undefined,
  };
}

export function createVonHalskyRoute({
  respond,
  isAdmin,
  readVersioned,
  writeIfVersion,
  env = () => process.env,
  fetchImpl = globalThis.fetch,
  loadCatalog = async () => [],
} = {}) {
  const api = createVonHalskyApiClient({ env: new Proxy({}, { get: (_target, key) => env()?.[key] }), fetchImpl });

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

  async function recordDiagnostic({ operation, status, message = '', requestId = '' }) {
    return mutate((current) => {
      current.diagnostics = [{
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        at: new Date().toISOString(),
        operation: String(operation || '').slice(0, 80),
        status: String(status || '').slice(0, 40),
        message: String(message || '').slice(0, 500),
        requestId: String(requestId || '').slice(0, 240),
      }, ...(current.diagnostics || [])].slice(0, 30);
      return current;
    });
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
        diagnostics: state.diagnostics,
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
      const config = vonHalskyPublicConfig(env());
      if (!config.configured) return respond({
        ok: false,
        connected: false,
        mode: 'api',
        config,
        missingEnv: config.missingEnv,
        error: 'Brakuje danych lub dokładnych ścieżek z prywatnego kontraktu API wydanego w Portalu Merchanta InPost Von Halsky.',
        code: 'von_halsky_not_configured',
      }, 503);
      try {
        const result = await api.checkConnection();
        const state = await mutate((current) => {
          current.sync = { ...current.sync, status: 'connected', lastConnectionAt: result.checkedAt, lastError: '', lastRequestId: result.requestId || '' };
          current.settings.onboarding = { ...current.settings.onboarding, technicalDocs: true, catalogConnection: true };
          return current;
        });
        await recordDiagnostic({ operation: 'connection-check', status: 'ok', message: 'Autoryzacja i endpoint kontrolny odpowiedziały poprawnie.', requestId: result.requestId });
        return respond({ ok: true, connected: true, mode: 'api', config, result, sync: state.sync });
      } catch (error) {
        const safe = safeError(error);
        await mutate((current) => {
          current.sync = { ...current.sync, status: 'error', lastError: safe.message, lastRequestId: String(safe.details?.requestId || '') };
          current.diagnostics = [{ id: `${Date.now()}-connection`, at: new Date().toISOString(), operation: 'connection-check', status: 'error', message: safe.message, requestId: '' }, ...(current.diagnostics || [])].slice(0, 30);
          return current;
        });
        return respond({ ok: false, connected: false, mode: 'api', config, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    if (action === 'von-halsky-catalog-preview') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const state = cleanState((await readVersioned(STORE_KEY, initialState())).value);
      const products = await loadCatalog();
      const list = Array.isArray(products) ? products : [...(products?.values?.() || [])];
      const projections = list.map((product) => vonHalskyOfferProjection(product, state.settings));
      const deduplicated = deduplicateVonHalskyOffers(projections);
      return respond({
        ok: true,
        summary: summarizeVonHalskyCatalog(list),
        eligible: deduplicated.items.filter((item) => item.readiness.ready && item.available).length,
        blocked: deduplicated.items.filter((item) => !item.readiness.ready || !item.available).length,
        duplicates: deduplicated.conflicts.length,
        sample: projections.slice(0, 5).map((item) => ({
          externalId: item.externalId,
          gtin: item.gtin,
          name: item.name,
          ready: item.readiness.ready,
          issues: item.readiness.issues,
        })),
      });
    }

    if (action === 'von-halsky-sync-catalog') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const state = cleanState((await readVersioned(STORE_KEY, initialState())).value);
      const config = vonHalskyPublicConfig(env());
      if (body.publish === true && !config.configured) {
        if (body.scheduled === true) return respond({ ok: true, skipped: true, reason: 'not-configured', config });
        return respond({ ok: false, error: 'Najpierw uzupełnij prywatny kontrakt API Von Halsky na serwerze.', code: 'von_halsky_not_configured', config }, 503);
      }
      if (body.publish === true && body.scheduled === true) {
        const previous = Date.parse(String(state.sync.lastCatalogAt || ''));
        const intervalMs = Math.max(15, Number(state.settings.syncIntervalMinutes) || 15) * 60_000;
        if (Number.isFinite(previous) && Date.now() - previous < intervalMs) {
          return respond({ ok: true, skipped: true, reason: 'not-due', nextAt: new Date(previous + intervalMs).toISOString(), sync: state.sync });
        }
      }
      const products = await loadCatalog();
      const list = Array.isArray(products) ? products : [...(products?.values?.() || [])];
      const projections = list.map((product) => vonHalskyOfferProjection(product, state.settings));
      const deduplicated = deduplicateVonHalskyOffers(projections);
      const eligible = deduplicated.items.filter((item) => item.readiness.ready && item.available);
      if (body.publish !== true) return respond({ ok: true, dryRun: true, eligible: eligible.length, blocked: deduplicated.items.length - eligible.length, duplicates: deduplicated.conflicts.length });
      const batchSize = Math.max(1, Math.min(100, Number(body.batchSize) || 50));
      let sent = 0;
      let lastRequestId = '';
      try {
        for (let offset = 0; offset < eligible.length; offset += batchSize) {
          const items = eligible.slice(offset, offset + batchSize).map(({ readiness, ...item }) => {
            if (body.scheduled === true && state.settings.automaticPriceSync === false) {
              delete item.price;
              delete item.currency;
            }
            if (body.scheduled === true && state.settings.automaticStockSync === false) {
              delete item.available;
              delete item.stock;
            }
            return item;
          });
          const result = await api.pushCatalog({ contractVersion: config.contractVersion, items });
          lastRequestId = result.requestId || lastRequestId;
          sent += items.length;
        }
        const at = new Date().toISOString();
        const updated = await mutate((current) => {
          current.sync = { ...current.sync, status: 'connected', lastCatalogAt: at, lastCatalogCount: sent, lastError: '', lastRequestId };
          return current;
        });
        await recordDiagnostic({ operation: 'catalog-sync', status: 'ok', message: `Przekazano ${sent} ofert spełniających kontrolę.`, requestId: lastRequestId });
        return respond({ ok: true, sent, blocked: deduplicated.items.length - eligible.length, duplicates: deduplicated.conflicts.length, sync: updated.sync });
      } catch (error) {
        const safe = safeError(error);
        await mutate((current) => {
          current.sync = { ...current.sync, status: 'error', lastError: safe.message };
          current.diagnostics = [{ id: `${Date.now()}-catalog`, at: new Date().toISOString(), operation: 'catalog-sync', status: 'error', message: safe.message, requestId: '' }, ...(current.diagnostics || [])].slice(0, 30);
          return current;
        });
        return respond({ ok: false, sent, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    return respond({ ok: false, error: `Nieznana akcja Von Halsky: ${action}` }, 404);
  };
}
