import {
  allegroCommercialNameAliases,
  allegroCommercialNamesEquivalent,
} from './allegro-commercial-identity.mjs';

const normalized = (value = '') => String(value || '').trim().toLowerCase();
const normalizedCode = (value = '') => String(value ?? '').toLocaleLowerCase('pl-PL').replace(/[^a-z0-9]+/g, '').trim();
const names = (value = '') => [...new Set((Array.isArray(value) ? value : [value])
  .flatMap((item) => allegroCommercialNameAliases(item))
  .map(normalized)
  .filter(Boolean))];

export function evaluateAllegroCatalogIdentitySignals({
  gtin = '',
  candidateGtins = [],
  nameScore = 0,
  productBrand = '',
  productBrands = [],
  candidateBrand = '',
  candidateBrands = [],
  productCode = '',
  candidateCodes = [],
  candidateBrandCorroborated = false,
} = {}) {
  const sourceGtin = normalized(gtin);
  const catalogGtins = [...new Set((Array.isArray(candidateGtins) ? candidateGtins : []).map(normalized).filter(Boolean))];
  const sourceBrands = names([productBrand, ...(Array.isArray(productBrands) ? productBrands : [productBrands])]);
  const catalogBrands = names([candidateBrand, ...(Array.isArray(candidateBrands) ? candidateBrands : [candidateBrands])]);
  const sourceBrand = sourceBrands[0] || '', catalogBrand = catalogBrands[0] || '';
  const brandMatch = !!(sourceBrands.length && catalogBrands.length && sourceBrands.some((source) => (
    catalogBrands.some((catalog) => allegroCommercialNamesEquivalent(source, catalog)
      || source.includes(catalog)
      || catalog.includes(source))
  )));
  const brandCorroborated = candidateBrandCorroborated === true;
  const brandConflict = !!(sourceBrands.length && catalogBrands.length && !brandMatch && !brandCorroborated);
  const gtinMatch = !!(sourceGtin && catalogGtins.includes(sourceGtin));
  const sourceCode = normalizedCode(productCode);
  const catalogCodes = [...new Set((Array.isArray(candidateCodes) ? candidateCodes : [candidateCodes]).map(normalizedCode).filter(Boolean))];
  const codeMatch = !!(sourceCode && catalogCodes.includes(sourceCode));
  const score = Math.max(0, Math.min(1, Number(nameScore) || 0));
  const nameConsistent = score >= 0.6 || (brandMatch && score >= 0.45) || (codeMatch && score >= 0.3);

  // Dokładny, poprawny GTIN jest globalnym identyfikatorem produktu. Katalog
  // Allegro często ma inną nazwę handlową i nie zwraca marki w osobnym polu.
  // Taki wariant wolno zaakceptować, ale jawna sprzeczność marki nadal blokuje.
  const exactGtinCatalogVariant = gtinMatch && !catalogBrand && !brandConflict;
  const verified = gtinMatch && !brandConflict && (nameConsistent || exactGtinCatalogVariant || brandCorroborated || codeMatch);

  return {
    verified,
    gtinMatch,
    nameScore: Number(score.toFixed(3)),
    nameConsistent,
    brandMatch,
    brandConflict,
    brandCorroborated,
    codeMatch,
    catalogBrandMissing: !catalogBrand,
    exactGtinCatalogVariant,
    productGtin: sourceGtin,
    candidateGtins: catalogGtins,
    productBrands: sourceBrands,
    candidateBrands: catalogBrands,
    productCode: sourceCode,
    candidateCodes: catalogCodes,
    reason: !sourceGtin ? 'brak poprawnego GTIN'
      : !gtinMatch ? 'GTIN katalogu jest inny'
        : brandConflict ? 'producent lub marka są sprzeczne'
          : codeMatch && !nameConsistent ? 'zgodny GTIN i kod producenta; nazwa katalogowa jest innym wariantem'
          : brandCorroborated && !brandMatch ? 'zgodny GTIN oraz marka katalogowa potwierdzona w nazwie produktu'
          : exactGtinCatalogVariant && !nameConsistent ? 'zgodny GTIN; katalog nie zawiera marki, a nazwa jest wariantem handlowym'
            : !nameConsistent ? 'nazwa produktu katalogowego jest niezgodna'
              : 'zgodny GTIN oraz zgodne cechy produktu',
  };
}

export function selectAllegroCatalogCandidate(candidates = [], {
  preferredProductId = '',
  ambiguityMargin = 0.03,
} = {}) {
  const verified = (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => candidate?.id && candidate?.identity?.verified === true)
    .sort((left, right) => Number(right?.identity?.nameScore || 0) - Number(left?.identity?.nameScore || 0));
  const preferred = verified.find((candidate) => String(candidate.id) === String(preferredProductId || ''));
  if (preferred) return { selected: preferred, ambiguous: false, verified };
  if (verified.length < 2) return { selected: verified[0] || null, ambiguous: false, verified };
  const difference = Number(verified[0]?.identity?.nameScore || 0) - Number(verified[1]?.identity?.nameScore || 0);
  const ambiguous = difference < Math.max(0, Number(ambiguityMargin) || 0);
  return { selected: ambiguous ? null : verified[0], ambiguous, verified };
}
