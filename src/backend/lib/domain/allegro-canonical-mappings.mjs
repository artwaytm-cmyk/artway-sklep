import crypto from 'node:crypto';

const clip = (value = '', limit = 500) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
const statusOf = (offer = {}) => String(offer?.status || offer?.publication?.status || '').trim().toUpperCase();
const openStatus = (offer = {}) => !!offer?.id && !['ENDED', 'ARCHIVED'].includes(statusOf(offer));
const json = (value) => JSON.stringify(value ?? null);

function productMap(products = new Map()) {
  if (products instanceof Map) return products;
  const values = Array.isArray(products) ? products : Object.values(products || {});
  return new Map(values.map((product) => [String(product?.id ?? product?.productId ?? ''), product]).filter(([id]) => id));
}

function offerMap(offers = []) {
  const values = Array.isArray(offers) ? offers : (Array.isArray(offers?.items) ? offers.items : []);
  return new Map(values.map((offer) => [String(offer?.id || ''), offer]).filter(([id]) => id));
}

function mappingManualPriority(mapping = {}) {
  if (mapping?.locked === true || mapping?.canonicalLocked === true) return 4;
  if (/^admin-(?:manual-decision|validated|force|safe-batch|duplicate-keep)/i.test(String(mapping?.operator || ''))) return 3;
  if (mapping?.canonical === true || mapping?.mappingRole === 'primary') return 2;
  return 0;
}

function primaryRank(mapping = {}, offer = {}, product = {}) {
  const id = String(mapping?.offerId || offer?.id || '');
  const saved = String(product?.allegroOfferId || '') === id ? 1 : 0;
  const active = statusOf(offer) === 'ACTIVE' ? 1 : 0;
  const linked = Date.parse(mapping?.linked_at || mapping?.linkedAt || '') || 0;
  return [mappingManualPriority(mapping), saved, active, linked, id];
}

function rankCompare(left = [], right = []) {
  for (let index = 0; index < Math.max(left.length, right.length) - 1; index += 1) {
    if (left[index] !== right[index]) return Number(right[index] || 0) - Number(left[index] || 0);
  }
  return String(left.at(-1) || '').localeCompare(String(right.at(-1) || ''));
}

export function allegroProductSyncFingerprint(product = {}) {
  const payload = {
    id: clip(product.id ?? product.productId, 120),
    title: clip(product.allegroTitle || product.nazwa || product.name, 200),
    price: Number(product.cenaAllegro ?? product.allegroPrice ?? product.cena ?? product.price) || 0,
    short: clip(product.opisKrotki || product.shortDescription, 4000),
    long: clip(product.opis || product.allegroDescription || product.description, 30000),
    sections: Array.isArray(product.allegroDescriptionSections) ? product.allegroDescriptionSections : [],
    image: clip(product.zdjecie || product.image, 3000),
    images: (Array.isArray(product.zdjecia) ? product.zdjecia : []).map((item) => clip(item, 3000)).filter(Boolean).slice(0, 16),
    ean: clip(product.gtin || product.ean, 80),
    external: clip(product.externalId || product.sku, 160),
    producerCode: clip(product.kodProducenta || product.mpn, 160),
    producer: clip(product.producent || product.marka, 160),
    category: clip(product.allegroCategoryId, 100),
    catalogProduct: clip(product.allegroProductId, 160),
    available: product.sprzedazAktywna !== false && product.ukryty !== true,
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 24);
}

export function allegroMappingIsLinked(mapping = {}) {
  return mapping?.blocked !== true && !!String(mapping?.productId || '').trim();
}

export function allegroMappingIsCanonical(mapping = {}) {
  return allegroMappingIsLinked(mapping) && mapping?.lifecycle !== 'historical'
    && (mapping?.canonical === true || mapping?.mappingRole === 'primary');
}

