#!/usr/bin/env node
import pg from 'pg';
import { postgresRuntimeUrl } from './lib/postgres-runtime-url.mjs';

const { Pool } = pg;
const connectionString = await postgresRuntimeUrl({
  role: process.env.ARTWAY_MIGRATION_ROLE || 'artway_migrator',
});
const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 10 * 60_000,
  query_timeout: 11 * 60_000,
});

function partitionName(suffix) {
  if (!/^\d{4}_\d{2}$/.test(String(suffix || ''))) {
    throw new Error(`Nieprawidłowy miesiąc partycji: ${suffix}`);
  }
  return `artway_mutation_history_${suffix}`;
}

function quotedIdentifier(value) {
  const name = String(value || '');
  if (!/^artway_mutation_history_(?:\d{4}_\d{2}|default)$/.test(name)) {
    throw new Error(`Niedozwolona nazwa partycji: ${name}`);
  }
  return `"${name}"`;
}

function safeDate(value) {
  const date = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Nieprawidłowa granica partycji: ${date}`);
  return date;
}

async function pruneSourceMutations(retentionDays, batchSize = 5_000) {
  let deleted = 0;
  while (true) {
    const result = await pool.query(`
      DELETE FROM artway_product_mutations
      WHERE ctid IN (
        SELECT ctid FROM artway_product_mutations
        WHERE created_at < NOW()-($1::text||' days')::interval
        ORDER BY created_at
        LIMIT $2
      )
    `, [retentionDays, batchSize]);
    deleted += result.rowCount;
    if (result.rowCount < batchSize) return deleted;
  }
}

try {
  const policy = await pool.query(`
    SELECT operational_days,archive_days FROM artway_retention_policies
    WHERE data_class='mutation_history'
  `);
  const retentionDays = Math.max(30, Number(policy.rows[0]?.operational_days) || 180);
  const archiveDays = Math.max(retentionDays, Number(policy.rows[0]?.archive_days) || 730);
  const boundaries = await pool.query(`
    SELECT
      to_char(date_trunc('month',NOW()-($1::text||' days')::interval),'YYYY-MM-DD') operational_cutoff,
      to_char(date_trunc('month',NOW()-($2::text||' days')::interval),'YYYY-MM-DD') archive_cutoff
  `, [retentionDays, archiveDays]);
  const operationalCutoff = safeDate(boundaries.rows[0]?.operational_cutoff);
  const archiveCutoff = safeDate(boundaries.rows[0]?.archive_cutoff);

  const future = await pool.query(`
    SELECT
      to_char(month_start,'YYYY_MM') suffix,
      to_char(month_start,'YYYY-MM-DD') start_date,
      to_char(month_start+INTERVAL '1 month','YYYY-MM-DD') end_date
    FROM generate_series(
      date_trunc('month',NOW()),
      date_trunc('month',NOW())+INTERVAL '12 months',
      INTERVAL '1 month'
    ) month_start
    ORDER BY month_start
  `);
  let ensuredPartitions = 0;
  for (const row of future.rows) {
    const identifier = quotedIdentifier(partitionName(row.suffix));
    const startDate = safeDate(row.start_date);
    const endDate = safeDate(row.end_date);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${identifier}
      PARTITION OF artway_mutation_history
      FOR VALUES FROM ('${startDate}') TO ('${endDate}')
    `);
    ensuredPartitions += 1;
  }

  const attached = await pool.query(`
    SELECT child.relname
    FROM pg_inherits inheritance
    JOIN pg_class child ON child.oid=inheritance.inhrelid
    JOIN pg_class parent ON parent.oid=inheritance.inhparent
    JOIN pg_namespace schema_name ON schema_name.oid=child.relnamespace
    WHERE parent.relname='artway_mutation_history'
      AND schema_name.nspname='public'
    ORDER BY child.relname
  `);
  let archivedPartitions = 0;
  for (const row of attached.rows) {
    const match = /^artway_mutation_history_(\d{4})_(\d{2})$/.exec(row.relname);
    if (!match) continue;
    const month = `${match[1]}-${match[2]}-01`;
    if (month >= operationalCutoff || month < archiveCutoff) continue;
    const identifier = quotedIdentifier(row.relname);
    await pool.query(`ALTER TABLE artway_mutation_history DETACH PARTITION ${identifier}`);
    await pool.query(`ALTER TABLE ${identifier} SET SCHEMA artway_archive`);
    archivedPartitions += 1;
  }

  const archived = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='artway_archive'
      AND table_name~'^artway_mutation_history_[0-9]{4}_[0-9]{2}$'
    ORDER BY table_name
  `);
  let droppedPartitions = 0;
  for (const row of archived.rows) {
    const match = /^artway_mutation_history_(\d{4})_(\d{2})$/.exec(row.table_name);
    if (!match || `${match[1]}-${match[2]}-01` >= archiveCutoff) continue;
    await pool.query(`DROP TABLE artway_archive.${quotedIdentifier(row.table_name)}`);
    droppedPartitions += 1;
  }

  const sourceMutationsPruned = await pruneSourceMutations(retentionDays);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    retentionDays,
    archiveDays,
    operationalCutoff,
    archiveCutoff,
    ensuredPartitions,
    archivedPartitions,
    droppedPartitions,
    sourceMutationsPruned,
  })}\n`);
} finally {
  await pool.end();
}
