export const VON_HALSKY_AGENT_RULES_VERSION = '2026-07-29.4';

const PUBLIC_GUIDE = 'https://inpost.pl/aktualnosci-inpost-von-halsky-jak-stworzyc-dobra-oferte';

function text(value, max = 500) {
  return String(value ?? '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalized(value = '') {
  return text(value, 4000)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'a', 'i', 'do', 'dla', 'na', 'od', 'po', 'w', 'z', 'ze', 'oraz', 'produkt', 'produkty',
  'zestaw', 'szt', 'sztuk', 'gra', 'gry', 'artway', 'alexander', 'multigra', 'godan',
]);

function tokens(value = '') {
  return [...new Set(normalized(value).split(' ').filter((token) => token.length >= 3 && !STOP_WORDS.has(token)))];
}

function overlap(left = [], right = []) {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value)).length / left.length;
}

function productCategoryCorpus(product = {}) {
  const parameters = product.parametryZrodla || product.parametryProducenta || product.parametry || product.parameters || {};
  return [
    product.nazwa, product.name, product.kategoria, product.category, product.podkategoria,
    product.subcategory, product.typ, product.type,
    product.opisKrotki, product.krotkiOpis, product.opis,
    ...Object.keys(parameters),
    ...Object.values(parameters).flatMap((value) => Array.isArray(value) ? value : [value]),
  ].filter(Boolean).join(' ');
}

function productPrimaryCategoryCorpus(product = {}) {
  return [
    product.nazwa, product.name, product.kategoria, product.category,
    product.podkategoria, product.subcategory, product.typ, product.type,
  ].filter(Boolean).join(' ');
}

function categoryIntent(product = {}) {
  const corpus = normalized(productCategoryCorpus(product));
  const primary = normalized(productPrimaryCategoryCorpus(product));
  const magicTrick = /\b(?:magia|magiczna|magiczne|sztuczka|sztuczki)\b/.test(corpus);
  const lacing = /\b(?:przewlekan|przeplatan)\w*\b/.test(corpus);
  const construction = /\b(?:maly konstruktor|konstrukcyjn|constructor)\w*\b/.test(corpus);
  const boardGame = /\b(?:gra|gry|planszow\w*|zestaw gier|familijn\w*|rodzinn\w*)\b/.test(corpus)
    && !magicTrick
    && !/\b(?:gra na pc|gry na pc|xbox|playstation|nintendo|rpg)\b/.test(corpus);
  const balloon = /\b(?:balon|balony|foliow|lateksow|hel)\w*\b/.test(corpus);
  const creative = /\b(?:origami|malowan|plastycz|kreatywn|piaskow)\w*\b/.test(corpus);
  const puzzle = /\b(?:puzzle|puzzl|ukladanka|ukladanki)\w*\b/.test(corpus);
  const multiGame = /\b(?:\d+\s+gier|zestaw gier|kolekcja gier)\b/.test(corpus);
  const cardGame = boardGame && !multiGame && /\b(?:karcian|karty|talia|piotrus)\w*\b/.test(corpus);
  const subtype = boardGame
    ? multiGame ? (/\b(?:familijn|rodzinn)\w*\b/.test(corpus) ? 'family' : 'generic')
      : /\b(?:szach|szachy)\w*\b/.test(corpus) ? 'chess'
      : /\b(?:warcab)\w*\b/.test(corpus) ? 'checkers'
        : /\b(?:domino)\w*\b/.test(corpus) && !multiGame ? 'domino'
          : /\b(?:chinczyk)\w*\b/.test(corpus) && !multiGame ? 'ludo'
            : cardGame ? 'card'
              : /\b(?:familijn|rodzinn)\w*\b/.test(corpus) ? 'family'
      : /\b(?:edukacyjn|logicz)\w*\b/.test(corpus) ? 'educational'
        : /\b(?:imprezow|towarzysk)\w*\b/.test(corpus) ? 'party'
          : /\b(?:slow|slown|liter|liczb)\w*\b/.test(corpus) ? 'word_number'
            : 'generic'
    : '';
  return { corpus, primary, boardGame, balloon, creative, puzzle, lacing, construction, magicTrick, cardGame, multiGame, subtype };
}

