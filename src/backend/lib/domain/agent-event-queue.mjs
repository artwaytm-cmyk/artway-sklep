import crypto from 'node:crypto';
import { assertPostgresRelations } from '../core/postgres-schema-contract.mjs';

const FALLBACK_KEY = 'agent_event_queue';
const ACTIVE_STATUSES = new Set(['queued', 'running']);
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'decision_required', 'superseded', 'cancelled']);
const MAX_RECENT = 300;
const MAX_ATTEMPTS = 3;
const LEASE_MS = 15 * 60_000;
const MAX_CONCURRENCY = 3;

const clean = (value = '', limit = 500) => String(value ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .trim()
  .slice(0, limit);
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const array = (value) => Array.isArray(value) ? value : [];

function safePayload(value = {}) {
  const payload = object(value);
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, 'utf8') > 64 * 1024) {
    throw Object.assign(new Error('Zdarzenie Agenta jest zbyt duże.'), {
      code: 'agent_event_payload_too_large',
      status: 413,
    });
  }
  return JSON.parse(serialized);
}

function normalizeEvent(value = {}) {
  const event = object(value);
  return {
    id: clean(event.id || crypto.randomUUID(), 160),
    type: clean(event.type, 100),
    area: clean(event.area || 'system', 100),
    entityId: clean(event.entityId, 180),
    dedupeKey: clean(event.dedupeKey || `${event.type}:${event.entityId}`, 300),
    idempotencyKey: clean(event.idempotencyKey, 500),
    source: clean(event.source || 'server', 120),
    priority: Math.max(0, Math.min(1000, Number(event.priority) || 100)),
    payload: safePayload(event.payload),
    status: ['queued', 'running', 'completed', 'failed', 'decision_required', 'superseded', 'cancelled'].includes(event.status)
      ? event.status
      : 'queued',
    attempts: Math.max(0, Number(event.attempts) || 0),
    createdAt: clean(event.createdAt || new Date().toISOString(), 50),
    startedAt: clean(event.startedAt, 50),
    completedAt: clean(event.completedAt, 50),
    updatedAt: clean(event.updatedAt || event.createdAt || new Date().toISOString(), 50),
    availableAt: clean(event.availableAt || event.createdAt || new Date().toISOString(), 50),
    leaseUntil: clean(event.leaseUntil, 50),
    workerId: clean(event.workerId, 180),
    error: clean(event.error, 2000),
    result: object(event.result),
  };
}

function publicState(events = []) {
  const rows = array(events).map(normalizeEvent);
  const active = rows.filter((event) => ACTIVE_STATUSES.has(event.status));
  const recent = rows
    .filter((event) => TERMINAL_STATUSES.has(event.status))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 100);
  return {
    mode: 'event_driven',
    scheduledCycles: false,
    workerOnline: true,
    updatedAt: rows[0]?.updatedAt || '',
    active: active.length,
    queued: active.filter((event) => event.status === 'queued').length,
    running: active.filter((event) => event.status === 'running').length,
    current: active.find((event) => event.status === 'running') || null,
    activeItems: active.slice(0, 100),
    recent,
    counts: rows.reduce((result, event) => {
      result[event.status] = (result[event.status] || 0) + 1;
      return result;
    }, {}),
  };
}

