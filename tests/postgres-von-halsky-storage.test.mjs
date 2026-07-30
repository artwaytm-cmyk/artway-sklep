import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Von Halsky ma wersjonowane migracje i rekordowy magazyn PostgreSQL', async () => {
  const [migration, repository, runner] = await Promise.all([
    read('db/migrations/0001_von_halsky_channel_storage.sql'),
    read('src/backend/lib/domain/von-halsky-state-repository.mjs'),
    read('src/backend/lib/core/postgres-migrations.mjs'),
  ]);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS artway_von_halsky_state/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS artway_von_halsky_records/);
  assert.match(migration, /PRIMARY KEY \(namespace, kind, record_id\)/);
  assert.match(migration, /WHERE key = 'inpost_von_halsky_channel'/);
  assert.doesNotMatch(migration, /DELETE FROM artway_kv_store/i);
  assert.match(repository, /IS DISTINCT FROM EXCLUDED\.data/);
  assert.match(repository, /collectionFingerprints/);
  assert.match(repository, /async function readOverview/);
  assert.match(repository, /async function readStatus/);
  assert.match(repository, /kind=ANY\(\$2::text\[\]\)/);
  assert.match(repository, /kind !== 'categories'/);
  assert.match(repository, /WHERE namespace=\$1 AND version=\$2/);
  assert.match(runner, /artway_schema_migrations/);
  assert.match(runner, /pg_advisory_lock/);
  assert.match(runner, /Migracja \$\{name\} została zmieniona po zastosowaniu/);
});
