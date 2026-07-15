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
