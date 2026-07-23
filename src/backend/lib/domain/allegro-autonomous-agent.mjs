import { allegroOfferGtinCandidates } from './allegro-offer-identifiers.mjs';
import { canonicalGtin } from './product-identifiers.mjs';
import { scoreAllegroProductMapping } from './allegro-product-mapping.mjs';

const clip = (value = '', limit = 500) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
const normalize = (value = '') => clip(value).toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const array = (value) => Array.isArray(value) ? value : [];
const activeStatus = (offer = {}) => String(offer?.status || offer?.publication?.status || '').toUpperCase();
const isOpen = (offer = {}) => !['ENDED', 'ARCHIVED'].includes(activeStatus(offer));
const offerId = (offer = {}) => clip(offer?.id, 100);

function productGtins(product = {}) {
  const source = [
    product.canonicalGtins, product.gtins, product.canonicalGtin, product.gtin, product.ean, product.EAN, product.GTIN, product.kodKreskowy,
    product.parametryProducenta?.ean, product.parametryProducenta?.gtin, product.parametryProducenta?.kodKreskowy,
    product.parametryZrodla?.ean, product.parametryZrodla?.gtin, product.parametryZrodla?.['kod kreskowy'],
  ].flat(Infinity);
  return [...new Set(source.map(canonicalGtin).filter(Boolean))];
}

function offerCatalogIds(offer = {}) {
  return [...new Set([
    offer.productId, offer.product?.id,
    ...array(offer.productSet).map((entry) => entry?.product?.id),
  ].map((value) => clip(value, 140)).filter(Boolean))];
}

function addIndex(index, key, productId) {
  if (!key || !productId) return;
  const values = index.get(key) || new Set();
  values.add(productId);
  index.set(key, values);
}

function productIndex(products = new Map()) {
  const result = { catalog: new Map(), ean: new Map(), external: new Map(), code: new Map() };
  for (const product of products.values()) {
    const id = clip(product?.id ?? product?.productId, 120);
    if (!id) continue;
    addIndex(result.catalog, clip(product?.allegroProductId, 140), id);
    for (const gtin of productGtins(product)) addIndex(result.ean, gtin, id);
    addIndex(result.external, normalize(product?.externalId || product?.sku), id);
    addIndex(result.code, normalize(product?.kodProducenta || product?.mpn || product?.supplierCode), id);
  }
  return result;
}

function candidateProductIds(offer = {}, index = {}, mapping = {}) {
  const ids = new Set();
  const add = (values) => { for (const id of values || []) ids.add(String(id)); };
  if (mapping?.blocked !== true && mapping?.productId) ids.add(String(mapping.productId));
  for (const catalogId of offerCatalogIds(offer)) add(index.catalog?.get(catalogId));
  for (const gtin of allegroOfferGtinCandidates(offer).map((entry) => entry.canonical)) add(index.ean?.get(gtin));
  add(index.external?.get(normalize(offer?.externalId)));
  add(index.code?.get(normalize(offer?.manufacturerCode || offer?.producerCode)));
  return [...ids];
}

function salesCount(offer = {}, salesByOffer = {}) {
  const values = [offer.stockSold, offer.sold, offer.stock?.sold, offer.stats?.sold, offer.saleInfo?.sold];
  return Math.max(0, Number(salesByOffer?.[offerId(offer)]) || 0, ...values.map(Number).filter(Number.isFinite));
}

function completeness(offer = {}) {
  let score = 0;
  if (offerCatalogIds(offer).length) score += 5;
  if (allegroOfferGtinCandidates(offer).length) score += 5;
  if (offer.externalId) score += 3;
  if (offer.descriptionText || offer.description?.sections?.length) score += 3;
  if (offer.mainImage || array(offer.images).length) score += 3;
  if (offer.categoryId) score += 2;
  return score;
}

function rankOffer(entry = {}, product = {}, mapping = {}, salesByOffer = {}) {
  const offer = entry.offer || {}, id = offerId(offer), sold = salesCount(offer, salesByOffer), status = activeStatus(offer);
  const currentlySaved = String(product?.allegroOfferId || '') === id;
  const activelyMapped = mapping?.blocked !== true && String(mapping?.productId || '') === String(product?.id || '');
  const statusPoints = status === 'ACTIVE' ? 25 : status === 'ACTIVATING' ? 15 : status === 'INACTIVE' ? 5 : 0;
  const score = Math.min(200, sold * 50) + statusPoints + completeness(offer) + (currentlySaved ? 18 : 0) + (activelyMapped ? 12 : 0);
  return { ...entry, score, sold, status, currentlySaved, activelyMapped, completeness: completeness(offer) };
}

