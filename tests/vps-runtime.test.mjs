import test from 'node:test';
import assert from 'node:assert/strict';
import { postgresVersionFromEtag } from '../src/backend/lib/core/postgres-store-repository.mjs';
import { createArtwayServer } from '../server.mjs';
import { createResilientServerRuntime } from '../src/backend/server-runtime.mjs';

test('wersja PostgreSQL przyjmuje wyłącznie bezpieczny numeryczny etag', () => {
  assert.equal(postgresVersionFromEtag('"12"'), 12);
  assert.equal(postgresVersionFromEtag('W/"7"'), 7);
  assert.equal(postgresVersionFromEtag('abc'), null);
  assert.equal(postgresVersionFromEtag('1 OR 1=1'), null);
});

test('runtime VPS udostępnia lekki endpoint zdrowia bez bazy', async () => {
  const server = createArtwayServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/healthz`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, service: 'artway-vps' });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('runtime VPS automatycznie wznawia nasłuch po nieoczekiwanym zamknięciu', async () => {
  const server = createArtwayServer();
  const events = [];
  const logger = {
    info: (value) => events.push(JSON.parse(value)),
    warn: (value) => events.push(JSON.parse(value)),
    error: (value) => events.push(JSON.parse(value)),
  };
  const runtime = createResilientServerRuntime({
    server,
    host: '127.0.0.1',
    port: 0,
    logger,
    manageProcess: false,
    monitorIntervalMs: 25,
    recoveryDelayMs: 10,
    heartbeatIntervalMs: 60_000,
  });
  runtime.start();
  await new Promise((resolve) => server.once('listening', resolve));
  const firstPort = server.address().port;
  assert.equal((await fetch(`http://127.0.0.1:${firstPort}/healthz`)).status, 200);

  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Runtime nie wznowił nasłuchu')), 1_000);
    server.once('listening', () => { clearTimeout(timeout); resolve(); });
  });

  const secondPort = server.address().port;
  assert.equal((await fetch(`http://127.0.0.1:${secondPort}/healthz`)).status, 200);
  assert.ok(events.some((event) => event.event === 'server_closed_unexpectedly'));
  assert.ok(events.some((event) => event.event === 'listen_recovery_attempt'));
  assert.equal(runtime.state().recoveryCount, 1);
  await runtime.stop({ reason: 'test_finished' });
});

test('eksport kopii wymaga uprawnień administratora', async () => {
  const previous = process.env.ARTWAY_ADMIN_TOKEN;
  process.env.ARTWAY_ADMIN_TOKEN = 'test-admin-token';
  const server = createArtwayServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/store?action=store-backup-manifest`);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'auth');
  } finally {
    if (previous === undefined) delete process.env.ARTWAY_ADMIN_TOKEN; else process.env.ARTWAY_ADMIN_TOKEN = previous;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
