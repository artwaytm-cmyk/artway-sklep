import { normalizeAllegroParameterName } from './allegro-category-parameter-resolver.mjs';
import { allegroProductCommercialIdentity } from './allegro-commercial-identity.mjs';

const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const asArray = (value) => Array.isArray(value) ? value : [];
const clean = (value, limit = 5000) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
const relatedProductIndexCache = new WeakMap();

const PARAMETER_ALIASES = Object.freeze({
  safety: [
    'ostrzezenie', 'ostrzezenia', 'ostrzeżenie', 'ostrzeżenia', 'warning', 'warnings',
    'informacja o bezpieczenstwie', 'informacje o bezpieczenstwie', 'bezpieczenstwo', 'gpsr',
  ],
  age: [
    'wiek', 'wiek dziecka', 'wiek graczy od', 'wiek od', 'minimalny wiek dziecka',
    'minimalna granica wieku', 'zalecany wiek', 'wiek minimalny',
  ],
  players: [
    'liczba graczy', 'liczba graczy od do', 'ilosc graczy', 'gracze',
    'minimalna liczba graczy', 'maksymalna liczba graczy',
  ],
  language: [
    'wersja jezykowa', 'wersja jezykowa gry', 'jezyk', 'jezyk gry', 'jezyk instrukcji',
  ],
  type: ['typ', 'typ produktu', 'rodzaj', 'rodzaj produktu', 'rodzaj gry'],
  material: ['material', 'material wykonania', 'wykonanie', 'tworzywo'],
  color: ['kolor', 'kolor produktu', 'kolor dominujacy', 'barwa'],
  publisher: ['wydawca', 'producent', 'marka', 'manufacturer', 'publisher'],
  series: ['seria', 'linia', 'kolekcja', 'model series'],
});

function flattenedParameterEntries(product = {}) {
  const sourceMaterial = asObject(product.sourceMaterial);
  const packagingFacts = asObject(product.productPackagingFacts);
  const packaging = {
    'minimalny wiek dziecka': packagingFacts.minimumAge || packagingFacts.age,
    material: packagingFacts.material,
    'informacja o bezpieczeństwie': packagingFacts.safetyInformation,
  };
  const direct = {
    ostrzezenie: product.ostrzezenie,
    ostrzezenia: product.ostrzezenia,
    informacjaBezpieczenstwa: product.informacjaBezpieczenstwa,
    wiek: product.wiek,
    wiekDziecka: product.wiekDziecka,
    minimalnyWiekDziecka: product.minimalnyWiekDziecka,
    liczbaGraczy: product.liczbaGraczy,
    gracze: product.gracze,
    wersjaJezykowa: product.wersjaJezykowa,
    jezyk: product.jezyk,
    language: product.language,
    typ: product.typ,
    rodzaj: product.rodzaj,
    material: product.material,
    wydawca: product.wydawca,
    producent: product.producent,
    marka: product.marka,
    seria: product.seria,
  };
  const sources = [
    ['oficjalne opakowanie produktu', packaging],
    ['kartoteka', direct],
    ['parametry producenta', asObject(product.parametryProducenta)],
    ['parametry źródła', asObject(product.parametryZrodla)],
    ['materiał źródłowy', asObject(sourceMaterial.parameters)],
    ['specyfikacja źródłowa', asObject(sourceMaterial.specification)],
    ['specyfikacja produktu', asObject(product.specyfikacja)],
    ['atrybuty produktu', asObject(product.atrybuty)],
  ];
  const entries = [];
  for (const [source, object] of sources) {
    for (const [name, rawValue] of Object.entries(asObject(object))) {
      if (rawValue && typeof rawValue === 'object') continue;
      const value = clean(rawValue);
      if (!value || /^(?:-|—|brak|nie dotyczy|n\/d|null|undefined)$/i.test(value)) continue;
      entries.push({ key: normalizeAllegroParameterName(name), value, source });
    }
  }
  return entries;
}

function firstAliasedValue(product = {}, aliases = []) {
  return firstAliasedValueFromEntries(flattenedParameterEntries(product), aliases);
}

function firstAliasedValueFromEntries(entries = [], aliases = []) {
  const wanted = new Set(aliases.map(normalizeAllegroParameterName));
  return entries.find((entry) => wanted.has(entry.key)) || null;
}