/**
 * Porządkuje mapowania bez kasowania historii potrzebnej zamówieniom.
 * Dla produktu istnieje jedna oferta główna. Nieobecne lub zakończone oferty
 * pozostają powiązane historycznie, a kolejne bieżące oferty są jawnie
 * oznaczone jako duplikaty oczekujące na decyzję administratora.
 */
export function canonicalizeAllegroMappings({ mappings: mappingsRaw = {}, offers = [], products = new Map(), now = new Date().toISOString() } = {}) {
  const input = mappingsRaw?.items && typeof mappingsRaw.items === 'object' ? mappingsRaw.items : (mappingsRaw || {});
  const mappings = Object.fromEntries(Object.entries(input).map(([key, value]) => [String(key), { ...(value || {}), offerId: String(value?.offerId || key) }]));
  const offersById = offerMap(offers), productsById = productMap(products), groups = new Map();

  for (const [offerId, mapping] of Object.entries(mappings)) {
    if (!allegroMappingIsLinked(mapping)) continue;
    const productId = String(mapping.productId), offer = offersById.get(offerId);
    if (!openStatus(offer)) {
      mappings[offerId] = {
        ...mapping, canonical: false, mappingRole: 'historical', lifecycle: 'historical', active: false,
        duplicateOf: '', historicalReason: offer ? `status:${statusOf(offer).toLowerCase()}` : 'not_in_current_offer_snapshot',
      };
      continue;
    }
    const list = groups.get(productId) || [];
    list.push({ offerId, mapping, offer });
    groups.set(productId, list);
  }

  for (const [productId, group] of groups.entries()) {
    const product = productsById.get(productId) || {};
    const sorted = [...group].sort((left, right) => rankCompare(primaryRank(left.mapping, left.offer, product), primaryRank(right.mapping, right.offer, product)));
    const primary = sorted[0];
    for (const entry of sorted) {
      const isPrimary = entry.offerId === primary.offerId;
      mappings[entry.offerId] = isPrimary ? {
        ...mappings[entry.offerId], canonical: true, mappingRole: 'primary', lifecycle: 'current', active: true,
        duplicateOf: '', duplicateDecisionRequired: false, historicalReason: '', canonicalSelectedAt: mappings[entry.offerId].canonicalSelectedAt || now,
        sourceOfTruth: 'store',
      } : {
        ...mappings[entry.offerId], canonical: false, mappingRole: 'duplicate', lifecycle: 'current', active: true,
        duplicateOf: primary.offerId, duplicateDecisionRequired: true, historicalReason: '', sourceOfTruth: 'store',
      };
    }
  }

  const changedOfferIds = Object.keys(mappings).filter((offerId) => json(mappings[offerId]) !== json(input[offerId]));
  const stats = Object.values(mappings).reduce((result, mapping) => {
    if (!allegroMappingIsLinked(mapping)) result.unlinked += 1;
    else if (mapping.lifecycle === 'historical') result.historical += 1;
    else if (mapping.mappingRole === 'duplicate') result.duplicates += 1;
    else if (allegroMappingIsCanonical(mapping)) result.canonical += 1;
    return result;
  }, { canonical: 0, duplicates: 0, historical: 0, unlinked: 0 });
  return { mappings, changed: changedOfferIds.length > 0, changedOfferIds, stats };
}

