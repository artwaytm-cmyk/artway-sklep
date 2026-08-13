import crypto from 'node:crypto';
import {
  allegroMappingIsCanonical,
  allegroProductSyncFingerprint,
  canonicalizeAllegroMappings,
  linkCanonicalAllegroMapping,
} from './domain/allegro-canonical-mappings.mjs';

const ACTIONS = new Set(['allegro-map-offer', 'allegro-map-offers-batch', 'allegro-unmap-offer']);

export function createAllegroMappingRoute(deps) {
  const { respond, isAdmin, text, read, write, mappingItems, offerItems, completeProducts, assessMapping, productSnapshot, writeMappingsSafely, recalculateOrders, saveProductFields } = deps;
  const saveProduct = async (input) => {
    if (typeof saveProductFields !== 'function') {
      throw Object.assign(new Error('Centralna kartoteka produktów nie jest dostępna.'), {
        code: 'central_product_catalog_unavailable',
        status: 503,
      });
    }
    return saveProductFields(input);
  };
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
      const now = new Date().toISOString(), old = items[offerId] || null, productOperations = [];
      if (old?.productId && String(old.productId) !== productId) {
        const oldProduct = products.get(String(old.productId));
        if (oldProduct && String(oldProduct.allegroOfferId || '') === offerId) productOperations.push({
          productId: String(old.productId),
          fields: { allegroMappingStatus: 'zmienione_ręcznie' },
          remove: ['allegroOfferId', 'allegroProductId', 'allegroCategoryId'],
          mutationId: `allegro-remap-old:${String(old.productId)}:${offerId}:${now}`,
          actor: 'administrator',
          area: 'allegro-mapping',
        });
      }
      const link = linkCanonicalAllegroMapping({ mappings: items, offers: offerItems(offersRec), products, offer, product, validation, operator: manualDecision ? 'admin-manual-decision' : (force ? 'admin-force' : 'admin-validated'), now });
      link.mappings[offerId] = { ...link.mappings[offerId], productSnapshot: productSnapshot(product, data) };
      productOperations.push({
        productId,
        fields: { allegroOfferId: offerId, ...(offer.productId ? { allegroProductId: text(offer.productId, 120) } : {}), ...(offer.categoryId ? { allegroCategoryId: text(offer.categoryId, 80) } : {}), allegroMappingStatus: 'kanoniczne', allegroSyncedAt: link.syncRequired ? (product.allegroSyncedAt || null) : now, allegroSyncSource: 'store-canonical-mapping', allegroEditorialSyncPending: link.syncRequired, allegroEditorialSyncPendingAt: link.syncRequired ? now : (product.allegroEditorialSyncPendingAt || null), allegroEditorialSyncState: link.syncRequired ? 'pending' : 'synced', allegroEditorialSyncReason: link.syncRequired ? 'ręcznie zatwierdzone mapowanie — aktualizacja Allegro z danych sklepu' : '' },
        remove: ['allegroMappingConflict'],
        mutationId: `allegro-map:${productId}:${offerId}:${now}`,
        actor: 'administrator',
        area: 'allegro-mapping',
      });
      await Promise.all(productOperations.map(saveProduct));
      const changedMappingIds = Object.keys(link.mappings).filter((id) => JSON.stringify(items[id] ?? null) !== JSON.stringify(link.mappings[id] ?? null));
      if (link.changed) await writeMappingsSafely(items, link.mappings, now, { forceKeys: changedMappingIds });
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
      const data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {}, products = await completeProducts(data), now = new Date().toISOString(), results = [], productOperations = [];
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
          if (oldProduct && String(oldProduct.allegroOfferId || '') === item.offerId) productOperations.push({
            productId: String(old.productId),
            fields: { allegroMappingStatus: 'zmienione_automatycznie' },
            remove: ['allegroOfferId', 'allegroProductId', 'allegroCategoryId'],
            mutationId: `allegro-batch-remap-old:${String(old.productId)}:${item.offerId}:${now}`,
            actor: 'administrator',
            area: 'allegro-mapping-batch',
          });
        }
        const fingerprint = allegroProductSyncFingerprint(product);
        mappings[item.offerId] = { ...old, offerId: item.offerId, productId: item.productId, allegroProductId: text(offer.productId, 120), categoryId: text(offer.categoryId, 80), productName: text(product.nazwa || product.name, 300), offerName: text(offer.name, 300), linked_at: old?.linked_at || now, operator: 'admin-safe-batch', confidence: validation.score, reason: validation.reason, evidence: validation.evidence, conflicts: validation.conflicts, warnings: validation.warnings, blocked: false, verifiedForSupplier: true, verification: 'admin-safe-batch', productSnapshot: productSnapshot(product, data), canonical: true, canonicalLocked: true, locked: true, mappingRole: 'primary', lifecycle: 'current', active: true, sourceOfTruth: 'store', syncState: old?.lastSourceFingerprint === fingerprint ? 'synced' : 'pending', pendingSourceFingerprint: old?.lastSourceFingerprint === fingerprint ? '' : fingerprint, syncRequestedAt: now };
        productOperations.push({
          productId: item.productId,
          fields: { allegroOfferId: item.offerId, ...(offer.productId ? { allegroProductId: text(offer.productId, 120) } : {}), ...(offer.categoryId ? { allegroCategoryId: text(offer.categoryId, 80) } : {}), allegroMappingStatus: 'kanoniczne', allegroSyncSource: 'store-canonical-batch', allegroEditorialSyncPending: old?.lastSourceFingerprint !== fingerprint, allegroEditorialSyncPendingAt: now, allegroEditorialSyncState: old?.lastSourceFingerprint === fingerprint ? 'synced' : 'pending' },
          remove: ['allegroMappingConflict'],
          mutationId: `allegro-map-batch:${item.productId}:${item.offerId}:${now}`,
          actor: 'administrator',
          area: 'allegro-mapping-batch',
        });
        occupied.set(item.productId, item.offerId); results.push({ ...item, ok: true, validation });
      }
      const changed = results.some((item) => item.ok);
      if (changed) {
        await Promise.all(productOperations.map(saveProduct));
        await writeMappingsSafely(baseMappings, canonicalizeAllegroMappings({ mappings, offers: offersList, products, now }).mappings, now);
      }
      const workflow = changed ? await recalculateOrders() : {};
      return respond({ ok: true, mappings, results, mapped: results.filter((item) => item.ok).length, skipped: results.filter((item) => !item.ok).length, ...workflow });
    }

    const body = await req.json().catch(() => ({})), offerId = text(body.offerId, 100).trim();
    if (!offerId) return respond({ ok: false, error: 'Brak offerId' }, 422);
    const rec = await read('allegro_mappings', { items: {} }), baseItems = { ...mappingItems(rec) }, items = { ...baseItems }, oldMapping = items[offerId] || null, now = new Date().toISOString();
    items[offerId] = { ...oldMapping, offerId, previousProductId: oldMapping?.productId || oldMapping?.previousProductId || '', productId: '', blocked: true, canonical: false, canonicalLocked: false, locked: false, mappingRole: 'unlinked', lifecycle: 'unlinked', active: false, operator: 'admin-unmapped', linked_at: oldMapping?.linked_at || null, synced_at: now, history: [{ at: now, action: 'unlinked', fromProductId: oldMapping?.productId || '', operator: 'admin-unmapped' }, ...(Array.isArray(oldMapping?.history) ? oldMapping.history : [])].slice(0, 12) };
    let productWrite = null;
    if (oldMapping?.productId) {
      const settingsRec = await read('settings', { data: {}, rev: 0, updated_at: null }), data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {};
      const products = await completeProducts(data), current = products.get(String(oldMapping.productId));
      if (current && String(current.allegroOfferId || '') === offerId) {
        productWrite = saveProduct({
          productId: String(oldMapping.productId),
          fields: { allegroMappingStatus: 'odłączone_ręcznie', allegroSyncedAt: now, allegroSyncSource: 'admin-unmapping' },
          remove: ['allegroOfferId', 'allegroMappingConflict'],
          mutationId: `allegro-unmap:${String(oldMapping.productId)}:${offerId}:${now}`,
          actor: 'administrator',
          area: 'allegro-unmapping',
        });
      }
    }
    if (productWrite) await productWrite;
    await writeMappingsSafely(baseItems, items, now, { forceKeys: [offerId] });
    const workflow = await recalculateOrders();
    return respond({ ok: true, mappings: items, ...workflow });
  };
}
