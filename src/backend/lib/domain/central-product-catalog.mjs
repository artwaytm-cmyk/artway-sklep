import { createCentralProductSynchronizer } from './central-product-synchronizer.mjs';
import { createCentralProductMutations } from './central-product-mutations.mjs';
import {
  centralCatalogQueryOptions,
  decodeCatalogCursor,
  encodeCatalogCursor,
} from './central-product-catalog-query.mjs';
import crypto from 'node:crypto';
import { assertPostgresRelations } from '../core/postgres-schema-contract.mjs';
import { produktBezDanychPrywatnych } from '../infakt-purchase.mjs';
import { mergeCatalogProducts } from './catalog-quality.mjs';
import { canonicalManufacturerName } from './product-field-validation.mjs';

const asArray = (value) => Array.isArray(value) ? value : [];
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value, max = 1000) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const numberOrNull = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};
const normalize = (value) => text(value, 5000).toLocaleLowerCase('pl-PL').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, ' ').trim();
const own = (object, key) => Object.prototype.hasOwnProperty.call(asObject(object), String(key)) || Object.prototype.hasOwnProperty.call(asObject(object), key);
const searchTsQuery = (value) => normalize(value).split(/\s+/).filter(Boolean).slice(0, 12).map((token) => `${token}:*`).join(' & ');
export const CENTRAL_PRODUCT_SCHEMA_VERSION = 7;
const CENTRAL_PRODUCT_DERIVED_FIELDS = new Set(['_catalog', 'stan', 'dostepny']);

export const CENTRAL_ALLEGRO_PREPARATION_FIELDS = Object.freeze([
  'nazwa', 'allegroTitle', 'opisKrotki', 'opis', 'allegroDescription',
  'producent', 'marka', 'gtin', 'ean', 'kodProducenta', 'mpn', 'zdjecie',
  'zdjecia', 'sourceEvidence', 'allegroCategoryId', 'allegroProductId',
  'allegroParameters', 'allegroDescriptionSections', 'allegroSafetyInformation',
  'allegroResponsibleProducer', 'allegroShippingSubsidy',
  'allegroShippingRateId', 'allegroShippingRateName',
  'allegroReturnPolicyId', 'allegroReturnPolicyName',
  'allegroImpliedWarrantyId', 'allegroImpliedWarrantyName',
  'allegroWarrantyId', 'allegroWarrantyName',
]);

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function stablePreparationValue(value) {
  if (Array.isArray(value)) return value.map(stablePreparationValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(?:at|date|time|timestamp)$/i.test(key))
    .map(([key, entry]) => [key, stablePreparationValue(entry)]));
}

