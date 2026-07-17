import { canonicalGtin } from './product-identifiers.mjs';

const clip = (value = '', limit = 400) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
const normalize = (value = '') => clip(value, 500).toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const gtinKeys = (...values) => [...new Set(values.flat(Infinity).map(canonicalGtin).filter(Boolean))];
const parameterGtins = (source = {}) => {
  const out = [];
  const read = (parameters = []) => {
    for (const parameter of Array.isArray(parameters) ? parameters : []) {
      const name = normalize(parameter?.name || parameter?.label || parameter?.key);
      const id = String(parameter?.id || '').trim();
      if (parameter?.options?.isGTIN === true || ['225693', '245669', '245673'].includes(id) || /(^| )(ean|gtin|isbn|issn|kod kreskowy)( |$)/.test(name)) {
        out.push(parameter?.values, parameter?.valuesLabels, parameter?.value);
      }
    }
  };
  read(source?.parameters);
  read(source?.product?.parameters);
  for (const item of Array.isArray(source?.productSet) ? source.productSet : []) read(item?.product?.parameters);
  return out;
};
const productGtins = (product = {}) => gtinKeys(
  product.canonicalGtins, product.gtins, product.canonicalGtin, product.gtin, product.ean, product.GTIN, product.EAN, product.kodKreskowy,
  product.parametryProducenta?.ean, product.parametryProducenta?.gtin, product.parametryProducenta?.kodKreskowy, product.parametryProducenta?.kodProducenta,
  product.parametryZrodla?.ean, product.parametryZrodla?.gtin, product.parametryZrodla?.['kod kreskowy'], product.parametryZrodla?.['kod producenta'],
  parameterGtins(product),
);
const offerGtins = (offer = {}) => gtinKeys(offer.canonicalGtins, offer.gtins, offer.canonicalGtin, offer.gtin, offer.ean, offer.GTIN, offer.EAN, offer.barcode, parameterGtins(offer));
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
const offerIndexCache = new WeakMap();
const mappingOfferIndexCache = new WeakMap();
const addIndex = (map, key, offer) => { if (!key) return; const list = map.get(key) || []; list.push(offer); map.set(key, list); };
function mappedOfferForProduct(mappings = {}, productId = '') {
  if (!mappings || typeof mappings !== 'object') return '';
  let index = mappingOfferIndexCache.get(mappings);
  if (!index) {
    index = new Map(Object.values(mappings).filter((mapping) => mapping?.blocked !== true && mapping?.productId).map((mapping) => [String(mapping.productId), String(mapping.offerId || '')]));
    mappingOfferIndexCache.set(mappings, index);
  }
  return index.get(String(productId)) || '';
}
function indexedOfferCandidates(product = {}, offers = [], mappedOfferId = '') {
  let index = offerIndexCache.get(offers);
  if (!index) {
    index = { byId: new Map(), ean: new Map(), external: new Map(), code: new Map(), catalog: new Map(), name: new Map(), token: new Map() };
    for (const offer of offers) {
      const id = String(offer?.id || '').trim(); if (id) index.byId.set(id, offer);
      offerGtins(offer).forEach((ean) => addIndex(index.ean, ean, offer));
      addIndex(index.external, normalize(offer?.externalId), offer);
      addIndex(index.code, normalize(offer?.manufacturerCode || offer?.producerCode), offer);
      addIndex(index.catalog, String(offer?.productId || '').trim(), offer);
      addIndex(index.name, normalize(offer?.name || offer?.offerName), offer);
      significantTokens(offer?.name || offer?.offerName).forEach((token) => addIndex(index.token, token, offer));
    }
    offerIndexCache.set(offers, index);
  }
  const scored = new Map(), add = (list, points) => { for (const offer of list || []) { const id = String(offer?.id || ''); if (id) scored.set(id, { offer, score: (scored.get(id)?.score || 0) + points }); } };
  add([index.byId.get(String(product?.allegroOfferId || ''))], 2000);
  add([index.byId.get(String(mappedOfferId || ''))], 1900);
  productGtins(product).forEach((ean) => add(index.ean.get(ean), 1000));
  add(index.catalog.get(String(product?.allegroProductId || '').trim()), 900);
  add(index.external.get(normalize(product?.externalId || product?.sku || product?.kodProducenta || product?.mpn)), 800);
  add(index.code.get(normalize(product?.kodProducenta || product?.mpn)), 700);
  add(index.name.get(normalize(product?.nazwa || product?.name)), 600);
  [...significantTokens(product?.nazwa || product?.name)].sort((a, b) => (index.token.get(a)?.length || 0) - (index.token.get(b)?.length || 0)).slice(0, 4)
    .forEach((token) => add((index.token.get(token) || []).slice(0, 200), 10));
  return [...scored.values()].sort((a, b) => b.score - a.score || String(a.offer.id).localeCompare(String(b.offer.id))).slice(0, 800).map((entry) => entry.offer);
}

