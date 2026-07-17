import crypto from 'node:crypto';
import { analyzeAutonomousAllegroWork } from './domain/allegro-autonomous-agent.mjs';

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function endAllegroOffers(callAllegro, request, offerIds = []) {
  const ids = [...new Set(offerIds.map(String).filter(Boolean))];
  if (!ids.length) return [];
  const commandId = crypto.randomUUID(), path = `/sale/offer-publication-commands/${commandId}`;
  let summary = await callAllegro(request, path, { method: 'PUT', bodyObj: { offerCriteria: [{ type: 'CONTAINS_OFFERS', offers: ids.map((id) => ({ id })) }], publication: { action: 'END' } } });
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const counts = summary?.taskCount || {};
    if (Number(counts.total) >= ids.length && Number(counts.failed) === 0 && Number(counts.success) >= ids.length) return ids.map((id) => ({ offerId: id, ended: true, commandId }));
    if (Number(counts.total) >= ids.length || summary?.completedAt) break;
    await wait(250);
    summary = await callAllegro(request, path);
  }
  const detail = await callAllegro(request, `${path}/tasks`, { parameters: { limit: Math.min(1000, ids.length), offset: 0 } });
  const tasks = Array.isArray(detail?.tasks) ? detail.tasks : [], byOffer = new Map(tasks.map((task) => [String(task?.offer?.id || ''), task]));
  return ids.map((id) => {
    const task = byOffer.get(id), ended = String(task?.status || '').toUpperCase() === 'SUCCESS';
    const errors = Array.isArray(task?.errors) ? task.errors : [];
    return ended ? { offerId: id, ended: true, commandId } : { offerId: id, ended: false, commandId, status: 422, code: String(errors[0]?.code || 'publication_command_failed').slice(0, 120), error: String(task?.message || errors.map((item) => item?.userMessage || item?.message).filter(Boolean).join('; ') || 'Allegro nie potwierdziło zakończenia oferty').slice(0, 700) };
  });
}

