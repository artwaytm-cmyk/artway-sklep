export const ALLEGRO_GALLERY_LIMIT = 16;

const url = (value = '') => String(value ?? '').trim().slice(0, 3000);

function uniqueUrls(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(url).filter(Boolean))];
}

/**
 * Allegro liczy do jednego limitu zdjęcia oferty i zdjęcia automatycznie
 * dołączone z produktu katalogowego. Dla product.id rezerwujemy najpierw
 * miejsce na galerię katalogu, a dopiero pozostałe sloty oddajemy zdjęciom
 * Artway. Gdy API nie zwróciło listy zdjęć katalogowych, nie zgadujemy ich
 * liczby i pozostawiamy galerię produktowi katalogowemu.
 */
export function allegroGalleryBudget({ offerImages = [], catalogImages = [], catalogProductId = '' } = {}) {
  const catalog = uniqueUrls(catalogImages).slice(0, ALLEGRO_GALLERY_LIMIT);
  const catalogSet = new Set(catalog);
  const own = uniqueUrls(offerImages).filter((item) => !catalogSet.has(item));
  const usesCatalog = Boolean(String(catalogProductId || '').trim());
  const reservedForCatalog = usesCatalog
    ? (catalog.length || ALLEGRO_GALLERY_LIMIT)
    : 0;
  const ownLimit = Math.max(0, ALLEGRO_GALLERY_LIMIT - reservedForCatalog);
  const images = own.slice(0, ownLimit);
  return {
    images,
    catalogImages: catalog,
    catalogImageCount: catalog.length,
    ownImageCount: images.length,
    omittedOwnImageCount: Math.max(0, own.length - images.length),
    reservedForCatalog,
    totalExpected: Math.min(ALLEGRO_GALLERY_LIMIT, reservedForCatalog + images.length),
    mode: usesCatalog ? 'catalog_first' : 'offer_only',
  };
}
