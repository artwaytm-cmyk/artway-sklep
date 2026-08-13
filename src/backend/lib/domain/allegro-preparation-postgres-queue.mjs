import crypto from 'node:crypto';
import { assertPostgresRelations } from '../core/postgres-schema-contract.mjs';
import { finalizeFullProductPreparation } from './allegro-preparation-downstream.mjs';

const STATE_KEY = 'allegro_preparation_queue';

export function createPostgresAllegroPreparationQueue({
  pool,
  listenerPool = pool,
  namespace = 'artway-sklep',
  readVersioned,
  prepare,
  report = null,
  onIdle = null,
  afterPrepare = null,
  verifyCompleted = null,
  workerConcurrency = 1,
  now = () => new Date(),
} = {}, tools = {}) {
  const {
    clean, asArray, asObject, initialState, normalizeTask, normalizeState,
    publicState, providerQuotaUnavailable, MAX_AUTOMATIC_REMEDIATION_ATTEMPTS, MAX_PENDING = 2000,
  } = tools;
  const ns = clean(namespace, 120) || 'artway-sklep';
  const concurrency = Math.max(1, Math.min(8, Number(workerConcurrency) || 1));
  let schemaPromise = null;
  let workerPromise = null;
  let editorialProviderUnavailable = false;
  const workerId = `preparation-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
  const leaseMs = 20 * 60_000;
  let listenerClient = null;
  let listenerPromise = null;
  let rerunRequested = false;
  let workerFailureCount = 0;
  let workerRetryTimer = null;

  const ensureSchema = async () => {
    if (!schemaPromise) {
      schemaPromise = assertPostgresRelations(pool, [
        'artway_allegro_preparation_tasks',
        'artway_allegro_preparation_batches',
        'artway_allegro_preparation_state',
        'artway_product_records',
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

  const cancelTrashedProductTasks = async () => {
    await ensureSchema();
    return pool.query(`
      UPDATE artway_allegro_preparation_tasks task
      SET status='cancelled',completed_at=COALESCE(completed_at,NOW()),
          lease_until=NULL,worker_id='',
          result=result || jsonb_build_object(
            'cancelledAt',NOW(),
            'reason','product_in_trash',
            'automatic',TRUE
          ),
          updated_at=NOW()
      WHERE task.namespace=$1
        AND task.status IN ('pending','attention','waiting_provider','decision_required','failed')
        AND EXISTS (
          SELECT 1
          FROM artway_product_records product
          WHERE product.namespace=task.namespace
            AND product.product_id=task.product_id
            AND product.record_status='trash'
        )
    `, [ns]);
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
    inputFingerprint: row.input_fingerprint,
    leaseUntil: row.lease_until instanceof Date ? row.lease_until.toISOString() : row.lease_until,
    workerId: row.worker_id,
  });

  const ensureListener = async () => {
    if (listenerClient) return;
    if (!listenerPromise) {
      listenerPromise = (async () => {
        const client = await listenerPool.connect();
        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          if (listenerClient === client) listenerClient = null;
          try { client.release(true); } catch {}
          listenerPromise = null;
        };
        client.on('notification', (message) => {
          if (message.channel === 'artway_agent_preparation' && String(message.payload || '') === ns) kick();
        });
        client.on('error', (error) => {
          console.error('allegro_preparation_listener', error);
          release();
          const timer = setTimeout(() => ensureListener().catch(() => {}), 5_000);
          timer.unref?.();
        });
        await client.query('LISTEN artway_agent_preparation');
        listenerClient = client;
      })().finally(() => {
        if (!listenerClient) listenerPromise = null;
      });
    }
    return listenerPromise;
  };

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
    await cancelTrashedProductTasks();
    const [pendingRows, activeRows, resultRows, batchRows, stateRows] = await Promise.all([
      pool.query("SELECT * FROM artway_allegro_preparation_tasks WHERE namespace=$1 AND status='pending' ORDER BY requested_at,task_id LIMIT 2000", [ns]),
      pool.query("SELECT * FROM artway_allegro_preparation_tasks WHERE namespace=$1 AND status='running' ORDER BY started_at,task_id LIMIT $2", [ns, concurrency]),
      pool.query(`
        SELECT task.*
        FROM artway_allegro_preparation_tasks task
        WHERE task.namespace=$1
          AND task.status IN ('completed','attention','waiting_provider','decision_required','failed','cancelled')
          AND NOT EXISTS (
            SELECT 1
            FROM artway_product_records product
            WHERE product.namespace=task.namespace
              AND product.product_id=task.product_id
              AND product.record_status='trash'
          )
        ORDER BY task.completed_at DESC NULLS LAST,task.updated_at DESC
        LIMIT 1000
      `, [ns]),
      pool.query('SELECT * FROM artway_allegro_preparation_batches WHERE namespace=$1 ORDER BY requested_at DESC LIMIT 100', [ns]),
      pool.query('SELECT * FROM artway_allegro_preparation_state WHERE namespace=$1', [ns]),
    ]);
    return normalizeState({
      pending: pendingRows.rows.map(taskFromRow),
      active: activeRows.rows[0] ? taskFromRow(activeRows.rows[0]) : null,
      activeItems: activeRows.rows.map(taskFromRow),
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
    inputFingerprintByProduct = {},
    skipEditorialByProduct = {},
    defaultPriority = 1000,
  } = {}) => {
    await migrateLegacy();
    const requestedIds = asArray(productIds).map((id) => clean(id, 100)).filter(Boolean);
    const ids = [...new Set(requestedIds)];
    if (!ids.length) throw Object.assign(new Error('Zaznacz co najmniej jeden produkt.'), { status: 422 });
    if (ids.length > MAX_PENDING) {
      throw Object.assign(new Error(`Jedna kolejka może zawierać maksymalnie ${MAX_PENDING} produktów. Nie uruchomiono częściowej kolejki.`), {
        status: 422,
        code: 'allegro_preparation_batch_too_large',
      });
    }
    const batchId = `allegro-prep-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
    const requestedAt = now().toISOString();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const occupiedRows = await client.query(
        "SELECT * FROM artway_allegro_preparation_tasks WHERE namespace=$1 AND product_id=ANY($2::text[]) AND status IN ('pending','running','attention','waiting_provider','decision_required','failed') FOR UPDATE",
        [ns, ids],
      );
      const occupied = new Map(occupiedRows.rows
        .filter((row) => ['pending', 'running'].includes(String(row.status)))
        .map((row) => [String(row.product_id), taskFromRow(row)]));
      const replaceableIds = occupiedRows.rows
        .filter((row) => !['pending', 'running'].includes(String(row.status)))
        .map((row) => String(row.task_id));
      if (replaceableIds.length) {
        await client.query(`
          UPDATE artway_allegro_preparation_tasks
          SET status='superseded',completed_at=COALESCE(completed_at,NOW()),lease_until=NULL,worker_id='',
              result=result || jsonb_build_object('supersededReason','new_preparation_attempt','supersededAt',NOW()),
              updated_at=NOW()
          WHERE namespace=$1 AND task_id=ANY($2::text[])
        `, [ns, replaceableIds]);
      }
      const fingerprints = Object.values(inputFingerprintByProduct || {}).filter(Boolean);
      const completedByFingerprint = new Map();
      if (fingerprints.length) {
        const previous = await client.query(`
          SELECT DISTINCT ON(product_id) *
          FROM artway_allegro_preparation_tasks
          WHERE namespace=$1 AND product_id=ANY($2::text[])
            AND input_fingerprint<>'' AND input_fingerprint=ANY($3::text[])
            AND status='completed'
          ORDER BY product_id,updated_at DESC
        `, [ns, ids, fingerprints]);
        for (const row of previous.rows) {
          const productId = String(row.product_id);
          if (String(row.input_fingerprint || '') === String(inputFingerprintByProduct?.[productId] || '')) {
            completedByFingerprint.set(productId, taskFromRow(row));
          }
        }
      }
      const created = [];
      for (const productId of ids) {
        if (occupied.has(productId) || completedByFingerprint.has(productId)) continue;
        const task = normalizeTask({
          id: crypto.randomUUID(), batchId, productId, operation, requestedBy, requestedAt,
          priority: Number(priorityByProduct?.[productId]) || defaultPriority,
          priorityReason: priorityReasonByProduct?.[productId] || '',
          inputFingerprint: inputFingerprintByProduct?.[productId] || '',
          skipEditorial: skipEditorialByProduct?.[productId] === true,
        });
        const inserted = await client.query(`
          INSERT INTO artway_allegro_preparation_tasks(
            namespace,task_id,batch_id,product_id,operation,requested_by,requested_at,
            priority,priority_reason,input_fingerprint,skip_editorial,status
          ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending')
          ON CONFLICT DO NOTHING
          RETURNING *
        `, [
          ns, task.id, batchId, productId, task.operation, task.requestedBy, requestedAt,
          task.priority, task.priorityReason, task.inputFingerprint, task.skipEditorial,
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
      const tracked = ids.map((id) => occupied.get(id) || createdByProduct.get(id) || completedByFingerprint.get(id)).filter(Boolean);
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
    await cancelTrashedProductTasks();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const control = await client.query(
        'SELECT namespace,blocked_reason FROM artway_allegro_preparation_state WHERE namespace=$1 FOR UPDATE',
        [ns],
      );
      if (control.rows[0]?.blocked_reason === 'admin_paused') {
        await client.query('COMMIT');
        return null;
      }
      await client.query(`
        UPDATE artway_allegro_preparation_tasks
        SET status=CASE WHEN attempt>=3 THEN 'decision_required' ELSE 'pending' END,
            started_at=NULL,lease_until=NULL,worker_id='',
            priority=CASE WHEN attempt<3 THEN 200000 ELSE priority END,
            priority_reason=CASE WHEN attempt<3 THEN 'recovered_worker_lease' ELSE priority_reason END,
            completed_at=CASE WHEN attempt>=3 THEN NOW() ELSE NULL END,
            result=CASE WHEN attempt>=3
              THEN result || jsonb_build_object('reason','worker_lease_expired')
              ELSE result END,
            updated_at=NOW()
        WHERE namespace=$1 AND status='running' AND lease_until<NOW()
      `, [ns]);
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
        SET status='running',attempt=attempt+1,skip_editorial=(skip_editorial OR $3),started_at=NOW(),
            lease_until=NOW()+($4::text || ' milliseconds')::interval,
            worker_id=$5,updated_at=NOW()
        WHERE namespace=$1 AND task_id=$2
        RETURNING *
      `, [ns, row.task_id, editorialProviderUnavailable, leaseMs, workerId]);
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
      SET status=$3,result=$4::jsonb,completed_at=NOW(),lease_until=NULL,worker_id='',updated_at=NOW()
      WHERE namespace=$1 AND task_id=$2 AND status='running' AND worker_id=$5
    `, [ns, task.id, item.status, JSON.stringify(item), task.workerId || workerId]);
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
      SET status='pending',result=$3::jsonb,started_at=NULL,completed_at=NULL,
          lease_until=NULL,worker_id='',updated_at=NOW()
      WHERE namespace=$1 AND task_id=$2 AND status='running' AND worker_id=$4
    `, [ns, task.id, JSON.stringify(item), task.workerId || workerId]);
  };

  const runWorker = async () => {
    while (true) {
      const task = await claim();
      if (!task) break;
      if (typeof report === 'function') await report({ task, status: 'running' }).catch(() => {});
      try {
        let result = await prepare(task);
        result = await finalizeFullProductPreparation({ afterPrepare, verifyCompleted, task, result, clean });
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

  const run = async () => {
    while (true) {
      await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
      const refill = typeof onIdle === 'function' ? await onIdle() : null;
      if (Number(refill?.enqueued || 0) <= 0) break;
    }
  };

  const scheduleWorkerRetry = () => {
    if (workerRetryTimer) return;
    const delay = Math.min(60_000, 5_000 * (2 ** Math.max(0, workerFailureCount - 1)));
    workerRetryTimer = setTimeout(() => {
      workerRetryTimer = null;
      rerunRequested = false;
      kick();
    }, delay);
    workerRetryTimer.unref?.();
  };

  function kick() {
    ensureListener().catch((error) => console.error('allegro_preparation_listener_start', error));
    if (workerPromise) {
      rerunRequested = true;
      return workerPromise;
    }
    if (workerRetryTimer) {
      rerunRequested = true;
      return Promise.resolve();
    }
    let failed = false;
    workerPromise = Promise.resolve().then(run).then(() => {
      workerFailureCount = 0;
    }).catch((error) => {
      failed = true;
      workerFailureCount = Math.min(8, workerFailureCount + 1);
      console.error('allegro_preparation_worker_retry', {
        code: clean(error?.code, 40),
        message: clean(error?.message || error, 500),
        attempt: workerFailureCount,
      });
    }).finally(() => {
      workerPromise = null;
      if (failed) {
        scheduleWorkerRetry();
        return;
      }
      if (rerunRequested) {
        rerunRequested = false;
        kick();
      }
    });
    return workerPromise;
  }

  const resume = async ({ recoverRunning = false } = {}) => {
    await migrateLegacy();
    await ensureListener().catch((error) => console.error('allegro_preparation_listener_start', error));
    editorialProviderUnavailable = false;
    await pool.query(`
      UPDATE artway_allegro_preparation_state
      SET blocked_until=NULL,blocked_reason='',updated_at=NOW()
      WHERE namespace=$1
    `, [ns]);
    if (recoverRunning) {
      await pool.query(`
        UPDATE artway_allegro_preparation_tasks
        SET status=CASE WHEN attempt>=3 THEN 'decision_required' ELSE 'pending' END,
            started_at=NULL,lease_until=NULL,worker_id='',
            priority=CASE WHEN attempt<3 THEN 200000 ELSE priority END,
            priority_reason=CASE WHEN attempt<3 THEN 'recovered_active_after_restart' ELSE priority_reason END,
            completed_at=CASE WHEN attempt>=3 THEN NOW() ELSE NULL END,updated_at=NOW()
        WHERE namespace=$1 AND status='running'
      `, [ns]);
    }
    kick();
    return status();
  };

  const pause = async ({ requestedBy = 'administrator' } = {}) => {
    await migrateLegacy();
    await pool.query(`
      UPDATE artway_allegro_preparation_state
      SET blocked_until=NULL,blocked_reason='admin_paused',updated_at=NOW()
      WHERE namespace=$1
    `, [ns]);
    return { ...(await status()), control: { action: 'pause', requestedBy: clean(requestedBy, 200) } };
  };

  const prioritize = async (productIds = [], {
    priority = 100_000,
    reason = 'administrator_priority',
    replaceExisting = true,
  } = {}) => {
    await migrateLegacy();
    const ids = [...new Set(asArray(productIds).map((id) => clean(id, 100)).filter(Boolean))];
    if (!ids.length) return { ...(await status()), priority: { matched: 0, activeFinishesSafely: true } };
    const selectedPriority = Math.max(10_001, Math.min(200_000, Number(priority) || 100_000));
    const client = await pool.connect();
    let matched = 0;
    try {
      await client.query('BEGIN');
      if (replaceExisting) {
        await client.query(`
          UPDATE artway_allegro_preparation_tasks
          SET priority=10000,priority_reason='previous_administrator_priority',updated_at=NOW()
          WHERE namespace=$1 AND status='pending' AND priority>10000
        `, [ns]);
      }
      const result = await client.query(`
        UPDATE artway_allegro_preparation_tasks
        SET priority=$3,priority_reason=$4,updated_at=NOW()
        WHERE namespace=$1 AND status='pending' AND product_id=ANY($2::text[])
      `, [ns, ids, selectedPriority, clean(reason, 160)]);
      matched = result.rowCount;
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    kick();
    return { ...(await status()), priority: { matched, activeFinishesSafely: true } };
  };

  const cancel = async ({ batchId = '', requestedBy = 'administrator' } = {}) => {
    await migrateLegacy();
    const id = clean(batchId, 120);
    const values = [ns, clean(requestedBy, 200)];
    // Partia może śledzić zadanie utworzone wcześniej (deduplikacja przy enqueue),
    // dlatego anulowanie musi opierać się na tracked_task_ids, a nie wyłącznie
    // na batch_id zapisanym w samym zadaniu.
    const batchClause = id ? ` AND task_id IN (
      SELECT jsonb_array_elements_text(tracked_task_ids)
      FROM artway_allegro_preparation_batches
      WHERE namespace=$1 AND batch_id=$3
    )` : '';
    if (id) values.push(id);
    const result = await pool.query(`
      UPDATE artway_allegro_preparation_tasks
      SET status='cancelled',completed_at=NOW(),lease_until=NULL,worker_id='',
          result=result || jsonb_build_object(
            'cancelledAt',NOW(),'cancelledBy',$2::text,
            'reason','administrator_cancelled_pending_task'
          ),updated_at=NOW()
      WHERE namespace=$1 AND status='pending'${batchClause}
    `, values);
    return {
      ...(await status()),
      control: { action: 'cancel', batchId: id, cancelled: result.rowCount, activeFinishesSafely: true },
    };
  };

  const cancelPrevious = async ({ beforeBatchId = '', requestedBy = 'administrator' } = {}) => {
    await migrateLegacy();
    const id = clean(beforeBatchId, 120);
    if (!id) throw Object.assign(new Error('Brak partii, względem której mają zostać anulowane wcześniejsze zadania.'), { status: 422 });
    const result = await pool.query(`
      UPDATE artway_allegro_preparation_tasks
      SET status='cancelled',completed_at=NOW(),lease_until=NULL,worker_id='',
          result=result || jsonb_build_object(
            'cancelledAt',NOW(),'cancelledBy',$2::text,
            'reason','administrator_cancelled_previous_pending_task',
            'keptBatchId',$3::text
          ),updated_at=NOW()
      WHERE namespace=$1 AND status='pending'
        AND requested_at < (
          SELECT requested_at FROM artway_allegro_preparation_batches
          WHERE namespace=$1 AND batch_id=$3
        )
        AND task_id NOT IN (
          SELECT jsonb_array_elements_text(tracked_task_ids)
          FROM artway_allegro_preparation_batches
          WHERE namespace=$1 AND batch_id=$3
        )
    `, [ns, clean(requestedBy, 200), id]);
    kick();
    return {
      ...(await status()),
      control: { action: 'cancel_previous', beforeBatchId: id, cancelled: result.rowCount, activeFinishesSafely: true },
    };
  };

  const resolveProduct = async (productId, {
    reason = 'confirmed_outside_preparation_queue',
    offerId = '',
  } = {}) => {
    await migrateLegacy();
    const id = clean(productId, 100);
    if (!id) return { modified: 0 };
    const result = await pool.query(`
      UPDATE artway_allegro_preparation_tasks
      SET status='superseded',completed_at=COALESCE(completed_at,NOW()),
          lease_until=NULL,worker_id='',
          result=result || jsonb_build_object(
            'reason',$3::text,
            'resolvedAt',NOW(),
            'offerId',$4::text,
            'replacedBy','confirmed_product_record'
          ),
          updated_at=NOW()
      WHERE namespace=$1 AND product_id=$2
        AND status IN ('pending','running','attention','waiting_provider','decision_required','failed')
    `, [ns, id, clean(reason, 160), clean(offerId, 120)]);
    return { modified: result.rowCount };
  };

  const findTask = async (taskId = '', productId = '') => {
    await migrateLegacy();
    const id = clean(taskId, 120);
    const targetProductId = clean(productId, 100);
    if (!id || !targetProductId) return null;
    const result = await pool.query(`
      SELECT * FROM artway_allegro_preparation_tasks
      WHERE namespace=$1 AND task_id=$2 AND product_id=$3
      LIMIT 1
    `, [ns, id, targetProductId]);
    const row = result.rows[0];
    if (!row) return null;
    return {
      ...asObject(row.result),
      ...taskFromRow(row),
      status: clean(row.status, 40),
      completedAt: row.completed_at instanceof Date ? row.completed_at.toISOString() : (row.completed_at || ''),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : (row.updated_at || ''),
    };
  };

  const status = async () => publicState(await readState());
  return Object.freeze({ enqueue, status, prioritize, pause, resume, cancel, cancelPrevious, kick, resolveProduct, findTask });
}
