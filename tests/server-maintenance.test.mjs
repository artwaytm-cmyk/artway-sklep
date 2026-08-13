import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, readFile, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { buildServerCleanupPlan, collectServerStatus, executeServerCleanup } from '../src/backend/lib/server-maintenance.mjs';
import { createServerMaintenanceRoute } from '../src/backend/lib/server-maintenance-route.mjs';

async function fixture() {
  const root = path.join(os.tmpdir(), `artway-maintenance-test-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(root, { recursive: true });
  const roots = {
    disk: root,
    releases: path.join(root, 'releases'),
    currentRelease: path.join(root, 'releases', 'current'),
    backups: path.join(root, 'backups'),
    project: path.join(root, 'project'),
    temporary: path.join(root, 'tmp'),
    status: path.join(root, 'ops', 'status.json'),
  };
  await Promise.all(Object.values(roots).filter((value) => !value.endsWith('current') && !value.endsWith('status.json')).map((value) => mkdir(value, { recursive: true })));
  return { root, roots };
}

async function managedRelease(roots, name, createdAt) {
  const directory = path.join(roots.releases, name);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), name);
  await writeFile(path.join(directory, 'release.json'), JSON.stringify({ managedBy: 'artway-atomic-release-v1', releaseId: name, createdAt }));
  const time = new Date(createdAt);
  await utimes(directory, time, time);
  return directory;
}

test('plan chroni aktywne wydanie i usuwa tylko nadmiarowe wydania zarządzane', async (t) => {
  const { root, roots } = await fixture(); t.after(() => rm(root, { recursive: true, force: true }));
  const active = await managedRelease(roots, 'active-release', '2026-07-20T10:00:00Z');
  await managedRelease(roots, 'previous-release', '2026-07-19T10:00:00Z');
  await managedRelease(roots, 'old-release', '2026-07-18T10:00:00Z');
  await symlink('active-release', roots.currentRelease);
  const unmanaged = path.join(roots.releases, 'legacy-release');
  await mkdir(unmanaged); await writeFile(path.join(unmanaged, 'index.html'), 'legacy');
  const plan = await buildServerCleanupPlan({ roots, now: new Date('2026-07-26T12:00:00Z'), keepManagedReleases: 2 });
  assert.deepEqual(plan.candidates.filter((entry) => entry.type === 'managed-release').map((entry) => entry.name), ['old-release']);
  assert.equal(plan.protected.activeRelease, path.basename(active));
  assert.equal(plan.protected.unmanagedReleases, 1);
});

test('czyszczenie usuwa stare techniczne artefakty i zachowuje dane użytkowe', async (t) => {
  const { root, roots } = await fixture(); t.after(() => rm(root, { recursive: true, force: true }));
  const old = new Date('2026-07-10T10:00:00Z');
  const temp = path.join(roots.temporary, 'artway-old-smoke.png');
  const unrelated = path.join(roots.temporary, 'zdjecie-klienta.png');
  const staging = path.join(roots.releases, '.staging-broken');
  await writeFile(temp, Buffer.alloc(1500));
  await writeFile(unrelated, Buffer.alloc(100));
  await mkdir(staging); await writeFile(path.join(staging, 'part'), Buffer.alloc(500));
  await utimes(temp, old, old); await utimes(unrelated, old, old); await utimes(staging, old, old);
  const result = await executeServerCleanup({ roots, now: new Date('2026-07-26T12:00:00Z') });
  assert.equal(result.ok, true);
  assert.equal(result.removedItems, 2);
  assert.ok(result.freedBytes >= 2000);
  await assert.rejects(readFile(temp), { code: 'ENOENT' });
  await assert.doesNotReject(readFile(unrelated));
  const status = JSON.parse(await readFile(roots.status, 'utf8'));
  assert.equal(status.removedItems, 2);
});

test('status serwera zwraca zasoby i stan kopii bez danych wrażliwych', async (t) => {
  const { root, roots } = await fixture(); t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(roots.backups, 'status.json'), JSON.stringify({ status: 'ok', timestamp: '2026-07-26T10:00:00Z' }));
  const status = await collectServerStatus({ roots, now: new Date('2026-07-26T12:00:00Z') });
  assert.ok(status.disk.totalBytes > 0);
  assert.ok(status.memory.totalBytes > 0);
  assert.equal(status.backups.local.ok, true);
  assert.equal(status.backups.local.stale, false);
  assert.equal(status.maintenance.scheduled, true);
  assert.equal(JSON.stringify(status).includes('token'), false);
});

test('endpoint utrzymania wymaga konta administratora', async () => {
  const respond = (body, status = 200) => ({ body, status });
  const route = createServerMaintenanceRoute({ respond, isAdmin: () => false });
  const response = await route(new Request('https://example.test/api?action=server-status'), new URL('https://example.test/api?action=server-status'), 'server-status');
  assert.equal(response.status, 401);
  assert.equal(response.body.code, 'auth');
});

test('panel systemowy zawiera ekran serwera i podgląd bezpiecznego czyszczenia', async () => {
  const [navigation, diagnostics, dashboard, router] = await Promise.all([
    readFile('src/frontend/08-admin-navigation.js', 'utf8'),
    readFile('src/frontend/16-diagnostics.js', 'utf8'),
    readFile('src/frontend/16a-server-dashboard.js', 'utf8'),
    readFile('src/frontend/06-router-and-storefront.js', 'utf8'),
  ]);
  assert.match(navigation, /\/admin\/system\/serwer/);
  assert.match(diagnostics, /systemSerwerHTML/);
  assert.match(dashboard, /server-cleanup-preview/);
  assert.match(dashboard, /safe-server-cleanup/);
  assert.match(router, /systemPobierzSerwer/);
});
