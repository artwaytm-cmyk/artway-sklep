import crypto from 'node:crypto';

const KEY = 'codex_agent_jobs';
const MAX_JOBS = 250;
const MAX_ACTIVE_JOBS = 200;
const MAX_ATTEMPTS = 3;
const LEASE_MS = 90_000;
const PANEL_TTL_MS = 45_000;
const TELEGRAM_TTL_MS = 120_000;
const WORKER_POLL_PERSIST_MS = 60_000;
const WORKER_ONLINE_MS = 75_000;
const FAILURE_NOTIFICATION_LEASE_MS = 30_000;
const FAILURE_NOTIFICATION_MAX_ATTEMPTS = 3;
const FAILURE_NOTIFICATION_RETRY_MS = [10_000, 60_000];
const MAX_REPLY_MARKUP_ROWS = 12;
const MAX_REPLY_MARKUP_BUTTONS_PER_ROW = 4;
const MAX_REPLY_MARKUP_BUTTONS = 24;
const MAX_REPLY_MARKUP_TEXT = 64;
const MAX_REPLY_MARKUP_CALLBACK_BYTES = 64;
const TELEGRAM_INBOUND_KINDS = new Set(['text', 'command', 'callback', 'voice', 'audio']);

function clean(value = '', limit = 500) {
  return String(value ?? '').trim().slice(0, limit);
}

function cleanContext(value = '') {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, 1600);
}

function cleanMedia(value = null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const kind = value.kind === 'voice' || value.kind === 'audio' ? value.kind : '';
  const fileId = clean(value.fileId, 500);
  if (!kind || !fileId) return null;
  return {
    kind,
    fileId,
    mimeType: clean(value.mimeType, 160),
    fileName: clean(value.fileName, 240),
  };
}

export function sanitizeCodexInboundKind(value = '', channel = 'telegram') {
  if (channel === 'panel') return 'panel';
  const kind = String(value ?? '').trim().toLowerCase();
  return TELEGRAM_INBOUND_KINDS.has(kind) ? kind : 'text';
}

function cleanButtonText(value = '') {
  return [...String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()].slice(0, MAX_REPLY_MARKUP_TEXT).join('');
}

function allowedCallbackData(value = '') {
  const data = String(value ?? '');
  if (!data || Buffer.byteLength(data, 'utf8') > MAX_REPLY_MARKUP_CALLBACK_BYTES) return '';
  if (/^iv:[cr]:IV[a-f0-9]{14}$/.test(data)) return data;
  if (/^iv:l:IV[a-f0-9]{14}:[A-Z0-9._/-]{1,40}$/.test(data)) return data;
  if (/^aa:[cr]:AA[a-f0-9]{12}$/.test(data)) return data;
  return '';
}

export function sanitizeCodexReplyMarkup(value = null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!Array.isArray(value.inline_keyboard)) return null;
  const rows = [];
  let buttonCount = 0;
  for (const sourceRow of value.inline_keyboard.slice(0, MAX_REPLY_MARKUP_ROWS)) {
    if (!Array.isArray(sourceRow)) continue;
    const row = [];
    for (const sourceButton of sourceRow.slice(0, MAX_REPLY_MARKUP_BUTTONS_PER_ROW)) {
      if (buttonCount >= MAX_REPLY_MARKUP_BUTTONS) break;
      if (!sourceButton || typeof sourceButton !== 'object' || Array.isArray(sourceButton)) continue;
      const text = cleanButtonText(sourceButton.text), callbackData = allowedCallbackData(sourceButton.callback_data);
      if (!text || !callbackData) continue;
      row.push({ text, callback_data: callbackData });
      buttonCount += 1;
    }
    if (row.length) rows.push(row);
    if (buttonCount >= MAX_REPLY_MARKUP_BUTTONS) break;
  }
  return rows.length ? { inline_keyboard: rows } : null;
}

