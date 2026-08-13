#!/usr/bin/env node
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { postgresRuntimeUrl, safePostgresTarget } from './lib/postgres-runtime-url.mjs';

const { Pool } = pg;
const connectionString = await postgresRuntimeUrl();
const target = safePostgresTarget(connectionString);
const output = process.env.ARTWAY_POSTGRES_STATUS_FILE
  || '/srv/artway/ops/status/postgres.json';
const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 30_000,
  query_timeout: 35_000,
});

try {
  const [database, activity, tables, wal, reset, extension, settings] = await Promise.all([
    pool.query(`
      SELECT pg_database_size(current_database())::bigint AS size_bytes,
        xact_commit+xact_rollback AS transactions,
        blks_hit,blks_read,deadlocks,temp_bytes
      FROM pg_stat_database WHERE datname=current_database()
    `),
    pool.query(`
      SELECT count(*)::int AS connections,
        count(*) FILTER(WHERE wait_event IS NOT NULL)::int AS waiting,
        COALESCE(max(EXTRACT(EPOCH FROM (NOW()-xact_start)))
          FILTER(WHERE xact_start IS NOT NULL),0)::bigint AS oldest_transaction_seconds
      FROM pg_stat_activity WHERE datname=current_database()
    `),
    pool.query(`
      SELECT COALESCE(sum(n_dead_tup),0)::bigint AS dead_tuples,
        count(*) FILTER(WHERE n_dead_tup>greatest(1000,n_live_tup/5))::int AS bloated_candidates
      FROM pg_stat_user_tables
    `),
    pool.query(`SELECT pg_wal_lsn_diff(pg_current_wal_lsn(),'0/0')::bigint AS wal_bytes`),
    pool.query(`SELECT stats_reset FROM pg_stat_database WHERE datname=current_database()`),
    pool.query(`SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_stat_statements') AS installed`),
    pool.query(`
      SELECT name,setting FROM pg_settings WHERE name IN (
        'track_io_timing','log_min_duration_statement','statement_timeout',
        'lock_timeout','idle_in_transaction_session_timeout','archive_mode',
        'archive_command','shared_preload_libraries'
      ) ORDER BY name
    `),
  ]);
  const db = database.rows[0] || {}, ioTotal = Number(db.blks_hit || 0) + Number(db.blks_read || 0);
  const statementsInstalled = extension.rows[0]?.installed === true;
  const statisticsResetAt = reset.rows[0]?.stats_reset || null;
  const slow = statementsInstalled
    ? await pool.query(`
      SELECT queryid::text,calls::bigint,
        round(total_exec_time::numeric,2) total_ms,
        round(mean_exec_time::numeric,2) mean_ms,
        rows::bigint
      FROM pg_stat_statements
      WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database())
        AND calls>0
      ORDER BY total_exec_time DESC LIMIT 20
    `)
    : { rows: [] };
  const unusedIndexes = statisticsResetAt
    && Date.now() - new Date(statisticsResetAt).getTime() >= 7 * 24 * 60 * 60 * 1000
    ? await pool.query(`
      SELECT s.schemaname,s.relname AS table_name,s.indexrelname AS index_name,
        pg_relation_size(s.indexrelid)::bigint AS size_bytes,s.idx_scan::bigint
      FROM pg_stat_user_indexes s
      JOIN pg_index i ON i.indexrelid=s.indexrelid
      WHERE s.idx_scan=0
        AND NOT i.indisprimary
        AND NOT i.indisunique
        AND pg_relation_size(s.indexrelid)>=1024*1024
      ORDER BY pg_relation_size(s.indexrelid) DESC
      LIMIT 30
    `)
    : { rows: [] };
  const sampledAt = new Date().toISOString();
  const details = {
    target,
    config: Object.fromEntries(settings.rows.map((row) => [row.name, row.setting])),
    topStatements: slow.rows,
    statisticsResetAt,
    bloatedCandidates: Number(tables.rows[0]?.bloated_candidates) || 0,
    unusedIndexCandidates: unusedIndexes.rows,
    unusedIndexPolicy: 'Tylko pomiar; usunięcie dopiero po minimum 7 dniach statystyk i ręcznym przeglądzie.',
  };
  await pool.query(`
    INSERT INTO artway_db_health_samples(
      sampled_at,database_name,database_size_bytes,active_connections,
      waiting_connections,cache_hit_ratio,dead_tuples,
      oldest_transaction_seconds,wal_bytes,slow_query_count,details
    ) VALUES(
      $1,current_database(),$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb
    )
  `, [
    sampledAt, Number(db.size_bytes) || 0,
    Number(activity.rows[0]?.connections) || 0,
    Number(activity.rows[0]?.waiting) || 0,
    ioTotal ? Number(db.blks_hit || 0) / ioTotal * 100 : null,
    Number(tables.rows[0]?.dead_tuples) || 0,
    Number(activity.rows[0]?.oldest_transaction_seconds) || 0,
    Number(wal.rows[0]?.wal_bytes) || 0,
    slow.rows.filter((row) => Number(row.mean_ms) >= 500).length,
    JSON.stringify(details),
  ]);
  await pool.query(`
    INSERT INTO artway_index_usage_samples(
      sampled_at,schema_name,table_name,index_name,index_bytes,scans,
      tuples_read,tuples_fetched,statistics_reset_at
    )
    SELECT $1,schemaname,relname,indexrelname,pg_relation_size(indexrelid),
      idx_scan,idx_tup_read,idx_tup_fetch,$2
    FROM pg_stat_user_indexes
  `, [sampledAt, reset.rows[0]?.stats_reset || null]);
  await pool.query(`
    WITH measured AS (
      SELECT
        s.schema_name,s.index_name,max(s.table_name) table_name,
        min(s.sampled_at) first_sample_at,max(s.sampled_at) last_sample_at,
        count(*)::int sample_count,
        greatest(0,max(s.scans)-min(s.scans))::bigint scan_delta,
        max(s.index_bytes)::bigint index_bytes
      FROM artway_index_usage_samples s
      WHERE s.sampled_at>=NOW()-INTERVAL '90 days'
      GROUP BY s.schema_name,s.index_name
    ), eligible AS (
      SELECT m.*,
        i.indisprimary,i.indisunique,
        EXISTS(
          SELECT 1 FROM pg_constraint c WHERE c.conindid=i.indexrelid
        ) constraint_backed
      FROM measured m
      JOIN pg_class idx ON idx.relname=m.index_name
      JOIN pg_namespace n ON n.oid=idx.relnamespace
        AND n.nspname=m.schema_name
      JOIN pg_index i ON i.indexrelid=idx.oid
    )
    INSERT INTO artway_index_decisions(
      schema_name,index_name,table_name,first_sample_at,last_sample_at,
      sample_count,total_scans,decision,reason,decided_at
    )
    SELECT
      schema_name,index_name,table_name,first_sample_at,last_sample_at,
      sample_count,scan_delta,
      CASE
        WHEN last_sample_at-first_sample_at>=INTERVAL '7 days'
         AND scan_delta=0 AND index_bytes>=1024*1024
         AND NOT indisprimary AND NOT indisunique AND NOT constraint_backed
        THEN 'candidate'
        ELSE 'observe'
      END,
      CASE
        WHEN indisprimary OR indisunique OR constraint_backed
          THEN 'indeks chroniony przez klucz lub ograniczenie'
        WHEN last_sample_at-first_sample_at<INTERVAL '7 days'
          THEN 'trwa pomiar przez minimum 7 dni'
        WHEN scan_delta>0
          THEN 'indeks został użyty w okresie pomiarowym'
        WHEN index_bytes<1024*1024
          THEN 'indeks ma mniej niż 1 MB'
        ELSE 'kandydat po minimum 7 dniach bez odczytu'
      END,
      CASE
        WHEN last_sample_at-first_sample_at>=INTERVAL '7 days'
         AND scan_delta=0 AND index_bytes>=1024*1024
         AND NOT indisprimary AND NOT indisunique AND NOT constraint_backed
        THEN NOW()
        ELSE NULL
      END
    FROM eligible
    ON CONFLICT(schema_name,index_name) DO UPDATE SET
      table_name=EXCLUDED.table_name,
      first_sample_at=LEAST(
        artway_index_decisions.first_sample_at,EXCLUDED.first_sample_at
      ),
      last_sample_at=EXCLUDED.last_sample_at,
      sample_count=EXCLUDED.sample_count,
      total_scans=EXCLUDED.total_scans,
      decision=CASE
        WHEN artway_index_decisions.executed_at IS NOT NULL
          THEN artway_index_decisions.decision
        ELSE EXCLUDED.decision
      END,
      reason=EXCLUDED.reason,
      decided_at=CASE
        WHEN artway_index_decisions.executed_at IS NOT NULL
          THEN artway_index_decisions.decided_at
        ELSE EXCLUDED.decided_at
      END
  `);
  await pool.query(`DELETE FROM artway_db_health_samples WHERE sampled_at<NOW()-INTERVAL '90 days'`);
  await pool.query(`DELETE FROM artway_index_usage_samples WHERE sampled_at<NOW()-INTERVAL '90 days'`);
  const report = {
    ok: true,
    sampledAt,
    database: target.database,
    sizeBytes: Number(db.size_bytes) || 0,
    activeConnections: Number(activity.rows[0]?.connections) || 0,
    waitingConnections: Number(activity.rows[0]?.waiting) || 0,
    cacheHitRatio: ioTotal ? Number((Number(db.blks_hit || 0) / ioTotal * 100).toFixed(3)) : null,
    deadTuples: Number(tables.rows[0]?.dead_tuples) || 0,
    oldestTransactionSeconds: Number(activity.rows[0]?.oldest_transaction_seconds) || 0,
    pgStatStatements: statementsInstalled,
    topStatements: slow.rows,
    unusedIndexCandidates: unusedIndexes.rows,
    indexDecisionPolicy: {
      minimumObservationDays: 7,
      minimumSizeBytes: 1024 * 1024,
      automaticDrop: false,
    },
    config: details.config,
  };
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, output);
  process.stdout.write(`${JSON.stringify(report)}\n`);
} finally {
  await pool.end();
}
