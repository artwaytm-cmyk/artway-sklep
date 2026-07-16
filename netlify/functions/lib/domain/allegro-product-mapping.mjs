import { canonicalGtin } from './product-identifiers.mjs';

const clip = (value = '', limit = 400) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
const normalize = (value = '') => clip(value, 500).toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const gtinKey = (value = '') => canonicalGtin(value) || normalize(value);
const significantTokens = (value = '') => {
  const stop = new Set(['gra', 'gry', 'zabawka', 'zabawki', 'zestaw', 'alexander', 'multigra', 'godan', 'origami', 'konstruktor', 'junior', 'maly', 'mala', 'duzy', 'duza', 'dla', 'oraz', 'wersja', 'szt', 'elementow']);
  return new Set(normalize(value).split(/\s+/).filter((token) => token.length > 2 && !stop.has(token)));
};
const significantSimilarity = (left = '', right = '') => {
  const a = significantTokens(left), b = significantTokens(right);
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const token of a) if (b.has(token)) common += 1;
  return common / Math.max(a.size, b.size);
};
const tokenSimilarity = (left = '', right = '') => {
  const a = new Set(normalize(left).split(/\s+/).filter((token) => token.length > 2));
  const b = new Set(normalize(right).split(/\s+/).filter((token) => token.length > 2));
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const token of a) if (b.has(token)) common += 1;
  return common / Math.max(a.size, b.size);
};

export function mappingVerifiedForSupplier(mapping = {}) {
  if (mapping?.verifiedForSupplier === true || mapping?.supplierOrderEligible === true) return true;
  return /^(admin-(?:validated|force|safe-batch|duplicate-keep)|auto-order:)/i.test(String(mapping?.operator || '').trim());
}
export function mappingProductSnapshot(product = {}, data = {}) {
  const id = String(product.id ?? product.produktId ?? product.productId ?? '').trim();
  const warehouse = data?.artway_magazyn_produkty?.[id] && typeof data.artway_magazyn_produkty[id] === 'object' ? data.artway_magazyn_produkty[id] : {};
  const ean = clip(product.gtin || product.ean || product.GTIN || product.EAN, 80);
  return {
    id, productId: id, nazwa: clip(product.nazwa || product.name, 300),
    externalId: clip(product.externalId || product.sku, 160), sku: clip(product.sku || product.externalId, 160),
    ean, gtin: ean, canonicalGtin: canonicalGtin(ean),
    kodProducenta: clip(product.kodProducenta || product.mpn || product.supplierCode || warehouse.kodDostawcy, 160),
    producent: clip(product.producent || product.manufacturer || product.marka || product.brand, 160),
    marka: clip(product.marka || product.brand || product.producent || product.manufacturer, 160),
    dostawca: clip(warehouse.dostawca || warehouse.supplier || product.dostawca || product.supplier, 160),
    sourceUrl: clip(product.sourceUrl || product.producentUrl || product.agentImportUrl || product.url, 3000),
  };
}

export function mappedProductFallback(mapping = {}, line = {}, offer = {}, productId = '') {
  const snapshot = mapping?.productSnapshot && typeof mapping.productSnapshot === 'object' ? mapping.productSnapshot : {};
  return {
    ...snapshot, id: productId, productId,
    nazwa: clip(snapshot.nazwa || snapshot.name || mapping.productName || line.offerName || offer.name || `Produkt ${productId}`, 300),
    externalId: clip(snapshot.externalId || snapshot.sku || line.externalId || offer.externalId, 160),
    ean: clip(snapshot.ean || snapshot.gtin || offer.ean || offer.gtin, 80),
    gtin: clip(snapshot.gtin || snapshot.ean || offer.gtin || offer.ean, 80),
    kodProducenta: clip(snapshot.kodProducenta || snapshot.mpn || offer.manufacturerCode || offer.producerCode, 160),
    producent: clip(snapshot.producent || snapshot.manufacturer || snapshot.marka || snapshot.brand || offer.brand, 160),
    dostawca: clip(snapshot.dostawca || snapshot.supplier, 160),
  };
}

