import crypto from 'node:crypto';
import { createPostgresCodexAgentQueue } from './codex-agent-postgres-queue.mjs';

const KEY = 'codex_agent_jobs';
const MAX_JOBS = 250;
const MAX_ACTIVE_JOBS = 200;
const MAX_ATTEMPTS = 3;
const LEASE_MS = 120_000;
const PANEL_TTL_MS = 30 * 60_000;
const WORKER_POLL_PERSIST_MS = 60_000;
const WORKER_ONLINE_MS = 75_000;

function clean(value = '', limit = 500) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, limit);
}

function asRecord(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    // Stara kolejka jest migrowana w locie: zachowujemy wyłącznie polecenia
    // utworzone w panelu administratora.
    items: (Array.isArray(source.items) ? source.items : [])
      .filter((item) => item && typeof item === 'object' && item.channel === 'panel')
      .map((item) => ({
        ...item,
        channel: 'panel',
        kind: 'panel',
        text: clean(item.text, 4_000),
        context: clean(item.context, 4_000),
        response: clean(item.response, 12_000),
      })),
    updatedAt: clean(source.updatedAt, 40),
    lastWorkerPollAt: clean(source.lastWorkerPollAt, 40),
    lastWorkerHeartbeatAt: clean(source.lastWorkerHeartbeatAt, 40),
    lastWorkerId: clean(source.lastWorkerId, 160),
  };
}

function workerPresence(record = {}, timestamp = new Date()) {
  const seenAt = [record.lastWorkerPollAt, record.lastWorkerHeartbeatAt]
    .map((value) => Date.parse(value || ''))
    .filter(Number.isFinite)
    .sort((left, right) => right - left)[0] || 0;
  const nowMs = timestamp.getTime();
  return {
    workerOnline: seenAt > 0 && seenAt <= nowMs + 5_000 && nowMs - seenAt <= WORKER_ONLINE_MS,
    workerLastSeenAt: seenAt ? new Date(seenAt).toISOString() : '',
    workerId: clean(record.lastWorkerId, 160),
  };
}

function publicJob(job = {}) {
  const terminal = ['completed', 'failed'].includes(job.status);
  return {
    id: clean(job.id, 160),
    claimToken: clean(job.claimToken, 200),
    text: terminal ? '' : clean(job.text, 4_000),
    context: terminal ? '' : clean(job.context, 4_000),
    response: job.status === 'completed' ? clean(job.response, 12_000) : '',
    user: clean(job.user, 160),
    requestId: clean(job.requestId, 160),
    channel: 'panel',
    kind: 'panel',
    attempts: Math.max(0, Number(job.attempts) || 0),
    createdAt: clean(job.createdAt, 40),
    expiresAt: clean(job.expiresAt, 40),
  };
}

function queueError(message, code = 'codex_queue_error', status = 409) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function compact(items = []) {
  const active = items.filter((item) => !['completed', 'failed'].includes(item.status));
  const finished = items
    .filter((item) => ['completed', 'failed'].includes(item.status))
    .sort((a, b) => String(b.completedAt || b.failedAt || b.createdAt || '').localeCompare(String(a.completedAt || a.failedAt || a.createdAt || '')));
  return [...active, ...finished.slice(0, Math.max(0, MAX_JOBS - active.length))];
}

