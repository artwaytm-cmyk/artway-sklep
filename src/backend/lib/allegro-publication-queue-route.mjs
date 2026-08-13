import crypto from 'node:crypto';
import { assertPostgresRelations } from './core/postgres-schema-contract.mjs';
import {
  ALLEGRO_PUBLICATION_RESOLUTIONS,
  createAllegroPreparationDecisionLearning,
  decorateAllegroPublicationStatus,
} from './domain/allegro-preparation-decisions.mjs';

const MAX_BATCH = 500;
const OPEN_STATUSES = ['queued', 'running'];
const DECISION_STATUSES = ['decision_required', 'failed'];

function clean(value = '', limit = 500) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
}

function iso(value) {
  if (!value) return '';
  return value instanceof Date ? value.toISOString() : String(value);
}

function timestamp(value = '') {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Stare zadanie publikacji wolno zamknąć jako naprawione dopiero po nowym,
 * pełnym odczycie kartoteki. Sam wybór wariantu, zapis `ready` sprzed decyzji
 * ani brak błędu w kolejce nie są dowodem naprawy.
 */
export function publicationRepairReadbackConfirmed(row = {}, product = {}, report = {}) {
  if (row?.result?.adminResolution !== 'repair_then_review') return false;
  const decisionAt = timestamp(row?.result?.adminResolutionAt);
  const preparationConfirmedAt = Math.max(
    timestamp(product?.allegroAgentPreparationConfirmedAt),
    timestamp(row?.repair_completed_at),
  );
  return report?.ready === true
    && decisionAt > 0
    && preparationConfirmedAt > decisionAt;
}

function publicTask(row = {}, product = null) {
  return {
    id: row.task_id,
    batchId: row.batch_id,
    productId: row.product_id,
    productName: product?.nazwa || product?.name || `Produkt ${row.product_id}`,
    image: product?.zdjecie || product?.image || '',
    operation: row.operation,
    stock: Number(row.stock) || 0,
    status: row.status,
    attempts: Number(row.attempts) || 0,
    requestedBy: row.requested_by,
    approvedAt: iso(row.approved_at),
    createdAt: iso(row.created_at),
    startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at),
    updatedAt: iso(row.updated_at),
    targetId: row.target_id || '',
    errorCode: row.error_code || '',
    error: row.error_text || '',
    result: row.result && typeof row.result === 'object' ? row.result : {},
  };
}

