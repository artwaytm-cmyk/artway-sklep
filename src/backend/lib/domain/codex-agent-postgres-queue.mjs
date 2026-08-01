import crypto from 'node:crypto';
import { assertPostgresRelations } from '../core/postgres-schema-contract.mjs';

const MAX_ATTEMPTS = 3;
const LEASE_MS = 120_000;
const PANEL_TTL_MS = 30 * 60_000;
const WORKER_ONLINE_MS = 75_000;

const clean = (value = '', limit = 500) => String(value ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .trim()
  .slice(0, limit);

function queueError(message, code = 'codex_queue_error', status = 409) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function publicJob(row = {}) {
  const terminal = ['completed', 'failed', 'cancelled'].includes(row.status);
  return {
    id: clean(row.job_id, 160),
    claimToken: clean(row.claim_token, 200),
    text: terminal ? '' : clean(row.prompt, 4_000),
    context: terminal ? '' : clean(row.context, 4_000),
    response: row.status === 'completed' ? clean(row.response, 12_000) : '',
    user: clean(row.user_email, 160),
    requestId: clean(row.request_id, 160),
    channel: 'panel',
    kind: 'panel',
    attempts: Math.max(0, Number(row.attempts) || 0),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : clean(row.created_at, 50),
    expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : clean(row.expires_at, 50),
  };
}

export function createPostgresCodexAgentQueue({
  pool,
  listenerPool = pool,
  namespace = 'artway-sklep',
  now = () => new Date(),
  token = () => crypto.randomBytes(24).toString('base64url'),
} = {}) {
  const ns = clean(namespace, 120) || 'artway-sklep';
  let schemaPromise = null;
  let listenerPromise = null;
  let listenerClient = null;
  let lastPruneAt = 0;
  const waiters = new Set();

  async function ensureSchema() {
    if (!schemaPromise) {
      schemaPromise = assertPostgresRelations(
        pool,
        ['artway_agent_panel_jobs', 'artway_agent_workers'],
        'zdarzeniowej kolejki poleceń panelu',
      );
    }
    return schemaPromise;
  }

  function wake() {
    for (const resolve of waiters) resolve();
    waiters.clear();
  }

  async function ensureListener() {
    await ensureSchema();
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
          wake();
        };
        client.on('notification', (message) => {
          if (message.channel === 'artway_agent_panel' && String(message.payload || '') === ns) wake();
        });
        client.on('error', (error) => {
          console.error('codex_agent_listener', error);
          release();
          const timer = setTimeout(() => ensureListener().catch(() => {}), 5_000);
          timer.unref?.();
        });
        await client.query('LISTEN artway_agent_panel');
        listenerClient = client;
      })().finally(() => {
        if (!listenerClient) listenerPromise = null;
      });
    }
    return listenerPromise;
  }

  async function pruneIfNeeded() {
    if (now().getTime() - lastPruneAt < 60 * 60_000) return;
    lastPruneAt = now().getTime();
    await pool.query(`
      DELETE FROM artway_agent_panel_jobs
      WHERE namespace=$1 AND status IN ('completed','failed','cancelled')
        AND completed_at < NOW() - INTERVAL '30 days'
    `, [ns]);
    await pool.query(`
      DELETE FROM artway_agent_workers
      WHERE namespace=$1 AND last_seen_at < NOW() - INTERVAL '7 days'
    `, [ns]);
  }

  async function presence(client = pool) {
    const rows = await client.query(`
      SELECT worker_id,last_seen_at
      FROM artway_agent_workers
      WHERE namespace=$1 AND worker_type='panel'
      ORDER BY last_seen_at DESC LIMIT 1
    `, [ns]);
    const row = rows.rows[0];
    const seen = row?.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
    return {
      workerOnline: Boolean(seen && now().getTime() - seen <= WORKER_ONLINE_MS),
      workerLastSeenAt: seen ? new Date(seen).toISOString() : '',
      workerId: clean(row?.worker_id, 160),
    };
  }

  async function touchWorker(workerId, currentJobId = '') {
    await pool.query(`
      INSERT INTO artway_agent_workers(namespace,worker_id,worker_type,current_job_id,started_at,last_seen_at,updated_at)
      VALUES($1,$2,'panel',$3,NOW(),NOW(),NOW())
      ON CONFLICT(namespace,worker_id) DO UPDATE SET
        current_job_id=EXCLUDED.current_job_id,last_seen_at=NOW(),updated_at=NOW()
    `, [ns, workerId, currentJobId]);
  }

  async function enqueue(input = {}) {
    await ensureListener();
    await pruneIfNeeded().catch((error) => console.error('codex_agent_queue_prune', error));
    const requestId = clean(input.requestId, 160);
    const prompt = clean(input.text, 4_000);
    if (!requestId || !prompt) {
      throw queueError('Brakuje identyfikatora albo treści polecenia Agenta.', 'codex_queue_invalid_job', 422);
    }
    const jobId = `CX-${crypto.createHash('sha256').update(requestId).digest('hex').slice(0, 20)}`;
    const inserted = await pool.query(`
      INSERT INTO artway_agent_panel_jobs(
        namespace,job_id,request_id,user_email,prompt,context,status,available_at,expires_at,created_at,updated_at
      ) VALUES($1,$2,$3,$4,$5,$6,'queued',NOW(),NOW()+($7::text || ' milliseconds')::interval,NOW(),NOW())
      ON CONFLICT(namespace,request_id) DO NOTHING
      RETURNING *
    `, [ns, jobId, requestId, clean(input.user, 160), prompt, clean(input.context, 4_000), PANEL_TTL_MS]);
    const duplicate = !inserted.rowCount;
    const row = inserted.rows[0] || (await pool.query(
      'SELECT * FROM artway_agent_panel_jobs WHERE namespace=$1 AND request_id=$2',
      [ns, requestId],
    )).rows[0];
    return { job: publicJob(row), duplicate, status: row.status, ...(await presence()) };
  }

  async function tryClaim(workerId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        UPDATE artway_agent_panel_jobs
        SET status=CASE WHEN attempts >= $2 THEN 'failed' ELSE 'queued' END,
            available_at=CASE WHEN attempts >= $2 THEN available_at ELSE NOW() END,
            last_error=CASE WHEN attempts >= $2 AND last_error=''
              THEN 'Wygasła dzierżawa procesu wykonawczego.' ELSE last_error END,
            completed_at=CASE WHEN attempts >= $2 THEN NOW() ELSE NULL END,
            claimed_at=NULL,lease_until=NULL,worker_id='',claim_token='',updated_at=NOW()
        WHERE namespace=$1 AND status='running' AND lease_until<NOW()
      `, [ns, MAX_ATTEMPTS]);
      await client.query(`
        UPDATE artway_agent_panel_jobs
        SET status='failed',last_error='Polecenie wygasło przed rozpoczęciem.',
            prompt='',context='',completed_at=NOW(),updated_at=NOW()
        WHERE namespace=$1 AND status='queued' AND expires_at<=NOW()
      `, [ns]);
      const owned = await client.query(`
        SELECT * FROM artway_agent_panel_jobs
        WHERE namespace=$1 AND status='running' AND worker_id=$2 AND lease_until>NOW()
        ORDER BY claimed_at LIMIT 1 FOR UPDATE SKIP LOCKED
      `, [ns, workerId]);
      let row = owned.rows[0] || null;
      if (!row) {
        const selected = await client.query(`
          SELECT * FROM artway_agent_panel_jobs
          WHERE namespace=$1 AND status='queued' AND available_at<=NOW()
          ORDER BY created_at,job_id
          FOR UPDATE SKIP LOCKED LIMIT 1
        `, [ns]);
        if (selected.rowCount) {
          const claimToken = token();
          const updated = await client.query(`
            UPDATE artway_agent_panel_jobs
            SET status='running',attempts=attempts+1,claimed_at=NOW(),
                lease_until=NOW()+($3::text || ' milliseconds')::interval,
                worker_id=$4,claim_token=$5,updated_at=NOW()
            WHERE namespace=$1 AND job_id=$2 RETURNING *
          `, [ns, selected.rows[0].job_id, LEASE_MS, workerId, claimToken]);
          row = updated.rows[0];
        }
      }
      await client.query(`
        INSERT INTO artway_agent_workers(namespace,worker_id,worker_type,current_job_id,started_at,last_seen_at,updated_at)
        VALUES($1,$2,'panel',$3,NOW(),NOW(),NOW())
        ON CONFLICT(namespace,worker_id) DO UPDATE SET
          current_job_id=EXCLUDED.current_job_id,last_seen_at=NOW(),updated_at=NOW()
      `, [ns, workerId, row?.job_id || '']);
      await client.query('COMMIT');
      return row ? publicJob(row) : null;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function claim(workerIdInput = '', options = {}) {
    await ensureListener();
    const workerId = clean(workerIdInput, 160);
    if (!workerId) throw queueError('Brakuje identyfikatora procesu Agenta.', 'codex_queue_worker_required', 422);
    let job = await tryClaim(workerId);
    const waitMs = Math.max(0, Math.min(55_000, Number(options.waitMs) || 0));
    if (!job && waitMs) {
      await new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          waiters.delete(finish);
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(finish, waitMs);
        timer.unref?.();
        waiters.add(finish);
      });
      job = await tryClaim(workerId);
    }
    return { job, workerOnline: true, workerLastSeenAt: now().toISOString() };
  }

  async function heartbeat(input = {}) {
    await ensureSchema();
    const id = clean(input.id, 160), claimToken = clean(input.claimToken, 200);
    if (!id || !claimToken) throw queueError('Brakuje danych aktywnego zadania.', 'codex_queue_heartbeat_invalid', 422);
    const updated = await pool.query(`
      UPDATE artway_agent_panel_jobs
      SET lease_until=NOW()+($4::text || ' milliseconds')::interval,updated_at=NOW()
      WHERE namespace=$1 AND job_id=$2 AND status='running' AND claim_token=$3
      RETURNING worker_id,lease_until
    `, [ns, id, claimToken, LEASE_MS]);
    if (updated.rowCount) await touchWorker(updated.rows[0].worker_id, id);
    return {
      extended: updated.rowCount > 0,
      leaseUntil: updated.rows[0]?.lease_until instanceof Date ? updated.rows[0].lease_until.toISOString() : '',
    };
  }

  async function prepareDelivery(input = {}) {
    const id = clean(input.id, 160), claimToken = clean(input.claimToken, 200), response = clean(input.response, 12_000);
    if (!id || !claimToken || !response) throw queueError('Brakuje danych wyniku Agenta.', 'codex_queue_delivery_invalid', 422);
    const row = (await pool.query(
      'SELECT * FROM artway_agent_panel_jobs WHERE namespace=$1 AND job_id=$2',
      [ns, id],
    )).rows[0];
    if (!row) throw queueError('Nie znaleziono zadania Agenta.', 'codex_queue_job_not_found', 404);
    if (row.status === 'completed') return { job: publicJob(row), alreadyDelivered: true };
    if (row.status !== 'running' || row.claim_token !== claimToken) throw queueError('Wygasło prawo do zakończenia tego zadania.', 'codex_queue_claim_invalid');
    const updated = await pool.query(`
      UPDATE artway_agent_panel_jobs SET response=$4,updated_at=NOW()
      WHERE namespace=$1 AND job_id=$2 AND status='running' AND claim_token=$3 RETURNING *
    `, [ns, id, claimToken, response]);
    return { job: { ...publicJob(updated.rows[0]), response } };
  }

  async function markDelivered(input = {}) {
    const id = clean(input.id, 160), claimToken = clean(input.claimToken, 200);
    const updated = await pool.query(`
      UPDATE artway_agent_panel_jobs
      SET status='completed',prompt='',context='',completed_at=NOW(),lease_until=NULL,
          worker_id='',claim_token='',updated_at=NOW()
      WHERE namespace=$1 AND job_id=$2 AND status='running' AND claim_token=$3
      RETURNING *
    `, [ns, id, claimToken]);
    if (updated.rowCount) return { delivered: true, duplicate: false };
    const row = (await pool.query(
      'SELECT status FROM artway_agent_panel_jobs WHERE namespace=$1 AND job_id=$2', [ns, id],
    )).rows[0];
    if (!row) throw queueError('Nie znaleziono zadania Agenta.', 'codex_queue_job_not_found', 404);
    if (row.status === 'completed') return { delivered: true, duplicate: true };
    throw queueError('Wygasło prawo do zakończenia zadania.', 'codex_queue_claim_invalid');
  }

  async function fail(input = {}) {
    const id = clean(input.id, 160), claimToken = clean(input.claimToken, 200), error = clean(input.error, 500);
    const current = (await pool.query(
      'SELECT * FROM artway_agent_panel_jobs WHERE namespace=$1 AND job_id=$2', [ns, id],
    )).rows[0];
    if (!current) throw queueError('Nie znaleziono zadania Agenta.', 'codex_queue_job_not_found', 404);
    if (current.status === 'failed') return { accepted: false, retry: false, terminal: true, duplicate: true, status: 'failed' };
    if (current.status !== 'running' || current.claim_token !== claimToken) {
      return { accepted: false, retry: false, duplicate: false, status: current.status };
    }
    const attempts = Math.max(0, Number(current.attempts) || 0);
    const terminal = input.expired === true || attempts >= MAX_ATTEMPTS;
    const delayMs = Math.min(60_000, 10_000 * Math.max(1, attempts));
    await pool.query(`
      UPDATE artway_agent_panel_jobs
      SET status=$4,last_error=$5,available_at=NOW()+($6::text || ' milliseconds')::interval,
          prompt=CASE WHEN $4='failed' THEN '' ELSE prompt END,
          context=CASE WHEN $4='failed' THEN '' ELSE context END,
          response='',completed_at=CASE WHEN $4='failed' THEN NOW() ELSE NULL END,
          claimed_at=NULL,lease_until=NULL,worker_id='',claim_token='',updated_at=NOW()
      WHERE namespace=$1 AND job_id=$2 AND claim_token=$3
    `, [ns, id, claimToken, terminal ? 'failed' : 'queued', error || 'Nieznany błąd procesu Agenta', delayMs]);
    return { accepted: true, retry: !terminal, terminal, duplicate: false, status: terminal ? 'failed' : 'queued', attempts };
  }

  async function status() {
    await ensureSchema();
    await pruneIfNeeded().catch((error) => console.error('codex_agent_queue_prune', error));
    const rows = await pool.query(`
      SELECT status,count(*)::integer count
      FROM artway_agent_panel_jobs WHERE namespace=$1
      GROUP BY status
    `, [ns]);
    const raw = Object.fromEntries(rows.rows.map((row) => [row.status, Number(row.count) || 0]));
    const counts = {
      queued: raw.queued || 0,
      processing: raw.running || 0,
      delivering: 0,
      completed: raw.completed || 0,
      failed: raw.failed || 0,
      cancelled: raw.cancelled || 0,
    };
    const worker = await presence();
    return {
      workerOnline: worker.workerOnline,
      workerLastSeenAt: worker.workerLastSeenAt,
      counts,
      active: counts.queued + counts.processing,
      updatedAt: now().toISOString(),
    };
  }

  async function result(idInput = '') {
    const id = clean(idInput, 160);
    if (!id) throw queueError('Brakuje identyfikatora zadania Agenta.', 'codex_queue_job_required', 422);
    const row = (await pool.query(
      'SELECT * FROM artway_agent_panel_jobs WHERE namespace=$1 AND job_id=$2', [ns, id],
    )).rows[0];
    if (!row) throw queueError('Nie znaleziono zadania Agenta.', 'codex_queue_job_not_found', 404);
    return {
      id,
      status: row.status,
      response: row.status === 'completed' ? clean(row.response, 12_000) : '',
      error: row.status === 'failed' ? clean(row.last_error, 500) : '',
    };
  }

  return { claim, enqueue, fail, heartbeat, markDelivered, prepareDelivery, result, status };
}
