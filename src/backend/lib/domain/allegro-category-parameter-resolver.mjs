import { canonicalManufacturerName } from './product-field-validation.mjs';

const EMPTY = new Set(['', '-', '—', 'brak', 'nie dotyczy', 'n/d', 'null', 'undefined']);

export function normalizeAllegroParameterName(value = '') {
  return String(value ?? '')
    .replace(/([a-ząćęłńóśźż])([A-ZĄĆĘŁŃÓŚŹŻ])/g, '$1 $2')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function cleanValue(value) {
  if (Array.isArray(value)) return value.map(cleanValue).filter(Boolean).join(', ');
  if (value && typeof value === 'object') return '';
  const text = String(value ?? '').trim();
  return EMPTY.has(normalizeAllegroParameterName(text)) ? '' : text;
}

function addValue(catalog, name, value, source, priority = 0) {
  const key = normalizeAllegroParameterName(name);
  const cleaned = cleanValue(value);
  if (!key || !cleaned) return;
  const previous = catalog.get(key);
  if (!previous || priority > previous.priority) catalog.set(key, { value: cleaned, source, priority });
}

function addObject(catalog, object, source, priority = 10) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) return;
  for (const [name, value] of Object.entries(object)) addValue(catalog, name, value, source, priority);
}

function addEvidenceObject(catalog, object, priority = 60) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) return;
  const aliases = {
    age: ['wiek', 'wiek dziecka', 'minimalny wiek dziecka'],
    players: ['liczba graczy'],
    language: ['wersja językowa', 'wersja językowa gry', 'język'],
    type: ['typ', 'rodzaj produktu'],
    material: ['materiał', 'materiał wykonania'],
    publisher: ['wydawca'],
  };
  for (const [field, names] of Object.entries(aliases)) {
    const record = object[field];
    if (!record?.value) continue;
    for (const name of names) addValue(catalog, name, record.value, record.source || 'dopasowanie parametrów', priority);
  }
}

export function allegroProductParameterCatalog(product = {}) {
  const catalog = new Map();
  const sourceMaterial = product?.sourceMaterial && typeof product.sourceMaterial === 'object' ? product.sourceMaterial : {};
  for (const [object, source, priority] of [
    [sourceMaterial.parameters, 'materiał źródłowy', 20],
    [sourceMaterial.specification, 'specyfikacja źródłowa', 20],
    [product.parametryZrodla, 'parametry źródła', 30],
    [product.parametryProducenta, 'parametry producenta', 40],
    [product.specyfikacja, 'specyfikacja produktu', 45],
    [product.atrybuty, 'atrybuty produktu', 45],
  ]) addObject(catalog, object, source, priority);
  addEvidenceObject(catalog, product.allegroParameterEvidence, 60);

  const direct = [
    [['nazwa', 'nazwa produktu'], product.nazwa || product.name || product.allegroTitle],
    [['ean', 'gtin', 'kod kreskowy'], product.gtin || product.ean],
    [['kod producenta', 'mpn', 'numer referencyjny', 'symbol producenta', 'sku', 'external id'], product.kodProducenta || product.mpn || product.numerReferencyjny || product.externalId || product.sku],
    [['marka', 'producent'], canonicalManufacturerName(product.producent || product.marka)],
    [['wiek', 'wiek dziecka', 'minimalny wiek dziecka', 'wiek graczy od'], product.wiek || product.wiekDziecka || product.minimalnyWiekDziecka || product.wiekGraczyOd],
    [['liczba graczy'], product.liczbaGraczy || product.gracze],
    [['liczba elementow'], product.liczbaElementow],
    [['material'], product.material],
    [['kolor', 'kolor produktu'], product.kolorProduktu || product.color],
    [['rozmiar'], product.rozmiar || product.size],
    [['waga opakowania', 'waga'], product.wagaOpakowania || product.waga],
    [['wymiary opakowania'], product.wymiaryOpakowania],
    [['wydawca'], product.wydawca || canonicalManufacturerName(product.producent || product.marka)],
    [['wersja językowa', 'wersja językowa gry', 'język'], product.wersjaJezykowa || product.jezyk || product.language],
    [['typ', 'rodzaj produktu'], product.typ || product.rodzaj],
  ];
  for (const [names, value] of direct) for (const name of names) addValue(catalog, name, value, 'kartoteka produktu', 100);
  const descriptiveText = [
    product.nazwa, product.name, product.allegroTitle, product.opisKrotki,
    product.opis, sourceMaterial.title, sourceMaterial.shortDescription, sourceMaterial.longDescription,
  ].filter(Boolean).join(' ');
  const elements = descriptiveText.match(/\b(\d{1,5})\s*(?:element(?:ów|y|u)?|el\.?)(?![\p{L}\p{N}])/iu);
  if (elements?.[1]) addValue(catalog, 'liczba elementow', elements[1], 'nazwa produktu', 15);
  const players = descriptiveText.match(/\b(\d{1,2})\s*(?:[-–—]\s*(\d{1,2})|\+)?\s*(?:gracz(?:y|e|a|om)?|os(?:ób|oby)?)/iu);
  if (players?.[1]) addValue(catalog, 'liczba graczy', players[2] ? `${players[1]}-${players[2]}` : `${players[1]}${players[0].includes('+') ? '+' : ''}`, 'nazwa lub opis produktu', 15);
  if (/\bdrewnian(?:e|a|y|ych|ego|emu|ą)\b/iu.test(descriptiveText)) addValue(catalog, 'material', 'Drewno', 'nazwa produktu', 15);
  if (/\btektur(?:a|y|ze|ę|owa|owy|owe|owej)\b/iu.test(descriptiveText)) addValue(catalog, 'material', 'Tektura', 'opis produktu', 18);
  if (/\b(?:tworzywo sztuczne|plastik(?:owy|owa|owe)?)\b/iu.test(descriptiveText)) addValue(catalog, 'material', 'Tworzywo sztuczne', 'opis produktu', 16);
  return catalog;
}

