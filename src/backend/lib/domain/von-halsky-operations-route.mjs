export function createVonHalskyOperationsRoute(context = {}) {
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
    if (action === 'von-halsky-sync-orders') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      try {
        const body = await req.json().catch(() => ({}));
        const current = cleanState((await readVersioned(STORE_KEY, initialState())).value);
        const previousSyncAt = Date.parse(String(current.sync.lastOrdersAt || ''));
        const overlapSince = Number.isFinite(previousSyncAt)
          ? new Date(previousSyncAt - 5 * 60_000).toISOString()
          : '';
        const result = await api.fetchOrders({
          limit: body.limit || 30,
          offset: body.offset || 0,
          updatedSince: body.updatedSince || overlapSince,
          orderStatus: body.orderStatus,
          paymentStatus: body.paymentStatus,
        });
        const incoming = Array.isArray(result.payload?.data) ? result.payload.data : [];
        const merged = new Map(current.orders.map((item) => [String(item?.id || ''), item]));
        for (const order of incoming) if (order?.id) merged.set(String(order.id), order);
        const at = new Date().toISOString();
        const state = await mutate((draft) => {
          draft.orders = [...merged.values()]
            .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0))
            .slice(0, 500);
          draft.sync = { ...draft.sync, status: 'connected', lastOrdersAt: at, lastError: '', lastRequestId: result.requestId || '' };
          return draft;
        });
        await recordDiagnostic({ operation: 'orders-sync', status: 'ok', message: `Pobrano ${incoming.length} zamówień; kolejka zawiera ${state.orders.length}.`, requestId: result.requestId });
        return respond({ ok: true, fetched: incoming.length, orders: state.orders, page: result.payload?.page || null, sync: state.sync });
      } catch (error) {
        const safe = safeError(error);
        await recordDiagnostic({ operation: 'orders-sync', status: 'error', message: safe.message });
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    if (action === 'von-halsky-offer-state') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const offerId = String(body.offerId || '').trim();
      if (!/^[0-9a-f-]{36}$/i.test(offerId) || typeof body.open !== 'boolean') return respond({ ok: false, error: 'Brak prawidłowego ID oferty lub docelowego stanu.' }, 422);
      try {
        const result = await api.setOfferOpen(offerId, body.open);
        const state = await mutate((draft) => {
          draft.offers = draft.offers.map((item) => item.offerId === offerId ? { ...item, status: body.open ? 'PENDING' : 'CLOSED', updatedAt: new Date().toISOString() } : item);
          const receipt = commandReceipt(result.payload, 'offer', offerId);
          if (receipt) draft.commands = [receipt, ...draft.commands.filter((item) => item.commandId !== receipt.commandId)].slice(0, 500);
          return draft;
        });
        await recordDiagnostic({ operation: body.open ? 'offer-reopen' : 'offer-close', status: 'ok', message: `Przyjęto polecenie dla oferty ${offerId}.`, requestId: result.requestId });
        return respond({ ok: true, offerId, open: body.open, command: result.payload, offers: state.offers });
      } catch (error) {
        const safe = safeError(error);
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    if (action === 'von-halsky-order-state') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const orderId = String(body.orderId || '').trim();
      if (!orderId || typeof body.accepted !== 'boolean') return respond({ ok: false, error: 'Brak zamówienia lub decyzji.' }, 422);
      try {
        const result = await api.setOrderAccepted(orderId, body.accepted);
        const state = await mutate((draft) => {
          draft.orders = draft.orders.map((item) => String(item?.id || '') === orderId ? { ...item, status: body.accepted ? 'ACCEPTED' : 'REFUSED', updatedAt: new Date().toISOString() } : item);
          const receipt = commandReceipt(result.payload, 'order', orderId);
          if (receipt) draft.commands = [receipt, ...draft.commands.filter((item) => item.commandId !== receipt.commandId)].slice(0, 500);
          return draft;
        });
        await recordDiagnostic({ operation: body.accepted ? 'order-accept' : 'order-refuse', status: 'ok', message: `Przyjęto decyzję dla zamówienia ${orderId}.`, requestId: result.requestId });
        return respond({ ok: true, orderId, accepted: body.accepted, command: result.payload, orders: state.orders });
      } catch (error) {
        const safe = safeError(error);
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    if (action === 'von-halsky-post-sales-sync') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      try {
        const body = await req.json().catch(() => ({}));
        const [returnsResult, claimsResult] = await Promise.all([
          api.fetchReturns({ limit: body.limit || 30, offset: body.offset || 0 }),
          api.fetchClaims({ limit: body.limit || 30, offset: body.offset || 0, state: body.state }),
        ]);
        const incomingReturns = Array.isArray(returnsResult.payload?.data) ? returnsResult.payload.data : [];
        const incomingClaims = Array.isArray(claimsResult.payload?.items)
          ? claimsResult.payload.items
          : Array.isArray(claimsResult.payload?.data) ? claimsResult.payload.data : [];
        const state = await mutate((draft) => {
          draft.returns = mergeBy(draft.returns, incomingReturns)
            .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0))
            .slice(0, 500);
          draft.claims = mergeBy(draft.claims, incomingClaims, (item) => item?.claimId || item?.id)
            .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0))
            .slice(0, 500);
          return draft;
        });
        await recordDiagnostic({
          operation: 'post-sales-sync',
          status: 'ok',
          message: `Pobrano zwroty ${incomingReturns.length}, reklamacje ${incomingClaims.length}.`,
          requestId: claimsResult.requestId || returnsResult.requestId,
        });
        return respond({ ok: true, returns: state.returns, claims: state.claims });
      } catch (error) {
        const safe = safeError(error);
        await recordDiagnostic({ operation: 'post-sales-sync', status: 'error', message: safe.message });
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    if (action === 'von-halsky-return-state') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const returnId = matchingText(body.returnId, 160);
      if (!returnId || typeof body.accepted !== 'boolean') return respond({ ok: false, error: 'Brak zwrotu lub decyzji.' }, 422);
      try {
        const result = await api.decideReturn(returnId, body.accepted);
        const state = await mutate((draft) => {
          draft.returns = draft.returns.map((item) => String(item?.id || '') === returnId
            ? { ...item, status: body.accepted ? 'ACCEPTED' : 'REJECTED', updatedAt: new Date().toISOString() }
            : item);
          return draft;
        });
        await recordDiagnostic({ operation: body.accepted ? 'return-accept' : 'return-reject', status: 'ok', message: `Zapisano decyzję zwrotu ${returnId}.`, requestId: result.requestId });
        return respond({ ok: true, returns: state.returns, result: result.payload });
      } catch (error) {
        const safe = safeError(error);
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    if (action === 'von-halsky-order-refund') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const orderId = matchingText(body.orderId, 180);
      const amount = Number(body.amount);
      if (!orderId || !Number.isFinite(amount) || amount <= 0) return respond({ ok: false, error: 'Brak zamówienia lub poprawnej kwoty refundacji.' }, 422);
      try {
        const result = await api.refundOrder(orderId, amount);
        await recordDiagnostic({ operation: 'order-refund', status: 'ok', message: `Przyjęto refundację zamówienia ${orderId}.`, requestId: result.requestId });
        return respond({ ok: true, orderId, result: result.payload });
      } catch (error) {
        const safe = safeError(error);
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    if (action === 'von-halsky-claim-state') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const orderId = matchingText(body.orderId, 180);
      const claimId = matchingText(body.claimId, 160);
      const resolution = matchingText(body.resolution, 40);
      const description = matchingText(body.description, 1000);
      if (!orderId || !claimId || !['reject', 'partial-refund', 'refund'].includes(resolution)) {
        return respond({ ok: false, error: 'Brak reklamacji lub prawidłowego rozstrzygnięcia.' }, 422);
      }
      try {
        const result = await api.resolveClaim(orderId, claimId, resolution, description);
        const resolutionStatus = resolution === 'reject' ? 'REJECTED' : 'APPROVED';
        const resolutionName = resolution === 'reject' ? 'REJECTED' : resolution === 'partial-refund' ? 'PARTIAL_REFUND' : 'REFUND';
        const state = await mutate((draft) => {
          draft.claims = draft.claims.map((item) => String(item?.claimId || item?.id || '') === claimId
            ? { ...item, state: resolutionStatus, resolution: resolutionName, updatedAt: new Date().toISOString() }
            : item);
          return draft;
        });
        await recordDiagnostic({ operation: `claim-${resolution}`, status: 'ok', message: `Rozstrzygnięto reklamację ${claimId}.`, requestId: result.requestId });
        return respond({ ok: true, claims: state.claims, result: result.payload });
      } catch (error) {
        const safe = safeError(error);
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    if (action === 'von-halsky-events-sync') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      try {
        const body = await req.json().catch(() => ({}));
        const [offerResult, orderResult] = await Promise.all([
          api.fetchOfferEvents({ limit: body.limit || 30, offset: body.offset || 0, occurredAtGte: body.occurredAtGte }),
          api.fetchOrderEvents({ limit: body.limit || 30, offset: body.offset || 0, occurredAtGte: body.occurredAtGte }),
        ]);
        const offerEvents = (Array.isArray(offerResult.payload?.data) ? offerResult.payload.data : []).map((item) => ({ ...item, channelType: 'offer' }));
        const orderEvents = (Array.isArray(orderResult.payload?.data) ? orderResult.payload.data : []).map((item) => ({ ...item, channelType: 'order' }));
        const state = await mutate((draft) => {
          draft.events = mergeBy(draft.events, [...offerEvents, ...orderEvents])
            .sort((a, b) => Date.parse(b.occurredAt || 0) - Date.parse(a.occurredAt || 0))
            .slice(0, 1000);
          return draft;
        });
        return respond({ ok: true, events: state.events });
      } catch (error) {
        const safe = safeError(error);
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    if (action === 'von-halsky-command-status') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const commandId = matchingText(body.commandId, 160);
      const type = matchingText(body.type, 20);
      if (!commandId || !['offer', 'order'].includes(type)) return respond({ ok: false, error: 'Brak polecenia lub jego typu.' }, 422);
      try {
        const result = type === 'offer' ? await api.getOfferCommand(commandId) : await api.getOrderCommand(commandId);
        const state = await mutate((draft) => {
          const existing = draft.commands.find((item) => item.commandId === commandId) || {};
          const updated = { ...existing, commandId, type, status: matchingText(result.payload?.status || 'PENDING', 40), updatedAt: new Date().toISOString() };
          draft.commands = [updated, ...draft.commands.filter((item) => item.commandId !== commandId)].slice(0, 500);
          return draft;
        });
        return respond({ ok: true, command: state.commands.find((item) => item.commandId === commandId), result: result.payload });
      } catch (error) {
        const safe = safeError(error);
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    if (action === 'von-halsky-offer-attachments') {
      const offerId = matchingText(url.searchParams.get('offerId'), 160);
      if (!offerId) return respond({ ok: false, error: 'Brak ID oferty.' }, 422);
      try {
        if (req.method === 'GET') {
          const result = await api.listOfferAttachments(offerId);
          return respond({ ok: true, attachments: result.payload?.data || result.payload || [] });
        }
        if (req.method === 'DELETE') {
          const attachmentId = matchingText(url.searchParams.get('attachmentId'), 160);
          if (!attachmentId) return respond({ ok: false, error: 'Brak ID załącznika.' }, 422);
          await api.deleteOfferAttachment(offerId, attachmentId);
          return respond({ ok: true });
        }
        return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      } catch (error) {
        const safe = safeError(error);
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    if (action === 'von-halsky-connection-check') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const config = vonHalskyPublicConfig(env());
      if (!config.configured) return respond({
        ok: false,
        connected: false,
        mode: 'api',
        config,
        missingEnv: config.missingEnv,
        error: 'Brakuje danych lub dokładnych ścieżek z prywatnego kontraktu API wydanego w Portalu Merchanta InPost Von Halsky.',
        code: 'von_halsky_not_configured',
      }, 503);
      try {
        const result = await api.checkConnection();
        const state = await mutate((current) => {
          current.sync = { ...current.sync, status: 'connected', lastConnectionAt: result.checkedAt, lastError: '', lastRequestId: result.requestId || '' };
          current.settings.onboarding = { ...current.settings.onboarding, technicalDocs: true, catalogConnection: true };
          return current;
        });
        await recordDiagnostic({ operation: 'connection-check', status: 'ok', message: 'Autoryzacja i endpoint kontrolny odpowiedziały poprawnie.', requestId: result.requestId });
        return respond({ ok: true, connected: true, mode: 'api', config, result, sync: state.sync });
      } catch (error) {
        const safe = safeError(error);
        await mutate((current) => {
          current.sync = { ...current.sync, status: 'error', lastError: safe.message, lastRequestId: String(safe.details?.requestId || '') };
          return current;
        });
        await recordDiagnostic({
          operation: 'connection-check',
          status: 'error',
          message: safe.message,
          requestId: String(safe.details?.requestId || ''),
        });
        return respond({ ok: false, connected: false, mode: 'api', config, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }


    return null;
  };
}
