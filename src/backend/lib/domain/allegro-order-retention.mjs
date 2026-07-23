const DAY_MS = 86_400_000;
const TERMINAL = new Set(['SENT', 'PICKED_UP', 'CANCELLED', 'CANCELED', 'RETURNED']);

const list = (value) => Array.isArray(value) ? value : [];
const text = (value = '') => String(value ?? '').trim();
const status = (order = {}) => {
  const main = text(order.status).toUpperCase(), fulfillment = text(order.fulfillmentStatus || order.fulfillment?.status || order.allegroStatus).toUpperCase();
  if (main === 'CANCELLED' || fulfillment === 'CANCELLED') return 'CANCELLED';
  return fulfillment || 'NEW';
};
const orderId = (order = {}) => text(order.id || order.nr || order.orderId);
const orderTime = (order = {}) => {
  for (const value of [order.createdAt, order.firstFetchedAt, order.lineItems?.[0]?.boughtAt]) {
    const parsed = Date.parse(value || ''); if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};
const locallyCompleted = (order = {}) => order.baselineArchived === true || order.localCompleted === true
  || ['zrealizowane', 'zamkniete', 'wyslane', 'anulowane'].includes(text(order.warehouseStage || order.localStage).toLowerCase());
const archiveMonth = (order = {}) => {
  const timestamp = orderTime(order) || Date.now(), date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};
const shardKey = (month) => `allegro_orders_archive_${String(month).replace(/[^0-9-]/g, '')}`;
const statusCounts = (items) => list(items).reduce((out, order) => { const key = status(order); out[key] = (out[key] || 0) + 1; return out; }, {});

export function allegroOrderNeedsLiveRefresh(order = {}) {
  return !!orderId(order) && !TERMINAL.has(status(order)) && !locallyCompleted(order);
}

export function allegroOrderNeedsStatusRefresh(order = {}) {
  // Status oficjalny zawsze pochodzi z Allegro. Rekord oznaczony podczas
  // historycznego cut-over nadal może później zostać wysłany lub anulowany,
  // dlatego lokalny marker nie może wyłączać odczytu statusu. Starsze niż
  // okres retencji rekordy i tak trafiają do miesięcznego archiwum.
  return !!orderId(order) && !TERMINAL.has(status(order));
}

export function selectAllegroStatusRefreshCandidates(orders = [], {
  seenIds = new Set(),
  limit = 24,
} = {}) {
  const seen = seenIds instanceof Set ? seenIds : new Set(list(seenIds).map(String));
  const safeLimit = Math.max(0, Math.min(100, Number(limit) || 0));
  return list(orders)
    .filter((order) => orderId(order) && !seen.has(orderId(order)) && allegroOrderNeedsStatusRefresh(order))
    .sort((left, right) => {
      const leftChecked = Date.parse(left?.officialStatusCheckedAt || left?.lastSeenAt || '') || 0;
      const rightChecked = Date.parse(right?.officialStatusCheckedAt || right?.lastSeenAt || '') || 0;
      return leftChecked - rightChecked || orderTime(right) - orderTime(left) || orderId(left).localeCompare(orderId(right));
    })
    .slice(0, safeLimit);
}

export function partitionAllegroOrders(orders = [], { now = new Date(), retentionDays = 30 } = {}) {
  const at = now instanceof Date ? now.getTime() : Date.parse(now), cutoff = (Number.isFinite(at) ? at : Date.now()) - Math.max(1, Number(retentionDays) || 30) * DAY_MS;
  const live = [], archived = [];
  for (const order of list(orders)) {
    if (!orderId(order)) continue;
    const old = orderTime(order) > 0 && orderTime(order) < cutoff;
    (old && !allegroOrderNeedsLiveRefresh(order) ? archived : live).push(order);
  }
  return { live, archived, cutoff: new Date(cutoff).toISOString() };
}

function normalizeIndex(value = {}) {
  const months = value?.months && typeof value.months === 'object' && !Array.isArray(value.months) ? value.months : {};
  const lookup = value?.lookup && typeof value.lookup === 'object' && !Array.isArray(value.lookup) ? value.lookup : {};
  return { version: 1, total: Object.keys(lookup).length, months, lookup, updated_at: value.updated_at || null };
}
function publicIndex(index = {}) {
  const normalized = normalizeIndex(index);
  return {
    total: normalized.total,
    retentionDays: 30,
    months: Object.entries(normalized.months).map(([month, data]) => ({ month, count: Number(data?.count) || 0, statusCounts: data?.statusCounts || {}, updated_at: data?.updated_at || null })).sort((a, b) => b.month.localeCompare(a.month)),
    updated_at: normalized.updated_at,
  };
}

export function createAllegroOrderArchive({ read, write } = {}) {
  if (typeof read !== 'function' || typeof write !== 'function') throw new Error('Archiwum Allegro wymaga odczytu i zapisu repozytorium.');
  const INDEX_KEY = 'allegro_orders_archive_index_v1';
  async function index() { return normalizeIndex(await read(INDEX_KEY, {})); }
  async function archive(orders = [], options = {}) {
    const divided = partitionAllegroOrders(orders, options), current = await index(), groups = new Map();
    for (const order of divided.archived) {
      const id = orderId(order), month = current.lookup[id] || archiveMonth(order);
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month).push({ ...order, archivedAt: order.archivedAt || new Date().toISOString(), archiveMonth: month });
    }
    let added = 0;
    for (const [month, incoming] of groups) {
      const key = shardKey(month), record = await read(key, { items: [] }), byId = new Map(list(record?.items).map((item) => [orderId(item), item]).filter(([id]) => id));
      for (const order of incoming) {
        const id = orderId(order), existed = byId.has(id); byId.set(id, { ...(byId.get(id) || {}), ...order });
        current.lookup[id] = month; if (!existed) added++;
      }
      const items = [...byId.values()].sort((a, b) => orderTime(b) - orderTime(a));
      const updated_at = new Date().toISOString();
      await write(key, { items, count: items.length, month, updated_at });
      current.months[month] = { count: items.length, statusCounts: statusCounts(items), updated_at };
    }
    current.total = Object.keys(current.lookup).length;
    if (groups.size) { current.updated_at = new Date().toISOString(); await write(INDEX_KEY, current); }
    return { items: divided.live, archived: divided.archived.length, added, cutoff: divided.cutoff, summary: publicIndex(current) };
  }
  async function page({ month = '', offset = 0, limit = 100 } = {}) {
    const current = await index(), safeOffset = Math.max(0, Number(offset) || 0), safeLimit = Math.max(1, Math.min(250, Number(limit) || 100));
    const months = month && current.months[month] ? [month] : Object.keys(current.months).sort((a, b) => b.localeCompare(a));
    const items = [];
    for (const key of months) {
      const record = await read(shardKey(key), { items: [] }); items.push(...list(record?.items));
      if (items.length >= safeOffset + safeLimit) break;
    }
    items.sort((a, b) => orderTime(b) - orderTime(a));
    return { items: items.slice(safeOffset, safeOffset + safeLimit), offset: safeOffset, limit: safeLimit, hasMore: safeOffset + safeLimit < (month ? Number(current.months[month]?.count) || 0 : current.total), summary: publicIndex(current) };
  }
  return { archive, index, page, summary: async () => publicIndex(await index()) };
}