export function mappingVerifiedForSupplier(mapping = {}) {
  if (mapping?.verifiedForSupplier === true || mapping?.supplierOrderEligible === true) return true;
  return /^(admin-(?:validated|force|safe-batch|duplicate-keep)|auto-order:)/i.test(String(mapping?.operator || '').trim());
}
export function mappingProductSnapshot(product = {}, data = {}) {
  const id = String(product.id ?? product.produktId ?? product.productId ?? '').trim();
  const warehouse = data?.artway_magazyn_produkty?.[id] && typeof data.artway_magazyn_produkty[id] === 'object' ? data.artway_magazyn_produkty[id] : {};
  const rawGtins = [
    product.gtin, product.ean, product.GTIN, product.EAN, product.kodKreskowy,
    product.parametryProducenta?.ean, product.parametryProducenta?.gtin, product.parametryProducenta?.kodKreskowy, product.parametryProducenta?.kodProducenta,
    product.parametryZrodla?.ean, product.parametryZrodla?.gtin, product.parametryZrodla?.['kod kreskowy'], product.parametryZrodla?.['kod producenta'],
  ].flat(Infinity).filter((value) => canonicalGtin(value));
  const ean = clip(rawGtins[0] || '', 80);
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
    eans: productGtins(product), external: normalize(product.externalId || product.sku),
    code: normalize(product.kodProducenta || product.mpn), catalog: String(product.allegroProductId || '').trim(),
    offerId: String(product.allegroOfferId || '').trim(), name: clip(product.nazwa || product.name, 400),
  };
  const o = {
    eans: offerGtins(offer), external: normalize(offer.externalId),
    code: normalize(offer.manufacturerCode || offer.producerCode), catalog: String(offer.productId || '').trim(),
    id: String(offer.id || '').trim(), name: clip(offer.name || offer.offerName, 400),
  };
  const evidence = [], conflicts = [], warnings = [];
  let score = 0, reason = '';
  const hit = (value, label) => { if (value > score) { score = value; reason = label; } evidence.push(label); };
  const eanMatch = p.eans.length && o.eans.length && p.eans.some((ean) => o.eans.includes(ean));
  const eanMismatch = p.eans.length && o.eans.length && !eanMatch;
  const catalogMatch = !!(p.catalog && o.catalog && p.catalog === o.catalog);
  const catalogMismatch = !!(p.catalog && o.catalog && !catalogMatch);
  const externalMatch = !!(p.external && o.external && p.external === o.external);
  const codeMatch = !!(p.code && o.code && p.code === o.code);
  if (eanMatch) hit(100, 'identyczny EAN/GTIN');
  if (catalogMatch) hit(99, 'identyczny produkt katalogowy Allegro');
  if (externalMatch) hit(97, 'identyczny EXTERNAL_ID/SKU');
  if (codeMatch) hit(95, 'identyczny kod producenta');
  const exact = p.name && o.name && normalize(p.name) === normalize(o.name);
  const similarity = p.name && o.name ? significantSimilarity(p.name, o.name) : 0;
  if (exact) hit(92, 'identyczna nazwa');
  else if (similarity >= 0.72) hit(Math.round(72 + similarity * 18), 'bardzo podobna nazwa');
  else if (similarity >= 0.45) hit(Math.round(52 + similarity * 20), 'częściowo podobna nazwa');
  const savedOfferMatch = !!(p.offerId && o.id && p.offerId === o.id);
  if (savedOfferMatch) hit(Math.max(score, 98), 'zapisane ID oferty');

  // Brak pola nigdy nie jest niezgodnością. Rozbieżny EAN również nie może
  // zniszczyć kilku niezależnych, mocnych dowodów (np. UUID katalogu + MPN +
  // identyczna nazwa). Wtedy to kartoteka EAN wymaga korekty, a nie mapowanie.
  const independentIdentity = catalogMatch || savedOfferMatch || (codeMatch && (exact || similarity >= 0.72)) || (externalMatch && exact);
  if (eanMismatch) {
    if (independentIdentity) warnings.push('EAN w kartotece różni się — tożsamość potwierdzają silniejsze dowody');
    else conflicts.push('różny EAN/GTIN');
  }
  if (catalogMismatch) {
    if (eanMatch || savedOfferMatch || (codeMatch && exact)) warnings.push('różne ID produktu katalogowego — sprawdź aktualność UUID');
    else conflicts.push('różne ID produktu katalogowego');
  }
  if (p.code && o.code && !codeMatch && (eanMatch || catalogMatch || savedOfferMatch)) warnings.push('kod producenta różni się — sprawdź kartotekę');
  const strongConflict = conflicts.includes('różny EAN/GTIN') || conflicts.includes('różne ID produktu katalogowego');
  if (strongConflict) score = Math.min(score, 35);
  return {
    score, reason: reason || 'brak wspólnych identyfikatorów', evidence, conflicts, warnings,
    similarity: Math.round(similarity * 100), strongConflict, valid: score >= 65 && !strongConflict,
    identity: score >= 95 ? 'pewna' : score >= 88 ? 'wysoka' : score >= 65 ? 'do potwierdzenia' : 'brak pewności',
  };
}

