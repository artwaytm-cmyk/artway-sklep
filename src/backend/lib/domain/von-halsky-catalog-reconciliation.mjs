import { buildEditorialPublicationPatch } from './agent-product-editorial-state.mjs';

const text = (value, max = 500) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const upper = (value) => text(value, 60).toUpperCase();
const asArray = (value) => Array.isArray(value) ? value : [];
const identityText = (value) => text(value, 500)
  .normalize('NFKD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();
const identityGtin = (value) => {
  const digits = text(value, 100).replace(/\D/g, '');
  return [8, 12, 13, 14].includes(digits.length) ? digits : '';
};
const identityManufacturerBrand = (manufacturerCode, brand) => {
  const code = identityText(manufacturerCode);
  const maker = identityText(brand);
  return code && maker ? `${code}::${maker}` : '';
};

function stableOperationalValue(value) {
  if (Array.isArray(value)) return value.map(stableOperationalValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(?:at|date|time|timestamp)$/i.test(key))
    .map(([key, entry]) => [key, stableOperationalValue(entry)]));
}

function patchChangesProduct(product = {}, fields = {}, remove = []) {
  if (asArray(remove).some((key) => Object.prototype.hasOwnProperty.call(product, key))) return true;
  return Object.entries(fields).some(([key, value]) => {
    if (/(?:at|date|time|timestamp)$/i.test(key)) return false;
    return JSON.stringify(stableOperationalValue(product[key]))
      !== JSON.stringify(stableOperationalValue(value));
  });
}

function offerStatusPriority(status = '') {
  return ({
    PUBLISHED: 60,
    PENDING: 50,
    PROCESSING: 40,
    CLOSED: 30,
    SOLDOUT: 25,
    INACTIVE: 20,
    REJECTED: 10,
    VERIFICATION_ERROR: 8,
    ERROR: 5,
  })[upper(status)] || 0;
}

export function vonHalskyOfferValidationMessages(source = {}) {
  return [...asArray(source?.metadata?.validationErrors || source?.validationErrors),
    ...asArray(source?.metadata?.rejectionReasons || source?.rejectionReasons)]
    .map((row) => text(row?.validationMessage || row?.message || row?.code || row?.validationCode, 500))
    .filter(Boolean);
}

export function vonHalskyEffectiveOfferStatus(source = {}) {
  const offer = source?.offer || source || {};
  const status = upper(offer.status);
  if (!['PUBLISHED', 'CLOSED', 'SOLDOUT', 'INACTIVE', 'REJECTED', 'ERROR'].includes(status)
    && vonHalskyOfferValidationMessages(source).length) return 'VERIFICATION_ERROR';
  return status || 'UNKNOWN';
}

export function preferredVonHalskyOffers(offers = []) {
  const byExternalId = new Map(), byOfferId = new Map(), bySku = new Map();
  const byGtin = new Map(), byManufacturerBrand = new Map();
  const prefer = (index, key, offer) => {
    if (!key) return;
    const previous = index.get(key);
    if (!previous || offerStatusPriority(offer.status) > offerStatusPriority(previous.status)) {
      index.set(key, offer);
    }
  };
  for (const source of asArray(offers)) {
    const offer = source?.offer || source || {};
    const product = offer?.product || source?.product || {};
    const providerStatus = upper(offer.status);
    const normalized = {
      offerId: text(offer.id || offer.offerId, 200),
      externalId: text(offer.externalId, 200),
      sku: text(offer.sku || product.sku, 200),
      gtin: identityGtin(offer.gtin || offer.ean || product.ean || product.gtin),
      manufacturerCode: text(
        offer.manufacturerCode
        || offer.manufacturerProductNumber
        || product.manufacturerProductNumber
        || product.manufacturerCode,
        500,
      ),
      brand: text(offer.brand || product.brand, 200),
      categoryId: text(offer.categoryId || product.categoryId, 120),
      status: vonHalskyEffectiveOfferStatus(source),
      providerStatus,
      updatedAt: offer.updatedAt || null,
      validationErrors: asArray(source?.metadata?.validationErrors || source?.validationErrors).slice(0, 30),
      rejectionReasons: asArray(source?.metadata?.rejectionReasons || source?.rejectionReasons).slice(0, 30),
    };
    if (normalized.offerId) byOfferId.set(normalized.offerId, normalized);
    prefer(byExternalId, normalized.externalId, normalized);
    prefer(bySku, normalized.sku, normalized);
    prefer(byGtin, normalized.gtin, normalized);
    prefer(
      byManufacturerBrand,
      identityManufacturerBrand(normalized.manufacturerCode, normalized.brand),
      normalized,
    );
  }
  return { byExternalId, byOfferId, bySku, byGtin, byManufacturerBrand };
}

