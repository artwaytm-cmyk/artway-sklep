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

export function buildStorefrontSeoCatalogSnapshot({
  data = {},
  updatedAt = null,
  canonicalProducts = [],
} = {}) {
  const hidden = hiddenProductIds(data);
  const fallbackProducts = mergeCatalogProducts(data).activeProducts;
  const source = Array.isArray(canonicalProducts) && canonicalProducts.length
    ? canonicalProducts
    : fallbackProducts;
  const pageProducts = source
    .filter((product) => product?.id != null && !hidden.has(String(product.id)) && Number(product.cena) > 0)
    .map((product) => ({
      ...product,
      __saleUnavailable: product?._catalog?.availability?.saleAvailable === false
        || seoProductUnavailable(data, product),
    }));
  const indexableProducts = pageProducts.filter((product) => product.__saleUnavailable !== true);
  return {
    data,
    updatedAt,
    source: canonicalProducts.length ? 'central-postgres' : 'legacy-fallback',
    pageProducts,
    indexableProducts,
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