function categoryIntentScore(intent = {}, path = '', preparedPath = '') {
  const normalizedPath = preparedPath || normalized(path);
  let score = 0;
  const evidence = [];
  if (intent.boardGame) {
    const boardPath = /\bkultura i rozrywka gry planszowe\b/.test(normalizedPath);
    const traditionalPath = /\bkultura i rozrywka gry tradycyjne\b/.test(normalizedPath);
    const cardPath = /\bkultura i rozrywka gry karciane\b/.test(normalizedPath);
    const wrongDigital = /\bgry na (?:pc|konsole)\b/.test(normalizedPath);
    const wrongAccessory = /\bakcesoria do gier\b/.test(normalizedPath);
    if (boardPath || traditionalPath || cardPath) {
      score += 0.52;
      evidence.push('rozpoznano produkt jako grę stołową');
    } else if (wrongDigital || wrongAccessory || !/\bkultura i rozrywka gry\b/.test(normalizedPath)) {
      score -= 0.75;
    }
    if (intent.multiGame && /\bgry tradycyjne (?:domino|chinczyk|warcaby|szachy)\b/.test(normalizedPath)) {
      score -= 0.85;
      evidence.push('zestaw wielu gier nie jest pojedynczą grą tradycyjną');
    }
    const subtypeRules = {
      family: [/\bplanszowe rodzinne\b/, 0.34, 'rodzinna/familijna → Planszowe › Rodzinne'],
      educational: [/\bplanszowe logiczne i edukacyjne\b/, 0.30, 'logiczna/edukacyjna → Planszowe › Logiczne i edukacyjne'],
      party: [/\bplanszowe imprezowe\b/, 0.30, 'imprezowa → Planszowe › Imprezowe'],
      word_number: [/\bplanszowe slowne i liczbowe\b/, 0.30, 'słowna/liczbowa → Planszowe › Słowne i liczbowe'],
      card: [/\bgry karciane (?:karciane dla najmlodszych|pozostale gry karciane|karciane tradycyjne)\b/, 0.34, 'gra karciana → Gry › Karciane'],
      chess: [/\bgry tradycyjne szachy (?:zestawy szachowe|pozostale)\b/, 0.44, 'szachy → Gry tradycyjne › Szachy'],
      checkers: [/\bgry tradycyjne warcaby\b/, 0.44, 'warcaby → Gry tradycyjne › Warcaby'],
      domino: [/\bgry tradycyjne domino\b/, 0.44, 'domino → Gry tradycyjne › Domino'],
      ludo: [/\bgry tradycyjne chinczyk\b/, 0.44, 'chińczyk → Gry tradycyjne › Chińczyk'],
      generic: [/\bplanszowe pozostale gry planszowe\b/, 0.12, 'ogólna gra → pozostałe gry planszowe'],
    };
    const [pattern, bonus, label] = subtypeRules[intent.subtype] || subtypeRules.generic;
    if (pattern.test(normalizedPath)) {
      score += bonus;
      evidence.push(label);
    }
  }
  if (intent.balloon) {
    if (/\bokazje i przyjecia dekoracje i gadzety balony\b/.test(normalizedPath)) {
      score += 0.72;
      evidence.push('balon → Dekoracje i gadżety › Balony');
    } else if (!/\bbalony\b/.test(normalizedPath)) score -= 0.65;
  }
  if (intent.creative) {
    const creativeKit = /\b(?:origami|piaskow|zestaw)\w*\b/.test(intent.corpus);
    const componentCategory = /\bartykuly szkolne artykuly plastyczne (kleje|nozyczki|farby|kredki|pisaki|pedzelki)\b/.exec(normalizedPath);
    if (creativeKit && /\bdla dzieci zabawki zabawki plastyczne prace manualne\b/.test(normalizedPath)) {
      score += 0.88;
      evidence.push('zestaw manualny/origami → Zabawki plastyczne › Prace manualne');
    } else if (componentCategory && !new RegExp(`\\b${componentCategory[1].replace(/.$/, '')}\\w*\\b`).test(intent.primary)) {
      score -= 0.72;
      evidence.push('element zestawu nie może zastąpić kategorii całego produktu');
    } else if (/\bdla dzieci (?:artykuly szkolne artykuly plastyczne|zabawki zabawki plastyczne)\b/.test(normalizedPath)) {
      score += 0.48;
      evidence.push('produkt kreatywny → dziecięce artykuły lub zabawki plastyczne');
    } else if (/\b(?:zestawy kreatywne|origami)\b/.test(normalizedPath)) {
      score += 0.28;
      evidence.push('produkt kreatywny/plastyczny');
    } else if (/\bgry\b/.test(normalizedPath)) score -= 0.62;
  }
  if (intent.puzzle) {
    if (/\bdla dzieci zabawki puzzle\b/.test(normalizedPath)) {
      score += 0.72;
      evidence.push('puzzle → Dla dzieci › Zabawki › Puzzle');
    } else if (/\bgry\b/.test(normalizedPath)) score -= 0.48;
  }
  if (intent.lacing) {
    if (/\bzabawki edukacyjne umyslowe labirynty przeplatanki\b/.test(normalizedPath)) {
      score += 0.82;
      evidence.push('przewlekanka → Zabawki edukacyjne › Labirynty, przeplatanki');
    } else if (/\bgry\b/.test(normalizedPath)) score -= 0.62;
  }
  if (intent.construction) {
    const mechanicSet = /\b(?:maly konstruktor|constructor)\b/.test(intent.corpus);
    if (mechanicSet && /\bdla dzieci zabawki majsterkowanie dla dzieci zestawy konstrukcyjne\b/.test(normalizedPath)) {
      score += 0.92;
      evidence.push('Mały Konstruktor → Majsterkowanie dla dzieci › Zestawy konstrukcyjne');
    } else if (/\bdla dzieci zabawki (?:majsterkowanie dla dzieci zestawy konstrukcyjne|zabawki edukacyjne zabawki konstrukcyjne|klocki klocki konstrukcyjne)\b/.test(normalizedPath)) {
      score += 0.74;
      evidence.push('zestaw konstruktorski → dziecięce zestawy konstrukcyjne');
    } else if (/\b(?:rowery|odziez|obuwie)\b/.test(normalizedPath)) score -= 0.85;
  }
  return { score, evidence };
}

