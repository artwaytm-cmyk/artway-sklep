import crypto from 'node:crypto';
import { providerQuotaUnavailable } from './agent-specialists-support.mjs';

const STATE_KEY = 'allegro_preparation_queue';
const MAX_PENDING = 2000;
const MAX_RESULTS = 1000;
const MAX_ATTEMPTS = 10;
const AUTO_RETRY_INTERVALS = Object.freeze([
  15 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
  24 * 60 * 60_000,
]);

const clean = (value = '', limit = 500) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
const asArray = (value) => Array.isArray(value) ? value : [];
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

function initialState() {
  return {
    version: 1,
    pending: [],
    active: null,
    results: [],
    batches: [],
    blockedUntil: '',
    blockedReason: '',
    updatedAt: '',
  };
}

function normalizeTask(value = {}) {
  const source = asObject(value);
  return {
    id: clean(source.id || crypto.randomUUID(), 120),
    batchId: clean(source.batchId, 120),
    productId: clean(source.productId, 100),
    operation: clean(source.operation || 'allegro', 40),
    requestedBy: clean(source.requestedBy || 'administrator', 200),
    requestedAt: clean(source.requestedAt || new Date().toISOString(), 50),
    attempt: Math.max(0, Number(source.attempt) || 0),
    skipEditorial: source.skipEditorial === true,
  };
}

function normalizeState(value = {}) {
  const source = asObject(value);
  return {
    version: 1,
    pending: asArray(source.pending).map(normalizeTask).filter((item) => item.productId).slice(0, MAX_PENDING),
    active: source.active ? normalizeTask(source.active) : null,
    results: asArray(source.results).map((item) => ({ ...asObject(item), productId: clean(item?.productId, 100) })).filter((item) => item.productId).slice(0, MAX_RESULTS),
    batches: asArray(source.batches).map((item) => ({ ...asObject(item), id: clean(item?.id, 120) })).filter((item) => item.id).slice(0, 100),
    blockedUntil: clean(source.blockedUntil, 50),
    blockedReason: clean(source.blockedReason, 500),
    updatedAt: clean(source.updatedAt, 50),
  };
}