export function resolveVonHalskyRemoteOffer(identity = {}, index = {}) {
  const localOfferId = text(identity.offerId || identity.vonHalskyOfferId || identity.inpostVonHalskyOfferId, 200);
  const externalId = text(identity.externalId, 200);
  const sku = text(identity.sku, 200);
  const gtin = identityGtin(identity.gtin || identity.ean);
  const manufacturerBrand = identityManufacturerBrand(
    identity.manufacturerCode || identity.kodProducenta || identity.mpn,
    identity.brand || identity.marka || identity.producent,
  );
  const candidates = [
    ['offerId', localOfferId && index.byOfferId?.get(localOfferId)],
    ['externalId', externalId && index.byExternalId?.get(externalId)],
    ['sku', sku && index.bySku?.get(sku)],
    ['gtin', gtin && index.byGtin?.get(gtin)],
    ['manufacturerCode+brand', manufacturerBrand && index.byManufacturerBrand?.get(manufacturerBrand)],
  ].filter(([, offer]) => offer?.offerId);
  if (!candidates.length) return { offer: null, matchedBy: '', conflicts: [], candidates: [] };
  const grouped = new Map();
  for (const [matchedBy, offer] of candidates) {
    const row = grouped.get(offer.offerId) || { offer, matchedBy: [] };
    row.matchedBy.push(matchedBy);
    grouped.set(offer.offerId, row);
  }
  const identityMismatches = [];
  const distinct = [...grouped.values()].filter((row) => {
    const remoteGtin = identityGtin(row.offer.gtin);
    const remoteManufacturerBrand = identityManufacturerBrand(row.offer.manufacturerCode, row.offer.brand);
    // EXTERNAL_ID i SKU są identyfikatorami nadawanymi przez sprzedawcę i w
    // starym katalogu nie są globalnie unikalne. Nigdy nie mogą przeważyć nad
    // niezgodnym EAN-em (ani nad kodem producenta z marką, gdy EAN-u brak).
    const gtinMismatch = Boolean(gtin && remoteGtin && gtin !== remoteGtin);
    const manufacturerMismatch = Boolean(
      !gtin
      && !remoteGtin
      && manufacturerBrand
      && remoteManufacturerBrand
      && manufacturerBrand !== remoteManufacturerBrand,
    );
    if (!gtinMismatch && !manufacturerMismatch) return true;
    identityMismatches.push({
      matchedBy: row.matchedBy.join('+'),
      offerId: row.offer.offerId,
      status: row.offer.status,
      reason: gtinMismatch ? 'gtin_mismatch' : 'manufacturer_brand_mismatch',
      localGtin: gtin,
      remoteGtin,
    });
    return false;
  });
  if (!distinct.length) return {
    offer: null,
    matchedBy: '',
    conflicts: identityMismatches,
    candidates: [],
  };
  const identityPriority = (row) => {
    if (row.matchedBy.includes('gtin')) return 500;
    if (row.matchedBy.includes('manufacturerCode+brand')) return 400;
    if (row.matchedBy.includes('offerId')) return 300;
    if (row.matchedBy.includes('externalId')) return 100;
    if (row.matchedBy.includes('sku')) return 90;
    return 0;
  };
  distinct.sort((left, right) => (
    identityPriority(right) - identityPriority(left)
    || offerStatusPriority(right.offer.status) - offerStatusPriority(left.offer.status)
  ));
  const bestIdentityPriority = identityPriority(distinct[0]);
  const bestStatusPriority = offerStatusPriority(distinct[0].offer.status);
  const best = distinct.filter((row) => (
    identityPriority(row) === bestIdentityPriority
    && offerStatusPriority(row.offer.status) === bestStatusPriority
  ));
  const conflicts = [
    ...identityMismatches,
    ...distinct.slice(1).map((row) => ({
      matchedBy: row.matchedBy.join('+'), offerId: row.offer.offerId, status: row.offer.status,
      reason: 'different_offer',
    })),
  ];
  if (best.length === 1) return {
    offer: distinct[0].offer,
    matchedBy: distinct[0].matchedBy.join('+'),
    conflicts,
    candidates: distinct,
  };
  return {
    offer: null,
    matchedBy: '',
    conflicts: distinct.map((row) => ({ matchedBy: row.matchedBy.join('+'), offerId: row.offer.offerId, status: row.offer.status })),
    candidates: distinct,
  };
}

