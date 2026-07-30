import crypto from 'node:crypto';
import { assertPostgresRelations } from '../core/postgres-schema-contract.mjs';

const STATE_KEY = 'allegro_preparation_queue';

export function createPostgresAllegroPreparationQueue({
  pool,
  namespace = 'artway-sklep',
  readVersioned,
  prepare,
  report = null,
  onIdle = null,
  afterPrepare = null,
  now = () => new Date(),
} = {}, tools = {}) {
  const {
    clean, asArray, asObject, initialState, normalizeTask, normalizeState,
    publicState, providerQuotaUnavailable, MAX_AUTOMATIC_REMEDIATION_ATTEMPTS,
  } = tools;
  const ns = clean(namespace, 120) || 'artway-sklep';
  let schemaPromise = null;
  let workerPromise = null;
  let editorialProviderUnavailable = false;

  const ensureSchema = async () => {
    if (!schemaPromise) {
      schemaPromise = assertPostgresRelations(pool, [
        'artway_allegro_preparation_tasks',
        'artway_allegro_preparation_batches',
        'artway_allegro_preparation_state',
      ], 'kolejki przygotowania Allegro').then(async () => {
        await pool.query(`
          INSERT INTO artway_allegro_preparation_state(namespace)
          VALUES($1)
          ON CONFLICT(namespace) DO NOTHING
        `, [ns]);
      });
    }
    return schemaPromise;
  };

  const taskFromRow = (row = {}) => normalizeTask({
    id: row.task_id,
    batchId: row.batch_id,
    productId: row.product_id,
    operation: row.operation,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at instanceof Date ? row.requested_at.toISOString() : row.requested_at,
    priority: row.priority,
    priorityReason: row.priority_reason,
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
            status: ['completed', 'attention', 'waiting_provider', 'decision_required', 'failed'].includes(result.status) ? result.status : 'failed',
            result,
          })),
        ];
        for (const { task, status, result } of tasks) {
          await client.query(`
            INSERT INTO artway_allegro_preparation_tasks(
              namespace,task_id,batch_id,product_id,operation,requested_by,requested_at,
              attempt,skip_editorial,status,result,completed_at,updated_at
            ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,
              CASE WHEN $10 IN ('completed','attention','waiting_provider','decision_required','failed') THEN NOW() ELSE NULL END,NOW())
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
      pool.query("SELECT * FROM artway_allegro_preparation_tasks WHERE namespace=$1 AND status IN ('completed','attention','waiting_provider','decision_required','failed') ORDER BY completed_at DESC NULLS LAST,updated_at DESC LIMIT 1000", [ns]),
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

  const enqueue = async (productIds = [], {
    operation = 'allegro',
    requestedBy = 'administrator',
    priorityByProduct = {},
    priorityReasonByProduct = {},
    defaultPriority = 1000,
  } = {}) => {
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
          priority: Number(priorityByProduct?.[productId]) || defaultPriority,
          priorityReason: priorityReasonByProduct?.[productId] || '',
        });
        const inserted = await client.query(`
          INSERT INTO artway_allegro_preparation_tasks(
            namespace,task_id,batch_id,product_id,operation,requested_by,requested_at,
            priority,priority_reason,status
          ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
          ON CONFLICT DO NOTHING
          RETURNING *
        `, [
          ns, task.id, batchId, productId, task.operation, task.requestedBy, requestedAt,
          task.priority, task.priorityReason,
        ]);
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
      await client.query(
        'SELECT namespace FROM artway_allegro_preparation_state WHERE namespace=$1 FOR UPDATE',
        [ns],
      );
      const selected = await client.query(`
        SELECT * FROM artway_allegro_preparation_tasks
        WHERE namespace=$1 AND status='pending'
        ORDER BY priority DESC,requested_at,task_id
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
      `, [ns, row.task_id, editorialProviderUnavailable]);
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
      nextRetryAt: clean(result?.nextRetryAt, 50),
      decision: asObject(result?.decision),
      downstream: asObject(result?.downstream),
    };
    await pool.query(`
      UPDATE artway_allegro_preparation_tasks
      SET status=$3,result=$4::jsonb,completed_at=NOW(),updated_at=NOW()
      WHERE namespace=$1 AND task_id=$2
    `, [ns, task.id, item.status, JSON.stringify(item)]);
  };

  const requeue = async (task, result) => {
    const item = {
      id: task.id,
      batchId: task.batchId,
      productId: task.productId,
      operation: task.operation,
      requestedAt: task.requestedAt,
      status: 'pending',
      ready: false,
      name: clean(result?.name, 300),
      missing: asArray(result?.missing).map((entry) => clean(entry, 500)).filter(Boolean).slice(0, 50),
      savedFields: asArray(result?.savedFields).map((entry) => clean(entry, 120)).filter(Boolean).slice(0, 100),
      mutationId: clean(result?.mutationId, 160),
      error: clean(result?.error, 1000),
      nextRetryAt: clean(result?.nextRetryAt, 50),
    };
    await pool.query(`
      UPDATE artway_allegro_preparation_tasks
      SET status='pending',result=$3::jsonb,started_at=NULL,completed_at=NULL,updated_at=NOW()
      WHERE namespace=$1 AND task_id=$2
    `, [ns, task.id, JSON.stringify(item)]);
  };

  const run = async () => {
    while (true) {
      const task = await claim();
      if (!task) {
        const refill = typeof onIdle === 'function' ? await onIdle() : null;
        if (Number(refill?.enqueued || 0) > 0) continue;
        break;
      }
      if (typeof report === 'function') await report({ task, status: 'running' }).catch(() => {});
      try {
        let result = await prepare(task);
        const continueAutomatically = result?.status === 'attention'
          && result?.providerUnavailable !== true
          && Number(task.attempt || 0) < MAX_AUTOMATIC_REMEDIATION_ATTEMPTS;
        if (continueAutomatically) {
          await requeue(task, result);
          if (typeof report === 'function') {
            await report({
              task,
              status: 'pending',
              result: {
                ...result,
                message: `Automatyczna korekta trwa — próba ${Number(task.attempt || 0) + 1} z ${MAX_AUTOMATIC_REMEDIATION_ATTEMPTS} została już ustawiona w tej samej kolejce.`,
              },
            }).catch(() => {});
          }
          continue;
        }
        if (result?.status === 'attention') {
          result = {
            ...result,
            status: 'decision_required',
            decision: {
              reason: 'automatic_remediation_exhausted',
              missing: asArray(result?.missing),
              attempts: Number(task.attempt || 0),
            },
          };
        }
        if (typeof afterPrepare === 'function' && result?.ready === true) {
          let downstream;
          try {
            downstream = await afterPrepare(task, result);
          } catch (error) {
            downstream = {
              channel: 'vonHalsky',
              status: 'retry',
              ready: false,
              error: clean(error?.message || error, 1000),
            };
          }
          result = {
            ...result,
            downstream: asObject(downstream),
          };
        }
        await finish(task, result);
        if (typeof report === 'function') {
          await report({
            task,
            status: result?.status || (result?.ready === false ? 'decision_required' : 'completed'),
            result,
          }).catch(() => {});
        }
        if (result?.providerUnavailable === true || providerQuotaUnavailable(result?.error)) {
          editorialProviderUnavailable = true;
        }
      } catch (error) {
        const quotaUnavailable = providerQuotaUnavailable(error);
        let result = {
          status: quotaUnavailable
            ? 'waiting_provider'
            : Number(task.attempt || 0) < MAX_AUTOMATIC_REMEDIATION_ATTEMPTS
              ? 'pending'
              : 'decision_required',
          ready: false,
          providerUnavailable: quotaUnavailable,
          error: clean(error?.message || error, 1000),
          nextRetryAt: quotaUnavailable ? new Date(now().getTime() + 6 * 60 * 60_000).toISOString() : '',
          decision: quotaUnavailable || Number(task.attempt || 0) < MAX_AUTOMATIC_REMEDIATION_ATTEMPTS
            ? null
            : {
                reason: 'automatic_execution_failed',
                attempts: Number(task.attempt || 0),
                error: clean(error?.message || error, 1000),
              },
        };
        if (!quotaUnavailable && Number(task.attempt || 0) < MAX_AUTOMATIC_REMEDIATION_ATTEMPTS) {
          await requeue(task, result);
          if (typeof report === 'function') await report({ task, status: 'pending', result }).catch(() => {});
          continue;
        }
        await finish(task, result);
        if (typeof report === 'function') await report({ task, status: result.status, result }).catch(() => {});
        if (quotaUnavailable) editorialProviderUnavailable = true;
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
    editorialProviderUnavailable = false;
    await pool.query(`
      UPDATE artway_allegro_preparation_state
      SET blocked_until=NULL,blocked_reason='',updated_at=NOW()
      WHERE namespace=$1
    `, [ns]);
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
