const normalized = (value = '') => String(value || '').trim().toLowerCase();

export function evaluateAllegroCatalogIdentitySignals({
  gtin = '',
  candidateGtins = [],
  nameScore = 0,
  productBrand = '',
  candidateBrand = '',
} = {}) {
  const sourceGtin = normalized(gtin);
  const catalogGtins = [...new Set((Array.isArray(candidateGtins) ? candidateGtins : []).map(normalized).filter(Boolean))];
  const sourceBrand = normalized(productBrand), catalogBrand = normalized(candidateBrand);
  const brandMatch = !!(sourceBrand && catalogBrand && (
    sourceBrand === catalogBrand
    || sourceBrand.includes(catalogBrand)
    || catalogBrand.includes(sourceBrand)
  ));
  const brandConflict = !!(sourceBrand && catalogBrand && !brandMatch);
  const gtinMatch = !!(sourceGtin && catalogGtins.includes(sourceGtin));
  const score = Math.max(0, Math.min(1, Number(nameScore) || 0));
  const nameConsistent = score >= 0.6 || (brandMatch && score >= 0.45);

  // Dokładny, poprawny GTIN jest globalnym identyfikatorem produktu. Katalog
  // Allegro często ma inną nazwę handlową i nie zwraca marki w osobnym polu.
  // Taki wariant wolno zaakceptować, ale jawna sprzeczność marki nadal blokuje.
  const exactGtinCatalogVariant = gtinMatch && !catalogBrand && !brandConflict;
  const verified = gtinMatch && !brandConflict && (nameConsistent || exactGtinCatalogVariant);

  return {
    verified,
    gtinMatch,
    nameScore: Number(score.toFixed(3)),
    nameConsistent,
    brandMatch,
    brandConflict,
    catalogBrandMissing: !catalogBrand,
    exactGtinCatalogVariant,
    productGtin: sourceGtin,
    candidateGtins: catalogGtins,
    reason: !sourceGtin ? 'brak poprawnego GTIN'
      : !gtinMatch ? 'GTIN katalogu jest inny'
        : brandConflict ? 'producent lub marka są sprzeczne'
          : exactGtinCatalogVariant && !nameConsistent ? 'zgodny GTIN; katalog nie zawiera marki, a nazwa jest wariantem handlowym'
            : !nameConsistent ? 'nazwa produktu katalogowego jest niezgodna'
              : 'zgodny GTIN oraz zgodne cechy produktu',
  };
}