export function createAllegroOfferWithdrawalRoute({ autoMapOffers, callAllegro, createProductUpdater, getMappings, getOffers, getProducts, isAdmin, read, respond, text, write } = {}) {
  return async function allegroOfferWithdrawalRoute({ req, url, action } = {}) {
    if (!['allegro-withdraw-offers', 'allegro-resolve-duplicate', 'allegro-autonomous-agent-cycle'].includes(action)) return null;
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    const body = await req.json().catch(() => ({}));
    if (action === 'allegro-autonomous-agent-cycle') {
      const startedAt = new Date().toISOString(), runId = crypto.randomUUID(), source = text(body.source || 'manual-admin', 100);
      const dryRun = body.dryRun === true, maxActions = Math.min(25, Math.max(1, Number(body.maxActions) || 10));
      const [offerSettings, previousState] = await Promise.all([read('allegro_offer_settings', {}), read('allegro_autonomous_agent_state', {})]);
      const enabled = offerSettings.autonomousAgent !== false;
      const autoResolveDuplicates = offerSettings.autoResolveDuplicates !== false;
      const intervalMinutes = Math.min(120, Math.max(15, Number(offerSettings.autonomousAgentMinutes) || 15));
      if (!enabled) {
        const completedAt = new Date().toISOString();
        const state = { runId, enabled: false, status: 'disabled', source, startedAt, completedAt, nextRunAt: null, message: 'Autonomiczny Agent Allegro jest wyłączony w ustawieniach.' };
        await write('allegro_autonomous_agent_state', state);
        return respond({ ok: true, skipped: true, reason: 'disabled', state });
      }
      const scheduled = /^(?:vps|scheduled)/i.test(source), dueAt = Date.parse(previousState?.completedAt || '') + intervalMinutes * 60 * 1000;
      if (scheduled && Number.isFinite(dueAt) && Date.now() < dueAt) return respond({ ok: true, skipped: true, reason: 'not_due', state: { ...previousState, nextRunAt: new Date(dueAt).toISOString() } });

      let mapping = null;
      if (!dryRun && typeof autoMapOffers === 'function' && offerSettings.autoMapping !== false) {
        const currentOffers = getOffers(await read('allegro_offers', { items: [], updated_at: null }));
        mapping = await autoMapOffers(currentOffers);
      }
      const [offersRec, mappingsRec, settingsRec, ordersRec, auditRec] = await Promise.all([
        read('allegro_offers', { items: [], updated_at: null }),
        read('allegro_mappings', { items: {}, updated_at: null }),
        read('settings', { data: {}, rev: 0, updated_at: null }),
        read('allegro_orders', { items: [], updated_at: null }),
        read('allegro_duplicate_resolution_audit', { items: [], updated_at: null }),
      ]);
      const offers = getOffers(offersRec), mappings = getMappings(mappingsRec);
      const data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {};
      const products = await getProducts(data);
      const threshold = Math.min(100, Math.max(95, Number(offerSettings.autoResolveDuplicateMinScore) || 97));
      const salesByOffer = {};
      for (const order of Array.isArray(ordersRec.items) ? ordersRec.items : []) for (const line of Array.isArray(order?.lineItems) ? order.lineItems : []) {
        const id = String(line?.offerId || line?.offer?.id || '').trim();
        if (id) salesByOffer[id] = (salesByOffer[id] || 0) + Math.max(1, Number(line?.quantity) || 1);
      }
      const analysis = analyzeAutonomousAllegroWork({ offers, mappings, products, minimumScore: threshold, salesByOffer });
      const groups = autoResolveDuplicates ? analysis.duplicates.slice(0, maxActions) : [];
      const results = [], endedIds = new Set(), touchedProducts = new Map();

      if (!dryRun) for (const group of groups) {
        let offerResults;
        try { offerResults = await endAllegroOffers(callAllegro, req, group.withdrawOfferIds); }
        catch (error) { offerResults = group.withdrawOfferIds.map((id) => ({ offerId: id, ended: false, error: text(error?.message || error, 700), code: text(error?.code || '', 120), status: error?.status || 500 })); }
        const successful = offerResults.filter((item) => item.ended).map((item) => String(item.offerId));
        successful.forEach((id) => endedIds.add(id));
        if (successful.length) touchedProducts.set(group.productId, { ...group, withdrawOfferIds: successful });
        results.push({ ...group, withdrawOfferIds: successful, requestedWithdrawOfferIds: group.withdrawOfferIds, results: offerResults, ok: successful.length === group.withdrawOfferIds.length, partial: successful.length > 0 && successful.length < group.withdrawOfferIds.length });
      }

      const now = new Date().toISOString(), byId = new Map(offers.map((offer) => [String(offer?.id || ''), offer]));
      if (!dryRun && endedIds.size) {
        const edits = data.artway_produkty_edytowane && typeof data.artway_produkty_edytowane === 'object' ? { ...data.artway_produkty_edytowane } : {};
        for (const [productId, group] of touchedProducts.entries()) {
          const keepOffer = byId.get(String(group.keepOfferId)) || {};
          mappings[group.keepOfferId] = { ...(mappings[group.keepOfferId] || {}), offerId: group.keepOfferId, productId, allegroProductId: text(keepOffer.productId, 120), categoryId: text(keepOffer.categoryId, 80), productName: text(group.productName || keepOffer.name, 300), linked_at: mappings[group.keepOfferId]?.linked_at || now, synced_at: now, operator: 'agent-duplicate-keep', duplicateResolvedAt: now, confidence: group.confidence, verifiedForSupplier: true };
          for (const endedId of group.withdrawOfferIds) mappings[endedId] = { ...(mappings[endedId] || {}), offerId: endedId, previousProductId: productId, productId: '', blocked: true, duplicateOf: group.keepOfferId, operator: 'agent-duplicate-withdrawn', synced_at: now, duplicateResolvedAt: now, confidence: group.confidence };
          edits[productId] = { ...(edits[productId] || {}), allegroOfferId: group.keepOfferId, allegroProductId: text(keepOffer.productId || edits[productId]?.allegroProductId, 120), allegroCategoryId: text(keepOffer.categoryId || edits[productId]?.allegroCategoryId, 80), allegroDuplicateResolvedAt: now, allegroDuplicateResolvedBy: 'autonomous-agent' };
        }
        data.artway_produkty_edytowane = edits;
      }
      const updatedOffers = endedIds.size ? offers.map((offer) => endedIds.has(String(offer.id)) ? { ...offer, status: 'ENDED', publication: { ...(offer.publication || {}), status: 'ENDED', republish: false }, duplicateResolvedAt: now, duplicateResolvedBy: 'autonomous-agent' } : offer) : offers;
      const audit = Array.isArray(auditRec.items) ? [...auditRec.items] : [];
      for (const result of results.filter((item) => item.withdrawOfferIds.length)) audit.unshift({ id: crypto.randomUUID(), productId: result.productId, keepOfferId: result.keepOfferId, withdrawOfferIds: result.withdrawOfferIds, results: result.results, confidence: result.confidence, reason: result.reason, at: now, operator: 'autonomous-agent', runId, source });
      const pendingDuplicates = analysis.duplicates.slice(groups.length);
      const review = [...analysis.review, ...pendingDuplicates.map((group) => ({ code: 'action_limit', productId: group.productId, productName: group.productName, keepOfferId: group.keepOfferId, withdrawOfferIds: group.withdrawOfferIds, score: group.confidence }))];
      const completedAt = new Date().toISOString(), nextRunAt = new Date(Date.parse(completedAt) + intervalMinutes * 60 * 1000).toISOString();
      const state = {
        runId, enabled: true, status: results.some((item) => !item.ok) ? 'warning' : review.length ? 'review' : 'ok', source, startedAt, completedAt, nextRunAt,
        intervalMinutes, dryRun, autoResolveDuplicates, minimumScore: threshold,
        mapping: { autoMapped: Number(mapping?.autoMapped) || 0, refreshed: Number(mapping?.refreshed) || 0, quarantined: Number(mapping?.quarantined) || 0, reassessed: Number(mapping?.reassessed) || 0 },
        stats: analysis.stats, duplicateGroupsResolved: results.filter((item) => item.withdrawOfferIds.length).length, duplicateOffersEnded: endedIds.size, reviewCount: review.length,
        recentActions: results.slice(0, 25).map((item) => ({ productId: item.productId, productName: item.productName, keepOfferId: item.keepOfferId, withdrawOfferIds: item.withdrawOfferIds, confidence: item.confidence, ok: item.ok, partial: item.partial, errors: item.results.filter((result) => !result.ended).map((result) => ({ offerId: result.offerId, code: result.code, error: result.error })) })),
      };
      if (!dryRun) await Promise.all([
        ...(endedIds.size ? [
          write('allegro_offers', { ...offersRec, items: updatedOffers, updated_at: now }),
          write('allegro_mappings', { items: mappings, updated_at: now }),
          write('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: now }),
          write('allegro_duplicate_resolution_audit', { items: audit.slice(0, 3000), updated_at: now }),
        ] : []),
        write('allegro_autonomous_agent_review', { items: review.slice(0, 2000), updated_at: now, runId }),
        write('allegro_autonomous_agent_state', state),
      ]);
      return respond({ ok: true, dryRun, state, mapping, analysis, results, offers: dryRun ? undefined : updatedOffers, mappings: dryRun ? undefined : mappings, updated_at: now });
    }
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
      let results;
      try { results = await endAllegroOffers(callAllegro, req, withdrawOfferIds); }
      catch (error) { results = withdrawOfferIds.map((offerId) => ({ offerId, ended: false, error: text(error?.message || error, 700), code: text(error?.code || '', 120), status: error?.status || 500 })); }
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
      try { results.push(...await endAllegroOffers(callAllegro, req, batch)); }
      catch (error) { results.push(...batch.map((offerId) => ({ offerId, ended: false, error: text(error?.message || error, 700), code: text(error?.code || '', 120), status: error?.status || 500 }))); }
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