export function vonHalskyCatalogTruthSummary(offers = []) {
  const statuses = {}, providerStatuses = {};
  for (const source of asArray(offers)) {
    const offer = source?.offer || source || {};
    const providerStatus = upper(offer.providerStatus || offer.status) || 'UNKNOWN';
    const status = vonHalskyEffectiveOfferStatus(source);
    statuses[status] = (statuses[status] || 0) + 1;
    providerStatuses[providerStatus] = (providerStatuses[providerStatus] || 0) + 1;
  }
  const rejected = (statuses.REJECTED || 0) + (statuses.ERROR || 0);
  const verificationErrors = statuses.VERIFICATION_ERROR || 0;
  return {
    total: asArray(offers).length,
    published: statuses.PUBLISHED || 0,
    pending: (statuses.PENDING || 0) + (statuses.PROCESSING || 0),
    verificationErrors,
    rejected,
    problems: rejected + verificationErrors,
    closed: (statuses.CLOSED || 0) + (statuses.SOLDOUT || 0) + (statuses.INACTIVE || 0),
    statuses,
    providerStatuses,
  };
}

function publicationForRemote(product = {}, offer = {}, timestamp = '') {
  const providerStatus = upper(offer.providerStatus || offer.status);
  const status = vonHalskyEffectiveOfferStatus(offer);
  const errors = vonHalskyOfferValidationMessages(offer);
  const error = errors.join(' • ');
  const publicationStatus = status === 'PUBLISHED'
    ? 'confirmed'
    : ['REJECTED', 'ERROR', 'VERIFICATION_ERROR'].includes(status)
      ? 'decision_required'
      : ['CLOSED', 'SOLDOUT', 'INACTIVE'].includes(status)
        ? 'blocked'
        : 'publishing';
  return {
    ...buildEditorialPublicationPatch({
      product,
      channel: 'vonHalsky',
      status: publicationStatus,
      timestamp,
      targetRef: offer.offerId,
      receiptId: offer.offerId,
      error,
      stateOverride: status.toLowerCase(),
    }),
    vonHalskyOfferId: offer.offerId,
    vonHalskyRemoteStatus: status,
    vonHalskyProviderStatus: providerStatus,
    vonHalskyRemoteErrors: errors,
    vonHalskyRemotePresent: true,
    vonHalskyRemoteVerifiedAt: timestamp,
  };
}

function lastPublicationAttemptAt(product = {}) {
  return Date.parse(text(
    product.contentEditorial?.channelStates?.vonHalsky?.publicationAttemptedAt
    || product.vonHalskyEditorialSyncPendingAt,
    100,
  ));
}

