import {
  mergeVonHalskyOrderWithLocalState,
  vonHalskyOrderToInpostOrder,
  vonHalskyShipmentOptions,
  vonHalskyShippingDraft,
  vonHalskyShipmentLinked,
  vonHalskyShipmentView,
} from './von-halsky-order-shipment.mjs';
import {
  renderVonHalskyOrderMessage,
  validateVonHalskyOrderMessage,
  vonHalskyOrderCommunicationHistory,
  vonHalskyOrderCommunicationView,
} from './von-halsky-order-communication.mjs';

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
    inpost = null,
    coordinateWarehouseOrders = null,
    inspectWarehouseOrders = null,
    draftMessageWithAgent = null,
    sendEmail = null,
    emailPublicConfig = () => ({ configured: false }),
  } = context;

  const localOrder = async (orderId) => {
    const state = cleanState((await readVersioned(STORE_KEY, initialState())).value);
    return state.orders.find((item) => String(item?.id || '') === String(orderId || '')) || null;
  };
  const relatedAfterSales = async (orderId) => {
    const state = cleanState((await readVersioned(STORE_KEY, initialState())).value);
    const belongsToOrder = (item) => String(
      item?.relatedOrder?.orderId || item?.orderId || item?.order?.id || '',
    ) === String(orderId || '');
    const returns = state.returns.filter(belongsToOrder);
    const claims = state.claims.filter(belongsToOrder);
    return {
      returns,
      claims,
      open: [
        ...returns.filter((item) => !['REJECTED', 'COMPLETED'].includes(String(item?.status || item?.state || '').toUpperCase())),
        ...claims.filter((item) => !['APPROVED', 'REJECTED', 'COMPLETED'].includes(String(item?.state || item?.status || '').toUpperCase())),
      ].length,
    };
  };
  const saveOrder = async (orderId, nextOrder) => mutate((draft) => {
    draft.orders = draft.orders.map((item) => String(item?.id || '') === String(orderId) ? nextOrder : item);
    return draft;
  });
  const refreshOrderShipment = async (existing) => {
    if (!existing) return null;
    const inpostId = matchingText(existing?._artwayShipment?.inpostId, 80);
    const [remoteOrderResult, shipmentResult] = await Promise.allSettled([
      api.getOrder(existing.id),
      inpostId && inpost?.call
        ? inpost.call(`/v1/shipments/${encodeURIComponent(inpostId)}`, { method: 'GET' })
        : Promise.resolve(null),
    ]);
    const remoteOrder = remoteOrderResult.status === 'fulfilled'
      ? remoteOrderResult.value?.payload?.data || remoteOrderResult.value?.payload || existing
      : existing;
    const nextOrder = mergeVonHalskyOrderWithLocalState(existing, remoteOrder);
    const shipmentData = shipmentResult.status === 'fulfilled' ? shipmentResult.value : null;
    if (inpostId && shipmentData) {
      const trackingNumber = inpost.trackingNumber(shipmentData) || existing._artwayShipment?.trackingNumber || '';
      const linked = vonHalskyShipmentLinked(nextOrder, trackingNumber, inpostId);
      nextOrder._artwayShipment = {
        ...existing._artwayShipment,
        trackingNumber,
        status: inpost.shipmentStatus(shipmentData) || existing._artwayShipment?.status || '',
        labelReady: inpost.labelReady(shipmentData) || existing._artwayShipment?.labelReady === true,
        vonHalskyLinked: linked,
        linkedAt: linked ? existing._artwayShipment?.linkedAt || new Date().toISOString() : '',
        checkedAt: new Date().toISOString(),
      };
    }
    await saveOrder(existing.id, nextOrder);
    return nextOrder;
  };
  const requireInpost = () => {
    if (!inpost || typeof inpost.configure !== 'function' || typeof inpost.call !== 'function') {
      const error = new Error('Usługa InPost nie jest dostępna w tym procesie serwera.');
      error.code = 'inpost_service_unavailable'; error.status = 503; throw error;
    }
    const config = inpost.configure();
    if (!config?.configured) {
      const error = new Error('InPost nie jest skonfigurowany po stronie serwera.');
      error.code = 'inpost_not_configured'; error.status = 503; throw error;
    }
    return config;
  };
  const coordinateWarehouse = async (orders = []) => {
    if (typeof coordinateWarehouseOrders !== 'function') return null;
    try {
      return await coordinateWarehouseOrders(Array.isArray(orders) ? orders : [orders]);
    } catch (error) {
      return {
        ok: false,
        pendingRetry: true,
        code: matchingText(error?.code || 'von_halsky_warehouse_pending', 80),
        error: matchingText(error?.message || 'Nie udało się uzgodnić magazynu i Planu zatowarowania.', 300),
      };
    }
  };
  const inspectWarehouse = async (orders = []) => {
    if (typeof inspectWarehouseOrders !== 'function') return null;
    try {
      return await inspectWarehouseOrders(Array.isArray(orders) ? orders : [orders]);
    } catch (error) {
      return {
        ok: false,
        readOnly: true,
        code: matchingText(error?.code || 'von_halsky_warehouse_read_failed', 80),
        error: matchingText(error?.message || 'Nie udało się odczytać danych magazynu.', 300),
      };
    }
  };

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
        for (const order of incoming) if (order?.id) {
          const key = String(order.id), previous = merged.get(key);
          merged.set(key, mergeVonHalskyOrderWithLocalState(previous, order));
        }
        const at = new Date().toISOString();
        const state = await mutate((draft) => {
          draft.orders = [...merged.values()]
            .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0))
            .slice(0, 500);
          draft.sync = { ...draft.sync, status: 'connected', lastOrdersAt: at, lastError: '', lastRequestId: result.requestId || '' };
          return draft;
        });
        await recordDiagnostic({ operation: 'orders-sync', status: 'ok', message: `Pobrano ${incoming.length} zamówień; kolejka zawiera ${state.orders.length}.`, requestId: result.requestId });
        const warehouse = await coordinateWarehouse(state.orders);
        return respond({ ok: true, fetched: incoming.length, orders: state.orders, page: result.payload?.page || null, sync: state.sync, warehouse });
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

    if (action === 'von-halsky-offer-resume') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const offerId = String(body.offerId || '').trim();
      if (!/^[0-9a-f-]{36}$/i.test(offerId)) return respond({ ok: false, error: 'Brak prawidłowego ID oferty.' }, 422);
      try {
        const current = cleanState((await readVersioned(STORE_KEY, initialState())).value);
        const remoteResult = await api.getOffer(offerId);
        const remote = remoteResult.payload?.data || remoteResult.payload || current.offers.find((item) => String(item?.offerId || '') === offerId) || {};
        const remoteStatus = String(remote.status || remote.offerStatus || '').toUpperCase();
        const products = await loadCatalog();
        const externalId = String(remote.externalId || remote.sku || '').trim();
        const product = products.find((item) => String(item?.vonHalskyOfferId || '') === offerId)
          || products.find((item) => externalId && [item?.externalId, item?.sku, item?.id].some((value) => String(value || '') === externalId));
        if (!product) return respond({ ok: false, error: 'Nie znaleziono centralnej kartoteki przypisanej do tej oferty. Wykonaj uzgodnienie katalogu.', code: 'von_halsky_product_not_found' }, 404);
        const projection = vonHalskyOfferProjection(product, current.settings);
        if (!projection.available || projection.stock <= 0) {
          return respond({ ok: false, error: 'Produkt nie jest dostępny w centralnej kartotece. Najpierw popraw jego dostępność lub stan magazynowy.', code: 'von_halsky_product_unavailable' }, 422);
        }
        const stockResult = await api.updateStocks([{ offerId, stock: { quantity: projection.stock, unit: 'UNIT' } }]);
        let openResult = null;
        // Zgodnie z UC6 API Von Halsky stan SOLDOUT wraca do sprzedaży przez
        // PATCH stanu. Polecenie reopen służy wyłącznie ofertom zamkniętym.
        if (['CLOSED', 'INACTIVE'].includes(remoteStatus)) openResult = await api.setOfferOpen(offerId, true);
        const state = await mutate((draft) => {
          draft.offers = draft.offers.map((item) => String(item?.offerId || '') === offerId
            ? { ...item, status: 'PENDING', requestedStock: projection.stock, updatedAt: new Date().toISOString() }
            : item);
          for (const result of [stockResult, openResult].filter(Boolean)) {
            const receipt = commandReceipt(result.payload, 'offer', offerId);
            if (receipt) draft.commands = [receipt, ...draft.commands.filter((item) => item.commandId !== receipt.commandId)].slice(0, 500);
          }
          return draft;
        });
        await recordDiagnostic({ operation: 'offer-resume', status: 'ok', message: `Oferta ${offerId}: ustawiono ${projection.stock} szt.; poprzedni stan ${remoteStatus || 'nieznany'}.`, requestId: openResult?.requestId || stockResult.requestId });
        return respond({ ok: true, offerId, previousStatus: remoteStatus, quantity: projection.stock, mode: remoteStatus === 'SOLDOUT' ? 'stock-update' : 'stock-update-and-reopen', offers: state.offers });
      } catch (error) {
        const safe = safeError(error);
        await recordDiagnostic({ operation: 'offer-resume', status: 'error', message: safe.message });
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
        const warehouse = await coordinateWarehouse(state.orders);
        return respond({ ok: true, orderId, accepted: body.accepted, command: result.payload, orders: state.orders, warehouse });
      } catch (error) {
        const safe = safeError(error);
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    if (action === 'von-halsky-order-shipment-preview') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const orderId = matchingText(url.searchParams.get('orderId'), 180);
      if (!orderId) return respond({ ok: false, error: 'Brak ID zamówienia.' }, 422);
      try {
        const existing = await localOrder(orderId);
        if (!existing) return respond({ ok: false, error: 'Nie znaleziono zamówienia. Pobierz aktualne zamówienia z API.', code: 'von_halsky_order_not_found' }, 404);
        // Zwykłe otwarcie karty jest szybkim, czystym odczytem. Zdalne API
        // odświeżamy wyłącznie po świadomym żądaniu operatora.
        const order = url.searchParams.get('refresh') === '1'
          ? await refreshOrderShipment(existing)
          : existing;
        const mapped = vonHalskyOrderToInpostOrder(order);
        const validation = inpost?.validateShipment ? inpost.validateShipment(mapped) : { ok: false, errors: [{ message: 'Usługa InPost nie jest dostępna.' }] };
        const config = inpost?.configure ? inpost.configure() : { configured: false, missingEnv: ['INPOST_TOKEN', 'INPOST_ORG_ID'] };
        const [warehouse, afterSales] = await Promise.all([
          inspectWarehouse([order]),
          relatedAfterSales(orderId),
        ]);
        return respond({
          ok: true,
          order,
          shipment: vonHalskyShipmentView(order),
          communication: vonHalskyOrderCommunicationView(order, emailPublicConfig()),
          afterSales,
          warehouse,
          shipping: {
            configured: config.configured === true,
            missingEnv: config.missingEnv || [],
            deliveryType: order.delivery?.deliveryType || '',
            deliveryPoint: order.delivery?.deliveryPoint || '',
            reference: orderId,
            validation,
            defaults: { gabaryt: 'medium', sposobNadania: config.sendingMethod || 'parcel_locker' },
            draft: vonHalskyShippingDraft(mapped),
          },
        });
      } catch (error) {
        const safe = safeError(error);
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    if (action === 'von-halsky-order-message-draft') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const orderId = matchingText(body.orderId, 180);
      if (!orderId) return respond({ ok: false, error: 'Brak ID zamówienia.' }, 422);
      if (typeof draftMessageWithAgent !== 'function') return respond({ ok: false, error: 'Kreator Agenta nie jest dostępny.', code: 'agent_draft_unavailable' }, 503);
      try {
        const order = await localOrder(orderId);
        if (!order) return respond({ ok: false, error: 'Nie znaleziono zamówienia.', code: 'von_halsky_order_not_found' }, 404);
        const lines = Array.isArray(order.orderLines) ? order.orderLines : [];
        const stage = vonHalskyShipmentView(order).stage;
        const context = {
          channel: 'InPost Von Halsky',
          order: {
            id: orderId,
            status: matchingText(order.status, 80),
            fulfillment: matchingText(stage?.label, 100),
            trackingNumber: matchingText(order?._artwayShipment?.trackingNumber || order?.delivery?.parcels?.[0]?.trackingNumber, 180),
            deliveryType: matchingText(order?.delivery?.deliveryType, 80),
            deliveryPoint: matchingText(order?.delivery?.deliveryPoint, 100),
            customerFirstName: matchingText(order?.customer?.firstName, 80),
            total: order?.finalPrice?.amount ?? order?.total?.amount ?? null,
            currency: matchingText(order?.finalPrice?.currency || order?.total?.currency || 'PLN', 12),
            paymentStatus: matchingText(order?.paymentDetails?.status || order?.payment?.status, 80),
            products: lines.slice(0, 30).map((line) => ({
              name: matchingText(line?.offer?.product?.name || line?.offer?.name || line?.product?.name || line?.name, 180),
              quantity: Math.max(1, Number(line?.quantity) || 1),
              price: line?.finalPrice?.amount ?? line?.price?.amount ?? line?.offer?.price?.amount ?? null,
            })),
          },
          currentDraft: {
            subject: matchingText(body.subject, 180),
            message: matchingText(body.message, 5000),
          },
          tone: matchingText(body.tone || 'profesjonalny i konkretny', 80),
        };
        const run = await draftMessageWithAgent({
          specialist: 'customer_reply',
          source: 'manual',
          instruction: matchingText(body.instruction || 'Przygotuj profesjonalną wiadomość dotyczącą tego zamówienia. Używaj wyłącznie potwierdzonych faktów. Nie obiecuj niepotwierdzonego terminu, wysyłki ani zwrotu. Zwróć tylko szkic do zatwierdzenia.', 1200),
          context,
          target: { type: 'von-halsky-order-message', orderId },
        }, sessionOf?.(req) || {});
        const result = run?.result && typeof run.result === 'object' ? run.result : {};
        const fields = Array.isArray(result.fields) ? result.fields : [];
        const fieldValue = (...keys) => {
          const wanted = new Set(keys.map((value) => String(value).toLowerCase()));
          const found = fields.find((field) => wanted.has(String(field?.key || field?.name || '').toLowerCase()));
          return matchingText(found?.value ?? found?.proposedValue, 5000);
        };
        const subject = fieldValue('subject', 'reply_subject') || matchingText(result.subject || body.subject || `Zamówienie ${orderId} — Artway-TM`, 180);
        const message = fieldValue('reply', 'reply_body', 'message') || matchingText(result.content || result.reply || body.message, 5000);
        const validation = validateVonHalskyOrderMessage({ order, subject, message });
        if (!validation.ok) return respond({ ok: false, error: validation.errors.map((item) => item.message).join(' '), code: 'agent_draft_invalid', details: validation.errors }, 422);
        return respond({
          ok: true,
          draft: { subject: validation.subject, message: validation.message },
          agent: { runId: matchingText(run?.id || run?.runId, 180), model: matchingText(run?.model, 100), cached: run?.cached === true },
          draftOnly: true,
          sentExternally: false,
        });
      } catch (error) {
        const safe = safeError(error);
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    if (action === 'von-halsky-order-message-send') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const orderId = matchingText(body.orderId, 180);
      const requestId = matchingText(body.requestId, 120);
      if (!orderId || body.confirmed !== true) return respond({ ok: false, error: 'Potwierdź wysłanie wiadomości dla właściwego zamówienia.', code: 'message_confirmation_required' }, 422);
      if (!/^[a-z0-9][a-z0-9._:-]{7,119}$/i.test(requestId)) return respond({ ok: false, error: 'Brak prawidłowego identyfikatora wysyłki.', code: 'message_request_id' }, 422);
      try {
        if (typeof sendEmail !== 'function' || emailPublicConfig()?.configured !== true) {
          return respond({ ok: false, error: 'Poczta sklepu nie jest skonfigurowana do wysyłki.', code: 'email_not_configured' }, 503);
        }
        const currentOrder = await localOrder(orderId);
        if (!currentOrder) return respond({ ok: false, error: 'Nie znaleziono zamówienia.', code: 'von_halsky_order_not_found' }, 404);
        const rendered = renderVonHalskyOrderMessage({ order: currentOrder, subject: body.subject, message: body.message });
        const previous = vonHalskyOrderCommunicationHistory(currentOrder).find((item) => item.requestId === requestId && item.status === 'sent');
        if (previous) return respond({ ok: true, sent: true, idempotent: true, message: previous, communication: vonHalskyOrderCommunicationView(currentOrder, emailPublicConfig()) });

        const now = new Date().toISOString();
        const lockId = `vhmail:${requestId}`;
        await mutate((draft) => {
          const index = draft.orders.findIndex((item) => String(item?.id || '') === orderId);
          if (index < 0) return null;
          const order = draft.orders[index], communication = order._artwayCommunication && typeof order._artwayCommunication === 'object' ? order._artwayCommunication : {};
          const history = vonHalskyOrderCommunicationHistory(order);
          if (history.some((item) => item.requestId === requestId && item.status === 'sent')) return null;
          const lock = communication.sendLock || {}, lockAge = Date.now() - Date.parse(lock.startedAt || 0);
          if (lock.id && Number.isFinite(lockAge) && lockAge < 5 * 60_000) {
            const error = new Error(lock.id === lockId ? 'Ta wiadomość jest już wysyłana.' : 'Inna wiadomość dla tego zamówienia jest właśnie wysyłana.');
            error.code = 'von_halsky_message_busy'; error.status = 409; throw error;
          }
          draft.orders[index] = { ...order, _artwayCommunication: { ...communication, sendLock: { id: lockId, requestId, startedAt: now } } };
          return draft;
        });

        let result;
        try {
          result = await sendEmail({ to: rendered.to, subject: rendered.subject, text: rendered.text, html: rendered.html });
          const recipient = rendered.to.trim().toLowerCase();
          const accepted = (Array.isArray(result?.accepted) ? result.accepted : [])
            .map((value) => matchingText(value, 240).trim().toLowerCase());
          const rejected = (Array.isArray(result?.rejected) ? result.rejected : [])
            .map((value) => matchingText(value, 240).trim().toLowerCase());
          if (!accepted.includes(recipient) || rejected.includes(recipient)) {
            const error = new Error('Serwer pocztowy nie przyjął adresu odbiorcy. Wiadomość nie została oznaczona jako wysłana.');
            error.code = 'email_recipient_not_accepted'; error.status = 502; throw error;
          }
        } catch (error) {
          await mutate((draft) => {
            const index = draft.orders.findIndex((item) => String(item?.id || '') === orderId);
            if (index < 0) return null;
            const order = draft.orders[index], communication = order._artwayCommunication || {}, history = vonHalskyOrderCommunicationHistory(order);
            draft.orders[index] = { ...order, _artwayCommunication: { ...communication, sendLock: null, history: [...history, { id: `VHMSG-${Date.now()}`, requestId, status: 'failed', to: rendered.to, subject: rendered.subject, message: rendered.message, template: matchingText(body.template || 'custom', 40), createdAt: now, error: matchingText(error?.message || error, 300) }].slice(-100) } };
            return draft;
          });
          throw error;
        }

        const actor = matchingText(sessionOf(req)?.email || 'administrator', 200);
        const sentAt = new Date().toISOString();
        let savedOrder = currentOrder, savedMessage = null;
        await mutate((draft) => {
          const index = draft.orders.findIndex((item) => String(item?.id || '') === orderId);
          if (index < 0) return null;
          const order = draft.orders[index], communication = order._artwayCommunication || {}, history = vonHalskyOrderCommunicationHistory(order).filter((item) => item.requestId !== requestId || item.status === 'sent');
          savedMessage = {
            id: `VHMSG-${Date.now()}`,
            requestId,
            status: 'sent',
            deliveryStatus: 'accepted_by_server',
            deliveryConfirmed: false,
            channel: 'email',
            to: rendered.to,
            subject: rendered.subject,
            message: rendered.message,
            template: matchingText(body.template || 'custom', 40),
            sentAt,
            sentBy: actor,
            provider: matchingText(result?.provider || 'smtp', 40),
            messageId: matchingText(result?.message_id, 240),
            serverResponse: matchingText(result?.response, 500),
          };
          savedOrder = { ...order, _artwayCommunication: { ...communication, sendLock: null, history: [...history, savedMessage].slice(-100) } };
          draft.orders[index] = savedOrder;
          return draft;
        });
        await recordDiagnostic({ operation: 'order-email-send', status: 'ok', message: `Serwer pocztowy przyjął wiadomość dotyczącą zamówienia ${orderId}.` });
        return respond({ ok: true, sent: true, idempotent: false, message: savedMessage, communication: vonHalskyOrderCommunicationView(savedOrder, emailPublicConfig()) });
      } catch (error) {
        const safe = safeError(error);
        await recordDiagnostic({ operation: 'order-email-send', status: 'error', message: safe.message });
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    if (action === 'von-halsky-order-shipment-create') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const orderId = matchingText(body.orderId, 180);
      if (!orderId || body.confirmed !== true) return respond({ ok: false, error: 'Potwierdź utworzenie przesyłki dla właściwego zamówienia.' }, 422);
      try {
        const existing = await localOrder(orderId);
        if (!existing) return respond({ ok: false, error: 'Nie znaleziono zamówienia. Pobierz aktualne zamówienia z API.', code: 'von_halsky_order_not_found' }, 404);
        const replacement = body.replaceExisting === true;
        if (existing._artwayShipment?.inpostId && !replacement) {
          const warehouse = await coordinateWarehouse([existing]);
          return respond({ ok: true, created: false, idempotent: true, order: existing, shipment: vonHalskyShipmentView(existing), warehouse });
        }
        if (existing._artwayShipment?.inpostId && replacement && body.replacementConfirmed !== true) {
          return respond({ ok: false, error: 'Potwierdź utworzenie dodatkowej płatnej przesyłki korekcyjnej. Poprzednia etykieta pozostanie w InPost.', code: 'replacement_confirmation_required' }, 422);
        }
        const remoteResult = await api.getOrder(orderId);
        const remoteOrder = remoteResult.payload?.data || remoteResult.payload || existing;
        const order = mergeVonHalskyOrderWithLocalState(existing, remoteOrder);
        const orderStatus = String(order.status || '').toUpperCase();
        if (!['ACCEPTED', 'PROCESSING', 'READY'].includes(orderStatus)) {
          return respond({ ok: false, error: `Zamówienie ma status ${orderStatus || 'nieznany'}. Przesyłkę można utworzyć po przyjęciu zamówienia.`, code: 'von_halsky_order_not_accepted' }, 409);
        }
        const config = requireInpost();
        const options = vonHalskyShipmentOptions(body);
        const mapped = vonHalskyOrderToInpostOrder(order, options);
        const validation = inpost.validateShipment(mapped);
        if (!validation.ok) return respond({ ok: false, error: 'Uzupełnij dane wymagane do nadania InPost.', code: 'inpost_validation', details: validation.errors }, 422);
        const organization = await inpost.organization(config);
        const availability = inpost.serviceAvailability(config, organization);
        const type = validation.doPaczkomatu ? 'locker' : 'courier';
        if (availability?.services?.length && !availability[type]) {
          return respond({ ok: false, error: 'Konto InPost nie ma aktywnej usługi wymaganej dla tego zamówienia.', code: 'inpost_service_unavailable' }, 422);
        }
        const activeConfig = { ...config, lockerService: availability.lockerService || config.lockerService, courierService: availability.courierService || config.courierService };
        const payload = inpost.shipmentPayload(mapped, activeConfig, validation);
        // Najważniejsze powiązanie dokumentacyjne: reference jest dokładnym ID
        // zamówienia Von Halsky. Po tym InPost automatycznie dopisuje parcelę.
        payload.reference = orderId;
        const created = await inpost.call(`/v1/organizations/${encodeURIComponent(config.orgId)}/shipments`, { method: 'POST', bodyObj: payload });
        const inpostId = matchingText(created?.id, 80);
        if (!inpostId) throw Object.assign(new Error('ShipX nie zwrócił ID utworzonej przesyłki.'), { code: 'inpost_missing_shipment_id', status: 502 });
        let shipmentData = created;
        try { shipmentData = await inpost.waitForLabel(inpostId, { proby: 8, opoznienieMs: 900 }); } catch { shipmentData = created; }
        const trackingNumber = inpost.trackingNumber(shipmentData) || inpost.trackingNumber(created);
        const createdAt = new Date().toISOString();
        let savedOrder = {
          ...order,
          _artwayShipmentHistory: replacement && order._artwayShipment?.inpostId
            ? [...(Array.isArray(order._artwayShipmentHistory) ? order._artwayShipmentHistory : []), order._artwayShipment].slice(-10)
            : (Array.isArray(order._artwayShipmentHistory) ? order._artwayShipmentHistory : []),
          _artwayShipment: {
            inpostId,
            trackingNumber,
            status: inpost.shipmentStatus(shipmentData) || inpost.shipmentStatus(created),
            labelReady: inpost.labelReady(shipmentData) || inpost.labelReady(created),
            reference: orderId,
            vonHalskyLinked: false,
            createdAt,
            checkedAt: createdAt,
            configuration: vonHalskyShippingDraft(mapped),
            replacementOf: replacement ? matchingText(order._artwayShipment?.inpostId, 80) : '',
          },
        };
        await saveOrder(orderId, savedOrder);
        try {
          const checked = await api.getOrder(orderId);
          const checkedOrder = checked.payload?.data || checked.payload || order;
          const linked = vonHalskyShipmentLinked(checkedOrder, trackingNumber, inpostId);
          savedOrder = mergeVonHalskyOrderWithLocalState(savedOrder, checkedOrder);
          savedOrder._artwayShipment = { ...savedOrder._artwayShipment, vonHalskyLinked: linked, linkedAt: linked ? new Date().toISOString() : '', checkedAt: new Date().toISOString() };
          await saveOrder(orderId, savedOrder);
        } catch { /* przesyłka jest zapisana; powiązanie można sprawdzić ponownie */ }
        await recordDiagnostic({ operation: replacement ? 'order-shipment-replace' : 'order-shipment-create', status: 'ok', message: `Przesyłka ${inpostId} dla zamówienia ${orderId}; tracking ${trackingNumber || 'oczekuje'}.` });
        const warehouse = await coordinateWarehouse([savedOrder]);
        return respond({ ok: true, created: true, replacement, order: savedOrder, shipment: vonHalskyShipmentView(savedOrder), warehouse }, 201);
      } catch (error) {
        const safe = safeError(error);
        await recordDiagnostic({ operation: 'order-shipment-create', status: 'error', message: safe.message });
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    if (action === 'von-halsky-order-shipment-status') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const orderId = matchingText(body.orderId, 180);
      try {
        const existing = await localOrder(orderId);
        const inpostId = matchingText(existing?._artwayShipment?.inpostId, 80);
        if (!existing || !inpostId) return respond({ ok: false, error: 'To zamówienie nie ma jeszcze przesyłki InPost.', code: 'no_shipment' }, 404);
        requireInpost();
        const [shipmentData, remoteResult] = await Promise.all([
          inpost.call(`/v1/shipments/${encodeURIComponent(inpostId)}`, { method: 'GET' }),
          api.getOrder(orderId),
        ]);
        const remoteOrder = remoteResult.payload?.data || remoteResult.payload || existing;
        const trackingNumber = inpost.trackingNumber(shipmentData) || existing._artwayShipment.trackingNumber || '';
        const linked = vonHalskyShipmentLinked(remoteOrder, trackingNumber, inpostId);
        const nextOrder = mergeVonHalskyOrderWithLocalState(existing, remoteOrder);
        nextOrder._artwayShipment = {
          ...existing._artwayShipment,
          trackingNumber,
          status: inpost.shipmentStatus(shipmentData),
          labelReady: inpost.labelReady(shipmentData),
          vonHalskyLinked: linked,
          linkedAt: linked ? existing._artwayShipment.linkedAt || new Date().toISOString() : '',
          checkedAt: new Date().toISOString(),
        };
        await saveOrder(orderId, nextOrder);
        const mapped = vonHalskyOrderToInpostOrder(nextOrder);
        const warehouse = await coordinateWarehouse([nextOrder]);
        return respond({
          ok: true,
          order: nextOrder,
          shipment: vonHalskyShipmentView(nextOrder),
          warehouse,
          shipping: {
            configured: true,
            validation: inpost.validateShipment(mapped),
            draft: vonHalskyShippingDraft(mapped),
          },
        });
      } catch (error) {
        const safe = safeError(error);
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    if (action === 'von-halsky-post-sales-sync') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      try {
        const body = await req.json().catch(() => ({}));
        const [returnsSettled, claimsSettled] = await Promise.allSettled([
          api.fetchReturns({ limit: body.limit || 30, offset: body.offset || 0 }),
          api.fetchClaims({ limit: body.limit || 30, offset: body.offset || 0, state: body.state }),
        ]);
        const returnsResult = returnsSettled.status === 'fulfilled' ? returnsSettled.value : null;
        const claimsResult = claimsSettled.status === 'fulfilled' ? claimsSettled.value : null;
        const incomingReturns = Array.isArray(returnsResult?.payload?.data) ? returnsResult.payload.data : [];
        const incomingClaims = Array.isArray(claimsResult?.payload?.items)
          ? claimsResult.payload.items
          : Array.isArray(claimsResult?.payload?.data) ? claimsResult.payload.data : [];
        const checkedAt = new Date().toISOString();
        const returnsError = returnsSettled.status === 'rejected' ? safeError(returnsSettled.reason) : null;
        const claimsError = claimsSettled.status === 'rejected' ? safeError(claimsSettled.reason) : null;
        const sourceHealth = {
          returns: returnsError
            ? { status: 'error', checkedAt, code: matchingText(returnsError.code, 100), message: matchingText(returnsError.message, 500), retryable: true }
            : { status: 'ok', checkedAt, code: '', message: `Pobrano ${incomingReturns.length} zwrotów.`, retryable: false },
          claims: claimsError
            ? { status: 'error', checkedAt, code: matchingText(claimsError.code, 100), message: matchingText(claimsError.message, 500), retryable: true }
            : { status: 'ok', checkedAt, code: '', message: `Pobrano ${incomingClaims.length} reklamacji.`, retryable: false },
        };
        const state = await mutate((draft) => {
          if (returnsSettled.status === 'fulfilled') {
            draft.returns = mergeBy(draft.returns, incomingReturns)
              .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0))
              .slice(0, 500);
          }
          if (claimsSettled.status === 'fulfilled') {
            draft.claims = mergeBy(draft.claims, incomingClaims, (item) => item?.claimId || item?.id)
              .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0))
              .slice(0, 500);
          }
          draft.sync = { ...draft.sync, postSales: sourceHealth };
          return draft;
        });
        const warnings = [
          returnsError ? `Nie pobrano zwrotów: ${returnsError.message}` : '',
          claimsError ? `Nie pobrano reklamacji: ${claimsError.message}` : '',
        ].filter(Boolean);
        await recordDiagnostic({
          operation: 'post-sales-sync',
          status: warnings.length ? 'warning' : 'ok',
          message: `Pobrano zwroty ${incomingReturns.length}, reklamacje ${incomingClaims.length}.${warnings.length ? ` ${warnings.join(' ')}` : ''}`,
          requestId: claimsResult?.requestId || returnsResult?.requestId,
        });
        return respond({
          ok: true,
          partial: warnings.length > 0,
          unavailable: returnsSettled.status === 'rejected' && claimsSettled.status === 'rejected',
          warnings,
          sourceHealth,
          returns: state.returns,
          claims: state.claims,
        });
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
        const current = cleanState((await readVersioned(STORE_KEY, initialState())).value);
        const previousEventsAt = Date.parse(String(current.sync.lastEventsAt || ''));
        const occurredAtGte = body.occurredAtGte || (Number.isFinite(previousEventsAt)
          ? new Date(previousEventsAt - 5 * 60_000).toISOString()
          : '');
        const [offerResult, orderResult] = await Promise.all([
          api.fetchOfferEvents({ limit: body.limit || 30, offset: body.offset || 0, occurredAtGte }),
          api.fetchOrderEvents({ limit: body.limit || 30, offset: body.offset || 0, occurredAtGte }),
        ]);
        const offerEvents = (Array.isArray(offerResult.payload?.data) ? offerResult.payload.data : []).map((item) => ({ ...item, channelType: 'offer' }));
        const orderEvents = (Array.isArray(orderResult.payload?.data) ? orderResult.payload.data : []).map((item) => ({ ...item, channelType: 'order' }));
        const timestamp = new Date().toISOString();
        const state = await mutate((draft) => {
          draft.events = mergeBy(draft.events, [...offerEvents, ...orderEvents])
            .sort((a, b) => Date.parse(b.occurredAt || 0) - Date.parse(a.occurredAt || 0))
            .slice(0, 1000);
          draft.sync = {
            ...draft.sync,
            status: 'connected',
            lastEventsAt: timestamp,
            lastEventsCount: offerEvents.length + orderEvents.length,
            lastEventsRequestId: offerResult.requestId || orderResult.requestId || '',
            reconciliationMode: 'api_event_feed_with_catalog_verification',
          };
          return draft;
        });
        return respond({ ok: true, fetched: offerEvents.length + orderEvents.length, events: state.events, sync: state.sync });
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
