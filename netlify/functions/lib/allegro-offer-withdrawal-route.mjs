import crypto from 'node:crypto';

export function createAllegroOfferWithdrawalRoute({ callAllegro, createProductUpdater, getMappings, getOffers, getProducts, isAdmin, read, respond, text, write } = {}) {
  return async function allegroOfferWithdrawalRoute({ req, url, action } = {}) {
    if (!['allegro-withdraw-offers', 'allegro-resolve-duplicate'].includes(action)) return null;
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    const body = await req.json().catch(() => ({}));
    if (action === 'allegro-resolve-duplicate') {
      const productId = text(body.productId, 100).trim(), keepOfferId = text(body.keepOfferId, 100).trim();
      const withdrawOfferIds = [...new Set((Array.isArray(body.withdrawOfferIds) ? body.withdrawOfferIds : []).map((value) => text(value, 100).trim()).filter((value) => value && value !== keepOfferId))].slice(0, 50);
      if (!productId || !keepOfferId || !withdrawOfferIds.length) return respond({ ok: false, error: 'Wskaż produkt, jedną ofertę pozostawianą i co najmniej jedną ofertę do wycofania', code: 'validation' }, 422);
      const [offersRec, mappingsRec, settingsRec, auditRec] = await Promise.all([
        read('allegro_offers', { items: [], updated_at: null }), read('allegro_mappings', { items: {}, updated_at: null }), read('settings', { data: {}, rev: 0, updated_at: null }), read('allegro_duplicate_resolution_audit', { items: [], updated_at: null }),
      ]);
      const offers = getOffers(offersRec), byId = new Map(offers.map((offer) => [String(offer?.id || ''), offer]));
      if (!byId.has(keepOfferId)) return respond({ ok: false, error: 'Nie znaleziono oferty wybranej do pozostawienia', code: 'keep_not_found' }, 404);
      const missing = withdrawOfferIds.filter((id) => !byId.has(id));
      if (missing.length) return respond({ ok: false, error: `Nie znaleziono ofert: ${missing.join(', ')}`, code: 'withdraw_not_found' }, 404);
      const settled = await Promise.allSettled(withdrawOfferIds.map(async (offerId) => {
        const offer = byId.get(offerId) || {}, status = String(offer.status || offer.publication?.status || '').toUpperCase();
        if (status === 'ENDED') return { offerId, ended: true, alreadyEnded: true };
        await callAllegro(req, `/sale/product-offers/${encodeURIComponent(offerId)}`, { method: 'PATCH', bodyObj: { publication: { status: 'ENDED', republish: false } } });
        return { offerId, ended: true, alreadyEnded: false };
      }));
      const results = settled.map((result, index) => result.status === 'fulfilled' ? result.value : { offerId: withdrawOfferIds[index], ended: false, error: text(result.reason?.message || result.reason, 700), code: text(result.reason?.code || '', 120), status: result.reason?.status || 500 });
      const failed = results.filter((result) => !result.ended);
      if (failed.length) return respond({ ok: false, error: `Nie udało się wycofać ${failed.length} ofert. Powiązania nie zostały zmienione.`, code: 'partial_withdrawal', results }, 422);
      const now = new Date().toISOString(), mappings = getMappings(mappingsRec), keepOffer = byId.get(keepOfferId) || {};
      mappings[keepOfferId] = { ...(mappings[keepOfferId] || {}), offerId: keepOfferId, productId, allegroProductId: text(keepOffer.productId, 120), categoryId: text(keepOffer.categoryId, 80), productName: text(keepOffer.name, 300), linked_at: mappings[keepOfferId]?.linked_at || now, synced_at: now, operator: 'admin-duplicate-keep', duplicateResolvedAt: now };
      for (const offerId of withdrawOfferIds) mappings[offerId] = { ...(mappings[offerId] || {}), offerId, productId: '', blocked: true, duplicateOf: keepOfferId, operator: 'admin-duplicate-withdrawn', synced_at: now, duplicateResolvedAt: now };
      const data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {};
      const edits = data.artway_produkty_edytowane && typeof data.artway_produkty_edytowane === 'object' ? { ...data.artway_produkty_edytowane } : {};
      edits[productId] = { ...(edits[productId] || {}), allegroOfferId: keepOfferId, allegroProductId: text(keepOffer.productId || edits[productId]?.allegroProductId, 120), allegroCategoryId: text(keepOffer.categoryId || edits[productId]?.allegroCategoryId, 80), allegroDuplicateResolvedAt: now };
      data.artway_produkty_edytowane = edits;
      const updatedOffers = offers.map((offer) => withdrawOfferIds.includes(String(offer.id)) ? { ...offer, status: 'ENDED', publication: { ...(offer.publication || {}), status: 'ENDED', republish: false }, duplicateOf: keepOfferId, duplicateResolvedAt: now } : offer);
      const audit = Array.isArray(auditRec.items) ? [...auditRec.items] : [];
      audit.unshift({ id: crypto.randomUUID(), productId, keepOfferId, withdrawOfferIds, results, at: now, operator: 'administrator' });
      await Promise.all([
        write('allegro_mappings', { items: mappings, updated_at: now }), write('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: now }), write('allegro_offers', { ...offersRec, items: updatedOffers, updated_at: now }), write('allegro_duplicate_resolution_audit', { items: audit.slice(0, 2000), updated_at: now }),
      ]);
      return respond({ ok: true, productId, keepOfferId, withdrawOfferIds, results, mappings, offers: updatedOffers, updated_at: now });
    }
    const offerIds = [...new Set((Array.isArray(body.offerIds) ? body.offerIds : []).map((value) => text(value, 100).trim()).filter(Boolean))].slice(0, 50);
    const reason = text(body.reason || 'admin_decision', 80).trim();
    const allowedReasons = new Set(['admin_decision', 'duplicate', 'unavailable', 'catalog_cleanup', 'other']);
    if (!offerIds.length) return respond({ ok: false, error: 'Zaznacz co najmniej jedną ofertę do zakończenia', code: 'empty_selection' }, 422);
    if (!allowedReasons.has(reason)) return respond({ ok: false, error: 'Nieprawidłowy powód zakończenia oferty', code: 'invalid_reason' }, 422);

    const [offersRec, mappingsRec, settingsRec, auditRec] = await Promise.all([
      read('allegro_offers', { items: [], updated_at: null }),
      read('allegro_mappings', { items: {}, updated_at: null }),
      read('settings', { data: {}, rev: 0, updated_at: null }),
      read('allegro_offer_withdrawal_audit', { items: [], updated_at: null }),
    ]);
    const offers = getOffers(offersRec), byId = new Map(offers.map((offer) => [String(offer?.id || ''), offer]));
    const missing = offerIds.filter((id) => !byId.has(id));
    if (missing.length) return respond({ ok: false, error: `Nie znaleziono ofert: ${missing.join(', ')}`, code: 'offer_not_found' }, 404);

    const results = [];
    for (let offset = 0; offset < offerIds.length; offset += 10) {
      const batch = offerIds.slice(offset, offset + 10);
      const settled = await Promise.allSettled(batch.map(async (offerId) => {
        const offer = byId.get(offerId) || {}, status = String(offer.status || offer.publication?.status || '').toUpperCase();
        if (['ENDED', 'ARCHIVED'].includes(status)) return { offerId, ended: true, alreadyEnded: true };
        await callAllegro(req, `/sale/product-offers/${encodeURIComponent(offerId)}`, { method: 'PATCH', bodyObj: { publication: { status: 'ENDED', republish: false } } });
        return { offerId, ended: true, alreadyEnded: false };
      }));
      settled.forEach((result, index) => results.push(result.status === 'fulfilled' ? result.value : { offerId: batch[index], ended: false, error: text(result.reason?.message || result.reason, 700), code: text(result.reason?.code || '', 120), status: result.reason?.status || 500 }));
    }

    const endedIds = results.filter((result) => result.ended).map((result) => String(result.offerId)), failed = results.filter((result) => !result.ended);
    if (!endedIds.length) return respond({ ok: false, error: 'Nie udało się zakończyć żadnej oferty. Dane sklepu nie zostały zmienione.', code: 'withdrawal_failed', results }, 422);
    const now = new Date().toISOString(), mappings = getMappings(mappingsRec);
    const data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {};
    const products = await getProducts(data), updater = createProductUpdater(data, products.keys());
    for (const offerId of endedIds) {
      const current = mappings[offerId] || {}, previousProductId = String(current.productId || current.previousProductId || '').trim();
      mappings[offerId] = { ...current, offerId, previousProductId, productId: '', blocked: true, withdrawnAt: now, withdrawnReason: reason, operator: 'admin-offer-withdrawn', synced_at: now };
      if (previousProductId && products.has(previousProductId)) updater.apply(previousProductId, { allegroMappingStatus: 'oferta_wycofana', allegroOfferWithdrawnAt: now, allegroOfferWithdrawnReason: reason }, ['allegroOfferId']);
    }
    const settingsChanged = updater.commit();
    const updatedOffers = offers.map((offer) => endedIds.includes(String(offer.id)) ? { ...offer, status: 'ENDED', publication: { ...(offer.publication || {}), status: 'ENDED', republish: false }, withdrawnAt: now, withdrawnReason: reason } : offer);
    const audit = Array.isArray(auditRec.items) ? [...auditRec.items] : [];
    audit.unshift({ id: crypto.randomUUID(), offerIds, endedOfferIds: endedIds, reason, results, at: now, operator: 'administrator' });
    await Promise.all([
      write('allegro_offers', { ...offersRec, items: updatedOffers, updated_at: now }),
      write('allegro_mappings', { items: mappings, updated_at: now }),
      ...(settingsChanged ? [write('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: now })] : []),
      write('allegro_offer_withdrawal_audit', { items: audit.slice(0, 3000), updated_at: now }),
    ]);
    return respond({ ok: true, partial: failed.length > 0, requested: offerIds.length, ended: endedIds.length, failed: failed.length, results, offers: updatedOffers, mappings, updated_at: now });
  };
}