export function linkCanonicalAllegroMapping({ mappings: mappingsRaw = {}, offers = [], products = new Map(), offer, product, validation = {}, operator = 'admin-manual-decision', now = new Date().toISOString() } = {}) {
  const offerId = String(offer?.id || '').trim(), productId = String(product?.id ?? product?.productId ?? '').trim();
  if (!offerId || !productId) throw new Error('Oferta i produkt są wymagane do utworzenia powiązania.');
  const normalized = canonicalizeAllegroMappings({ mappings: mappingsRaw, offers, products, now });
  const mappings = { ...normalized.mappings }, current = mappings[offerId] || {};
  const fingerprint = allegroProductSyncFingerprint(product);
  const alreadyCanonical = String(current.productId || '') === productId && current.blocked !== true
    && current.canonical === true && current.mappingRole === 'primary' && current.locked === true;
  const alreadySynced = alreadyCanonical && current.lastSourceFingerprint === fingerprint && current.syncState === 'synced';

  if (alreadyCanonical && alreadySynced) {
    return { mappings, changed: normalized.changed, idempotent: true, syncRequired: false, duplicateOfferIds: Object.values(mappings).filter((item) => item?.mappingRole === 'duplicate' && String(item.productId) === productId).map((item) => String(item.offerId)), fingerprint };
  }

  const history = Array.isArray(current.history) ? [...current.history] : [];
  if (current.productId && String(current.productId) !== productId) history.unshift({ at: now, action: 'remapped', fromProductId: String(current.productId), toProductId: productId, operator });
  else if (!current.productId) history.unshift({ at: now, action: 'linked', toProductId: productId, operator });
  mappings[offerId] = {
    ...current, offerId, productId, productName: clip(product.nazwa || product.name, 300), offerName: clip(offer.name, 300),
    allegroProductId: clip(offer.productId || product.allegroProductId, 160), categoryId: clip(offer.categoryId || product.allegroCategoryId, 100),
    linked_at: current.linked_at || now, canonicalSelectedAt: now, lastVerifiedAt: now, operator,
    confidence: Number(validation.score) || Number(current.confidence) || 100, reason: validation.reason || current.reason || 'ręczna decyzja administratora',
    evidence: Array.isArray(validation.evidence) ? validation.evidence : (current.evidence || ['ręczna decyzja administratora']),
    conflicts: Array.isArray(validation.conflicts) ? validation.conflicts : [], warnings: Array.isArray(validation.warnings) ? validation.warnings : [],
    blocked: false, verifiedForSupplier: true, verification: 'admin-confirmed', locked: true, canonicalLocked: true,
    canonical: true, mappingRole: 'primary', lifecycle: 'current', active: true, duplicateOf: '', duplicateDecisionRequired: false,
    sourceOfTruth: 'store', syncState: alreadySynced ? 'synced' : 'pending', pendingSourceFingerprint: fingerprint,
    syncRequestedAt: alreadySynced ? current.syncRequestedAt : now, history: history.slice(0, 12),
  };

  const offersById = offerMap(offers), duplicateOfferIds = [];
  for (const [otherOfferId, other] of Object.entries(mappings)) {
    if (otherOfferId === offerId || other?.blocked === true || String(other?.productId || '') !== productId) continue;
    const otherOffer = offersById.get(otherOfferId);
    if (openStatus(otherOffer)) {
      mappings[otherOfferId] = { ...other, canonical: false, canonicalLocked: false, mappingRole: 'duplicate', lifecycle: 'current', active: true, duplicateOf: offerId, duplicateDecisionRequired: true, sourceOfTruth: 'store' };
      duplicateOfferIds.push(otherOfferId);
    } else {
      mappings[otherOfferId] = { ...other, canonical: false, canonicalLocked: false, mappingRole: 'historical', lifecycle: 'historical', active: false, duplicateOf: '', duplicateDecisionRequired: false, historicalReason: otherOffer ? `status:${statusOf(otherOffer).toLowerCase()}` : 'not_in_current_offer_snapshot' };
    }
  }

  return { mappings, changed: true, idempotent: alreadyCanonical, syncRequired: !alreadySynced, duplicateOfferIds, fingerprint };
}

export function markAllegroMappingSynced(mapping = {}, product = {}, now = new Date().toISOString()) {
  const fingerprint = allegroProductSyncFingerprint(product);
  return {
    ...mapping, sourceOfTruth: 'store', syncState: 'synced', lastSourceFingerprint: fingerprint,
    pendingSourceFingerprint: '', synced_at: now, lastSyncedAt: now, lastVerifiedAt: now, syncError: '',
  };
}