export function createAgentEventQueue({
  pool = null,
  listenerPool = pool,
  namespace = 'artway-sklep',
  readVersioned = null,
  writeIfVersion = null,
  runtime = null,
  now = () => new Date(),
} = {}) {
  if (!pool && (typeof readVersioned !== 'function' || typeof writeIfVersion !== 'function')) {
    throw new Error('Kolejka zdarzeń Agenta wymaga PostgreSQL albo wersjonowanego repozytorium.');
  }
  const ns = clean(namespace, 120) || 'artway-sklep';
  const handlers = new Map();
  const concurrency = pool ? MAX_CONCURRENCY : 1;
  let schemaPromise = null;
  const workers = new Set();
  const workerId = `event-runtime-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
  let rerunRequested = false;
  let listenerPromise = null;
  let listenerClient = null;
  let wakeTimer = null;
  let lastPruneAt = 0;

  async function ensureSchema() {
    if (!pool) return;
    if (!schemaPromise) {
      schemaPromise = assertPostgresRelations(
        pool,
        ['artway_agent_events'],
        'kolejki zdarzeń Agenta',
      );
    }
    await schemaPromise;
  }

  async function ensureListener() {
    if (!pool || listenerClient) return;
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
          if (message.channel === 'artway_agent_events' && String(message.payload || '') === ns) kick();
        });
        client.on('error', (error) => {
          console.error('agent_event_listener', error);
          release();
          const timer = setTimeout(() => ensureListener().catch(() => {}), 5_000);
          timer.unref?.();
        });
        await client.query('LISTEN artway_agent_events');
        listenerClient = client;
      })().finally(() => {
        if (!listenerClient) listenerPromise = null;
      });
    }
    return listenerPromise;
  }

  async function pruneIfNeeded() {
    if (!pool || now().getTime() - lastPruneAt < 60 * 60_000) return;
    lastPruneAt = now().getTime();
    await ensureSchema();
    await pool.query(`
      DELETE FROM artway_agent_events
      WHERE namespace=$1
        AND status IN ('completed','failed','decision_required','superseded','cancelled')
        AND completed_at < NOW() - INTERVAL '30 days'
    `, [ns]);
    await pool.query(`
      DELETE FROM artway_agent_events
      WHERE namespace=$1
        AND status IN ('completed','failed','decision_required','superseded','cancelled')
        AND event_id NOT IN (
          SELECT event_id FROM artway_agent_events
          WHERE namespace=$1 AND status IN ('completed','failed','decision_required','superseded','cancelled')
          ORDER BY updated_at DESC
          LIMIT 5000
        )
    `, [ns]);
  }

  function fromRow(row = {}) {
    return normalizeEvent({
      id: row.event_id,
      type: row.event_type,
      area: row.area,
      entityId: row.entity_id,
      dedupeKey: row.dedupe_key,
      idempotencyKey: row.idempotency_key,
      source: row.source,
      priority: row.priority,
      payload: row.payload,
      status: row.status,
      attempts: row.attempts,
      result: row.result,
      error: row.last_error,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      startedAt: row.started_at instanceof Date ? row.started_at.toISOString() : row.started_at,
      completedAt: row.completed_at instanceof Date ? row.completed_at.toISOString() : row.completed_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
      availableAt: row.available_at instanceof Date ? row.available_at.toISOString() : row.available_at,
      leaseUntil: row.lease_until instanceof Date ? row.lease_until.toISOString() : row.lease_until,
      workerId: row.worker_id,
    });
  }

  async function fallbackChange(mutator) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const version = await readVersioned(FALLBACK_KEY, { items: [] });
      const previous = array(version.value?.items).map(normalizeEvent);
      const outcome = await mutator(previous);
      if (outcome?.write === false) return outcome.value;
      const items = array(outcome?.items)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, MAX_RECENT);
      const write = await writeIfVersion(FALLBACK_KEY, {
        items,
        updatedAt: now().toISOString(),
      }, version);
      if (write?.modified) return outcome?.value;
    }
    throw Object.assign(new Error('Nie udało się zapisać zdarzenia Agenta.'), {
      code: 'agent_event_write_conflict',
      status: 409,
    });
  }

  async function enqueue(input = {}) {
    const event = normalizeEvent({
      ...input,
      id: input.id || crypto.randomUUID(),
      idempotencyKey: input.idempotencyKey || `${input.dedupeKey || `${input.type}:${input.entityId}`}:${input.revisionKey || 'once'}`,
      createdAt: now().toISOString(),
      updatedAt: now().toISOString(),
      status: 'queued',
    });
    if (!event.type) {
      throw Object.assign(new Error('Brakuje typu zdarzenia Agenta.'), {
        code: 'agent_event_type_required',
        status: 422,
      });
    }
    let queued = event;
    let duplicate = false;
    if (pool) {
      await ensureSchema();
      await pruneIfNeeded().catch((error) => console.error('agent_event_prune', error));
      const inserted = await pool.query(`
        INSERT INTO artway_agent_events(
          namespace,event_id,event_type,area,entity_id,dedupe_key,idempotency_key,
          source,priority,payload,status,available_at,created_at,updated_at
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,'queued',NOW(),NOW(),NOW())
        ON CONFLICT DO NOTHING
        RETURNING *
      `, [
        ns, event.id, event.type, event.area, event.entityId, event.dedupeKey,
        event.idempotencyKey, event.source, event.priority, JSON.stringify(event.payload),
      ]);
      if (inserted.rowCount) queued = fromRow(inserted.rows[0]);
      else {
        duplicate = true;
        const existing = await pool.query(`
          SELECT * FROM artway_agent_events
          WHERE namespace=$1 AND (
            idempotency_key=$2 OR (dedupe_key=$3 AND status IN ('queued','running'))
          )
          ORDER BY CASE WHEN idempotency_key=$2 THEN 0 ELSE 1 END,created_at LIMIT 1
        `, [ns, event.idempotencyKey, event.dedupeKey]);
        queued = existing.rowCount ? fromRow(existing.rows[0]) : event;
      }
    } else {
      const outcome = await fallbackChange((items) => {
        const existing = items.find((item) => (
          item.idempotencyKey && item.idempotencyKey === event.idempotencyKey
        ) || (
          item.dedupeKey === event.dedupeKey && ACTIVE_STATUSES.has(item.status)
        ));
        if (existing) return { write: false, value: { event: existing, duplicate: true } };
        return { items: [event, ...items], value: { event, duplicate: false } };
      });
      queued = outcome.event;
      duplicate = outcome.duplicate;
    }
    kick();
    return { event: queued, duplicate };
  }

  async function enqueueMany(inputs = []) {
    const results = [];
    for (const input of array(inputs).slice(0, 2000)) results.push(await enqueue(input));
    return {
      queued: results.filter((item) => !item.duplicate).length,
      duplicates: results.filter((item) => item.duplicate).length,
      events: results.map((item) => item.event),
    };
  }

  async function claim() {
    if (pool) {
      await ensureSchema();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`
          UPDATE artway_agent_events
          SET status=CASE WHEN attempts >= $2 THEN 'failed' ELSE 'queued' END,
              available_at=CASE WHEN attempts >= $2 THEN available_at ELSE NOW() END,
              started_at=NULL,lease_until=NULL,worker_id='',
              completed_at=CASE WHEN attempts >= $2 THEN NOW() ELSE NULL END,
              last_error=CASE WHEN attempts >= $2 AND last_error=''
                THEN 'Wygasła dzierżawa procesu wykonawczego.' ELSE last_error END,
              updated_at=NOW()
          WHERE namespace=$1 AND status='running' AND lease_until<NOW()
        `, [ns, MAX_ATTEMPTS]);
        const selected = await client.query(`
          SELECT * FROM artway_agent_events
          WHERE namespace=$1 AND status='queued' AND available_at<=NOW()
          ORDER BY priority DESC,created_at,event_id
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        `, [ns]);
        if (!selected.rowCount) {
          await client.query('COMMIT');
          return null;
        }
        const updated = await client.query(`
          UPDATE artway_agent_events
          SET status='running',attempts=attempts+1,started_at=NOW(),
              lease_until=NOW()+($3::text || ' milliseconds')::interval,
              worker_id=$4,updated_at=NOW()
          WHERE namespace=$1 AND event_id=$2
          RETURNING *
        `, [ns, selected.rows[0].event_id, LEASE_MS, workerId]);
        await client.query('COMMIT');
        return fromRow(updated.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    }
    let claimed = null;
    await fallbackChange((items) => {
      claimed = null;
      const index = items
        .map((item, position) => ({ item, position }))
        .filter(({ item }) => item.status === 'queued')
        .sort((left, right) => right.item.priority - left.item.priority
          || left.item.createdAt.localeCompare(right.item.createdAt))[0]?.position;
      if (index === undefined) return { write: false, value: null };
      const timestamp = now().toISOString();
      claimed = normalizeEvent({
        ...items[index],
        status: 'running',
        attempts: items[index].attempts + 1,
        startedAt: timestamp,
        updatedAt: timestamp,
      });
      const next = [...items];
      next[index] = claimed;
      return { items: next, value: claimed };
    });
    return claimed;
  }

  async function settle(event, status, result = {}, error = '') {
    const completedAt = now().toISOString();
    if (pool) {
      await pool.query(`
        UPDATE artway_agent_events
        SET status=$3,result=$4::jsonb,last_error=$5,completed_at=$6,
            lease_until=NULL,worker_id='',updated_at=$6
        WHERE namespace=$1 AND event_id=$2 AND status='running' AND worker_id=$7
      `, [ns, event.id, status, JSON.stringify(object(result)), clean(error, 2000), completedAt, event.workerId || workerId]);
      return;
    }
    await fallbackChange((items) => ({
      items: items.map((item) => item.id === event.id ? normalizeEvent({
        ...item,
        status,
        result,
        error,
        completedAt,
        updatedAt: completedAt,
      }) : item),
    }));
  }

  async function retryOrFail(event, error) {
    const message = clean(error?.message || error, 2000);
    const retryable = error?.decisionRequired !== true
      && error?.retryable !== false
      && event.attempts < MAX_ATTEMPTS;
    if (!retryable) {
      await settle(event, error?.decisionRequired === true ? 'decision_required' : 'failed', {}, message);
      return;
    }
    if (pool) {
      const delayMs = Math.min(5 * 60_000, 15_000 * (2 ** Math.max(0, event.attempts - 1)));
      await pool.query(`
        UPDATE artway_agent_events
        SET status='queued',last_error=$3,started_at=NULL,lease_until=NULL,worker_id='',
            available_at=NOW()+($4::text || ' milliseconds')::interval,updated_at=NOW()
        WHERE namespace=$1 AND event_id=$2 AND status='running' AND worker_id=$5
      `, [ns, event.id, message, delayMs, event.workerId || workerId]);
      if (!wakeTimer) {
        wakeTimer = setTimeout(() => {
          wakeTimer = null;
          kick();
        }, delayMs + 25);
        wakeTimer.unref?.();
      }
      return;
    }
    await fallbackChange((items) => ({
      items: items.map((item) => item.id === event.id ? normalizeEvent({
        ...item,
        status: 'queued',
        error: message,
        startedAt: '',
        updatedAt: now().toISOString(),
      }) : item),
    }));
  }

  async function report(event, status, detail = '', fields = []) {
    if (!runtime || typeof runtime.report !== 'function') return;
    await runtime.report({
      event: 'work_progress',
      source: 'event-agent',
      work: {
        id: `event:${event.id}`,
        runId: event.id,
        productId: event.area === 'products' ? event.entityId : '',
        productName: clean(event.payload?.productName, 220),
        channel: event.area === 'products' ? 'store' : 'system',
        action: clean(event.payload?.action || event.type, 100),
        phase: event.type,
        status,
        fields,
        target: event.entityId,
        message: detail,
        attempt: event.attempts,
      },
    }).catch(() => {});
  }

  async function run() {
    while (true) {
      const event = await claim();
      if (!event) break;
      const handler = handlers.get(event.type);
      if (!handler) {
        await settle(event, 'failed', {}, `Brak wykonawcy zdarzenia ${event.type}.`);
        continue;
      }
      await report(event, 'running', `Odebrano sygnał ${event.type}; uruchamiam tylko moduł ${event.area}.`);
      try {
        const result = object(await handler(event));
        await settle(event, result.decisionRequired === true ? 'decision_required' : 'completed', result);
        await report(
          event,
          result.decisionRequired === true ? 'decision_required' : 'confirmed',
          clean(result.message || 'Zdarzenie zostało obsłużone i trwale rozliczone.', 1000),
          array(result.savedFields),
        );
      } catch (error) {
        await retryOrFail(event, error);
        await report(event, 'failed', clean(error?.message || error, 1000));
      }
    }
  }

  async function scheduleNextAvailable() {
    if (!pool || wakeTimer) return;
    const next = await pool.query(`
      SELECT MIN(available_at) AS available_at
      FROM artway_agent_events
      WHERE namespace=$1 AND status='queued'
    `, [ns]);
    const at = next.rows[0]?.available_at ? new Date(next.rows[0].available_at).getTime() : 0;
    if (!at) return;
    const delay = Math.max(25, Math.min(5 * 60_000, at - now().getTime() + 25));
    wakeTimer = setTimeout(() => {
      wakeTimer = null;
      kick();
    }, delay);
    wakeTimer.unref?.();
  }

  function kick() {
    ensureListener().catch((error) => console.error('agent_event_listener_start', error));
    if (workers.size >= concurrency) rerunRequested = true;
    while (workers.size < concurrency) {
      const work = Promise.resolve().then(run).finally(() => {
        workers.delete(work);
        if (!workers.size && rerunRequested) {
          rerunRequested = false;
          kick();
        } else if (!workers.size) {
          scheduleNextAvailable().catch((error) => console.error('agent_event_next_available', error));
        }
      });
      workers.add(work);
    }
    return Promise.allSettled([...workers]);
  }

  async function resume() {
    if (pool) {
      await ensureSchema();
      await pool.query(`
        UPDATE artway_agent_events
        SET status=CASE WHEN attempts >= $2 THEN 'failed' ELSE 'queued' END,
            available_at=NOW(),started_at=NULL,lease_until=NULL,worker_id='',
            completed_at=CASE WHEN attempts >= $2 THEN NOW() ELSE NULL END,
            updated_at=NOW()
        WHERE namespace=$1 AND status='running'
      `, [ns, MAX_ATTEMPTS]);
    } else {
      await fallbackChange((items) => ({
        items: items.map((item) => item.status === 'running'
          ? normalizeEvent({ ...item, status: 'queued', startedAt: '', updatedAt: now().toISOString() })
          : item),
      }));
    }
    await ensureListener().catch((error) => console.error('agent_event_listener_start', error));
    return kick();
  }

  async function status() {
    if (pool) {
      await ensureSchema();
      const [rows, countRows] = await Promise.all([
        pool.query(`
          SELECT * FROM artway_agent_events
          WHERE namespace=$1
          ORDER BY
            CASE status WHEN 'running' THEN 0 WHEN 'queued' THEN 1 ELSE 2 END,
            priority DESC,updated_at DESC
          LIMIT $2
        `, [ns, MAX_RECENT]),
        pool.query(`
          SELECT status,count(*)::integer AS count
          FROM artway_agent_events WHERE namespace=$1 GROUP BY status
        `, [ns]),
      ]);
      const state = publicState(rows.rows.map(fromRow));
      const counts = Object.fromEntries(countRows.rows.map((row) => [row.status, Number(row.count) || 0]));
      return {
        ...state,
        active: Number(counts.queued || 0) + Number(counts.running || 0),
        queued: Number(counts.queued || 0),
        running: Number(counts.running || 0),
        counts,
      };
    }
    const version = await readVersioned(FALLBACK_KEY, { items: [] });
    return publicState(version.value?.items);
  }

  function register(type, handler) {
    const key = clean(type, 100);
    if (!key || typeof handler !== 'function') throw new Error('Nieprawidłowy wykonawca zdarzenia Agenta.');
    handlers.set(key, handler);
    return () => handlers.delete(key);
  }

  return Object.freeze({ enqueue, enqueueMany, register, resume, kick, status });
}