export function createCodexAgentQueue({
  readVersioned,
  writeIfVersion,
  pool = null,
  listenerPool = pool,
  namespace = 'artway-sklep',
  now = () => new Date(),
  token = () => crypto.randomBytes(24).toString('base64url'),
} = {}) {
  if (pool) return createPostgresCodexAgentQueue({ pool, listenerPool, namespace, now, token });
  if (typeof readVersioned !== 'function' || typeof writeIfVersion !== 'function') {
    throw new Error('Kolejka Agenta wymaga wersjonowanego repozytorium.');
  }

  async function change(mutator, attempts = 8) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const version = await readVersioned(KEY, { items: [], updatedAt: null });
      const record = asRecord(version.value);
      const result = await mutator(record);
      if (result?.write === false) return result.value;
      const next = {
        ...record,
        ...(result?.record || {}),
        items: compact(result?.record?.items || record.items),
        updatedAt: now().toISOString(),
      };
      const write = await writeIfVersion(KEY, next, version);
      if (write?.modified) return result?.value;
    }
    throw queueError('Kolejka zmieniła się podczas zapisu. Ponów operację.', 'codex_queue_write_conflict');
  }

  async function enqueue(input = {}) {
    const requestId = clean(input.requestId, 160);
    const text = clean(input.text, 4_000);
    if (!requestId || !text) {
      throw queueError('Brakuje identyfikatora albo treści polecenia Agenta.', 'codex_queue_invalid_job', 422);
    }
    return change((record) => {
      const timestamp = now();
      const presence = workerPresence(record, timestamp);
      const existing = record.items.find((item) => item.requestId === requestId);
      if (existing) {
        return { write: false, value: { job: publicJob(existing), duplicate: true, status: existing.status, ...presence } };
      }
      if (record.items.filter((item) => !['completed', 'failed'].includes(item.status)).length >= MAX_ACTIVE_JOBS) {
        throw queueError('Kolejka Agenta jest pełna. Najpierw zostaną rozliczone wcześniejsze zadania.', 'codex_queue_full', 429);
      }
      const createdAt = timestamp.toISOString();
      const job = {
        id: `CX-${crypto.createHash('sha256').update(requestId).digest('hex').slice(0, 20)}`,
        requestId,
        channel: 'panel',
        kind: 'panel',
        text,
        context: clean(input.context, 4_000),
        user: clean(input.user, 160),
        status: 'queued',
        attempts: 0,
        createdAt,
        notBefore: createdAt,
        expiresAt: new Date(timestamp.getTime() + PANEL_TTL_MS).toISOString(),
      };
      return {
        record: { items: [...record.items, job] },
        value: { job: publicJob(job), duplicate: false, status: job.status, ...presence },
      };
    });
  }

  async function claim(workerIdInput = '') {
    const workerId = clean(workerIdInput, 160);
    if (!workerId) throw queueError('Brakuje identyfikatora procesu Agenta.', 'codex_queue_worker_required', 422);
    return change((record) => {
      const timestamp = now();
      const timestampMs = timestamp.getTime();
      let expiredCount = 0;
      const items = record.items.map((current) => {
        const queuedExpired = current.status === 'queued'
          && current.expiresAt
          && Date.parse(current.expiresAt) <= timestampMs;
        if (!queuedExpired) return current;
        expiredCount += 1;
        return {
          ...current,
          status: 'failed',
          failedAt: timestamp.toISOString(),
          failureKind: 'panel_expired',
          lastError: 'Polecenie nie zostało podjęte przez proces wykonawczy w ciągu 30 minut.',
          text: '',
          context: '',
          claimToken: '',
          leaseUntil: '',
          workerId: '',
        };
      });
      const owned = items.find((item) => item.status === 'processing'
        && item.workerId === workerId
        && item.claimToken
        && Date.parse(item.leaseUntil || '') > timestampMs);
      let job = owned || null;
      if (!job) {
        const eligible = (item) => (
          item.status === 'queued' && (!item.notBefore || Date.parse(item.notBefore) <= timestampMs)
        ) || (
          item.status === 'processing' && item.leaseUntil && Date.parse(item.leaseUntil) <= timestampMs
        );
        const repairIndex = items.findIndex((item) => eligible(item) && String(item.text || '').startsWith('[NAPRAWA KODU]'));
        const index = repairIndex >= 0 ? repairIndex : items.findIndex(eligible);
        if (index >= 0) {
          job = {
            ...items[index],
            status: 'processing',
            workerId,
            claimToken: token(),
            attempts: Math.max(0, Number(items[index].attempts) || 0) + 1,
            claimedAt: timestamp.toISOString(),
            leaseUntil: new Date(timestampMs + LEASE_MS).toISOString(),
          };
          items[index] = job;
        }
      }
      const lastPollMs = Date.parse(record.lastWorkerPollAt || '');
      const persistPoll = job || expiredCount || record.lastWorkerId !== workerId
        || !Number.isFinite(lastPollMs)
        || timestampMs - lastPollMs >= WORKER_POLL_PERSIST_MS;
      const value = {
        job: job ? publicJob(job) : null,
        expiredPanel: expiredCount > 0,
        expiredPanelCount: expiredCount,
        workerOnline: true,
        workerLastSeenAt: timestamp.toISOString(),
      };
      if (!persistPoll) return { write: false, value };
      return {
        record: { items, lastWorkerPollAt: timestamp.toISOString(), lastWorkerId: workerId },
        value,
      };
    });
  }

  async function heartbeat(input = {}) {
    const id = clean(input.id, 160);
    const claimToken = clean(input.claimToken, 200);
    if (!id || !claimToken) throw queueError('Brakuje danych aktywnego zadania.', 'codex_queue_heartbeat_invalid', 422);
    return change((record) => {
      const index = record.items.findIndex((item) => item.id === id);
      if (index < 0) throw queueError('Nie znaleziono zadania Agenta.', 'codex_queue_job_not_found', 404);
      const current = record.items[index];
      if (current.status !== 'processing' || current.claimToken !== claimToken) {
        return { write: false, value: { extended: false } };
      }
      const timestamp = now();
      const job = {
        ...current,
        heartbeatAt: timestamp.toISOString(),
        leaseUntil: new Date(timestamp.getTime() + LEASE_MS).toISOString(),
      };
      const items = [...record.items];
      items[index] = job;
      return {
        record: { items, lastWorkerHeartbeatAt: timestamp.toISOString(), lastWorkerId: current.workerId },
        value: { extended: true, leaseUntil: job.leaseUntil },
      };
    });
  }

  async function prepareDelivery(input = {}) {
    const id = clean(input.id, 160);
    const claimToken = clean(input.claimToken, 200);
    const response = clean(input.response, 12_000);
    if (!id || !claimToken || !response) {
      throw queueError('Brakuje danych wyniku Agenta.', 'codex_queue_delivery_invalid', 422);
    }
    return change((record) => {
      const index = record.items.findIndex((item) => item.id === id);
      if (index < 0) throw queueError('Nie znaleziono zadania Agenta.', 'codex_queue_job_not_found', 404);
      const current = record.items[index];
      if (current.status === 'completed') {
        return { write: false, value: { job: publicJob(current), alreadyDelivered: true } };
      }
      if (current.status === 'delivering' && current.claimToken === claimToken) {
        return { write: false, value: { job: publicJob(current), alreadyDelivering: true } };
      }
      if (current.status !== 'processing' || current.claimToken !== claimToken) {
        throw queueError('Wygasło prawo do zakończenia tego zadania.', 'codex_queue_claim_invalid');
      }
      const timestamp = now();
      const job = {
        ...current,
        status: 'delivering',
        response,
        deliveryStartedAt: timestamp.toISOString(),
        deliveryLeaseUntil: new Date(timestamp.getTime() + LEASE_MS).toISOString(),
      };
      const items = [...record.items];
      items[index] = job;
      return { record: { items }, value: { job: { ...publicJob(job), response } } };
    });
  }

  async function markDelivered(input = {}) {
    const id = clean(input.id, 160);
    const claimToken = clean(input.claimToken, 200);
    return change((record) => {
      const index = record.items.findIndex((item) => item.id === id);
      if (index < 0) throw queueError('Nie znaleziono zadania Agenta.', 'codex_queue_job_not_found', 404);
      const current = record.items[index];
      if (current.status === 'completed') {
        return { write: false, value: { delivered: true, duplicate: true } };
      }
      if (current.status !== 'delivering' || current.claimToken !== claimToken) {
        throw queueError('Wygasło prawo do zakończenia zadania.', 'codex_queue_claim_invalid');
      }
      const job = {
        ...current,
        status: 'completed',
        completedAt: now().toISOString(),
        text: '',
        context: '',
        response: clean(current.response, 12_000),
        claimToken: '',
        leaseUntil: '',
        deliveryLeaseUntil: '',
        workerId: '',
      };
      const items = [...record.items];
      items[index] = job;
      return { record: { items }, value: { delivered: true, duplicate: false } };
    });
  }

  async function fail(input = {}) {
    const id = clean(input.id, 160);
    const claimToken = clean(input.claimToken, 200);
    const error = clean(input.error, 500);
    return change((record) => {
      const index = record.items.findIndex((item) => item.id === id);
      if (index < 0) throw queueError('Nie znaleziono zadania Agenta.', 'codex_queue_job_not_found', 404);
      const current = record.items[index];
      if (current.status === 'failed') {
        return { write: false, value: { accepted: false, retry: false, terminal: true, duplicate: true, status: 'failed' } };
      }
      if (!['processing', 'delivering'].includes(current.status) || current.claimToken !== claimToken) {
        return { write: false, value: { accepted: false, retry: false, duplicate: false, status: current.status } };
      }
      const attempts = Math.max(0, Number(current.attempts) || 0);
      const terminal = input.expired === true || attempts >= MAX_ATTEMPTS;
      const timestamp = now();
      const job = {
        ...current,
        status: terminal ? 'failed' : 'queued',
        lastError: error || 'Nieznany błąd procesu Agenta',
        failedAt: timestamp.toISOString(),
        notBefore: new Date(timestamp.getTime() + Math.min(60_000, 10_000 * Math.max(1, attempts))).toISOString(),
        claimToken: '',
        leaseUntil: '',
        deliveryLeaseUntil: '',
        workerId: '',
        response: '',
        ...(terminal ? { text: '', context: '' } : {}),
      };
      const items = [...record.items];
      items[index] = job;
      return {
        record: { items },
        value: { accepted: true, retry: !terminal, terminal, duplicate: false, status: job.status, attempts },
      };
    });
  }

  async function status() {
    const version = await readVersioned(KEY, { items: [], updatedAt: null });
    const record = asRecord(version.value);
    const presence = workerPresence(record, now());
    const counts = { queued: 0, processing: 0, delivering: 0, completed: 0, failed: 0 };
    for (const item of record.items) {
      if (Object.hasOwn(counts, item?.status)) counts[item.status] += 1;
    }
    return {
      workerOnline: presence.workerOnline,
      workerLastSeenAt: presence.workerLastSeenAt,
      counts,
      active: counts.queued + counts.processing + counts.delivering,
      updatedAt: clean(record.updatedAt, 40),
    };
  }

  async function result(idInput = '') {
    const id = clean(idInput, 160);
    if (!id) throw queueError('Brakuje identyfikatora zadania Agenta.', 'codex_queue_job_required', 422);
    const version = await readVersioned(KEY, { items: [], updatedAt: null });
    const job = asRecord(version.value).items.find((item) => item.id === id);
    if (!job) throw queueError('Nie znaleziono zadania Agenta.', 'codex_queue_job_not_found', 404);
    return {
      id,
      status: clean(job.status, 30),
      response: job.status === 'completed' ? clean(job.response, 12_000) : '',
      error: job.status === 'failed' ? clean(job.lastError, 500) : '',
    };
  }

  return {
    claim,
    enqueue,
    fail,
    heartbeat,
    markDelivered,
    prepareDelivery,
    result,
    status,
  };
}