function publicState(value = {}) {
  const state = normalizeState(value);
  const batchById = new Map(state.batches.map((batch) => [batch.id, {
    ...batch, pending: 0, running: 0, completed: 0, attention: 0, failed: 0,
    pendingProductIds: [], activeProductId: '', unknown: 0,
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
  if (state.active) {
    taskState.set(state.active.id, { status: 'running', item: state.active });
    const batch = batchById.get(state.active.batchId);
    if (batch) {
      batch.running += 1;
      batch.activeProductId = state.active.productId;
    }
  }
  for (const item of state.results) {
    if (!taskState.has(item.id)) taskState.set(item.id, { status: item.status, item });
    const batch = batchById.get(item.batchId);
    if (!batch) continue;
    if (item.status === 'completed') batch.completed += 1;
    else if (item.status === 'attention') batch.attention += 1;
    else if (item.status === 'failed') batch.failed += 1;
  }
  // Nowe partie zapamiętują dokładne identyfikatory zadań. Dzięki temu
  // ponowne kliknięcie tych samych produktów śledzi istniejącą pracę,
  // zamiast tworzyć pusty raport albo pokazywać historyczne błędy.
  for (const batch of batchById.values()) {
    const trackedTaskIds = [...new Set(asArray(batch.trackedTaskIds).map((id) => clean(id, 120)).filter(Boolean))];
    if (!trackedTaskIds.length) continue;
    Object.assign(batch, {
      pending: 0, running: 0, completed: 0, attention: 0, failed: 0,
      pendingProductIds: [], activeProductId: '', unknown: 0,
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
        batch.activeProductId = tracked.item.productId;
      } else if (tracked.status === 'completed') batch.completed += 1;
      else if (tracked.status === 'attention') batch.attention += 1;
      else if (tracked.status === 'failed') batch.failed += 1;
    }
  }
  // Historia partii pozostaje dostępna, ale bieżący licznik produktu musi
  // uwzględniać wyłącznie jego najnowsze zadanie. Dawne "attention" nie może
  // wracać do licznika po późniejszym, poprawnym przygotowaniu.
  const currentByProduct = new Map();
  if (state.active) currentByProduct.set(state.active.productId, { ...state.active, status: 'running' });
  for (const item of state.pending) {
    if (!currentByProduct.has(item.productId)) currentByProduct.set(item.productId, { ...item, status: 'pending' });
  }
  for (const item of state.results) {
    if (!currentByProduct.has(item.productId)) currentByProduct.set(item.productId, item);
  }
  const current = [...currentByProduct.values()];
  const currentSummary = {
    total: current.length,
    pending: current.filter((item) => item.status === 'pending').length,
    running: current.filter((item) => item.status === 'running').length,
    completed: current.filter((item) => item.status === 'completed').length,
    attention: current.filter((item) => item.status === 'attention').length,
    failed: current.filter((item) => item.status === 'failed').length,
  };
  return {
    running: !!state.active || state.pending.length > 0,
    active: state.active,
    pending: state.pending.length,
    recent: state.results.slice(0, 100),
    current: current.slice(0, MAX_RESULTS),
    currentSummary,
    batches: [...batchById.values()].slice(0, 20),
    blockedUntil: state.blockedUntil,
    blockedReason: state.blockedReason,
    updatedAt: state.updatedAt,
  };
}

function parsedDate(value = '') {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function salePriority(product = {}) {
  const catalog = asObject(product._catalog);
  const availability = asObject(catalog.availability);
  const active = product.aktywny !== false
    && product.ukryty !== true
    && product.sprzedazAktywna !== false
    && product.saleAvailable !== false
    && availability.saleAvailable !== false
    && catalog.recordStatus !== 'trash';
  return active ? 20 : 0;
}

function activeAllegroOffer(product = {}) {
  const catalogChannel = asObject(asObject(product?._catalog).channels).allegro;
  const offerId = clean(
    product?.allegroOfferId || product?.offerId || catalogChannel?.offerId,
    120,
  );
  const status = clean(
    product?.allegroStatus || product?.allegroPublicationStatus || catalogChannel?.status,
    80,
  ).toUpperCase();
  return {
    offerId,
    status,
    active: Boolean(offerId) && !['ENDED', 'INACTIVE', 'ARCHIVED', 'DELETED'].includes(status),
  };
}

function explicitAllegroRepairSignal(product = {}) {
  const editorial = asObject(product?.contentEditorial);
  const queuedSourceUpdate = clean(editorial.status, 60).toLowerCase() === 'queued'
    && clean(editorial.queuedReason, 100).toLowerCase() === 'source_updated';
  return product?.forceEditorialRefresh === true
    || product?.allegroPublicationIntent === true
    || product?.allegroPreparationForce === true
    || queuedSourceUpdate
    || Boolean(clean(product?.allegroComplianceError, 1000))
    || Boolean(clean(product?.allegroPublicationLastErrorCode, 300));
}

/**
 * Aktywna, powiązana oferta jest już produktem sprzedażowym, a nie kandydatem
 * do ciągłej redakcji. Jej status i obecność kontroluje lekka synchronizacja
 * Allegro. Do ciężkiej kolejki wraca wyłącznie po jawnym sygnale naprawy.
 */
export function allegroAutomaticPreparationDisposition(product = {}) {
  const offer = activeAllegroOffer(product);
  const repairRequired = explicitAllegroRepairSignal(product);
  return {
    ...offer,
    repairRequired,
    verificationOnly: offer.active && !repairRequired,
    reason: offer.active && !repairRequired
      ? 'active_listing_verification_only'
      : repairRequired
        ? 'explicit_repair_signal'
        : 'not_active_on_allegro',
  };
}

/**
 * Wybiera pracę dla serwerowego Agenta bez dziennego limitu. Limit parametru
 * to wyłącznie rozmiar jednej bezpiecznej partii; następny cykl kontynuuje
 * od miejsca, w którym poprzedni skończył.
 */
export function selectAllegroPreparationCandidates(products = [], {
  now = new Date(),
  limit = 50,
  verificationAgeMs = 30 * 24 * 60 * 60_000,
  preparationCurrent = null,
} = {}) {
  const timestamp = now instanceof Date ? now.getTime() : parsedDate(now) || Date.now();
  const rows = products instanceof Map ? [...products.values()] : asArray(products);
  const candidates = [];
  for (const product of rows) {
    const id = clean(product?.id ?? product?.productId, 100);
    if (!id || asObject(product?._catalog).recordStatus === 'trash') continue;
    // Aktywne, kanonicznie powiązane oferty są weryfikowane przez okresową
    // synchronizację ofert. Nie wolno przepisywać ich opisów tylko dlatego,
    // że pochodzą sprzed wprowadzenia technicznego pokwitowania Agenta.
    if (allegroAutomaticPreparationDisposition(product).verificationOnly) continue;
    const status = clean(product?.allegroAgentPreparationStatus, 40).toLowerCase();
    const preparedAt = parsedDate(product?.allegroAgentPreparedAt || product?.allegroAgentPreparationConfirmedAt);
    const sourceChangedAt = Math.max(
      parsedDate(product?.sourceRefreshedAt),
    );
    const nextRetryAt = parsedDate(product?.allegroAgentPreparationNextRetryAt);
    const retryDue = !nextRetryAt || nextRetryAt <= timestamp || sourceChangedAt > preparedAt;
    const current = typeof preparationCurrent === 'function'
      ? preparationCurrent(product)
      : ['ready', 'published'].includes(status) && !asArray(product?.allegroAgentPreparationMissing).length;

    let priority = 0, reason = '';
    if (['needs_attention', 'attention', 'failed'].includes(status) && retryDue) {
      priority = 300 + salePriority(product);
      reason = 'wymaga_uzupelnienia';
    } else if (!status || status === 'new' || status === 'queued' || !preparedAt) {
      priority = 200 + salePriority(product);
      reason = 'nieprzygotowany';
    } else if (!current && retryDue) {
      priority = 260 + salePriority(product);
      reason = 'nieaktualne_przygotowanie';
    } else if (current && (
      sourceChangedAt > preparedAt
      || !preparedAt
      || timestamp - preparedAt >= verificationAgeMs
    )) {
      priority = 100 + salePriority(product);
      reason = sourceChangedAt > preparedAt ? 'zmienione_zrodlo' : 'weryfikacja_okresowa';
    }
    if (!priority) continue;
    candidates.push({
      id,
      priority,
      reason,
      preparedAt: preparedAt ? new Date(preparedAt).toISOString() : '',
      nextRetryAt: nextRetryAt ? new Date(nextRetryAt).toISOString() : '',
      retryCount: Math.max(0, Number(product?.allegroAgentPreparationRetryCount) || 0),
    });
  }
  return candidates
    .sort((left, right) => right.priority - left.priority
      || parsedDate(left.preparedAt) - parsedDate(right.preparedAt)
      || left.id.localeCompare(right.id, 'pl', { numeric: true }))
    .slice(0, Math.max(1, Math.min(1000, Number(limit) || 50)));
}

export function allegroPreparationRetryState(previous = {}, missing = [], {
  ready = false,
  now = new Date(),
} = {}) {
  if (ready) return { retryCount: 0, nextRetryAt: '' };
  const currentMissing = [...new Set(asArray(missing).map((item) => clean(item, 500)).filter(Boolean))].sort();
  const previousMissing = [...new Set(asArray(previous?.allegroAgentPreparationMissing).map((item) => clean(item, 500)).filter(Boolean))].sort();
  const same = JSON.stringify(currentMissing) === JSON.stringify(previousMissing);
  const retryCount = same ? Math.max(0, Number(previous?.allegroAgentPreparationRetryCount) || 0) + 1 : 1;
  const delay = AUTO_RETRY_INTERVALS[Math.min(AUTO_RETRY_INTERVALS.length - 1, retryCount - 1)];
  const timestamp = now instanceof Date ? now.getTime() : parsedDate(now) || Date.now();
  return { retryCount, nextRetryAt: new Date(timestamp + delay).toISOString() };
}

function createPostgresAllegroPreparationQueue({
  pool,
  namespace = 'artway-sklep',
  readVersioned,
  prepare,
  report = null,
  now = () => new Date(),
} = {}) {
  const ns = clean(namespace, 120) || 'artway-sklep';
  let schemaPromise = null;
  let workerPromise = null;
  let retryTimer = null;

  const ensureSchema = async () => {
    if (!schemaPromise) schemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS artway_allegro_preparation_tasks (
        namespace TEXT NOT NULL,
        task_id TEXT NOT NULL,
        batch_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        operation TEXT NOT NULL DEFAULT 'allegro',
        requested_by TEXT NOT NULL DEFAULT 'administrator',
        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        attempt INTEGER NOT NULL DEFAULT 0,
        skip_editorial BOOLEAN NOT NULL DEFAULT FALSE,
        status TEXT NOT NULL DEFAULT 'pending',
        result JSONB NOT NULL DEFAULT '{}'::jsonb,
        started_at TIMESTAMPTZ NULL,
        completed_at TIMESTAMPTZ NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(namespace, task_id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS artway_allegro_preparation_active_product_idx
        ON artway_allegro_preparation_tasks(namespace, product_id)
        WHERE status IN ('pending','running');
      CREATE INDEX IF NOT EXISTS artway_allegro_preparation_status_idx
        ON artway_allegro_preparation_tasks(namespace, status, requested_at, task_id);
      CREATE TABLE IF NOT EXISTS artway_allegro_preparation_batches (
        namespace TEXT NOT NULL,
        batch_id TEXT NOT NULL,
        operation TEXT NOT NULL DEFAULT 'allegro',
        requested_by TEXT NOT NULL DEFAULT 'administrator',
        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        requested_product_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        tracked_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        enqueued INTEGER NOT NULL DEFAULT 0,
        duplicates_skipped INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(namespace, batch_id)
      );
      CREATE INDEX IF NOT EXISTS artway_allegro_preparation_batches_requested_idx
        ON artway_allegro_preparation_batches(namespace, requested_at DESC);
      CREATE TABLE IF NOT EXISTS artway_allegro_preparation_state (
        namespace TEXT PRIMARY KEY,
        blocked_until TIMESTAMPTZ NULL,
        blocked_reason TEXT NOT NULL DEFAULT '',
        legacy_migrated BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      INSERT INTO artway_allegro_preparation_state(namespace)
      VALUES('${ns.replace(/'/g, "''")}')
      ON CONFLICT(namespace) DO NOTHING;
    `);
    return schemaPromise;
  };

  const taskFromRow = (row = {}) => normalizeTask({
    id: row.task_id,
    batchId: row.batch_id,
    productId: row.product_id,
    operation: row.operation,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at instanceof Date ? row.requested_at.toISOString() : row.requested_at,
    attempt: row.attempt,
    skipEditorial: row.skip_editorial,
  });

  const migrateLegacy = async () => {
    await ensureSchema();
    const marker = await pool.query(
      'SELECT legacy_migrated FROM artway_allegro_preparation_state WHERE namespace=$1',
      [ns],
    );
    if (marker.rows[0]?.legacy_migrated) return;
    const legacy = normalizeState((await readVersioned(STATE_KEY, initialState())).value);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query(
        'SELECT legacy_migrated FROM artway_allegro_preparation_state WHERE namespace=$1 FOR UPDATE',
        [ns],
      );
      if (!locked.rows[0]?.legacy_migrated) {
        const tasks = [
          ...legacy.pending.map((task) => ({ task, status: 'pending', result: {} })),
          ...(legacy.active ? [{ task: legacy.active, status: 'pending', result: {} }] : []),
          ...legacy.results.map((result) => ({
            task: normalizeTask(result),
            status: ['completed', 'attention', 'failed'].includes(result.status) ? result.status : 'failed',
            result,
          })),
        ];
        for (const { task, status, result } of tasks) {
          await client.query(`
            INSERT INTO artway_allegro_preparation_tasks(
              namespace,task_id,batch_id,product_id,operation,requested_by,requested_at,
              attempt,skip_editorial,status,result,completed_at,updated_at
            ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,
              CASE WHEN $10 IN ('completed','attention','failed') THEN NOW() ELSE NULL END,NOW())
            ON CONFLICT(namespace,task_id) DO NOTHING
          `, [
            ns, task.id, task.batchId, task.productId, task.operation, task.requestedBy,
            task.requestedAt, task.attempt, task.skipEditorial, status, JSON.stringify(result),
          ]);
        }
        for (const batch of legacy.batches) {
          await client.query(`
            INSERT INTO artway_allegro_preparation_batches(
              namespace,batch_id,operation,requested_by,requested_at,
              requested_product_ids,tracked_task_ids,enqueued,duplicates_skipped
            ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)
            ON CONFLICT(namespace,batch_id) DO NOTHING
          `, [
            ns, batch.id, clean(batch.operation, 40), clean(batch.requestedBy, 200),
            batch.requestedAt || now().toISOString(),
            JSON.stringify(asArray(batch.requestedProductIds)),
            JSON.stringify(asArray(batch.trackedTaskIds)),
            Number(batch.enqueued) || 0, Number(batch.duplicatesSkipped) || 0,
          ]);
        }
        await client.query(`
          UPDATE artway_allegro_preparation_state
          SET legacy_migrated=TRUE,blocked_until=$2,blocked_reason=$3,updated_at=NOW()
          WHERE namespace=$1
        `, [ns, legacy.blockedUntil || null, legacy.blockedReason || '']);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  };

  const readState = async () => {
    await migrateLegacy();
    const [pendingRows, activeRows, resultRows, batchRows, stateRows] = await Promise.all([
      pool.query("SELECT * FROM artway_allegro_preparation_tasks WHERE namespace=$1 AND status='pending' ORDER BY requested_at,task_id LIMIT 2000", [ns]),
      pool.query("SELECT * FROM artway_allegro_preparation_tasks WHERE namespace=$1 AND status='running' ORDER BY started_at,task_id LIMIT 1", [ns]),
      pool.query("SELECT * FROM artway_allegro_preparation_tasks WHERE namespace=$1 AND status IN ('completed','attention','failed') ORDER BY completed_at DESC NULLS LAST,updated_at DESC LIMIT 1000", [ns]),
      pool.query('SELECT * FROM artway_allegro_preparation_batches WHERE namespace=$1 ORDER BY requested_at DESC LIMIT 100', [ns]),
      pool.query('SELECT * FROM artway_allegro_preparation_state WHERE namespace=$1', [ns]),
    ]);
    return normalizeState({
      pending: pendingRows.rows.map(taskFromRow),
      active: activeRows.rows[0] ? taskFromRow(activeRows.rows[0]) : null,
      results: resultRows.rows.map((row) => ({
        ...asObject(row.result),
        id: row.task_id,
        batchId: row.batch_id,
        productId: row.product_id,
        operation: row.operation,
        requestedAt: row.requested_at instanceof Date ? row.requested_at.toISOString() : row.requested_at,
        completedAt: row.completed_at instanceof Date ? row.completed_at.toISOString() : row.completed_at,
        status: row.status,
      })),
      batches: batchRows.rows.map((row) => ({
        id: row.batch_id,
        operation: row.operation,
        requestedBy: row.requested_by,
        requestedAt: row.requested_at instanceof Date ? row.requested_at.toISOString() : row.requested_at,
        requestedProductIds: asArray(row.requested_product_ids),
        trackedTaskIds: asArray(row.tracked_task_ids),
        total: asArray(row.tracked_task_ids).length,
        enqueued: Number(row.enqueued) || 0,
        duplicatesSkipped: Number(row.duplicates_skipped) || 0,
      })),
      blockedUntil: stateRows.rows[0]?.blocked_until instanceof Date
        ? stateRows.rows[0].blocked_until.toISOString()
        : stateRows.rows[0]?.blocked_until || '',
      blockedReason: stateRows.rows[0]?.blocked_reason || '',
      updatedAt: stateRows.rows[0]?.updated_at instanceof Date
        ? stateRows.rows[0].updated_at.toISOString()
        : stateRows.rows[0]?.updated_at || '',
    });
  };

  const enqueue = async (productIds = [], { operation = 'allegro', requestedBy = 'administrator' } = {}) => {
    await migrateLegacy();
    const requestedIds = asArray(productIds).map((id) => clean(id, 100)).filter(Boolean);
    const ids = [...new Set(requestedIds)].slice(0, 1000);
    if (!ids.length) throw Object.assign(new Error('Zaznacz co najmniej jeden produkt.'), { status: 422 });
    const batchId = `allegro-prep-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
    const requestedAt = now().toISOString();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const occupiedRows = await client.query(
        "SELECT * FROM artway_allegro_preparation_tasks WHERE namespace=$1 AND product_id=ANY($2::text[]) AND status IN ('pending','running') FOR UPDATE",
        [ns, ids],
      );
      const occupied = new Map(occupiedRows.rows.map((row) => [String(row.product_id), taskFromRow(row)]));
      const created = [];
      for (const productId of ids) {
        if (occupied.has(productId)) continue;
        const task = normalizeTask({
          id: crypto.randomUUID(), batchId, productId, operation, requestedBy, requestedAt,
        });
        const inserted = await client.query(`
          INSERT INTO artway_allegro_preparation_tasks(
            namespace,task_id,batch_id,product_id,operation,requested_by,requested_at,status
          ) VALUES($1,$2,$3,$4,$5,$6,$7,'pending')
          ON CONFLICT DO NOTHING
          RETURNING *
        `, [ns, task.id, batchId, productId, task.operation, task.requestedBy, requestedAt]);
        if (inserted.rowCount) created.push(taskFromRow(inserted.rows[0]));
        else {
          const concurrent = await client.query(
            "SELECT * FROM artway_allegro_preparation_tasks WHERE namespace=$1 AND product_id=$2 AND status IN ('pending','running') LIMIT 1",
            [ns, productId],
          );
          if (concurrent.rowCount) occupied.set(productId, taskFromRow(concurrent.rows[0]));
        }
      }
      const createdByProduct = new Map(created.map((task) => [task.productId, task]));
      const tracked = ids.map((id) => occupied.get(id) || createdByProduct.get(id)).filter(Boolean);
      await client.query(`
        INSERT INTO artway_allegro_preparation_batches(
          namespace,batch_id,operation,requested_by,requested_at,
          requested_product_ids,tracked_task_ids,enqueued,duplicates_skipped
        ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)
      `, [
        ns, batchId, clean(operation, 40), clean(requestedBy, 200), requestedAt,
        JSON.stringify(tracked.map((task) => task.productId)),
        JSON.stringify(tracked.map((task) => task.id)),
        created.length, requestedIds.length - created.length,
      ]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    kick();
    return { batchId, ...publicState(await readState()) };
  };

  const claim = async () => {
    await migrateLegacy();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const state = await client.query(
        'SELECT blocked_until FROM artway_allegro_preparation_state WHERE namespace=$1 FOR UPDATE',
        [ns],
      );
      const editorialBlocked = Number.isFinite(Date.parse(state.rows[0]?.blocked_until || ''))
        && Date.parse(state.rows[0].blocked_until) > now().getTime();
      const selected = await client.query(`
        SELECT * FROM artway_allegro_preparation_tasks
        WHERE namespace=$1 AND status='pending'
        ORDER BY requested_at,task_id
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `, [ns]);
      if (!selected.rowCount) {
        await client.query('COMMIT');
        return null;
      }
      const row = selected.rows[0];
      const updated = await client.query(`
        UPDATE artway_allegro_preparation_tasks
        SET status='running',attempt=attempt+1,skip_editorial=$3,started_at=NOW(),updated_at=NOW()
        WHERE namespace=$1 AND task_id=$2
        RETURNING *
      `, [ns, row.task_id, editorialBlocked]);
      await client.query('COMMIT');
      return taskFromRow(updated.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  };

  const finish = async (task, result) => {
    const item = {
      id: task.id,
      batchId: task.batchId,
      productId: task.productId,
      operation: task.operation,
      requestedAt: task.requestedAt,
      completedAt: now().toISOString(),
      status: result?.status || (result?.ready === false ? 'attention' : 'completed'),
      ready: result?.ready === true,
      name: clean(result?.name, 300),
      missing: asArray(result?.missing).map((entry) => clean(entry, 500)).filter(Boolean).slice(0, 50),
      savedFields: asArray(result?.savedFields).map((entry) => clean(entry, 120)).filter(Boolean).slice(0, 100),
      mutationId: clean(result?.mutationId, 160),
      error: clean(result?.error, 1000),
    };
    await pool.query(`
      UPDATE artway_allegro_preparation_tasks
      SET status=$3,result=$4::jsonb,completed_at=NOW(),updated_at=NOW()
      WHERE namespace=$1 AND task_id=$2
    `, [ns, task.id, item.status, JSON.stringify(item)]);
  };

  const pauseForQuota = async () => {
    const blockedUntil = new Date(now().getTime() + 6 * 60 * 60_000).toISOString();
    await pool.query(`
      UPDATE artway_allegro_preparation_state
      SET blocked_until=$2,blocked_reason='OpenAI API quota',updated_at=NOW()
      WHERE namespace=$1
    `, [ns, blockedUntil]);
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => kick(), 6 * 60 * 60_000);
    retryTimer.unref?.();
  };

  const run = async () => {
    while (true) {
      const task = await claim();
      if (!task) break;
      if (typeof report === 'function') await report({ task, status: 'running' }).catch(() => {});
      try {
        const result = await prepare(task);
        await finish(task, result);
        if (typeof report === 'function') {
          await report({
            task,
            status: result?.ready === false ? 'attention' : 'completed',
            result,
          }).catch(() => {});
        }
        if (result?.providerUnavailable === true || providerQuotaUnavailable(result?.error)) await pauseForQuota();
      } catch (error) {
        const result = { status: 'failed', ready: false, error: clean(error?.message || error, 1000) };
        await finish(task, result);
        if (typeof report === 'function') await report({ task, status: 'failed', result }).catch(() => {});
        if (providerQuotaUnavailable(error)) await pauseForQuota();
      }
    }
  };

  function kick() {
    if (workerPromise) return workerPromise;
    workerPromise = Promise.resolve().then(run).finally(() => { workerPromise = null; });
    return workerPromise;
  }

  const resume = async () => {
    await migrateLegacy();
    await pool.query(`
      UPDATE artway_allegro_preparation_tasks
      SET status='pending',started_at=NULL,updated_at=NOW()
      WHERE namespace=$1 AND status='running'
    `, [ns]);
    kick();
    return status();
  };

  const status = async () => publicState(await readState());
  return Object.freeze({ enqueue, status, resume, kick });
}

export function createAllegroPreparationQueue({
  readVersioned,
  writeIfVersion,
  prepare,
  report = null,
  now = () => new Date(),
  pool = null,
  namespace = 'artway-sklep',
} = {}) {
  if (pool) {
    return createPostgresAllegroPreparationQueue({
      pool, namespace, readVersioned, prepare, report, now,
    });
  }
  if (typeof readVersioned !== 'function' || typeof writeIfVersion !== 'function' || typeof prepare !== 'function') {
    throw new Error('Kolejka przygotowania Allegro wymaga trwałego repozytorium i wykonawcy.');
  }

  let workerPromise = null;
  let retryTimer = null;

  async function mutate(callback) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const version = await readVersioned(STATE_KEY, initialState());
      const previous = normalizeState(version.value);
      const next = normalizeState(callback(previous));
      next.updatedAt = now().toISOString();
      const write = await writeIfVersion(STATE_KEY, next, version);
      if (write?.modified) return next;
    }
    const error = new Error('Nie udało się bezpiecznie zapisać kolejki przygotowania Allegro.');
    error.code = 'allegro_preparation_queue_conflict';
    throw error;
  }

  async function read() {
    const version = await readVersioned(STATE_KEY, initialState());
    return normalizeState(version.value);
  }

  async function enqueue(productIds = [], { operation = 'allegro', requestedBy = 'administrator' } = {}) {
    const requestedIds = asArray(productIds).map((id) => clean(id, 100)).filter(Boolean);
    const ids = [...new Set(requestedIds)].slice(0, 1000);
    if (!ids.length) {
      const error = new Error('Zaznacz co najmniej jeden produkt.');
      error.status = 422;
      throw error;
    }
    const batchId = `allegro-prep-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`, requestedAt = now().toISOString();
    const next = await mutate((state) => {
      const occupied = new Map([
        ...state.pending.map((item) => [item.productId, item]),
        ...(state.active ? [[state.active.productId, state.active]] : []),
      ]);
      const tasks = ids.filter((id) => !occupied.has(id)).map((productId) => normalizeTask({
        id: crypto.randomUUID(), batchId, productId, operation, requestedBy, requestedAt,
      }));
      const createdByProduct = new Map(tasks.map((task) => [task.productId, task]));
      const trackedTasks = ids.map((productId) => occupied.get(productId) || createdByProduct.get(productId)).filter(Boolean);
      return {
        ...state,
        pending: [...state.pending, ...tasks].slice(0, MAX_PENDING),
        batches: [{
          id: batchId,
          operation: clean(operation, 40),
          requestedBy: clean(requestedBy, 200),
          requestedAt,
          total: trackedTasks.length,
          enqueued: tasks.length,
          duplicatesSkipped: requestedIds.length - tasks.length,
          requestedProductIds: trackedTasks.map((task) => task.productId),
          trackedTaskIds: trackedTasks.map((task) => task.id),
        }, ...state.batches].slice(0, 100),
      };
    });
    kick();
    return { batchId, ...publicState(next) };
  }

  async function claim() {
    let claimed = null;
    await mutate((state) => {
      const blockedUntil = Date.parse(state.blockedUntil || '');
      if (state.active || !state.pending.length) return state;
      const editorialProviderBlocked = Number.isFinite(blockedUntil) && blockedUntil > now().getTime();
      claimed = normalizeTask({
        ...state.pending[0],
        attempt: Number(state.pending[0].attempt || 0) + 1,
        skipEditorial: editorialProviderBlocked,
      });
      return {
        ...state,
        active: claimed,
        pending: state.pending.slice(1),
        ...(editorialProviderBlocked ? {} : { blockedUntil: '', blockedReason: '' }),
      };
    });
    return claimed;
  }

  async function finish(task, result) {
    return mutate((state) => {
      const item = {
        id: task.id,
        batchId: task.batchId,
        productId: task.productId,
        operation: task.operation,
        requestedAt: task.requestedAt,
        completedAt: now().toISOString(),
        status: result?.status || (result?.ready === false ? 'attention' : 'completed'),
        ready: result?.ready === true,
        name: clean(result?.name, 300),
        missing: asArray(result?.missing).map((entry) => clean(entry, 500)).filter(Boolean).slice(0, 50),
        savedFields: asArray(result?.savedFields).map((entry) => clean(entry, 120)).filter(Boolean).slice(0, 100),
        mutationId: clean(result?.mutationId, 160),
        error: clean(result?.error, 1000),
      };
      return { ...state, active: state.active?.id === task.id ? null : state.active, results: [item, ...state.results].slice(0, MAX_RESULTS) };
    });
  }

  async function run() {
    const pauseForQuota = async () => {
      const blockedUntil = new Date(now().getTime() + 6 * 60 * 60_000).toISOString();
      await mutate((state) => ({ ...state, blockedUntil, blockedReason: 'OpenAI API quota' }));
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => kick(), 6 * 60 * 60_000);
      retryTimer.unref?.();
    };
    while (true) {
      const task = await claim();
      if (!task) break;
      if (typeof report === 'function') await report({ task, status: 'running' }).catch(() => {});
      try {
        const result = await prepare(task);
        await finish(task, result);
        if (typeof report === 'function') await report({ task, status: result?.ready === false ? 'attention' : 'completed', result }).catch(() => {});
        // Redaktorzy zapisują bezpieczne pola nawet wtedy, gdy dostawca AI zwróci
        // limit rozliczeniowy. Taki wynik nie jest wyjątkiem, dlatego kolejka musi
        // rozpoznać go jawnie i pozostawić następne produkty do późniejszego wznowienia.
        if (result?.providerUnavailable === true || providerQuotaUnavailable(result?.error)) {
          await pauseForQuota();
          // Limit dostawcy blokuje wyłącznie redakcję AI. Kolejne zadania nadal
          // pobierają źródło, kategorię, parametry i zapisują wynik do kartoteki.
          continue;
        }
      } catch (error) {
        const result = { status: 'failed', ready: false, error: clean(error?.message || error, 1000) };
        await finish(task, result);
        if (typeof report === 'function') await report({ task, status: 'failed', result }).catch(() => {});
        if (providerQuotaUnavailable(error)) {
          await pauseForQuota();
          continue;
        }
      }
    }
  }

  function kick() {
    if (workerPromise) return workerPromise;
    workerPromise = Promise.resolve().then(run).finally(() => { workerPromise = null; });
    return workerPromise;
  }

  async function resume() {
    await mutate((state) => state.active
      ? { ...state, pending: [{ ...state.active, attempt: Number(state.active.attempt || 0) }, ...state.pending], active: null }
      : state);
    kick();
    return status();
  }

  async function status() {
    return publicState(await read());
  }

  return Object.freeze({ enqueue, status, resume, kick });
}
