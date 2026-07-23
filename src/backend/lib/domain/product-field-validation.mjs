const PRODUCT_ARRAY_KEYS = Object.freeze([
  'artway_produkty_dodane',
  'artway_kosz_dodane',
]);

const PRODUCT_MAP_KEYS = Object.freeze([
  'artway_produkty_edytowane',
]);

export function canonicalManufacturerName(value = '', max = 160) {
  const name = String(value ?? '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  return name && /\p{L}/u.test(name) ? name : '';
}

export function validManufacturerName(value = '') {
  return canonicalManufacturerName(value) !== '';
}

export function normalizeProductManufacturerFields(product = {}) {
  if (!product || typeof product !== 'object' || Array.isArray(product)) return product;
  const producer = canonicalManufacturerName(product.producent || product.manufacturer);
  const brand = canonicalManufacturerName(product.marka || product.brand);
  const canonical = producer || brand;
  const next = { ...product };
  for (const field of ['producent', 'manufacturer', 'marka', 'brand']) delete next[field];
  if (!canonical) return next;
  next.producent = producer || canonical;
  next.marka = brand || canonical;
  return next;
}

/**
 * Ustawienia są ogólnym dokumentem synchronizacyjnym, dlatego kontrola musi
 * objąć wszystkie kartoteki produktów, także zapis wykonany poza edytorem.
 */
export function sanitizeManufacturerFieldsInSettings(settings = {}) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {};
  const result = { ...settings };
  for (const key of PRODUCT_ARRAY_KEYS) {
    if (!Array.isArray(result[key])) continue;
    result[key] = result[key].map(normalizeProductManufacturerFields);
  }
  for (const key of PRODUCT_MAP_KEYS) {
    if (!result[key] || typeof result[key] !== 'object' || Array.isArray(result[key])) continue;
    result[key] = Object.fromEntries(Object.entries(result[key]).map(([id, product]) => [id, normalizeProductManufacturerFields(product)]));
  }
  return result;
}
