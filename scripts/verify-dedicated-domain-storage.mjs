import assert from 'node:assert/strict';
import { createPostgresStoreRepository, postgresPoolFor } from '../src/backend/lib/core/postgres-store-repository.mjs';
import {
  DEDICATED_DOMAIN_MIGRATION,
  dedicatedDomains,
  dedicatedTableForDomain,
} from '../src/backend/lib/core/dedicated-domain-storage.mjs';

const connectionString = process.env.DATABASE_URL;
const namespace = String(process.env.ARTWAY_STORE_NAME || 'artway-sklep').trim();
const requireArchive = process.argv.includes('--require-archive');
const compareArchive = process.argv.includes('--compare-archive');
if (!connectionString) throw new Error('Brakuje DATABASE_URL.');
if (namespace !== 'artway-sklep') throw new Error('Weryfikator obsługuje wyłącznie przestrzeń artway-sklep.');

const pool = postgresPoolFor(connectionString);
const repository = createPostgresStoreRepository({ name: namespace, connectionString });

try {
  await repository.read('settings', { data: {}, rev: 0, updated_at: null });
  const status = await repository.storageStatus();
  assert.equal(status.migrated, true, 'Migracja dedykowanych tabel nie została zakończona.');
  assert.equal(status.activeLegacyDomains, 0, 'Aktywne domeny nadal znajdują się w starym KV.');
  assert.equal(status.activeGenericDedicatedRecords, 0, 'Dane domen dedykowanych pozostały w tabeli ogólnej.');

  const archiveCount = await pool.query(
    `SELECT count(*)::int AS count FROM artway_domain_records_archive_v2
      WHERE namespace=$1 AND migration_id=$2`,
    [namespace, DEDICATED_DOMAIN_MIGRATION],
  );
  const archivedRecords = Number(archiveCount.rows[0]?.count) || 0;
  if (requireArchive) assert.ok(archivedRecords > 0, 'Brakuje kopii rekordów sprzed migracji v2.');

  let verifiedArchiveRecords = 0, archiveMismatches = 0;
  for (const domain of dedicatedDomains()) {
    const table = dedicatedTableForDomain(domain);
    const result = await pool.query(`SELECT
      count(*)::int AS archived,
      count(*) FILTER (WHERE d.record_id IS NULL OR d.ordinal IS DISTINCT FROM a.ordinal OR d.data IS DISTINCT FROM a.data)::int AS mismatches
      FROM artway_domain_records_archive_v2 a
      LEFT JOIN ${table} d ON d.namespace=a.namespace AND d.domain=a.domain
        AND d.collection=a.collection AND d.record_id=a.record_id
      WHERE a.namespace=$1 AND a.migration_id=$2 AND a.domain=$3`,
    [namespace, DEDICATED_DOMAIN_MIGRATION, domain]);
    const archived = Number(result.rows[0]?.archived) || 0;
    const mismatches = Number(result.rows[0]?.mismatches) || 0;
    if (compareArchive) assert.equal(mismatches, 0, `Domena ${domain}: kopia v2 różni się od tabeli ${table}.`);
    verifiedArchiveRecords += archived;
    archiveMismatches += mismatches;
  }
  assert.equal(verifiedArchiveRecords, archivedRecords, 'Nie wszystkie rekordy kopii v2 należą do obsługiwanych domen.');

  process.stdout.write(`${JSON.stringify({
    ok: true,
    namespace,
    archivedRecords,
    verifiedArchiveRecords,
    archiveMismatches,
    ...status,
  })}\n`);
} finally {
  await pool.end();
}