function productRemoteCandidate(product = {}, index = {}) {
  const externalId = text(product.vonHalskyExternalId || product.externalId || product.sku || product.id, 200);
  const localOfferId = text(product.vonHalskyOfferId || product.inpostVonHalskyOfferId, 200);
  const resolution = resolveVonHalskyRemoteOffer({
    offerId: localOfferId,
    externalId,
    sku: product.vonHalskyExternalId || product.sku || product.externalId,
    gtin: product.gtin || product.ean,
    manufacturerCode: product.kodProducenta || product.mpn || product.numerReferencyjny,
    brand: product.marka || product.producent,
  }, index);
  const remote = resolution.offer;
  if (!remote) return {
    remote: null,
    externalId,
    localOfferId,
    score: 0,
    matchedBy: '',
    conflicts: resolution.conflicts,
  };
  const localIdExact = Boolean(localOfferId && localOfferId === remote.offerId);
  const externalExact = Boolean(externalId && externalId === remote.externalId);
  const score = (externalExact ? 1_000 : 0)
    + (localIdExact ? 500 : 0)
    + (resolution.matchedBy.includes('gtin') ? 250 : 0)
    + (resolution.matchedBy.includes('manufacturerCode+brand') ? 150 : 0)
    + (product.vonHalskyRemotePresent === true ? 30 : 0)
    + (product.sprzedazAktywna !== false ? 20 : 0)
    + (text(product.ean || product.gtin, 30) ? 10 : 0)
    + (text(product.nazwa || product.name, 200) ? 5 : 0);
  return { remote, externalId, localOfferId, score, matchedBy: resolution.matchedBy, conflicts: resolution.conflicts };
}

function chooseRemoteProductAssignments(products = [], index = {}) {
  const candidates = new Map(), groups = new Map(), identityConflicts = new Map();
  for (const product of asArray(products)) {
    const productId = text(product?.id, 160);
    if (!productId) continue;
    const candidate = productRemoteCandidate(product, index);
    if (!candidate?.remote && candidate?.conflicts?.length) identityConflicts.set(productId, candidate.conflicts);
    if (!candidate?.remote?.offerId) continue;
    candidates.set(productId, candidate);
    const list = groups.get(candidate.remote.offerId) || [];
    list.push({ productId, ...candidate });
    groups.set(candidate.remote.offerId, list);
  }
  const winners = new Map();
  for (const [offerId, rows] of groups) {
    rows.sort((left, right) => right.score - left.score || left.productId.localeCompare(right.productId, 'pl'));
    winners.set(offerId, rows[0].productId);
  }
  return { candidates, winners, identityConflicts };
}

