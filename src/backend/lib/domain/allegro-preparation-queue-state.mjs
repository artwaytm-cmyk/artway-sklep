import crypto from 'node:crypto';

export const ALLEGRO_PREPARATION_MAX_PENDING = 2000;
export const ALLEGRO_PREPARATION_MAX_RESULTS = 1000;

const clean = (value = '', limit = 500) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
const asArray = (value) => Array.isArray(value) ? value : [];
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

export function allegroPreparationInitialState() {
  return {
    version: 1,
    pending: [],
    active: null,
    activeItems: [],
    results: [],
    batches: [],
    blockedUntil: '',
    blockedReason: '',
    updatedAt: '',
  };
}

export function normalizeAllegroPreparationTask(value = {}) {
  const source = asObject(value);
  return {
    id: clean(source.id || crypto.randomUUID(), 120),
    batchId: clean(source.batchId, 120),
    productId: clean(source.productId, 100),
    operation: clean(source.operation || 'allegro', 40),
    requestedBy: clean(source.requestedBy || 'administrator', 200),
    requestedAt: clean(source.requestedAt || new Date().toISOString(), 50),
    priority: Math.max(0, Math.min(200_000, Number(source.priority) || 0)),
    priorityReason: clean(source.priorityReason, 160),
    attempt: Math.max(0, Number(source.attempt) || 0),
    skipEditorial: source.skipEditorial === true,
    inputFingerprint: clean(source.inputFingerprint, 160),
    leaseUntil: clean(source.leaseUntil, 50),
    workerId: clean(source.workerId, 180),
  };
}

export function normalizeAllegroPreparationState(value = {}) {
  const source = asObject(value);
  const activeItems = source.active
    ? [source.active, ...asArray(source.activeItems).filter((item) => item?.id !== source.active?.id)]
    : [];
  return {
    version: 1,
    pending: asArray(source.pending).map(normalizeAllegroPreparationTask).filter((item) => item.productId).slice(0, ALLEGRO_PREPARATION_MAX_PENDING),
    active: activeItems[0] ? normalizeAllegroPreparationTask(activeItems[0]) : null,
    activeItems: activeItems.map(normalizeAllegroPreparationTask).filter((item) => item.productId).slice(0, 16),
    results: asArray(source.results).map((item) => ({ ...asObject(item), productId: clean(item?.productId, 100) })).filter((item) => item.productId).slice(0, ALLEGRO_PREPARATION_MAX_RESULTS),
    batches: asArray(source.batches).map((item) => ({ ...asObject(item), id: clean(item?.id, 120) })).filter((item) => item.id).slice(0, 100),
    blockedUntil: clean(source.blockedUntil, 50),
    blockedReason: clean(source.blockedReason, 500),
    updatedAt: clean(source.updatedAt, 50),
  };
}

