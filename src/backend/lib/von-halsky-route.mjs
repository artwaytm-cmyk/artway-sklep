import { createVonHalskyAgentRoute } from './domain/von-halsky-agent-route.mjs';
import { createVonHalskyOperationsRoute } from './domain/von-halsky-operations-route.mjs';
import { createVonHalskyCatalogRoute } from './domain/von-halsky-catalog-route.mjs';
import {
  deduplicateVonHalskyOffers,
  normalizeVonHalskySettings,
  summarizeVonHalskyCatalog,
  vonHalskyDefaultSettings,
  vonHalskyOfferProposal,
  vonHalskyOfferProjection,
  vonHalskyProductReadiness,
  vonHalskyPublicConfig,
} from './domain/von-halsky-catalog.mjs';
import { createVonHalskyApiClient } from './domain/von-halsky-api-client.mjs';
import { buildEditorialPublicationPatch } from './domain/agent-product-editorial-state.mjs';
import {
  compileVonHalskyCategoryIndex,
  matchVonHalskyAttributes,
  suggestVonHalskyCategory,
  vonHalskyAgentPreparationPatch,
} from './domain/von-halsky-agent-preparation.mjs';
import { resolveVonHalskyResponsibleProducer } from './domain/von-halsky-responsible-producer.mjs';
import { vonHalskyCatalogTruthSummary } from './domain/von-halsky-catalog-reconciliation.mjs';

const STORE_KEY = 'inpost_von_halsky_channel';
let cachedCategoryIndex = null;
let cachedCategorySignature = '';

function categoryIndexFor(categories = []) {
  const rows = Array.isArray(categories) ? categories : [];
  const signature = [
    rows.length,
    ...[0, Math.floor(rows.length / 3), Math.floor(rows.length * 2 / 3), rows.length - 1]
      .filter((index) => index >= 0 && rows[index])
      .map((index) => `${rows[index].id}:${rows[index].path}`),
  ].join('|');
  if (!cachedCategoryIndex || signature !== cachedCategorySignature) {
    cachedCategoryIndex = compileVonHalskyCategoryIndex(rows);
    cachedCategorySignature = signature;
  }
  return cachedCategoryIndex;
}

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
    returns: [],
    claims: [],
    events: [],
    commands: [],
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
    returns: Array.isArray(value?.returns) ? value.returns.slice(0, 500) : [],
    claims: Array.isArray(value?.claims) ? value.claims.slice(0, 500) : [],
    events: Array.isArray(value?.events) ? value.events.slice(0, 1000) : [],
    commands: Array.isArray(value?.commands) ? value.commands.slice(0, 500) : [],
    categories: Array.isArray(value?.categories) ? value.categories.slice(0, 10_000) : [],
  };
}

function channelOperationalSummary(state = {}) {
  const truth = vonHalskyCatalogTruthSummary(state.offers);
  const commands = Array.isArray(state.commands) ? state.commands : [];
  const pendingCommands = commands.filter((item) => (
    !['SUCCESS', 'FAILURE', 'FAILED', 'CANCELLED', 'NOT_FOUND'].includes(String(item?.status || 'PENDING').toUpperCase())
  ));
  return {
    source: 'inpost-von-halsky-api',
    verifiedAt: state.sync?.lastCatalogVerifiedAt || state.sync?.lastCatalogAt || null,
    truth,
    operations: {
      pendingCommands: pendingCommands.length,
      recentCommands: commands.length,
    },
    consistent: Number(state.sync?.remoteOfferCount ?? truth.total) === truth.total
      && Number(state.sync?.publishedOfferCount ?? truth.published) === truth.published,
  };
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

function matchingText(value, max = 160) {
  return String(value ?? '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function matchingGtin(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  const payload = digits.slice(0, -1).split('').reverse();
  const sum = payload.reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1)) ? digits : null;
}