function asRecord(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    items: Array.isArray(source.items) ? source.items
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        ...item,
        kind: sanitizeCodexInboundKind(item.kind, item.channel),
        replyMarkup: item.status === 'delivering' ? sanitizeCodexReplyMarkup(item.replyMarkup) : null,
      })) : [],
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

function telegramRecipient(job = {}) {
  if (job.channel === 'panel' || !clean(job.chatId, 100)) return null;
  return {
    chatId: clean(job.chatId, 100),
    messageThreadId: Number(job.messageThreadId) > 0 ? Number(job.messageThreadId) : null,
    replyTo: Number(job.replyTo) > 0 ? Number(job.replyTo) : null,
  };
}

function pendingFailureNotification(job = {}, timestamp = new Date()) {
  const recipient = telegramRecipient(job);
  if (!recipient) return null;
  const createdAt = timestamp.toISOString();
  return {
    status: 'pending',
    attempts: 0,
    createdAt,
    notBefore: createdAt,
    chatId: recipient.chatId,
    messageThreadId: recipient.messageThreadId,
    replyTo: recipient.replyTo,
    claimToken: '',
    leaseUntil: '',
  };
}

function failureNotificationRetryDelay(attempts = 0) {
  const index = Math.max(0, Number(attempts) || 0) - 1;
  return FAILURE_NOTIFICATION_RETRY_MS[Math.min(index, FAILURE_NOTIFICATION_RETRY_MS.length - 1)] || FAILURE_NOTIFICATION_RETRY_MS[0];
}

function publicFailureNotification(job = {}) {
  const notification = job.failureNotification && typeof job.failureNotification === 'object'
    ? job.failureNotification
    : {};
  if (!clean(job.id, 160) || !clean(notification.chatId, 100)) return null;
  return {
    id: clean(job.id, 160),
    claimToken: clean(notification.claimToken, 200),
    chatId: clean(notification.chatId, 100),
    messageThreadId: Number(notification.messageThreadId) > 0 ? Number(notification.messageThreadId) : null,
    replyTo: Number(notification.replyTo) > 0 ? Number(notification.replyTo) : null,
    attempts: Math.max(0, Number(notification.attempts) || 0),
  };
}

