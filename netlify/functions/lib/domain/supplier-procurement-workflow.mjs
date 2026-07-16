import { warehouseAnalysisNeedsInvestigation } from './order-warehouse-readiness.mjs';

const array = (value) => (Array.isArray(value) ? value : []);
const text = (value = '', limit = 220) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
const normalized = (value = '') => text(value, 180).toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, ' ').trim();
const quantity = (value) => Math.max(0, Number(value) || 0);

const TERMINAL_ALLEGRO = new Set(['sent', 'picked up', 'cancelled', 'canceled', 'returned']);
const LOCKED_LOCAL = new Set(['spakowane', 'zrealizowane', 'zamkniete']);

function orderId(order = {}) {
  return text(order.id || order.nr || order.orderId || order.checkoutForm?.id, 180);
}

function orderReferences(order = {}) {
  const id = orderId(order);
  return new Set([id, id && `Allegro ${id}`].filter(Boolean).map((value) => normalized(value)));
}

function lineBelongsToOrder(line = {}, references = new Set()) {
  return array(line.zamowienia || line.orderRefs || line.orders)
    .some((reference) => references.has(normalized(reference)));
}

function sentDraft(draft = {}) {
  const status = normalized(draft.status);
  return !!text(draft.emailSentAt, 80)
    || ['wyslane do producenta', 'wyslane do dostawcy', 'czesciowo wyslane e mailem', 'czesciowo zrealizowane', 'zrealizowane']
      .includes(status);
}

function lineProductId(line = {}) {
  return text(line.produktId ?? line.productId ?? line.id, 160);
}

function lineReceiptState(line = {}, references = new Set()) {
  const orderAllocations = Object.entries(line.orderAllocations || {}).filter(([reference]) => references.has(normalized(reference)));
  const receiptAllocations = line.receiptAllocations || {};
  const ordered = orderAllocations.length
    ? orderAllocations.reduce((sum, [, value]) => sum + quantity(value), 0)
    : quantity(line.ilosc ?? line.quantity);
  const received = orderAllocations.length
    ? orderAllocations.reduce((sum, [reference]) => sum + quantity(receiptAllocations[reference]), 0)
    : quantity(line.przyjeto ?? line.received);
  return { ordered, received, complete: ordered > 0 && received >= ordered, partial: received > 0 && received < ordered };
}

function officialStatus(order = {}) {
  return normalized(order.fulfillmentStatus || order.fulfilmentStatus || order.fulfillment?.status || order.allegroStatus || order.status);
}

/**
 * Synchronizuje lokalny etap zamówienia wyłącznie z dokumentami producenta,
 * które mają dokładną referencję do tego zamówienia. Powiązanie produktu lub
 * samo podobieństwo nazw nigdy nie wystarcza do zmiany etapu.
 */
export function applySupplierProcurementToOrder(order = {}, supplierDrafts = [], { at = new Date() } = {}) {
  const references = orderReferences(order);
  if (!references.size) return order;
  const related = [];
  for (const draft of array(supplierDrafts)) {
    for (const line of array(draft.pozycje || draft.items)) {
      if (lineBelongsToOrder(line, references)) related.push({ draft, line, ...lineReceiptState(line, references) });
    }
  }
  if (!related.length) return order;

  const shortagePositions = array(order.agentAnalysis?.positions)
    .filter((position) => quantity(position.shortage) > 0 || normalized(position.decision) === 'zamow u producenta');
  const requiredProductIds = new Set(shortagePositions.map(lineProductId).filter(Boolean));
  const sent = related.filter((item) => sentDraft(item.draft));
  const sentProductIds = new Set(sent.map((item) => lineProductId(item.line)).filter(Boolean));
  const everyShortageCovered = requiredProductIds.size
    ? [...requiredProductIds].every((productId) => sentProductIds.has(productId))
    : sent.length === related.length;
  const allSent = sent.length > 0 && sent.length === related.length && everyShortageCovered;
  const anyReceived = related.some((item) => item.received > 0);
  const allReceived = allSent && related.every((item) => item.complete);
  const procurementStatus = allReceived
    ? 'dostawa_przyjeta'
    : anyReceived
      ? 'czesciowo_przyjete'
      : allSent
        ? 'oczekuje_na_dostawe'
        : sent.length
          ? 'czesciowo_wyslane'
          : 'do_wyslania';
  const taskStatus = allSent ? 'zrealizowane' : sent.length ? 'w_realizacji' : 'do_realizacji';
  const previous = order.supplierProcurement && typeof order.supplierProcurement === 'object' ? order.supplierProcurement : {};
  const timestamp = at instanceof Date ? at.toISOString() : text(at, 80);
  const supplierProcurement = {
    status: procurementStatus,
    taskStatus,
    relatedDrafts: [...new Set(related.map(({ draft }) => text(draft.numer || draft.id, 160)).filter(Boolean))],
    sentDrafts: [...new Set(sent.map(({ draft }) => text(draft.numer || draft.id, 160)).filter(Boolean))],
    orderedLines: related.length,
    receivedLines: related.filter((item) => item.complete).length,
    orderedQuantity: related.reduce((sum, item) => sum + item.ordered, 0),
    receivedQuantity: related.reduce((sum, item) => sum + item.received, 0),
    completedAt: allSent ? (previous.completedAt || sent.map(({ draft }) => text(draft.emailSentAt, 80)).filter(Boolean).sort().pop() || timestamp) : null,
    deliveryCompletedAt: allReceived ? (previous.deliveryCompletedAt || timestamp) : null,
  };

  let warehouseStage = text(order.warehouseStage, 50).toLowerCase() || 'do_sprawdzenia';
  const locked = LOCKED_LOCAL.has(warehouseStage) || TERMINAL_ALLEGRO.has(officialStatus(order));
  const unresolved = warehouseAnalysisNeedsInvestigation(order.agentAnalysis);
  if (!locked) {
    if (allReceived) warehouseStage = 'kompletacja';
    else if (unresolved) warehouseStage = 'do_sprawdzenia';
    else if (allSent) warehouseStage = 'oczekuje_na_dostawe';
    else warehouseStage = 'braki';
  }
  const comparableBefore = JSON.stringify({ supplierProcurement: previous, warehouseStage: order.warehouseStage });
  const comparableAfter = JSON.stringify({ supplierProcurement, warehouseStage });
  if (comparableBefore === comparableAfter) return order;
  return {
    ...order,
    supplierProcurement,
    warehouseStage,
    procurementWorkflowUpdatedAt: timestamp,
    warehouseStageUpdatedAt: warehouseStage !== order.warehouseStage ? timestamp : order.warehouseStageUpdatedAt,
  };
}

export function applySupplierProcurementWorkflow(orders = [], supplierDrafts = [], options = {}) {
  let changed = 0;
  const items = array(orders).map((order) => {
    const next = applySupplierProcurementToOrder(order, supplierDrafts, options);
    if (next !== order) changed += 1;
    return next;
  });
  return { items, changed };
}
