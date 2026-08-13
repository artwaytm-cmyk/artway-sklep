import { canonicalManufacturerName } from './product-field-validation.mjs';
import { allegroProductCommercialIdentity } from './allegro-commercial-identity.mjs';

const EMPTY = new Set(['', '-', '—', 'brak', 'nie dotyczy', 'n/d', 'null', 'undefined']);

export function normalizeAllegroParameterName(value = '') {
  return String(value ?? '')
    .replace(/([a-ząćęłńóśźż])([A-ZĄĆĘŁŃÓŚŹŻ])/g, '$1 $2')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Łł]/g, 'l')
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

function semanticSourceAliases(name = '') {
  const key = normalizeAllegroParameterName(name);
  if (/\b(ean|gtin|kod kreskowy)\b/.test(key)) return ['ean', 'gtin', 'kod kreskowy'];
  if (/kod producenta|\bmpn\b|numer referencyjny|\bnr ref\b|symbol producenta|^symbol$/.test(key)) {
    return ['kod producenta', 'mpn', 'numer referencyjny', 'symbol producenta'];
  }
  if (/^(marka|brand)$/.test(key)) return ['marka', 'brand'];
  if (/^(producent|manufacturer)$/.test(key)) return ['producent', 'manufacturer'];
  if (/^(wydawca|publisher)$/.test(key)) return ['wydawca', 'publisher'];
  if (/wiek/.test(key)) return ['wiek', 'wiek dziecka', 'minimalny wiek dziecka', 'wiek graczy od'];
  if (/liczba graczy|ilosc graczy|gracze/.test(key)) return ['liczba graczy', 'gracze'];
  if (/(liczba|ilosc).*(element|puzzl|czesc)|^(elementy|puzzle)$/.test(key)) {
    return ['liczba elementow', 'ilosc elementow', 'liczba puzzli', 'ilosc puzzli'];
  }
  if (/material|tworzywo|wykonanie/.test(key)) return ['material', 'material wykonania'];
  if (/wypelnienie|napelnienie/.test(key)) return ['wypelnienie', 'napelnienie'];
  if (/liczba sztuk|ilosc sztuk/.test(key)) return ['liczba sztuk', 'ilosc sztuk'];
  if (/wersja jezykowa|jezyk/.test(key)) return ['wersja jezykowa', 'wersja jezykowa gry', 'jezyk'];
  if (/^(typ|rodzaj)( produktu| gry)?$/.test(key)) return ['typ', 'rodzaj produktu'];
  if (/^(seria|linia|kolekcja|model)$/.test(key)) return ['seria', 'linia', 'kolekcja', 'model'];
  if (/kolor/.test(key)) return ['kolor', 'kolor produktu'];
  if (/rozmiar|wielkosc/.test(key)) return ['rozmiar', 'wielkosc'];
  if (/waga/.test(key)) return ['waga', 'waga produktu', 'waga opakowania'];
  if (/wymiar/.test(key)) return ['wymiary', 'wymiary produktu', 'wymiary opakowania'];
  if (/ostrze|bezpieczen|gpsr/.test(key)) return ['ostrzezenia', 'informacje o bezpieczenstwie', 'gpsr'];
  return [];
}

function setCatalogValue(catalog, name, value, source, priority = 0) {
  const key = normalizeAllegroParameterName(name);
  const cleaned = cleanValue(value);
  if (!key || !cleaned) return;
  const previous = catalog.get(key);
  if (!previous || priority > previous.priority) catalog.set(key, { value: cleaned, source, priority });
}

