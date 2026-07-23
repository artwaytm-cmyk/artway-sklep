const list = (value) => Array.isArray(value) ? value : [];
const text = (value = '') => String(value ?? '').trim();

// Łączy ostatnie okno pobrane z Allegro ze stanem lokalnym. Znane zamówienie
// aktualizujemy niezależnie od statusu, ale nowy rekord wpuszczamy do kolejki
// wyłącznie wtedy, gdy nadal wymaga realizacji.
export function mergeRecentAllegroOrders({
  fetched = [], previous = [], archivedLookup = {}, normalize, merge,
  isWorkItem, checkedAt = new Date().toISOString(),
} = {}) {
  if (typeof normalize !== 'function' || typeof merge !== 'function' || typeof isWorkItem !== 'function') throw new TypeError('Synchronizacja zamówień wymaga normalizacji, scalania i reguły kolejki.');
  const previousById = new Map(list(previous).filter((item) => item?.id).map((item) => [text(item.id), item]));
  const byId = new Map(previousById), seenIds = new Set(), newOrderIds = [];
  let imported = 0, refreshed = 0, ignoredTerminal = 0;
  for (const raw of list(fetched)) {
    const normalized = normalize(raw), id = text(normalized?.id);
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);
    if (archivedLookup?.[id]) continue;
    const previousOrder = byId.get(id) || {}, official = { ...normalized, officialStatusCheckedAt: checkedAt };
    if (previousOrder.id) {
      byId.set(id, merge(official, previousOrder)); refreshed++;
    } else if (isWorkItem(normalized)) {
      byId.set(id, merge(official, previousOrder)); imported++; newOrderIds.push(id);
    } else ignoredTerminal++;
  }
  return { byId, previousById, seenIds, newOrderIds, imported, refreshed, ignoredTerminal };
}

export function allegroOrderEventFingerprint(order = {}) {
  const lines = list(order.lineItems).map((item) => [
    text(item?.id), text(item?.offerId || item?.offer?.id), text(item?.externalId || item?.offer?.external?.id),
    Math.max(0, Number(item?.quantity) || 0), text(item?.price),
  ]).sort((a, b) => a.join('|').localeCompare(b.join('|')));
  return JSON.stringify({
    status: text(order.status).toUpperCase(), fulfillmentStatus: text(order.fulfillmentStatus || order.fulfillment?.status).toUpperCase(),
    updatedAt: text(order.updatedAt), paymentStatus: text(order.paymentStatus), deliveryStatus: text(order.deliveryStatus),
    shipmentStatus: text(order.shipmentStatus), revision: text(order.revision), total: text(order.total),
    deliveryMethod: text(order.deliveryMethod), deliveryPoint: text(order.deliveryPoint), deliveryAddress: text(order.deliveryAddress), lines,
  });
}

export function countChangedAllegroOrderEvents(previous = [], next = []) {
  const before = new Map(list(previous).filter((item) => item?.id).map((item) => [text(item.id), allegroOrderEventFingerprint(item)]));
  return list(next).reduce((count, item) => {
    const id = text(item?.id);
    return count + (id && before.has(id) && before.get(id) !== allegroOrderEventFingerprint(item) ? 1 : 0);
  }, 0);
}
