import { createStoreRepository } from '../core/store-repository.mjs';
import { postgresPoolFor } from '../core/postgres-store-repository.mjs';
import { createCentralProductCatalog } from './central-product-catalog.mjs';
import { mergeCatalogProducts } from './catalog-quality.mjs';
import { seoProductUnavailable } from './seo-catalog.mjs';

const repository = createStoreRepository({ name: 'artway-sklep' });
const centralCatalog = createCentralProductCatalog({
  pool: String(process.env.ARTWAY_STORE_DRIVER || '').trim().toLowerCase() === 'postgres' && process.env.DATABASE_URL
    ? postgresPoolFor(process.env.DATABASE_URL)
    : null,
  namespace: 'artway-sklep',
});

function hiddenProductIds(data = {}) {
  return new Set([
    ...(Array.isArray(data.artway_produkty_ukryte) ? data.artway_produkty_ukryte : []),
    ...(Array.isArray(data.artway_produkty_definitywne) ? data.artway_produkty_definitywne : []),
    ...(Array.isArray(data.artway_kosz_dodane) ? data.artway_kosz_dodane.map((product) => product?.id) : []),
  ].map(String));
}

const duplicateKey = (value) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '');
function productDuplicateKeys(product = {}) {
  const keys = [], add = (type, value) => { const key = duplicateKey(value); if (key) keys.push(`${type}:${key}`); };
  add('external', product.externalId);
  add('sku', product.sku);
  add('ean', product.gtin || product.ean);
  add('mpn', product.kodProducenta || product.mpn);
  if (!keys.length && product.nazwa) add('nazwa', `${product.producent || product.marka || ''}:${product.nazwa}`);
  return [...new Set(keys)];
}
const productCompleteness = (product = {}) => [product.externalId, product.sku, product.gtin || product.ean, product.kodProducenta || product.mpn, product.producent || product.marka, product.zdjecie, product.opis, Number(product.cena) > 0].filter(Boolean).length;

function canonicalizeSeoDuplicates(products = [], choices = {}) {
  const parent = new Map(products.map((product) => [String(product.id), String(product.id)]));
  const owner = new Map(), shared = new Map();
  const find = (id) => { let current = String(id); while (parent.get(current) !== current) { parent.set(current, parent.get(parent.get(current))); current = parent.get(current); } return current; };
  const union = (a, b, key) => {
    const rootA = find(a), rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
    if (!shared.has(key)) shared.set(key, new Set());
    shared.get(key).add(String(a)); shared.get(key).add(String(b));
  };
  for (const product of products) for (const key of productDuplicateKeys(product)) {
    if (owner.has(key)) union(product.id, owner.get(key), key);
    else owner.set(key, String(product.id));
  }
  const groups = new Map();
  for (const product of products) {
    const root = find(product.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(product);
  }
  const canonicalById = new Map();
  let duplicateGroups = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    duplicateGroups += 1;
    const ids = new Set(group.map((product) => String(product.id)));
    const keys = [...shared.entries()].filter(([, set]) => [...set].some((id) => ids.has(id))).map(([key]) => key).sort();
    const groupKey = keys[0] || `ids:${[...ids].sort().join('-')}`;
    const selected = group.find((product) => String(product.id) === String(choices[groupKey] || ''));
    const canonical = selected || [...group].sort((a, b) => productCompleteness(b) - productCompleteness(a)
      || String(a.externalId || a.sku || a.gtin || a.id).localeCompare(String(b.externalId || b.sku || b.gtin || b.id), 'pl', { numeric: true })
      || Number(a.id) - Number(b.id))[0];
    for (const product of group) if (String(product.id) !== String(canonical.id)) canonicalById.set(String(product.id), String(canonical.id));
  }
  return { canonicalById, duplicateGroups };
}