const ALIASES = Object.freeze({
  ean: ['ean', 'gtin', 'kod kreskowy'],
  code: ['kod producenta', 'mpn', 'numer referencyjny', 'numer referencyjny produktu', 'symbol producenta', 'kod produktu sku', 'sku', 'external id'],
  brand: ['marka', 'producent', 'manufacturer'],
  age: ['wiek dziecka', 'minimalny wiek dziecka', 'wiek graczy od', 'wiek', 'wiek od'],
  players: ['liczba graczy', 'gracze', 'ilosc graczy'],
  elements: ['liczba elementow', 'ilosc elementow', 'elementy'],
  material: ['material', 'material wykonania'],
  color: ['kolor', 'kolor produktu'],
  size: ['rozmiar', 'wielkosc'],
  packageWeight: ['waga opakowania', 'waga produktu', 'waga'],
  packageDimensions: ['wymiary opakowania', 'wymiary produktu', 'wymiary'],
  publisher: ['wydawca', 'producent', 'marka', 'publisher'],
  language: ['wersja jezykowa', 'wersja jezykowa gry', 'jezyk', 'jezyk gry', 'jezyk instrukcji'],
  type: ['typ', 'typ produktu', 'rodzaj', 'rodzaj produktu', 'rodzaj gry'],
});

function firstCatalogValue(catalog, aliases = []) {
  for (const alias of aliases) {
    const result = catalog.get(normalizeAllegroParameterName(alias));
    if (result?.value) return result;
  }
  return null;
}

function dictionaryValues(parameter = {}) {
  return Array.isArray(parameter.dictionary) ? parameter.dictionary
    : Array.isArray(parameter.values) ? parameter.values
      : Array.isArray(parameter.restrictions?.allowedValues) ? parameter.restrictions.allowedValues
        : [];
}

