#!/usr/bin/env node

const origin = String(
  process.env.ARTWAY_LOCAL_API_ORIGIN
  || process.env.ARTWAY_API_URL
  || 'http://127.0.0.1:3000',
).replace(/\/api\/store.*$/i, '').replace(/\/+$/, '');
const token = String(process.env.ARTWAY_ADMIN_TOKEN || '').trim();
const intervalMs = Math.max(5 * 60_000, Number(process.env.ARTWAY_ALLEGRO_WORKER_MS) || 15 * 60_000);
const startDelayMs = Math.max(1_000, Number(process.env.ARTWAY_ALLEGRO_WORKER_START_DELAY_MS) || 20_000);

if (!token) throw new Error('Brak ARTWAY_ADMIN_TOKEN dla procesu synchronizacji Allegro.');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const safe = (value) => String(value?.message || value || '')
  .replace(/\b(?:sk|sk-proj|sk-ant|xai)-[A-Za-z0-9_-]{10,}\b/gi, '[ukryty token]')
  .slice(0, 500);

function log(event, details = {}) {
  process.stdout.write(`${JSON.stringify({
    at: new Date().toISOString(),
    component: 'allegro-sync-worker',
    event,
    ...details,
  })}\n`);
}

async function call(action, body) {
  const response = await fetch(`${origin}/api/store?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-admin-token': token,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10 * 60_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    const error = new Error(String(data?.error || `HTTP ${response.status}`).slice(0, 500));
    error.code = data?.code || `allegro_${action}_failed`;
    error.status = response.status;
    throw error;
  }
  return data;
}

async function cycle() {
  const operations = [
    ['orders', 'allegro-sync-orders', { limit: 200, source: 'server-worker' }],
    ['communications', 'allegro-sync-communications', { limit: 50, autoReply: true, source: 'server-worker' }],
    ['offers-light', 'allegro-sync-offers', {
      limit: 20_000,
      details: false,
      compact: true,
      source: 'scheduled-catalog-refresh',
    }],
    ['offers-full', 'allegro-sync-offers', {
      limit: 20_000,
      details: true,
      detailsLimit: 1_000,
      maintenance: true,
      maintenanceLimit: 25,
      complianceLimit: 20,
      compact: true,
      source: 'scheduled-offers-sync',
    }],
  ];
  const results = [];
  for (const [name, action, body] of operations) {
    const started = Date.now();
    try {
      const data = await call(action, body);
      results.push({
        name,
        ok: true,
        skipped: data?.skipped === true,
        count: Number(data?.count ?? data?.totalCount ?? data?.summary?.orders?.live) || 0,
        durationMs: Date.now() - started,
      });
    } catch (error) {
      results.push({
        name,
        ok: false,
        error: safe(error),
        code: String(error?.code || ''),
        status: Number(error?.status) || 0,
        durationMs: Date.now() - started,
      });
    }
  }
  log('cycle_completed', { results });
}

async function main() {
  log('worker_started', { intervalMs, startDelayMs });
  await sleep(startDelayMs);
  while (true) {
    const started = Date.now();
    await cycle();
    await sleep(Math.max(5_000, intervalMs - (Date.now() - started)));
  }
}

main().catch((error) => {
  process.stderr.write(`Allegro worker: ${safe(error)}\n`);
  process.exitCode = 1;
});
