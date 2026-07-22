import crypto from 'node:crypto';
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

export const CENTRAL_PRODUCT_SCHEMA_VERSION = 3;

function centralCatalogListProduct(product = {}, catalogMeta = {}, { admin = false } = {}) {
  const fields = [
    'id', 'nazwa', 'name', 'cena', 'cenaAllegro', 'staraCena', 'kategoria', 'producent', 'marka',
    'externalId', 'sku', 'gtin', 'ean', 'kodProducenta', 'mpn', 'zdjecie', 'ikona', 'kolor',
    'sourceUrl', 'producentUrl', 'urlProducenta', 'allegroOfferId', 'allegroProductId', 'badge',
    'opisKrotki', 'krotkiOpis', 'warianty', 'agentOnboardingStatus', 'allegroAgentPreparationStatus',
    'allegroAgentPreparationMissing', 'allegroAgentPreparedAt', 'allegroEditorialSyncState',
  ];
  if (admin) fields.push('cenaZakupu');
  const result = {};
  for (const field of fields) if (Object.prototype.hasOwnProperty.call(product, field)) result[field] = product[field];
  result.id = text(product.id, 120);
  result._catalog = catalogMeta;
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

export function centralCatalogBuildRecords(data = {}, { importedProducts = [], offers = [], mappings = {}, sourceRevision = '' } = {}) {
  const merged = mergeCatalogProducts(data, importedProducts), addedIds = new Set(asArray(data.artway_produkty_dodane).map((product) => String(product?.id))), importedIds = new Set(asArray(importedProducts).map((product) => String(product?.id)));
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
    const unavailable = ['niedostepny', 'ukryty', 'wstrzymany', 'brak'].includes(text(availabilityData.status || availabilityData.decision).toLowerCase()) || product.aktywny === false;
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
      price: numberOrNull(product.cena), allegroPrice: numberOrNull(product.cenaAllegro || product.cena), promotion: Number(product.staraCena) > Number(product.cena), newProduct: text(product.badge, 80).toLowerCase() === 'nowość', rating: reviews.count ? reviews.sum / reviews.count : null, ratingCount: reviews.count,
      duplicateStore: catalogIdentityKeys(product).some((key) => (identityCounts.get(key) || 0) > 1), duplicateAllegro: activeOffers.length > 1,
      fingerprint: crypto.createHash('sha256').update(JSON.stringify(adminProduct)).digest('hex'), updatedAt: now, image,
    };
  }).filter(Boolean);
}

export function centralCatalogQueryOptions(raw = {}) {
  const allowedSort = new Set(['external', 'id', 'nazwa', 'producent', 'kategoria', 'cena-rosnaco', 'cena-malejaco', 'stan', 'braki-danych', 'najnowsze', 'ocena']);
  const list = (value, max = 1000) => [...new Set((Array.isArray(value) ? value : String(value || '').split(',')).map((item) => text(item, 300)).filter(Boolean))].slice(0, max);
  return {
    query: normalize(raw.query || raw.q), category: text(raw.category, 300), producer: text(raw.producer, 300), status: text(raw.status || 'active', 40), source: text(raw.source || 'wszystkie', 40), stock: text(raw.stock || 'wszystkie', 40), allegro: text(raw.allegro || 'wszystkie', 40), data: text(raw.data || 'wszystkie', 40), sale: text(raw.sale || 'wszystkie', 40), promotion: text(raw.promotion || 'wszystkie', 40), link: text(raw.link || 'wszystkie', 40),
    categories: list(raw.categories, 200), ids: list(raw.ids, 1000), special: text(raw.special, 40), minRating: numberOrNull(raw.minRating),
    priceMin: numberOrNull(raw.priceMin), priceMax: numberOrNull(raw.priceMax), allegroPriceMin: numberOrNull(raw.allegroPriceMin), allegroPriceMax: numberOrNull(raw.allegroPriceMax),
    sort: allowedSort.has(String(raw.sort)) ? String(raw.sort) : 'external', page: Math.max(1, Number(raw.page) || 1), limit: Math.max(1, Math.min(1000, Number(raw.limit) || 50)), admin: raw.admin === true,
  };
}

