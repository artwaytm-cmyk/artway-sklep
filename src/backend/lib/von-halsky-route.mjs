import {
  deduplicateVonHalskyOffers,
  normalizeVonHalskySettings,
  summarizeVonHalskyCatalog,
  vonHalskyDefaultSettings,
  vonHalskyOfferProjection,
  vonHalskyPublicConfig,
} from './domain/von-halsky-catalog.mjs';
import { createVonHalskyApiClient } from './domain/von-halsky-api-client.mjs';
import { buildEditorialPublicationPatch } from './domain/agent-product-editorial-state.mjs';

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
  saveProductFields = null,
  reportProgress = async () => {},
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

  async function progress(work = {}) {
    try { await reportProgress(work); } catch { /* telemetria nie może blokować API kanału */ }
  }

  async function updateProductPublication(products = [], status = 'confirmed', details = {}) {
    const rows = (Array.isArray(products) ? products : []).filter((product) => product?.id !== undefined && product?.id !== null);
    if (!rows.length) return;
    if (typeof saveProductFields === 'function') {
      const timestamp = details.timestamp || new Date().toISOString();
      for (const product of rows) {
        const id = String(product.id);
        const fields = buildEditorialPublicationPatch({
          product,
          channel: 'vonHalsky',
          status,
          timestamp,
          targetRef: details.targetRef || product.externalId || product.sku || id,
          receiptId: details.receiptId || '',
          error: details.error || '',
          nextRetryAt: details.nextRetryAt || '',
        });
        await saveProductFields({
          productId: id,
          fields,
          mutationId: `von-halsky-publication:${id}:${details.receiptId || timestamp}`,
          actor: 'von-halsky-api',
          area: 'von-halsky-publication',
        });
      }
      return;
    }
    throw Object.assign(
      new Error('Centralna kartoteka produktów nie jest dostępna; potwierdzenie Von Halsky nie może zostać zapisane zastępczo.'),
      { code: 'central_product_catalog_unavailable', status: 503 },
    );
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
      const requestedProductIds = new Set((Array.isArray(body.productIds) ? body.productIds : []).map((id) => String(id || '')).filter(Boolean));
      const selectedList = requestedProductIds.size ? list.filter((product) => requestedProductIds.has(String(product?.id))) : list;
      const projections = selectedList.map((product) => vonHalskyOfferProjection(product, state.settings));
      const productByExternalId = new Map(selectedList.map((product) => [vonHalskyOfferProjection(product, state.settings).externalId, product]));
      const deduplicated = deduplicateVonHalskyOffers(projections);
      const eligible = deduplicated.items.filter((item) => item.readiness.ready && item.available);
      if (body.publish !== true) return respond({ ok: true, dryRun: true, eligible: eligible.length, blocked: deduplicated.items.length - eligible.length, duplicates: deduplicated.conflicts.length });
      const batchSize = Math.max(1, Math.min(100, Number(body.batchSize) || 50));
      let sent = 0;
      let lastRequestId = '';
      let activeBatchProducts = [];
      try {
        for (let offset = 0; offset < eligible.length; offset += batchSize) {
          const batch = eligible.slice(offset, offset + batchSize);
          activeBatchProducts = batch.map((item) => productByExternalId.get(item.externalId)).filter(Boolean);
          const tracked = activeBatchProducts.filter((product) => product.vonHalskyEditorialSyncPending === true || requestedProductIds.has(String(product.id)));
          await Promise.all(tracked.map((product) => progress({
            id: `editorial:${product.id}:vonHalsky:${String(product.vonHalskyEditorialSyncRunId || product.vonHalskyEditorialSyncPendingAt || Date.now()).slice(0, 64)}`,
            runId: product.vonHalskyEditorialSyncRunId, productId: String(product.id), productName: String(product.nazwa || product.name || '').slice(0, 180),
            channel: 'vonHalsky', action: 'publikacja treści w kanale', phase: 'sending_to_von_halsky', status: 'running',
            target: 'katalog InPost Von Halsky', targetRef: product.externalId || product.sku || String(product.id),
            message: 'Wysyłam zapisaną kartę produktu do API Von Halsky i czekam na potwierdzenie partii.',
          })));
          const items = batch.map(({ readiness, ...item }) => {
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
          const at = new Date().toISOString();
          await updateProductPublication(tracked, 'confirmed', { timestamp: at, receiptId: result.requestId || lastRequestId });
          await Promise.all(tracked.map((product) => progress({
            id: `editorial:${product.id}:vonHalsky:${String(product.vonHalskyEditorialSyncRunId || product.vonHalskyEditorialSyncPendingAt || Date.now()).slice(0, 64)}`,
            runId: product.vonHalskyEditorialSyncRunId, productId: String(product.id), productName: String(product.nazwa || product.name || '').slice(0, 180),
            channel: 'vonHalsky', action: 'publikacja treści w kanale', phase: 'confirmed_by_von_halsky', status: 'confirmed',
            target: 'katalog InPost Von Halsky', targetRef: product.externalId || product.sku || String(product.id),
            receiptId: result.requestId || lastRequestId, completedAt: at,
            message: 'API Von Halsky potwierdziło przyjęcie karty produktu.',
          })));
          activeBatchProducts = [];
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
        const retryProducts = activeBatchProducts.filter((product) => product.vonHalskyEditorialSyncPending === true || requestedProductIds.has(String(product.id)));
        const failedAt = new Date().toISOString(), nextRetryAt = new Date(Date.now() + 15 * 60_000).toISOString();
        await updateProductPublication(retryProducts, 'retry', { timestamp: failedAt, error: safe.message, nextRetryAt }).catch(() => {});
        await Promise.all(retryProducts.map((product) => progress({
          id: `editorial:${product.id}:vonHalsky:${String(product.vonHalskyEditorialSyncRunId || product.vonHalskyEditorialSyncPendingAt || Date.now()).slice(0, 64)}`,
          runId: product.vonHalskyEditorialSyncRunId, productId: String(product.id), productName: String(product.nazwa || product.name || '').slice(0, 180),
          channel: 'vonHalsky', action: 'publikacja treści w kanale', phase: 'retry_scheduled', status: 'failed',
          target: 'katalog InPost Von Halsky', targetRef: product.externalId || product.sku || String(product.id),
          error: safe.message, nextRetryAt, message: 'Kanał nie potwierdził zmiany. Niczego nie oznaczono jako opublikowane; zaplanowano ponowienie.',
        })));
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
