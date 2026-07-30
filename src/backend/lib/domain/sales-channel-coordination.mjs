export function createIndependentVonHalskyQueue(signalVonHalskyPreparation) {
  return async (task = {}) => {
    const queued = await signalVonHalskyPreparation(task.productId, {
      source: 'allegro-preparation-confirmed',
    });
    return {
      channel: 'vonHalsky',
      status: queued?.duplicate === true ? 'already_queued' : 'queued',
      ready: false,
      eventId: queued?.event?.id || '',
    };
  };
}

export function buildAllegroOfferSyncResponse({
  allegro, items, mappingResult, maintenance, compliance, offerSyncState,
  nextLightSyncAt, nextFullSyncAt, reconciliation, compact = false,
}) {
  const response = {
    ok: true,
    allegro,
    autoMapped: mappingResult.autoMapped,
    mappingsRefreshed: mappingResult.refreshed,
    mappingsQuarantined: mappingResult.quarantined,
    descriptionsUpdated: mappingResult.descriptionsUpdated,
    producersUpdated: mappingResult.producersUpdated,
    productsUpdated: mappingResult.productsUpdated,
    maintenance,
    compliance,
    offerSyncState: { ...offerSyncState, nextLightSyncAt, nextFullSyncAt },
    updated_at: reconciliation.updated_at,
    detailedCount: reconciliation.detailedCount,
    requestedLimit: reconciliation.requestedLimit,
    pages: reconciliation.pages,
    totalCount: reconciliation.totalCount,
  };
  if (compact) response.count = items.length;
  else {
    response.offers = items;
    response.mappings = mappingResult.mappings;
  }
  return response;
}
