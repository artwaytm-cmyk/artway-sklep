import {
  preferredVonHalskyOffers,
  reconcileVonHalskyCatalog,
} from './von-halsky-catalog-reconciliation.mjs';

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

    if (action === 'von-halsky-reconcile-catalog') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const config = vonHalskyPublicConfig(env());
      if (!config.configured) return respond({
        ok: false,
        error: 'Najpierw uzupełnij prywatny kontrakt API Von Halsky na serwerze.',
        code: 'von_halsky_not_configured',
        config,
      }, 503);
      try {
        const remoteResult = await api.listOffers();
        const remoteOffers = (Array.isArray(remoteResult.data) ? remoteResult.data : []).map(remoteOfferSummary);
        const products = await loadCatalog();
        const list = Array.isArray(products) ? products : [...(products?.values?.() || [])];
        const timestamp = new Date().toISOString();
        const reconciliation = await reconcileVonHalskyCatalog({
          remoteOffers,
          products: list,
          saveProductFields,
          timestamp,
        });
        const updated = await mutate((current) => {
          current.offers = remoteOffers;
          current.sync = {
            ...current.sync,
            status: 'connected',
            lastCatalogAt: timestamp,
            lastCatalogVerifiedAt: timestamp,
            lastCatalogCount: reconciliation.truth.total,
            remoteOfferCount: reconciliation.truth.total,
            publishedOfferCount: reconciliation.truth.published,
            pendingOfferCount: reconciliation.truth.pending,
            rejectedOfferCount: reconciliation.truth.rejected,
            lastError: '',
            lastRequestId: remoteResult.requestId || '',
          };
          return current;
        });
        await recordDiagnostic({
          operation: 'catalog-reconciliation',
          status: 'ok',
          message: `API: ${reconciliation.truth.total}; w sprzedaży: ${reconciliation.truth.published}; usunięte fałszywe powiązania: ${reconciliation.counts.staleCleared}.`,
          requestId: remoteResult.requestId || '',
        });
        return respond({
          ok: true,
          offers: remoteOffers,
          truth: reconciliation.truth,
          reconciliation: reconciliation.counts,
          productUpdates: reconciliation.productUpdates,
          sync: updated.sync,
        });
      } catch (error) {
        const safe = safeError(error);
        await recordDiagnostic({
          operation: 'catalog-reconciliation',
          status: 'error',
          message: safe.message,
          requestId: String(safe.details?.requestId || ''),
        });
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
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
      const pendingCommands = [];
      const productUpdates = new Map();
      const rememberProductUpdates = (updates = []) => {
        for (const update of Array.isArray(updates) ? updates : []) {
          const id = String(update?.productId || '');
          if (!id) continue;
          const previous = productUpdates.get(id) || {};
          productUpdates.set(id, {
            productId: id,
            fields: { ...(previous.fields || {}), ...(update.fields || {}) },
            readbackConfirmed: update.readbackConfirmed === true || previous.readbackConfirmed === true,
            confirmedAt: update.confirmedAt || previous.confirmedAt || '',
          });
        }
      };
      try {
        const remoteResult = await api.listOffers();
        // Jedynym źródłem prawdy o ofercie jest aktualny odczyt API. Potwierdzeń
        // operacji zbiorczych nie dokładamy do listy ofert, dopóki GET /offers
        // faktycznie ich nie zwróci.
        const remoteOffers = (Array.isArray(remoteResult.data) ? remoteResult.data : []).map(remoteOfferSummary);
        const remoteByExternalId = preferredVonHalskyOffers(remoteOffers).byExternalId;
        lastRequestId = remoteResult.requestId || '';
        const existing = deduplicated.items.filter((item) => remoteByExternalId.has(item.externalId));
        const createCandidates = eligible.filter((item) => !remoteByExternalId.has(item.externalId) && allowNewOffer(item));
        skippedNew = eligible.filter((item) => !remoteByExternalId.has(item.externalId) && !allowNewOffer(item)).length;

        for (const item of existing) {
          const product = productByExternalId.get(item.externalId), remote = remoteByExternalId.get(item.externalId);
          activeBatchProducts = product ? [product] : [];
          if (
            product
            && remote?.offerId
            && String(product.vonHalskyOfferId || '') !== String(remote.offerId)
            && typeof saveProductFields === 'function'
          ) {
            const linkFields = { vonHalskyOfferId: String(remote.offerId) };
            const linked = await saveProductFields({
              productId: String(product.id),
              fields: linkFields,
              mutationId: `von-halsky-offer-link-existing:${product.id}:${remote.offerId}`,
              actor: 'von-halsky-api',
              area: 'von-halsky-offer-link',
            });
            rememberProductUpdates([{
              productId: String(product.id),
              fields: linkFields,
              readbackConfirmed: linked?.publication?.readbackConfirmed === true,
              confirmedAt: new Date().toISOString(),
            }]);
          }
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
            rememberProductUpdates(await updateProductPublication([product], 'publishing', {
              timestamp: new Date().toISOString(),
              receiptId: result.requestId || lastRequestId,
              targetRef: remote.offerId,
            }));
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
              const linkFields = {
                vonHalskyOfferId: String(receipt.offerId),
                vonHalskyCommandId: String(receipt.commandId || ''),
              };
              const linked = await saveProductFields({
                productId: String(product.id),
                fields: linkFields,
                mutationId: `von-halsky-offer-link:${product.id}:${receipt.offerId}`,
                actor: 'von-halsky-api',
                area: 'von-halsky-offer-link',
              });
              rememberProductUpdates([{
                productId: String(product.id),
                fields: linkFields,
                readbackConfirmed: linked?.publication?.readbackConfirmed === true,
                confirmedAt: at,
              }]);
            }
            const command = commandReceipt(receipt, 'offer-create', String(product.id));
            if (command) pendingCommands.push({
              ...command,
              productId: String(product.id),
              externalId,
              offerId: String(receipt.offerId || ''),
            });
            rememberProductUpdates(await updateProductPublication([product], 'publishing', {
              timestamp: at,
              receiptId: String(receipt.commandId || result.requestId || lastRequestId),
              targetRef: String(receipt.offerId || externalId),
            }));
          }
          await Promise.all(activeBatchProducts.map((product) => progress({
            id: `editorial:${product.id}:vonHalsky:${String(product.vonHalskyEditorialSyncRunId || product.vonHalskyEditorialSyncPendingAt || Date.now()).slice(0, 64)}`,
            runId: product.vonHalskyEditorialSyncRunId, productId: String(product.id), productName: String(product.nazwa || product.name || '').slice(0, 180),
            channel: 'vonHalsky', action: 'publikacja treści w kanale', phase: 'accepted_by_von_halsky', status: 'running',
            target: 'katalog InPost Von Halsky', targetRef: product.externalId || product.sku || String(product.id),
            receiptId: result.requestId || lastRequestId,
            message: 'API przyjęło polecenie. Oferta pozostaje w weryfikacji do chwili potwierdzenia przez aktualny katalog kanału.',
          })));
          activeBatchProducts = [];
        }
        const at = new Date().toISOString();
        const updated = await mutate((current) => {
          current.offers = remoteOffers;
          current.commands = mergeBy(current.commands, pendingCommands, (item) => item?.commandId).slice(0, 500);
          const truth = {
            total: remoteOffers.length,
            published: remoteOffers.filter((item) => String(item.status).toUpperCase() === 'PUBLISHED').length,
            pending: remoteOffers.filter((item) => ['PENDING', 'PROCESSING'].includes(String(item.status).toUpperCase())).length,
            rejected: remoteOffers.filter((item) => ['REJECTED', 'ERROR'].includes(String(item.status).toUpperCase())).length,
          };
          current.sync = {
            ...current.sync,
            status: 'connected',
            lastCatalogAt: at,
            lastCatalogVerifiedAt: at,
            lastCatalogCount: truth.total,
            remoteOfferCount: truth.total,
            publishedOfferCount: truth.published,
            pendingOfferCount: truth.pending + pendingCommands.length,
            rejectedOfferCount: truth.rejected,
            lastError: '',
            lastRequestId,
          };
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
          productUpdates: [...productUpdates.values()],
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
