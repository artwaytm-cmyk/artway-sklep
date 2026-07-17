import test from 'node:test';
import assert from 'node:assert/strict';
import { postgresVersionFromEtag } from '../netlify/functions/lib/core/postgres-store-repository.mjs';
import { createArtwayServer } from '../server.mjs';

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
