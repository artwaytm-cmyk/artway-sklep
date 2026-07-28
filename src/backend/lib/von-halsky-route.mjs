import {
  deduplicateVonHalskyOffers,
  normalizeVonHalskySettings,
  summarizeVonHalskyCatalog,
  vonHalskyDefaultSettings,
  vonHalskyOfferProposal,
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
    offers: [],
    orders: [],
    categories: [],
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
    offers: Array.isArray(value?.offers) ? value.offers.slice(0, 2000) : [],
    orders: Array.isArray(value?.orders) ? value.orders.slice(0, 500) : [],
    categories: Array.isArray(value?.categories) ? value.categories.slice(0, 10_000) : [],
  };
}

function productMatchesCode(product = {}, code = '') {
  const expected = String(code || '').trim().toLowerCase();
  if (!expected) return false;
  return [product.id, product.externalId, product.sku, product.kodProducenta, product.mpn, product.ean, product.gtin]
    .some((value) => String(value ?? '').trim().toLowerCase() === expected);
}

function remoteOfferSummary(details = {}) {
  const offer = details?.offer || details || {};
  return {
    offerId: String(offer.id || offer.offerId || ''),
    externalId: String(offer.externalId || ''),
    status: String(offer.status || ''),
    updatedAt: offer.updatedAt || null,
    validationErrors: Array.isArray(details?.metadata?.validationErrors) ? details.metadata.validationErrors.slice(0, 30) : [],
    rejectionReasons: Array.isArray(details?.metadata?.rejectionReasons) ? details.metadata.rejectionReasons.slice(0, 30) : [],
  };
}

