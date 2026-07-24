function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value = '', limit = 180) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
}

function quantity(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function normalizedEntry(value = {}) {
  if (typeof value === 'number') return { quantity: quantity(value), orders: [] };
  const source = object(value);
  const orders = array(source.orders).map((order) => ({
    orderNumber: text(order?.orderNumber || order?.number, 180),
    quantity: quantity(order?.quantity),
    createdAt: text(order?.createdAt, 80),
    updatedAt: text(order?.updatedAt, 80),
  })).filter((order) => order.orderNumber && order.quantity > 0);
  return {
    ...source,
    quantity: orders.length
      ? orders.reduce((sum, order) => sum + order.quantity, 0)
      : quantity(source.quantity),
    orders,
  };
}

export function recordInventoryShortfall(shortfalls = {}, {
  productId,
  orderNumber,
  quantity: missingQuantity,
  at,
} = {}) {
  const id = text(productId, 160);
  const number = text(orderNumber, 180);
  const missing = quantity(missingQuantity);
  const timestamp = text(at, 80) || new Date().toISOString();
  const next = structuredClone(object(shortfalls));
  if (!id || !number || missing <= 0) return { shortfalls: next, recorded: 0 };

  const current = normalizedEntry(next[id]);
  const existing = current.orders.find((order) => order.orderNumber === number);
  if (existing) {
    existing.quantity += missing;
    existing.updatedAt = timestamp;
  } else {
    current.orders.push({ orderNumber: number, quantity: missing, createdAt: timestamp, updatedAt: timestamp });
  }
  current.quantity = current.orders.reduce((sum, order) => sum + order.quantity, 0);
  current.updatedAt = timestamp;
  next[id] = current;
  return { shortfalls: next, recorded: missing, outstanding: current.quantity };
}

export function settleInventoryShortfall(shortfalls = {}, {
  productId,
  quantity: receivedQuantity,
  at,
} = {}) {
  const id = text(productId, 160);
  const received = quantity(receivedQuantity);
  const timestamp = text(at, 80) || new Date().toISOString();
  const next = structuredClone(object(shortfalls));
  const current = normalizedEntry(next[id]);
  if (!id || received <= 0 || current.quantity <= 0) {
    return { shortfalls: next, settled: 0, remainingReceipt: received, allocations: [] };
  }

  let remaining = received;
  const allocations = [];
  for (const order of current.orders) {
    if (remaining <= 0) break;
    const settled = Math.min(order.quantity, remaining);
    if (settled <= 0) continue;
    order.quantity -= settled;
    remaining -= settled;
    allocations.push({ orderNumber: order.orderNumber, quantity: settled });
  }
  current.orders = current.orders.filter((order) => order.quantity > 0);

  // Obsługa wpisu historycznego bez rozbicia na zamówienia.
  const describedBefore = current.orders.reduce((sum, order) => sum + order.quantity, 0);
  const aggregateRemainder = Math.max(0, current.quantity - allocations.reduce((sum, row) => sum + row.quantity, 0) - describedBefore);
  const aggregateSettled = Math.min(remaining, aggregateRemainder);
  if (aggregateSettled > 0) {
    remaining -= aggregateSettled;
    allocations.push({ orderNumber: 'zaległe wydanie', quantity: aggregateSettled });
  }

  const settled = received - remaining;
  current.quantity = Math.max(0, current.quantity - settled);
  current.updatedAt = timestamp;
  if (current.quantity > 0) next[id] = current;
  else delete next[id];

  return {
    shortfalls: next,
    settled,
    remainingReceipt: remaining,
    outstanding: current.quantity,
    allocations,
  };
}