function preparationHash(product = {}, { stableEvidence = true } = {}) {
  const raw = stableJson(CENTRAL_ALLEGRO_PREPARATION_FIELDS.map((key) => [
    key,
    key === 'sourceEvidence' && stableEvidence
      ? stablePreparationValue(product[key] ?? null)
      : product[key] ?? null,
  ]));
  let hash = 2166136261;
  for (const byte of Buffer.from(raw, 'utf8')) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function centralCatalogApplyAuthority(product = {}, authority = {}) {
  const source = { ...asObject(product) };
  const saved = asObject(authority?.data);
  const fields = [...new Set(asArray(authority?.fields || authority?.authoritative_fields)
    .map((field) => text(field, 120))
    .filter((field) => field && !CENTRAL_PRODUCT_DERIVED_FIELDS.has(field)))];
  for (const field of fields) {
    if (own(saved, field)) source[field] = saved[field];
    else delete source[field];
  }
  return source;
}

export function centralAllegroPreparationFingerprint(product = {}) {
  return `allegro-preparation-v5-${preparationHash(product)}`;
}

export function centralAllegroPreparationCurrent(product = {}) {
  const status = text(product.allegroAgentPreparationStatus, 40).toLowerCase();
  const missing = asArray(product.allegroAgentPreparationMissing).map((item) => text(item, 300)).filter(Boolean);
  if (!['ready', 'published'].includes(status) || missing.length) return false;
  if (status === 'published' && text(product.allegroOfferId, 120)) return true;
  const version = Number(product.allegroAgentPreparationVersion) || 0;
  const savedFingerprint = text(product.allegroAgentPreparationFingerprint, 120);
  if (version >= 4 && savedFingerprint.startsWith('allegro-preparation-v5-')) {
    return savedFingerprint === centralAllegroPreparationFingerprint(product);
  }
  // Bezpieczna zgodność podczas migracji: stare podpisy v4 nadal są
  // weryfikowane dawnym algorytmem. Każdy następny potwierdzony zapis
  // przechodzi już na v5, który pomija daty technicznego odczytu źródła.
  if (version >= 4 && savedFingerprint.startsWith('allegro-preparation-v4-')) {
    return savedFingerprint === `allegro-preparation-v4-${preparationHash(product, { stableEvidence: false })}`;
  }
  // Rekordy v3 były zapisywane przed wprowadzeniem kanonicznego JSON. Ich
  // kolejność kluczy zmieniała się po przejściu przez JSONB, dlatego zamiast
  // ponownie liczyć niestabilny skrót uznajemy wyłącznie ostatni, potwierdzony
  // przez serwer zapis przygotowania. Kolejna zmiana treści przejdzie już na v4.
  return version === 3
    && text(product.lastAdminMutationArea, 80) === 'allegro-preparation'
    && text(product.lastAdminMutationId, 160).startsWith('allegro-preparation:')
    && asArray(product.lastAdminMutationFields).includes('allegroAgentPreparationFingerprint');
}

function centralCatalogListProduct(product = {}, catalogMeta = {}, { admin = false } = {}) {
  const fields = [
    'id', 'nazwa', 'name', 'cena', 'cenaAllegro', 'cenaVonHalsky', 'staraCena', 'kategoria', 'producent', 'marka',
    'externalId', 'sku', 'gtin', 'ean', 'kodProducenta', 'mpn', 'zdjecie', 'ikona', 'kolor',
    'sourceUrl', 'producentUrl', 'urlProducenta', 'allegroOfferId', 'allegroProductId', 'allegroCategoryId', 'badge',
    'opisKrotki', 'krotkiOpis', 'warianty', 'agentOnboardingStatus', 'allegroAgentPreparationStatus',
    'allegroAgentPreparationMissing', 'allegroAgentPreparedAt', 'allegroEditorialSyncState',
    'allegroAgentPreparationFingerprint', 'allegroAgentPreparationVersion',
    'allegroAgentPreparationRunId', 'allegroAgentPreparationConfirmedAt',
    'allegroAgentPreparationConfirmedRevision', 'allegroAgentPreparationRetryCount',
    'allegroAgentPreparationNextRetryAt',
  ];
  if (admin) fields.push(
    'cenaZakupu', 'auxiliarySources',
    'manufacturerProfileId', 'manufacturerProfile', 'manufacturerProfileResolvedAt',
    'manufacturerProfileConfidence', 'manufacturerProfileMethod', 'manufacturerProfileEvidence',
    'vonHalskyCategoryId', 'vonHalskyAttributes', 'vonHalskyOfferId', 'vonHalskyCommandId',
    'vonHalskyMatchingMethod', 'vonHalskyMatchingVerifiedAt', 'vonHalskyCategoryMatchedBy', 'vonHalskyCategoryMatchedAt',
    'vonHalskyCategoryPath', 'vonHalskyCategoryRejectedAt', 'vonHalskyCategoryRejection',
    'vonHalskyGpsrRequired', 'vonHalskyResponsibleProducer', 'vonHalskyResponsibleProducerStatus',
    'vonHalskyResponsibleProducerMissing', 'vonHalskyResponsibleProducerEvidence',
    'vonHalskyContentMode', 'vonHalskyTitle', 'vonHalskyShortDescription', 'vonHalskyDescription',
    'vonHalskyEditorialSyncState', 'vonHalskyEditorialSyncPending', 'vonHalskyEditorialSyncRunId',
    'vonHalskyRemoteStatus', 'vonHalskyRemotePresent', 'vonHalskyRemoteVerifiedAt',
    'vonHalskyAgentStatus', 'vonHalskyAgentPreparedAt', 'vonHalskyAgentRulesVersion', 'vonHalskyAgentDocumentation',
    'vonHalskyAgentScore', 'vonHalskyAgentIssues', 'vonHalskyAgentWarnings', 'vonHalskyAgentError',
    'vonHalskyAgentCategorySuggestion', 'vonHalskyAgentAttributeCoverage', 'vonHalskyAgentMissingAttributes',
    'vonHalskyAgentEvidence', 'vonHalskyAgentSavedFields', 'vonHalskyAgentConfirmedAt',
    'vonHalskyAgentPreparationRunId', 'vonHalskyAgentPreparationSource',
    'vonHalskyAgentSaveState', 'vonHalskyAgentReadbackConfirmed',
    'agentQualityReviewStatus', 'agentQualityConfirmedAt', 'agentQualityReadbackConfirmed',
    'agentQualityRunId', 'agentQualityInputFingerprint', 'agentQualityChannels',
    'agentQualitySavedFields',
  );
  const result = {};
  for (const field of fields) if (Object.prototype.hasOwnProperty.call(product, field)) result[field] = product[field];
  result.id = text(product.id, 120);
  if (admin) result.allegroAgentPreparationCurrent = centralAllegroPreparationCurrent(product);
  result._catalog = { ...catalogMeta, detailLevel: 'list' };
  return result;
}

export function centralCatalogMissingFields(product = {}) {
  const missing = [];
  if (!text(product.nazwa || product.name)) missing.push('nazwa');
  if (!(Number(product.cena || product.price) > 0)) missing.push('cena');
  if (!text(product.gtin || product.ean || product.EAN || product.GTIN)) missing.push('ean');
  if (!text(product.zdjecie || product.image || asArray(product.zdjecia)[0])) missing.push('zdjecie');
  if (!text(product.opisKrotki || product.krotkiOpis) || !text(product.opis || product.description)) missing.push('opis');
  if (!canonicalManufacturerName(product.producent || product.marka || product.brand)) missing.push('producent');
  if (!text(product.kategoria || product.category)) missing.push('kategoria');
  if (!text(product.sourceUrl || product.producentUrl || product.urlProducenta)) missing.push('zrodlo');
  if (!(Number(product.cenaZakupu) > 0)) missing.push('koszt');
  return missing;
}

function catalogIdentityKeys(product = {}) {
  const result = [], add = (type, value) => { const key = normalize(value); if (key) result.push(`${type}:${key}`); };
  const ean = text(product.gtin || product.ean).replace(/\D/g, '');
  if (ean) result.push(`ean:${ean}`);
  add('external', product.externalId || product.sku);
  add('producer-code', `${product.producent || product.marka || ''}|${product.kodProducenta || product.mpn || ''}`);
  if (!result.length) add('name', `${product.producent || product.marka || ''}|${product.nazwa || product.name || ''}`);
  return [...new Set(result)];
}

function offerIndex(offers = [], mappings = {}) {
  const byId = new Map(asArray(offers).map((offer) => [text(offer?.id, 120), offer]).filter(([id]) => id));
  const byProduct = new Map();
  const append = (productId, offer) => {
    const id = text(productId, 120), offerId = text(offer?.id, 120);
    if (!id || !offerId) return;
    const list = byProduct.get(id) || [];
    if (!list.some((item) => text(item?.id, 120) === offerId)) list.push(offer);
    byProduct.set(id, list);
  };
  for (const offer of asArray(offers)) append(offer?.shopProductId || offer?.localProductId || offer?.external?.id, offer);
  const entries = Array.isArray(mappings) ? mappings.map((entry) => [entry?.offerId || entry?.id, entry]) : Object.entries(asObject(mappings));
  for (const [rawOfferId, mapping] of entries) {
    const offerId = text(mapping?.offerId || rawOfferId, 120), productId = text(mapping?.productId || mapping?.shopProductId || mapping?.localProductId, 120);
    const offer = byId.get(offerId) || (offerId ? { id: offerId, status: mapping?.offerStatus || mapping?.status || '' } : null);
    if (offer) append(productId, offer);
  }
  return { byId, byProduct };
}

export function centralCatalogBuildRecords(data = {}, {
  importedProducts = [], offers = [], mappings = {}, sourceRevision = '', authoritativeProducts = new Map(),
} = {}) {
  const merged = mergeCatalogProducts(data, importedProducts), addedIds = new Set(asArray(data.artway_produkty_dodane).map((product) => String(product?.id))), importedIds = new Set(asArray(importedProducts).map((product) => String(product?.id)));
  const authorityFor = (id) => authoritativeProducts instanceof Map
    ? authoritativeProducts.get(String(id))
    : asObject(authoritativeProducts)[String(id)];
  merged.products = merged.products.map((product) => centralCatalogApplyAuthority(product, authorityFor(product?.id)));
  const stock = asObject(data.artway_stany), availability = asObject(data.artway_dostepnosc), warehouse = asObject(data.artway_magazyn_produkty), offerLookup = offerIndex(offers, mappings);
  const reviewStats = new Map();
  for (const review of asArray(data.artway_opinie)) {
    if (text(review?.status, 40).toLowerCase() !== 'zatwierdzona') continue;
    const productId = text(review?.produktId ?? review?.productId, 120), rating = Number(review?.ocena ?? review?.rating);
    if (!productId || !(rating >= 1 && rating <= 5)) continue;
    const current = reviewStats.get(productId) || { sum: 0, count: 0 }; current.sum += rating; current.count++; reviewStats.set(productId, current);
  }
  const identityCounts = new Map();
  for (const product of merged.products) for (const key of catalogIdentityKeys(product)) identityCounts.set(key, (identityCounts.get(key) || 0) + 1);
  const now = new Date().toISOString();
  return merged.products.map((product) => {
    const id = text(product?.id, 120); if (!id) return null;
    const inTrash = merged.hiddenIds.has(id), availabilityData = asObject(availability[id]), warehouseData = asObject(warehouse[id]);
    const stockValue = own(stock, id) ? numberOrNull(stock[id]) : null;
    const decision = text(availabilityData.decision).toLowerCase(), graceUntil = Date.parse(text(availabilityData.expiresAt));
    const unavailableByRecord = decision === 'manual_available' ? false : decision === 'grace' ? (!Number.isFinite(graceUntil) || graceUntil <= Date.now()) : ['niedostepny', 'ukryty', 'wstrzymany', 'brak'].includes(text(availabilityData.status || decision).toLowerCase());
    const unavailable = unavailableByRecord || product.aktywny === false || product.ukryty === true || product.sprzedazAktywna === false || product.saleAvailable === false;
    const saleAvailable = !inTrash && !unavailable;
    const directOffer = text(product.allegroOfferId, 120), productOffers = [...(offerLookup.byProduct.get(id) || [])];
    if (directOffer && offerLookup.byId.has(directOffer) && !productOffers.some((offer) => text(offer?.id, 120) === directOffer)) productOffers.unshift(offerLookup.byId.get(directOffer));
    const activeOffers = productOffers.filter((offer) => !['ENDED', 'INACTIVE', 'ARCHIVED', 'DELETED'].includes(text(offer?.status).toUpperCase()));
    const primaryOffer = activeOffers[0] || productOffers[0] || null, missing = centralCatalogMissingFields(product);
    const source = importedIds.has(id) ? 'import' : addedIds.has(id) ? 'dodany' : 'bazowy', reviews = reviewStats.get(id) || { sum: 0, count: 0 };
    const image = text(product.zdjecie || product.image || asArray(product.zdjecia)[0], 3000), category = text(product.kategoria || product.category, 300), producer = text(product.producent || product.marka || product.brand, 300);
    const catalogMeta = {
      schemaVersion: CENTRAL_PRODUCT_SCHEMA_VERSION, source, recordStatus: inTrash ? 'trash' : 'active', sourceRevision, syncedAt: now,
      inventory: { stock: stockValue, unlimited: stockValue === null, ...warehouseData },
      availability: { ...availabilityData, saleAvailable },
      channels: { store: { active: saleAvailable }, allegro: { offerId: text(primaryOffer?.id || directOffer, 120), status: text(primaryOffer?.status, 80), offers: productOffers.map((offer) => ({ id: text(offer?.id, 120), status: text(offer?.status, 80) })) } },
      missingFields: missing,
    };
    const adminProduct = { ...product, id, stan: stockValue, _catalog: catalogMeta };
    const publicProduct = { ...produktBezDanychPrywatnych(product), id, dostepny: saleAvailable, _catalog: { schemaVersion: CENTRAL_PRODUCT_SCHEMA_VERSION, availability: { saleAvailable }, channels: { store: { active: saleAvailable }, allegro: { offerId: catalogMeta.channels.allegro.offerId, status: catalogMeta.channels.allegro.status } } } };
    const adminListData = centralCatalogListProduct(adminProduct, catalogMeta, { admin: true });
    const publicListData = centralCatalogListProduct(publicProduct, publicProduct._catalog);
    const searchText = normalize([id, product.nazwa, product.name, product.opisKrotki, product.kategoria, product.sku, product.externalId, product.gtin, product.ean, product.kodProducenta, product.mpn, producer, primaryOffer?.id].join(' '));
    return {
      id, data: adminProduct, publicData: publicProduct, adminListData, publicListData, name: text(product.nazwa || product.name, 500), searchText, category, producer,
      externalId: text(product.externalId, 200), sku: text(product.sku, 200), ean: text(product.gtin || product.ean, 80).replace(/\s/g, ''),
      source, recordStatus: inTrash ? 'trash' : 'active', stock: stockValue, saleAvailable, hasSource: !!text(product.sourceUrl || product.producentUrl || product.urlProducenta),
      hasAllegro: !!catalogMeta.channels.allegro.offerId, allegroStatus: catalogMeta.channels.allegro.status.toUpperCase(), missingFields: missing, missingCount: missing.filter((field) => field !== 'koszt').length,
      price: numberOrNull(product.cena), allegroPrice: numberOrNull(product.cenaAllegro || product.cena), vonHalskyPrice: numberOrNull(product.cenaVonHalsky || product.cenaAllegro || product.cena), promotion: Number(product.staraCena) > Number(product.cena), newProduct: text(product.badge, 80).toLowerCase() === 'nowość', rating: reviews.count ? reviews.sum / reviews.count : null, ratingCount: reviews.count,
      duplicateStore: catalogIdentityKeys(product).some((key) => (identityCounts.get(key) || 0) > 1), duplicateAllegro: activeOffers.length > 1,
      fingerprint: crypto.createHash('sha256').update(JSON.stringify(adminProduct)).digest('hex'), updatedAt: now, image,
    };
  }).filter(Boolean);
}

export { centralCatalogQueryOptions } from './central-product-catalog-query.mjs';

export function createCentralProductCatalog({ pool, namespace = 'artway-sklep' } = {}) {
  const available = !!pool, ns = text(namespace, 120) || 'artway-sklep'; let schemaPromise = null;
  const aggregateCache = new Map();
  const ensureSchema = async () => {
    if (!available) return false;
    if (!schemaPromise) {
      schemaPromise = assertPostgresRelations(pool, [
        'artway_products',
        'artway_storefront_products',
        'artway_product_catalog_meta',
        'artway_product_mutations',
        'artway_product_sequences',
      ], 'centralnego katalogu produktów').then(() => true);
    }
    return schemaPromise;
  };

  const metadata = async () => {
    if (!available) return { available: false, count: 0, sourceRevision: '', syncedAt: null };
    await ensureSchema(); const result = await pool.query('SELECT schema_version, source_revision, product_count, synced_at FROM artway_product_catalog_meta WHERE namespace=$1', [ns]);
    if (!result.rowCount) return { available: true, count: 0, schemaVersion: 0, outdated: true, sourceRevision: '', syncedAt: null };
    const schemaVersion = Number(result.rows[0].schema_version) || 0;
    return { available: true, count: Number(result.rows[0].product_count) || 0, schemaVersion, outdated: schemaVersion !== CENTRAL_PRODUCT_SCHEMA_VERSION, sourceRevision: result.rows[0].source_revision || '', syncedAt: result.rows[0].synced_at };
  };

  const synchronize = createCentralProductSynchronizer({
    available, ensureSchema, text, pool, ns, asObject, asArray,
    centralCatalogBuildRecords, aggregateCache, CENTRAL_PRODUCT_SCHEMA_VERSION,
  });

  const aggregates = async (admin, revision = '') => {
    const key = `${admin ? 'admin' : 'public'}:${revision}`;
    const cached = aggregateCache.get(key);
    if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.promise;
    const audienceWhere = admin ? "namespace=$1 AND record_status<>'removed'" : "namespace=$1 AND record_status='active' AND sale_available=true";
    const table = admin ? 'artway_products' : 'artway_storefront_products';
    const summarySql = admin
      ? `SELECT COUNT(*)::bigint total,COUNT(*) FILTER(WHERE record_status='active')::bigint active,COUNT(*) FILTER(WHERE record_status='trash')::bigint trash,COUNT(*) FILTER(WHERE sale_available=false AND record_status='active')::bigint hidden,COUNT(*) FILTER(WHERE missing_count>0 AND record_status='active')::bigint missing,COUNT(*) FILTER(WHERE missing_count=0 AND sale_available=true AND record_status='active')::bigint ready,COUNT(*) FILTER(WHERE has_allegro=true AND record_status='active')::bigint connected,COUNT(*) FILTER(WHERE promotion=true AND record_status='active')::bigint promotions,COUNT(*) FILTER(WHERE new_product=true AND record_status='active')::bigint new_products,COUNT(*) FILTER(WHERE duplicate_store=true AND record_status='active')::bigint duplicate_store,COUNT(*) FILTER(WHERE duplicate_allegro=true AND record_status='active')::bigint duplicate_allegro FROM artway_products WHERE ${audienceWhere}`
      : `SELECT COUNT(*)::bigint total,COUNT(*)::bigint active,0::bigint trash,0::bigint hidden,0::bigint missing,COUNT(*)::bigint ready,0::bigint connected,COUNT(*) FILTER(WHERE promotion=true)::bigint promotions,COUNT(*) FILTER(WHERE new_product=true)::bigint new_products,0::bigint duplicate_store,0::bigint duplicate_allegro FROM artway_storefront_products WHERE ${audienceWhere}`;
    const promise = Promise.all([
      pool.query(summarySql, [ns]),
      pool.query(`SELECT category value,COUNT(*)::bigint count FROM ${table} WHERE ${audienceWhere} AND category<>'' GROUP BY category ORDER BY category`, [ns]),
      pool.query(`SELECT producer value,COUNT(*)::bigint count FROM ${table} WHERE ${audienceWhere} AND producer<>'' GROUP BY producer ORDER BY producer`, [ns]),
    ]).then(([summaryResult, categories, producers]) => ({
      summary: Object.fromEntries(Object.entries(summaryResult.rows[0] || {}).map(([name, value]) => [name, Number(value) || 0])),
      facets: {
        categories: categories.rows.map((row) => ({ value: row.value, count: Number(row.count) || 0 })),
        producers: producers.rows.map((row) => ({ value: row.value, count: Number(row.count) || 0 })),
      },
    })).catch((error) => { aggregateCache.delete(key); throw error; });
    aggregateCache.set(key, { at: Date.now(), promise });
    while (aggregateCache.size > 4) aggregateCache.delete(aggregateCache.keys().next().value);
    return promise;
  };

  const query = async (raw = {}) => {
    if (!available) return { available: false, items: [], total: 0, page: 1, limit: 50, summary: {}, facets: { categories: [], producers: [] } };
    await ensureSchema(); const options = centralCatalogQueryOptions(raw), values = [ns], clauses = ['namespace=$1', "record_status<>'removed'"];
    const table = options.admin ? 'artway_products' : 'artway_storefront_products';
    const listColumn = options.admin ? 'admin_list_data' : 'list_data';
    const add = (sql, value) => { values.push(value); clauses.push(sql.replace('?', `$${values.length}`)); };
    if (!options.admin) clauses.push("record_status='active'", 'sale_available=true');
    if (options.query) add("search_vector @@ to_tsquery('simple', ?)", searchTsQuery(options.query));
    if (options.category && options.category !== 'Wszystkie') add('category=?', options.category);
    if (options.categories.length) { values.push(options.categories); clauses.push(`category=ANY($${values.length}::text[])`); }
    if (options.ids.length) { values.push(options.ids); clauses.push(`product_id=ANY($${values.length}::text[])`); }
    if (options.producer && options.producer !== 'wszyscy') add('producer=?', options.producer);
    if (options.admin) {
      if (options.status === 'active') clauses.push("record_status='active'"); else if (options.status === 'trash') clauses.push("record_status='trash'"); else if (options.status === 'duplikaty') clauses.push('duplicate_store=true');
      if (options.source === 'bazowe') clauses.push("source='bazowy'"); else if (options.source === 'wlasne') clauses.push("source IN ('dodany','import')");
      if (options.stock === 'dostepne') clauses.push('(stock IS NULL OR stock>0)'); else if (options.stock === 'niskie') clauses.push('stock BETWEEN 1 AND 5'); else if (options.stock === 'brak') clauses.push('stock=0');
      if (options.allegro === 'polaczone') clauses.push('has_allegro=true'); else if (options.allegro === 'brak') clauses.push('has_allegro=false'); else if (options.allegro === 'aktywne') clauses.push("allegro_status='ACTIVE'"); else if (options.allegro === 'szkice') clauses.push("has_allegro=true AND allegro_status<>'ACTIVE'"); else if (options.allegro === 'duplikaty') clauses.push('duplicate_allegro=true');
      const missingMap = { ean: 'ean', zdjecie: 'zdjecie', opis: 'opis', producent: 'producent', kategoria: 'kategoria', zrodlo: 'zrodlo', koszt: 'koszt' };
      if (options.data === 'gotowe') clauses.push('missing_count=0'); else if (options.data === 'braki') clauses.push('missing_count>0'); else if (missingMap[options.data]) { values.push(missingMap[options.data]); clauses.push(`missing_fields ? $${values.length}`); }
      if (options.sale === 'dostepne') clauses.push('sale_available=true'); else if (options.sale === 'niedostepne') clauses.push('sale_available=false');
      if (options.link === 'z_linkiem') clauses.push('has_source=true'); else if (options.link === 'bez_linku') clauses.push('has_source=false');
      if (options.allegroPriceMin !== null) add('allegro_price>=?', options.allegroPriceMin);
      if (options.allegroPriceMax !== null) add('allegro_price<=?', options.allegroPriceMax);
    }
    if (options.promotion === 'promocje') clauses.push('promotion=true'); else if (options.promotion === 'regularne') clauses.push('promotion=false');
    if (options.special === 'nowosci') clauses.push('new_product=true');
    if (options.minRating !== null) add('rating>=?', options.minRating);
    if (options.priceMin !== null) add('price>=?', options.priceMin);
    if (options.priceMax !== null) add('price<=?', options.priceMax);
    let effectiveSort = options.sort;
    if (!options.admin && ['stan', 'braki-danych'].includes(effectiveSort)) effectiveSort = 'external';
    const countWhere = clauses.join(' AND ');
    const countValues = [...values];
    const cursor = decodeCatalogCursor(options.cursor);
    const cursorSupported = ['external', 'id'].includes(effectiveSort);
    if (options.cursor && cursorSupported && cursor.sort === effectiveSort) {
      if (effectiveSort === 'external' && cursor.productId) {
        values.push(text(cursor.externalId, 200), text(cursor.sku, 200), text(cursor.productId, 120));
        clauses.push(`(
          COALESCE(NULLIF(external_id,''),U&'\\FFFF'),
          COALESCE(NULLIF(sku,''),U&'\\FFFF'),
          product_id
        ) > (
          COALESCE(NULLIF($${values.length - 2},''),U&'\\FFFF'),
          COALESCE(NULLIF($${values.length - 1},''),U&'\\FFFF'),
          $${values.length}
        )`);
      } else if (effectiveSort === 'id' && cursor.productId) {
        add('product_id>?', text(cursor.productId, 120));
      }
    }
    const where = clauses.join(' AND ');
    const order = {
      external: "COALESCE(NULLIF(external_id,''),U&'\\FFFF') ASC,COALESCE(NULLIF(sku,''),U&'\\FFFF') ASC,product_id ASC",
      id: 'product_id ASC',
      nazwa: 'name ASC,product_id ASC',
      producent: 'producer ASC,name ASC',
      kategoria: 'category ASC,name ASC',
      'cena-rosnaco': 'price ASC NULLS LAST,name ASC',
      'cena-malejaco': 'price DESC NULLS LAST,name ASC',
      stan: 'stock ASC NULLS LAST,name ASC',
      'braki-danych': 'missing_count DESC,name ASC',
      najnowsze: 'updated_at DESC,product_id DESC',
      ocena: 'rating DESC NULLS LAST,rating_count DESC,name ASC',
    }[effectiveSort];
    const useCursor = cursorSupported && (options.cursor || options.page === 1);
    const offset = useCursor ? 0 : (options.page - 1) * options.limit;
    const pageValues = [...values, options.limit + 1, offset];
    const limitRef = `$${values.length + 1}`, offsetRef = `$${values.length + 2}`;
    const meta = await metadata();
    const [rows, count, aggregate] = await Promise.all([
      pool.query(`SELECT ${listColumn} product,product_id,external_id,sku FROM ${table} WHERE ${where} ORDER BY ${order} LIMIT ${limitRef} OFFSET ${offsetRef}`, pageValues),
      pool.query(`SELECT COUNT(*)::bigint total FROM ${table} WHERE ${countWhere}`, countValues),
      aggregates(options.admin, meta.sourceRevision),
    ]);
    const hasMore = rows.rows.length > options.limit;
    const selectedRows = rows.rows.slice(0, options.limit);
    const last = selectedRows.at(-1);
    const nextCursor = hasMore && cursorSupported && last
      ? encodeCatalogCursor({
        version: 1,
        sort: effectiveSort,
        productId: last.product_id,
        ...(effectiveSort === 'external' ? { externalId: last.external_id, sku: last.sku } : {}),
      })
      : null;
    const total = Number(count.rows[0]?.total) || 0;
    const ids = options.admin && total <= 5000 ? (await pool.query(`SELECT product_id FROM artway_products WHERE ${countWhere} ORDER BY ${order}`, countValues)).rows.map((row) => row.product_id) : null;
    return { available: true, items: selectedRows.map((row) => row.product), ids, total, page: options.page, limit: options.limit, nextCursor, pagination: cursorSupported ? 'cursor' : 'offset', summary: aggregate.summary, facets: aggregate.facets, revision: meta.sourceRevision, syncedAt: meta.syncedAt };
  };

  const get = async (id, { admin = false } = {}) => {
    if (!available) return null;
    await ensureSchema();
    const result = admin
      ? await pool.query("SELECT data product FROM artway_products WHERE namespace=$1 AND product_id=$2 AND record_status<>'removed'", [ns, text(id, 120)])
      : await pool.query("SELECT public_data product FROM artway_storefront_products WHERE namespace=$1 AND product_id=$2 AND record_status='active' AND sale_available=true", [ns, text(id, 120)]);
    return result.rows[0]?.product || null;
  };

  /**
   * Wewnętrzny odczyt kanonicznej kartoteki. Procesy serwerowe nie mogą
   * składać produktów z localStorage, ustawień ani dawnych shardów importu.
   * Kursor po product_id utrzymuje stałe zużycie pamięci także przy 100 tys.
   * rekordów.
   */
  const listDataPage = async ({ afterId = '', limit = 500, includeTrash = true } = {}) => {
    if (!available) return { available: false, items: [], nextAfterId: null };
    await ensureSchema();
    const safeLimit = Math.max(1, Math.min(2000, Number(limit) || 500));
    const values = [ns, text(afterId, 120), safeLimit];
    const result = await pool.query(`
      SELECT product_id,data
      FROM artway_products
      WHERE namespace=$1
        AND record_status<>'removed'
        AND product_id>$2
        ${includeTrash ? '' : "AND record_status='active'"}
      ORDER BY product_id
      LIMIT $3
    `, values);
    const items = result.rows.map((row) => ({ ...asObject(row.data), id: asObject(row.data).id ?? row.product_id }));
    return {
      available: true,
      items,
      nextAfterId: items.length === safeLimit ? String(result.rows.at(-1)?.product_id || '') : null,
    };
  };

  const listDataMap = async ({ includeTrash = true, pageSize = 1000 } = {}) => {
    const products = new Map();
    let afterId = '';
    do {
      const page = await listDataPage({ afterId, limit: pageSize, includeTrash });
      for (const product of page.items) products.set(String(product.id), product);
      afterId = page.nextAfterId || '';
    } while (afterId);
    return products;
  };

  const listImportedPage = async ({ offset = 0, limit = 100 } = {}) => {
    if (!available) return { products: [], offset: 0, limit: 100, total: 0, nextOffset: null, revision: '' };
    await ensureSchema();
    const safeOffset = Math.max(0, Number(offset) || 0), safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
    const [rows, count, meta] = await Promise.all([
      pool.query(`
        SELECT data
        FROM artway_products
        WHERE namespace=$1 AND record_status<>'removed'
          AND (source='import' OR data->>'storageOrigin'='product-link-file-import')
        ORDER BY product_id
        LIMIT $2 OFFSET $3
      `, [ns, safeLimit, safeOffset]),
      pool.query(`
        SELECT COUNT(*)::bigint total
        FROM artway_products
        WHERE namespace=$1 AND record_status<>'removed'
          AND (source='import' OR data->>'storageOrigin'='product-link-file-import')
      `, [ns]),
      metadata(),
    ]);
    const total = Number(count.rows[0]?.total) || 0;
    return {
      products: rows.rows.map((row) => asObject(row.data)),
      offset: safeOffset,
      limit: safeLimit,
      total,
      nextOffset: safeOffset + safeLimit < total ? safeOffset + safeLimit : null,
      revision: meta.sourceRevision || String(meta.syncedAt || ''),
    };
  };

  const listImported = async () => {
    const products = [];
    let offset = 0;
    do {
      const page = await listImportedPage({ offset, limit: 500 });
      products.push(...page.products);
      offset = page.nextOffset;
    } while (offset !== null);
    return products;
  };

  const findImportedProductMatch = async ({
    importItemKey = '', product = {}, sourceUrl = '',
  } = {}) => {
    if (!available) return null;
    await ensureSchema();
    const source = asObject(product);
    const itemKey = text(importItemKey, 240);
    const url = text(sourceUrl || source.sourceUrl || source.producentUrl, 3000);
    const ean = text(source.gtin || source.ean, 80).replace(/\D/g, '');
    const externalId = text(source.externalId || source.sku, 200);
    const producer = normalize(source.producent || source.marka).replace(/\s+/g, '');
    const producerCode = normalize(source.kodProducenta || source.mpn).replace(/\s+/g, '');
    if (![itemKey, url, ean, externalId, producer && producerCode].some(Boolean)) return null;
    const result = await pool.query(`
      SELECT data,
        CASE
          WHEN $2<>'' AND data->>'importItemKey'=$2 THEN 'import_item_key'
          WHEN $3<>'' AND (data->>'sourceUrl'=$3 OR data->>'producentUrl'=$3) THEN 'source_url'
          WHEN $4<>'' AND ean=$4 THEN 'gtin'
          WHEN $5<>'' AND (external_id=$5 OR sku=$5) THEN 'external_id'
          ELSE 'manufacturer_code'
        END reason
      FROM artway_products
      WHERE namespace=$1 AND record_status<>'removed' AND (
        ($2<>'' AND data->>'importItemKey'=$2)
        OR ($3<>'' AND (data->>'sourceUrl'=$3 OR data->>'producentUrl'=$3))
        OR ($4<>'' AND ean=$4)
        OR ($5<>'' AND (external_id=$5 OR sku=$5))
        OR (
          $6<>'' AND $7<>''
          AND regexp_replace(lower(producer),'[^a-z0-9]+','','g')=$6
          AND regexp_replace(lower(COALESCE(data->>'kodProducenta',data->>'mpn','')),'[^a-z0-9]+','','g')=$7
        )
      )
      ORDER BY updated_at DESC
      LIMIT 1
    `, [ns, itemKey, url, ean, externalId, producer, producerCode]);
    return result.rowCount
      ? { product: asObject(result.rows[0].data), reason: result.rows[0].reason }
      : null;
  };

  const nextImportedProductId = async () => {
    if (!available) throw new Error('Centralna kartoteka nie jest dostępna.');
    await ensureSchema();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO artway_product_sequences(namespace,sequence_name,next_value)
        SELECT $1,'imported-product',
          GREATEST(1000000,COALESCE(MAX(product_id::bigint)+1,1000000))
        FROM artway_products
        WHERE namespace=$1 AND product_id~'^[0-9]+$'
        ON CONFLICT(namespace,sequence_name) DO NOTHING
      `, [ns]);
      const result = await client.query(`
        UPDATE artway_product_sequences
        SET next_value=next_value+1,updated_at=NOW()
        WHERE namespace=$1 AND sequence_name='imported-product'
        RETURNING next_value-1 product_id
      `, [ns]);
      await client.query('COMMIT');
      return Number(result.rows[0]?.product_id);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  };

  const {
    upsertProduct, upsertImportedProduct, setRecordStatus, purgeProduct,
    patchProductFields,
  } = createCentralProductMutations({
    available, ensureSchema, text, pool, ns, centralCatalogBuildRecords,
    asObject, asArray, own, stableJson, centralCatalogListProduct,
    produktBezDanychPrywatnych, CENTRAL_PRODUCT_SCHEMA_VERSION,
    aggregateCache, CENTRAL_PRODUCT_DERIVED_FIELDS, numberOrNull, normalize,
    centralCatalogMissingFields, crypto,
  });

  return Object.freeze({
    available,
    ensureSchema,
    metadata,
    synchronize,
    query,
    get,
    listDataPage,
    listDataMap,
    listImported,
    listImportedPage,
    findImportedProductMatch,
    nextImportedProductId,
    upsertProduct,
    upsertImportedProduct,
    setRecordStatus,
    purgeProduct,
    patchProductFields,
  });
}
