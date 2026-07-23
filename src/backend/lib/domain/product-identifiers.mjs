const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

function digits(value = '') {
  return String(value ?? '').replace(/\D+/g, '');
}
/** Sprawdza cyfrę kontrolną GTIN-8/12/13/14 zgodnie z GS1. */
export function isValidGtin(value = '') {
  const code = digits(value);
  if (!GTIN_LENGTHS.has(code.length)) return false;
  const payload = code.slice(0, -1);
  let sum = 0;
  for (let index = payload.length - 1, weight = 3; index >= 0; index -= 1, weight = weight === 3 ? 1 : 3) {
    sum += Number(payload[index]) * weight;
  }
  return (10 - (sum % 10)) % 10 === Number(code.at(-1));
}

/**
 * Kanoniczny klucz GS1: każdy prawidłowy GTIN jest dopełniany do GTIN-14.
 * Dzięki temu EAN-13 i ten sam kod zapisany z zerem wiodącym są równoważne,
 * ale dowolne SKU nie są agresywnie pozbawiane zer.
 */
export function canonicalGtin(value = '') {
  const code = digits(value);
  return isValidGtin(code) ? code.padStart(14, '0') : '';
}

export function gtinEquivalent(left = '', right = '') {
  const a = canonicalGtin(left);
  const b = canonicalGtin(right);
  return !!a && !!b && a === b;
}

function identifierText(value = '', max = 160) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

/**
 * Jeden biznesowy kod kartoteki. Starsze integracje nazywały go zamiennie
 * SKU, EXTERNAL_ID, MPN albo kodem producenta. Zera wiodące są istotne.
 */
export function canonicalProductCode(product = {}, preferred = '') {
  return identifierText(
    preferred
      || product.kodProducenta
      || product.manufacturerCode
      || product.numerReferencyjny
      || product.referenceNumber
      || product.mpn
      || product.MPN
      || product.externalId
      || product.external_id
      || product.EXTERNAL_ID
      || product.sku
      || product.SKU,
  );
}

/**
 * Utrzymuje zgodność wsteczną bez mnożenia pól w interfejsie. Administrator
 * edytuje jedno pole, natomiast Allegro, OVF i stare eksporty nadal otrzymują
 * alias, którego oczekują.
 */
export function synchronizeProductIdentifierAliases(product = {}, {
  code = '',
  overwrite = false,
} = {}) {
  const result = { ...product };
  const canonicalCode = canonicalProductCode(product, code);
  if (canonicalCode) {
    for (const field of ['kodProducenta', 'mpn', 'externalId', 'sku']) {
      if (overwrite || !identifierText(result[field])) result[field] = canonicalCode;
    }
    if (overwrite || !identifierText(result.numerReferencyjny)) result.numerReferencyjny = canonicalCode;
  }
  const gtin = identifierText(result.gtin || result.ean || result.GTIN || result.EAN, 40).replace(/\D/g, '');
  if (gtin) {
    if (overwrite || !identifierText(result.gtin, 40)) result.gtin = gtin;
    if (overwrite || !identifierText(result.ean, 40)) result.ean = gtin;
  }
  return result;
}