function productText(product = {}) {
  const sourceMaterial = asObject(product.sourceMaterial);
  return clean([
    product.nazwa, product.name, product.allegroTitle, product.opisKrotki, product.opis,
    sourceMaterial.title, sourceMaterial.shortDescription, sourceMaterial.longDescription,
    product.kategoria, product.category,
  ].filter(Boolean).join(' '), 50000);
}

function manufacturerKey(product = {}) {
  return normalizeAllegroParameterName(allegroProductCommercialIdentity(product).manufacturer);
}

function seriesValue(product = {}) {
  const explicit = firstAliasedValue(product, PARAMETER_ALIASES.series)?.value || clean(product.seria, 200);
  if (explicit) return explicit;
  const name = normalizeAllegroParameterName(product.nazwa || product.name || asObject(product.sourceMaterial).title || '');
  if (/\bmaxi puzzle 24\b/.test(name)) return 'Maxi Puzzle 24';
  return '';
}

function productKind(product = {}) {
  const value = normalizeAllegroParameterName([
    product.nazwa, product.name, product.kategoria, product.category, product.opisKrotki,
    asObject(product.sourceMaterial).title, asObject(product.sourceMaterial).shortDescription,
  ].filter(Boolean).join(' '));
  if (/\bpuzzle\b/.test(value)) return 'puzzle';
  if (/\b(?:x press|brelok|bizuter|koralik)\b/.test(value)) return 'zestaw kreatywny';
  if (/\b(?:origami|kreatywn|malowank|model|metalcraft)\b/.test(value)) return 'zestaw kreatywny';
  if (/\b(?:gra|gry|plansz|karcian|edukart)\b/.test(value)) return 'gra';
  if (/\b(?:zegar edukacyjny)\b/.test(value)) return 'zabawka edukacyjna';
  if (/\b(?:balon)\b/.test(value)) return 'balon';
  if (/\b(?:wiatrak|wiatraczek)\b/.test(value)) return 'zabawka';
  return normalizeAllegroParameterName(product.kategoria || product.category || '').slice(0, 100);
}

function wordSet(value = '') {
  return new Set(normalizeAllegroParameterName(value).split(' ').filter((word) => (
    word.length >= 4 && !['alexander', 'produkt', 'zestaw', 'elementow', 'elementy'].includes(word)
  )));
}

