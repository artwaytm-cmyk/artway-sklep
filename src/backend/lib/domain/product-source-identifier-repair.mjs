import { canonicalProductCode, isValidGtin } from './product-identifiers.mjs';
import { canonicalManufacturerName } from './product-field-validation.mjs';

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

function sourceGtinCandidates(source = {}) {
  const manufacturer = source.parametryProducenta && typeof source.parametryProducenta === 'object'
    ? source.parametryProducenta
    : {};
  const sourceParameters = source.parametryZrodla && typeof source.parametryZrodla === 'object'
    ? source.parametryZrodla
    : {};
  return [
    source.gtin, source.ean, source.GTIN, source.EAN,
    manufacturer.ean, manufacturer.gtin,
    sourceParameters.ean, sourceParameters.gtin,
    sourceParameters['kod ean'], sourceParameters['kod kreskowy'],
  ].map(digits).filter((value, index, values) => value && values.indexOf(value) === index);
}

function gtinWithCorrectChecksum(value = '') {
  const code = digits(value);
  if (![8, 12, 13, 14].includes(code.length)) return '';
  const payload = code.slice(0, -1);
  let sum = 0;
  for (let index = payload.length - 1, weight = 3; index >= 0; index -= 1, weight = weight === 3 ? 1 : 3) {
    sum += Number(payload[index]) * weight;
  }
  return `${payload}${(10 - (sum % 10)) % 10}`;
}