export function buildStorefrontSeoCatalogSnapshot({
  data = {},
  updatedAt = null,
  canonicalProducts: centralProducts = [],
} = {}) {
  const hidden = hiddenProductIds(data);
  const fallbackProducts = mergeCatalogProducts(data).activeProducts;
  const source = Array.isArray(centralProducts) && centralProducts.length
    ? centralProducts
    : fallbackProducts;
  const pageProducts = source
    .filter((product) => product?.id != null && !hidden.has(String(product.id)) && Number(product.cena) > 0)
    .map((product) => ({
      ...product,
      __saleUnavailable: product?._catalog?.availability?.saleAvailable === false
        || seoProductUnavailable(data, product),
    }));
  const choices = data.artway_ustawienia?.kanoniczneDuplikatySklepu && typeof data.artway_ustawienia.kanoniczneDuplikatySklepu === 'object'
    ? data.artway_ustawienia.kanoniczneDuplikatySklepu : {};
  const duplicates = canonicalizeSeoDuplicates(pageProducts, choices);
  const canonicalProducts = pageProducts.filter((product) => !duplicates.canonicalById.has(String(product.id)));
  // Produkt czasowo wyprzedany zachowuje kartę, canonical i historię adresu.
  // Google Merchant Center również oczekuje w takim przypadku zmiany
  // availability na out_of_stock zamiast usuwania produktu z danych źródłowych.
  const indexableProducts = canonicalProducts;
  const sellableProducts = canonicalProducts.filter((product) => product.__saleUnavailable !== true);
  return {
    data,
    updatedAt,
    source: centralProducts.length ? 'central-postgres' : 'legacy-fallback',
    pageProducts,
    indexableProducts,
    sellableProducts,
    duplicateCanonicalById: duplicates.canonicalById,
    duplicateGroups: duplicates.duplicateGroups,
  };
}

export async function loadStorefrontSeoCatalog() {
  let settings = { data: {}, updated_at: null };
  try {
    settings = await repository.read('settings', settings);
  } catch {
    // Brak ustawień nie może wyłączyć kart z centralnego katalogu.
  }
  let canonicalProducts = [];
  if (centralCatalog.available) {
    try {
      canonicalProducts = [...(await centralCatalog.listDataMap({ includeTrash: false })).values()];
    } catch {
      // Awaria bazy przełącza rendering na zgodny snapshot ustawień.
    }
  }
  const data = settings?.data && typeof settings.data === 'object' ? settings.data : {};
  return buildStorefrontSeoCatalogSnapshot({
    data,
    updatedAt: settings?.updated_at || null,
    canonicalProducts,
  });
}

export async function loadStorefrontSeoProductsByIds(productIds = []) {
  const ids = [...new Set((Array.isArray(productIds) ? productIds : [])
    .map((id) => String(id ?? '').trim())
    .filter(Boolean))].slice(0, 100);
  if (!ids.length) return [];
  let settings = { data: {} };
  try {
    settings = await repository.read('settings', settings);
  } catch {
    // Aktywny katalog PostgreSQL pozostaje źródłem prawdy bez ustawień pomocniczych.
  }
  const data = settings?.data && typeof settings.data === 'object' ? settings.data : {};
  const hidden = hiddenProductIds(data);
  const prepare = (products) => products
    .filter((product) => product?.id != null && !hidden.has(String(product.id)) && Number(product.cena) > 0)
    .map((product) => ({
      ...product,
      __saleUnavailable: product?._catalog?.availability?.saleAvailable === false
        || seoProductUnavailable(data, product),
    }));
  if (centralCatalog.available) {
    try {
      const page = await centralCatalog.query({ ids, admin: true, status: 'active', sort: 'id', limit: ids.length });
      if (page.available) return prepare(page.items);
    } catch {
      // Awaria bazy korzysta z istniejącego snapshotu ustawień.
    }
  }
  const fallback = new Map(mergeCatalogProducts(data).activeProducts.map((product) => [String(product.id), product]));
  return prepare(ids.map((id) => fallback.get(id)));
}