function validationRows(item = {}) {
  return [
    ...(Array.isArray(item?.metadata?.validationErrors) ? item.metadata.validationErrors : []),
    ...(Array.isArray(item?.validationErrors) ? item.validationErrors : []),
    ...(Array.isArray(item?.metadata?.rejectionReasons) ? item.metadata.rejectionReasons : []),
    ...(Array.isArray(item?.rejectionReasons) ? item.rejectionReasons : []),
  ];
}

function categoryRejectionForProduct(state = {}, product = {}) {
  const externalId = matchingText(product.externalId || product.sku || product.id, 200);
  const offerId = matchingText(product.vonHalskyOfferId || product.inpostVonHalskyOfferId, 200);
  for (const item of Array.isArray(state.offers) ? state.offers : []) {
    const offer = item?.offer || item || {};
    const sameOffer = offerId && matchingText(offer.id || offer.offerId, 200) === offerId;
    const sameExternal = externalId && matchingText(offer.externalId, 200) === externalId;
    if (!sameOffer && !sameExternal) continue;
    const rejection = validationRows(item).find((row) => (
      matchingText(row?.validationCode || row?.code, 160).toUpperCase() === 'CATEGORY_INCORRECT'
      || /kategor(?:ia|ii).{0,80}(?:nieprawid|błęd|odrzu)/i.test(matchingText(row?.validationMessage || row?.message, 600))
    ));
    if (rejection) return {
      rejected: true,
      offerId: matchingText(offer.id || offer.offerId, 200),
      code: matchingText(rejection.validationCode || rejection.code, 160),
      message: matchingText(rejection.validationMessage || rejection.message, 600),
    };
  }
  return { rejected: false, offerId: '', code: '', message: '' };
}

