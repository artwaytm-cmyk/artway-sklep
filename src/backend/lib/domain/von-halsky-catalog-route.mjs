import {
  preferredVonHalskyOffers,
  reconcileVonHalskyCatalog,
  resolveVonHalskyRemoteOffer,
} from './von-halsky-catalog-reconciliation.mjs';

export async function persistVonHalskyReconciliationState({
  channelState,
  products = [],
  productUpdates = [],
  timestamp = new Date().toISOString(),
  source = 'background-worker',
} = {}) {
  if (!channelState?.upsertState) return { observed: 0, receipts: 0 };
  const updates = new Map((Array.isArray(productUpdates) ? productUpdates : [])
    .map((update) => [String(update?.productId || ''), update?.fields || {}])
    .filter(([productId]) => productId));
  let observed = 0, receipts = 0;
  for (const stored of Array.isArray(products) ? products : []) {
    const productId = String(stored?.id ?? '').trim();
    if (!productId) continue;
    const product = { ...stored, ...(updates.get(productId) || {}) };
    const remoteStatus = String(product.vonHalskyRemoteStatus || '').trim().toUpperCase();
    const targetId = String(product.vonHalskyOfferId || product.inpostVonHalskyOfferId || '').trim();
    const receiptId = String(product.vonHalskyCommandId || '').trim();
    if (!remoteStatus && !targetId && !receiptId) continue;
    const confirmed = ['PUBLISHED', 'CLOSED', 'SOLDOUT', 'INACTIVE'].includes(remoteStatus);
    const failed = ['REJECTED', 'ERROR', 'DUPLICATE_MAPPING', 'NOT_FOUND'].includes(remoteStatus);
    const publicationStatus = confirmed ? (remoteStatus === 'PUBLISHED' ? 'confirmed' : 'blocked') : failed ? 'failed' : 'publishing';
    const errorText = failed ? String(product.vonHalskyEditorialSyncError || 'Kanał odrzucił albo nie odnalazł oferty.').slice(0, 2000) : '';
    await channelState.upsertState({
      productId,
      channel: 'von_halsky',
      preparationStatus: failed ? 'needs_data' : 'ready',
      publicationStatus,
      categoryId: product.vonHalskyCategoryId || '',
      targetId,
      errorCode: failed ? `von_halsky_${remoteStatus.toLowerCase()}` : '',
      errorText,
      providerConfirmedAt: confirmed ? timestamp : null,
      readbackConfirmedAt: confirmed ? timestamp : null,
      metadata: { remoteStatus, source },
    });
    observed += 1;
    const receiptStatus = confirmed ? 'readback_confirmed' : failed ? 'failed' : 'publishing';
    if (channelState?.reconcilePendingReceiptsForProduct) {
      receipts += await channelState.reconcilePendingReceiptsForProduct({
        productId,
        channel: 'von_halsky',
        targetId,
        status: receiptStatus,
        errorCode: failed ? `von_halsky_${remoteStatus.toLowerCase()}` : '',
        errorText,
        responseSummary: { readbackConfirmed: confirmed, remoteStatus, source },
        confirmedAt: confirmed ? timestamp : null,
      });
    }
    if (!receiptId || !channelState?.recordReceipt) continue;
    await channelState.recordReceipt({
      productId,
      channel: 'von_halsky',
      operation: 'publish',
      idempotencyKey: receiptId,
      providerRequestId: receiptId,
      targetId,
      status: receiptStatus,
      errorCode: failed ? `von_halsky_${remoteStatus.toLowerCase()}` : '',
      errorText,
      responseSummary: { readbackConfirmed: confirmed, remoteStatus, source },
      confirmedAt: confirmed ? timestamp : null,
    });
  }
  return { observed, receipts };
}

export function vonHalskyCreateReceipts(payload = {}) {
  const direct = Array.isArray(payload) ? payload : null;
  const nested = [
    payload?.data,
    payload?.commands,
    payload?.results,
    payload?.items,
    payload?.offers,
  ].find(Array.isArray);
  const rows = direct || nested || (payload && typeof payload === 'object' ? [payload] : []);
  return rows.filter((item) => item && typeof item === 'object').map((item) => ({
    ...item,
    commandId: String(item.commandId || item.command?.id || item.operationId || ''),
    offerId: String(item.offerId || item.offer?.id || ''),
    externalId: String(item.externalId || item.offer?.externalId || ''),
  }));
}