export function createAllegroPublicationQueueRoute({
  pool,
  namespace = 'artway-sklep',
  respond,
  isAdmin,
  sessionOf,
  getProduct,
  getProducts = null,
  runtime,
  readVersioned,
  writeIfVersion,
  prepareProducts,
  reconcileTasks,
  preparationReport = null,
} = {}) {
  const ns = clean(namespace, 120) || 'artway-sklep';
  let schemaPromise = null;
  let reconciliationPromise = null;
  let lastAutomaticReconciliationAt = 0;
  const decisionLearning = createAllegroPreparationDecisionLearning({ readVersioned, writeIfVersion });

  async function ensureSchema() {
    if (!pool) throw Object.assign(new Error('Trwała kolejka publikacji wymaga PostgreSQL.'), { status: 503, code: 'publication_queue_unavailable' });
    if (!schemaPromise) {
      schemaPromise = assertPostgresRelations(pool, [
        'artway_allegro_publication_batches',
        'artway_allegro_publication_tasks',
        'artway_allegro_publication_queue_state',
      ], 'kolejki publikacji Allegro').then(() => pool.query(`
        INSERT INTO artway_allegro_publication_queue_state(namespace)
        VALUES($1) ON CONFLICT(namespace) DO NOTHING
      `, [ns]));
    }
    return schemaPromise;
  }

  async function productsFor(rows = []) {
    const ids = [...new Set(rows.map((row) => String(row.product_id || '')).filter(Boolean))];
    if (typeof getProducts === 'function') {
      const products = await getProducts(ids);
      return products instanceof Map ? products : new Map(Object.entries(products || {}));
    }
    const entries = await Promise.all(ids.map(async (id) => {
      try { return [id, await getProduct(id)]; } catch { return [id, null]; }
    }));
    return new Map(entries);
  }

  async function reconcileDecisionTasks({ taskId = '', force = false } = {}) {
    if (typeof reconcileTasks !== 'function') return { checked: 0, reconciled: 0, results: [] };
    const now = Date.now();
    if (!taskId && !force && now - lastAutomaticReconciliationAt < 30_000) {
      return { checked: 0, reconciled: 0, throttled: true, results: [] };
    }
    if (reconciliationPromise) return reconciliationPromise;
    lastAutomaticReconciliationAt = now;
    reconciliationPromise = (async () => {
      const rows = await pool.query(`
        SELECT * FROM artway_allegro_publication_tasks
        WHERE namespace=$1 AND status IN ('decision_required','failed')
          AND ($2::text<>'' AND task_id=$2 OR $2::text='' AND error_code='allegro_publication_unconfirmed')
        ORDER BY updated_at DESC LIMIT 50
      `, [ns, clean(taskId, 120)]);
      if (!rows.rowCount) return { checked: 0, reconciled: 0, results: [] };
      const productMap = await productsFor(rows.rows);
      const tasks = rows.rows.map((row) => publicTask(row, productMap.get(String(row.product_id))));
      const rawResults = await reconcileTasks(tasks);
      const results = Array.isArray(rawResults) ? rawResults : [];
      let reconciled = 0;
      for (const result of results) {
        const id = clean(result?.taskId, 120);
        if (!id) continue;
        if (result?.confirmed === true && clean(result.offerId, 120)) {
          const updated = await pool.query(`
            UPDATE artway_allegro_publication_tasks
            SET status='completed',completed_at=NOW(),target_id=$3,error_code='',error_text='',
                result=result||$4::jsonb,updated_at=NOW()
            WHERE namespace=$1 AND task_id=$2 AND status IN ('decision_required','failed')
          `, [ns, id, clean(result.offerId, 120), JSON.stringify({
            publicationConfirmed: true,
            readbackConfirmed: true,
            reconciledAt: new Date().toISOString(),
            reconciledBy: 'agent:remote-state-before-retry',
            learnedResolution: 'verify_remote_state',
            offerId: clean(result.offerId, 120),
            status: clean(result.status, 80),
            identity: result.identity || null,
          })]);
          if (updated.rowCount) reconciled += 1;
        } else if (result?.errorCode === 'allegro_catalog_identity_conflict') {
          await pool.query(`
            UPDATE artway_allegro_publication_tasks
            SET error_code='allegro_catalog_identity_conflict',error_text=$3,
                result=result||$4::jsonb,updated_at=NOW()
            WHERE namespace=$1 AND task_id=$2 AND status IN ('decision_required','failed')
          `, [ns, id, clean(result.reason || 'Wiele kartotek wskazuje tę samą ofertę. Agent nie może zgadnąć właściwego produktu.', 1200), JSON.stringify({
            remoteStateCheckedAt: new Date().toISOString(),
            remoteStateOfferId: clean(result.offerId, 120),
            remoteStateStatus: clean(result.status, 80),
            learnedResolution: 'verify_remote_state',
          })]);
        }
      }
      return { checked: tasks.length, reconciled, results };
    })().finally(() => { reconciliationPromise = null; });
    return reconciliationPromise;
  }

  async function closeConfirmedRepairTasks() {
    if (typeof preparationReport !== 'function') return { checked: 0, repaired: 0 };
    const rows = await pool.query(`
      SELECT publication.*,
        (SELECT MAX(preparation.completed_at)
         FROM artway_allegro_preparation_tasks preparation
         WHERE preparation.namespace=publication.namespace
           AND preparation.product_id=publication.product_id
           AND preparation.status='completed'
           AND preparation.result->>'ready'='true'
           AND preparation.result->'downstream'->>'readbackConfirmed'='true'
        ) repair_completed_at
      FROM artway_allegro_publication_tasks publication
      WHERE publication.namespace=$1 AND publication.status IN ('decision_required','failed')
        AND publication.result->>'adminResolution'='repair_then_review'
      ORDER BY publication.updated_at DESC LIMIT 100
    `, [ns]);
    if (!rows.rowCount) return { checked: 0, repaired: 0 };
    const productMap = await productsFor(rows.rows);
    let repaired = 0;
    for (const row of rows.rows) {
      const product = productMap.get(String(row.product_id));
      if (!product) continue;
      let report;
      try { report = preparationReport(product); } catch { continue; }
      if (!publicationRepairReadbackConfirmed(row, product, report)) continue;
      const repairedAt = new Date().toISOString();
      const updated = await pool.query(`
        UPDATE artway_allegro_publication_tasks
        SET status='repaired',completed_at=NOW(),error_code='',error_text='',
            result=result||$3::jsonb,updated_at=NOW()
        WHERE namespace=$1 AND task_id=$2 AND status IN ('decision_required','failed')
          AND result->>'adminResolution'='repair_then_review'
      `, [ns, row.task_id, JSON.stringify({
        repairConfirmed: true,
        repairConfirmedAt: repairedAt,
        repairReadbackReady: true,
        publicationRetried: false,
        publicationApprovalRequired: true,
      })]);
      if (!updated.rowCount) continue;
      repaired += 1;
      await runtime?.report?.({
        event: 'work_progress', source: 'allegro-publication-repair-readback',
        work: {
          id: `allegro-publication-repair:${row.task_id}`,
          productId: row.product_id,
          productName: product?.nazwa || product?.name || `Produkt ${row.product_id}`,
          channel: 'allegro', action: 'naprawa szkicu po błędzie publikacji',
          phase: 'repair_confirmed', status: 'confirmed',
          target: 'centralna kartoteka i szkic Allegro', targetRef: row.task_id,
          message: 'Naprawa szkicu potwierdzona pełnym odczytem. Nie wykonano publikacji; nadal wymaga ona osobnego zatwierdzenia.',
        },
      }).catch(() => {});
    }
    return { checked: rows.rowCount, repaired };
  }

  async function status() {
    await ensureSchema();
    await reconcileDecisionTasks().catch(() => null);
    await closeConfirmedRepairTasks().catch(() => null);
    const [taskRows, countRows, batchRows, stateRows] = await Promise.all([
      pool.query(`
        SELECT * FROM artway_allegro_publication_tasks
        WHERE namespace=$1
          AND (status IN ('queued','running','decision_required','failed') OR updated_at>NOW()-INTERVAL '7 days')
        ORDER BY CASE status WHEN 'running' THEN 0 WHEN 'queued' THEN 1 WHEN 'decision_required' THEN 2 WHEN 'failed' THEN 3 ELSE 4 END,
                 updated_at DESC
        LIMIT 300
      `, [ns]),
      pool.query(`
        SELECT status,COUNT(*)::integer count
        FROM artway_allegro_publication_tasks
        WHERE namespace=$1 GROUP BY status
      `, [ns]),
      pool.query(`
        SELECT b.*,
          COUNT(t.task_id) FILTER(WHERE t.status='queued')::integer pending,
          COUNT(t.task_id) FILTER(WHERE t.status='running')::integer running,
          COUNT(t.task_id) FILTER(WHERE t.status='completed')::integer completed,
          COUNT(t.task_id) FILTER(WHERE t.status='decision_required')::integer decision_required,
          COUNT(t.task_id) FILTER(WHERE t.status='failed')::integer failed,
          COUNT(t.task_id) FILTER(WHERE t.status='cancelled')::integer cancelled,
          COUNT(t.task_id) FILTER(WHERE t.status='repaired')::integer repaired
        FROM artway_allegro_publication_batches b
        LEFT JOIN LATERAL jsonb_array_elements_text(b.task_ids) tracked(task_id) ON TRUE
        LEFT JOIN artway_allegro_publication_tasks t
          ON t.namespace=b.namespace AND t.task_id=tracked.task_id
        WHERE b.namespace=$1
        GROUP BY b.namespace,b.batch_id
        ORDER BY b.requested_at DESC LIMIT 20
      `, [ns]),
      pool.query('SELECT * FROM artway_allegro_publication_queue_state WHERE namespace=$1', [ns]),
    ]);
    const productMap = await productsFor(taskRows.rows);
    const tasks = taskRows.rows.map((row) => publicTask(row, productMap.get(String(row.product_id))));
    const counts = { queued: 0, running: 0, completed: 0, decision_required: 0, failed: 0, cancelled: 0, repaired: 0 };
    for (const row of countRows.rows) counts[row.status] = Number(row.count) || 0;
    const batches = batchRows.rows.map((row) => ({
      id: row.batch_id,
      operation: row.operation,
      requestedBy: row.requested_by,
      requestedAt: iso(row.requested_at),
      productIds: Array.isArray(row.product_ids) ? row.product_ids : [],
      taskIds: Array.isArray(row.task_ids) ? row.task_ids : [],
      total: Number(row.total) || 0,
      enqueued: Number(row.enqueued) || 0,
      duplicatesSkipped: Number(row.duplicates_skipped) || 0,
      pending: Number(row.pending) || 0,
      running: Number(row.running) || 0,
      completed: Number(row.completed) || 0,
      decisionRequired: Number(row.decision_required) || 0,
      failed: Number(row.failed) || 0,
      cancelled: Number(row.cancelled) || 0,
      repaired: Number(row.repaired) || 0,
    }));
    const paused = stateRows.rows[0]?.paused === true;
    const raw = {
      paused,
      pausedBy: stateRows.rows[0]?.paused_by || '',
      updatedAt: iso(stateRows.rows[0]?.updated_at),
      active: tasks.find((task) => task.status === 'running') || null,
      pending: counts.queued,
      counts,
      current: tasks.filter((task) => [...OPEN_STATUSES, ...DECISION_STATUSES].includes(task.status)),
      recent: tasks.filter((task) => !OPEN_STATUSES.includes(task.status)).slice(0, 100),
      batches,
    };
    return decorateAllegroPublicationStatus(raw, await decisionLearning.read());
  }

  async function enqueue(items = [], { operation, requestedBy }) {
    await ensureSchema();
    const op = clean(operation, 20).toLowerCase();
    if (!['activate', 'draft', 'update'].includes(op)) throw Object.assign(new Error('Nieprawidłowa operacja publikacji Allegro.'), { status: 422, code: 'invalid_publication_operation' });
    const byProduct = new Map();
    for (const raw of Array.isArray(items) ? items : []) {
      const productId = clean(raw?.productId ?? raw?.id, 100);
      if (!productId) continue;
      byProduct.set(productId, { productId, stock: Math.max(0, Math.min(999999, Math.trunc(Number(raw?.stock) || 0))) });
    }
    const requested = [...byProduct.values()];
    if (!requested.length) throw Object.assign(new Error('Zaznacz co najmniej jeden produkt do publikacji.'), { status: 422, code: 'empty_publication_batch' });
    if (requested.length > MAX_BATCH) throw Object.assign(new Error(`Jedna publikacja może zawierać maksymalnie ${MAX_BATCH} produktów. Niczego nie uruchomiono częściowo.`), { status: 422, code: 'publication_batch_too_large' });
    const batchId = `allegro-pub-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
    const requestedAt = new Date().toISOString(), actor = clean(requestedBy || 'administrator', 200);
    const client = await pool.connect();
    const tracked = [], created = [];
    try {
      await client.query('BEGIN');
      const existingRows = await client.query(`
        SELECT * FROM artway_allegro_publication_tasks
        WHERE namespace=$1 AND product_id=ANY($2::text[]) AND status IN ('queued','running')
        FOR UPDATE
      `, [ns, requested.map((item) => item.productId)]);
      const existing = new Map(existingRows.rows.map((row) => [String(row.product_id), row]));
      for (const item of requested) {
        if (existing.has(item.productId)) {
          tracked.push(existing.get(item.productId));
          continue;
        }
        const taskId = crypto.randomUUID();
        const inserted = await client.query(`
          INSERT INTO artway_allegro_publication_tasks(
            namespace,task_id,batch_id,product_id,operation,stock,status,
            requested_by,approved_at,created_at,updated_at
          ) VALUES($1,$2,$3,$4,$5,$6,'queued',$7,$8,$8,$8)
          ON CONFLICT DO NOTHING RETURNING *
        `, [ns, taskId, batchId, item.productId, op, item.stock, actor, requestedAt]);
        if (inserted.rowCount) {
          await client.query(`
            UPDATE artway_allegro_publication_tasks
            SET status='cancelled',completed_at=NOW(),updated_at=NOW(),
                result=result||jsonb_build_object('supersededByTaskId',$4::text,'supersededAt',NOW())
            WHERE namespace=$1 AND product_id=$2 AND task_id<>$3
              AND status IN ('decision_required','failed')
          `, [ns, item.productId, taskId, taskId]);
          tracked.push(inserted.rows[0]);
          created.push(inserted.rows[0]);
        } else {
          const concurrent = await client.query(`
            SELECT * FROM artway_allegro_publication_tasks
            WHERE namespace=$1 AND product_id=$2 AND status IN ('queued','running') LIMIT 1
          `, [ns, item.productId]);
          if (concurrent.rowCount) tracked.push(concurrent.rows[0]);
        }
      }
      if (tracked.length !== requested.length) throw Object.assign(new Error(`Serwer przejął ${tracked.length} z ${requested.length} produktów. Cała operacja została wycofana.`), { status: 409, code: 'publication_batch_incomplete' });
      await client.query(`
        INSERT INTO artway_allegro_publication_batches(
          namespace,batch_id,operation,requested_by,requested_at,product_ids,task_ids,total,enqueued,duplicates_skipped
        ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10)
      `, [
        ns, batchId, op, actor, requestedAt,
        JSON.stringify(requested.map((item) => item.productId)),
        JSON.stringify(tracked.map((row) => row.task_id)),
        requested.length, created.length, requested.length - created.length,
      ]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
    await runtime?.report?.({
      event: 'work_progress', source: 'allegro-publication-queue',
      work: { id: batchId, channel: 'allegro', action: `publikacja ${requested.length} zatwierdzonych produktów`, phase: 'queued', status: 'pending', target: 'trwała kolejka publikacji Allegro', targetRef: batchId, message: `Serwer przyjął pełne zaznaczenie: ${requested.length} produktów.` },
    }).catch(() => {});
    return { batchId, ...(await status()) };
  }

  async function claim(workerId = '') {
    await ensureSchema();
    const worker = clean(workerId, 180) || `publication-${process.pid}`;
    const client = await pool.connect();
    let row = null;
    try {
      await client.query('BEGIN');
      await client.query(`
        UPDATE artway_allegro_publication_tasks
        SET status=CASE WHEN attempts>=3 THEN 'decision_required' ELSE 'queued' END,
            available_at=NOW(),started_at=NULL,lease_until=NULL,worker_id='',claim_token='',
            completed_at=CASE WHEN attempts>=3 THEN NOW() ELSE NULL END,
            error_code=CASE WHEN attempts>=3 THEN 'stale_worker_lease' ELSE error_code END,
            error_text=CASE WHEN attempts>=3 THEN 'Proces wykonawczy trzykrotnie utracił dzierżawę. Wybierz dalsze działanie.' ELSE error_text END,
            updated_at=NOW()
        WHERE namespace=$1 AND status='running' AND lease_until<NOW()
      `, [ns]);
      const state = await client.query('SELECT paused FROM artway_allegro_publication_queue_state WHERE namespace=$1 FOR UPDATE', [ns]);
      if (state.rows[0]?.paused) {
        await client.query('COMMIT');
        return null;
      }
      const selected = await client.query(`
        SELECT * FROM artway_allegro_publication_tasks
        WHERE namespace=$1 AND status='queued' AND available_at<=NOW()
        ORDER BY created_at,task_id FOR UPDATE SKIP LOCKED LIMIT 1
      `, [ns]);
      if (!selected.rowCount) {
        await client.query('COMMIT');
        return null;
      }
      const token = crypto.randomUUID();
      const updated = await client.query(`
        UPDATE artway_allegro_publication_tasks
        SET status='running',attempts=attempts+1,started_at=NOW(),lease_until=NOW()+INTERVAL '8 minutes',
            worker_id=$3,claim_token=$4,error_code='',error_text='',updated_at=NOW()
        WHERE namespace=$1 AND task_id=$2 RETURNING *
      `, [ns, selected.rows[0].task_id, worker, token]);
      row = updated.rows[0];
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
    const product = await getProduct(row.product_id).catch(() => null);
    const task = { ...publicTask(row, product), claimToken: row.claim_token, product };
    await runtime?.report?.({
      event: 'work_progress', source: 'allegro-publication-worker',
      work: { id: `allegro-publication:${row.task_id}`, productId: row.product_id, productName: task.productName, channel: 'allegro', action: 'publikacja zatwierdzonej oferty', phase: 'publication_api', status: 'running', target: 'Allegro API', targetRef: row.batch_id, message: `Serwer publikuje produkt ${row.product_id}; próba ${row.attempts}.` },
    }).catch(() => {});
    return task;
  }

  async function settle({ taskId, claimToken, ok, retryable = false, result = {}, errorCode = '', error = '' }) {
    await ensureSchema();
    const id = clean(taskId, 120), token = clean(claimToken, 120);
    const current = await pool.query(`
      SELECT * FROM artway_allegro_publication_tasks
      WHERE namespace=$1 AND task_id=$2 AND status='running' AND claim_token=$3
    `, [ns, id, token]);
    if (!current.rowCount) throw Object.assign(new Error('Zadanie publikacji nie jest już przypisane do tego procesu.'), { status: 409, code: 'publication_claim_lost' });
    const row = current.rows[0], canRetry = !ok && retryable && Number(row.attempts) < 3;
    const nextStatus = ok ? 'completed' : canRetry ? 'queued' : 'decision_required';
    const targetId = clean(result?.offerId || result?.offer?.id || result?.targetId, 120);
    const delaySeconds = Math.min(300, Math.max(20, Number(row.attempts) * 30));
    const updated = await pool.query(`
      UPDATE artway_allegro_publication_tasks
      SET status=$4,
          available_at=CASE WHEN $4='queued' THEN NOW()+($9::text||' seconds')::interval ELSE available_at END,
          completed_at=CASE WHEN $4 IN ('completed','decision_required','failed') THEN NOW() ELSE NULL END,
          lease_until=NULL,worker_id='',claim_token='',target_id=$5,error_code=$6,error_text=$7,
          result=result || $8::jsonb,updated_at=NOW()
      WHERE namespace=$1 AND task_id=$2 AND claim_token=$3
      RETURNING *
    `, [ns, id, token, nextStatus, targetId, clean(errorCode, 120), clean(error, 1200), JSON.stringify(result && typeof result === 'object' ? result : {}), delaySeconds]);
    const product = await getProduct(row.product_id).catch(() => null);
    const publicRow = publicTask(updated.rows[0], product);
    await runtime?.report?.({
      event: 'work_progress', source: 'allegro-publication-worker',
      work: { id: `allegro-publication:${id}`, productId: row.product_id, productName: publicRow.productName, channel: 'allegro', action: 'publikacja zatwierdzonej oferty', phase: nextStatus, status: ok ? 'confirmed' : canRetry ? 'pending' : 'decision_required', target: 'Allegro API', targetRef: targetId || row.batch_id, error: ok ? '' : clean(error, 1000), message: ok ? `Oferta ${targetId || ''} została potwierdzona odczytem z Allegro.` : canRetry ? 'Błąd przejściowy; serwer sam ponowi to samo zadanie.' : 'Publikacja zatrzymana. W panelu jest konkretna decyzja i przejście do edytora.' },
    }).catch(() => {});
    return publicRow;
  }

  async function control(action, { batchId = '', requestedBy = 'administrator' } = {}) {
    await ensureSchema();
    const op = clean(action, 30).toLowerCase(), actor = clean(requestedBy, 200), id = clean(batchId, 120);
    if (op === 'pause' || op === 'resume') {
      await pool.query(`
        UPDATE artway_allegro_publication_queue_state
        SET paused=$2,paused_by=$3,updated_at=NOW() WHERE namespace=$1
      `, [ns, op === 'pause', op === 'pause' ? actor : '']);
    } else if (op === 'cancel') {
      await pool.query(`
        UPDATE artway_allegro_publication_tasks
        SET status='cancelled',completed_at=NOW(),lease_until=NULL,worker_id='',claim_token='',
            result=result||jsonb_build_object('cancelledBy',$3::text,'cancelledAt',NOW()),updated_at=NOW()
        WHERE namespace=$1 AND status='queued' AND task_id IN(
          SELECT jsonb_array_elements_text(task_ids) FROM artway_allegro_publication_batches
          WHERE namespace=$1 AND batch_id=$2
        )
      `, [ns, id, actor]);
    } else if (op === 'cancel_previous') {
      if (!id) throw Object.assign(new Error('Brak bieżącej partii publikacji.'), { status: 422 });
      await pool.query(`
        UPDATE artway_allegro_publication_tasks
        SET status='cancelled',completed_at=NOW(),lease_until=NULL,worker_id='',claim_token='',
            result=result||jsonb_build_object('cancelledBy',$3::text,'cancelledAt',NOW(),'keptBatchId',$2::text),updated_at=NOW()
        WHERE namespace=$1 AND status='queued' AND created_at<(
          SELECT requested_at FROM artway_allegro_publication_batches WHERE namespace=$1 AND batch_id=$2
        ) AND task_id NOT IN(
          SELECT jsonb_array_elements_text(task_ids) FROM artway_allegro_publication_batches WHERE namespace=$1 AND batch_id=$2
        )
      `, [ns, id, actor]);
    } else throw Object.assign(new Error('Nieznana operacja kolejki publikacji.'), { status: 422 });
    await runtime?.report?.({ event: 'work_progress', source: 'administrator-publication-control', work: { id: `allegro-publication-control:${Date.now().toString(36)}`, channel: 'allegro', action: `${op} kolejki publikacji`, phase: 'queue_control', status: 'confirmed', target: 'trwała kolejka publikacji Allegro', targetRef: id, message: 'Decyzję administratora zapisano w PostgreSQL.' } }).catch(() => {});
    return status();
  }

  async function decide({ taskId = '', productId = '', resolutionId = '', remember = true, requestedBy = 'administrator' } = {}) {
    await ensureSchema();
    const id = clean(taskId, 120), product = clean(productId, 100), choice = clean(resolutionId, 50);
    const resolution = ALLEGRO_PUBLICATION_RESOLUTIONS[choice];
    if (!resolution) throw Object.assign(new Error('Nieznany wariant rozwiązania publikacji.'), { status: 422, code: 'invalid_allegro_publication_resolution' });
    const result = await pool.query(`
      SELECT * FROM artway_allegro_publication_tasks
      WHERE namespace=$1 AND task_id=$2 AND product_id=$3
        AND status IN ('decision_required','failed')
      LIMIT 1
    `, [ns, id, product]);
    if (!result.rowCount) throw Object.assign(new Error('Ta decyzja została już wykonana albo zastąpiona nowszym wynikiem.'), { status: 409, code: 'stale_allegro_publication_decision' });
    const catalogProduct = await getProduct(product).catch(() => null);
    const task = publicTask(result.rows[0], catalogProduct);
    let preparationQueue = null;
    let reconciliation = null;
    if (resolution.action === 'queue_verification') {
      reconciliation = await reconcileDecisionTasks({ taskId: id, force: true }).catch(() => null);
    }
    const readbackConfirmed = reconciliation?.results?.some((item) => item?.taskId === id && item?.confirmed === true) === true;
    if (['queue_repair', 'queue_verification'].includes(resolution.action) && !readbackConfirmed) {
      if (typeof prepareProducts !== 'function') throw Object.assign(new Error('Kolejka naprawy produktów jest chwilowo niedostępna.'), { status: 503, code: 'allegro_repair_queue_unavailable' });
      preparationQueue = await prepareProducts([product], {
        operation: resolution.action === 'queue_verification' ? 'allegro-publication-safe-verification' : 'allegro-publication-repair',
        requestedBy,
        defaultPriority: 130_000,
        prioritize: true,
        replaceExistingPriority: false,
        priorityReason: `administrator_publication_resolution:${choice}`,
      });
    }
    const learning = await decisionLearning.recordResolution({
      task,
      kind: 'publication',
      resolutionId: choice,
      selectedBy: clean(requestedBy, 200),
      remember: remember !== false,
    });
    await pool.query(`
      UPDATE artway_allegro_publication_tasks
      SET result=result||jsonb_build_object(
        'adminResolution',$3::text,'adminResolutionAt',NOW(),
        'adminResolutionRemembered',$4::boolean,'adminResolutionBy',$5::text
      ),updated_at=NOW()
      WHERE namespace=$1 AND task_id=$2
    `, [ns, id, choice, learning.remembered, clean(requestedBy, 200)]);
    await runtime?.report?.({
      event: 'work_progress', source: 'administrator-publication-resolution',
      work: {
        id: `allegro-publication-resolution:${id}:${Date.now().toString(36)}`,
        productId: product,
        productName: task.productName,
        channel: 'allegro',
        action: resolution.title,
        phase: resolution.action,
        status: 'confirmed',
        target: resolution.action === 'confirm_publication' ? 'potwierdzenie administratora przed Allegro API' : 'naprawa oferty Allegro',
        targetRef: id,
        message: learning.remembered ? `Wariant zapisano jako naukę dla problemu ${learning.signature}.` : 'Wariant wybrano jednorazowo.',
      },
    }).catch(() => {});
    return {
      resolution: { ...resolution, signature: learning.signature },
      remembered: learning.remembered,
      openEditor: resolution.action === 'editor',
      requiresPublicationConfirmation: resolution.action === 'confirm_publication',
      repairQueued: ['queue_repair', 'queue_verification'].includes(resolution.action) && !readbackConfirmed,
      reconciled: readbackConfirmed,
      reconciliation,
      preparationQueue,
      queue: await status(),
    };
  }

  return async function allegroPublicationQueueRoute(req, url, action) {
    const actions = ['allegro-publication-queue-status', 'allegro-publication-queue-enqueue', 'allegro-publication-queue-claim', 'allegro-publication-queue-complete', 'allegro-publication-queue-fail', 'allegro-publication-queue-control', 'allegro-publication-decision'];
    if (!actions.includes(action)) return null;
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    if (action === 'allegro-publication-queue-status') return respond({ ok: true, queue: await status() });
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    const body = await req.json().catch(() => ({}));
    const requestedBy = clean(sessionOf(req)?.email || body.requestedBy || 'agent-serwerowy', 200);
    if (action === 'allegro-publication-decision') return respond({ ok: true, ...(await decide({ taskId: body.taskId, productId: body.productId, resolutionId: body.resolutionId, remember: body.remember, requestedBy })) });
    if (action === 'allegro-publication-queue-enqueue') return respond({ ok: true, queued: true, queue: await enqueue(body.items, { operation: body.operation, requestedBy }) }, 202);
    if (action === 'allegro-publication-queue-claim') return respond({ ok: true, task: await claim(body.workerId) });
    if (action === 'allegro-publication-queue-complete') return respond({ ok: true, task: await settle({ taskId: body.taskId, claimToken: body.claimToken, ok: true, result: body.result }) });
    if (action === 'allegro-publication-queue-fail') return respond({ ok: true, task: await settle({ taskId: body.taskId, claimToken: body.claimToken, ok: false, retryable: body.retryable === true, result: body.result, errorCode: body.errorCode, error: body.error }) });
    return respond({ ok: true, queue: await control(body.action, { batchId: body.batchId, requestedBy }) });
  };
}