export function reassessBlockedAllegroMapping({ current = {}, product = {}, offer = {}, mappings = {}, offersById = new Map(), minimumScore = 85, now = new Date().toISOString() } = {}) {
  if (current?.blocked !== true || !/^auto-(?:quarantine|duplicate-offer)/i.test(String(current?.operator || '')) || !product?.id || !offer?.id) return null;
  const productId = String(product.id), offerId = String(offer.id), validation = scoreAllegroProductMapping(product, offer);
  const occupied = Object.values(mappings).find((mapping) => {
    if (mapping?.blocked === true || String(mapping?.offerId || '') === offerId || String(mapping?.productId || '') !== productId) return false;
    const publication = offersById.get(String(mapping?.offerId || ''));
    return !['ENDED', 'ARCHIVED'].includes(String(publication?.status || publication?.publication?.status || '').toUpperCase());
  });
  if (validation.valid && validation.score >= Math.max(55, Number(minimumScore) || 85)) {
    return occupied ? {
      ...current, confidence: validation.score, reason: validation.reason, evidence: validation.evidence,
      conflicts: validation.conflicts, warnings: validation.warnings, operator: 'auto-duplicate-offer',
      duplicateOfferId: String(occupied.offerId || ''), reassessed_at: now,
    } : {
      ...current, productId, blocked: false, confidence: validation.score, reason: validation.reason,
      evidence: validation.evidence, conflicts: validation.conflicts, warnings: validation.warnings,
      operator: `auto-recovered:${validation.reason}`, verification: validation.score >= 88 ? 'strong-identifiers' : 'catalog-sync-review',
      verifiedForSupplier: validation.score >= 88, duplicateOfferId: '', conflict: null, reassessed_at: now, synced_at: now,
    };
  }
  return Number(current.confidence || 0) === Number(validation.score || 0) ? null : {
    ...current, confidence: validation.score, reason: validation.reason, evidence: validation.evidence,
    conflicts: validation.conflicts, warnings: validation.warnings, reassessed_at: now,
  };
}

export function findBestAllegroOffer(product = {}, offersRaw = [], mappingsRaw = {}, minimumScore = 85) {
  const allOffers = Array.isArray(offersRaw) ? offersRaw : (Array.isArray(offersRaw?.items) ? offersRaw.items : []);
  const mappings = mappingsRaw?.items && typeof mappingsRaw.items === 'object' ? mappingsRaw.items : (mappingsRaw || {});
  const productId = String(product.id ?? '').trim();
  const savedOfferId = clip(product.allegroOfferId, 100);
  const catalogProductId = clip(product.allegroProductId, 120);
  const externalId = normalize(product.externalId || product.sku || product.kodProducenta || product.mpn);
  const eans = productGtins(product);
  const producerCode = normalize(product.kodProducenta || product.mpn);
  const name = normalize(product.nazwa || product.name);
  const threshold = Math.min(100, Math.max(55, Number(minimumScore) || 85));
  const mappedOfferId = mappedOfferForProduct(mappings, productId);
  const offers = indexedOfferCandidates(product, allOffers, mappedOfferId);
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
    else if (eans.length && offerGtins(offer).some((ean) => eans.includes(ean))) { score = 92; reason = 'identyczny EAN/GTIN'; }
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
