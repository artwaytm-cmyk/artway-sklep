const allowedScopes = new Set(['all', 'summary', 'orders', 'offers', 'config']);
const list = (value) => Array.isArray(value) ? value : [];

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
    const payload = {
      ok: true, scope,
      allegro: { ...status, autonomousAgent, updated_at: orders.updated_at || offers.updated_at || status.updated_at || null },
      summary: {
        orders: { live: orderList.length, active: orderList.filter(orderNeedsRefresh).length, statusCounts, archived: Number(archiveSummary.total) || 0, retentionDays: 30, updated_at: orders.updated_at || null },
        offers: { count: offerList.length, mapped: Object.values(mappingsList).filter((entry) => entry?.productId && entry?.blocked !== true).length, updated_at: offers.updated_at || null },
        recentOrders: orderList.slice(0, 10),
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
