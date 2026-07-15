import crypto from 'node:crypto';

const KEY = 'codex_agent_jobs';
const MAX_JOBS = 250;
const MAX_ACTIVE_JOBS = 200;
const MAX_ATTEMPTS = 3;
const LEASE_MS = 90_000;
const PANEL_TTL_MS = 45_000;

function clean(value = '', limit = 500) {
  return String(value ?? '').trim().slice(0, limit);
}

function asRecord(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return { items: Array.isArray(source.items) ? source.items.filter((item) => item && typeof item === 'object') : [], updatedAt: clean(source.updatedAt, 40) };
}

function publicJob(job = {}) {
  return {
    id: clean(job.id, 160),
    claimToken: clean(job.claimToken, 200),
    text: clean(job.text, 2000),
    chatId: clean(job.chatId, 100),
    messageThreadId: Number(job.messageThreadId) > 0 ? Number(job.messageThreadId) : null,
    replyTo: Number(job.replyTo) > 0 ? Number(job.replyTo) : null,
    user: clean(job.user, 160),
    requestId: clean(job.requestId, 160),
    channel: job.channel === 'panel' ? 'panel' : 'telegram',
    attempts: Math.max(0, Number(job.attempts) || 0),
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
  const finished = items.filter((item) => ['completed', 'failed'].includes(item.status))
    .sort((a, b) => String(b.deliveredAt || b.failedAt || b.createdAt || '').localeCompare(String(a.deliveredAt || a.failedAt || a.createdAt || '')));
  return [...active, ...finished.slice(0, Math.max(0, MAX_JOBS - active.length))];
}

export function createCodexAgentQueue({ readVersioned, writeIfVersion, now = () => new Date(), token = () => crypto.randomBytes(24).toString('base64url') } = {}) {
  if (typeof readVersioned !== 'function' || typeof writeIfVersion !== 'function') throw new Error('Kolejka Codex wymaga wersjonowanego repozytorium.');

  async function change(mutator, attempts = 5) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const version = await readVersioned(KEY, { items: [], updatedAt: null });
      const record = asRecord(version.value);
      const result = await mutator(record, version);
      if (result?.write === false) return result.value;
      const next = { ...record, ...(result?.record || {}), items: compact(result?.record?.items || record.items), updatedAt: now().toISOString() };
      const write = await writeIfVersion(KEY, next, version);
      if (write?.modified) return result?.value;
    }
    throw queueError('Kolejka zmieniła się podczas zapisu. Spróbuj ponownie.', 'codex_queue_write_conflict');
  }

  async function enqueue(input = {}) {
    const requestId = clean(input.requestId, 160), text = clean(input.text, 2000), chatId = clean(input.chatId, 100);
    const channel = input.channel === 'panel' ? 'panel' : 'telegram';
    if (!requestId || !text || (channel === 'telegram' && !chatId)) throw queueError('Brakuje identyfikatora, treści albo czatu zadania Codex.', 'codex_queue_invalid_job', 422);
    return change((record) => {
      const existing = record.items.find((item) => item.requestId === requestId);
      if (existing) return { write: false, value: { job: publicJob(existing), duplicate: true, status: existing.status } };
      if (record.items.filter((item) => !['completed', 'failed'].includes(item.status)).length >= MAX_ACTIVE_JOBS) {
        throw queueError('Kolejka Codex jest pełna. Spróbuj ponownie po obsłużeniu wcześniejszych zadań.', 'codex_queue_full', 429);
      }
      const createdAt = now().toISOString();
      const job = {
        id: `CX-${crypto.createHash('sha256').update(requestId).digest('hex').slice(0, 20)}`,
        requestId,
        channel,
        text,
        chatId,
        messageThreadId: Number(input.messageThreadId) > 0 ? Number(input.messageThreadId) : null,
        replyTo: Number(input.replyTo) > 0 ? Number(input.replyTo) : null,
        user: clean(input.user, 160),
        status: 'queued',
        attempts: 0,
        createdAt,
        notBefore: createdAt,
        expiresAt: channel === 'panel' ? new Date(now().getTime() + PANEL_TTL_MS).toISOString() : '',
      };
      return { record: { items: [...record.items, job] }, value: { job: publicJob(job), duplicate: false, status: job.status } };
    });
  }

  async function claim(workerIdInput = '') {
    const workerId = clean(workerIdInput, 160);
    if (!workerId) throw queueError('Brakuje identyfikatora pracownika Codex.', 'codex_queue_worker_required', 422);
    return change((record) => {
      const timestamp = now(), timestampMs = timestamp.getTime();
      const expiredPanel = record.items.findIndex((item) => (
        item.channel === 'panel' && ['queued', 'processing'].includes(item.status)
        && item.expiresAt && Date.parse(item.expiresAt) <= timestampMs
      ));
      if (expiredPanel >= 0) {
        const items = [...record.items], current = items[expiredPanel];
        items[expiredPanel] = {
          ...current, status: 'failed', failedAt: timestamp.toISOString(),
          lastError: 'Zadanie panelu wygasło przed wykonaniem. Nic nie zostało uruchomione w tle.',
          text: '', response: '', claimToken: '', leaseUntil: '', workerId: '',
        };
        return { record: { items }, value: { job: null, expiredPanel: true } };
      }
      const expiredDelivery = record.items.findIndex((item) => item.status === 'delivering' && item.deliveryLeaseUntil && Date.parse(item.deliveryLeaseUntil) <= timestampMs);
      if (expiredDelivery >= 0) {
        const items = [...record.items], current = items[expiredDelivery];
        items[expiredDelivery] = {
          ...current, status: 'failed', failedAt: timestamp.toISOString(),
          lastError: 'Nie udało się jednoznacznie potwierdzić dostarczenia odpowiedzi; nie ponowiono jej, aby uniknąć duplikatu.',
          text: '', response: '', claimToken: '', leaseUntil: '', deliveryLeaseUntil: '', workerId: '',
        };
        return { record: { items }, value: { job: null, recoveredDelivery: true } };
      }
      const index = record.items.findIndex((item) => (
        item.status === 'queued' && (!item.notBefore || Date.parse(item.notBefore) <= timestampMs)
      ) || (
        item.status === 'processing' && item.leaseUntil && Date.parse(item.leaseUntil) <= timestampMs
      ));
      if (index < 0) return { write: false, value: { job: null } };
      const claimToken = token(), job = {
        ...record.items[index], status: 'processing', workerId, claimToken,
        attempts: Math.max(0, Number(record.items[index].attempts) || 0) + 1,
        claimedAt: timestamp.toISOString(), leaseUntil: new Date(timestampMs + LEASE_MS).toISOString(),
      };
      const items = [...record.items]; items[index] = job;
      return { record: { items }, value: { job: publicJob(job) } };
    });
  }

  async function prepareDelivery(input = {}) {
    const id = clean(input.id, 160), claimToken = clean(input.claimToken, 200), response = clean(input.response, 3900);
    if (!id || !claimToken || !response) throw queueError('Brakuje danych odpowiedzi Codex.', 'codex_queue_delivery_invalid', 422);
    const outcome = await change((record) => {
      const index = record.items.findIndex((item) => item.id === id);
      if (index < 0) throw queueError('Nie znaleziono zadania Codex.', 'codex_queue_job_not_found', 404);
      const current = record.items[index];
      if (current.status === 'completed') return { write: false, value: { job: publicJob(current), alreadyDelivered: true } };
      if (current.status === 'delivering' && current.claimToken === claimToken) return { write: false, value: { job: publicJob(current), alreadyDelivering: true } };
      if (current.status !== 'processing' || current.claimToken !== claimToken) throw queueError('Wygasło prawo do odpowiedzi na to zadanie.', 'codex_queue_claim_invalid');
      if (current.channel === 'panel' && current.expiresAt && Date.parse(current.expiresAt) <= now().getTime()) {
        const items = [...record.items];
        items[index] = {
          ...current, status: 'failed', failedAt: now().toISOString(),
          lastError: 'Zadanie panelu wygasło przed zakończeniem. Wynik nie został zastosowany.',
          text: '', response: '', claimToken: '', leaseUntil: '', workerId: '',
        };
        return { record: { items }, value: { expired: true } };
      }
      const deliveryStart = now();
      const job = { ...current, status: 'delivering', response, deliveryStartedAt: deliveryStart.toISOString(), deliveryLeaseUntil: new Date(deliveryStart.getTime() + LEASE_MS).toISOString() };
      const items = [...record.items]; items[index] = job;
      return { record: { items }, value: { job: { ...publicJob(job), response } } };
    });
    if (outcome?.expired) throw queueError('Zadanie panelu wygasło. Uruchom polecenie ponownie.', 'codex_queue_panel_expired', 410);
    return outcome;
  }

  async function heartbeat(input = {}) {
    const id = clean(input.id, 160), claimToken = clean(input.claimToken, 200);
    if (!id || !claimToken) throw queueError('Brakuje danych lease zadania Codex.', 'codex_queue_heartbeat_invalid', 422);
    return change((record) => {
      const index = record.items.findIndex((item) => item.id === id);
      if (index < 0) throw queueError('Nie znaleziono zadania Codex.', 'codex_queue_job_not_found', 404);
      const current = record.items[index];
      if (current.status !== 'processing' || current.claimToken !== claimToken) return { write: false, value: { extended: false } };
      const timestamp = now();
      const job = { ...current, heartbeatAt: timestamp.toISOString(), leaseUntil: new Date(timestamp.getTime() + LEASE_MS).toISOString() };
      const items = [...record.items]; items[index] = job;
      return { record: { items }, value: { extended: true, leaseUntil: job.leaseUntil } };
    });
  }

  async function markDelivered(input = {}) {
    const id = clean(input.id, 160), claimToken = clean(input.claimToken, 200);
    return change((record) => {
      const index = record.items.findIndex((item) => item.id === id);
      if (index < 0) throw queueError('Nie znaleziono zadania Codex.', 'codex_queue_job_not_found', 404);
      const current = record.items[index];
      if (current.status === 'completed') return { write: false, value: { delivered: true, duplicate: true } };
      if (current.status !== 'delivering' || current.claimToken !== claimToken) throw queueError('Wygasło prawo do zakończenia zadania.', 'codex_queue_claim_invalid');
      const job = {
        ...current, status: 'completed', deliveredAt: now().toISOString(), telegramMessageId: clean(input.telegramMessageId, 80),
        text: '', response: input.keepResponse === true ? clean(current.response, 3900) : '', claimToken: '', leaseUntil: '', deliveryLeaseUntil: '', workerId: '',
      };
      const items = [...record.items]; items[index] = job;
      return { record: { items }, value: { delivered: true, duplicate: false } };
    });
  }

  async function fail(input = {}) {
    const id = clean(input.id, 160), claimToken = clean(input.claimToken, 200), error = clean(input.error, 300);
    return change((record) => {
      const index = record.items.findIndex((item) => item.id === id);
      if (index < 0) throw queueError('Nie znaleziono zadania Codex.', 'codex_queue_job_not_found', 404);
      const current = record.items[index];
      if (!['processing', 'delivering'].includes(current.status) || current.claimToken !== claimToken) return { write: false, value: { accepted: false } };
      const deliveryUncertain = current.status === 'delivering' && input.deliveryFailed !== true;
      const expired = input.expired === true;
      const exhausted = expired || deliveryUncertain || Math.max(0, Number(current.attempts) || 0) >= MAX_ATTEMPTS, timestamp = now();
      const job = {
        ...current, status: exhausted ? 'failed' : 'queued', lastError: expired ? 'Zadanie wygasło przed wykonaniem. Nic nie zostało uruchomione w tle.' : (error || 'Nieznany błąd pracownika Codex'),
        failedAt: timestamp.toISOString(), notBefore: new Date(timestamp.getTime() + 10_000).toISOString(),
        claimToken: '', leaseUntil: '', deliveryLeaseUntil: '', workerId: '', response: '',
        ...(exhausted ? { text: '' } : {}),
      };
      const items = [...record.items]; items[index] = job;
      return { record: { items }, value: { accepted: true, retry: !exhausted, attempts: job.attempts } };
    });
  }

  async function result(idInput = '') {
    const id = clean(idInput, 160);
    if (!id) throw queueError('Brakuje identyfikatora zadania Codex.', 'codex_queue_job_required', 422);
    const version = await readVersioned(KEY, { items: [], updatedAt: null });
    const job = asRecord(version.value).items.find((item) => item.id === id);
    if (!job) throw queueError('Nie znaleziono zadania Codex.', 'codex_queue_job_not_found', 404);
    const expiredPanel = job.channel === 'panel' && ['queued', 'processing'].includes(job.status)
      && job.expiresAt && Date.parse(job.expiresAt) <= now().getTime();
    return {
      id, status: clean(job.status, 30),
      ...(expiredPanel ? { status: 'failed' } : {}),
      response: job.channel === 'panel' && job.status === 'completed' ? clean(job.response, 3900) : '',
      error: expiredPanel ? 'Zadanie wygasło przed wykonaniem. Nic nie zostało uruchomione w tle.' : (job.status === 'failed' ? clean(job.lastError, 300) : ''),
    };
  }

  return { claim, enqueue, fail, heartbeat, markDelivered, prepareDelivery, result };
}
