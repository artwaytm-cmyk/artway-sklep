import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('uzgadnianie Von Halsky działa jako osobny proces serwerowy z backoffem', async () => {
  const [worker, service, backup] = await Promise.all([
    read('scripts/run-von-halsky-sync-worker.mjs'),
    read('ops/systemd/artway-von-halsky-sync.service'),
    read('ops/backup/artway-backup.sh'),
  ]);
  assert.match(worker, /von-halsky-reconcile-catalog/);
  assert.match(worker, /compact: true/);
  assert.match(worker, /source: 'background-worker'/);
  assert.match(worker, /pending > 0 \? serverPendingMs : serverIdleMs/);
  assert.match(worker, /schedule\?\.intervalMinutes/);
  assert.match(worker, /failureCount/);
  assert.match(service, /run-von-halsky-sync-worker\.mjs/);
  assert.match(service, /ARTWAY_VON_HALSKY_RECONCILE_MS=900000/);
  assert.match(backup, /artway-von-halsky-sync\.service/);
});
