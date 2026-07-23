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

  const direct = [
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
  ];
  for (const [names, value] of direct) for (const name of names) addValue(catalog, name, value, 'kartoteka produktu', 100);
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

  if (/\b(ean|gtin)\b|kod kreskowy/.test(name)) record = firstCatalogValue(catalog, ALIASES.ean);
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
