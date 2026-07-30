#!/usr/bin/env node

const origin = String(
  process.env.ARTWAY_LOCAL_API_ORIGIN
  || process.env.ARTWAY_API_URL
  || 'http://127.0.0.1:3000',
).replace(/\/api\/store.*$/i, '').replace(/\/+$/, '');
const token = String(process.env.ARTWAY_ADMIN_TOKEN || '').trim();
const configuredIdleMs = Math.max(5 * 60_000, Number(process.env.ARTWAY_VON_HALSKY_RECONCILE_MS) || 15 * 60_000);
const pendingMs = Math.max(60_000, Number(process.env.ARTWAY_VON_HALSKY_PENDING_MS) || 3 * 60_000);
const maximumErrorMs = Math.max(configuredIdleMs, Number(process.env.ARTWAY_VON_HALSKY_ERROR_MAX_MS) || 30 * 60_000);

if (!token) throw new Error('Brak ARTWAY_ADMIN_TOKEN dla procesu synchronizacji Von Halsky.');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function safeError(error) {
  return String(error?.message || error || 'Nieznany błąd')
    .replace(/\b(?:sk|sk-proj|sk-ant|xai)-[A-Za-z0-9_-]{10,}\b/gi, '[ukryty token]')
    .slice(0, 500);
}

function log(event, details = {}) {
  process.stdout.write(`${JSON.stringify({
    at: new Date().toISOString(),
    component: 'von-halsky-reconciliation-worker',
    event,
    ...details,
  })}\n`);
}

async function reconcile() {
  const response = await fetch(`${origin}/api/store?action=von-halsky-reconcile-catalog`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-admin-token': token,
    },
    body: JSON.stringify({ compact: true, source: 'background-worker' }),
    signal: AbortSignal.timeout(150_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    const error = new Error(String(data?.error || `HTTP ${response.status}`).slice(0, 500));
    error.status = response.status;
    error.code = data?.code || 'von_halsky_reconcile_failed';
    throw error;
  }
  return data;
}

async function main() {
  let failureCount = 0;
  log('worker_started', { idleMs: configuredIdleMs, pendingMs, scheduleSource: 'server-settings' });
  await sleep(10_000);
  while (true) {
    let nextMs = configuredIdleMs;
    try {
      const data = await reconcile();
      failureCount = 0;
      const pending = Math.max(0, Number(data?.truth?.pending) || 0);
      const serverIdleMs = Math.max(
        15 * 60_000,
        (Number(data?.schedule?.intervalMinutes) || configuredIdleMs / 60_000) * 60_000,
      );
      const serverPendingMs = Math.max(
        60_000,
        (Number(data?.schedule?.pendingIntervalMinutes) || pendingMs / 60_000) * 60_000,
      );
      nextMs = pending > 0 ? serverPendingMs : serverIdleMs;
      log('reconciliation_completed', {
        revision: data?.revision || '',
        total: Number(data?.truth?.total) || 0,
        published: Number(data?.truth?.published) || 0,
        pending,
        rejected: Number(data?.truth?.rejected) || 0,
        changedProducts: Array.isArray(data?.changedProductIds) ? data.changedProductIds.length : 0,
        nextMs,
      });
    } catch (error) {
      failureCount += 1;
      nextMs = Math.min(maximumErrorMs, Math.max(pendingMs, pendingMs * (2 ** Math.min(4, failureCount - 1))));
      log('reconciliation_failed', {
        failureCount,
        error: safeError(error),
        code: String(error?.code || ''),
        status: Number(error?.status) || 0,
        nextMs,
      });
    }
    await sleep(nextMs);
  }
}

main().catch((error) => {
  process.stderr.write(`Von Halsky worker: ${safeError(error)}\n`);
  process.exitCode = 1;
});