export function createCentralProductCatalog({ pool, namespace = 'artway-sklep' } = {}) {
  const available = !!pool, ns = text(namespace, 120) || 'artway-sklep'; let schemaPromise = null;
  const aggregateCache = new Map();
  const ensureSchema = async () => {
    if (!available) return false;
    if (!schemaPromise) schemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS artway_products (
        namespace TEXT NOT NULL, product_id TEXT NOT NULL, data JSONB NOT NULL, public_data JSONB NOT NULL, admin_list_data JSONB NOT NULL DEFAULT '{}'::jsonb, public_list_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        name TEXT NOT NULL DEFAULT '', search_text TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', producer TEXT NOT NULL DEFAULT '',
        external_id TEXT NOT NULL DEFAULT '', sku TEXT NOT NULL DEFAULT '', ean TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'bazowy',
        record_status TEXT NOT NULL DEFAULT 'active', stock NUMERIC NULL, sale_available BOOLEAN NOT NULL DEFAULT TRUE, has_source BOOLEAN NOT NULL DEFAULT FALSE,
        has_allegro BOOLEAN NOT NULL DEFAULT FALSE, allegro_status TEXT NOT NULL DEFAULT '', missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb, missing_count INTEGER NOT NULL DEFAULT 0,
        price NUMERIC NULL, allegro_price NUMERIC NULL, promotion BOOLEAN NOT NULL DEFAULT FALSE, new_product BOOLEAN NOT NULL DEFAULT FALSE, rating NUMERIC NULL, rating_count INTEGER NOT NULL DEFAULT 0, duplicate_store BOOLEAN NOT NULL DEFAULT FALSE, duplicate_allegro BOOLEAN NOT NULL DEFAULT FALSE,
        fingerprint TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(namespace, product_id)
      );
      ALTER TABLE artway_products ADD COLUMN IF NOT EXISTS admin_list_data JSONB NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE artway_products ADD COLUMN IF NOT EXISTS public_list_data JSONB NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE artway_products ADD COLUMN IF NOT EXISTS new_product BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE artway_products ADD COLUMN IF NOT EXISTS rating NUMERIC NULL;
      ALTER TABLE artway_products ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE artway_products ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', search_text)) STORED;
      CREATE INDEX IF NOT EXISTS artway_products_search_idx ON artway_products(namespace, search_text text_pattern_ops);
      CREATE INDEX IF NOT EXISTS artway_products_category_idx ON artway_products(namespace, category);
      CREATE INDEX IF NOT EXISTS artway_products_producer_idx ON artway_products(namespace, producer);
      CREATE INDEX IF NOT EXISTS artway_products_status_idx ON artway_products(namespace, record_status, sale_available);
      CREATE INDEX IF NOT EXISTS artway_products_external_idx ON artway_products(namespace, external_id, sku, ean);
      CREATE INDEX IF NOT EXISTS artway_products_price_idx ON artway_products(namespace, price) WHERE record_status='active';
      CREATE INDEX IF NOT EXISTS artway_products_allegro_price_idx ON artway_products(namespace, allegro_price) WHERE record_status='active';
      CREATE INDEX IF NOT EXISTS artway_products_stock_idx ON artway_products(namespace, stock) WHERE record_status='active';
      CREATE INDEX IF NOT EXISTS artway_products_missing_idx ON artway_products(namespace, missing_count) WHERE record_status='active';
      CREATE INDEX IF NOT EXISTS artway_products_updated_idx ON artway_products(namespace, updated_at DESC) WHERE record_status='active';
      CREATE INDEX IF NOT EXISTS artway_products_channel_idx ON artway_products(namespace, has_allegro, allegro_status) WHERE record_status='active';
      CREATE INDEX IF NOT EXISTS artway_products_public_sort_idx ON artway_products(namespace, new_product, rating DESC) WHERE record_status='active' AND sale_available=true;
      CREATE INDEX IF NOT EXISTS artway_products_search_vector_idx ON artway_products USING GIN(search_vector);
      CREATE TABLE IF NOT EXISTS artway_product_catalog_meta (
        namespace TEXT PRIMARY KEY, schema_version INTEGER NOT NULL DEFAULT 1, source_revision TEXT NOT NULL DEFAULT '', product_count INTEGER NOT NULL DEFAULT 0, synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).then(() => true);
    return schemaPromise;
  };

  const metadata = async () => {
    if (!available) return { available: false, count: 0, sourceRevision: '', syncedAt: null };
    await ensureSchema(); const result = await pool.query('SELECT schema_version, source_revision, product_count, synced_at FROM artway_product_catalog_meta WHERE namespace=$1', [ns]);
    if (!result.rowCount) return { available: true, count: 0, schemaVersion: 0, outdated: true, sourceRevision: '', syncedAt: null };
    const schemaVersion = Number(result.rows[0].schema_version) || 0;
    return { available: true, count: Number(result.rows[0].product_count) || 0, schemaVersion, outdated: schemaVersion !== CENTRAL_PRODUCT_SCHEMA_VERSION, sourceRevision: result.rows[0].source_revision || '', syncedAt: result.rows[0].synced_at };
  };

  const synchronize = async (data = {}, context = {}) => {
    if (!available) return { available: false, synchronized: false, count: 0 };
    await ensureSchema(); const sourceRevision = text(context.sourceRevision, 300), records = centralCatalogBuildRecords(data, { ...context, sourceRevision });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('CREATE TEMP TABLE artway_product_sync_ids(product_id TEXT PRIMARY KEY) ON COMMIT DROP');
      for (let start = 0; start < records.length; start += 500) {
        const batch = records.slice(start, start + 500);
        await client.query(`WITH payload AS (SELECT value item FROM jsonb_array_elements($1::jsonb)) INSERT INTO artway_product_sync_ids(product_id) SELECT item->>'id' FROM payload ON CONFLICT DO NOTHING`, [JSON.stringify(batch)]);
        await client.query(`
          WITH payload AS (SELECT value item FROM jsonb_array_elements($2::jsonb))
          INSERT INTO artway_products(namespace,product_id,data,public_data,admin_list_data,public_list_data,name,search_text,category,producer,external_id,sku,ean,source,record_status,stock,sale_available,has_source,has_allegro,allegro_status,missing_fields,missing_count,price,allegro_price,promotion,new_product,rating,rating_count,duplicate_store,duplicate_allegro,fingerprint,updated_at)
          SELECT $1,item->>'id',item->'data',item->'publicData',item->'adminListData',item->'publicListData',item->>'name',item->>'searchText',item->>'category',item->>'producer',item->>'externalId',item->>'sku',item->>'ean',item->>'source',item->>'recordStatus',NULLIF(item->>'stock','')::numeric,COALESCE((item->>'saleAvailable')::boolean,false),COALESCE((item->>'hasSource')::boolean,false),COALESCE((item->>'hasAllegro')::boolean,false),item->>'allegroStatus',item->'missingFields',COALESCE((item->>'missingCount')::integer,0),NULLIF(item->>'price','')::numeric,NULLIF(item->>'allegroPrice','')::numeric,COALESCE((item->>'promotion')::boolean,false),COALESCE((item->>'newProduct')::boolean,false),NULLIF(item->>'rating','')::numeric,COALESCE((item->>'ratingCount')::integer,0),COALESCE((item->>'duplicateStore')::boolean,false),COALESCE((item->>'duplicateAllegro')::boolean,false),item->>'fingerprint',NOW() FROM payload
          ON CONFLICT(namespace,product_id) DO UPDATE SET data=EXCLUDED.data,public_data=EXCLUDED.public_data,admin_list_data=EXCLUDED.admin_list_data,public_list_data=EXCLUDED.public_list_data,name=EXCLUDED.name,search_text=EXCLUDED.search_text,category=EXCLUDED.category,producer=EXCLUDED.producer,external_id=EXCLUDED.external_id,sku=EXCLUDED.sku,ean=EXCLUDED.ean,source=EXCLUDED.source,record_status=EXCLUDED.record_status,stock=EXCLUDED.stock,sale_available=EXCLUDED.sale_available,has_source=EXCLUDED.has_source,has_allegro=EXCLUDED.has_allegro,allegro_status=EXCLUDED.allegro_status,missing_fields=EXCLUDED.missing_fields,missing_count=EXCLUDED.missing_count,price=EXCLUDED.price,allegro_price=EXCLUDED.allegro_price,promotion=EXCLUDED.promotion,new_product=EXCLUDED.new_product,rating=EXCLUDED.rating,rating_count=EXCLUDED.rating_count,duplicate_store=EXCLUDED.duplicate_store,duplicate_allegro=EXCLUDED.duplicate_allegro,fingerprint=EXCLUDED.fingerprint,updated_at=CASE WHEN artway_products.fingerprint<>EXCLUDED.fingerprint THEN NOW() ELSE artway_products.updated_at END
        `, [ns, JSON.stringify(batch)]);
      }
      await client.query("UPDATE artway_products p SET record_status='removed',sale_available=false,updated_at=NOW() WHERE p.namespace=$1 AND NOT EXISTS(SELECT 1 FROM artway_product_sync_ids s WHERE s.product_id=p.product_id)", [ns]);
      await client.query(`INSERT INTO artway_product_catalog_meta(namespace,schema_version,source_revision,product_count,synced_at) VALUES($1,$2,$3,$4,NOW()) ON CONFLICT(namespace) DO UPDATE SET schema_version=EXCLUDED.schema_version,source_revision=EXCLUDED.source_revision,product_count=EXCLUDED.product_count,synced_at=NOW()`, [ns, CENTRAL_PRODUCT_SCHEMA_VERSION, sourceRevision, records.length]);
      await client.query('COMMIT'); aggregateCache.clear(); return { available: true, synchronized: true, count: records.length, sourceRevision };
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); }
  };

  const aggregates = async (admin, revision = '') => {
    const key = `${admin ? 'admin' : 'public'}:${revision}`;
    const cached = aggregateCache.get(key);
    if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.promise;
    const audienceWhere = admin ? "namespace=$1 AND record_status<>'removed'" : "namespace=$1 AND record_status='active' AND sale_available=true";
    const promise = Promise.all([
      pool.query(`SELECT COUNT(*)::bigint total,COUNT(*) FILTER(WHERE record_status='active')::bigint active,COUNT(*) FILTER(WHERE record_status='trash')::bigint trash,COUNT(*) FILTER(WHERE sale_available=false AND record_status='active')::bigint hidden,COUNT(*) FILTER(WHERE missing_count>0 AND record_status='active')::bigint missing,COUNT(*) FILTER(WHERE missing_count=0 AND sale_available=true AND record_status='active')::bigint ready,COUNT(*) FILTER(WHERE has_allegro=true AND record_status='active')::bigint connected,COUNT(*) FILTER(WHERE promotion=true AND record_status='active')::bigint promotions,COUNT(*) FILTER(WHERE new_product=true AND record_status='active')::bigint new_products,COUNT(*) FILTER(WHERE duplicate_store=true AND record_status='active')::bigint duplicate_store,COUNT(*) FILTER(WHERE duplicate_allegro=true AND record_status='active')::bigint duplicate_allegro FROM artway_products WHERE ${audienceWhere}`, [ns]),
      pool.query(`SELECT category value,COUNT(*)::bigint count FROM artway_products WHERE ${audienceWhere} AND category<>'' GROUP BY category ORDER BY category`, [ns]),
      pool.query(`SELECT producer value,COUNT(*)::bigint count FROM artway_products WHERE ${audienceWhere} AND producer<>'' GROUP BY producer ORDER BY producer`, [ns]),
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
    const add = (sql, value) => { values.push(value); clauses.push(sql.replace('?', `$${values.length}`)); };
    if (!options.admin) clauses.push("record_status='active'", 'sale_available=true');
    if (options.query) add("search_vector @@ to_tsquery('simple', ?)", searchTsQuery(options.query));
    if (options.category && options.category !== 'Wszystkie') add('category=?', options.category);
    if (options.categories.length) { values.push(options.categories); clauses.push(`category=ANY($${values.length}::text[])`); }
    if (options.ids.length) { values.push(options.ids); clauses.push(`product_id=ANY($${values.length}::text[])`); }
    if (options.producer && options.producer !== 'wszyscy') add('producer=?', options.producer);
    if (options.status === 'active') clauses.push("record_status='active'"); else if (options.status === 'trash') clauses.push("record_status='trash'"); else if (options.status === 'duplikaty') clauses.push('duplicate_store=true');
    if (options.source === 'bazowe') clauses.push("source='bazowy'"); else if (options.source === 'wlasne') clauses.push("source IN ('dodany','import')");
    if (options.stock === 'dostepne') clauses.push('(stock IS NULL OR stock>0)'); else if (options.stock === 'niskie') clauses.push('stock BETWEEN 1 AND 5'); else if (options.stock === 'brak') clauses.push('stock=0');
    if (options.allegro === 'polaczone') clauses.push('has_allegro=true'); else if (options.allegro === 'brak') clauses.push('has_allegro=false'); else if (options.allegro === 'aktywne') clauses.push("allegro_status='ACTIVE'"); else if (options.allegro === 'szkice') clauses.push("has_allegro=true AND allegro_status<>'ACTIVE'"); else if (options.allegro === 'duplikaty') clauses.push('duplicate_allegro=true');
    const missingMap = { ean: 'ean', zdjecie: 'zdjecie', opis: 'opis', producent: 'producent', kategoria: 'kategoria', zrodlo: 'zrodlo', koszt: 'koszt' };
    if (options.data === 'gotowe') clauses.push('missing_count=0'); else if (options.data === 'braki') clauses.push('missing_count>0'); else if (missingMap[options.data]) { values.push(missingMap[options.data]); clauses.push(`missing_fields ? $${values.length}`); }
    if (options.sale === 'dostepne') clauses.push('sale_available=true'); else if (options.sale === 'niedostepne') clauses.push('sale_available=false');
    if (options.promotion === 'promocje') clauses.push('promotion=true'); else if (options.promotion === 'regularne') clauses.push('promotion=false');
    if (options.special === 'nowosci') clauses.push('new_product=true');
    if (options.minRating !== null) add('rating>=?', options.minRating);
    if (options.link === 'z_linkiem') clauses.push('has_source=true'); else if (options.link === 'bez_linku') clauses.push('has_source=false');
    if (options.priceMin !== null) add('price>=?', options.priceMin); if (options.priceMax !== null) add('price<=?', options.priceMax); if (options.allegroPriceMin !== null) add('allegro_price>=?', options.allegroPriceMin); if (options.allegroPriceMax !== null) add('allegro_price<=?', options.allegroPriceMax);
    const where = clauses.join(' AND '), order = { external:"NULLIF(external_id,'') ASC NULLS LAST,NULLIF(sku,'') ASC NULLS LAST,product_id ASC", id:'product_id ASC', nazwa:'name ASC,product_id ASC', producent:'producer ASC,name ASC', kategoria:'category ASC,name ASC', 'cena-rosnaco':'price ASC NULLS LAST,name ASC', 'cena-malejaco':'price DESC NULLS LAST,name ASC', stan:'stock ASC NULLS LAST,name ASC', 'braki-danych':'missing_count DESC,name ASC', najnowsze:'updated_at DESC,product_id DESC', ocena:'rating DESC NULLS LAST,rating_count DESC,name ASC' }[options.sort];
    const offset = (options.page - 1) * options.limit, pageValues = [...values, options.limit, offset], limitRef = `$${values.length + 1}`, offsetRef = `$${values.length + 2}`;
    const meta = await metadata();
    const [rows, count, aggregate] = await Promise.all([
      pool.query(`SELECT ${options.admin ? 'admin_list_data' : 'public_list_data'} product FROM artway_products WHERE ${where} ORDER BY ${order} LIMIT ${limitRef} OFFSET ${offsetRef}`, pageValues),
      pool.query(`SELECT COUNT(*)::bigint total FROM artway_products WHERE ${where}`, values),
      aggregates(options.admin, meta.sourceRevision),
    ]);
    const total = Number(count.rows[0]?.total) || 0;
    const ids = options.admin && total <= 5000 ? (await pool.query(`SELECT product_id FROM artway_products WHERE ${where} ORDER BY ${order}`, values)).rows.map((row) => row.product_id) : null;
    return { available: true, items: rows.rows.map((row) => row.product), ids, total, page: options.page, limit: options.limit, summary: aggregate.summary, facets: aggregate.facets, revision: meta.sourceRevision, syncedAt: meta.syncedAt };
  };

  const get = async (id, { admin = false } = {}) => {
    if (!available) return null; await ensureSchema(); const result = await pool.query(`SELECT ${admin ? 'data' : 'public_data'} product FROM artway_products WHERE namespace=$1 AND product_id=$2 AND record_status<>'removed'${admin ? '' : " AND record_status='active' AND sale_available=true"}`, [ns, text(id, 120)]); return result.rows[0]?.product || null;
  };
  return Object.freeze({ available, ensureSchema, metadata, synchronize, query, get });
}