function addValue(catalog, name, value, source, priority = 0) {
  setCatalogValue(catalog, name, value, source, priority);
  for (const alias of semanticSourceAliases(name)) {
    setCatalogValue(catalog, alias, value, source, Math.max(0, priority - 1));
  }
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
    color: ['kolor', 'kolor produktu', 'kolor dominujący'],
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
  const commercial = allegroProductCommercialIdentity(product);
  const sourceMaterial = product?.sourceMaterial && typeof product.sourceMaterial === 'object' ? product.sourceMaterial : {};
  const packagingFacts = product?.productPackagingFacts && typeof product.productPackagingFacts === 'object'
    ? {
        'minimalny wiek dziecka': product.productPackagingFacts.minimumAge || product.productPackagingFacts.age,
        material: product.productPackagingFacts.material,
        'informacje o bezpieczenstwie': product.productPackagingFacts.safetyInformation,
      }
    : {};
  for (const [object, source, priority] of [
    [sourceMaterial.parameters, 'materiał źródłowy', 20],
    [sourceMaterial.specification, 'specyfikacja źródłowa', 20],
    [product.parametryZrodla, 'parametry źródła', 30],
    [product.parametryProducenta, 'parametry producenta', 40],
    [product.specyfikacja, 'specyfikacja produktu', 45],
    [product.atrybuty, 'atrybuty produktu', 45],
    [packagingFacts, 'oficjalne opakowanie produktu', 90],
  ]) addObject(catalog, object, source, priority);
  addEvidenceObject(catalog, product.allegroParameterEvidence, 60);

  const direct = [
    [['nazwa', 'nazwa produktu'], product.nazwa || product.name || product.allegroTitle],
    [['ean', 'gtin', 'kod kreskowy'], product.gtin || product.ean],
    [['kod producenta', 'mpn', 'numer referencyjny', 'symbol producenta', 'sku', 'external id'], product.kodProducenta || product.mpn || product.numerReferencyjny || product.externalId || product.sku],
    [['marka', 'brand'], commercial.brand],
    [['producent', 'manufacturer'], commercial.manufacturer],
    [['wiek', 'wiek dziecka', 'minimalny wiek dziecka', 'wiek graczy od'], product.wiek || product.wiekDziecka || product.minimalnyWiekDziecka || product.wiekGraczyOd],
    [['liczba graczy'], product.liczbaGraczy || product.gracze],
    [['liczba elementow'], product.liczbaElementow],
    [['material'], product.material],
    [['wypelnienie', 'napelnienie'], product.wypelnienie || product.napelnienie],
    [['liczba sztuk', 'ilosc sztuk'], product.liczbaSztuk || product.iloscSztuk || product.quantity],
    [['kolor', 'kolor produktu'], product.kolorProduktu || product.color],
    [['rozmiar'], product.rozmiar || product.size],
    [['waga opakowania', 'waga'], product.wagaOpakowania || product.waga],
    [['wymiary opakowania'], product.wymiaryOpakowania],
    [['wydawca', 'publisher'], commercial.publisher],
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
  if (/\bbalon(?:y)?\b/iu.test(descriptiveText) && /\bfoliow(?:y|a|e|ego|ej|ych)\b/iu.test(descriptiveText)) {
    addValue(catalog, 'material', 'folia', 'jednoznaczna nazwa i opis balonu', 25);
    const hasHel = /\bhel(?:em|u)?\b/iu.test(descriptiveText);
    const hasAir = /\bpowietrz(?:e|em|a)\b/iu.test(descriptiveText);
    if (hasHel && hasAir) addValue(catalog, 'wypelnienie', 'powietrze lub hel', 'opis sposobu napełnienia', 25);
    else if (hasHel) addValue(catalog, 'wypelnienie', 'hel', 'opis sposobu napełnienia', 25);
    else if (hasAir) addValue(catalog, 'wypelnienie', 'powietrze', 'opis sposobu napełnienia', 25);
    const explicitQuantity = descriptiveText.match(/\b(\d{1,4})\s*szt(?:\.|uk(?:a|i)?)?\b/iu)?.[1] || '';
    if (explicitQuantity) addValue(catalog, 'liczba sztuk', explicitQuantity, 'nazwa lub opis produktu', 25);
    else if (!/\b(?:zestaw|komplet|pakiet|mix)\b/iu.test(descriptiveText)) addValue(catalog, 'liczba sztuk', '1', 'pojedynczy balon w kartotece', 20);
  }
  return catalog;
}

const ALIASES = Object.freeze({
  ean: ['ean', 'gtin', 'kod kreskowy'],
  code: ['kod producenta', 'mpn', 'numer referencyjny', 'numer referencyjny produktu', 'symbol producenta', 'kod produktu sku', 'sku', 'external id'],
  brand: ['marka', 'brand'],
  manufacturer: ['producent', 'manufacturer'],
  age: ['wiek dziecka', 'minimalny wiek dziecka', 'wiek graczy od', 'wiek', 'wiek od'],
  players: ['liczba graczy', 'gracze', 'ilosc graczy'],
  elements: ['liczba elementow', 'ilosc elementow', 'elementy', 'liczba puzzli', 'ilosc puzzli'],
  material: ['material', 'material wykonania'],
  filling: ['wypelnienie', 'napelnienie'],
  quantity: ['liczba sztuk', 'ilosc sztuk'],
  color: ['kolor', 'kolor produktu'],
  size: ['rozmiar', 'wielkosc'],
  packageWeight: ['waga opakowania', 'waga produktu', 'waga'],
  packageDimensions: ['wymiary opakowania', 'wymiary produktu', 'wymiary'],
  publisher: ['wydawca', 'publisher'],
  series: ['seria', 'linia', 'kolekcja', 'model'],
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
  if (dictionaryValues(parameter).length) {
    const ambiguousValueId = String(parameter?.options?.ambiguousValueId || '').trim();
    if (parameter?.options?.customValuesEnabled === true && ambiguousValueId) {
      return { id, valuesIds: [ambiguousValueId], values: [String(value).trim().slice(0, 500)] };
    }
    return null;
  }
  const type = String(parameter?.type || '').toLowerCase();
  const restrictions = parameter?.restrictions && typeof parameter.restrictions === 'object' ? parameter.restrictions : {};
  let output = String(value).trim();
  if (type === 'integer' || type === 'float') {
    const number = parseNumbers(output)[0];
    if (!Number.isFinite(number)) return null;
    if (Number.isFinite(Number(restrictions.min)) && number < Number(restrictions.min)) return null;
    if (Number.isFinite(Number(restrictions.max)) && number > Number(restrictions.max)) return null;
    output = type === 'integer' ? String(Math.round(number)) : String(number);
  }
  const maxLength = Math.min(500, Math.max(1, Number(restrictions.maxLength) || 500));
  output = output.slice(0, maxLength);
  return output ? { id, values: [output] } : null;
}

function channelValueForPayload(parameter = {}, payload = {}) {
  if (Array.isArray(payload.values) && payload.values.length) return payload.values.join(', ');
  const ids = new Set(Array.isArray(payload.valuesIds) ? payload.valuesIds.map(String) : []);
  if (!ids.size) return '';
  return dictionaryValues(parameter)
    .filter((entry) => ids.has(dictionaryId(entry)))
    .map((entry) => String(entry?.value ?? entry?.name ?? entry?.label ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

function parseNumbers(value = '') {
  return [...String(value).matchAll(/\d+(?:[.,]\d+)?/g)].map((match) => Number(match[0].replace(',', '.'))).filter(Number.isFinite);
}

function colorParameterCandidates(value = '') {
  const normalized = normalizeAllegroParameterName(value);
  const colors = [
    'bezbarwny', 'bezowy', 'bialy', 'brazowy', 'czarny', 'czerwony', 'fioletowy',
    'niebieski', 'pomaranczowy', 'rozowy', 'srebrny', 'szary', 'zielony', 'zloty', 'zolty',
  ].filter((color) => new RegExp(`(?:^|\\s)${color}(?:\\s|$)`).test(normalized));
  return new Set(colors).size >= 2
    ? ['wielokolorowy', 'różne kolory']
    : [value];
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

function ageRangeCandidates(parameter = {}, age = null) {
  if (!age || age.months) return [];
  const years = Math.max(0, Math.floor(age.years));
  const matches = dictionaryValues(parameter).map((entry) => {
    const label = String(entry?.value ?? entry?.name ?? entry?.label ?? '').trim();
    const normalized = normalizeAllegroParameterName(label);
    const numbers = parseNumbers(normalized);
    let min = null, max = null;
    if (/^(?:do|ponizej)\b/.test(normalized) && numbers.length) {
      min = 0; max = numbers[0];
    } else if (numbers.length >= 2) {
      [min, max] = numbers;
    } else if (numbers.length === 1 && /\+|od\b|powyzej/.test(normalized)) {
      min = numbers[0]; max = Number.POSITIVE_INFINITY;
    }
    if (!Number.isFinite(min) || years < min || years > max) return null;
    return { label, min, openEnded: max === Number.POSITIVE_INFINITY };
  }).filter(Boolean).sort((left, right) => (
    Number(right.openEnded) - Number(left.openEnded) || right.min - left.min
  ));
  return matches.map((item) => item.label);
}

function typeCandidates(value = '', product = {}) {
  const source = String(value || '').trim();
  const normalized = normalizeAllegroParameterName(source);
  const variants = [source];
  for (const [pattern, names] of [
    [/\bkarcian/, ['gra karciana', 'karciana', 'karciane']],
    [/\bplansz/, ['gra planszowa', 'planszowa', 'planszowe']],
    [/\bedukacyjn/, ['gra edukacyjna', 'edukacyjna', 'edukacyjne']],
    [/\brodzinn/, ['gra rodzinna', 'rodzinna', 'rodzinne']],
    [/\bzrecznosciow/, ['gra zręcznościowa', 'zręcznościowa', 'zręcznościowe']],
    [/\btowarzysk/, ['gra towarzyska', 'towarzyska', 'towarzyskie']],
  ]) if (pattern.test(normalized)) variants.push(...names);
  if (normalized === 'gra') variants.push('gra planszowa', 'planszowa');
  const productText = normalizeAllegroParameterName([
    product.nazwa, product.name, product.kategoria, product.category,
    product.opisKrotki, product.opis,
  ].filter(Boolean).join(' '));
  if (/\b(?:dodatek|rozszerzenie|expansion)\b/.test(productText)) variants.push('Dodatek');
  else variants.push('Podstawa');
  return [...new Set(variants.filter(Boolean))];
}

function genericCatalogValue(catalog, parameterName) {
  const exact = catalog.get(parameterName);
  if (exact) return exact;
  const withoutUnits = parameterName.replace(/\b(minimalna|minimalny|maksymalna|maksymalny|produktu|dziecka|opakowania|zbiorczego)\b/g, '').replace(/\s+/g, ' ').trim();
  if (withoutUnits.length >= 4) {
    for (const [key, record] of catalog) if (key === withoutUnits || key.includes(withoutUnits) || withoutUnits.includes(key)) return record;
  }
  const wanted = new Set(withoutUnits.split(' ').filter((token) => token.length >= 4));
  if (wanted.size >= 2) {
    let best = null;
    for (const [key, record] of catalog) {
      const available = new Set(key.split(' ').filter((token) => token.length >= 4));
      let common = 0;
      for (const token of wanted) if (available.has(token)) common += 1;
      const score = common / Math.max(wanted.size, available.size);
      if (common >= 2 && score >= 0.67 && (!best || score > best.score)) best = { record, score };
    }
    if (best) return best.record;
  }
  return null;
}

export function resolveAllegroCategoryParameter(product = {}, parameter = {}) {
  const name = normalizeAllegroParameterName(parameter?.name || parameter?.id || '');
  const catalog = allegroProductParameterCatalog(product);
  const commercial = allegroProductCommercialIdentity(product);
  let record = null;
  let payload = null;

  if (/^nazwa(?: produktu)?$/.test(name)) record = firstCatalogValue(catalog, ['nazwa', 'nazwa produktu']);
  else if (/\b(ean|gtin)\b|kod kreskowy/.test(name)) record = firstCatalogValue(catalog, ALIASES.ean);
  else if (/kod producenta|\bmpn\b|symbol producenta|numer referencyjny/.test(name)) record = firstCatalogValue(catalog, ALIASES.code);
  else if (/^(marka|brand)$/.test(name)) {
    record = firstCatalogValue(catalog, ALIASES.brand);
    const brand = canonicalManufacturerName(record?.value);
    record = brand && record ? { ...record, value: brand } : null;
    if (record) payload = parameterPayload(parameter, record.value, commercial.brandCandidates);
  }
  else if (/^(producent|manufacturer)$/.test(name)) {
    record = firstCatalogValue(catalog, ALIASES.manufacturer);
    const manufacturer = canonicalManufacturerName(record?.value);
    record = manufacturer && record ? { ...record, value: manufacturer } : null;
    if (record) payload = parameterPayload(parameter, record.value, commercial.manufacturerCandidates);
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
  } else if (/wiek dziecka|wiek gracz(?:a|y)|^wiek$/.test(name)) {
    record = firstCatalogValue(catalog, ALIASES.age);
    const age = parseAge(record?.value);
    if (age) payload = parameterPayload(parameter, record.value, [...ageCandidates(age), ...ageRangeCandidates(parameter, age)]);
  } else if (/liczba|ilosc/.test(name) && /element|puzzl|czesc/.test(name)) record = firstCatalogValue(catalog, ALIASES.elements);
  else if (/material/.test(name)) record = firstCatalogValue(catalog, ALIASES.material);
  else if (/wypelnienie|napelnienie/.test(name)) record = firstCatalogValue(catalog, ALIASES.filling);
  else if (/liczba sztuk|ilosc sztuk/.test(name)) record = firstCatalogValue(catalog, ALIASES.quantity);
  else if (/wydawca|publisher/.test(name)) {
    record = firstCatalogValue(catalog, ALIASES.publisher);
    const publisher = canonicalManufacturerName(record?.value);
    record = publisher && record ? { ...record, value: publisher } : null;
    if (record) payload = parameterPayload(parameter, record.value, commercial.publisherCandidates);
  }
  else if (/^(seria|linia|kolekcja|model)$/.test(name)) record = firstCatalogValue(catalog, ALIASES.series);
  else if (/wersja jezykowa|jezyk(?: gry| instrukcji)?/.test(name)) record = firstCatalogValue(catalog, ALIASES.language);
  else if (/^(?:typ|rodzaj)(?: produktu| gry)?$/.test(name)) {
    record = firstCatalogValue(catalog, ALIASES.type);
    if (record) payload = parameterPayload(parameter, record.value, typeCandidates(record.value, product));
  }
  else if (/kolor|color/.test(name)) {
    record = firstCatalogValue(catalog, ALIASES.color);
    if (record && /^(?:kolor|color|kolor dominujacy|kolor produktu)$/.test(name)) {
      payload = parameterPayload(parameter, record.value, colorParameterCandidates(record.value));
    }
  }
  else if (/rozmiar|wielkosc|size/.test(name)) record = firstCatalogValue(catalog, ALIASES.size);
  else if (/waga/.test(name)) record = firstCatalogValue(catalog, ALIASES.packageWeight);
  else if (/wymiar/.test(name)) record = firstCatalogValue(catalog, ALIASES.packageDimensions);
  else record = genericCatalogValue(catalog, name);

  if (!payload && record?.value) payload = parameterPayload(parameter, record.value, [record.value]);
  if (!payload && (parameter?.required === true || parameter?.requiredForProduct === true) && dictionaryValues(parameter).length === 1) {
    const only = dictionaryValues(parameter)[0];
    const onlyId = dictionaryId(only);
    payload = onlyId ? { id: String(parameter.id), valuesIds: [onlyId] } : parameterPayload(parameter, only?.value ?? only?.name ?? '');
    record = record || { value: only?.value ?? only?.name ?? '', source: 'jedyna wartość kategorii' };
  }
  if (!payload) return null;
  const sourceValue = record?.value || '';
  const channelValue = channelValueForPayload(parameter, payload) || sourceValue;
  return {
    payload,
    source: record?.source || 'kartoteka produktu',
    sourceValue,
    channelValue,
    strategy: normalizeAllegroParameterName(sourceValue) === normalizeAllegroParameterName(channelValue)
      ? 'direct'
      : 'allegro_dictionary_fallback',
  };
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

export function allegroCategoryParameterResolutionReport(product = {}, categoryParameters = []) {
  return (Array.isArray(categoryParameters) ? categoryParameters : []).map((parameter) => {
    const resolved = resolveAllegroCategoryParameter(product, parameter);
    return {
      id: String(parameter?.id || ''),
      name: String(parameter?.name || ''),
      required: parameter?.required === true || parameter?.requiredForProduct === true,
      resolved: !!resolved?.payload,
      source: resolved?.source || '',
      sourceValue: resolved?.sourceValue || '',
      channelValue: resolved?.channelValue || '',
      strategy: resolved?.strategy || 'missing',
      payload: resolved?.payload || null,
    };
  });
}
