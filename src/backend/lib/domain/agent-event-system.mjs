import { createAgentEventQueue } from './agent-event-queue.mjs';

const INTERNAL_PRODUCT_AREAS = /^(?:allegro-preparation|von-halsky-agent|von-halsky-source|agent-|openai-|allegro-publication)/i;

export function createAgentEventSystem({
  pool = null,
  namespace = 'artway-sklep',
  readVersioned,
  writeIfVersion,
  runtime,
  text = (value = '', limit = 500) => String(value ?? '').trim().slice(0, limit),
} = {}) {
  const queue = createAgentEventQueue({
    pool,
    namespace,
    readVersioned,
    writeIfVersion,
    runtime,
  });
  const emit = (event) => queue.enqueue(event);

  function signalProduct(productId, {
    source = 'product-editor',
    productName = '',
    action = 'pełny przegląd kartoteki produktu',
    changedFields = [],
    priority = 350,
  } = {}) {
    const id = text(productId, 120).trim();
    if (!id) return Promise.resolve({ skipped: true, reason: 'missing_product_id' });
    return emit({
      type: 'product.review',
      area: 'products',
      entityId: id,
      dedupeKey: `product.review:${id}`,
      source,
      priority,
      payload: {
        productId: id,
        productName: text(productName, 240),
        action,
        changedFields: Array.isArray(changedFields) ? changedFields.slice(0, 200) : [],
      },
    });
  }

  function wrapProductSaver(save) {
    return async (input = {}) => {
      const result = await save(input);
      const productId = text(input.productId || result?.product?.id, 120).trim();
      const area = text(input.area || 'product-editor', 120).trim();
      let agentEvent = null;
      if (productId && !INTERNAL_PRODUCT_AREAS.test(area)) {
        try {
          agentEvent = await signalProduct(productId, {
            source: area,
            productName: result?.product?.nazwa || result?.product?.name || '',
            changedFields: Array.isArray(result?.changedFields)
              ? result.changedFields
              : Object.keys(input.fields || {}),
            priority: /source|import|link/i.test(area) ? 500 : 350,
          });
        } catch (error) {
          console.error('agent_product_event', error);
        }
      }
      return {
        ...result,
        agentEvent: agentEvent
          ? {
              eventId: agentEvent.event?.id || '',
              queued: agentEvent.duplicate !== true,
              deduplicated: agentEvent.duplicate === true,
            }
          : null,
      };
    };
  }

  function signalAllegroOrders(orderIds = []) {
    return queue.enqueueMany(orderIds.map((orderId) => ({
      type: 'order.allegro.received',
      area: 'orders',
      entityId: String(orderId),
      dedupeKey: `order.allegro.received:${orderId}`,
      source: 'allegro-order-api',
      priority: 950,
      payload: {
        orderId: String(orderId),
        action: 'obsługa nowego zamówienia Allegro',
      },
    })));
  }

  function vonHalskyFinisher({
    route,
    publicOrigin = 'https://artwaytm.pl',
    adminToken = '',
  } = {}) {
    return async (task = {}) => {
      const productId = String(task.productId || '');
      const origin = String(publicOrigin).replace(/\/+$/, '');
      const url = new URL(`${origin}/api/store?action=von-halsky-agent-prepare`);
      const req = new Request(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(adminToken ? { 'x-admin-token': adminToken } : {}),
        },
        body: JSON.stringify({ productIds: [productId], source: 'automatic' }),
      });
      const response = await route(req, url, 'von-halsky-agent-prepare');
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        throw new Error(text(data?.error || `Von Halsky HTTP ${response.status}`, 1000));
      }
      const result = Array.isArray(data?.results)
        ? data.results.find((item) => String(item?.productId || '') === productId) || data.results[0]
        : null;
      if (!result || result.status !== 'ready' || result.readbackConfirmed !== true) {
        const missing = [
          ...(Array.isArray(result?.issues) ? result.issues : []),
          ...(Array.isArray(result?.warnings) ? result.warnings : []),
        ].filter(Boolean);
        const error = new Error(text(
          `Von Halsky nie potwierdził gotowej kartoteki${missing.length ? `: ${missing.join(', ')}` : '.'}`,
          1000,
        ));
        error.code = 'von_halsky_product_not_ready';
        throw error;
      }
      return {
        channel: 'vonHalsky',
        status: result.status,
        readbackConfirmed: true,
        productId,
        savedFields: result.savedFields || [],
      };
    };
  }

  function connect({
    preparationRoute,
    storeOrderReconciliation,
    readAllegroOrders,
    reconcileAllegroPlan,
  } = {}) {
    queue.register('product.review', async (event) => {
      const productId = text(event.entityId || event.payload?.productId, 120).trim();
      if (!productId) {
        throw Object.assign(new Error('Sygnał produktu nie zawiera identyfikatora.'), {
          decisionRequired: true,
        });
      }
      const state = await preparationRoute.prepareProducts([productId], {
        operation: 'product-full-review',
        requestedBy: event.source || 'agent-zdarzeniowy',
      });
      return {
        message: `Produkt ${productId} przekazano do trwałej kolejki pełnego przeglądu: źródło, sklep, Von Halsky i Allegro.`,
        queued: true,
        batchId: state.batchId,
      };
    });
    queue.register('product.backlog.bootstrap', async () => {
      const automatic = await preparationRoute.startBacklog();
      const message = automatic.reason === 'catalog_ready'
        ? 'Kartoteka produktów jest kompletna; Agent pozostaje w gotowości na nowe zdarzenia.'
        : automatic.reason === 'queue_busy'
          ? 'Wznowiono istniejącą trwałą kolejkę produktów. Po jej opróżnieniu Agent automatycznie dobierze kolejne rzeczywiste braki.'
          : `Uruchomiono ciągłą pracę nad ${automatic.candidates?.length || 0} produktami. Po opróżnieniu partii Agent sam pobierze następną.`;
      return {
        message,
        skipped: automatic.skipped === true,
        reason: automatic.reason || '',
        enqueued: Number(automatic.enqueued || automatic.candidates?.length || 0),
      };
    });
    queue.register('order.store.received', async (event) => ({
      message: `Nowe zamówienie ${event.entityId} zostało zapisane, sprawdzone magazynowo i przekazane do właściwego planu zaopatrzenia.`,
      reconciliation: await storeOrderReconciliation.reconcileDraftsSafely({ summary: true }),
    }));
    queue.register('order.allegro.received', async (event) => {
      const record = await readAllegroOrders();
      return {
        message: `Nowe zamówienie Allegro ${event.entityId} zostało sprawdzone w magazynie i planie zaopatrzenia.`,
        reconciliation: await reconcileAllegroPlan(Array.isArray(record.items) ? record.items : []),
      };
    });
    const communicationHandler = async (event) => ({
      message: event.type.endsWith('.issue.received')
        ? `Nowa dyskusja ${event.entityId} trafiła do modułu komunikacji i została zapisana tylko raz.`
        : `Nowa wiadomość ${event.entityId} trafiła do modułu komunikacji i została zapisana tylko raz.`,
    });
    queue.register('communication.allegro.message.received', communicationHandler);
    queue.register('communication.allegro.issue.received', communicationHandler);

    const startup = setTimeout(() => {
      queue.resume()
        .then(() => queue.enqueue({
          type: 'product.backlog.bootstrap',
          area: 'products',
          entityId: 'current-catalog',
          dedupeKey: 'product.backlog.bootstrap:current-catalog',
          source: 'server-startup',
          priority: 400,
          payload: {
            action: 'jednorazowe zasilenie zaległości produktowych po uruchomieniu serwera',
          },
        }))
        .catch((error) => console.error('agent_event_startup', error));
    }, 1500);
    startup.unref?.();
  }

  return Object.freeze({
    queue,
    emit,
    signalProduct,
    signalAllegroOrders,
    wrapProductSaver,
    vonHalskyFinisher,
    connect,
  });
}
