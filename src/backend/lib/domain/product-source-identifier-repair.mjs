import { canonicalProductCode, isValidGtin } from './product-identifiers.mjs';

function text(value = '', max = 160) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function digits(value = '') {
  return text(value, 80).replace(/\D+/g, '');
}

function normalizedCode(value = '') {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/^0+(?=\d)/, '');
}

function validSourceGtin(source = {}) {
  const manufacturer = source.parametryProducenta && typeof source.parametryProducenta === 'object'
    ? source.parametryProducenta
    : {};
  const sourceParameters = source.parametryZrodla && typeof source.parametryZrodla === 'object'
    ? source.parametryZrodla
    : {};
  const candidates = [
    source.gtin,
    source.ean,
    source.GTIN,
    source.EAN,
    manufacturer.ean,
    manufacturer.gtin,
    sourceParameters.ean,
    sourceParameters.gtin,
    manufacturer.kodProducenta,
    sourceParameters['kod producenta'],
  ];
  return candidates.map(digits).find(isValidGtin) || '';
}

/**
 * Koryguje wyłącznie pusty albo nieprawidłowy GTIN i tylko wtedy, gdy
 * oficjalne źródło jednoznacznie dotyczy tej samej kartoteki. Kod produktu
 * jest porównywany bez usuwania jego znaczących zer w zapisywanym rekordzie.
 */
export function trustedSourceIdentifierPatch(product = {}, source = {}) {
  const sourceGtin = validSourceGtin(source);
  if (!sourceGtin) return {};
  const storedGtin = digits(product.gtin || product.ean || product.GTIN || product.EAN);
  if (isValidGtin(storedGtin)) return {};

  const productCode = normalizedCode(canonicalProductCode(product));
  const sourceCode = normalizedCode(canonicalProductCode(source));
  const gtinPayload = sourceGtin.slice(0, -1).replace(/^0+(?=\d)/, '');
  const sameCode = !!productCode && !!sourceCode && productCode === sourceCode;
  const payloadConfirmsCode = !!productCode && gtinPayload.endsWith(productCode);
  if (!sameCode && !payloadConfirmsCode) return {};
  return { ean: sourceGtin, gtin: sourceGtin };
}
