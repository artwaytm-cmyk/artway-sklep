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
