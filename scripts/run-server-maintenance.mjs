#!/usr/bin/env node
import pg from 'pg';
import { executeServerCleanup } from '../src/backend/lib/server-maintenance.mjs';
import { executeDatabaseMaintenance } from '../src/backend/lib/database-maintenance.mjs';
import { postgresRuntimeUrl } from './lib/postgres-runtime-url.mjs';

const pool = new pg.Pool({
  connectionString: await postgresRuntimeUrl(),
  max: 1,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 10 * 60_000,
  query_timeout: 11 * 60_000,
});
try {
  const [files, database] = await Promise.all([
    executeServerCleanup(),
    executeDatabaseMaintenance({ pool }),
  ]);
  const result = { ok: files.ok && database.ok, files, database };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`Czyszczenie serwera nie powiodło się: ${error?.message || error}\n`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
