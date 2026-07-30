import { createAgentEventQueue } from './agent-event-queue.mjs';

const INTERNAL_PRODUCT_AREAS = /^(?:allegro-preparation|von-halsky-agent|von-halsky-source|agent-|openai-|allegro-publication)/i;

export function createAgentEventSystem({
  pool = null,
  namespace = 'artway-sklep',
  readVersioned,
  writeIfVersion,
  runtime,
  coordinate = null,
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

  function signalVonHalskyPreparation(productId, { source = 'allegro-preparation' } = {}) {
    const id = text(productId, 120).trim();
    if (!id) return Promise.resolve({ skipped: true, reason: 'missing_product_id' });
    return emit({
      type: 'product.von_halsky.prepare',
      area: 'products',
      entityId: id,
      dedupeKey: `product.von_halsky.prepare:${id}`,
      source,
      priority: 520,
      payload: {
        productId: id,
        action: 'niezależne przygotowanie kartoteki Von Halsky',
      },
    });
  }

  function vonHalskyFinisher({
    route,
    publicOrigin = 'https://artwaytm.pl',
    adminToken = '',
    saveProductFields = null,
    getProduct = null,
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
      const product = typeof getProduct === 'function' ? await getProduct(productId) : null;
      const states = product?.contentEditorial?.channelStates || {};
      const channelsReady = states.store?.status === 'ready'
        && states.allegro?.status === 'ready'
        && (
          states.vonHalsky?.status === 'ready'
          || String(product?.vonHalskyAgentStatus || '').toLowerCase() === 'ready'
        );
      let qualityConfirmation = null;
      if (channelsReady && typeof saveProductFields === 'function') {
        const confirmedAt = new Date().toISOString();
        const fields = {
          agentQualityReviewStatus: 'confirmed',
          agentQualityConfirmedAt: confirmedAt,
          agentQualityReadbackConfirmed: true,
          agentQualityRunId: String(task.id || result.runId || ''),
          agentQualityInputFingerprint: String(product?.contentEditorial?.inputFingerprint || ''),
          agentQualityChannels: {
            store: { status: 'ready', preparedAt: states.store?.preparedAt || '' },
            allegro: { status: 'ready', preparedAt: states.allegro?.preparedAt || product?.allegroAgentPreparedAt || '' },
            vonHalsky: { status: 'ready', preparedAt: states.vonHalsky?.preparedAt || result.confirmedAt || '' },
          },
          agentQualitySavedFields: [...new Set([
            ...(Array.isArray(task?.savedFields) ? task.savedFields : []),
            ...(Array.isArray(result?.savedFields) ? result.savedFields : []),
          ])].slice(0, 180),
        };
        qualityConfirmation = await saveProductFields({
          productId,
          fields,
          mutationId: `agent-quality-confirmed:${productId}:${task.id || Date.now()}`,
          actor: 'agent-quality-controller',
          area: 'agent-quality-confirmation',
        });
      }
      return {
        channel: 'vonHalsky',
        status: result.status,
        readbackConfirmed: true,
        productId,
        savedFields: result.savedFields || [],
        qualityConfirmed: qualityConfirmation?.publication?.readbackConfirmed === true,
      };
    };
  }

  function connect({
    preparationRoute,
    prepareVonHalsky,
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
      const coordinationId = `codex-event:${event.id || productId}`;
      await runtime.report({
        event: 'work_progress',
        source: 'codex-coordinator',
        work: {
          id: coordinationId,
          productId,
          productName: text(event.payload?.productName, 220),
          channel: 'system',
          action: 'koordynacja pełnego przeglądu produktu',
          phase: 'planning',
          status: 'running',
          target: 'kontrolowane usługi domenowe sklepu',
          message: 'Codex analizuje sygnał i przydziela ograniczone podzadania agentom pomocniczym.',
        },
      }).catch(() => {});
      const coordinated = typeof coordinate === 'function'
        ? await coordinate({
          event,
          kind: 'product.review',
          productId,
          productName: text(event.payload?.productName, 220),
        }).catch((error) => ({ ok: false, reason: text(error?.message || error, 240), plan: null }))
        : { ok: false, reason: 'coordinator_not_configured', plan: null };
      const assignment = coordinated?.plan?.assignments?.find((item) => item.scenarioId === 'catalog-editorial') || null;
      const state = await preparationRoute.prepareProducts([productId], {
        operation: 'product-full-review',
        requestedBy: assignment ? 'codex-koordinator' : event.source || 'agent-zdarzeniowy',
      });
      await runtime.report({
        event: 'work_progress',
        source: 'codex-coordinator',
        work: {
          id: coordinationId,
          productId,
          productName: text(event.payload?.productName, 220),
          channel: 'system',
          action: 'koordynacja pełnego przeglądu produktu',
          phase: assignment ? 'delegated' : 'safe_fallback',
          status: 'confirmed',
          target: 'trwała kolejka przygotowania produktów',
          targetRef: state.batchId,
          message: assignment
            ? `Codex przydzielił scenariusz ${assignment.scenarioId} v${assignment.scenarioVersion}; wykonanie trwa w serwerowej kolejce.`
            : `Codex nie zwrócił planu (${coordinated?.reason || 'brak odpowiedzi'}); bezpieczny deterministyczny przepływ nie został zatrzymany.`,
        },
      }).catch(() => {});
      return {
        message: `Produkt ${productId} przekazano przez koordynatora Codex do trwałej kolejki pełnego przeglądu: źródło, sklep, Von Halsky i Allegro.`,
        queued: true,
        batchId: state.batchId,
        coordinator: assignment
          ? {
            id: 'codex',
            scenarioId: assignment.scenarioId,
            scenarioVersion: assignment.scenarioVersion,
            specialist: assignment.specialist,
          }
          : { id: 'codex', fallback: true, reason: coordinated?.reason || 'unavailable' },
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
    queue.register('product.von_halsky.prepare', async (event) => {
      if (typeof prepareVonHalsky !== 'function') {
        throw Object.assign(new Error('Wykonawca przygotowania Von Halsky nie jest skonfigurowany.'), {
          decisionRequired: true,
        });
      }
      return prepareVonHalsky({
        id: event.id,
        productId: event.entityId || event.payload?.productId,
        operation: 'von-halsky',
        requestedAt: event.createdAt,
      });
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
    signalVonHalskyPreparation,
    wrapProductSaver,
    vonHalskyFinisher,
    connect,
  });
}
