export const VON_HALSKY_AGENT_RULES_VERSION = '2026-07-29.1';

const PUBLIC_GUIDE = 'https://inpost.pl/aktualnosci-inpost-von-halsky-jak-stworzyc-dobra-oferte';

function text(value, max = 500) {
  return String(value ?? '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalized(value = '') {
  return text(value, 4000)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
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
  return [
    product.nazwa, product.name, product.kategoria, product.category, product.podkategoria,
    product.subcategory, product.typ, product.type,
    ...Object.keys(product.parametryZrodla || product.parametryProducenta || product.parametry || product.parameters || {}),
  ].filter(Boolean).join(' ');
}

export function suggestVonHalskyCategory(product = {}, categories = [], {
  minimumConfidence = 0.82,
  minimumMargin = 0.08,
} = {}) {
  const corpus = productCategoryCorpus(product), corpusNormalized = normalized(corpus);
  const productTokens = tokens(corpus);
  const categoryTokens = tokens([product.kategoria, product.category, product.podkategoria, product.subcategory].filter(Boolean).join(' '));
  const candidates = (Array.isArray(categories) ? categories : [])
    .filter((item) => item?.leaf === true && text(item?.id, 100))
    .map((item) => {
      const name = text(item.name, 240), path = text(item.path || item.name, 1000);
      const nameNormalized = normalized(name), nameTokens = tokens(name), pathTokens = tokens(path);
      const nameCoverage = overlap(nameTokens, productTokens);
      const pathCoverage = overlap(pathTokens, productTokens);
      const catalogAgreement = overlap(categoryTokens, pathTokens);
      const exactPhrase = nameNormalized.length >= 4 && corpusNormalized.includes(nameNormalized);
      const score = Math.min(1, (
        (exactPhrase ? 0.48 : 0)
        + nameCoverage * 0.34
        + pathCoverage * 0.08
        + catalogAgreement * 0.30
      ));
      return {
        id: text(item.id, 100),
        name,
        path,
        score: Number(score.toFixed(4)),
        evidence: [
          exactPhrase && `pełna nazwa kategorii występuje w kartotece: ${name}`,
          nameCoverage > 0 && `zgodność słów kategorii: ${Math.round(nameCoverage * 100)}%`,
          catalogAgreement > 0 && `zgodność z kategorią sklepu: ${Math.round(catalogAgreement * 100)}%`,
        ].filter(Boolean),
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path, 'pl'))
    .slice(0, 5);
  const selected = candidates[0] || null, runnerUp = candidates[1] || null;
  const margin = selected ? selected.score - Number(runnerUp?.score || 0) : 0;
  return {
    selected,
    candidates,
    confidence: Number((selected?.score || 0).toFixed(4)),
    margin: Number(margin.toFixed(4)),
    autoApplicable: Boolean(
      selected
      && selected.score >= Number(minimumConfidence || 0.82)
      && margin >= Number(minimumMargin || 0.08)
    ),
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
} = {}) {
  const issues = [...(readiness.issues || []), ...(readiness.publicationIssues || [])];
  const agentStatus = status || (readiness.publishable ? 'ready' : issues.length ? 'requires_data' : 'review');
  return {
    vonHalskyAgentStatus: agentStatus,
    vonHalskyAgentPreparedAt: timestamp,
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