function flattenCategories(items = [], parents = []) {
  return (Array.isArray(items) ? items : []).flatMap((item) => {
    const current = {
      id: String(item?.id || ''),
      name: String(item?.name || ''),
      leaf: item?.leaf === true,
      doesNotRequireGpsrInfo: item?.doesNotRequireGpsrInfo === true,
      path: [...parents, String(item?.name || '')].filter(Boolean).join(' › '),
    };
    return [current, ...flattenCategories(item?.children, [...parents, current.name])];
  }).filter((item) => item.id);
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
        offers: state.offers,
        orders: state.orders,
        categoryCount: state.categories.length,
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

    if (action === 'von-halsky-categories') {
      if (!['GET', 'POST'].includes(req.method)) return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const current = cleanState((await readVersioned(STORE_KEY, initialState())).value);
      const refresh = req.method === 'POST' || url.searchParams.get('refresh') === '1' || !current.categories.length;
      if (!refresh) return respond({ ok: true, categories: current.categories, cached: true });
      try {
        const result = await api.fetchCategories({ depth: 4 });
        const categories = flattenCategories(result.payload).filter((item) => item.leaf);
        const state = await mutate((draft) => {
          draft.categories = categories;
          return draft;
        });
        await recordDiagnostic({ operation: 'categories-sync', status: 'ok', message: `Pobrano ${categories.length} końcowych kategorii Von Halsky.`, requestId: result.requestId });
        return respond({ ok: true, categories: state.categories, cached: false });
      } catch (error) {
        const safe = safeError(error);
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    if (action === 'von-halsky-product-category') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (typeof saveProductFields !== 'function') return respond({ ok: false, error: 'Centralna kartoteka produktów nie jest dostępna.' }, 503);
      const body = await req.json().catch(() => ({}));
      const productId = String(body.productId || '').trim(), categoryId = String(body.categoryId || '').trim();
      if (!productId || !/^[0-9a-f-]{36}$/i.test(categoryId)) return respond({ ok: false, error: 'Wybierz produkt i prawidłową kategorię Von Halsky.' }, 422);
      const state = cleanState((await readVersioned(STORE_KEY, initialState())).value);
      const category = state.categories.find((item) => item.id === categoryId);
      if (category && category.leaf !== true) return respond({ ok: false, error: 'Oferta musi być przypisana do kategorii końcowej.' }, 422);
      const fields = { vonHalskyCategoryId: categoryId };
      if (body.attributes && typeof body.attributes === 'object' && !Array.isArray(body.attributes)) fields.vonHalskyAttributes = body.attributes;
      await saveProductFields({
        productId,
        fields,
        mutationId: `von-halsky-category:${productId}:${categoryId}`,
        actor: 'von-halsky-api',
        area: 'von-halsky-category',
      });
      return respond({ ok: true, productId, categoryId, category: category || null });
    }

    if (action === 'von-halsky-sync-orders') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      try {
        const body = await req.json().catch(() => ({}));
        const current = cleanState((await readVersioned(STORE_KEY, initialState())).value);
        const previousSyncAt = Date.parse(String(current.sync.lastOrdersAt || ''));
        const overlapSince = Number.isFinite(previousSyncAt)
          ? new Date(previousSyncAt - 5 * 60_000).toISOString()
          : '';
        const result = await api.fetchOrders({
          limit: body.limit || 30,
          offset: body.offset || 0,
          updatedSince: body.updatedSince || overlapSince,
          orderStatus: body.orderStatus,
          paymentStatus: body.paymentStatus,
        });
        const incoming = Array.isArray(result.payload?.data) ? result.payload.data : [];
        const merged = new Map(current.orders.map((item) => [String(item?.id || ''), item]));
        for (const order of incoming) if (order?.id) merged.set(String(order.id), order);
        const at = new Date().toISOString();
        const state = await mutate((draft) => {
          draft.orders = [...merged.values()]
            .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0))
            .slice(0, 500);
          draft.sync = { ...draft.sync, status: 'connected', lastOrdersAt: at, lastError: '', lastRequestId: result.requestId || '' };
          return draft;
        });
        await recordDiagnostic({ operation: 'orders-sync', status: 'ok', message: `Pobrano ${incoming.length} zamówień; kolejka zawiera ${state.orders.length}.`, requestId: result.requestId });
        return respond({ ok: true, fetched: incoming.length, orders: state.orders, page: result.payload?.page || null, sync: state.sync });
      } catch (error) {
        const safe = safeError(error);
        await recordDiagnostic({ operation: 'orders-sync', status: 'error', message: safe.message });
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    if (action === 'von-halsky-offer-state') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const offerId = String(body.offerId || '').trim();
      if (!/^[0-9a-f-]{36}$/i.test(offerId) || typeof body.open !== 'boolean') return respond({ ok: false, error: 'Brak prawidłowego ID oferty lub docelowego stanu.' }, 422);
      try {
        const result = await api.setOfferOpen(offerId, body.open);
        const state = await mutate((draft) => {
          draft.offers = draft.offers.map((item) => item.offerId === offerId ? { ...item, status: body.open ? 'PENDING' : 'CLOSED', updatedAt: new Date().toISOString() } : item);
          return draft;
        });
        await recordDiagnostic({ operation: body.open ? 'offer-reopen' : 'offer-close', status: 'ok', message: `Przyjęto polecenie dla oferty ${offerId}.`, requestId: result.requestId });
        return respond({ ok: true, offerId, open: body.open, command: result.payload, offers: state.offers });
      } catch (error) {
        const safe = safeError(error);
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    if (action === 'von-halsky-order-state') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const orderId = String(body.orderId || '').trim();
      if (!orderId || typeof body.accepted !== 'boolean') return respond({ ok: false, error: 'Brak zamówienia lub decyzji.' }, 422);
      try {
        const result = await api.setOrderAccepted(orderId, body.accepted);
        const state = await mutate((draft) => {
          draft.orders = draft.orders.map((item) => String(item?.id || '') === orderId ? { ...item, status: body.accepted ? 'ACCEPTED' : 'REFUSED', updatedAt: new Date().toISOString() } : item);
          return draft;
        });
        await recordDiagnostic({ operation: body.accepted ? 'order-accept' : 'order-refuse', status: 'ok', message: `Przyjęto decyzję dla zamówienia ${orderId}.`, requestId: result.requestId });
        return respond({ ok: true, orderId, accepted: body.accepted, command: result.payload, orders: state.orders });
      } catch (error) {
        const safe = safeError(error);
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
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
        eligible: deduplicated.items.filter((item) => item.readiness.publishable && item.available).length,
        blocked: deduplicated.items.filter((item) => !item.readiness.publishable || !item.available).length,
        duplicates: deduplicated.conflicts.length,
        sample: projections.slice(0, 5).map((item) => ({
          externalId: item.externalId,
          gtin: item.gtin,
          name: item.name,
          ready: item.readiness.ready,
          publishable: item.readiness.publishable,
          issues: [...item.readiness.issues, ...item.readiness.publicationIssues],
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
      const eligible = deduplicated.items.filter((item) => item.readiness.publishable && item.available);
      const testCode = String(state.settings.testOfferCode || '1410');
      const allowNewOffer = (item) => state.settings.catalogAutomationEnabled === true
        || productMatchesCode(productByExternalId.get(item.externalId), testCode);
      if (body.publish !== true) return respond({
        ok: true,
        dryRun: true,
        eligible: eligible.length,
        allowedToCreate: eligible.filter(allowNewOffer).length,
        publicationMode: state.settings.catalogAutomationEnabled ? 'automatic' : 'test_allowlist',
        testOfferCode: testCode,
        blocked: deduplicated.items.length - eligible.length,
        duplicates: deduplicated.conflicts.length,
      });
      const batchSize = Math.max(1, Math.min(100, Number(body.batchSize) || 50));
      let sent = 0, created = 0, updatedCount = 0, closed = 0, reopened = 0, skippedNew = 0;
      let lastRequestId = '';
      let activeBatchProducts = [];
      try {
        const remoteResult = await api.listOffers();
        // Batch creation is asynchronous and a freshly accepted offer may not be
        // visible in GET /offers yet. Keep the durable receipt in the local state
        // as an idempotency barrier until the provider list catches up.
        const offersByExternalId = new Map();
        for (const source of [...state.offers, ...remoteResult.data]) {
          const item = remoteOfferSummary(source);
          if (item.offerId && item.externalId) offersByExternalId.set(item.externalId, item);
        }
        const remoteOffers = [...offersByExternalId.values()];
        const remoteByExternalId = new Map(remoteOffers.filter((item) => item.externalId).map((item) => [item.externalId, item]));
        lastRequestId = remoteResult.requestId || '';
        const existing = deduplicated.items.filter((item) => remoteByExternalId.has(item.externalId));
        const createCandidates = eligible.filter((item) => !remoteByExternalId.has(item.externalId) && allowNewOffer(item));
        skippedNew = eligible.filter((item) => !remoteByExternalId.has(item.externalId) && !allowNewOffer(item)).length;

        for (const item of existing) {
          const product = productByExternalId.get(item.externalId), remote = remoteByExternalId.get(item.externalId);
          activeBatchProducts = product ? [product] : [];
          if (!item.available) {
            if (!['CLOSED', 'SOLDOUT'].includes(remote.status)) {
              const result = await api.setOfferOpen(remote.offerId, false);
              lastRequestId = result.requestId || lastRequestId;
              remote.status = 'CLOSED';
              closed += 1;
            }
            continue;
          }
          if (['CLOSED', 'SOLDOUT'].includes(remote.status) && state.settings.automaticResume !== false) {
            const result = await api.setOfferOpen(remote.offerId, true);
            lastRequestId = result.requestId || lastRequestId;
            remote.status = 'PENDING';
            reopened += 1;
          }
          if (!item.readiness.publishable) continue;
          const contentDue = body.forceContent === true || requestedProductIds.has(String(product?.id || '')) || product?.vonHalskyEditorialSyncPending === true;
          if (contentDue) {
            const proposal = vonHalskyOfferProposal(item);
            const { externalId: _externalId, ...patch } = proposal;
            const result = await api.updateOffer(remote.offerId, patch);
            lastRequestId = result.requestId || lastRequestId;
            updatedCount += 1;
          }
        }

        if (state.settings.automaticPriceSync !== false) {
          const prices = existing.filter((item) => item.available && item.readiness.publishable).map((item) => ({
            offerId: remoteByExternalId.get(item.externalId).offerId,
            price: { amount: Number(Number(item.price).toFixed(2)), currency: item.currency || 'PLN' },
          }));
          for (let offset = 0; offset < prices.length; offset += batchSize) {
            const result = await api.updatePrices(prices.slice(offset, offset + batchSize));
            lastRequestId = result.requestId || lastRequestId;
            updatedCount += prices.slice(offset, offset + batchSize).length;
          }
        }
        if (state.settings.automaticStockSync !== false) {
          const stocks = existing.map((item) => ({
            offerId: remoteByExternalId.get(item.externalId).offerId,
            stock: { quantity: item.available ? item.stock : 0, unit: 'UNIT' },
          }));
          for (let offset = 0; offset < stocks.length; offset += batchSize) {
            const result = await api.updateStocks(stocks.slice(offset, offset + batchSize));
            lastRequestId = result.requestId || lastRequestId;
            updatedCount += stocks.slice(offset, offset + batchSize).length;
          }
        }

        for (let offset = 0; offset < createCandidates.length; offset += batchSize) {
          const batch = createCandidates.slice(offset, offset + batchSize);
          activeBatchProducts = batch.map((item) => productByExternalId.get(item.externalId)).filter(Boolean);
          await Promise.all(activeBatchProducts.map((product) => progress({
            id: `editorial:${product.id}:vonHalsky:${String(product.vonHalskyEditorialSyncRunId || product.vonHalskyEditorialSyncPendingAt || Date.now()).slice(0, 64)}`,
            runId: product.vonHalskyEditorialSyncRunId, productId: String(product.id), productName: String(product.nazwa || product.name || '').slice(0, 180),
            channel: 'vonHalsky', action: 'publikacja treści w kanale', phase: 'sending_to_von_halsky', status: 'running',
            target: 'katalog InPost Von Halsky', targetRef: product.externalId || product.sku || String(product.id),
            message: 'Wysyłam dozwoloną kartę produktu do API Von Halsky i czekam na identyfikator polecenia.',
          })));
          const proposals = batch.map((item) => vonHalskyOfferProposal(item));
          const result = await api.createOffers(proposals);
          lastRequestId = result.requestId || lastRequestId;
          const receipts = Array.isArray(result.payload) ? result.payload : [];
          sent += proposals.length;
          created += proposals.length;
          const at = new Date().toISOString();
          for (const product of activeBatchProducts) {
            const externalId = vonHalskyOfferProjection(product, state.settings).externalId;
            const receipt = receipts.find((item) => String(item?.externalId || '') === externalId) || receipts[activeBatchProducts.indexOf(product)] || {};
            if (receipt.offerId && typeof saveProductFields === 'function') {
              await saveProductFields({
                productId: String(product.id),
                fields: { vonHalskyOfferId: String(receipt.offerId), vonHalskyCommandId: String(receipt.commandId || '') },
                mutationId: `von-halsky-offer-link:${product.id}:${receipt.offerId}`,
                actor: 'von-halsky-api',
                area: 'von-halsky-offer-link',
              });
              remoteOffers.push({ offerId: String(receipt.offerId), externalId, status: 'PENDING', updatedAt: at, validationErrors: [], rejectionReasons: [] });
            }
          }
          await updateProductPublication(activeBatchProducts, 'confirmed', { timestamp: at, receiptId: result.requestId || lastRequestId });
          await Promise.all(activeBatchProducts.map((product) => progress({
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
          current.offers = remoteOffers;
          current.sync = { ...current.sync, status: 'connected', lastCatalogAt: at, lastCatalogCount: created + updatedCount + closed + reopened, lastError: '', lastRequestId };
          return current;
        });
        const message = `Nowe ${created}, aktualizacje ${updatedCount}, zamknięte ${closed}, wznowione ${reopened}; pominięte nowe ${skippedNew}.`;
        await recordDiagnostic({ operation: 'catalog-sync', status: 'ok', message, requestId: lastRequestId });
        return respond({
          ok: true, sent, created, updated: updatedCount, closed, reopened, skippedNew,
          publicationMode: state.settings.catalogAutomationEnabled ? 'automatic' : 'test_allowlist',
          testOfferCode: testCode,
          blocked: deduplicated.items.length - eligible.length,
          duplicates: deduplicated.conflicts.length,
          offers: updated.offers,
          sync: updated.sync,
        });
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
        return respond({ ok: false, sent, created, updated: updatedCount, closed, reopened, skippedNew, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    return respond({ ok: false, error: `Nieznana akcja Von Halsky: ${action}` }, 404);
  };
}
