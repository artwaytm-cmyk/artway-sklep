/**
 * Przyrostowe uzgodnienie ofert Allegro. Zewnętrzny kanał jest czytany przez
 * dziennik zmian, a pełny katalog pozostaje wyłącznie okresowym bezpiecznikiem.
 */
export function createAllegroOfferEventSync({
  text, call, read, write, offerItems, fetchDetails, normalizeOffer,
  mergeOfferDetails, autoMapOffers,
} = {}) {
  const eventOfferId = (event = {}) => text(event?.offer?.id || event?.offerId, 100);
  const eventStatus = (event = {}, fallback = '') => {
    const explicit = text(event?.offer?.publication?.status || event?.offer?.status || event?.status, 80).toUpperCase();
    if (explicit) return explicit;
    const type = text(event?.type, 100).toUpperCase();
    if (/ENDED|DELETED|REMOVED/.test(type)) return 'ENDED';
    if (/ARCHIVED/.test(type)) return 'ARCHIVED';
    if (/ACTIVATED|PUBLISHED|RESUMED/.test(type)) return 'ACTIVE';
    return fallback;
  };

  return async function syncAllegroOfferEvents(request, options = {}) {
    const eventLimit = Math.min(1000, Math.max(1, Number(options.limit) || 1000));
    const [previousOffersRecord, previousState] = await Promise.all([
      read('allegro_offers', { items: [], updated_at: null }),
      read('allegro_offer_sync_state', { lastOfferEventId: null, lastOfferEventAt: null, lastLightSyncAt: null, lastFullSyncAt: null }),
    ]);
    const parameters = { limit: eventLimit };
    if (previousState.lastOfferEventId) parameters.from = previousState.lastOfferEventId;
    const journal = await call(request, '/sale/offer-events', { parameters });
    const events = (Array.isArray(journal?.offerEvents) ? journal.offerEvents : (Array.isArray(journal?.events) ? journal.events : []))
      .filter((event) => event && (event.id || eventOfferId(event)));
    const changedIds = [...new Set(events.map(eventOfferId).filter(Boolean))];
    const previousItems = offerItems(previousOffersRecord);
    const byId = new Map(previousItems.map((offer) => [String(offer?.id || ''), offer]));
    const latestEventByOffer = new Map();
    for (const event of events) {
      const offerId = eventOfferId(event);
      if (offerId) latestEventByOffer.set(offerId, event);
    }
    const details = changedIds.length
      ? await fetchDetails(request, changedIds.map((id) => ({ id })), changedIds.length)
      : [];
    const changed = [];
    for (const remote of details) {
      const id = text(remote?.id, 100); if (!id) continue;
      const previous = byId.get(id) || {}, event = latestEventByOffer.get(id) || {};
      let next;
      if (remote?.detailError) {
        const status = eventStatus(event, text(previous?.status || previous?.publication?.status, 80).toUpperCase());
        next = {
          ...previous, id,
          ...(status ? { status, publication: { ...(previous.publication || {}), status } } : {}),
          lastEventId: text(event.id, 120), lastEventAt: event.occurredAt || new Date().toISOString(),
          detailError: text(remote.detailError, 500),
        };
      } else {
        next = mergeOfferDetails(previous, normalizeOffer(remote), true);
        next = { ...next, lastEventId: text(event.id, 120), lastEventAt: event.occurredAt || new Date().toISOString() };
      }
      byId.set(id, next); changed.push(next);
    }
    const completedAt = new Date().toISOString();
    let mapping = { autoMapped: 0, refreshed: 0, quarantined: 0, skipped: true };
    if (changed.length) {
      const existingOrder = previousItems.map((offer) => String(offer?.id || ''));
      const existingIds = new Set(existingOrder), appended = [...byId.keys()].filter((id) => !existingIds.has(id));
      const items = [...existingOrder, ...appended].map((id) => byId.get(id)).filter(Boolean);
      await write('allegro_offers', { ...previousOffersRecord, items, updated_at: completedAt, count: items.length, syncMode: 'events', changedCount: changed.length });
      mapping = await autoMapOffers(items);
    }
    const lastEvent = events.at(-1), state = {
      ...previousState, lastLightSyncAt: completedAt, lastSource: text(options.source || 'offer-events', 100),
      ...(lastEvent?.id ? { lastOfferEventId: text(lastEvent.id, 120), lastOfferEventAt: lastEvent.occurredAt || completedAt } : {}),
      lastResult: { events: events.length, changedOffers: changed.length, autoMapped: mapping.autoMapped || 0, refreshed: mapping.refreshed || 0, quarantined: mapping.quarantined || 0 },
    };
    await write('allegro_offer_sync_state', state);
    const added = changed.filter((offer) => !previousItems.some((current) => String(current?.id) === String(offer?.id))).length;
    return { ok: true, mode: 'events', events: events.length, changed: changed.length, count: previousItems.length + added, cursor: state.lastOfferEventId || null, mapping, offerSyncState: state };
  };
}