function dictionaryEntry(parameter, candidates = []) {
  const entries = dictionaryValues(parameter).map((entry) => ({
    entry,
    label: String(entry?.value ?? entry?.name ?? entry?.label ?? '').trim(),
    normalized: normalizeAllegroParameterName(entry?.value ?? entry?.name ?? entry?.label ?? ''),
  }));
  const wanted = candidates.map(normalizeAllegroParameterName).filter(Boolean);
  for (const candidate of wanted) {
    const exact = entries.find((item) => item.normalized === candidate);
    if (exact) return exact.entry;
  }
  for (const candidate of wanted) {
    const relaxed = entries.find((item) => item.normalized.replace(/\b(lat|lata|rok|roku|plus)\b/g, '').trim() === candidate.replace(/\b(lat|lata|rok|roku|plus)\b/g, '').trim());
    if (relaxed) return relaxed.entry;
  }
  const tokenScore = (left = '', right = '') => {
    const a = new Set(left.split(' ').filter((token) => token.length >= 3));
    const b = new Set(right.split(' ').filter((token) => token.length >= 3));
    if (!a.size || !b.size) return 0;
    let common = 0;
    for (const token of a) if (b.has(token)) common += 1;
    return common / Math.max(a.size, b.size);
  };
  const fuzzy = [];
  for (const candidate of wanted) for (const item of entries) {
    if (candidate.length < 8 || item.normalized.length < 4) continue;
    let score = 0;
    if (candidate.includes(item.normalized) || item.normalized.includes(candidate)) score = 0.92;
    else {
      const overlap = tokenScore(candidate, item.normalized);
      if (overlap >= 0.75) score = 0.8 + overlap * 0.1;
    }
    if (score) fuzzy.push({ entry: item.entry, score, normalized: item.normalized });
  }
  fuzzy.sort((left, right) => right.score - left.score || right.normalized.length - left.normalized.length);
  if (fuzzy[0] && (!fuzzy[1] || fuzzy[0].score - fuzzy[1].score >= 0.08 || fuzzy[0].normalized === fuzzy[1].normalized)) {
    return fuzzy[0].entry;
  }
  return null;
}

function dictionaryId(entry = {}) {
  return String(entry?.id ?? entry?.valueId ?? '').trim();
}

function parameterPayload(parameter, value, candidates = []) {
  const id = String(parameter?.id ?? '').trim();
  if (!id || value === undefined || value === null || value === '') return null;
  const entry = dictionaryEntry(parameter, candidates.length ? candidates : [value]);
  const valueId = dictionaryId(entry);
  if (valueId) return { id, valuesIds: [valueId] };
  if (dictionaryValues(parameter).length) return null;
  return { id, values: [String(value).trim().slice(0, 500)] };
}

function parseNumbers(value = '') {
  return [...String(value).matchAll(/\d+(?:[.,]\d+)?/g)].map((match) => Number(match[0].replace(',', '.'))).filter(Number.isFinite);
}

function parsePlayers(value = '') {
  const text = String(value).trim();
  const numbers = parseNumbers(text).map((number) => Math.max(1, Math.round(number)));
  if (!numbers.length) return null;
  const openEnded = /\+|od\s*\d+|więcej|wiecej/i.test(text);
  return { min: numbers[0], max: openEnded ? null : (numbers[1] || numbers[0]), openEnded };
}

function parseAge(value = '') {
  const text = String(value).trim();
  const number = parseNumbers(text)[0];
  if (!Number.isFinite(number)) return null;
  const months = /mies|month|\bmc\b/i.test(text);
  return { years: months ? number / 12 : number, months, original: text };
}

function ageCandidates(age) {
  if (!age) return [];
  if (age.months) {
    const months = Math.max(0, Math.round(age.years * 12));
    return [age.original, `${months} miesięcy +`, `${months} mies. +`];
  }
  const years = Math.max(0, Math.floor(age.years));
  return [age.original, String(years), `${years} lat +`, `${years} lata +`, `${years} rok +`, `${years} lat`, `${years} lata`, `${years} rok`];
}

function genericCatalogValue(catalog, parameterName) {
  const exact = catalog.get(parameterName);
  if (exact) return exact;
  const withoutUnits = parameterName.replace(/\b(minimalna|minimalny|maksymalna|maksymalny|produktu|dziecka|opakowania|zbiorczego)\b/g, '').replace(/\s+/g, ' ').trim();
  if (withoutUnits.length >= 4) {
    for (const [key, record] of catalog) if (key === withoutUnits || key.includes(withoutUnits) || withoutUnits.includes(key)) return record;
  }
  return null;
}

