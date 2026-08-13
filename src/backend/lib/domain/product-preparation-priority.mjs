const clean = (value = '', limit = 500) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
const asArray = (value) => Array.isArray(value) ? value : [];
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

export function productSalePriority(product = {}) {
  const catalog = asObject(product._catalog);
  const availability = asObject(catalog.availability);
  const active = product.aktywny !== false
    && product.ukryty !== true
    && product.sprzedazAktywna !== false
    && product.saleAvailable !== false
    && availability.saleAvailable !== false
    && catalog.recordStatus !== 'trash';
  return active ? 20 : 0;
}

function validGtin(value = '') {
  const digits = clean(value, 30).replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(digits.length)) return false;
  const sum = digits.slice(0, -1).split('').reverse()
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1));
}

/**
 * Jedna, deterministyczna miara jakości całej kartoteki. Im większa luka,
 * tym wcześniej produkt trafia do automatycznej pracy. Wynik nie zgaduje
 * treści — wyłącznie waży potwierdzone braki sklepu, Allegro i Von Halsky.
 */
export function productPreparationQualityGap(product = {}) {
  const editorial = asObject(product.contentEditorial);
  const channels = asObject(editorial.channelStates);
  const images = [
    ...asArray(product.zdjecia),
    ...asArray(product.images),
    product.zdjecie,
    product.image,
  ].filter(Boolean);
  const gtin = product.gtin || product.ean;
  const producerCode = clean(product.kodProducenta || product.mpn, 160);
  const producer = clean(product.producent || product.marka, 160);
  const shortDescription = clean(product.opisKrotki || product.krotkiOpis, 5000);
  const longDescription = clean(product.opis || product.description, 30_000);
  const vonShort = clean(product.vonHalskyShortDescription, 5000);
  const vonLong = clean(product.vonHalskyDescription, 30_000);
  const missing = [];
  let score = 0;
  const add = (weight, code) => {
    score += weight;
    missing.push(code);
  };

  if (!clean(product.nazwa || product.name, 300)) add(80, 'nazwa');
  if (shortDescription.length < 20) add(55, 'opis_sklepu_krotki');
  if (longDescription.length < 80) add(80, 'opis_sklepu_dlugi');
  if (!images.length) add(100, 'zdjecie');
  if (!validGtin(gtin) && !(producerCode && producer)) add(120, 'identyfikacja');
  if (!producer) add(70, 'producent');
  if (!clean(product.kategoria || product.category, 200)) add(35, 'kategoria_sklepu');
  if (!clean(product.sourceUrl || product.producentUrl || product.urlProducenta, 2000)) add(30, 'zrodlo');

  if (channels.store?.status !== 'ready') add(45, 'kanal_sklep');
  if (channels.allegro?.status !== 'ready') add(65, 'kanal_allegro');
  if (!clean(product.allegroCategoryId, 100)) add(55, 'kategoria_allegro');
  if (!clean(product.allegroTitle, 300) || !clean(product.allegroDescription, 30_000)) add(65, 'tresc_allegro');

  if (channels.vonHalsky?.status !== 'ready' && clean(product.vonHalskyAgentStatus, 40).toLowerCase() !== 'ready') {
    add(70, 'kanal_von_halsky');
  }
  if (!clean(product.vonHalskyCategoryId, 100)) add(65, 'kategoria_von_halsky');
  if (vonShort.length < 20 || vonLong.length < 100) add(70, 'tresc_von_halsky');
  if (product.vonHalskyGpsrRequired === true && clean(product.vonHalskyResponsibleProducerStatus, 40) !== 'ready') {
    add(80, 'gpsr_von_halsky');
  }
  if (['failed', 'error', 'decision_required', 'needs_attention'].includes(clean(product.allegroAgentPreparationStatus, 40).toLowerCase())) {
    add(70, 'blad_poprzedniej_proby');
  }

  return Object.freeze({
    // Nie ścinamy wszystkich słabych kartotek do jednego wyniku. Przy dużym
    // katalogu brak zdjęcia, opisów, identyfikacji i danych obu kanałów musi
    // wyprzedzić produkt, któremu brakuje tylko jednego parametru.
    score: Math.min(1000, score),
    missing: Object.freeze([...new Set(missing)]),
    completeness: Math.max(0, Math.round(100 - Math.min(100, score / 5))),
  });
}