export async function reconcileVonHalskyCatalog({
  remoteOffers = [],
  products = [],
  saveProductFields,
  timestamp = new Date().toISOString(),
  pendingGraceMs = 10 * 60_000,
} = {}) {
  if (typeof saveProductFields !== 'function') throw new TypeError('Uzgodnienie Von Halsky wymaga centralnego zapisu produktu.');
  const index = preferredVonHalskyOffers(remoteOffers);
  const updates = [], counts = {
    linked: 0,
    published: 0,
    pending: 0,
    rejected: 0,
    verificationErrors: 0,
    closed: 0,
    staleCleared: 0,
    awaiting: 0,
    duplicateMappings: 0,
    identityConflicts: 0,
    unchanged: 0,
  };
  const currentMs = Date.parse(timestamp) || Date.now();
  const cycleId = text(timestamp, 40).replace(/[^0-9A-Za-z_-]/g, '') || String(currentMs);
  const assignments = chooseRemoteProductAssignments(products, index);
  for (const product of asArray(products)) {
    const productId = text(product?.id, 160);
    if (!productId) continue;
    const externalId = text(product.externalId || product.sku || product.id, 200);
    const localOfferId = text(product.vonHalskyOfferId || product.inpostVonHalskyOfferId, 200);
    const candidate = assignments.candidates.get(productId);
    const remote = candidate?.remote || null;
    const identityConflicts = assignments.identityConflicts.get(productId) || [];
    if (identityConflicts.length) {
      const conflictingOfferId = text(identityConflicts[0]?.offerId, 200);
      const error = `Konflikt tożsamości: identyfikator ${externalId || 'bez numeru'} wskazuje ofertę ${conflictingOfferId || 'API'}, ale EAN lub producent nie zgadza się z tą kartoteką. Nie wykonano aktualizacji.`;
      const fields = {
        ...buildEditorialPublicationPatch({
          product,
          channel: 'vonHalsky',
          status: 'decision_required',
          timestamp,
          targetRef: externalId,
          error,
          stateOverride: 'identity_conflict',
        }),
        vonHalskyRemoteStatus: 'IDENTITY_CONFLICT',
        vonHalskyRemotePresent: false,
        vonHalskyRemoteVerifiedAt: timestamp,
      };
      const remove = localOfferId
        ? ['vonHalskyOfferId', 'inpostVonHalskyOfferId', 'vonHalskyCommandId']
        : [];
      counts.identityConflicts += 1;
      if (!patchChangesProduct(product, fields, remove)) {
        counts.unchanged += 1;
        continue;
      }
      const saved = await saveProductFields({
        productId,
        fields,
        remove,
        mutationId: `von-halsky-reconcile-identity-conflict:${productId}:${conflictingOfferId || 'unknown'}:${cycleId}`,
        actor: 'von-halsky-api',
        area: 'von-halsky-reconciliation',
      });
      updates.push({
        productId,
        fields,
        remove,
        product: saved?.product,
        readbackConfirmed: saved?.publication?.readbackConfirmed === true,
        confirmedAt: timestamp,
      });
      continue;
    }
    if (remote && assignments.winners.get(remote.offerId) !== productId) {
      const fields = {
        ...buildEditorialPublicationPatch({
          product,
          channel: 'vonHalsky',
          status: 'decision_required',
          timestamp,
          targetRef: externalId,
          error: 'Ta sama oferta API była przypięta do więcej niż jednej kartoteki. Zachowano jedno najpewniejsze powiązanie.',
          stateOverride: 'duplicate_mapping',
        }),
        vonHalskyRemoteStatus: 'DUPLICATE_MAPPING',
        vonHalskyRemotePresent: false,
        vonHalskyRemoteVerifiedAt: timestamp,
      };
      const remove = localOfferId === remote.offerId
        ? ['vonHalskyOfferId', 'inpostVonHalskyOfferId', 'vonHalskyCommandId']
        : [];
      counts.duplicateMappings += 1;
      if (!patchChangesProduct(product, fields, remove)) {
        counts.unchanged += 1;
        continue;
      }
      const saved = await saveProductFields({
        productId,
        fields,
        remove,
        mutationId: `von-halsky-reconcile-duplicate:${productId}:${remote.offerId}:${cycleId}`,
        actor: 'von-halsky-api',
        area: 'von-halsky-reconciliation',
      });
      updates.push({
        productId,
        fields,
        remove,
        product: saved?.product,
        readbackConfirmed: saved?.publication?.readbackConfirmed === true,
        confirmedAt: timestamp,
      });
      continue;
    }
    if (remote) {
      const fields = publicationForRemote(product, remote, timestamp);
      const remoteStatus = vonHalskyEffectiveOfferStatus(remote);
      counts.linked += 1;
      if (remoteStatus === 'PUBLISHED') counts.published += 1;
      else if (['PENDING', 'PROCESSING'].includes(remoteStatus)) counts.pending += 1;
      else if (remoteStatus === 'VERIFICATION_ERROR') counts.verificationErrors += 1;
      else if (['REJECTED', 'ERROR'].includes(remoteStatus)) counts.rejected += 1;
      else if (['CLOSED', 'SOLDOUT', 'INACTIVE'].includes(remoteStatus)) counts.closed += 1;
      if (!patchChangesProduct(product, fields)) {
        counts.unchanged += 1;
        continue;
      }
      const saved = await saveProductFields({
        productId,
        fields,
        mutationId: `von-halsky-reconcile:${productId}:${remote.offerId}:${remoteStatus}:${cycleId}`,
        actor: 'von-halsky-api',
        area: 'von-halsky-reconciliation',
      });
      updates.push({
        productId,
        fields,
        remove: [],
        product: saved?.product,
        readbackConfirmed: saved?.publication?.readbackConfirmed === true,
        confirmedAt: timestamp,
      });
      continue;
    }
    const localPublicationState = text(product.vonHalskyEditorialSyncState, 80).toLowerCase();
    const localCommandId = text(product.vonHalskyCommandId, 200);
    const hasProviderReceipt = Boolean(localOfferId || localCommandId);
    const hasLocalOperation = Boolean(hasProviderReceipt || product.vonHalskyEditorialSyncPending === true);
    if (!hasLocalOperation) {
      counts.unchanged += 1;
      continue;
    }
    const attemptedAt = lastPublicationAttemptAt(product);
    const stillInGrace = hasProviderReceipt
      && ['queued', 'publishing'].includes(localPublicationState)
      && Number.isFinite(attemptedAt)
      && currentMs - attemptedAt >= 0
      && currentMs - attemptedAt < pendingGraceMs;
    if (stillInGrace) {
      const fields = {
        ...buildEditorialPublicationPatch({
          product,
          channel: 'vonHalsky',
          status: 'publishing',
          timestamp,
          targetRef: localOfferId || externalId,
          receiptId: localCommandId,
        }),
        vonHalskyRemoteStatus: 'VERIFYING',
        vonHalskyRemotePresent: false,
        vonHalskyRemoteVerifiedAt: timestamp,
      };
      counts.awaiting += 1;
      if (!patchChangesProduct(product, fields)) {
        counts.unchanged += 1;
        continue;
      }
      const saved = await saveProductFields({
        productId,
        fields,
        mutationId: `von-halsky-reconcile-awaiting:${productId}:${localOfferId || 'command'}:${cycleId}`,
        actor: 'von-halsky-api',
        area: 'von-halsky-reconciliation',
      });
      updates.push({ productId, fields, remove: [], product: saved?.product, confirmedAt: timestamp });
      continue;
    }
    const fields = {
      ...buildEditorialPublicationPatch({
        product,
        channel: 'vonHalsky',
        status: 'decision_required',
        timestamp,
        targetRef: externalId,
        error: 'Oferta nie istnieje w aktualnym katalogu API Von Halsky.',
        stateOverride: 'not_found',
      }),
      vonHalskyRemoteStatus: 'NOT_FOUND',
      vonHalskyRemotePresent: false,
      vonHalskyRemoteVerifiedAt: timestamp,
    };
    const remove = ['vonHalskyOfferId', 'inpostVonHalskyOfferId', 'vonHalskyCommandId'];
    counts.staleCleared += 1;
    if (!patchChangesProduct(product, fields, remove)) {
      counts.unchanged += 1;
      continue;
    }
    const saved = await saveProductFields({
      productId,
      fields,
      remove,
      mutationId: `von-halsky-reconcile-missing:${productId}:${localOfferId || 'command'}:${cycleId}`,
      actor: 'von-halsky-api',
      area: 'von-halsky-reconciliation',
    });
    updates.push({
      productId,
      fields,
      remove,
      product: saved?.product,
      readbackConfirmed: saved?.publication?.readbackConfirmed === true,
      confirmedAt: timestamp,
    });
  }
  return {
    offers: asArray(remoteOffers),
    truth: vonHalskyCatalogTruthSummary(remoteOffers),
    counts,
    productUpdates: updates,
  };
}