export function scoreAllegroProductMapping(product = {}, offer = {}) {
  const p = {
    ean: gtinKey(product.gtin || product.ean), external: normalize(product.externalId || product.sku),
    code: normalize(product.kodProducenta || product.mpn), catalog: String(product.allegroProductId || '').trim(),
    offerId: String(product.allegroOfferId || '').trim(), name: clip(product.nazwa || product.name, 400),
  };
  const o = {
    ean: gtinKey(offer.ean || offer.gtin), external: normalize(offer.externalId),
    code: normalize(offer.manufacturerCode || offer.producerCode), catalog: String(offer.productId || '').trim(),
    id: String(offer.id || '').trim(), name: clip(offer.name || offer.offerName, 400),
  };
  const evidence = [], conflicts = [];
  let score = 0, reason = '';
  const hit = (value, label) => { if (value > score) { score = value; reason = label; } evidence.push(label); };
  if (p.ean && o.ean) p.ean === o.ean ? hit(100, 'identyczny EAN/GTIN') : conflicts.push('różny EAN/GTIN');
  if (p.catalog && o.catalog) p.catalog === o.catalog ? hit(99, 'identyczny produkt katalogowy Allegro') : conflicts.push('różne ID produktu katalogowego');
  if (p.external && o.external) p.external === o.external ? hit(97, 'identyczny EXTERNAL_ID/SKU') : conflicts.push('różny EXTERNAL_ID/SKU');
  if (p.code && o.code) p.code === o.code ? hit(95, 'identyczny kod producenta') : conflicts.push('różny kod producenta');
  const exact = p.name && o.name && normalize(p.name) === normalize(o.name);
  const similarity = p.name && o.name ? significantSimilarity(p.name, o.name) : 0;
  if (exact) hit(92, 'identyczna nazwa');
  else if (similarity >= 0.72) hit(Math.round(72 + similarity * 18), 'bardzo podobna nazwa');
  else if (similarity >= 0.45) hit(Math.round(52 + similarity * 20), 'częściowo podobna nazwa');
  if (p.offerId && o.id && p.offerId === o.id && !conflicts.includes('różny EAN/GTIN')) hit(Math.max(score, 70), 'zapisane ID oferty');
  const strongConflict = conflicts.includes('różny EAN/GTIN') || (conflicts.includes('różne ID produktu katalogowego') && !!p.catalog && !!o.catalog);
  if (strongConflict) score = Math.min(score, 35);
  else if (conflicts.length && score < 95) score = Math.max(0, score - Math.min(25, conflicts.length * 8));
  return { score, reason: reason || 'brak wspólnych identyfikatorów', evidence, conflicts, similarity: Math.round(similarity * 100), strongConflict, valid: score >= 65 && !strongConflict };
}

export function findBestAllegroOffer(product = {}, offersRaw = [], mappingsRaw = {}, minimumScore = 85) {
  const offers = Array.isArray(offersRaw) ? offersRaw : (Array.isArray(offersRaw?.items) ? offersRaw.items : []);
  const mappings = mappingsRaw?.items && typeof mappingsRaw.items === 'object' ? mappingsRaw.items : (mappingsRaw || {});
  const productId = String(product.id ?? '').trim();
  const savedOfferId = clip(product.allegroOfferId, 100);
  const catalogProductId = clip(product.allegroProductId, 120);
  const externalId = normalize(product.externalId || product.sku || product.kodProducenta || product.mpn);
  const ean = gtinKey(product.gtin || product.ean);
  const producerCode = normalize(product.kodProducenta || product.mpn);
  const name = normalize(product.nazwa || product.name);
  const threshold = Math.min(100, Math.max(55, Number(minimumScore) || 85));
  const mappedOfferId = Object.values(mappings).find((mapping) => mapping?.blocked !== true && String(mapping?.productId ?? '') === productId)?.offerId || '';
  const credible = (offer) => {
    const hasEvidence = !!(offer?.name || offer?.offerName || offer?.productId || offer?.ean || offer?.gtin || offer?.externalId || offer?.manufacturerCode || offer?.producerCode);
    return !hasEvidence || scoreAllegroProductMapping(product, offer).valid;
  };
  let best = null;
  for (const offer of offers) {
    const publicationStatus = String(offer?.status || offer?.publication?.status || '').toUpperCase();
    if (['ENDED', 'ARCHIVED'].includes(publicationStatus)) continue;
    let score = 0, reason = '';
    if (savedOfferId && String(offer?.id) === savedOfferId && credible(offer)) { score = 100; reason = 'zapisane ID oferty'; }
    else if (mappedOfferId && String(offer?.id) === String(mappedOfferId) && credible(offer)) { score = 98; reason = 'mapowanie produktu'; }
    else if (catalogProductId && String(offer?.productId || '') === catalogProductId && credible(offer)) { score = 97; reason = 'identyczne ID produktu katalogowego Allegro'; }
    else if (externalId && normalize(offer?.externalId) === externalId) { score = 95; reason = 'identyczny external.id / SKU'; }
    else if (ean && gtinKey(offer?.ean || offer?.gtin) === ean) { score = 92; reason = 'identyczny EAN/GTIN'; }
    else if (producerCode && normalize(offer?.manufacturerCode || offer?.producerCode) === producerCode) { score = 88; reason = 'identyczny kod producenta'; }
    else if (name && normalize(offer?.name) === name) { score = 86; reason = 'identyczna nazwa oferty'; }
    else {
      const similarity = tokenSimilarity(product.nazwa || product.name, offer?.name);
      const sameCategory = product.allegroCategoryId && String(product.allegroCategoryId) === String(offer?.categoryId || '');
      if (similarity >= 0.82) { score = 70 + Math.round(similarity * 10) + (sameCategory ? 5 : 0); reason = 'bardzo podobna nazwa'; }
      else {
        const validation = scoreAllegroProductMapping(product, offer);
        if (!validation.strongConflict && validation.score >= threshold) { score = validation.score; reason = validation.reason; }
      }
    }
    if (score && (!best || score > best.score)) best = { offer, score, reason };
  }
  return best?.score >= threshold ? best : null;
}
