const normalized = (value = '') => String(value ?? '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

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
