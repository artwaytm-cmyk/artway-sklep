import crypto from 'node:crypto';
import {
  allegroMappingIsCanonical,
  allegroProductSyncFingerprint,
  canonicalizeAllegroMappings,
  linkCanonicalAllegroMapping,
} from './domain/allegro-canonical-mappings.mjs';

const ACTIONS = new Set(['allegro-map-offer', 'allegro-map-offers-batch', 'allegro-unmap-offer']);

export function createAllegroMappingRoute(deps) {
  const { respond, isAdmin, text, read, write, mappingItems, offerItems, completeProducts, assessMapping, createProductUpdater, productSnapshot, writeMappingsSafely, recalculateOrders } = deps;
  return async function allegroMappingRoute(req, url, action) {
    if (!ACTIONS.has(action)) return null;
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);

    if (action === 'allegro-map-offer') {
      const body = await req.json().catch(() => ({})), offerId = text(body.offerId, 100).trim(), productId = text(body.productId, 100).trim();
      if (!offerId || !productId) return respond({ ok: false, error: 'Brak offerId albo productId' }, 422);
      const [rec, offersRec, settingsRec] = await Promise.all([read('allegro_mappings', { items: {} }), read('allegro_offers', { items: [] }), read('settings', { data: {}, rev: 0, updated_at: null })]);
      const items = { ...mappingItems(rec) }, offer = offerItems(offersRec).find((entry) => String(entry.id) === offerId) || {};
      if (!offer.id) return respond({ ok: false, error: 'Nie znaleziono oferty Allegro', code: 'offer_not_found' }, 404);
      const data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {}, products = await completeProducts(data), product = products.get(productId);
      if (!product) return respond({ ok: false, error: 'Nie znaleziono produktu sklepu', code: 'product_not_found' }, 404);
      const validation = assessMapping(product, offer), manualDecision = body.manualDecision === true, force = manualDecision || body.force === true;
      if (!validation.valid && !force) return respond({ ok: false, error: `Połączenie wymaga świadomego zatwierdzenia: ${[...validation.conflicts, validation.reason].filter(Boolean).join(' • ')}`, code: 'mapping_validation', validation }, 409);
      const updater = createProductUpdater(data, products.keys()), now = new Date().toISOString(), old = items[offerId] || null;
      if (old?.productId && String(old.productId) !== productId) {
        const oldProduct = products.get(String(old.productId));
        if (oldProduct && String(oldProduct.allegroOfferId || '') === offerId) updater.apply(old.productId, { allegroMappingStatus: 'zmienione_ręcznie' }, ['allegroOfferId', 'allegroProductId', 'allegroCategoryId']);
      }
      const link = linkCanonicalAllegroMapping({ mappings: items, offers: offerItems(offersRec), products, offer, product, validation, operator: manualDecision ? 'admin-manual-decision' : (force ? 'admin-force' : 'admin-validated'), now });
      link.mappings[offerId] = { ...link.mappings[offerId], productSnapshot: productSnapshot(product, data) };
      updater.apply(productId, { allegroOfferId: offerId, ...(offer.productId ? { allegroProductId: text(offer.productId, 120) } : {}), ...(offer.categoryId ? { allegroCategoryId: text(offer.categoryId, 80) } : {}), allegroMappingStatus: 'kanoniczne', allegroSyncedAt: link.syncRequired ? (product.allegroSyncedAt || null) : now, allegroSyncSource: 'store-canonical-mapping', allegroEditorialSyncPending: link.syncRequired, allegroEditorialSyncPendingAt: link.syncRequired ? now : (product.allegroEditorialSyncPendingAt || null), allegroEditorialSyncState: link.syncRequired ? 'pending' : 'synced', allegroEditorialSyncReason: link.syncRequired ? 'ręcznie zatwierdzone mapowanie — aktualizacja Allegro z danych sklepu' : '' }, ['allegroMappingConflict']);
      const settingsChanged = updater.commit(), changedMappingIds = Object.keys(link.mappings).filter((id) => JSON.stringify(items[id] ?? null) !== JSON.stringify(link.mappings[id] ?? null));
      await Promise.all([...(link.changed ? [writeMappingsSafely(items, link.mappings, now, { forceKeys: changedMappingIds })] : []), ...(settingsChanged ? [write('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: now })] : [])]);
      if (link.changed && !link.idempotent) {
        const auditRec = await read('allegro_mapping_audit', { items: [], updated_at: null }), audit = Array.isArray(auditRec.items) ? auditRec.items : [];
        await write('allegro_mapping_audit', { items: [{ id: crypto.randomUUID(), at: now, action: old?.productId && String(old.productId) !== productId ? 'canonical-remap' : 'canonical-link', offerId, productId, previousProductId: old?.productId || '', duplicateOfferIds: link.duplicateOfferIds, operator: manualDecision ? 'admin-manual-decision' : 'admin-validated', validation: { score: validation.score, reason: validation.reason, evidence: validation.evidence, warnings: validation.warnings } }, ...audit].slice(0, 2000), updated_at: now });
      }
      const workflow = await recalculateOrders();
      return respond({ ok: true, mappings: link.mappings, validation, manualDecision, canonical: true, idempotent: link.idempotent, syncRequired: link.syncRequired, duplicateOfferIds: link.duplicateOfferIds, ...workflow });
    }

    if (action === 'allegro-map-offers-batch') {
      const body = await req.json().catch(() => ({}));
      const requested = (Array.isArray(body.items) ? body.items : []).map((item) => ({ offerId: text(item?.offerId, 100).trim(), productId: text(item?.productId, 100).trim() })).filter((item) => item.offerId && item.productId).slice(0, 500);
      if (!requested.length) return respond({ ok: false, error: 'Brak bezpiecznych sugestii do zapisania', code: 'empty_batch' }, 422);
      const [rec, offersRec, settingsRec] = await Promise.all([read('allegro_mappings', { items: {} }), read('allegro_offers', { items: [] }), read('settings', { data: {}, rev: 0, updated_at: null })]);
      const baseMappings = { ...mappingItems(rec) }, mappings = { ...baseMappings }, offersList = offerItems(offersRec), offers = new Map(offersList.map((offer) => [String(offer.id), offer]));
      const data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {}, products = await completeProducts(data), updater = createProductUpdater(data, products.keys()), now = new Date().toISOString(), results = [];
      const canonicalBefore = canonicalizeAllegroMappings({ mappings, offers: offersList, products, now });
      Object.keys(mappings).forEach((key) => delete mappings[key]); Object.assign(mappings, canonicalBefore.mappings);
      const occupied = new Map(Object.values(mappings).filter((mapping) => allegroMappingIsCanonical(mapping)).map((mapping) => [String(mapping.productId), String(mapping.offerId)]));
      for (const item of requested) {
        const offer = offers.get(item.offerId), product = products.get(item.productId);
        if (!offer || !product) { results.push({ ...item, ok: false, code: !offer ? 'offer_not_found' : 'product_not_found' }); continue; }
        const validation = assessMapping(product, offer), other = occupied.get(item.productId);
        if (!validation.valid || (other && other !== item.offerId)) { results.push({ ...item, ok: false, code: other && other !== item.offerId ? 'product_already_mapped' : 'mapping_validation', otherOfferId: other || '', validation }); continue; }
        const old = mappings[item.offerId] || null;
        if (old?.productId && String(old.productId) !== item.productId) {
          const oldProduct = products.get(String(old.productId));
          if (oldProduct && String(oldProduct.allegroOfferId || '') === item.offerId) updater.apply(old.productId, { allegroMappingStatus: 'zmienione_automatycznie' }, ['allegroOfferId', 'allegroProductId', 'allegroCategoryId']);
        }
        const fingerprint = allegroProductSyncFingerprint(product);
        mappings[item.offerId] = { ...old, offerId: item.offerId, productId: item.productId, allegroProductId: text(offer.productId, 120), categoryId: text(offer.categoryId, 80), productName: text(product.nazwa || product.name, 300), offerName: text(offer.name, 300), linked_at: old?.linked_at || now, operator: 'admin-safe-batch', confidence: validation.score, reason: validation.reason, evidence: validation.evidence, conflicts: validation.conflicts, warnings: validation.warnings, blocked: false, verifiedForSupplier: true, verification: 'admin-safe-batch', productSnapshot: productSnapshot(product, data), canonical: true, canonicalLocked: true, locked: true, mappingRole: 'primary', lifecycle: 'current', active: true, sourceOfTruth: 'store', syncState: old?.lastSourceFingerprint === fingerprint ? 'synced' : 'pending', pendingSourceFingerprint: old?.lastSourceFingerprint === fingerprint ? '' : fingerprint, syncRequestedAt: now };
        updater.apply(item.productId, { allegroOfferId: item.offerId, ...(offer.productId ? { allegroProductId: text(offer.productId, 120) } : {}), ...(offer.categoryId ? { allegroCategoryId: text(offer.categoryId, 80) } : {}), allegroMappingStatus: 'kanoniczne', allegroSyncSource: 'store-canonical-batch', allegroEditorialSyncPending: old?.lastSourceFingerprint !== fingerprint, allegroEditorialSyncPendingAt: now, allegroEditorialSyncState: old?.lastSourceFingerprint === fingerprint ? 'synced' : 'pending' }, ['allegroMappingConflict']);
        occupied.set(item.productId, item.offerId); results.push({ ...item, ok: true, validation });
      }
      const changed = results.some((item) => item.ok), settingsChanged = updater.commit();
      if (changed) await Promise.all([writeMappingsSafely(baseMappings, canonicalizeAllegroMappings({ mappings, offers: offersList, products, now }).mappings, now), ...(settingsChanged ? [write('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: now })] : [])]);
      const workflow = changed ? await recalculateOrders() : {};
      return respond({ ok: true, mappings, results, mapped: results.filter((item) => item.ok).length, skipped: results.filter((item) => !item.ok).length, ...workflow });
    }

    const body = await req.json().catch(() => ({})), offerId = text(body.offerId, 100).trim();
    if (!offerId) return respond({ ok: false, error: 'Brak offerId' }, 422);
    const rec = await read('allegro_mappings', { items: {} }), baseItems = { ...mappingItems(rec) }, items = { ...baseItems }, oldMapping = items[offerId] || null, now = new Date().toISOString();
    items[offerId] = { ...oldMapping, offerId, previousProductId: oldMapping?.productId || oldMapping?.previousProductId || '', productId: '', blocked: true, canonical: false, canonicalLocked: false, locked: false, mappingRole: 'unlinked', lifecycle: 'unlinked', active: false, operator: 'admin-unmapped', linked_at: oldMapping?.linked_at || null, synced_at: now, history: [{ at: now, action: 'unlinked', fromProductId: oldMapping?.productId || '', operator: 'admin-unmapped' }, ...(Array.isArray(oldMapping?.history) ? oldMapping.history : [])].slice(0, 12) };
    let settingsWrite = null;
    if (oldMapping?.productId) {
      const settingsRec = await read('settings', { data: {}, rev: 0, updated_at: null }), data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {};
      const products = await completeProducts(data), current = products.get(String(oldMapping.productId));
      if (current && String(current.allegroOfferId || '') === offerId) {
        const updater = createProductUpdater(data, products.keys());
        updater.apply(oldMapping.productId, { allegroMappingStatus: 'odłączone_ręcznie', allegroSyncedAt: now, allegroSyncSource: 'admin-unmapping' }, ['allegroOfferId', 'allegroMappingConflict']);
        if (updater.commit()) settingsWrite = write('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: now });
      }
    }
    await Promise.all([writeMappingsSafely(baseItems, items, now, { forceKeys: [offerId] }), ...(settingsWrite ? [settingsWrite] : [])]);
    const workflow = await recalculateOrders();
    return respond({ ok: true, mappings: items, ...workflow });
  };
}
