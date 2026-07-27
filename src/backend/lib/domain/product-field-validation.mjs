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

function normalizedManufacturerKey(value = '') {
  return canonicalManufacturerName(value, 300)
    .toLocaleLowerCase('pl-PL')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Rozpoznaje producenta/wydawcę z danych strukturalnych bez zamykania katalogu
 * do kilku znanych firm. Lista knownNames służy wyłącznie do rozpoznawania
 * aliasów w swobodnym tekście, a nie jako lista dozwolonych producentów.
 */
export function recognizeProductManufacturer(product = {}, evidence = {}, knownNames = []) {
  const sourceParameters = product?.parametryZrodla && typeof product.parametryZrodla === 'object'
    ? product.parametryZrodla
    : product?.sourceParameters && typeof product.sourceParameters === 'object'
      ? product.sourceParameters
      : {};
  const structured = [
    evidence?.brand,
    evidence?.producent,
    evidence?.manufacturer,
    evidence?.publisher,
    sourceParameters.marka,
    sourceParameters.brand,
    sourceParameters.producent,
    sourceParameters.manufacturer,
    sourceParameters.wydawca,
    sourceParameters.publisher,
    product?.producent,
    product?.marka,
    product?.manufacturer,
    product?.brand,
    product?.wydawca,
    product?.publisher,
  ];
  for (const candidate of structured) {
    const name = canonicalManufacturerName(candidate);
    if (name) return name;
  }

  const known = [...new Set((Array.isArray(knownNames) ? knownNames : [])
    .map((name) => canonicalManufacturerName(name))
    .filter(Boolean))];
  const haystack = normalizedManufacturerKey([
    product?.nazwa,
    product?.name,
    product?.sourceUrl,
    product?.producentUrl,
    evidence?.name,
    evidence?.sourceUrl,
  ].filter(Boolean).join(' '));
  for (const name of known) {
    const key = normalizedManufacturerKey(name);
    if (key && haystack.includes(key)) return name;
  }
  return '';
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
