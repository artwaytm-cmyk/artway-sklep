import { tekst } from './core/http.mjs';

export function createProductSourceMatching({ normalizeKey, nameSimilarity, cacheKey }) {
  function produktLinkDuplikaty(product = {}, products = new Map()) {
    const norm = normalizeKey;
    const wanted = {
      ean: norm(product.gtin || product.ean),
      external: norm(product.externalId || product.sku),
      code: norm(product.kodProducenta || product.mpn),
      url: cacheKey(product.sourceUrl || product.producentUrl),
      name: tekst(product.nazwa || product.name, 400).trim(),
    };
    const out = [];
    for (const candidate of products.values()) {
      if (!candidate || String(candidate.id || '') === String(product.id || '')) continue;
      const reasons = [];
      let score = 0, blocking = false;
      const ean = norm(candidate.gtin || candidate.ean), external = norm(candidate.externalId || candidate.sku), code = norm(candidate.kodProducenta || candidate.mpn), candidateUrl = cacheKey(candidate.sourceUrl || candidate.producentUrl);
      if (wanted.ean && ean === wanted.ean) { reasons.push('ten sam EAN/GTIN'); score = 100; blocking = true; }
      if (wanted.url && candidateUrl && candidateUrl === wanted.url) { reasons.push('ten sam link producenta'); score = Math.max(score, 100); blocking = true; }
      if (wanted.external && wanted.external.length >= 3 && external === wanted.external) { reasons.push('ten sam EXTERNAL_ID/SKU'); score = Math.max(score, 98); blocking = true; }
      if (wanted.code && wanted.code.length >= 3 && code === wanted.code) { reasons.push('ten sam kod producenta'); score = Math.max(score, 96); blocking = true; }
      const similarity = nameSimilarity(wanted.name, candidate.nazwa || candidate.name || '');
      if (wanted.name && norm(wanted.name) === norm(candidate.nazwa || candidate.name || '')) { reasons.push('identyczna nazwa'); score = Math.max(score, 92); }
      else if (similarity >= 0.72) { reasons.push(`bardzo podobna nazwa ${Math.round(similarity * 100)}%`); score = Math.max(score, Math.round(72 + similarity * 18)); }
      if (reasons.length) out.push({ productId: String(candidate.id), productName: tekst(candidate.nazwa || candidate.name, 300), ean: tekst(candidate.gtin || candidate.ean, 80), externalId: tekst(candidate.externalId || candidate.sku, 120), code: tekst(candidate.kodProducenta || candidate.mpn, 120), score, blocking, reasons });
    }
    return out.sort((a, b) => Number(b.blocking) - Number(a.blocking) || b.score - a.score).slice(0, 10);
  }
  function produktLinkKategoriaSklepu(product = {}, products = new Map()) {
    const raw = tekst(product.kategoria, 180).trim(), rawKey = normalizeKey(raw), categories = new Map();
    for (const candidate of products.values()) if (candidate?.kategoria) categories.set(normalizeKey(candidate.kategoria), String(candidate.kategoria));
    if (rawKey && categories.has(rawKey)) return { name: categories.get(rawKey), confidence: 100, reason: 'identyczna kategoria istnieje w sklepie' };
    const near = rawKey ? [...categories].find(([key]) => key && (key.includes(rawKey) || rawKey.includes(key))) : null;
    if (near) return { name: near[1], confidence: 88, reason: 'dopasowano kategorię producenta do katalogu sklepu' };
    const producer = normalizeKey(product.producent || product.marka), scores = new Map();
    for (const candidate of products.values()) {
      if (!candidate?.kategoria) continue;
      let score = nameSimilarity(product.nazwa || product.name, candidate.nazwa || candidate.name);
      if (producer && producer === normalizeKey(candidate.producent || candidate.marka)) score += 0.08;
      if (score < 0.28) continue;
      const current = scores.get(candidate.kategoria) || { name: candidate.kategoria, score: 0, count: 0, example: candidate.nazwa || candidate.name || '' };
      current.score = Math.max(current.score, score); current.count++; scores.set(candidate.kategoria, current);
    }
    const best = [...scores.values()].sort((a, b) => (b.score + Math.min(0.12, b.count * 0.02)) - (a.score + Math.min(0.12, a.count * 0.02)))[0];
    if (best) return { name: best.name, confidence: Math.min(90, Math.round((best.score + Math.min(0.12, best.count * 0.02)) * 100)), reason: `podobny produkt w sklepie: ${tekst(best.example, 160)}` };
    return { name: raw, confidence: raw ? 50 : 0, reason: raw ? 'kategoria producenta wymaga zatwierdzenia' : 'brak pewnej kategorii sklepu' };
  }
  return { produktLinkDuplikaty, produktLinkKategoriaSklepu };
}