export function compileVonHalskyCategoryIndex(categories = []) {
  const items = (Array.isArray(categories) ? categories : [])
    .filter((item) => item?.leaf === true && text(item?.id, 100))
    .map((item) => {
      const name = text(item.name, 240), path = text(item.path || item.name, 1000);
      return Object.freeze({
        id: text(item.id, 100),
        name,
        path,
        leaf: true,
        nameNormalized: normalized(name),
        pathNormalized: normalized(path),
        nameTokens: Object.freeze(tokens(name)),
        pathTokens: Object.freeze(tokens(path)),
      });
    });
  const tokenItems = new Map(), intentItems = {
    board_game: [], balloon: [], creative: [], puzzle: [], lacing: [], construction: [],
  };
  for (const item of items) {
    for (const token of [...new Set([...item.nameTokens, ...item.pathTokens])]) {
      const bucket = tokenItems.get(token) || [];
      bucket.push(item);
      tokenItems.set(token, bucket);
    }
    if (/\bkultura i rozrywka gry (?:planszowe|tradycyjne|karciane)\b/.test(item.pathNormalized)) intentItems.board_game.push(item);
    if (/\bbalon\w*\b/.test(item.pathNormalized)) intentItems.balloon.push(item);
    if (/\b(?:artykuly plastyczne|zabawki plastyczne|zestawy kreatywne|origami)\b/.test(item.pathNormalized)) intentItems.creative.push(item);
    if (/\bdla dzieci zabawki puzzle\b/.test(item.pathNormalized)) intentItems.puzzle.push(item);
    if (/\bzabawki edukacyjne umyslowe labirynty przeplatanki\b/.test(item.pathNormalized)) intentItems.lacing.push(item);
    if (/\bdla dzieci zabawki (?:majsterkowanie dla dzieci zestawy konstrukcyjne|zabawki edukacyjne zabawki konstrukcyjne|klocki klocki konstrukcyjne)\b/.test(item.pathNormalized)) intentItems.construction.push(item);
  }
  return Object.freeze({
    version: 1,
    size: items.length,
    items: Object.freeze(items),
    ids: new Set(items.map((item) => item.id)),
    byId: new Map(items.map((item) => [item.id, item])),
    tokenItems,
    intentItems: Object.freeze(Object.fromEntries(Object.entries(intentItems)
      .map(([key, value]) => [key, Object.freeze(value)]))),
  });
}

