function plain(value = '', limit = 500) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/[–—|•]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)
    .trim();
}

function words(value = '') {
  return plain(value).match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) || [];
}

export function allegroOfferTitleValid(value = '') {
  const title = plain(value, 75);
  return title.length >= 12 && title.length <= 75 && words(title).length >= 3;
}

export function allegroOfferTitle(product = {}) {
  const explicit = plain(product.allegroTitle, 75);
  const name = plain(product.nazwa || product.name, 75);
  let title = explicit || name;
  if (allegroOfferTitleValid(title)) return title;

  const seen = new Set(words(title).map((word) => word.toLocaleLowerCase('pl-PL')));
  const fragments = [
    plain(product.producent || product.marka, 80),
    words(product.kategoria || product.categoryName).filter((word) => !/^(?:i|oraz|inne|pozostałe)$/i.test(word)).slice(0, 4).join(' '),
    plain(product.kodProducenta || product.mpn || product.externalId || product.sku, 80),
    'produkt',
  ];
  for (const fragment of fragments) {
    for (const word of words(fragment)) {
      const key = word.toLocaleLowerCase('pl-PL');
      if (seen.has(key)) continue;
      const candidate = `${title} ${word}`.trim();
      if (candidate.length > 75) continue;
      title = candidate;
      seen.add(key);
      if (allegroOfferTitleValid(title)) return title;
    }
  }
  return plain(title || 'Produkt Artway oferta', 75);
}