/**
 * Analiza nie wykonuje zmian. Do automatycznego działania dopuszcza wyłącznie
 * jednoznaczne identyfikatory (EAN/GTIN, UUID katalogu albo EXTERNAL_ID/SKU).
 * Sama podobna nazwa nigdy nie może zakończyć oferty.
 */
export function analyzeAutonomousAllegroWork({
  offers: offersRaw = [], mappings: mappingsRaw = {}, products: productsRaw = new Map(),
  minimumScore = 97, ambiguityMargin = 6, salesByOffer = {},
} = {}) {
  const offers = array(offersRaw?.items || offersRaw).filter((offer) => offerId(offer) && isOpen(offer));
  const mappings = mappingsRaw?.items && typeof mappingsRaw.items === 'object' ? mappingsRaw.items : (mappingsRaw || {});
  const productValues = productsRaw instanceof Map ? [...productsRaw.values()] : array(productsRaw);
  const products = new Map(productValues.map((product) => [String(product?.id ?? product?.productId ?? ''), product]).filter(([id]) => id));
  const index = productIndex(products), threshold = Math.min(100, Math.max(95, Number(minimumScore) || 97));
  const grouped = new Map(), review = [], recognized = [];

  for (const offer of offers) {
    const id = offerId(offer), mapping = mappings[id] || {};
    const scored = candidateProductIds(offer, index, mapping).map((productId) => {
      const product = products.get(String(productId));
      return product ? { product, validation: scoreAllegroProductMapping(product, offer) } : null;
    }).filter(Boolean).sort((left, right) => right.validation.score - left.validation.score || String(left.product.id).localeCompare(String(right.product.id)));
    const best = scored[0], second = scored[1];
    if (!best) continue;
    const margin = best.validation.score - (second?.validation.score || 0);
    const deterministic = best.validation.evidence.some((evidence) => /EAN\/GTIN|produkt katalogowy|EXTERNAL_ID\/SKU|zapisane ID oferty/i.test(evidence));
    if (best.validation.strongConflict || !deterministic || best.validation.score < threshold || (second && margin < ambiguityMargin)) {
      if (best.validation.score >= 65) review.push({ offerId: id, offerName: clip(offer.name, 300), bestProductId: String(best.product.id), bestProductName: clip(best.product.nazwa || best.product.name, 300), score: best.validation.score, margin, reason: best.validation.reason, evidence: best.validation.evidence, conflicts: best.validation.conflicts, code: best.validation.strongConflict ? 'identity_conflict' : !deterministic ? 'name_only' : second && margin < ambiguityMargin ? 'ambiguous_product' : 'below_safe_threshold' });
      continue;
    }
    const productId = String(best.product.id), entry = { offer, product: best.product, validation: best.validation, margin };
    if (!grouped.has(productId)) grouped.set(productId, []);
    grouped.get(productId).push(entry);
    recognized.push({ offerId: id, productId, score: best.validation.score, reason: best.validation.reason, mapped: mapping?.blocked !== true && String(mapping?.productId || '') === productId });
  }

  const duplicates = [];
  for (const [productId, entries] of grouped.entries()) {
    if (entries.length < 2) continue;
    const product = products.get(productId) || entries[0].product;
    const ranked = entries.map((entry) => rankOffer(entry, product, mappings[offerId(entry.offer)] || {}, salesByOffer))
      .sort((left, right) => right.score - left.score || right.sold - left.sold || offerId(left.offer).localeCompare(offerId(right.offer)));
    const keep = ranked[0], withdraw = ranked.slice(1);
    const confidence = Math.min(...ranked.map((entry) => Number(entry.validation.score) || 0));
    duplicates.push({
      productId, productName: clip(product?.nazwa || product?.name, 300), confidence,
      keepOfferId: offerId(keep.offer), withdrawOfferIds: withdraw.map((entry) => offerId(entry.offer)),
      reason: `jednoznaczne identyfikatory; pozostawiono ofertę z najlepszą historią i kompletnością`,
      offers: ranked.map((entry) => ({ offerId: offerId(entry.offer), name: clip(entry.offer?.name, 300), rank: entry.score, sold: entry.sold, status: entry.status, matchScore: entry.validation.score, matchReason: entry.validation.reason, evidence: entry.validation.evidence, currentlySaved: entry.currentlySaved, activelyMapped: entry.activelyMapped })),
    });
  }

  duplicates.sort((left, right) => right.confidence - left.confidence || left.productName.localeCompare(right.productName, 'pl'));
  return {
    duplicates, review, recognized,
    stats: { offers: offers.length, products: products.size, recognized: recognized.length, duplicateGroups: duplicates.length, duplicateOffers: duplicates.reduce((sum, group) => sum + group.withdrawOfferIds.length, 0), review: review.length, threshold },
  };
}