function meaningfulStoreCategory(product = {}) {
  const value = normalized([
    product.kategoria, product.category, product.podkategoria, product.subcategory,
  ].filter(Boolean).join(' › '));
  if (!value || /^(?:nowosci|promocje|polecane|pozostale|inne)$/.test(value)) return '';
  return value;
}

function categoryConsensus(product = {}, relatedProducts = [], index, trustedProductIds = new Set()) {
  const storeCategory = meaningfulStoreCategory(product);
  if (!storeCategory || !index?.ids?.size) return null;
  const votes = new Map();
  for (const candidate of Array.isArray(relatedProducts) ? relatedProducts : []) {
    if (!candidate || String(candidate.id) === String(product.id)) continue;
    const candidateId = String(candidate.id ?? '');
    const trusted = trustedProductIds.has(candidateId)
      || candidate.vonHalskyCategoryMatchedBy === 'admin'
      || Boolean(candidate.vonHalskyCategoryAcceptedAt);
    if (!trusted || meaningfulStoreCategory(candidate) !== storeCategory) continue;
    const categoryId = text(candidate.vonHalskyCategoryId || candidate.inpostVonHalskyCategoryId, 100);
    if (!index.ids.has(categoryId) || candidate.vonHalskyCategoryRejection) continue;
    const current = votes.get(categoryId) || { categoryId, count: 0, examples: [] };
    current.count += 1;
    if (current.examples.length < 3) current.examples.push(text(candidate.nazwa || candidate.name || candidate.id, 160));
    votes.set(categoryId, current);
  }
  const ranking = [...votes.values()].sort((left, right) => right.count - left.count);
  const selectedVote = ranking[0], runnerUp = ranking[1];
  const total = ranking.reduce((sum, item) => sum + item.count, 0);
  const share = selectedVote ? selectedVote.count / Math.max(1, total) : 0;
  if (!selectedVote || selectedVote.count < 2 || share < 0.72 || selectedVote.count - Number(runnerUp?.count || 0) < 2) return null;
  const category = index.byId.get(selectedVote.categoryId);
  if (!category) return null;
  return {
    id: category.id,
    name: category.name,
    path: category.path,
    score: Number(Math.min(0.98, 0.84 + Math.min(0.10, selectedVote.count * 0.01) + share * 0.04).toFixed(4)),
    evidence: [
      `potwierdzona kategoria sklepu: ${storeCategory}`,
      `${selectedVote.count} zaakceptowane oferty w tej samej gałęzi`,
      ...selectedVote.examples.map((name) => `wzorzec: ${name}`),
    ],
    source: 'accepted_catalog_consensus',
    support: selectedVote.count,
    share: Number(share.toFixed(4)),
  };
}

