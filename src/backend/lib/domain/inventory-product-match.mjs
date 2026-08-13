function text(value = '', limit = 500) {
  return String(value ?? '').trim().slice(0, limit);
}

function normalize(value = '') {
  return text(value, 1000).toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^\p{L}\p{N}/._-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function identifier(value = '') {
  return normalize(value).replace(/\s+/g, '');
}

function similarWord(left = '', right = '') {
  if (left === right) return true;
  if (left.length < 5 || right.length < 5) return false;
  const length = Math.min(7, left.length, right.length);
  return left.slice(0, length) === right.slice(0, length);
}

export function matchInventoryProduct(products = [], query = '') {
  const normalizedQuery = normalize(query);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const ids = new Set(tokens.map(identifier).filter(Boolean));
  const candidates = (Array.isArray(products) ? products : []).map((product) => {
    const fields = [
      ['ID', product?.id],
      ['EXTERNAL_ID', product?.externalId || product?.EXTERNAL_ID || product?.external_id],
      ['EAN', product?.ean || product?.EAN || product?.gtin || product?.GTIN],
      ['kod producenta', product?.kodProducenta || product?.mpn || product?.MPN || product?.manufacturerCode],
      ['SKU', product?.sku || product?.SKU],
    ].filter(([, value]) => text(value, 160));
    const matchedBy = fields
      .filter(([, value]) => ids.has(identifier(value)))
      .map(([label]) => label);
    const name = normalize(product?.nazwa || product?.name || '');
    const nameTokens = name.split(/\s+/).filter(Boolean);
    let score = matchedBy.length ? 100 + matchedBy.length * 5 : 0;
    if (name === normalizedQuery) score += 80;
    else if (name.includes(normalizedQuery) && normalizedQuery.length >= 3) score += 45;
    else if (normalizedQuery.includes(name) && name.length >= 5) score += 35;
    for (const token of tokens) {
      if (token.length < 3 || /^\d+$/.test(token)) continue;
      if (nameTokens.includes(token)) score += 8;
      else if (nameTokens.some((word) => similarWord(token, word))) score += 4;
    }
    return { product, score, matchedBy };
  }).filter((candidate) => candidate.score > 0)
    .sort((left, right) => (
      right.score - left.score
      || text(left.product?.nazwa || left.product?.name)
        .localeCompare(text(right.product?.nazwa || right.product?.name), 'pl')
    ));

  const strong = candidates.filter((candidate) => candidate.matchedBy.length > 0);
  if (strong.length === 1) {
    return {
      status: 'matched',
      product: strong[0].product,
      matchedBy: strong[0].matchedBy,
      alternatives: candidates.slice(0, 5).map((item) => item.product),
    };
  }
  if (strong.length > 1) {
    return {
      status: 'ambiguous',
      product: null,
      alternatives: strong.slice(0, 5).map((item) => item.product),
    };
  }
  if (!candidates.length) return { status: 'not_found', product: null, alternatives: [] };
  if (candidates.length > 1 && candidates[0].score - candidates[1].score < 8) {
    return {
      status: 'ambiguous',
      product: null,
      alternatives: candidates.slice(0, 5).map((item) => item.product),
    };
  }
  return {
    status: 'matched',
    product: candidates[0].product,
    matchedBy: ['nazwa'],
    alternatives: candidates.slice(0, 5).map((item) => item.product),
  };
}