export function reconcileVonHalskyCommands(
  commands = [],
  remoteOffers = [],
  timestamp = new Date().toISOString(),
  graceMs = 24 * 60 * 60_000,
  minimumMissingChecks = 3,
) {
  const remote = preferredVonHalskyOffers(remoteOffers).byExternalId;
  const now = Date.parse(timestamp) || Date.now();
  return (Array.isArray(commands) ? commands : []).map((command) => {
    const offer = remote.get(String(command?.externalId || ''));
    const status = String(offer?.status || '').toUpperCase();
    let nextStatus = String(command?.status || 'PENDING').toUpperCase();
    let error = String(command?.error || '');
    if (status === 'PUBLISHED' || ['CLOSED', 'SOLDOUT', 'INACTIVE'].includes(status)) {
      nextStatus = 'SUCCESS';
      error = '';
    } else if (['REJECTED', 'ERROR'].includes(status)) {
      nextStatus = 'FAILED';
      error = [...(offer.validationErrors || []), ...(offer.rejectionReasons || [])]
        .map((item) => String(item?.validationMessage || item?.message || item?.code || '').trim())
        .filter(Boolean).join(' • ').slice(0, 800) || 'Oferta została odrzucona przez kanał.';
    } else if (['PENDING', 'PROCESSING'].includes(status)) {
      nextStatus = 'PENDING';
    } else {
      const age = now - Date.parse(String(command?.updatedAt || command?.createdAt || ''));
      const missingChecks = Math.max(0, Number(command?.missingChecks) || 0) + 1;
      const terminal = Number.isFinite(age)
        && age >= graceMs
        && missingChecks >= Math.max(1, Number(minimumMissingChecks) || 3);
      if (terminal) {
        nextStatus = 'NOT_FOUND';
        error = 'Po co najmniej trzech kontrolach i 24 godzinach oferta nie pojawiła się w katalogu API.';
      } else {
        nextStatus = 'PROVIDER_PROCESSING';
        error = '';
      }
      command = {
        ...command,
        missingChecks,
        firstMissingAt: command?.firstMissingAt || timestamp,
      };
    }
    return {
      ...command,
      status: nextStatus,
      error,
      missingChecks: status ? 0 : Math.max(0, Number(command?.missingChecks) || 0),
      firstMissingAt: status ? '' : String(command?.firstMissingAt || ''),
      remoteStatus: status || (nextStatus === 'NOT_FOUND' ? 'NOT_FOUND' : 'AWAITING_CATALOG'),
      checkedAt: timestamp,
    };
  });
}

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
    channelState,
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
      const body = await req.json().catch(() => ({}));
      const compact = body?.compact === true;
      const source = String(body?.source || (compact ? 'background-worker' : 'administrator')).slice(0, 80);
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
        const publicationState = await persistVonHalskyReconciliationState({
          channelState,
          products: list,
          productUpdates: reconciliation.productUpdates,
          timestamp,
          source,
        });
        const changedProductIds = [...new Set(
          (Array.isArray(reconciliation.productUpdates) ? reconciliation.productUpdates : [])
            .map((item) => String(item?.productId || ''))
            .filter(Boolean),
        )].slice(0, 2_000);
        let channelChanged = changedProductIds.length > 0;
        const updated = await mutate((current) => {
          const operationalSignature = (offers = [], commands = []) => JSON.stringify({
            offers: offers.map((item) => [item.offerId, item.externalId, item.status, item.validationErrors, item.rejectionReasons])
              .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
            commands: commands.map((item) => [item.commandId, item.status, item.entityId, item.type])
              .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
          });
          const beforeSignature = operationalSignature(current.offers, current.commands);
          current.offers = remoteOffers;
          current.commands = reconcileVonHalskyCommands(current.commands, remoteOffers, timestamp);
          channelChanged = channelChanged || beforeSignature !== operationalSignature(current.offers, current.commands);
          const pendingCommandCount = current.commands.filter((item) => (
            !['SUCCESS', 'FAILURE', 'FAILED', 'CANCELLED', 'NOT_FOUND'].includes(String(item?.status || 'PENDING').toUpperCase())
          )).length;
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
            pendingCommandCount,
            lastError: '',
            lastRequestId: remoteResult.requestId || '',
            reconciliationRevision: channelChanged
              ? timestamp
              : current.sync.reconciliationRevision || timestamp,
            lastReconciliationSource: source,
            lastChangedProductIds: changedProductIds,
            lastPublicationStateCount: publicationState.observed,
            lastPublicationReceiptCount: publicationState.receipts,
            reconciliationMode: config.webhookConfigured ? 'webhook_with_polling_fallback' : 'background_polling',
          };
          return current;
        });
        if (channelChanged || source !== 'background-worker') {
          await recordDiagnostic({
            operation: 'catalog-reconciliation',
            status: 'ok',
            message: `API: ${reconciliation.truth.total}; w sprzedaży: ${reconciliation.truth.published}; usunięte fałszywe powiązania: ${reconciliation.counts.staleCleared}; rozdzielone duplikaty: ${reconciliation.counts.duplicateMappings}.`,
            requestId: remoteResult.requestId || '',
          });
        }
        const payload = {
          ok: true,
          truth: reconciliation.truth,
          reconciliation: reconciliation.counts,
          changedProductIds,
          revision: updated.sync.reconciliationRevision,
          sync: updated.sync,
          schedule: {
            intervalMinutes: Math.max(15, Number(updated.settings?.syncIntervalMinutes) || 15),
            pendingIntervalMinutes: 3,
          },
        };
        if (!compact) {
          payload.offers = remoteOffers;
          payload.productUpdates = reconciliation.productUpdates;
        }
        return respond(payload);
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
      let sent = 0, created = 0, unconfirmed = 0, updatedCount = 0, closed = 0, reopened = 0, skippedNew = 0;
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
        const remoteIndex = preferredVonHalskyOffers(remoteOffers);
        const remoteForItem = (item = {}) => resolveVonHalskyRemoteOffer({
          externalId: item.externalId,
          sku: item.externalId,
          gtin: item.gtin,
          manufacturerCode: item.manufacturerCode,
          brand: item.brand,
        }, remoteIndex).offer;
        lastRequestId = remoteResult.requestId || '';
        const existing = deduplicated.items.filter((item) => remoteForItem(item));
        const createCandidates = eligible.filter((item) => !remoteForItem(item) && allowNewOffer(item));
        skippedNew = eligible.filter((item) => !remoteForItem(item) && !allowNewOffer(item)).length;

        for (const item of existing) {
          const product = productByExternalId.get(item.externalId), remote = remoteForItem(item);
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
            offerId: remoteForItem(item).offerId,
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
            offerId: remoteForItem(item).offerId,
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
          const receipts = vonHalskyCreateReceipts(result.payload);
          sent += proposals.length;
          const at = new Date().toISOString();
          const confirmedReceipts = new Map();
          for (const [productIndex, product] of activeBatchProducts.entries()) {
            const externalId = vonHalskyOfferProjection(product, state.settings).externalId;
            const receipt = receipts.find((item) => String(item?.externalId || '') === externalId) || receipts[productIndex] || {};
            const receiptId = String(receipt.commandId || receipt.offerId || '');
            if (!receiptId) {
              unconfirmed += 1;
              const error = 'API przyjęło żądanie HTTP, ale nie zwróciło identyfikatora polecenia ani oferty. Produkt nie został oznaczony jako wysłany.';
              rememberProductUpdates(await updateProductPublication([product], 'retry', {
                timestamp: at,
                error,
                nextRetryAt: new Date(Date.now() + 15 * 60_000).toISOString(),
              }));
              await progress({
                id: `editorial:${product.id}:vonHalsky:${String(product.vonHalskyEditorialSyncRunId || product.vonHalskyEditorialSyncPendingAt || Date.now()).slice(0, 64)}`,
                runId: product.vonHalskyEditorialSyncRunId, productId: String(product.id), productName: String(product.nazwa || product.name || '').slice(0, 180),
                channel: 'vonHalsky', action: 'publikacja treści w kanale', phase: 'provider_receipt_missing', status: 'failed',
                target: 'katalog InPost Von Halsky', targetRef: externalId,
                error, nextRetryAt: new Date(Date.now() + 15 * 60_000).toISOString(),
                message: error,
              });
              continue;
            }
            created += 1;
            confirmedReceipts.set(String(product.id), { ...receipt, externalId });
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
              receiptId,
              targetRef: String(receipt.offerId || externalId),
            }));
          }
          await Promise.all(activeBatchProducts.filter((product) => confirmedReceipts.has(String(product.id))).map((product) => {
            const receipt = confirmedReceipts.get(String(product.id));
            return progress({
              id: `editorial:${product.id}:vonHalsky:${String(product.vonHalskyEditorialSyncRunId || product.vonHalskyEditorialSyncPendingAt || Date.now()).slice(0, 64)}`,
              runId: product.vonHalskyEditorialSyncRunId, productId: String(product.id), productName: String(product.nazwa || product.name || '').slice(0, 180),
              channel: 'vonHalsky', action: 'publikacja treści w kanale', phase: 'accepted_by_von_halsky', status: 'running',
              target: 'katalog InPost Von Halsky', targetRef: receipt.offerId || receipt.externalId,
              receiptId: receipt.commandId || receipt.offerId,
              message: 'API przyjęło polecenie. Oferta pozostaje w weryfikacji do chwili potwierdzenia przez aktualny katalog kanału.',
            });
          }));
          activeBatchProducts = [];
        }
        const at = new Date().toISOString();
        const updated = await mutate((current) => {
          current.offers = remoteOffers;
          current.commands = mergeBy(current.commands, pendingCommands, (item) => item?.commandId).slice(0, 500);
          const pendingCommandCount = current.commands.filter((item) => (
            !['SUCCESS', 'FAILURE', 'FAILED', 'CANCELLED', 'NOT_FOUND'].includes(String(item?.status || 'PENDING').toUpperCase())
          )).length;
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
            pendingOfferCount: truth.pending,
            pendingCommandCount,
            rejectedOfferCount: truth.rejected,
            lastError: '',
            lastRequestId,
          };
          return current;
        });
        const message = `Potwierdzone przyjęcie ${created}, bez potwierdzenia ${unconfirmed}, aktualizacje ${updatedCount}, zamknięte ${closed}, wznowione ${reopened}; pominięte nowe ${skippedNew}.`;
        await recordDiagnostic({ operation: 'catalog-sync', status: 'ok', message, requestId: lastRequestId });
        return respond({
          ok: true, sent, created, accepted: created, unconfirmed, updated: updatedCount, closed, reopened, skippedNew,
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
        return respond({ ok: false, sent, created, accepted: created, unconfirmed, updated: updatedCount, closed, reopened, skippedNew, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }


    return null;
  };
}
