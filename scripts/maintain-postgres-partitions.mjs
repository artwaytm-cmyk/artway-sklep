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

try {
  const policy = await pool.query(`
    SELECT operational_days,archive_days FROM artway_retention_policies
    WHERE data_class='mutation_history'
  `);
  const retentionDays = Math.max(30, Number(policy.rows[0]?.operational_days) || 180);
  const archiveDays = Math.max(retentionDays, Number(policy.rows[0]?.archive_days) || 730);
  await pool.query(`
    DO $maintenance$
    DECLARE
      month_start DATE;
      next_month DATE;
      partition_name TEXT;
      operational_cutoff DATE := date_trunc('month',NOW()-($1::text||' days')::interval)::date;
      archive_cutoff DATE := date_trunc('month',NOW()-($2::text||' days')::interval)::date;
    BEGIN
      FOR month_start IN
        SELECT generate_series(
          date_trunc('month',NOW())::date,
          (date_trunc('month',NOW())+INTERVAL '12 months')::date,
          INTERVAL '1 month'
        )::date
      LOOP
        next_month := (month_start+INTERVAL '1 month')::date;
        partition_name := 'artway_mutation_history_'||to_char(month_start,'YYYY_MM');
        EXECUTE format(
          'CREATE TABLE IF NOT EXISTS %I PARTITION OF artway_mutation_history
           FOR VALUES FROM (%L) TO (%L)',
          partition_name,month_start,next_month
        );
      END LOOP;
      FOR month_start IN
        SELECT generate_series(
          archive_cutoff,
          operational_cutoff-INTERVAL '1 month',
          INTERVAL '1 month'
        )::date
      LOOP
        partition_name := 'artway_mutation_history_'||to_char(month_start,'YYYY_MM');
        IF to_regclass('public.'||partition_name) IS NOT NULL THEN
          EXECUTE format(
            'ALTER TABLE artway_mutation_history DETACH PARTITION %I',
            partition_name
          );
          EXECUTE format(
            'ALTER TABLE %I SET SCHEMA artway_archive',
            partition_name
          );
        END IF;
      END LOOP;
      FOR month_start IN
        SELECT generate_series(
          DATE '2020-01-01',
          archive_cutoff-INTERVAL '1 month',
          INTERVAL '1 month'
        )::date
      LOOP
        partition_name := 'artway_mutation_history_'||to_char(month_start,'YYYY_MM');
        IF to_regclass('artway_archive.'||partition_name) IS NOT NULL THEN
          EXECUTE format('DROP TABLE artway_archive.%I',partition_name);
        END IF;
      END LOOP;
    END $maintenance$;
  `, [retentionDays, archiveDays]);
  const pruned = await pool.query(`
    DELETE FROM artway_product_mutations
    WHERE created_at < NOW()-($1::text||' days')::interval
  `, [retentionDays]);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    retentionDays,
    archiveDays,
    sourceMutationsPruned: pruned.rowCount,
  })}\n`);
} finally {
  await pool.end();
}