export function suggestVonHalskyCategory(product = {}, categories = [], {
  minimumConfidence = 0.82,
  minimumMargin = 0.08,
  categoryIndex = null,
  relatedProducts = [],
  trustedProductIds = new Set(),
} = {}) {
  const index = categoryIndex?.items ? categoryIndex : compileVonHalskyCategoryIndex(categories);
  const primaryCorpus = productPrimaryCategoryCorpus(product), primaryNormalized = normalized(primaryCorpus);
  const productTokens = tokens(primaryCorpus);
  const categoryTokens = tokens([product.kategoria, product.category, product.podkategoria, product.subcategory].filter(Boolean).join(' '));
  const intent = categoryIntent(product);
  const intentKey = intent.puzzle ? 'puzzle'
    : intent.balloon ? 'balloon'
      : intent.lacing ? 'lacing'
        : intent.construction ? 'construction'
          : intent.creative ? 'creative'
            : intent.boardGame ? 'board_game'
              : '';
  const candidateMap = new Map();
  for (const token of [...new Set([...productTokens, ...categoryTokens])]) {
    for (const item of index.tokenItems?.get(token) || []) candidateMap.set(item.id, item);
  }
  const intentRows = index.intentItems?.[intentKey] || [];
  const candidateRows = intentRows.length
    ? intentRows
    : candidateMap.size ? [...candidateMap.values()] : index.items;
  const candidates = candidateRows
    .map((item) => {
      const nameCoverage = overlap(item.nameTokens, productTokens);
      const pathCoverage = overlap(item.pathTokens, productTokens);
      const catalogAgreement = overlap(categoryTokens, item.pathTokens);
      const exactPhrase = item.nameNormalized.length >= 4 && primaryNormalized.includes(item.nameNormalized);
      const intentMatch = categoryIntentScore(intent, item.path, item.pathNormalized);
      const score = Math.min(1, (
        (exactPhrase ? 0.48 : 0)
        + nameCoverage * 0.34
        + pathCoverage * 0.08
        + catalogAgreement * 0.30
        + intentMatch.score
      ));
      return {
        id: item.id,
        name: item.name,
        path: item.path,
        score: Number(score.toFixed(4)),
        source: 'api_tree_semantic',
        evidence: [
          exactPhrase && `pełna nazwa kategorii występuje w kartotece: ${item.name}`,
          nameCoverage > 0 && `zgodność słów kategorii: ${Math.round(nameCoverage * 100)}%`,
          catalogAgreement > 0 && `zgodność z kategorią sklepu: ${Math.round(catalogAgreement * 100)}%`,
          ...intentMatch.evidence,
        ].filter(Boolean),
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path, 'pl'))
    .slice(0, 5);
  const semantic = candidates[0] || null, consensus = categoryConsensus(product, relatedProducts, index, trustedProductIds);
  const selected = consensus && (!semantic || semantic.id === consensus.id || semantic.score < 0.96)
    ? {
        ...consensus,
        evidence: [...consensus.evidence, ...(semantic?.id === consensus.id ? semantic.evidence : [])],
        score: Math.max(consensus.score, semantic?.id === consensus.id ? semantic.score : 0),
      }
    : semantic;
  const runnerUp = candidates.find((candidate) => candidate.id !== selected?.id) || null;
  const margin = selected ? selected.score - Number(runnerUp?.score || 0) : 0;
  const consensusApplicable = selected?.source === 'accepted_catalog_consensus' && selected.support >= 2;
  const recognizedIntent = Boolean(intentKey);
  return {
    selected,
    candidates,
    confidence: Number((selected?.score || 0).toFixed(4)),
    margin: Number(margin.toFixed(4)),
    autoApplicable: Boolean(
      selected
      && selected.score >= Number(minimumConfidence || 0.82)
      && (recognizedIntent || consensusApplicable)
      && (consensusApplicable || margin >= Number(minimumMargin || 0.08))
    ),
    intent: {
      type: intent.puzzle ? 'puzzle'
        : intent.balloon ? 'balloon'
          : intent.lacing ? 'lacing'
            : intent.construction ? 'construction'
              : intent.creative ? 'creative'
                : intent.cardGame ? 'card_game'
                  : intent.boardGame ? 'board_game'
                    : 'general',
      subtype: intent.subtype || '',
    },
    categoryTreeSize: index.size,
    source: selected?.source || 'none',
    rulesVersion: VON_HALSKY_AGENT_RULES_VERSION,
  };
}

function attributeRows(payload = {}) {
  if (Array.isArray(payload)) return payload;
  for (const candidate of [payload.data, payload.attributes, payload.items, payload.content]) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function attributeValues(attribute = {}) {
  const raw = attribute.values || attribute.options || attribute.dictionary || attribute.allowedValues || [];
  return (Array.isArray(raw) ? raw : []).map((value) => ({
    id: text(typeof value === 'object' ? value.id || value.value || value.code : value, 1024),
    label: text(typeof value === 'object' ? value.name || value.label || value.value || value.code : value, 1024),
  })).filter((value) => value.id || value.label);
}

function productParameterRows(product = {}) {
  const source = product.parametryZrodla || product.parametryProducenta || product.parametry || product.parameters || {};
  return Object.entries(source && typeof source === 'object' ? source : {})
    .map(([name, value]) => ({ name: text(name, 240), value: text(Array.isArray(value) ? value.join(', ') : value, 2000) }))
    .filter((item) => item.name && item.value);
}

export function matchVonHalskyAttributes(product = {}, payload = {}) {
  const parameters = productParameterRows(product), mapped = {}, evidence = [], missingRequired = [];
  const attributes = attributeRows(payload).map((attribute) => ({
    id: text(attribute.id || attribute.attributeId || attribute.uuid, 100),
    name: text(attribute.name || attribute.label || attribute.displayName, 240),
    required: attribute.required === true || attribute.isRequired === true,
    multiple: attribute.multiple === true || attribute.multiselect === true,
    values: attributeValues(attribute),
  })).filter((attribute) => attribute.id && attribute.name);
  for (const attribute of attributes) {
    const key = normalized(attribute.name);
    const source = parameters.find((parameter) => normalized(parameter.name) === key);
    if (!source) {
      if (attribute.required) missingRequired.push(attribute.name);
      continue;
    }
    let selected = source.value;
    if (attribute.values.length) {
      const exact = attribute.values.find((option) => (
        normalized(option.label) === normalized(source.value)
        || normalized(option.id) === normalized(source.value)
      ));
      if (!exact) {
        if (attribute.required) missingRequired.push(attribute.name);
        continue;
      }
      selected = exact.id || exact.label;
    }
    mapped[attribute.id] = attribute.multiple ? [selected] : selected;
    evidence.push({ attributeId: attribute.id, attribute: attribute.name, source: source.name, value: selected });
  }
  const required = attributes.filter((attribute) => attribute.required).length;
  const mappedRequired = required - missingRequired.length;
  return {
    mapped,
    evidence,
    required,
    mappedRequired,
    missingRequired: [...new Set(missingRequired)],
    coverage: required ? Number((mappedRequired / required).toFixed(4)) : 1,
    exactOnly: true,
    rulesVersion: VON_HALSKY_AGENT_RULES_VERSION,
  };
}

export function vonHalskyAgentPreparationPatch({
  product = {},
  readiness = {},
  categoryMatch = null,
  attributeMatch = null,
  timestamp = new Date().toISOString(),
  status = '',
  error = '',
  savedFields = [],
  runId = '',
} = {}) {
  const issues = [...(readiness.issues || []), ...(readiness.publicationIssues || [])];
  const agentStatus = status || (readiness.publishable ? 'ready' : issues.length ? 'requires_data' : 'review');
  const confirmedFields = [...new Set((Array.isArray(savedFields) ? savedFields : [])
    .map((item) => text(item, 120))
    .filter(Boolean))].slice(0, 120);
  return {
    vonHalskyAgentStatus: agentStatus,
    vonHalskyAgentPreparedAt: timestamp,
    vonHalskyAgentConfirmedAt: '',
    vonHalskyAgentPreparationRunId: text(runId, 160),
    vonHalskyAgentPreparationSource: 'agent-serwerowy',
    vonHalskyAgentSaveState: 'pending_readback',
    vonHalskyAgentReadbackConfirmed: false,
    vonHalskyAgentSavedFields: confirmedFields,
    vonHalskyAgentRulesVersion: VON_HALSKY_AGENT_RULES_VERSION,
    vonHalskyAgentDocumentation: PUBLIC_GUIDE,
    vonHalskyAgentScore: Number(readiness.score || 0),
    vonHalskyAgentIssues: [...new Set(issues.map((item) => text(item, 300)).filter(Boolean))].slice(0, 30),
    vonHalskyAgentWarnings: [...new Set((readiness.warnings || []).map((item) => text(item, 300)).filter(Boolean))].slice(0, 30),
    vonHalskyAgentError: text(error, 1000),
    vonHalskyAgentCategorySuggestion: categoryMatch?.selected ? {
      id: categoryMatch.selected.id,
      name: categoryMatch.selected.name,
      path: categoryMatch.selected.path,
      confidence: categoryMatch.confidence,
      autoApplicable: categoryMatch.autoApplicable === true,
      source: categoryMatch.source || categoryMatch.selected.source || 'api_tree_semantic',
      evidence: categoryMatch.selected.evidence || [],
    } : null,
    vonHalskyAgentAttributeCoverage: attributeMatch ? attributeMatch.coverage : null,
    vonHalskyAgentMissingAttributes: attributeMatch?.missingRequired || [],
    vonHalskyAgentEvidence: {
      identity: readiness?.identifiers?.ean ? 'gtin' : readiness?.identifiers?.manufacturerCode && readiness?.identifiers?.brand ? 'manufacturer_code_brand' : 'missing',
      category: categoryMatch?.selected?.id || product.vonHalskyCategoryId || '',
      attributesMapped: attributeMatch?.evidence?.length || 0,
      exactAttributeMatchingOnly: true,
    },
  };
}