function rawCode(value = '') {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function gtinWithoutOneExtraZero(value = '', productCode = '') {
  const code = digits(value), exactCode = rawCode(productCode);
  if (code.length !== 14 || isValidGtin(code) || !/^\d{3,}$/.test(exactCode)) return '';
  const candidates = [...new Set([...code].flatMap((digit, index) => {
    if (digit !== '0' || index === code.length - 1) return [];
    const candidate = `${code.slice(0, index)}${code.slice(index + 1)}`;
    const payload = candidate.slice(0, -1);
    return isValidGtin(candidate) && payload.endsWith(exactCode) ? [candidate] : [];
  }))];
  return candidates.length === 1 ? candidates[0] : '';
}

function authoritativeDomainManufacturer(source = {}) {
  const raw = text(source.sourceUrl || source.producentUrl, 1000);
  let host = '';
  try { host = new URL(raw).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
  if (host === 'multigra.com.pl' || host.endsWith('.multigra.com.pl')) return 'Multigra';
  if (host === 'milliwood.com' || host.endsWith('.milliwood.com')) return 'MilliWOOD';
  if (host === 'alexander.com.pl' || host.endsWith('.alexander.com.pl')) return 'Alexander';
  return '';
}

export function officialManufacturerSourceCandidate(product = {}, sourceUrl = '') {
  const manufacturer = canonicalManufacturerName(product.producent || product.manufacturer || product.marka || product.brand);
  if (manufacturer.toLocaleLowerCase('pl-PL') !== 'alexander') return '';
  try {
    const source = new URL(text(sourceUrl, 2000));
    const host = source.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'sklep.alexander.com.pl') return '';
    const legacySlug = decodeURIComponent(source.pathname).match(/\/product-pol-\d+-([^/]+?)\.html$/i)?.[1] || '';
    const slug = legacySlug.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug ? `https://www.alexander.com.pl/produkty/${slug}/` : '';
  } catch {
    return '';
  }
}

function trustedManufacturerPatch(product = {}, source = {}, sameCode = false) {
  if (!sameCode) return {};
  const manufacturer = canonicalManufacturerName(
    authoritativeDomainManufacturer(source)
    || source.producent
    || source.manufacturer
    || source.marka
    || source.brand,
  );
  if (!manufacturer) return {};
  const current = canonicalManufacturerName(product.producent || product.manufacturer || product.marka || product.brand);
  if (current.toLocaleLowerCase('pl-PL') === manufacturer.toLocaleLowerCase('pl-PL')) return {};
  return { producent: manufacturer, marka: manufacturer };
}

/**
 * Koryguje wyłącznie pusty albo nieprawidłowy GTIN i tylko wtedy, gdy
 * oficjalne źródło jednoznacznie dotyczy tej samej kartoteki. Kod produktu
 * jest porównywany bez usuwania jego znaczących zer w zapisywanym rekordzie.
 */
export function trustedSourceIdentifierPatch(product = {}, source = {}) {
  const sourceGtin = validSourceGtin(source);
  const storedGtin = digits(product.gtin || product.ean || product.GTIN || product.EAN);
  const productCode = normalizedCode(canonicalProductCode(product));
  const sourceCode = normalizedCode(canonicalProductCode(source));
  const sameCode = !!productCode && !!sourceCode && productCode === sourceCode;
  const invalidSourceGtin = sourceGtinCandidates(source)
    .find((candidate) => [8, 12, 13, 14].includes(candidate.length) && !isValidGtin(candidate));
  const shortenedGtin = sameCode ? gtinWithoutOneExtraZero(invalidSourceGtin, canonicalProductCode(source)) : '';
  const imageEvidence = product.sourceEvidence && typeof product.sourceEvidence === 'object' ? product.sourceEvidence : {};
  const evidenceManufacturer = authoritativeDomainManufacturer({ sourceUrl: imageEvidence.imageSourceUrl });
  const inspectedManufacturer = authoritativeDomainManufacturer(source);
  const exactSourceEvidence = Number(imageEvidence.imagePolicyVersion) >= 5
    && ['ean', 'producer_code'].includes(text(imageEvidence.imageIdentityMode, 40))
    && evidenceManufacturer && evidenceManufacturer === inspectedManufacturer;
  const manufacturerPatch = trustedManufacturerPatch(product, source, sameCode || exactSourceEvidence || Boolean(shortenedGtin && shortenedGtin === storedGtin));

  // GTIN-14 zapisany dawniej jako technicznie poprawny kod opakowania nie może
  // blokować jednoznacznego kodu jednostkowego z tej samej oficjalnej karty.
  // Korekta jest dozwolona wyłącznie, gdy źródło ma dokładnie ten sam kod
  // producenta, a usunięcie jednego nadmiarowego zera daje jeden prawidłowy GTIN.
  if (isValidGtin(storedGtin)) {
    if (storedGtin.length === 14 && shortenedGtin && storedGtin !== shortenedGtin) {
      return {
        ...manufacturerPatch,
        ean: shortenedGtin,
        gtin: shortenedGtin,
        identifierRepairEvidence: {
          method: 'official_source_gtin_extra_zero_unit_correction',
          originalGtin: invalidSourceGtin,
          replacedStoredGtin: storedGtin,
          correctedGtin: shortenedGtin,
          matchedManufacturerCode: canonicalProductCode(source),
          sourceUrl: text(source.sourceUrl || source.producentUrl, 1000),
          resolvedAt: new Date().toISOString(),
        },
      };
    }
    return manufacturerPatch;
  }

  if (sourceGtin) {
    const gtinPayload = sourceGtin.slice(0, -1).replace(/^0+(?=\d)/, '');
    const payloadConfirmsCode = !!productCode && productCode.length >= 3 && gtinPayload.endsWith(productCode);
    if (!sameCode && !payloadConfirmsCode) return manufacturerPatch;
    return { ...manufacturerPatch, ean: sourceGtin, gtin: sourceGtin };
  }

  // Niektóre oficjalne strony zawierają prawidłowy 12-cyfrowy prefiks i
  // błędną wyłącznie cyfrę kontrolną. Naprawa jest dozwolona tylko przy
  // zgodnym kodzie produktu na obu kartotekach; nigdy na podstawie podobnej
  // nazwy ani samego producenta.
  if (!sameCode) return manufacturerPatch;
  if (shortenedGtin) {
    return {
      ...manufacturerPatch,
      ean: shortenedGtin,
      gtin: shortenedGtin,
      identifierRepairEvidence: {
        method: 'official_source_gtin_extra_zero_correction',
        originalGtin: invalidSourceGtin,
        correctedGtin: shortenedGtin,
        matchedManufacturerCode: canonicalProductCode(source),
        sourceUrl: text(source.sourceUrl || source.producentUrl, 1000),
        resolvedAt: new Date().toISOString(),
      },
    };
  }
  const correctedGtin = gtinWithCorrectChecksum(invalidSourceGtin);
  if (!correctedGtin || !isValidGtin(correctedGtin)) return manufacturerPatch;
  const exactProductCode = rawCode(canonicalProductCode(product));
  const exactSourceCode = rawCode(canonicalProductCode(source));
  if (!exactProductCode || exactProductCode !== exactSourceCode) return manufacturerPatch;
  return {
    ...manufacturerPatch,
    ean: correctedGtin,
    gtin: correctedGtin,
    identifierRepairEvidence: {
      method: 'official_source_gtin_checksum_correction',
      originalGtin: invalidSourceGtin,
      correctedGtin,
      matchedManufacturerCode: canonicalProductCode(source),
      sourceUrl: text(source.sourceUrl || source.producentUrl, 1000),
      resolvedAt: new Date().toISOString(),
    },
  };
}