export function createVonHalskyRoute({
  respond,
  isAdmin,
  readVersioned,
  writeIfVersion,
  readOverview,
  readStatus,
  readDashboardSummary,
  readRecordPage,
  readProductQueue,
  env = () => process.env,
  fetchImpl = globalThis.fetch,
  loadCatalog = async () => [],
  saveProductFields = null,
  reportProgress = async () => {},
  prepareProductWithAgent = null,
  inspectSource = null,
  sourceImages = null,
  sourceUrlOf = () => '',
  sessionOf = () => null,
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
      const normalizedOperation = String(operation || '').slice(0, 80);
      const normalizedStatus = String(status || '').slice(0, 40);
      const normalizedMessage = String(message || '').slice(0, 500);
      const previous = Array.isArray(current.diagnostics) ? current.diagnostics : [];
      const repeated = previous.find((item) => (
        item.operation === normalizedOperation
        && item.status === normalizedStatus
        && item.message === normalizedMessage
      ));
      const remaining = previous.filter((item) => {
        if (item === repeated) return false;
        // Po udanej operacji stare błędy tego samego kroku nie są nadal
        // problemami bieżącymi. Pełny ślad pozostaje w centralnym audycie
        // zdarzeń, a lokalna diagnostyka kanału pokazuje stan operacyjny.
        if (normalizedStatus === 'ok' && item.operation === normalizedOperation && item.status !== 'ok') return false;
        return true;
      });
      current.diagnostics = [{
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        at: new Date().toISOString(),
        firstAt: repeated?.firstAt || repeated?.at || new Date().toISOString(),
        count: Math.max(1, Number(repeated?.count) || 0) + (repeated ? 1 : 0),
        operation: normalizedOperation,
        status: normalizedStatus,
        message: normalizedMessage,
        requestId: String(requestId || '').slice(0, 240),
      }, ...remaining].slice(0, 30);
      return current;
    });
  }

  function commandReceipt(payload = {}, type = '', entityId = '') {
    const commandId = matchingText(payload?.commandId || payload?.id, 160);
    if (!commandId) return null;
    return {
      commandId,
      type: matchingText(type, 40),
      entityId: matchingText(entityId, 180),
      status: matchingText(payload?.status || 'PENDING', 40),
      updatedAt: new Date().toISOString(),
    };
  }

  function mergeBy(items = [], incoming = [], keyOf = (item) => item?.id) {
    const merged = new Map((Array.isArray(items) ? items : []).map((item) => [String(keyOf(item) || ''), item]));
    for (const item of Array.isArray(incoming) ? incoming : []) {
      const key = String(keyOf(item) || '');
      if (key) merged.set(key, item);
    }
    return [...merged.values()];
  }

  async function progress(work = {}) {
    try { await reportProgress(work); } catch { /* telemetria nie może blokować API kanału */ }
  }

  async function updateProductPublication(products = [], status = 'confirmed', details = {}) {
    const rows = (Array.isArray(products) ? products : []).filter((product) => product?.id !== undefined && product?.id !== null);
    if (!rows.length) return [];
    if (typeof saveProductFields === 'function') {
      const timestamp = details.timestamp || new Date().toISOString();
      const confirmations = [];
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
        const saved = await saveProductFields({
          productId: id,
          fields,
          mutationId: `von-halsky-publication:${id}:${details.receiptId || timestamp}`,
          actor: 'von-halsky-api',
          area: 'von-halsky-publication',
        });
        confirmations.push({
          productId: id,
          fields,
          readbackConfirmed: saved?.publication?.readbackConfirmed === true,
          confirmedAt: timestamp,
        });
      }
      return confirmations;
    }
    throw Object.assign(
      new Error('Centralna kartoteka produktów nie jest dostępna; potwierdzenie Von Halsky nie może zostać zapisane zastępczo.'),
      { code: 'central_product_catalog_unavailable', status: 503 },
    );
  }

  const routeContext = {
    respond, readVersioned, STORE_KEY, initialState, cleanState, api, mutate,
    recordDiagnostic, loadCatalog, sourceUrlOf, inspectSource, sourceImages,
    resolveVonHalskyResponsibleProducer, categoryIndexFor,
    suggestVonHalskyCategory, matchVonHalskyAttributes,
    vonHalskyAgentPreparationPatch, saveProductFields, sessionOf, progress,
    updateProductPublication, prepareProductWithAgent, safeError, matchingText,
    matchingGtin, categoryRejectionForProduct, remoteOfferSummary,
    commandReceipt, mergeBy, summarizeVonHalskyCatalog,
    deduplicateVonHalskyOffers, vonHalskyOfferProposal,
    vonHalskyOfferProjection, vonHalskyProductReadiness,
    vonHalskyPublicConfig, normalizeVonHalskySettings, env,
  };
  const agentPreparationRoute = createVonHalskyAgentRoute(routeContext);
  const operationsRoute = createVonHalskyOperationsRoute(routeContext);
  const catalogRoute = createVonHalskyCatalogRoute(routeContext);

  return async function vonHalskyRoute(req, url, action) {
    if (!String(action || '').startsWith('von-halsky-')) return null;
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);

    if (action === 'von-halsky-overview') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const [snapshot, statusSnapshot] = await Promise.all([
        typeof readOverview === 'function'
          ? readOverview(initialState())
          : readVersioned(STORE_KEY, initialState()).then((value) => value.value),
        typeof readStatus === 'function' ? readStatus(initialState()) : Promise.resolve(null),
      ]);
      const state = cleanState(snapshot);
      const channel = statusSnapshot?.truth
        ? {
            source: 'inpost-von-halsky-api',
            verifiedAt: statusSnapshot.sync?.lastCatalogVerifiedAt || statusSnapshot.updatedAt || null,
            truth: statusSnapshot.truth,
            operations: {
              pendingCommands: Number(statusSnapshot.commandSummary?.pending) || 0,
              recentCommands: Number(statusSnapshot.commandSummary?.total) || 0,
            },
            consistent: true,
          }
        : channelOperationalSummary(state);
      return respond({
        ok: true,
        config: vonHalskyPublicConfig(env()),
        settings: state.settings,
        sync: statusSnapshot?.sync || state.sync,
        diagnostics: state.diagnostics,
        offers: state.offers,
        orders: state.orders,
        returns: state.returns,
        claims: state.claims,
        events: state.events,
        commands: state.commands,
        categoryCount: Number(snapshot?.categoryCount) || state.categories.length,
        updatedAt: state.updatedAt,
        truth: channel.truth,
        channelStatus: channel,
        channel: 'InPost Von Halsky',
      });
    }

    if (action === 'von-halsky-dashboard-summary') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (typeof readDashboardSummary !== 'function') {
        return respond({ ok: false, error: 'Podsumowanie kanału nie jest dostępne.', code: 'von_halsky_summary_unavailable' }, 503);
      }
      return respond({ ok: true, ...(await readDashboardSummary(initialState())), channel: 'InPost Von Halsky' });
    }

    if (action === 'von-halsky-records') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const kind = matchingText(url.searchParams.get('kind'), 40);
      if (!['orders', 'returns', 'claims', 'commands', 'events', 'diagnostics'].includes(kind)) {
        return respond({ ok: false, error: 'Nieobsługiwany rodzaj danych.', code: 'von_halsky_record_kind' }, 422);
      }
      if (typeof readRecordPage !== 'function') {
        return respond({ ok: false, error: 'Stronicowany odczyt nie jest dostępny.', code: 'von_halsky_records_unavailable' }, 503);
      }
      return respond({
        ok: true,
        kind,
        ...(await readRecordPage(kind, {
          query: url.searchParams.get('q'),
          status: url.searchParams.get('status'),
          limit: url.searchParams.get('limit'),
          cursor: url.searchParams.get('cursor'),
        })),
      });
    }

    if (action === 'von-halsky-product-queue') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (typeof readProductQueue !== 'function') {
        return respond({ ok: false, error: 'Kolejka produktów nie jest dostępna.', code: 'von_halsky_product_queue_unavailable' }, 503);
      }
      return respond({
        ok: true,
        ...(await readProductQueue({
          query: url.searchParams.get('q'),
          stage: url.searchParams.get('stage'),
          quality: url.searchParams.get('quality'),
          agent: url.searchParams.get('agent'),
          channel: url.searchParams.get('channel'),
          availability: url.searchParams.get('availability'),
          producer: url.searchParams.get('producer'),
          category: url.searchParams.get('category'),
          problem: url.searchParams.get('problem'),
          price: url.searchParams.get('price'),
          sort: url.searchParams.get('sort'),
          page: url.searchParams.get('page'),
          limit: url.searchParams.get('limit'),
          cursor: url.searchParams.get('cursor'),
        })),
      });
    }

    if (action === 'von-halsky-status') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const snapshot = typeof readStatus === 'function'
        ? await readStatus(initialState())
        : (await readVersioned(STORE_KEY, initialState())).value;
      const state = cleanState(snapshot);
      const channel = channelOperationalSummary(state);
      return respond({
        ok: true,
        config: vonHalskyPublicConfig(env()),
        sync: state.sync,
        truth: channel.truth,
        channelStatus: channel,
        updatedAt: state.updatedAt,
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
      if (state.categories.length && !category) return respond({ ok: false, error: 'Wybrana kategoria nie występuje w aktualnym drzewie Von Halsky. Odśwież katalog i wybierz ją ponownie.' }, 422);
      if (category && category.leaf !== true) return respond({ ok: false, error: 'Oferta musi być przypisana do kategorii końcowej.' }, 422);
      const timestamp = new Date().toISOString();
      const fields = {
        vonHalskyCategoryId: categoryId,
        vonHalskyCategoryName: matchingText(category?.name, 240),
        vonHalskyCategoryPath: matchingText(category?.path, 1000),
        vonHalskyCategoryMatchedBy: 'admin',
        vonHalskyCategoryMatchedAt: timestamp,
        vonHalskyCategoryAcceptedAt: timestamp,
        vonHalskyCategoryRejection: null,
        vonHalskyCategoryResolution: {
          categoryId,
          name: matchingText(category?.name, 240),
          path: matchingText(category?.path, 1000),
          source: 'admin-current-api-tree',
          confidence: 1,
          evidence: ['Kategoria wybrana przez administratora z aktualnego drzewa API Von Halsky.'],
          resolvedAt: timestamp,
        },
      };
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

    if (action === 'von-halsky-product-matching') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (typeof saveProductFields !== 'function') return respond({ ok: false, error: 'Centralna kartoteka produktów nie jest dostępna.' }, 503);
      const body = await req.json().catch(() => ({}));
      const productId = matchingText(body.productId, 200);
      const rawEan = matchingText(body.ean, 40);
      const ean = matchingGtin(rawEan);
      const producerCode = matchingText(body.producerCode, 160);
      const producer = matchingText(body.producer, 160);
      const brand = matchingText(body.brand, 160);
      if (!productId) return respond({ ok: false, error: 'Nie wskazano produktu do poprawy.' }, 422);
      if (rawEan && ean === null) return respond({ ok: false, error: 'EAN/GTIN ma nieprawidłową długość albo cyfrę kontrolną.' }, 422);
      if (producer && !/\p{L}/u.test(producer)) return respond({ ok: false, error: 'Producent musi być faktyczną nazwą, a nie samym numerem.' }, 422);
      if (brand && !/\p{L}/u.test(brand)) return respond({ ok: false, error: 'Marka musi zawierać nazwę, a nie same cyfry.' }, 422);
      const products = await loadCatalog();
      const list = Array.isArray(products) ? products : [...(products?.values?.() || [])];
      const product = list.find((item) => String(item?.id) === productId);
      if (!product) return respond({ ok: false, error: 'Produkt nie istnieje w centralnej kartotece.' }, 404);
      if (ean) {
        const duplicate = list.find((item) => String(item?.id) !== productId && matchingGtin(item?.gtin || item?.ean) === ean);
        if (duplicate) return respond({
          ok: false,
          error: `EAN ${ean} jest już przypisany do produktu „${matchingText(duplicate.nazwa || duplicate.name || duplicate.id, 180)}”. Najpierw rozwiąż duplikat.`,
          code: 'von_halsky_gtin_conflict',
          conflictingProductId: String(duplicate.id),
        }, 409);
      }
      const method = ean ? 'manual_gtin' : producerCode && (brand || producer) ? 'manual_producer_code_brand' : 'incomplete';
      const label = ean ? 'EAN/GTIN' : method === 'manual_producer_code_brand' ? 'Kod + marka' : 'Wymaga uzupełnienia';
      const at = new Date().toISOString();
      await saveProductFields({
        productId,
        fields: {
          ean: ean || '',
          gtin: ean || '',
          kodProducenta: producerCode,
          mpn: producerCode,
          producent: producer,
          marka: brand,
          vonHalskyMatchingMethod: method,
          vonHalskyMatchingVerifiedAt: at,
        },
        mutationId: `von-halsky-matching:${productId}:${Date.now()}`,
        actor: 'admin-von-halsky',
        area: 'von-halsky-matching',
      });
      return respond({ ok: true, productId, matching: { method, label, ean: ean || '', producerCode, producer, brand, verifiedAt: at } });
    }

    const agentResponse = await agentPreparationRoute(req, url, action);
    if (agentResponse) return agentResponse;

    const operationsResponse = await operationsRoute(req, url, action);
    if (operationsResponse) return operationsResponse;

    const catalogResponse = await catalogRoute(req, url, action);
    if (catalogResponse) return catalogResponse;
    return respond({ ok: false, error: `Nieznana akcja Von Halsky: ${action}` }, 404);
  };
}
