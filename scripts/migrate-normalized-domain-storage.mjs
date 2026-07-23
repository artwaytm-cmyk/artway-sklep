import assert from 'node:assert/strict';
import { createPostgresStoreRepository, postgresPoolFor } from '../src/backend/lib/core/postgres-store-repository.mjs';
import { DIRECT_DOMAIN_CONFIGS, SETTINGS_DOMAIN_CONFIGS } from '../src/backend/lib/core/normalized-domain-repository.mjs';

const connectionString = process.env.DATABASE_URL;
const namespace = String(process.env.ARTWAY_STORE_NAME || 'artway-sklep').trim();
if (!connectionString) throw new Error('Brakuje DATABASE_URL.');
if (namespace !== 'artway-sklep') throw new Error('Migrator produkcyjny obsługuje wyłącznie artway-sklep.');

const pool = postgresPoolFor(connectionString);
const repository = createPostgresStoreRepository({ name: namespace, connectionString });

try {
  await repository.read('settings', { data: {}, rev: 0, updated_at: null });
  const backups = await pool.query(`SELECT key,value FROM artway_domain_legacy_backup
    WHERE namespace=$1 AND migration_id='domain-records-v1' ORDER BY key`, [namespace]);
  assert.ok(backups.rowCount > 0, 'Migracja nie utworzyła kopii wycofania.');
  for (const row of backups.rows) {
    if (row.key !== 'settings') assert.ok(DIRECT_DOMAIN_CONFIGS[row.key], `Kopia zawiera nieobsługiwaną domenę: ${row.key}`);
  }

  const status = await repository.storageStatus();
  assert.equal(status.migrated, true, 'Migracja nie została oznaczona jako zakończona.');
  assert.equal(status.activeLegacyDomains, 0, 'Aktywne dane nadal znajdują się w starych rekordach KV.');
  assert.equal(status.activeGenericDedicatedRecords, 0, 'Domeny v2 nadal znajdują się w tabeli ogólnej.');
  const settings = await pool.query("SELECT value FROM artway_kv_store WHERE namespace=$1 AND key='settings'", [namespace]);
  for (const key of Object.keys(SETTINGS_DOMAIN_CONFIGS)) {
    assert.equal(Object.hasOwn(settings.rows[0]?.value?.data || {}, key), false, `Klucz ${key} nadal znajduje się w settings.`);
  }
  process.stdout.write(`${JSON.stringify({ ok: true, namespace, comparedBackups: backups.rowCount, ...status })}\n`);
} finally {
  await pool.end();
}
