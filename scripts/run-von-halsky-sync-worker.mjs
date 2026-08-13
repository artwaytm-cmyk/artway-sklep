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
const publicationPollMs = Math.max(5_000, Number(process.env.ARTWAY_VON_HALSKY_PUBLICATION_POLL_MS) || 10_000);

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

async function syncEvents() {
  const response = await fetch(`${origin}/api/store?action=von-halsky-events-sync`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-admin-token': token,
    },
    body: JSON.stringify({ limit: 30, source: 'background-worker' }),
    signal: AbortSignal.timeout(90_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) throw new Error(String(data?.error || `HTTP ${response.status}`).slice(0, 500));
  return data;
}

async function syncPostSales() {
  return publicationRequest('von-halsky-post-sales-sync', {
    limit: 250,
    source: 'background-worker',
  }, 90_000);
}

async function publicationRequest(action, body, timeout = 60_000) {
  const response = await fetch(`${origin}/api/store?action=${action}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-admin-token': token,
    },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(timeout),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    const error = new Error(String(data?.error || `HTTP ${response.status}`).slice(0, 500));
    error.status = response.status;
    error.code = data?.code || 'von_halsky_publication_worker_failed';
    throw error;
  }
  return data;
}

async function runtimeWork(work) {
  return publicationRequest('agent-runtime-report', {
    event: 'work_progress',
    source: 'von-halsky-publication-worker',
    workerId: `von-halsky-sync-${process.pid}`,
    work,
  }, 10_000).catch(() => null);
}

async function processPublicationQueue() {
  const claim = await publicationRequest('von-halsky-publication-queue-claim', { limit: 5 }, 30_000);
  if (!claim.claimed || !Array.isArray(claim.productIds) || !claim.productIds.length) return false;
  log('publication_batch_claimed', {
    queueId: claim.queue?.id || '',
    products: claim.productIds,
    remaining: Number(claim.queue?.remaining) || 0,
  });
  const workId = `von-halsky-publication:${String(claim.queue?.id || 'queue')}`;
  await runtimeWork({
    id: workId,
    productId: String(claim.productIds[0] || ''),
    productName: `Partia Von Halsky • ${claim.productIds.length} produktów`,
    channel: 'von_halsky',
    action: 'publikacja i aktualizacja ofert',
    phase: 'wysyłanie partii do API',
    status: 'running',
    target: 'InPost Von Halsky',
    targetRef: String(claim.queue?.id || ''),
    message: `Serwer wykonuje ${claim.productIds.length} produktów; po tej partii pozostanie ${Number(claim.queue?.remaining) || 0}.`,
  });
  try {
    const result = await publicationRequest('von-halsky-sync-catalog', {
      publish: true,
      scheduled: false,
      backgroundWorker: true,
      batchSize: 1,
      productIds: claim.productIds,
    }, 240_000);
    const completed = await publicationRequest('von-halsky-publication-queue-complete', {
      leaseToken: claim.leaseToken,
      failures: Array.isArray(result.failedProducts) ? result.failedProducts : [],
      retryProductIds: Array.isArray(result.readbackPendingProductIds) ? result.readbackPendingProductIds : [],
      error: 'Von Halsky przyjął zapis, ale aktualny katalog nie potwierdził jeszcze końcowego statusu oferty.',
    }, 30_000);
    log('publication_batch_completed', {
      queueId: completed.queue?.id || claim.queue?.id || '',
      accepted: Number(result.accepted) || 0,
      updated: Number(result.updated) || 0,
      failed: Number(result.failed) || 0,
      pendingReadback: Array.isArray(result.readbackPendingProductIds) ? result.readbackPendingProductIds.length : 0,
      remaining: Number(completed.queue?.remaining) || 0,
    });
    const failed = Number(result.failed) || 0;
    const pendingReadback = Array.isArray(result.readbackPendingProductIds) ? result.readbackPendingProductIds.length : 0;
    await runtimeWork({
      id: workId,
      productId: String(claim.productIds[0] || ''),
      productName: `Partia Von Halsky • ${claim.productIds.length} produktów`,
      channel: 'von_halsky',
      action: 'publikacja i aktualizacja ofert',
      phase: 'odczyt kontrolny zapisany',
      status: failed ? 'decision_required' : pendingReadback ? 'waiting_provider' : 'confirmed',
      target: 'InPost Von Halsky',
      targetRef: String(completed.queue?.id || claim.queue?.id || ''),
      message: failed
        ? `${claim.productIds.length - failed} pozycji potwierdzono, ${failed} bezpiecznie zatrzymano do poprawy danych.`
        : pendingReadback
          ? `${pendingReadback} pozycji pozostaje w kolejce do kolejnego odczytu kontrolnego API.`
        : `API potwierdziło wszystkie ${claim.productIds.length} pozycji w partii.`,
    });
  } catch (error) {
    await publicationRequest('von-halsky-publication-queue-complete', {
      leaseToken: claim.leaseToken,
      retry: true,
      error: safeError(error),
    }, 30_000).catch((completeError) => log('publication_retry_state_failed', { error: safeError(completeError) }));
    log('publication_batch_retry', { products: claim.productIds, error: safeError(error) });
    await runtimeWork({
      id: workId,
      productId: String(claim.productIds[0] || ''),
      productName: `Partia Von Halsky • ${claim.productIds.length} produktów`,
      channel: 'von_halsky',
      action: 'publikacja i aktualizacja ofert',
      phase: 'ponowienie po błędzie technicznym',
      status: 'waiting_provider',
      target: 'InPost Von Halsky',
      targetRef: String(claim.queue?.id || ''),
      error: safeError(error),
      message: 'Partia pozostaje w trwałej kolejce i zostanie ponowiona przez serwer.',
    });
  }
  return true;
}

async function main() {
  let failureCount = 0;
  let nextReconciliationAt = Date.now() + 10_000;
  log('worker_started', { idleMs: configuredIdleMs, pendingMs, publicationPollMs, scheduleSource: 'server-settings' });
  while (true) {
    try { await processPublicationQueue(); }
    catch (error) { log('publication_queue_poll_failed', { error: safeError(error) }); }
    if (Date.now() >= nextReconciliationAt) {
      let nextMs = configuredIdleMs;
      try {
        let events = {};
        try { events = await syncEvents(); }
        catch (error) { log('event_feed_failed', { error: safeError(error) }); }
        let postSales = {};
        try { postSales = await syncPostSales(); }
        catch (error) { log('post_sales_sync_failed', { error: safeError(error) }); }
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
          verificationErrors: Number(data?.truth?.verificationErrors) || 0,
          events: Number(events?.fetched) || 0,
          returns: Array.isArray(postSales?.returns) ? postSales.returns.length : 0,
          claims: Array.isArray(postSales?.claims) ? postSales.claims.length : 0,
          postSalesPartial: postSales?.partial === true,
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
      nextReconciliationAt = Date.now() + nextMs;
    }
    await sleep(publicationPollMs);
  }
}

main().catch((error) => {
  process.stderr.write(`Von Halsky worker: ${safeError(error)}\n`);
  process.exitCode = 1;
});
