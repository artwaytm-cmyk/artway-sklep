export function createVonHalskyCatalogRoute(context = {}) {
  const {
    respond, readVersioned, STORE_KEY, initialState, cleanState, api, mutate,
    recordDiagnostic, loadCatalog, sourceUrlOf, inspectSource, sourceImages,
    resolveVonHalskyResponsibleProducer, categoryIndexFor,
    suggestVonHalskyCategory, matchVonHalskyAttributes,
    vonHalskyAgentPreparationPatch, saveProductFields, sessionOf, progress,
    updateProductPublication, prepareProductWithAgent, safeError, matchingText,
    matchingGtin, categoryRejectionForProduct, remoteOfferSummary,
    commandReceipt, mergeBy, summarizeVonHalskyCatalog,
    deduplicateVonHalskyOffers, vonHalskyOfferProposal,
    vonHalskyOfferProjection, vonHalskyProductReadiness,
    vonHalskyPublicConfig, normalizeVonHalskySettings, env,
  } = context;
  return async function route(req, url, action) {
    if (action === 'von-halsky-catalog-preview') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const state = cleanState((await readVersioned(STORE_KEY, initialState())).value);
      const products = await loadCatalog();
      const list = Array.isArray(products) ? products : [...(products?.values?.() || [])];
      const projections = list.map((product) => vonHalskyOfferProjection(product, state.settings));
      const deduplicated = deduplicateVonHalskyOffers(projections);
      return respond({
        ok: true,
        summary: summarizeVonHalskyCatalog(list),
        eligible: deduplicated.items.filter((item) => item.readiness.publishable && item.available).length,
        blocked: deduplicated.items.filter((item) => !item.readiness.publishable || !item.available).length,
        duplicates: deduplicated.conflicts.length,
        sample: projections.slice(0, 5).map((item) => ({
          externalId: item.externalId,
          gtin: item.gtin,
          name: item.name,
          ready: item.readiness.ready,
          publishable: item.readiness.publishable,
          issues: [...item.readiness.issues, ...item.readiness.publicationIssues],
        })),
      });
    }

    if (action === 'von-halsky-sync-catalog') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const state = cleanState((await readVersioned(STORE_KEY, initialState())).value);
      const config = vonHalskyPublicConfig(env());
      if (body.publish === true && !config.configured) {
        if (body.scheduled === true) return respond({ ok: true, skipped: true, reason: 'not-configured', config });
        return respond({ ok: false, error: 'Najpierw uzupełnij prywatny kontrakt API Von Halsky na serwerze.', code: 'von_halsky_not_configured', config }, 503);
      }
      if (body.publish === true && body.scheduled === true) {
        const previous = Date.parse(String(state.sync.lastCatalogAt || ''));
        const intervalMs = Math.max(15, Number(state.settings.syncIntervalMinutes) || 15) * 60_000;
        if (Number.isFinite(previous) && Date.now() - previous < intervalMs) {
          return respond({ ok: true, skipped: true, reason: 'not-due', nextAt: new Date(previous + intervalMs).toISOString(), sync: state.sync });
        }
      }
      const products = await loadCatalog();
      const list = Array.isArray(products) ? products : [...(products?.values?.() || [])];
      const requestedProductIds = new Set((Array.isArray(body.productIds) ? body.productIds : []).map((id) => String(id || '')).filter(Boolean));
      const selectedList = requestedProductIds.size ? list.filter((product) => requestedProductIds.has(String(product?.id))) : list;
      const projections = selectedList.map((product) => vonHalskyOfferProjection(product, state.settings));
      const productByExternalId = new Map(selectedList.map((product) => [vonHalskyOfferProjection(product, state.settings).externalId, product]));
      const deduplicated = deduplicateVonHalskyOffers(projections);
      const eligible = deduplicated.items.filter((item) => item.readiness.publishable && item.available);
      const allowNewOffer = (item) => {
        const product = productByExternalId.get(item.externalId);
        return Boolean(product && requestedProductIds.has(String(product.id)));
      };
      if (body.publish !== true) return respond({
        ok: true,
        dryRun: true,
        eligible: eligible.length,
        allowedToCreate: eligible.filter(allowNewOffer).length,
        publicationMode: 'manual_selection',
        blocked: deduplicated.items.length - eligible.length,
        duplicates: deduplicated.conflicts.length,
      });
      const batchSize = Math.max(1, Math.min(100, Number(body.batchSize) || 50));
      let sent = 0, created = 0, updatedCount = 0, closed = 0, reopened = 0, skippedNew = 0;
      let lastRequestId = '';
      let activeBatchProducts = [];
      try {
        const remoteResult = await api.listOffers();
        // Batch creation is asynchronous and a freshly accepted offer may not be
        // visible in GET /offers yet. Keep the durable receipt in the local state
        // as an idempotency barrier until the provider list catches up.
        const offersByExternalId = new Map();
        for (const source of [...state.offers, ...remoteResult.data]) {
          const item = remoteOfferSummary(source);
          if (item.offerId && item.externalId) offersByExternalId.set(item.externalId, item);
        }
        const remoteOffers = [...offersByExternalId.values()];
        const remoteByExternalId = new Map(remoteOffers.filter((item) => item.externalId).map((item) => [item.externalId, item]));
        lastRequestId = remoteResult.requestId || '';
        const existing = deduplicated.items.filter((item) => remoteByExternalId.has(item.externalId));
        const createCandidates = eligible.filter((item) => !remoteByExternalId.has(item.externalId) && allowNewOffer(item));
        skippedNew = eligible.filter((item) => !remoteByExternalId.has(item.externalId) && !allowNewOffer(item)).length;

        for (const item of existing) {
          const product = productByExternalId.get(item.externalId), remote = remoteByExternalId.get(item.externalId);
          activeBatchProducts = product ? [product] : [];
          if (!item.available) {
            if (!['CLOSED', 'SOLDOUT'].includes(remote.status)) {
              const result = await api.setOfferOpen(remote.offerId, false);
              lastRequestId = result.requestId || lastRequestId;
              remote.status = 'CLOSED';
              closed += 1;
            }
            continue;
          }
          if (['CLOSED', 'SOLDOUT'].includes(remote.status) && state.settings.automaticResume !== false) {
            const result = await api.setOfferOpen(remote.offerId, true);
            lastRequestId = result.requestId || lastRequestId;
            remote.status = 'PENDING';
            reopened += 1;
          }
          if (!item.readiness.publishable) continue;
          const contentDue = body.forceContent === true || requestedProductIds.has(String(product?.id || '')) || product?.vonHalskyEditorialSyncPending === true;
          if (contentDue) {
            const proposal = vonHalskyOfferProposal(item);
            const { externalId: _externalId, ...patch } = proposal;
            const result = await api.updateOffer(remote.offerId, patch);
            lastRequestId = result.requestId || lastRequestId;
            updatedCount += 1;
          }
        }

        if (state.settings.automaticPriceSync !== false) {
          const prices = existing.filter((item) => item.available && item.readiness.publishable).map((item) => ({
            offerId: remoteByExternalId.get(item.externalId).offerId,
            price: { amount: Number(Number(item.price).toFixed(2)), currency: item.currency || 'PLN' },
          }));
          for (let offset = 0; offset < prices.length; offset += batchSize) {
            const result = await api.updatePrices(prices.slice(offset, offset + batchSize));
            lastRequestId = result.requestId || lastRequestId;
            updatedCount += prices.slice(offset, offset + batchSize).length;
          }
        }
        if (state.settings.automaticStockSync !== false) {
          const stocks = existing.map((item) => ({
            offerId: remoteByExternalId.get(item.externalId).offerId,
            stock: { quantity: item.available ? item.stock : 0, unit: 'UNIT' },
          }));
          for (let offset = 0; offset < stocks.length; offset += batchSize) {
            const result = await api.updateStocks(stocks.slice(offset, offset + batchSize));
            lastRequestId = result.requestId || lastRequestId;
            updatedCount += stocks.slice(offset, offset + batchSize).length;
          }
        }

        for (let offset = 0; offset < createCandidates.length; offset += batchSize) {
          const batch = createCandidates.slice(offset, offset + batchSize);
          activeBatchProducts = batch.map((item) => productByExternalId.get(item.externalId)).filter(Boolean);
          await Promise.all(activeBatchProducts.map((product) => progress({
            id: `editorial:${product.id}:vonHalsky:${String(product.vonHalskyEditorialSyncRunId || product.vonHalskyEditorialSyncPendingAt || Date.now()).slice(0, 64)}`,
            runId: product.vonHalskyEditorialSyncRunId, productId: String(product.id), productName: String(product.nazwa || product.name || '').slice(0, 180),
            channel: 'vonHalsky', action: 'publikacja treści w kanale', phase: 'sending_to_von_halsky', status: 'running',
            target: 'katalog InPost Von Halsky', targetRef: product.externalId || product.sku || String(product.id),
            message: 'Wysyłam dozwoloną kartę produktu do API Von Halsky i czekam na identyfikator polecenia.',
          })));
          const proposals = batch.map((item) => vonHalskyOfferProposal(item));
          const result = await api.createOffers(proposals);
          lastRequestId = result.requestId || lastRequestId;
          const receipts = Array.isArray(result.payload) ? result.payload : [];
          sent += proposals.length;
          created += proposals.length;
          const at = new Date().toISOString();
          for (const product of activeBatchProducts) {
            const externalId = vonHalskyOfferProjection(product, state.settings).externalId;
            const receipt = receipts.find((item) => String(item?.externalId || '') === externalId) || receipts[activeBatchProducts.indexOf(product)] || {};
            if (receipt.offerId && typeof saveProductFields === 'function') {
              await saveProductFields({
                productId: String(product.id),
                fields: { vonHalskyOfferId: String(receipt.offerId), vonHalskyCommandId: String(receipt.commandId || '') },
                mutationId: `von-halsky-offer-link:${product.id}:${receipt.offerId}`,
                actor: 'von-halsky-api',
                area: 'von-halsky-offer-link',
              });
              remoteOffers.push({ offerId: String(receipt.offerId), externalId, status: 'PENDING', updatedAt: at, validationErrors: [], rejectionReasons: [] });
            }
          }
          await updateProductPublication(activeBatchProducts, 'confirmed', { timestamp: at, receiptId: result.requestId || lastRequestId });
          await Promise.all(activeBatchProducts.map((product) => progress({
            id: `editorial:${product.id}:vonHalsky:${String(product.vonHalskyEditorialSyncRunId || product.vonHalskyEditorialSyncPendingAt || Date.now()).slice(0, 64)}`,
            runId: product.vonHalskyEditorialSyncRunId, productId: String(product.id), productName: String(product.nazwa || product.name || '').slice(0, 180),
            channel: 'vonHalsky', action: 'publikacja treści w kanale', phase: 'confirmed_by_von_halsky', status: 'confirmed',
            target: 'katalog InPost Von Halsky', targetRef: product.externalId || product.sku || String(product.id),
            receiptId: result.requestId || lastRequestId, completedAt: at,
            message: 'API Von Halsky potwierdziło przyjęcie karty produktu.',
          })));
          activeBatchProducts = [];
        }
        const at = new Date().toISOString();
        const updated = await mutate((current) => {
          current.offers = remoteOffers;
          current.sync = { ...current.sync, status: 'connected', lastCatalogAt: at, lastCatalogCount: created + updatedCount + closed + reopened, lastError: '', lastRequestId };
          return current;
        });
        const message = `Nowe ${created}, aktualizacje ${updatedCount}, zamknięte ${closed}, wznowione ${reopened}; pominięte nowe ${skippedNew}.`;
        await recordDiagnostic({ operation: 'catalog-sync', status: 'ok', message, requestId: lastRequestId });
        return respond({
          ok: true, sent, created, updated: updatedCount, closed, reopened, skippedNew,
          publicationMode: 'manual_selection',
          blocked: deduplicated.items.length - eligible.length,
          duplicates: deduplicated.conflicts.length,
          offers: updated.offers,
          sync: updated.sync,
        });
      } catch (error) {
        const safe = safeError(error);
        const retryProducts = activeBatchProducts.filter((product) => product.vonHalskyEditorialSyncPending === true || requestedProductIds.has(String(product.id)));
        const failedAt = new Date().toISOString(), nextRetryAt = new Date(Date.now() + 15 * 60_000).toISOString();
        await updateProductPublication(retryProducts, 'retry', { timestamp: failedAt, error: safe.message, nextRetryAt }).catch(() => {});
        await Promise.all(retryProducts.map((product) => progress({
          id: `editorial:${product.id}:vonHalsky:${String(product.vonHalskyEditorialSyncRunId || product.vonHalskyEditorialSyncPendingAt || Date.now()).slice(0, 64)}`,
          runId: product.vonHalskyEditorialSyncRunId, productId: String(product.id), productName: String(product.nazwa || product.name || '').slice(0, 180),
          channel: 'vonHalsky', action: 'publikacja treści w kanale', phase: 'retry_scheduled', status: 'failed',
          target: 'katalog InPost Von Halsky', targetRef: product.externalId || product.sku || String(product.id),
          error: safe.message, nextRetryAt, message: 'Kanał nie potwierdził zmiany. Niczego nie oznaczono jako opublikowane; zaplanowano ponowienie.',
        })));
        await mutate((current) => {
          current.sync = { ...current.sync, status: 'error', lastError: safe.message };
          return current;
        });
        await recordDiagnostic({
          operation: 'catalog-sync',
          status: 'error',
          message: safe.message,
          requestId: String(safe.details?.requestId || ''),
        });
        return respond({ ok: false, sent, created, updated: updatedCount, closed, reopened, skippedNew, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }


    return null;
  };
}
