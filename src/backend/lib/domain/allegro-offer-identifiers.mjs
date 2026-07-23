import { canonicalGtin } from './product-identifiers.mjs';

const GTIN_PARAMETER_IDS = new Set(['225693', '245669', '245673']);
const text = (value = '') => String(value ?? '').trim();
const normalize = (value = '') => text(value).toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function parameterIsGtin(parameter = {}) {
  if (parameter?.options?.isGTIN === true) return true;
  if (GTIN_PARAMETER_IDS.has(text(parameter?.id))) return true;
  const name = normalize(parameter?.name);
  return /(^| )(ean|gtin|isbn|issn)( |$)/.test(name) || name.includes('kod kreskowy');
}

function parameterValues(parameter = {}) {
  const result = [];
  for (const key of ['values', 'valuesLabels', 'eans']) {
    if (Array.isArray(parameter?.[key])) result.push(...parameter[key]);
  }
  if (parameter?.value !== undefined) result.push(parameter.value);
  return result.flatMap((value) => {
    if (value && typeof value === 'object') return [value.value, value.label, value.name].filter(Boolean);
    return [value];
  });
}

function productNodes(offer = {}) {
  const result = [offer, offer?.product];
  for (const entry of Array.isArray(offer?.productSet) ? offer.productSet : []) {
    result.push(entry, entry?.product);
  }
  return result.filter((value) => value && typeof value === 'object');
}

/**
 * Odczytuje prawidłowe identyfikatory GS1 ze wszystkich struktur używanych przez
 * Allegro. Nie usuwa zer z dowolnych SKU ani kodów producenta.
 */
export function allegroOfferGtinCandidates(offer = {}) {
  const rawValues = [];
  for (const node of productNodes(offer)) {
    for (const key of ['ean', 'gtin', 'EAN', 'GTIN', 'eans', 'gtins', 'barcode', 'barCode']) {
      const value = node?.[key];
      if (Array.isArray(value)) rawValues.push(...value);
      else if (value !== undefined && value !== null) rawValues.push(value);
    }
    for (const parameter of Array.isArray(node?.parameters) ? node.parameters : []) {
      if (parameterIsGtin(parameter)) rawValues.push(...parameterValues(parameter));
    }
  }
  const unique = new Map();
  for (const value of rawValues) {
    const matches = text(value).match(/(?<!\d)\d(?:[\s-]*\d){7,13}(?!\d)/g) || [];
    for (const match of matches) {
      const raw = match.replace(/\D+/g, '');
      const canonical = canonicalGtin(raw);
      if (canonical && !unique.has(canonical)) unique.set(canonical, { raw, canonical });
    }
  }
  return [...unique.values()];
}

export function allegroOfferPrimaryGtin(offer = {}) {
  return allegroOfferGtinCandidates(offer)[0]?.raw || '';
}
