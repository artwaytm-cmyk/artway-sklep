const list = (value) => (Array.isArray(value) ? value : []);
const count = (value) => Math.max(0, Number(value) || 0);
const text = (value = '') => String(value ?? '').trim();
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const own = (value, key) => Object.prototype.hasOwnProperty.call(object(value), key);

/**
 * Zwraca jeden, aktualny obraz stanu używany przez realizację zamówień.
 * Kanoniczna kartoteka produktu ma pierwszeństwo przed starszą kopią ustawień,
 * ponieważ dokument PZ/WZ aktualizuje ją razem ze stanem i lokalizacją.
 */
export function resolveWarehouseInventory(product = {}, {
  legacyStockKnown = false,
  legacyStock = null,
  legacyMeta = {},
} = {}) {
  const catalog = object(product?._catalog);
  const inventory = object(catalog.inventory);
  const productStockKnown = own(product, 'stan')
    && product.stan !== null
    && product.stan !== ''
    && Number.isFinite(Number(product.stan));
  const catalogStockKnown = own(inventory, 'stock')
    && inventory.stock !== null
    && inventory.stock !== ''
    && Number.isFinite(Number(inventory.stock));
  const stockKnown = productStockKnown || catalogStockKnown || legacyStockKnown === true;
  const rawStock = productStockKnown
    ? product.stan
    : catalogStockKnown
      ? inventory.stock
      : legacyStock;
  const stock = stockKnown ? count(rawStock) : 0;
  const meta = object(legacyMeta);
  return {
    stockKnown,
    stock,
    location: text(inventory.lokalizacja || inventory.location || product.lokalizacja || product.location || meta.lokalizacja || meta.location),
    supplier: text(inventory.dostawca || inventory.supplier || product.dostawca || product.supplier || meta.dostawca || meta.supplier),
    source: productStockKnown || catalogStockKnown ? 'central_product_catalog' : legacyStockKnown ? 'legacy_settings' : 'unknown',
  };
}

/**
 * Klasyfikuje wyłącznie decyzję realizacyjną. Lokalizacja jest informacją
 * magazynową i nigdy nie zamienia dostępnego towaru w brak zakupowy.
 */
export function classifyWarehousePosition({ matched = true, stockKnown = true, shortage = 0, location = '' } = {}) {
  if (!matched) return { decision: 'nierozpoznany', fulfillmentReady: false, locationMissing: false };
  if (!stockKnown) return { decision: 'sprawdz_stan', fulfillmentReady: false, locationMissing: false };
  if (count(shortage) > 0) return { decision: 'zamow_u_producenta', fulfillmentReady: false, locationMissing: false };
  return { decision: 'kompletuj', fulfillmentReady: true, locationMissing: !text(location) };
}

export function warehouseAnalysisNeedsInvestigation(analysis = {}) {
  return count(analysis.nierozpoznane) > 0 || count(analysis.bezStanu) > 0;
}

/** Zachowuje licznik lokalizacji, ale nie używa go jako blokady kompletacji. */
export function summarizeWarehousePositions(positions = []) {
  const rows = list(positions);
  const nierozpoznane = rows.filter((position) => position?.decision === 'nierozpoznany').length;
  const bezStanu = rows.filter((position) => position?.decision === 'sprawdz_stan').length;
  const bezLokalizacji = rows.filter((position) => position?.locationMissing === true
    || (position?.decision === 'uzupelnij_lokalizacje' && count(position?.shortage) === 0)
    || (position?.decision === 'kompletuj' && !text(position?.location))).length;
  const braki = rows.reduce((sum, position) => sum + count(position?.shortage), 0);
  const fulfillmentReady = !nierozpoznane && !bezStanu && !braki;
  return {
    nierozpoznane,
    bezStanu,
    bezLokalizacji,
    braki,
    fulfillmentReady,
    gotowe: fulfillmentReady,
    locationTasks: bezLokalizacji,
  };
}
