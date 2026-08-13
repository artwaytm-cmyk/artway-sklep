/** Pełne uzgodnienie kontrolne ofert. Uruchamiane rzadko, niezależnie od dziennika zmian. */
export function createAllegroOfferFullSync({
  text, read, write, settings, scheduledDue, nextScheduledAt, offerItems, call,
  fetchDetails, normalizeOffer, mergeOfferDetails, autoMapOffers, maintenance,
  complianceAudit, status, buildResponse,
} = {}) {
  return async function syncAllegroOffers(request, body = {}, searchParams = new URLSearchParams()) {
    const limit = Math.min(20000, Math.max(1, Number(body.limit || searchParams.get('limit') || 10000)));
    const details = body.details !== false && searchParams.get('details') !== '0';
    const detailsLimit = details ? Math.min(limit, 1000, Math.max(1, Number(body.detailsLimit || 500))) : 0;
    const [previousRecord, offerSettings, previousState] = await Promise.all([
      read('allegro_offers', { items: [] }), settings(),
      read('allegro_offer_sync_state', { lastLightSyncAt: null, lastFullSyncAt: null, lastSource: null, lastResult: null }),
    ]);
    const sourceName = text(body.source || 'manual', 100), scheduledLight = sourceName === 'scheduled-catalog-refresh', scheduledFull = sourceName === 'scheduled-offers-sync';
    const syncKind = scheduledFull || details ? 'full' : 'light';
    if ((scheduledLight || scheduledFull) && !scheduledDue(previousState, offerSettings, syncKind)) return {
      ok: true, skipped: true, reason: 'not_due', source: sourceName, count: offerItems(previousRecord).length,
      offerSyncState: { ...previousState, nextLightSyncAt: nextScheduledAt(previousState, offerSettings, 'light'), nextFullSyncAt: nextScheduledAt(previousState, offerSettings, 'full') },
    };
    const previousById = new Map(offerItems(previousRecord).map((offer) => [String(offer?.id || ''), offer]));
    const source = []; let pages = 0, totalCount = null;
    for (let offset = 0; offset < limit; offset += 1000) {
      const pageLimit = Math.min(1000, limit - offset), data = await call(request, '/sale/offers', { parameters: { limit: pageLimit, offset } });
      const page = Array.isArray(data.offers) ? data.offers : (Array.isArray(data.items) ? data.items : []);
      if (Number.isFinite(Number(data.totalCount))) totalCount = Number(data.totalCount);
      source.push(...page); pages++;
      if (page.length < pageLimit || (totalCount !== null && source.length >= totalCount)) break;
    }
    const full = details ? await fetchDetails(request, source, detailsLimit) : [];
    const fullById = new Map(full.filter((offer) => offer?.id).map((offer) => [String(offer.id), offer]));
    const items = source.map((summary) => {
      const id = String(summary?.id || ''), detailed = fullById.get(id);
      return mergeOfferDetails(previousById.get(id), normalizeOffer(detailed || summary), !!detailed);
    }).filter((offer) => offer.id);
    const record = { items, updated_at: new Date().toISOString(), count: items.length, totalCount: totalCount ?? items.length, pages, details, detailedCount: full.length, requestedLimit: limit };
    await write('allegro_offers', record);
    const mapping = await autoMapOffers(items);
    const maintenanceResult = body.maintenance === true || body.source === 'scheduled-offers-sync' ? await maintenance(request, { limit: body.maintenanceLimit || 10 }) : null;
    const complianceResult = body.source === 'scheduled-offers-sync' ? await complianceAudit(request, { limit: Math.min(20, Math.max(1, Number(body.complianceLimit) || 10)), fix: true, activeOnly: true }) : null;
    const completedAt = new Date().toISOString(), state = {
      ...previousState, lastLightSyncAt: completedAt, ...(syncKind === 'full' ? { lastFullSyncAt: completedAt } : {}), lastSource: sourceName,
      lastResult: { offers: items.length, detailed: record.detailedCount, autoMapped: mapping.autoMapped, refreshed: mapping.refreshed, quarantined: mapping.quarantined },
    };
    await write('allegro_offer_sync_state', state);
    return buildResponse({ allegro: await status(request), items, mappingResult: mapping, maintenance: maintenanceResult, compliance: complianceResult, offerSyncState: state, nextLightSyncAt: nextScheduledAt(state, offerSettings, 'light'), nextFullSyncAt: nextScheduledAt(state, offerSettings, 'full'), reconciliation: record, compact: body.compact === true });
  };
}