function publicJob(job = {}) {
  const terminal = ['completed', 'failed'].includes(job.status);
  return {
    id: clean(job.id, 160),
    claimToken: clean(job.claimToken, 200),
    text: clean(job.text, 2000),
    chatId: clean(job.chatId, 100),
    messageThreadId: Number(job.messageThreadId) > 0 ? Number(job.messageThreadId) : null,
    replyTo: Number(job.replyTo) > 0 ? Number(job.replyTo) : null,
    user: clean(job.user, 160),
    userId: clean(job.userId, 100),
    context: terminal ? '' : cleanContext(job.context),
    media: terminal ? null : cleanMedia(job.media),
    replyMarkup: job.status === 'delivering' ? sanitizeCodexReplyMarkup(job.replyMarkup) : null,
    requestId: clean(job.requestId, 160),
    channel: job.channel === 'panel' ? 'panel' : 'telegram',
    kind: sanitizeCodexInboundKind(job.kind, job.channel),
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
  const notificationOpen = (item) => ['pending', 'delivering'].includes(item?.failureNotification?.status);
  const active = items.filter((item) => !['completed', 'failed'].includes(item.status) || notificationOpen(item));
  const finished = items.filter((item) => ['completed', 'failed'].includes(item.status) && !notificationOpen(item))
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
    const requestId = clean(input.requestId, 160), chatId = clean(input.chatId, 100), media = cleanMedia(input.media);
    const text = clean(input.text, 2000) || (media ? `[Telegram: wiadomość ${media.kind === 'voice' ? 'głosowa' : 'audio'} do transkrypcji]` : '');
    const channel = input.channel === 'panel' ? 'panel' : 'telegram';
    if (!requestId || !text || (channel === 'telegram' && !chatId)) throw queueError('Brakuje identyfikatora, treści albo czatu zadania Codex.', 'codex_queue_invalid_job', 422);
    return change((record) => {
      const timestamp = now(), presence = workerPresence(record, timestamp);
      const existing = record.items.find((item) => item.requestId === requestId);
      if (existing) {
        if (existing.channel !== 'panel' && existing.status === 'queued' && !presence.workerOnline) {
          const index = record.items.indexOf(existing), items = [...record.items];
          const failed = {
            ...existing, status: 'failed', failureKind: 'worker_offline', failedAt: timestamp.toISOString(),
            lastError: 'Lokalny Agent Codex jest offline. Polecenie nie zostało pozostawione do późniejszego wykonania.',
            text: '', context: '', media: null, replyMarkup: null, response: '', claimToken: '', leaseUntil: '', workerId: '',
          };
          items[index] = failed;
          return { record: { items }, value: { job: publicJob(failed), duplicate: true, status: failed.status, ...presence } };
        }
        return { write: false, value: { job: publicJob(existing), duplicate: true, status: existing.status, ...presence } };
      }
      if (record.items.filter((item) => !['completed', 'failed'].includes(item.status)).length >= MAX_ACTIVE_JOBS) {
        throw queueError('Kolejka Codex jest pełna. Spróbuj ponownie po obsłużeniu wcześniejszych zadań.', 'codex_queue_full', 429);
      }
      const createdAt = timestamp.toISOString(), offline = channel === 'telegram' && !presence.workerOnline;
      const job = {
        id: `CX-${crypto.createHash('sha256').update(requestId).digest('hex').slice(0, 20)}`,
        requestId,
        channel,
        kind: sanitizeCodexInboundKind(input.kind, channel),
        text: offline ? '' : text,
        context: offline ? '' : cleanContext(input.context),
        media: offline ? null : media,
        chatId,
        messageThreadId: Number(input.messageThreadId) > 0 ? Number(input.messageThreadId) : null,
        replyTo: Number(input.replyTo) > 0 ? Number(input.replyTo) : null,
        user: clean(input.user, 160),
        userId: clean(input.userId, 100),
        status: offline ? 'failed' : 'queued',
        attempts: 0,
        createdAt,
        notBefore: createdAt,
        expiresAt: new Date(timestamp.getTime() + (channel === 'panel' ? PANEL_TTL_MS : TELEGRAM_TTL_MS)).toISOString(),
        ...(offline ? {
          failureKind: 'worker_offline', failedAt: createdAt,
          lastError: 'Lokalny Agent Codex jest offline. Polecenie nie zostało pozostawione do późniejszego wykonania.',
        } : {}),
      };
      return { record: { items: [...record.items, job] }, value: { job: publicJob(job), duplicate: false, status: job.status, ...presence } };
    });
  }

  async function claim(workerIdInput = '') {
    const workerId = clean(workerIdInput, 160);
    if (!workerId) throw queueError('Brakuje identyfikatora pracownika Codex.', 'codex_queue_worker_required', 422);
    return change((record) => {
      const timestamp = now(), timestampMs = timestamp.getTime();
      let expiredPanelCount = 0, expiredTelegramCount = 0, recoveredDeliveryCount = 0;
      const items = record.items.map((current) => {
        const jobExpired = ['queued', 'processing'].includes(current.status)
          && current.expiresAt && Date.parse(current.expiresAt) <= timestampMs;
        const panelExpired = jobExpired && current.channel === 'panel';
        const telegramExpired = jobExpired && current.channel !== 'panel';
        const deliveryExpired = current.status === 'delivering' && current.deliveryLeaseUntil
          && Date.parse(current.deliveryLeaseUntil) <= timestampMs;
        if (!jobExpired && !deliveryExpired) return current;
        if (panelExpired) expiredPanelCount += 1;
        else if (telegramExpired) expiredTelegramCount += 1;
        else recoveredDeliveryCount += 1;
        const failureNotification = current.channel !== 'panel'
          ? (current.failureNotification || pendingFailureNotification(current, timestamp))
          : current.failureNotification;
        return {
          ...current, status: 'failed', failedAt: timestamp.toISOString(),
          failureKind: panelExpired ? 'panel_expired' : telegramExpired ? 'telegram_expired' : current.failureKind,
          lastError: jobExpired
            ? `${panelExpired ? 'Zadanie panelu' : 'Polecenie Telegram'} wygasło przed wykonaniem. Nic nie zostało uruchomione w tle.`
            : 'Nie udało się jednoznacznie potwierdzić dostarczenia odpowiedzi; nie ponowiono jej, aby uniknąć duplikatu.',
          text: '', context: '', media: null, replyMarkup: null, response: '', claimToken: '', leaseUntil: '', deliveryLeaseUntil: '', workerId: '',
          ...(failureNotification ? { failureNotification } : {}),
        };
      });
      const ready = items.map((item, index) => ({ item, index })).filter(({ item }) => (
        item.status === 'queued' && (!item.notBefore || Date.parse(item.notBefore) <= timestampMs)
      ) || (
        item.status === 'processing' && item.leaseUntil && Date.parse(item.leaseUntil) <= timestampMs
      )).sort((left, right) => {
        const channelOrder = Number(left.item.channel === 'panel') - Number(right.item.channel === 'panel');
        if (channelOrder) return channelOrder;
        return (Date.parse(left.item.createdAt || '') || 0) - (Date.parse(right.item.createdAt || '') || 0) || left.index - right.index;
      });
      let job = null;
      if (ready.length) {
        const index = ready[0].index, claimToken = token();
        job = {
          ...items[index], status: 'processing', workerId, claimToken,
          attempts: Math.max(0, Number(items[index].attempts) || 0) + 1,
          claimedAt: timestamp.toISOString(), leaseUntil: new Date(timestampMs + LEASE_MS).toISOString(),
        };
        items[index] = job;
      }
      const lastPollMs = Date.parse(record.lastWorkerPollAt || '');
      const failureNotificationPending = items.some((item) => {
        const notification = item?.failureNotification;
        if (!notification || !['pending', 'delivering'].includes(notification.status)) return false;
        return notification.status === 'pending'
          ? (!notification.notBefore || Date.parse(notification.notBefore) <= timestampMs)
          : Boolean(notification.leaseUntil && Date.parse(notification.leaseUntil) <= timestampMs);
      });
      const persistPoll = job || expiredPanelCount || expiredTelegramCount || recoveredDeliveryCount || record.lastWorkerId !== workerId
        || !Number.isFinite(lastPollMs) || timestampMs - lastPollMs >= WORKER_POLL_PERSIST_MS;
      const value = {
        job: job ? publicJob(job) : null,
        expiredPanel: expiredPanelCount > 0,
        expiredPanelCount,
        expiredTelegram: expiredTelegramCount > 0,
        expiredTelegramCount,
        recoveredDelivery: recoveredDeliveryCount > 0,
        recoveredDeliveryCount,
        workerOnline: true,
        workerLastSeenAt: timestamp.toISOString(),
        failureNotificationPending,
      };
      if (!persistPoll) return { write: false, value };
      return {
        record: { items, lastWorkerPollAt: timestamp.toISOString(), lastWorkerId: workerId },
        value,
      };
    });
  }

  async function prepareDelivery(input = {}) {
    const id = clean(input.id, 160), claimToken = clean(input.claimToken, 200), response = clean(input.response, 3900);
    const replyMarkup = sanitizeCodexReplyMarkup(input.replyMarkup);
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
          text: '', context: '', media: null, replyMarkup: null, response: '', claimToken: '', leaseUntil: '', workerId: '',
        };
        return { record: { items }, value: { expired: true } };
      }
      const deliveryStart = now();
      const job = { ...current, status: 'delivering', response, replyMarkup, deliveryStartedAt: deliveryStart.toISOString(), deliveryLeaseUntil: new Date(deliveryStart.getTime() + LEASE_MS).toISOString() };
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
      return {
        record: { items, lastWorkerHeartbeatAt: timestamp.toISOString(), lastWorkerId: current.workerId },
        value: { extended: true, leaseUntil: job.leaseUntil },
      };
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
        text: '', context: '', media: null, replyMarkup: null, response: input.keepResponse === true ? clean(current.response, 3900) : '', claimToken: '', leaseUntil: '', deliveryLeaseUntil: '', workerId: '',
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
      if (current.status === 'failed') return { write: false, value: { accepted: false, retry: false, terminal: true, duplicate: true, status: 'failed' } };
      if (!['processing', 'delivering'].includes(current.status) || current.claimToken !== claimToken) return { write: false, value: { accepted: false, retry: false, duplicate: false, status: current.status } };
      const deliveryUncertain = current.status === 'delivering' && input.deliveryFailed !== true;
      const expired = input.expired === true;
      const exhausted = expired || deliveryUncertain || Math.max(0, Number(current.attempts) || 0) >= MAX_ATTEMPTS, timestamp = now();
      const notification = exhausted && current.channel !== 'panel'
        ? (current.failureNotification || pendingFailureNotification(current, timestamp))
        : current.failureNotification;
      const job = {
        ...current, status: exhausted ? 'failed' : 'queued', lastError: expired ? 'Zadanie wygasło przed wykonaniem. Nic nie zostało uruchomione w tle.' : (error || 'Nieznany błąd pracownika Codex'),
        failedAt: timestamp.toISOString(), notBefore: new Date(timestamp.getTime() + 10_000).toISOString(),
        claimToken: '', leaseUntil: '', deliveryLeaseUntil: '', workerId: '', response: '', replyMarkup: null,
        ...(exhausted ? { text: '', context: '', media: null } : {}),
        ...(notification ? { failureNotification: notification } : {}),
      };
      const items = [...record.items]; items[index] = job;
      return {
        record: { items },
        value: {
          accepted: true, retry: !exhausted, terminal: exhausted, duplicate: false,
          status: job.status, attempts: job.attempts,
          notificationPending: notification?.status === 'pending',
        },
      };
    });
  }

  async function claimFailureNotification() {
    return change((record) => {
      const timestamp = now(), timestampMs = timestamp.getTime(), items = [...record.items];
      let changed = false;
      const ready = [];
      for (let index = 0; index < items.length; index += 1) {
        const job = items[index], current = job?.failureNotification;
        if (!current || !['pending', 'delivering'].includes(current.status)) continue;
        const expiredLease = current.status === 'delivering' && current.leaseUntil
          && Date.parse(current.leaseUntil) <= timestampMs;
        const due = current.status === 'pending' && (!current.notBefore || Date.parse(current.notBefore) <= timestampMs);
        if (!expiredLease && !due) continue;
        if (Math.max(0, Number(current.attempts) || 0) >= FAILURE_NOTIFICATION_MAX_ATTEMPTS) {
          items[index] = {
            ...job,
            failureNotification: {
              ...current, status: 'exhausted', exhaustedAt: timestamp.toISOString(),
              claimToken: '', leaseUntil: '', chatId: '', replyTo: null, messageThreadId: null,
            },
          };
          changed = true;
          continue;
        }
        ready.push({ index, createdAt: Date.parse(current.createdAt || job.failedAt || job.createdAt || '') || 0 });
      }
      ready.sort((left, right) => left.createdAt - right.createdAt || left.index - right.index);
      if (!ready.length) {
        if (!changed) return { write: false, value: { notification: null } };
        return { record: { items }, value: { notification: null } };
      }
      const index = ready[0].index, job = items[index], current = job.failureNotification, claimToken = token();
      const notification = {
        ...current,
        status: 'delivering',
        attempts: Math.max(0, Number(current.attempts) || 0) + 1,
        claimToken,
        claimedAt: timestamp.toISOString(),
        leaseUntil: new Date(timestampMs + FAILURE_NOTIFICATION_LEASE_MS).toISOString(),
      };
      items[index] = { ...job, failureNotification: notification };
      return { record: { items }, value: { notification: publicFailureNotification(items[index]) } };
    });
  }

  async function ackFailureNotification(input = {}) {
    const id = clean(input.id, 160), claimToken = clean(input.claimToken, 200);
    if (!id || !claimToken) throw queueError('Brakuje danych potwierdzenia komunikatu Telegram.', 'codex_queue_notification_ack_invalid', 422);
    return change((record) => {
      const index = record.items.findIndex((item) => item.id === id);
      if (index < 0) throw queueError('Nie znaleziono zadania Codex.', 'codex_queue_job_not_found', 404);
      const current = record.items[index], notification = current.failureNotification || {};
      if (notification.status === 'sent') return { write: false, value: { delivered: true, duplicate: true } };
      if (notification.status !== 'delivering' || notification.claimToken !== claimToken) {
        throw queueError('Wygasło prawo do potwierdzenia komunikatu Telegram.', 'codex_queue_notification_claim_invalid');
      }
      const items = [...record.items];
      items[index] = {
        ...current,
        failureNotification: {
          ...notification,
          status: 'sent', sentAt: now().toISOString(), telegramMessageId: clean(input.telegramMessageId, 80),
          claimToken: '', leaseUntil: '', chatId: '', replyTo: null, messageThreadId: null,
        },
      };
      return { record: { items }, value: { delivered: true, duplicate: false } };
    });
  }

  async function retryFailureNotification(input = {}) {
    const id = clean(input.id, 160), claimToken = clean(input.claimToken, 200), error = clean(input.error, 300);
    if (!id || !claimToken) throw queueError('Brakuje danych ponowienia komunikatu Telegram.', 'codex_queue_notification_retry_invalid', 422);
    return change((record) => {
      const index = record.items.findIndex((item) => item.id === id);
      if (index < 0) throw queueError('Nie znaleziono zadania Codex.', 'codex_queue_job_not_found', 404);
      const current = record.items[index], notification = current.failureNotification || {};
      if (notification.status === 'sent') return { write: false, value: { retry: false, duplicate: true, delivered: true } };
      if (notification.status !== 'delivering' || notification.claimToken !== claimToken) {
        return { write: false, value: { retry: false, duplicate: true, delivered: false } };
      }
      const attempts = Math.max(0, Number(notification.attempts) || 0);
      const exhausted = attempts >= FAILURE_NOTIFICATION_MAX_ATTEMPTS, timestamp = now();
      const next = {
        ...notification,
        status: exhausted ? 'exhausted' : 'pending',
        lastError: error || 'Nie udało się wysłać komunikatu Telegram.',
        claimToken: '', leaseUntil: '',
        ...(exhausted
          ? { exhaustedAt: timestamp.toISOString(), chatId: '', replyTo: null, messageThreadId: null }
          : {
            notBefore: new Date(timestamp.getTime() + failureNotificationRetryDelay(attempts)).toISOString(),
            ...(input.withoutReply === true ? { replyTo: null } : {}),
          }),
      };
      const items = [...record.items]; items[index] = { ...current, failureNotification: next };
      return { record: { items }, value: { retry: !exhausted, exhausted, duplicate: false, delivered: false } };
    });
  }

  async function status() {
    const version = await readVersioned(KEY, { items: [], updatedAt: null });
    const record = asRecord(version.value), presence = workerPresence(record, now());
    const counts = { queued: 0, processing: 0, delivering: 0, completed: 0, failed: 0 };
    for (const item of record.items) {
      const key = Object.hasOwn(counts, item?.status) ? item.status : '';
      if (key) counts[key] += 1;
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

  return {
    ackFailureNotification, claim, claimFailureNotification, enqueue, fail, heartbeat,
    markDelivered, prepareDelivery, result, retryFailureNotification, status,
  };
}
