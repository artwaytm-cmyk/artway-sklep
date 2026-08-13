const normalized = (value = '') => String(value ?? '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const asArray = (value) => value instanceof Map
  ? [...value.values()]
  : Array.isArray(value)
    ? value
    : [];

const categoryIdOf = (product = {}) => String(
  product.allegroCategoryId
  || product.allegroPreparationManifest?.categoryId
  || product.allegro?.categoryId
  || '',
).trim().slice(0, 80);

const categoryNameOf = (product = {}) => String(
  product.allegroCategoryName
  || product.allegroCategoryPath
  || product.allegroCategoryResolution?.categoryName
  || product.allegroPreparationManifest?.categoryName
  || '',
).trim().slice(0, 240);

function productCategoryKeys(product = {}) {
  return {
    exact: normalized(product.kategoriaPelna || product.kategoria || product.category),
    base: normalized(product.kategoria || product.category),
    group: normalized(product.grupaKategorii || product.categoryGroup),
    producer: normalized(product.producent || product.marka || product.manufacturer),
  };
}

function productMeaningfulWords(product = {}) {
  const stop = /^(?:produkt|zestaw|gra|gry|dla|oraz|firmy|marki|edycja|wersja|elementow|elementy|sztuk|szt|cm|mm|nowosc|promocja)$/;
  return new Set(normalized([
    product.nazwa || product.name,
    product.kategoria,
    product.kategoriaPelna,
    product.grupaKategorii,
  ].join(' ')).split(/\s+/).filter((word) => word.length >= 4 && !stop.test(word)));
}

function trustedCategoryAssignment(product = {}) {
  if (!categoryIdOf(product)) return false;
  return Boolean(
    product.allegroProductId
    || product.allegroOfferId
    || product.allegro?.offerId
    || product.allegroCatalogIdentityConfirmed === true
    || product.allegroAgentPreparationStatus === 'ready'
    || product.allegroPreparationManifest?.categoryId
  );
}

/**
 * Wybiera kategorię Allegro na podstawie potwierdzonej historii centralnego
 * katalogu. Nie kopiuje ID produktu katalogowego — ono jest unikalne dla
 * konkretnego towaru. Powtarzalna może być wyłącznie kategoria.
 */
export function allegroCategoryConsensus(product = {}, relatedProducts = []) {
  const source = asArray(relatedProducts), targetKeys = productCategoryKeys(product);
  const targetWords = productMeaningfulWords(product), targetId = String(product.id ?? '').trim();
  const groups = new Map();
  for (const candidate of source) {
    if (!candidate || String(candidate.id ?? '').trim() === targetId || !trustedCategoryAssignment(candidate)) continue;
    const categoryId = categoryIdOf(candidate), candidateKeys = productCategoryKeys(candidate);
    const sameExact = Boolean(targetKeys.exact && candidateKeys.exact === targetKeys.exact);
    const sameBase = Boolean(targetKeys.base && candidateKeys.base === targetKeys.base);
    const sameGroup = Boolean(targetKeys.group && candidateKeys.group === targetKeys.group);
    if (!sameExact && !sameBase && !sameGroup) continue;
    const candidateWords = productMeaningfulWords(candidate);
    const sharedWords = [...targetWords].filter((word) => candidateWords.has(word)).length;
    const sameProducer = Boolean(targetKeys.producer && candidateKeys.producer === targetKeys.producer);
    const weight = (sameExact ? 12 : sameBase ? 9 : 0) + (sameGroup ? 4 : 0) + (sameProducer ? 1.5 : 0) + Math.min(4, sharedWords);
    if (weight <= 0) continue;
    const current = groups.get(categoryId) || {
      id: categoryId,
      name: categoryNameOf(candidate),
      weight: 0,
      count: 0,
      exactCount: 0,
      examples: [],
    };
    current.weight += weight;
    current.count += 1;
    if (sameExact || sameBase) current.exactCount += 1;
    if (!current.name) current.name = categoryNameOf(candidate);
    if (current.examples.length < 4) current.examples.push({
      id: String(candidate.id ?? ''),
      name: String(candidate.nazwa || candidate.name || '').trim().slice(0, 180),
    });
    groups.set(categoryId, current);
  }
  const ranked = [...groups.values()].sort((a, b) => b.weight - a.weight || b.count - a.count);
  const winner = ranked[0], totalWeight = ranked.reduce((sum, item) => sum + item.weight, 0);
  if (!winner || winner.count < 2 || winner.exactCount < 2 || totalWeight <= 0) {
    return { selected: null, candidates: ranked.slice(0, 5), confidence: 0, reason: 'brak potwierdzonej większości w tej grupie sklepu' };
  }
  const share = winner.weight / totalWeight;
  const secondShare = ranked[1] ? ranked[1].weight / totalWeight : 0;
  const decisive = share >= 0.68 && share - secondShare >= 0.24;
  if (!decisive) {
    return {
      selected: null,
      candidates: ranked.slice(0, 5),
      confidence: Math.round(share * 100),
      reason: 'potwierdzone produkty tej grupy są przypisane do różnych kategorii Allegro',
    };
  }
  const confidence = Math.max(82, Math.min(99, Math.round(72 + share * 20 + Math.min(7, winner.count))));
  const currentId = categoryIdOf(product);
  const replaceCurrent = Boolean(
    currentId
    && currentId !== winner.id
    && winner.count >= 4
    && winner.exactCount >= 4
    && share >= 0.84
    && confidence >= 95
  );
  return {
    selected: { ...winner, confidence },
    candidates: ranked.slice(0, 5),
    confidence,
    currentId,
    replaceCurrent,
    reason: `${winner.count} potwierdzonych produktów z tej samej kategorii sklepu używa kategorii Allegro ${winner.id}`,
  };
}

export function allegroCategoryResolution({
  product = {}, categoryId = '', categorySuggestion = null, consensus = null,
  catalogLookup = null, existingCatalogProductId = '', now = () => new Date(),
} = {}) {
  const selected = categorySuggestion?.suggestions?.find((item) => String(item.id) === String(categoryId))
    || (String(categorySuggestion?.selected?.id) === String(categoryId) ? categorySuggestion.selected : null);
  const fromCatalog = Boolean(existingCatalogProductId || product.allegroProductId || catalogLookup?.selected?.categoryId === categoryId);
  const fromConsensus = consensus?.selected?.id === categoryId;
  const fromSuggestion = categorySuggestion?.selected?.id === categoryId;
  return {
    categoryId,
    categoryName: String(selected?.pathText || selected?.name || consensus?.selected?.name || product.allegroCategoryName || '').trim().slice(0, 240),
    source: fromCatalog
      ? 'katalog produktu Allegro'
      : fromConsensus
        ? 'większość potwierdzonych produktów z tej samej kategorii sklepu'
        : fromSuggestion
          ? 'wyszukiwarka kategorii Allegro'
          : product.allegroCategoryId === categoryId
            ? 'zapisana kartoteka produktu'
            : 'ustawienie formularza',
    confidence: fromConsensus
      ? consensus.confidence
      : fromCatalog
        ? 100
        : fromSuggestion
          ? Math.max(70, Math.min(99, Math.round(Number(categorySuggestion.selected.score || 0))))
          : 80,
    evidenceCount: fromConsensus ? consensus.selected.count : 0,
    examples: fromConsensus ? consensus.selected.examples : [],
    resolvedAt: now().toISOString(),
  };
}

/**
 * Kategoria produktu potwierdzonego dokładnym GTIN w Katalogu Allegro ma
 * pierwszeństwo przed lokalnym konsensusem podobnych kartotek. Próba
 * "poprawienia" jej na popularniejszą kategorię kończy się w API błędem
 * ProductConstraintViolationException.DataIntegrity. Dla istniejącej oferty
 * zachowujemy natomiast kategorię faktycznie odczytaną z tej oferty.
 */
export function allegroPreferredOfferCategory({
  fallbackCategoryId = '', existingOffer = null, catalogMatch = null,
} = {}) {
  const existingCatalogProductId = String(
    existingOffer?.offer?.productId
    || existingOffer?.offer?.productSet?.[0]?.product?.id
    || '',
  ).trim().slice(0, 120);
  const existingOfferCategoryId = String(existingOffer?.offer?.categoryId || '').trim().slice(0, 80);
  const selected = catalogMatch?.selected || null;
  const selectedProductId = String(selected?.id || '').trim().slice(0, 120);
  const selectedCategoryId = String(selected?.categoryId || '').trim().slice(0, 80);
  const catalogIdentityVerified = selected?.identity?.verified === true;

  if (existingCatalogProductId) {
    return {
      categoryId: existingOfferCategoryId
        || (selectedProductId === existingCatalogProductId ? selectedCategoryId : '')
        || String(fallbackCategoryId || '').trim().slice(0, 80),
      locked: true,
      source: 'existing_offer',
    };
  }
  if (catalogIdentityVerified && selectedProductId && selectedCategoryId) {
    return { categoryId: selectedCategoryId, locked: true, source: 'verified_catalog_product' };
  }
  return {
    categoryId: String(fallbackCategoryId || '').trim().slice(0, 80),
    locked: false,
    source: 'fallback',
  };
}

export function allegroCategorySuggestedSelection(consensus = null, fallback = null, explicitPhrase = false) {
  if (!consensus?.selected || (explicitPhrase && consensus.confidence < 95)) return fallback;
  return {
    id: consensus.selected.id,
    name: consensus.selected.name || `Kategoria ${consensus.selected.id}`,
    pathText: consensus.selected.name || '',
    leaf: true,
    score: consensus.confidence,
    source: 'catalog_consensus',
  };
}

export function allegroCategoryParentPath(parent = {}) {
  const output = [];
  let current = parent, guard = 0;
  while (current && typeof current === 'object' && guard < 12) {
    const name = String(current.name || current.id || '').trim().slice(0, 160);
    if (name) output.unshift(name);
    current = current.parent;
    guard += 1;
  }
  return output;
}

export function allegroCategorySpecificScore(productText = '', categoryText = '') {
  const product = normalized(productText), category = normalized(categoryText);
  let score = 0;
  const toy = /\b(alexander|multigra|godan|zabawk|gra|gry|plansz|edukacyjn|kreatywn|origami|puzzle|wiatrak|wiatraczek|balon)\b/.test(product);
  const automotive = /\b(motoryzac|czesci samochod|samochod osobow|uklad napedow|silnik|karoseri|zawieszen|numer katalogowy czesci|producent czesci)\b/.test(category);
  if (toy && automotive) score -= 1000;
  if (toy && !/\bpuzzle\b/.test(product) && /\b(dziecko|zabawki|gry|rekreacja|artykuly imprezowe)\b/.test(category)) score += 80;
  if (/\bpuzzle\b/.test(product)) {
    if (/\bpuzzle\b/.test(category)) score += 120;
    if (/\b(klocki|gry zrecznosciowe|gry planszowe)\b/.test(category)) score -= 120;
  }
  return score;
}

export function allegroCategoryIntentPhrases(productText = '') {
  const product = normalized(productText);
  if (/\bpuzzle\b/.test(product)) return /\bdrewnian/.test(product) ? ['puzzle', 'puzzle drewniane'] : ['puzzle'];
  if (/\bwiatrak|wiatraczek\b/.test(product)) return ['wiatraczki zabawki', 'zabawki ogrodowe dla dzieci'];
  if (/\borigami\b/.test(product)) return ['zestawy kreatywne origami', 'zabawki kreatywne'];
  if (/\b(?:x press|brelok|bizuter|koralik)\b/.test(product)) return ['zestawy kreatywne dla dzieci', 'zestawy do tworzenia biżuterii'];
  if (/\bbalon\b/.test(product)) return ['balony dekoracyjne', 'artykuły imprezowe'];
  return [];
}

export function allegroCategoryNeedsCorrection(product = {}, parameters = []) {
  const productText = normalized([
    product.nazwa || product.name,
    product.kategoria,
    product.opisKrotki,
    product.producent,
    product.marka,
  ].join(' '));
  const names = (Array.isArray(parameters) ? parameters : []).map((parameter) => normalized(parameter?.name || '')).join(' ');
  const toy = /\b(alexander|multigra|godan|zabawk|gra|gry|plansz|edukacyjn|kreatywn|origami|puzzle|wiatrak|wiatraczek|balon)\b/.test(productText);
  const automotiveSignals = /producent czesci|typ samochodu|numer katalogowy czesci|numery katalogowe zamiennikow|jakosc czesci|strona zabudowy|rodzaj skrzyni biegow/.test(names);
  if (toy && automotiveSignals) return true;
  const creativeAccessory = /\b(?:x press|brelok|bizuter|koralik|zestaw kreatywny)\b/.test(productText);
  const gameOnlySignals = /minimalna liczba graczy|maksymalna liczba graczy|czas rozgrywki|liczba druzyn/.test(names);
  if (creativeAccessory && gameOnlySignals) return true;
  const categoryId = categoryIdOf(product);
  // Dwie częste pomyłki historyczne miały częściowo zgodne parametry, więc
  // sama analiza schematu ich nie wykrywała: zestawy X-Press w puzzlach oraz
  // zwykłe puzzle w kategorii prac ręcznych.
  if (creativeAccessory && categoryId === '257813') return true;
  if (/\bpuzzle\b/.test(productText) && categoryId === '93663') return true;
  if (!/\bpuzzle\b/.test(productText)) return false;
  const hasPuzzleMeasure = /liczba elementow|ilosc elementow/.test(names);
  const hasWrongFamilySignal = /liczba graczy|typ klockow|kolor|nosnik|gatunek|wykonawca|wytwornia|rok wydania/.test(names);
  return !hasPuzzleMeasure && hasWrongFamilySignal;
}

export async function allegroCorrectCategorySelection({
  product = {}, categoryId = '', parameters = [], suggest, loadParameters,
} = {}) {
  if (!allegroCategoryNeedsCorrection(product, parameters) || typeof suggest !== 'function' || typeof loadParameters !== 'function') {
    return { changed: false, categoryId, parameters, suggestion: null };
  }
  const suggestion = await suggest();
  const correctedCategoryId = String(suggestion?.selected?.id || '').trim().slice(0, 80);
  if (!correctedCategoryId || correctedCategoryId === String(categoryId)) {
    return { changed: false, categoryId, parameters, suggestion };
  }
  const loaded = await loadParameters(correctedCategoryId);
  return { changed: true, categoryId: correctedCategoryId, parameters: loaded, suggestion };
}