function tokenSimilarity(left = '', right = '') {
  const a = wordSet(left), b = wordSet(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / Math.max(a.size, b.size);
}

function normalizedEvidenceValue(field, value = '') {
  const text = clean(value, 5000);
  if (!text) return '';
  if (field === 'age' || field === 'players') {
    return normalizeAllegroParameterName(text)
      .replace(/\b(?:lat|lata|rok|roku|miesiecy|miesiac|osob|osoby|graczy|gracz)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return normalizeAllegroParameterName(text);
}

function genericSafetyText(value = '') {
  return /(?:lista ostrzezen|ogolne zasady bezpieczenstwa|zawsze zapoznaj sie z instrukcja|produkt nalezy uzywac zgodnie z przeznaczeniem)/
    .test(normalizeAllegroParameterName(value));
}

function ageKey(product = {}) {
  const raw = firstAliasedValue(product, PARAMETER_ALIASES.age)?.value || '';
  const normalized = normalizeAllegroParameterName(raw);
  const minimum = normalized.match(/\d+/)?.[0] || '';
  if (!minimum) return normalizedEvidenceValue('age', raw);
  return /\b(?:miesiac|miesiace|miesiecy|month|months)\b/.test(normalized)
    ? `months:${minimum}`
    : `years:${minimum}`;
}

function peerScore(product, candidate, profile = {}, target = {}) {
  if (!candidate || String(candidate.id || candidate.product_id || '') === String(product.id || product.product_id || '')) return 0;
  const producer = target.manufacturer ?? manufacturerKey(product);
  const candidateProducer = profile.manufacturer ?? manufacturerKey(candidate);
  if (!producer || producer !== candidateProducer) return 0;
  let score = 35;
  const series = target.series ?? normalizeAllegroParameterName(seriesValue(product));
  const candidateSeries = profile.series ?? normalizeAllegroParameterName(seriesValue(candidate));
  if (series && candidateSeries && series === candidateSeries) score += 40;
  const kind = target.kind ?? productKind(product);
  const candidateKind = profile.kind ?? productKind(candidate);
  if (kind && kind === candidateKind) score += 20;
  if (product.allegroCategoryId && String(product.allegroCategoryId) === String(candidate.allegroCategoryId || '')) score += 10;
  score += Math.round(tokenSimilarity(product.nazwa || product.name, candidate.nazwa || candidate.name) * 15);
  if (candidate.allegroAgentPreparationStatus === 'ready' || candidate.hasAllegro === true) score += 5;
  return Math.min(100, score);
}

function candidateEvidence(peer, field) {
  const candidate = peer.candidate;
  if (field === 'publisher') {
    const publisher = allegroProductCommercialIdentity(candidate).publisher;
    return publisher ? { value: publisher, source: 'producent podobnego produktu' } : null;
  }
  if (field === 'safety') {
    const wanted = new Set((PARAMETER_ALIASES.safety || []).map(normalizeAllegroParameterName));
    const evidence = peer.entries.find((entry) => (
      wanted.has(entry.key)
      && /^(?:parametry producenta|parametry źródła|materiał źródłowy|specyfikacja źródłowa)$/.test(entry.source)
    ));
    if (evidence && !genericSafetyText(evidence.value)) return { ...evidence, source: `${evidence.source} podobnego produktu` };
    const catalogSafety = clean(candidate.allegroSafetyInformation?.description);
    const catalogProvenance = asObject(candidate.allegroSafetyInformationProvenance);
    const exactCatalog = /exact gtin verified catalog product/.test(normalizeAllegroParameterName(catalogProvenance.method || ''))
      && /katalog produktow allegro/.test(normalizeAllegroParameterName(catalogProvenance.source || ''));
    return catalogSafety && exactCatalog && !genericSafetyText(catalogSafety)
      ? { value: catalogSafety, source: 'dokładne dopasowanie EAN w Katalogu Produktów Allegro' }
      : null;
  }
  return firstAliasedValueFromEntries(peer.entries, PARAMETER_ALIASES[field] || []);
}

function relatedProductIndex(relatedProducts) {
  const cacheable = relatedProducts && typeof relatedProducts === 'object';
  if (cacheable && relatedProductIndexCache.has(relatedProducts)) return relatedProductIndexCache.get(relatedProducts);
  const candidates = relatedProducts instanceof Map ? [...relatedProducts.values()] : asArray(relatedProducts);
  const byManufacturer = new Map();
  for (const candidate of candidates) {
    const manufacturer = manufacturerKey(candidate);
    if (!manufacturer) continue;
    const profile = {
      candidate,
      manufacturer,
      series: normalizeAllegroParameterName(seriesValue(candidate)),
      kind: productKind(candidate),
      age: ageKey(candidate),
      entries: flattenedParameterEntries(candidate),
    };
    const group = byManufacturer.get(manufacturer) || [];
    group.push(profile);
    byManufacturer.set(manufacturer, group);
  }
  const index = { byManufacturer, size: candidates.length };
  if (cacheable) relatedProductIndexCache.set(relatedProducts, index);
  return index;
}

function peerProfiles(product, index) {
  const producer = manufacturerKey(product);
  if (!producer) return [];
  const target = {
    manufacturer: producer,
    series: normalizeAllegroParameterName(seriesValue(product)),
    kind: productKind(product),
  };
  return (index?.byManufacturer?.get(producer) || []).map((profile) => {
    const { candidate } = profile;
    const score = peerScore(product, candidate, profile, target);
    if (!score) return null;
    return {
      ...profile,
      score,
    };
  }).filter(Boolean);
}

function consensusEvidence(product, peers, field, {
  minimumScore = 75,
  minimumMatches = 2,
  minimumShare = 0.6,
  requireExactSeries = false,
  requireSameCategory = false,
  requireSameKind = false,
  requireSameAge = false,
} = {}) {
  const targetSeries = normalizeAllegroParameterName(seriesValue(product));
  const targetCategory = String(product.allegroCategoryId || '');
  const targetKind = productKind(product);
  const targetAge = ageKey(product);
  const groups = new Map();
  for (const peer of peers) {
    const { candidate, score } = peer;
    if (score < minimumScore) continue;
    if (requireExactSeries && (!targetSeries || targetSeries !== peer.series)) continue;
    if (requireSameCategory && (!targetCategory || targetCategory !== String(candidate.allegroCategoryId || ''))) continue;
    if (requireSameKind && (!targetKind || targetKind !== peer.kind)) continue;
    if (requireSameAge && (!targetAge || targetAge !== peer.age)) continue;
    const evidence = candidateEvidence(peer, field);
    const key = normalizedEvidenceValue(field, evidence?.value);
    if (!key) continue;
    const group = groups.get(key) || { value: evidence.value, totalScore: 0, matches: [] };
    group.totalScore += score;
    group.matches.push({
      productId: String(candidate.id || candidate.product_id || ''),
      name: clean(candidate.nazwa || candidate.name, 180),
      score,
      source: evidence.source,
    });
    groups.set(key, group);
  }
  const ranked = [...groups.values()].sort((left, right) => (
    right.matches.length - left.matches.length || right.totalScore - left.totalScore
  ));
  const selected = ranked[0];
  if (!selected || selected.matches.length < minimumMatches) return null;
  const totalMatches = ranked.reduce((total, group) => total + group.matches.length, 0);
  if (totalMatches && selected.matches.length / totalMatches < minimumShare) return null;
  const runnerUp = ranked[1];
  if (runnerUp && runnerUp.matches.length === selected.matches.length && runnerUp.totalScore >= selected.totalScore * 0.9) return null;
  const confidence = Math.min(0.99, (selected.totalScore / (selected.matches.length * 100)) * 0.75 + Math.min(0.2, selected.matches.length * 0.05));
  return {
    value: selected.value,
    source: `konsensus ${selected.matches.length} podobnych produktów`,
    confidence: Number(confidence.toFixed(3)),
    candidates: selected.matches.slice(0, 10),
  };
}

function inferredLanguage(product = {}) {
  const explicit = firstAliasedValue(product, PARAMETER_ALIASES.language);
  if (explicit) return { ...explicit, confidence: 1 };
  const sourceUrl = clean(product.sourceUrl || product.producentUrl || asObject(product.sourceMaterial).url, 1000);
  const text = productText(product);
  const polishSource = /(?:^|[/.])(?:sklep\.)?(?:alexander|multigra)\.com\.pl(?:[/:]|$)/i.test(sourceUrl);
  const polishInstruction = /\b(?:instrukcj[aeę]|zasady gry|zawartosc opakowania|liczba graczy|wiek)\b/i.test(text);
  if (polishSource && polishInstruction) {
    return { value: 'Polska', source: 'polski producent i polska instrukcja/opis źródłowy', confidence: 0.9 };
  }
  return null;
}

function inferredMaterial(product = {}) {
  const explicit = firstAliasedValue(product, PARAMETER_ALIASES.material);
  if (explicit) return { ...explicit, confidence: 1 };
  const value = normalizeAllegroParameterName(productText(product));
  for (const [pattern, material] of [
    [/\bbalon foliow|\bfoliow(?:y|a|e|ego|ej|ych) balon/, 'folia'],
    [/\bdrewnian|\bdrewno\b/, 'Drewno'],
    [/\btektur|\bkarton\b/, 'Tektura'],
    [/\bmetal|\bstalow|\balumini/, 'Metal'],
    [/\btworzyw|\bplastik/, 'Tworzywo sztuczne'],
    [/\bpapier/, 'Papier'],
  ]) {
    if (pattern.test(value)) return { value: material, source: 'jednoznaczna informacja w opisie produktu', confidence: 0.94 };
  }
  return null;
}

function inferredColor(product = {}) {
  const explicit = firstAliasedValue(product, PARAMETER_ALIASES.color);
  if (explicit) return { ...explicit, confidence: 1 };
  const text = productText(product);
  const colors = [
    ['Biały', 'bialy', 'bialym', 'biela'],
    ['Czarny', 'czarny', 'czarnym', 'czern'],
    ['Czerwony', 'czerwony', 'czerwonym', 'czerwien'],
    ['Niebieski', 'niebieski', 'niebieskim', 'blekitny', 'blekitnym'],
    ['Zielony', 'zielony', 'zielonym'],
    ['Żółty', 'zolty', 'zoltym'],
    ['Pomarańczowy', 'pomaranczowy', 'pomaranczowym'],
    ['Różowy', 'rozowy', 'rozowym'],
    ['Fioletowy', 'fioletowy', 'fioletowym'],
    ['Brązowy', 'brazowy', 'brazowym'],
    ['Złoty', 'zloty', 'zlotym'],
    ['Srebrny', 'srebrny', 'srebrnym'],
    ['Szary', 'szary', 'szarym'],
    ['Beżowy', 'bezowy', 'bezowym'],
  ];
  const normalized = normalizeAllegroParameterName(text);
  const matches = [];
  for (const [value, ...forms] of colors) {
    if (forms.some((form) => (
      new RegExp(`\\bkolor(?:ze)?\\s+${form}\\b`).test(normalized)
      || new RegExp(`\\bw\\s+kolorze\\s+${form}\\b`).test(normalized)
    ))) matches.push(value);
  }
  const unique = [...new Set(matches)];
  return unique.length === 1 ? {
    value: unique[0],
    source: 'jednoznaczna informacja o kolorze na stronie źródłowej',
    confidence: 0.98,
  } : null;
}

function inferredFoilBalloonSafety(product = {}) {
  const value = normalizeAllegroParameterName(productText(product));
  if (productKind(product) !== 'balon' || !/\bfoliow/.test(value)) return null;
  return {
    value: 'Balon foliowy może przewodzić prąd. Trzymać z dala od linii energetycznych i urządzeń elektrycznych. Nie wypuszczać na zewnątrz. Nie wdychać helu. Napełnianie i użytkowanie przez dzieci wyłącznie pod nadzorem osoby dorosłej. Nie przepełniać. Uszkodzony balon należy zutylizować.',
    source: 'reguła bezpieczeństwa dla balonu foliowego potwierdzonego w źródle produktu',
    confidence: 0.96,
  };
}

const BUNDLE_COMPONENT_STOP_WORDS = new Set([
  'alexander', 'multigra', 'milliwood', 'produkt', 'zestaw', 'zestawy', 'gra', 'gry',
  'puzzle', 'puzzli', 'karciana', 'karciane', 'planszowa', 'zabawka', 'zabawy', 'elementow',
  'dla', 'dzieci', 'rodzinna', 'rodzinne', 'pamieciowa', 'edukacyjna', 'kreatywny', 'kreatywna',
]);

function bundleComponentTokens(value = '') {
  return [...new Set(normalizeAllegroParameterName(value).split(' ').filter((token) => (
    token.length >= 3 && !BUNDLE_COMPONENT_STOP_WORDS.has(token) && !/^\d+$/.test(token)
  )))];
}

function declaredBundleProduct(product = {}) {
  const sourceMaterial = asObject(product.sourceMaterial);
  return /(?:w zestawie znajdziesz|sklad zestawu|zawartosc zestawu|kuferek)/.test(normalizeAllegroParameterName([
    product.nazwa, product.name, product.opis, product.description, sourceMaterial.longDescription,
  ].filter(Boolean).join(' ')));
}

function mergedOfficialSafetyWarnings(warnings = []) {
  const buckets = new Map();
  for (const warning of warnings) {
    for (const sentence of clean(warning, 5000).split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean)) {
      const normalized = normalizeAllegroParameterName(sentence);
      const kinds = [
        /nieodpowiednie.*(?:ponizej|do)\s*3/.test(normalized) ? 'minimum_age' : '',
        /zadlaw|zakrztus|polknie/.test(normalized) ? 'choking' : '',
        /ostre|zranien|skaleczen/.test(normalized) ? 'sharp_edges' : '',
      ].filter(Boolean);
      for (const kind of kinds.length ? kinds : [`other:${normalized}`]) {
        const previous = buckets.get(kind) || '';
        if (sentence.length > previous.length) buckets.set(kind, sentence);
      }
    }
  }
  return [...new Set(buckets.values())].join(' ').trim();
}

function bundleComponentSafetyEvidence(product = {}, peers = []) {
  const sourceMaterial = asObject(product.sourceMaterial);
  const sourceText = [sourceMaterial.longDescription, product.opis, product.description].filter(Boolean).join('\n');
  const normalizedSource = normalizeAllegroParameterName(sourceText);
  if (!declaredBundleProduct(product) || !normalizedSource) return null;
  const componentLines = sourceText.split(/\r?\n/).map((line) => clean(line, 300)).filter((line) => line.length >= 5 && line.length <= 220)
    .map((line) => bundleComponentTokens(line)).filter((tokens) => tokens.length >= 2);
  const matches = [];
  for (const peer of peers) {
    const candidate = peer.candidate;
    const identities = [candidate.nazwa, candidate.name, asObject(candidate.sourceMaterial).title].filter(Boolean)
      .map((identity) => bundleComponentTokens(identity)).filter((tokens) => tokens.length >= 2);
    const matchedLine = identities.flatMap((tokens) => componentLines.map((lineTokens) => {
      const lineSet = new Set(lineTokens);
      const matched = tokens.filter((token) => lineSet.has(token));
      return { matched, score: matched.length / Math.max(tokens.length, lineTokens.length) };
    })).sort((left, right) => right.score - left.score || right.matched.length - left.matched.length)[0];
    if (!matchedLine || matchedLine.matched.length < 2 || matchedLine.score < 0.8) continue;
    const warning = candidateEvidence(peer, 'safety');
    if (!warning?.value || genericSafetyText(warning.value)) continue;
    matches.push({
      productId: String(candidate.id || candidate.product_id || ''),
      name: clean(candidate.nazwa || candidate.name, 180),
      score: Math.min(100, Math.round(matchedLine.score * 100)),
      source: warning.source,
      warning: warning.value,
    });
  }
  if (matches.length < 2) return null;
  const value = mergedOfficialSafetyWarnings(matches.map((item) => item.warning));
  if (!value) return null;
  return {
    value,
    source: `oficjalne ostrzeżenia ${matches.length} rozpoznanych składników zestawu`,
    confidence: 0.98,
    candidates: matches.slice(0, 10).map(({ warning, ...candidate }) => candidate),
  };
}

function inferredType(product = {}) {
  const explicit = firstAliasedValue(product, PARAMETER_ALIASES.type);
  if (explicit) return { ...explicit, confidence: 1 };
  const value = normalizeAllegroParameterName(productText(product));
  for (const [pattern, type] of [
    [/\bgra karcian|\bkarcian(?:a|e|y)\b/, 'gra karciana'],
    [/\bgra plansz|\bplanszow/, 'gra planszowa'],
    [/\bgra edukacyjn|\bedukacyjn/, 'gra edukacyjna'],
    [/\bgra zrecznosciow|\bzrecznosciow/, 'gra zręcznościowa'],
    [/\bgra rodzinn|\brodzinn/, 'gra rodzinna'],
    [/\bgra towarzysk|\btowarzysk/, 'gra towarzyska'],
  ]) if (pattern.test(value)) return { value: type, source: 'rodzaj jednoznaczny z nazwy i opisu', confidence: 0.94 };
  const kind = productKind(product);
  return kind ? { value: kind, source: 'rodzaj jednoznaczny z nazwy i opisu', confidence: 0.9 } : null;
}

function ownSafetyWarning(product = {}) {
  const warning = firstAliasedValue(product, PARAMETER_ALIASES.safety);
  if (warning && /^(?:parametry producenta|parametry źródła|materiał źródłowy|specyfikacja źródłowa)$/.test(warning.source)) {
    return { ...warning, confidence: 1 };
  }
  const direct = product.allegroSafetyInformation?.type === 'TEXT'
    ? clean(product.allegroSafetyInformation.description)
    : '';
  const provenance = normalizeAllegroParameterName(product.allegroSafetyInformationProvenance?.source || '');
  const genericAiText = genericSafetyText(direct);
  const unverifiedAi = /(?:agent|ai|wygenerowan)/.test(provenance) && !/(?:zrod|producent|katalog|administrator|reczn)/.test(provenance);
  const derivedBundleSafety = /oficjalne ostrzezenia \d+ rozpoznanych skladnikow zestawu/.test(provenance);
  const staleBundleSafety = declaredBundleProduct(product) && !/(?:administrator|reczn|katalog produktow allegro)/.test(provenance);
  if (direct && !genericAiText && !unverifiedAi && !derivedBundleSafety && !staleBundleSafety) return { value: direct, source: 'zapisane GPSR produktu', confidence: 1 };
  return warning ? { ...warning, confidence: 1 } : null;
}

export function enrichAllegroProductEvidence(product = {}, relatedProducts = []) {
  const index = relatedProductIndex(relatedProducts);
  const peers = peerProfiles(product, index);
  const allRelatedProfiles = [...index.byManufacturer.values()].flat();
  const evidence = { ...asObject(product.allegroParameterEvidence) };
  if (declaredBundleProduct(product) && /(?:zapisane gpsr produktu|rozpoznanych skladnikow zestawu)/.test(normalizeAllegroParameterName(evidence.safety?.source || ''))) {
    delete evidence.safety;
  }
  const assign = (field, record) => {
    if (!record?.value) return;
    const next = {
      value: clean(record.value),
      source: clean(record.source, 300),
      confidence: Number(record.confidence) || 0,
      candidates: asArray(record.candidates),
    };
    const previous = asObject(evidence[field]);
    const unchanged = previous.value === next.value
      && previous.source === next.source
      && Number(previous.confidence) === next.confidence
      && JSON.stringify(asArray(previous.candidates)) === JSON.stringify(next.candidates);
    evidence[field] = {
      ...next,
      resolvedAt: unchanged && previous.resolvedAt ? previous.resolvedAt : new Date().toISOString(),
    };
  };

  const publisher = allegroProductCommercialIdentity(product).publisher;
  if (publisher) assign('publisher', {
    value: publisher,
    source: 'kanoniczny producent produktu',
    confidence: 1,
  });
  assign('language', inferredLanguage(product)
    || consensusEvidence(product, peers, 'language', { minimumScore: 75, minimumMatches: 2 }));
  assign('type', inferredType(product)
    || consensusEvidence(product, peers, 'type', { minimumScore: 80, minimumMatches: 2 }));
  assign('material', inferredMaterial(product)
    || consensusEvidence(product, peers, 'material', { minimumScore: 80, minimumMatches: 2 }));
  assign('color', inferredColor(product));

  const ownAge = firstAliasedValue(product, PARAMETER_ALIASES.age);
  if (ownAge) {
    assign('age', { ...ownAge, confidence: 1 });
  } else {
    assign('age',
      consensusEvidence(product, peers, 'age', {
        minimumScore: 90,
        minimumMatches: 2,
        requireExactSeries: true,
      })
      || consensusEvidence(product, peers, 'age', { minimumScore: 75, minimumMatches: 2, minimumShare: 0.6 })
      || consensusEvidence(product, peers, 'age', { minimumScore: 55, minimumMatches: 5, minimumShare: 0.7 }),
    );
  }
  if (productKind(product) === 'gra' && !firstAliasedValue(product, PARAMETER_ALIASES.players)) {
    assign('players',
      consensusEvidence(product, peers, 'players', { minimumScore: 78, minimumMatches: 2, minimumShare: 0.6 })
      || consensusEvidence(product, peers, 'players', { minimumScore: 55, minimumMatches: 5, minimumShare: 0.75 }),
    );
  }

  const safety = ownSafetyWarning(product)
    || inferredFoilBalloonSafety(product)
    || bundleComponentSafetyEvidence(product, allRelatedProfiles)
    || consensusEvidence(product, peers, 'safety', {
      minimumScore: 90,
      minimumMatches: 2,
      requireExactSeries: true,
    })
    || consensusEvidence(product, peers, 'safety', {
      minimumScore: 60,
      minimumMatches: 2,
      minimumShare: 0.75,
      requireSameCategory: true,
      requireSameKind: true,
      requireSameAge: true,
    })
    || consensusEvidence(product, peers, 'safety', {
      minimumScore: 55,
      minimumMatches: 2,
      minimumShare: 0.9,
      requireSameKind: true,
    });
  if (safety) assign('safety', safety);

  const next = { ...product, allegroParameterEvidence: evidence };
  const existingSafety = normalizeAllegroParameterName(next.allegroSafetyInformation?.description || '');
  const existingSafetyProvenance = normalizeAllegroParameterName(next.allegroSafetyInformationProvenance?.source || '');
  const recalculatedBundleSafety = declaredBundleProduct(next) && (
    /oficjalne ostrzezenia \d+ rozpoznanych skladnikow zestawu/.test(existingSafetyProvenance)
    || /oficjalne ostrzezenia \d+ rozpoznanych skladnikow zestawu/.test(normalizeAllegroParameterName(evidence.safety?.source || ''))
  );
  if (genericSafetyText(existingSafety) || recalculatedBundleSafety) {
    delete next.allegroSafetyInformation;
    delete next.allegroSafetyInformationProvenance;
  }
  if ((!next.allegroSafetyInformation?.type || !next.allegroSafetyInformation?.description) && evidence.safety?.value) {
    next.allegroSafetyInformation = {
      type: 'TEXT',
      description: clean(evidence.safety.value),
    };
    next.allegroSafetyInformationProvenance = {
      source: evidence.safety.source,
      confidence: evidence.safety.confidence,
      candidates: evidence.safety.candidates,
      resolvedAt: evidence.safety.resolvedAt,
    };
  }
  return {
    product: next,
    evidence,
    applied: Object.keys(evidence),
  };
}
