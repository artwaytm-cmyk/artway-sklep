const allowedScopes = new Set(['all', 'summary', 'orders', 'offers', 'config']);
const list = (value) => Array.isArray(value) ? value : [];
const amount = (value) => { const parsed = Number(String(value ?? 0).replace(',', '.').replace(/[^0-9.-]/g, '')); return Number.isFinite(parsed) ? parsed : 0; };
const mappingProductId = (entry = {}) => String(entry?.productId ?? entry?.product_id ?? '').trim();
const mappingOfferId = (key = '', entry = {}) => String(entry?.offerId ?? entry?.offer_id ?? key ?? '').trim();
const mappingBlocked = (entry = {}) => entry?.blocked === true || String(entry?.blocked ?? '').toLowerCase() === 'true';
const offerId = (offer = {}) => String(offer?.id ?? offer?.offerId ?? offer?.offer_id ?? '').trim();
const offerStatus = (offer = {}) => String(offer?.status ?? offer?.publication?.status ?? '').trim().toUpperCase() || 'UNKNOWN';
const orderTimestamp = (order = {}) => { const raw = order.createdAt ?? order.firstFetchedAt ?? order.ts ?? order.checkoutForm?.createdAt ?? ''; const numeric = Number(raw); return Number.isFinite(numeric) && numeric > 1e9 ? (numeric < 1e11 ? numeric * 1000 : numeric) : (Date.parse(raw) || 0); };
const orderAmount = (order = {}) => amount(order.total?.amount ?? order.total ?? order.summary?.totalToPay?.amount ?? order.payment?.paidAmount?.amount ?? 0);
function dailySales(orders = [], orderStatus = () => '', days = 45) {
  const from = Date.now() - Math.max(1, Number(days) || 45) * 86400000, rows = {};
  for (const order of orders) {
    const timestamp = orderTimestamp(order), status = String(orderStatus(order) || '').toUpperCase();
    if (!timestamp || timestamp < from || ['CANCELLED', 'RETURNED'].includes(status)) continue;
    const key = new Date(timestamp).toISOString().slice(0, 10), row = rows[key] || { value: 0, count: 0 };
    row.value = Math.round((row.value + orderAmount(order)) * 100) / 100; row.count += 1; rows[key] = row;
  }
  return rows;
}

export function createAllegroDataReader({
  read, archive, getOfferSettings, getStatus, mappingItems, orderStatus,
  orderNeedsRefresh, nextScheduledSyncAt, compliancePolicy,
} = {}) {
  return async function readAllegroData(requestedScope = 'all', request = null) {
    const requested = String(requestedScope || 'all').trim().toLowerCase();
    const scope = allowedScopes.has(requested) ? requested : 'summary';
    const needsOrders = ['all', 'summary', 'orders'].includes(scope);
    const needsOffers = ['all', 'summary', 'offers'].includes(scope);
    const needsMappings = ['all', 'summary', 'orders', 'offers'].includes(scope);
    const needsOfferDetails = ['all', 'offers', 'config'].includes(scope);
    const [orders, offers, mappings, archiveSummary, offerSettings, status, autonomousAgent, offerLastError, offerDefaultsAudit, catalogMaintenance, offerSyncState, complianceAudit] = await Promise.all([
      needsOrders ? read('allegro_orders', { items: [], updated_at: null }) : { items: [], updated_at: null },
      needsOffers ? read('allegro_offers', { items: [], updated_at: null }) : { items: [], updated_at: null },
      needsMappings ? read('allegro_mappings', { items: {}, updated_at: null }) : { items: {}, updated_at: null },
      needsOrders ? archive.summary() : { total: 0, months: [], retentionDays: 30, updated_at: null },
      getOfferSettings(), getStatus(request), read('allegro_autonomous_agent_state', { enabled: true, status: 'waiting', completedAt: null, nextRunAt: null, mapping: {}, stats: {}, duplicateGroupsResolved: 0, duplicateOffersEnded: 0, reviewCount: 0 }),
      needsOfferDetails ? read('allegro_offer_last_error', null) : null,
      needsOfferDetails ? read('allegro_offer_defaults_audit', { items: {}, updated_at: null }) : null,
      needsOfferDetails ? read('allegro_catalog_maintenance', { cursor: 0, lastRun: null }) : null,
      needsOfferDetails ? read('allegro_offer_sync_state', { lastLightSyncAt: null, lastFullSyncAt: null, lastSource: null, lastResult: null }) : null,
      needsOfferDetails ? read('allegro_compliance_audit', { items: [], summary: {}, updated_at: null, policy: compliancePolicy }) : null,
    ]);
    const orderList = list(orders.items), offerList = list(offers.items), mappingsList = mappingItems(mappings);
    const statusCounts = orderList.reduce((out, order) => { const key = orderStatus(order); out[key] = (out[key] || 0) + 1; return out; }, {});
    const offerIds = new Set(offerList.map(offerId).filter(Boolean));
    const mappedOfferIds = new Set(), mappedProductIds = new Set();
    for (const [key, entry] of Object.entries(mappingsList && typeof mappingsList === 'object' ? mappingsList : {})) {
      const currentOfferId = mappingOfferId(key, entry), productId = mappingProductId(entry);
      if (!currentOfferId || !productId || mappingBlocked(entry) || !offerIds.has(currentOfferId)) continue;
      mappedOfferIds.add(currentOfferId); mappedProductIds.add(productId);
    }
    const offerStatusCounts = offerList.reduce((out, offer) => { const key = offerStatus(offer); out[key] = (out[key] || 0) + 1; return out; }, {});
    const payload = {
      ok: true, scope,
      allegro: { ...status, autonomousAgent, updated_at: orders.updated_at || offers.updated_at || status.updated_at || null },
      summary: {
        ...(needsOrders ? { orders: { live: orderList.length, active: orderList.filter(orderNeedsRefresh).length, statusCounts, archived: Number(archiveSummary.total) || 0, retentionDays: 30, updated_at: orders.updated_at || null } } : {}),
        ...(needsOffers ? { offers: {
          count: offerList.length,
          mapped: mappedOfferIds.size,
          mappedProducts: mappedProductIds.size,
          unmapped: Math.max(0, offerList.length - mappedOfferIds.size),
          active: Number(offerStatusCounts.ACTIVE) || 0,
          inactive: Number(offerStatusCounts.INACTIVE) || 0,
          ended: (Number(offerStatusCounts.ENDED) || 0) + (Number(offerStatusCounts.ARCHIVED) || 0),
          statusCounts: offerStatusCounts,
          updated_at: offers.updated_at || null,
        } } : {}),
        ...(needsOrders ? { recentOrders: orderList.slice(0, 10), salesDaily: dailySales(orderList, orderStatus, 45) } : {}),
      },
      archive: archiveSummary, offerSettings,
    };
    if (['all', 'orders'].includes(scope)) payload.orders = orderList;
    if (['all', 'offers'].includes(scope)) payload.offers = offerList;
    if (['all', 'orders', 'offers'].includes(scope)) payload.mappings = mappingsList;
    if (needsOfferDetails) {
      payload.offerLastError = offerLastError;
      payload.offerDefaultsAudit = offerDefaultsAudit;
      payload.offerSyncState = { ...offerSyncState, nextLightSyncAt: nextScheduledSyncAt(offerSyncState, offerSettings, 'light'), nextFullSyncAt: nextScheduledSyncAt(offerSyncState, offerSettings, 'full') };
      payload.catalogMaintenance = catalogMaintenance;
      payload.complianceAudit = complianceAudit;
    }
    return payload;
  };
}