export function publicAllegroPreparationState(value = {}) {
  const state = normalizeAllegroPreparationState(value);
  const batchById = new Map(state.batches.map((batch) => [batch.id, {
    ...batch, pending: 0, running: 0, completed: 0, attention: 0, waitingProvider: 0, decisionRequired: 0, failed: 0, cancelled: 0,
    pendingProductIds: [], activeProductId: '', activeProductIds: [], unknown: 0,
  }]));
  const taskState = new Map();
  for (const item of state.pending) {
    taskState.set(item.id, { status: 'pending', item });
    const batch = batchById.get(item.batchId);
    if (batch) {
      batch.pending += 1;
      batch.pendingProductIds.push(item.productId);
    }
  }
  for (const active of state.activeItems) {
    taskState.set(active.id, { status: 'running', item: active });
    const batch = batchById.get(active.batchId);
    if (batch) {
      batch.running += 1;
      batch.activeProductId ||= active.productId;
      batch.activeProductIds = [...new Set([...(batch.activeProductIds || []), active.productId])];
    }
  }
  for (const item of state.results) {
    if (!taskState.has(item.id)) taskState.set(item.id, { status: item.status, item });
    const batch = batchById.get(item.batchId);
    if (!batch) continue;
    if (item.status === 'completed') batch.completed += 1;
    else if (item.status === 'attention') batch.attention += 1;
    else if (item.status === 'waiting_provider') batch.waitingProvider += 1;
    else if (item.status === 'decision_required') batch.decisionRequired += 1;
    else if (item.status === 'failed') batch.failed += 1;
  }
  for (const batch of batchById.values()) {
    const trackedTaskIds = [...new Set(asArray(batch.trackedTaskIds).map((id) => clean(id, 120)).filter(Boolean))];
    if (!trackedTaskIds.length) continue;
    Object.assign(batch, {
      pending: 0, running: 0, completed: 0, attention: 0, waitingProvider: 0, decisionRequired: 0, failed: 0, cancelled: 0,
      pendingProductIds: [], activeProductId: '', activeProductIds: [], unknown: 0,
    });
    for (const taskId of trackedTaskIds) {
      const tracked = taskState.get(taskId);
      if (!tracked) {
        batch.unknown += 1;
        continue;
      }
      if (tracked.status === 'pending') {
        batch.pending += 1;
        batch.pendingProductIds.push(tracked.item.productId);
      } else if (tracked.status === 'running') {
        batch.running += 1;
        batch.activeProductId ||= tracked.item.productId;
        batch.activeProductIds.push(tracked.item.productId);
      } else if (tracked.status === 'completed') batch.completed += 1;
      else if (tracked.status === 'attention') batch.attention += 1;
      else if (tracked.status === 'waiting_provider') batch.waitingProvider += 1;
      else if (tracked.status === 'decision_required') batch.decisionRequired += 1;
      else if (tracked.status === 'failed') batch.failed += 1;
      else if (tracked.status === 'cancelled') batch.cancelled += 1;
    }
  }
  const currentByProduct = new Map();
  for (const active of state.activeItems) currentByProduct.set(active.productId, { ...active, status: 'running' });
  for (const item of state.pending) {
    if (!currentByProduct.has(item.productId)) currentByProduct.set(item.productId, { ...item, status: 'pending' });
  }
  for (const item of state.results) {
    if (!currentByProduct.has(item.productId)) currentByProduct.set(item.productId, item);
  }
  const current = [...currentByProduct.values()];
  const actionableStatuses = new Set(['pending', 'running', 'attention', 'waiting_provider', 'decision_required', 'failed']);
  const lightweightCurrent = current.map((item) => {
    if (actionableStatuses.has(String(item?.status || '').toLowerCase())) return item;
    return Object.fromEntries([
      'id', 'batchId', 'productId', 'status', 'ready', 'requestedAt', 'startedAt', 'completedAt', 'updatedAt', 'attempt',
    ].filter((key) => item?.[key] !== undefined).map((key) => [key, item[key]]));
  });
  const currentSummary = {
    total: current.length,
    pending: current.filter((item) => item.status === 'pending').length,
    running: current.filter((item) => item.status === 'running').length,
    completed: current.filter((item) => item.status === 'completed').length,
    attention: current.filter((item) => item.status === 'attention').length,
    waitingProvider: current.filter((item) => item.status === 'waiting_provider').length,
    decisionRequired: current.filter((item) => item.status === 'decision_required').length,
    failed: current.filter((item) => item.status === 'failed').length,
    cancelled: current.filter((item) => item.status === 'cancelled').length,
  };
  const paused = state.blockedReason === 'admin_paused';
  const batches = [...batchById.values()];
  const visibleBatches = [
    ...batches.filter((batch) => Number(batch.pending || 0) + Number(batch.running || 0) > 0),
    ...batches.filter((batch) => Number(batch.pending || 0) + Number(batch.running || 0) === 0),
  ].slice(0, 20);
  return {
    running: !paused && (state.activeItems.length > 0 || state.pending.length > 0),
    paused,
    active: state.active,
    activeItems: state.activeItems,
    pending: state.pending.length,
    recent: state.results.slice(0, 100),
    // Panel zachowuje status ostatniego zadania każdego produktu, lecz dla
    // zakończonych pozycji nie pobiera ponownie ciężkich wyników i dowodów JSON.
    // Pełne szczegóły ostatnich pozycji pozostają w `recent` i historii.
    current: lightweightCurrent.slice(0, ALLEGRO_PREPARATION_MAX_RESULTS),
    currentSummary,
    batches: visibleBatches,
    blockedUntil: state.blockedUntil,
    blockedReason: state.blockedReason,
    updatedAt: state.updatedAt,
  };
}
