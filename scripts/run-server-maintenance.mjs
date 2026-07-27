#!/usr/bin/env node
import pg from 'pg';
import { executeServerCleanup } from '../src/backend/lib/server-maintenance.mjs';
import { executeDatabaseMaintenance } from '../src/backend/lib/database-maintenance.mjs';

const pool = new pg.Pool(process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.PGHOST || '/var/run/postgresql',
      database: process.env.PGDATABASE || 'artway',
      user: process.env.PGUSER || 'artway',
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
