import { buildEditorialPublicationPatch } from './agent-product-editorial-state.mjs';

const text = (value, max = 500) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const upper = (value) => text(value, 60).toUpperCase();
const asArray = (value) => Array.isArray(value) ? value : [];

function offerStatusPriority(status = '') {
  return ({
    PUBLISHED: 60,
    PENDING: 50,
    PROCESSING: 40,
    CLOSED: 30,
    SOLDOUT: 25,
    INACTIVE: 20,
    REJECTED: 10,
    ERROR: 5,
  })[upper(status)] || 0;
}

export function preferredVonHalskyOffers(offers = []) {
  const byExternalId = new Map(), byOfferId = new Map();
  for (const source of asArray(offers)) {
    const offer = source?.offer || source || {};
    const normalized = {
      offerId: text(offer.id || offer.offerId, 200),
      externalId: text(offer.externalId, 200),
      status: upper(offer.status),
      updatedAt: offer.updatedAt || null,
      validationErrors: asArray(source?.metadata?.validationErrors || source?.validationErrors).slice(0, 30),
      rejectionReasons: asArray(source?.metadata?.rejectionReasons || source?.rejectionReasons).slice(0, 30),
    };
    if (normalized.offerId) byOfferId.set(normalized.offerId, normalized);
    if (!normalized.externalId) continue;
    const previous = byExternalId.get(normalized.externalId);
    if (!previous || offerStatusPriority(normalized.status) > offerStatusPriority(previous.status)) {
      byExternalId.set(normalized.externalId, normalized);
    }
  }
  return { byExternalId, byOfferId };
}

export function vonHalskyCatalogTruthSummary(offers = []) {
  const statuses = {};
  for (const source of asArray(offers)) {
    const offer = source?.offer || source || {};
    const status = upper(offer.status) || 'UNKNOWN';
    statuses[status] = (statuses[status] || 0) + 1;
  }
  return {
    total: asArray(offers).length,
    published: statuses.PUBLISHED || 0,
    pending: (statuses.PENDING || 0) + (statuses.PROCESSING || 0),
    rejected: (statuses.REJECTED || 0) + (statuses.ERROR || 0),
    closed: (statuses.CLOSED || 0) + (statuses.SOLDOUT || 0) + (statuses.INACTIVE || 0),
    statuses,
  };
}

function publicationForRemote(product = {}, offer = {}, timestamp = '') {
  const status = upper(offer.status);
  const error = [
    ...asArray(offer.validationErrors),
    ...asArray(offer.rejectionReasons),
  ].map((row) => text(row?.validationMessage || row?.message || row?.code, 300)).filter(Boolean).join(' • ');
  const publicationStatus = status === 'PUBLISHED'
    ? 'confirmed'
    : ['REJECTED', 'ERROR'].includes(status)
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
    vonHalskyRemotePresent: true,
    vonHalskyRemoteVerifiedAt: timestamp,
  };
}

function lastPublicationAttemptAt(product = {}) {
  return Date.parse(text(
    product.vonHalskyEditorialSyncPendingAt
    || product.contentEditorial?.channelStates?.vonHalsky?.publicationAttemptedAt,
    100,
  ));
}

function productRemoteCandidate(product = {}, index = {}) {
  const externalId = text(product.externalId || product.sku || product.id, 200);
  const localOfferId = text(product.vonHalskyOfferId || product.inpostVonHalskyOfferId, 200);
  const byExternal = externalId ? index.byExternalId.get(externalId) : null;
  const byLocalId = localOfferId ? index.byOfferId.get(localOfferId) : null;
  const remote = byExternal || byLocalId || null;
  if (!remote) return null;
  const localIdExact = Boolean(localOfferId && localOfferId === remote.offerId);
  const externalExact = Boolean(externalId && externalId === remote.externalId);
  const score = (externalExact ? 1_000 : 0)
    + (localIdExact ? 500 : 0)
    + (product.vonHalskyRemotePresent === true ? 30 : 0)
    + (product.sprzedazAktywna !== false ? 20 : 0)
    + (text(product.ean || product.gtin, 30) ? 10 : 0)
    + (text(product.nazwa || product.name, 200) ? 5 : 0);
  return { remote, externalId, localOfferId, score };
}

function chooseRemoteProductAssignments(products = [], index = {}) {
  const candidates = new Map(), groups = new Map();
  for (const product of asArray(products)) {
    const productId = text(product?.id, 160);
    if (!productId) continue;
    const candidate = productRemoteCandidate(product, index);
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
  return { candidates, winners };
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
    closed: 0,
    staleCleared: 0,
    awaiting: 0,
    duplicateMappings: 0,
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
      const saved = await saveProductFields({
        productId,
        fields,
        remove,
        mutationId: `von-halsky-reconcile-duplicate:${productId}:${remote.offerId}:${cycleId}`,
        actor: 'von-halsky-api',
        area: 'von-halsky-reconciliation',
      });
      counts.duplicateMappings += 1;
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
      const saved = await saveProductFields({
        productId,
        fields,
        mutationId: `von-halsky-reconcile:${productId}:${remote.offerId}:${remote.status}:${cycleId}`,
        actor: 'von-halsky-api',
        area: 'von-halsky-reconciliation',
      });
      counts.linked += 1;
      if (remote.status === 'PUBLISHED') counts.published += 1;
      else if (['PENDING', 'PROCESSING'].includes(remote.status)) counts.pending += 1;
      else if (['REJECTED', 'ERROR'].includes(remote.status)) counts.rejected += 1;
      else if (['CLOSED', 'SOLDOUT', 'INACTIVE'].includes(remote.status)) counts.closed += 1;
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
      const saved = await saveProductFields({
        productId,
        fields,
        mutationId: `von-halsky-reconcile-awaiting:${productId}:${localOfferId || 'command'}:${cycleId}`,
        actor: 'von-halsky-api',
        area: 'von-halsky-reconciliation',
      });
      counts.awaiting += 1;
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
    const saved = await saveProductFields({
      productId,
      fields,
      remove,
      mutationId: `von-halsky-reconcile-missing:${productId}:${localOfferId || 'command'}:${cycleId}`,
      actor: 'von-halsky-api',
      area: 'von-halsky-reconciliation',
    });
    counts.staleCleared += 1;
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