export function resolveAllegroCategoryParameter(product = {}, parameter = {}) {
  const name = normalizeAllegroParameterName(parameter?.name || parameter?.id || '');
  const catalog = allegroProductParameterCatalog(product);
  let record = null;
  let payload = null;

  if (/^nazwa(?: produktu)?$/.test(name)) record = firstCatalogValue(catalog, ['nazwa', 'nazwa produktu']);
  else if (/\b(ean|gtin)\b|kod kreskowy/.test(name)) record = firstCatalogValue(catalog, ALIASES.ean);
  else if (/kod producenta|\bmpn\b|symbol producenta|numer referencyjny/.test(name)) record = firstCatalogValue(catalog, ALIASES.code);
  else if (/^(marka|producent|manufacturer)$/.test(name)) {
    record = firstCatalogValue(catalog, ALIASES.brand);
    const manufacturer = canonicalManufacturerName(record?.value);
    record = manufacturer && record ? { ...record, value: manufacturer } : null;
  }
  else if (/^stan$|stan produktu|condition/.test(name)) {
    payload = parameterPayload(parameter, 'Nowy', ['Nowy', 'new']);
    record = { value: 'Nowy', source: 'domyślna polityka nowych produktów' };
  } else if (/minimalna liczba graczy/.test(name)) {
    record = firstCatalogValue(catalog, ALIASES.players);
    const players = parsePlayers(record?.value);
    if (players) payload = parameterPayload(parameter, String(players.min), [String(players.min)]);
  } else if (/maksymalna liczba graczy/.test(name)) {
    record = firstCatalogValue(catalog, ALIASES.players);
    const players = parsePlayers(record?.value);
    if (players) payload = parameterPayload(parameter, players.max ?? 'Więcej niż 6', players.max === null ? ['Więcej niż 6', 'więcej niż 6', '6+', 'powyżej 6'] : [String(players.max)]);
  } else if (/liczba graczy/.test(name)) {
    record = firstCatalogValue(catalog, ALIASES.players);
  } else if (/minimalny wiek dziecka|minimalna granica wieku|wiek od/.test(name)) {
    record = firstCatalogValue(catalog, ALIASES.age);
    const age = parseAge(record?.value);
    if (age) payload = parameterPayload(parameter, String(Math.max(0, Math.floor(age.years))), ageCandidates(age));
  } else if (/wiek dziecka|wiek graczy|^wiek$/.test(name)) {
    record = firstCatalogValue(catalog, ALIASES.age);
    const age = parseAge(record?.value);
    if (age) payload = parameterPayload(parameter, record.value, ageCandidates(age));
  } else if (/liczba|ilosc/.test(name) && /element/.test(name)) record = firstCatalogValue(catalog, ALIASES.elements);
  else if (/material/.test(name)) record = firstCatalogValue(catalog, ALIASES.material);
  else if (/wydawca|publisher/.test(name)) {
    record = firstCatalogValue(catalog, ALIASES.publisher);
    const publisher = canonicalManufacturerName(record?.value);
    record = publisher && record ? { ...record, value: publisher } : null;
  }
  else if (/wersja jezykowa|jezyk(?: gry| instrukcji)?/.test(name)) record = firstCatalogValue(catalog, ALIASES.language);
  else if (/^(?:typ|rodzaj)(?: produktu| gry)?$/.test(name)) record = firstCatalogValue(catalog, ALIASES.type);
  else if (/kolor|color/.test(name)) record = firstCatalogValue(catalog, ALIASES.color);
  else if (/rozmiar|wielkosc|size/.test(name)) record = firstCatalogValue(catalog, ALIASES.size);
  else if (/waga/.test(name)) record = firstCatalogValue(catalog, ALIASES.packageWeight);
  else if (/wymiar/.test(name)) record = firstCatalogValue(catalog, ALIASES.packageDimensions);
  else record = genericCatalogValue(catalog, name);

  if (!payload && record?.value) payload = parameterPayload(parameter, record.value, [record.value]);
  if (!payload && parameter?.required === true && dictionaryValues(parameter).length === 1) {
    const only = dictionaryValues(parameter)[0];
    const onlyId = dictionaryId(only);
    payload = onlyId ? { id: String(parameter.id), valuesIds: [onlyId] } : parameterPayload(parameter, only?.value ?? only?.name ?? '');
    record = record || { value: only?.value ?? only?.name ?? '', source: 'jedyna wartość kategorii' };
  }
  return payload ? { payload, source: record?.source || 'kartoteka produktu', sourceValue: record?.value || '' } : null;
}

export function allegroAutomaticCategoryParameters(product = {}, categoryParameters = []) {
  const seen = new Set();
  const parameters = [];
  for (const parameter of Array.isArray(categoryParameters) ? categoryParameters : []) {
    const resolved = resolveAllegroCategoryParameter(product, parameter);
    if (!resolved?.payload) continue;
    const id = String(resolved.payload.id || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    parameters.push(resolved.payload);
  }
  return parameters;
}
