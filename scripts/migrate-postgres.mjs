#!/usr/bin/env node
import pg from 'pg';
import { runPostgresMigrations } from '../src/backend/lib/core/postgres-migrations.mjs';
import { postgresRuntimeUrl } from './lib/postgres-runtime-url.mjs';

const { Pool } = pg;

const migrationRole = process.env.ARTWAY_MIGRATION_ROLE ?? 'artway_migrator';
const ownerRole = process.env.ARTWAY_MIGRATION_OWNER_ROLE ?? 'artway_owner';
const connectionString = await postgresRuntimeUrl({ role: migrationRole });
const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
try {
  const result = await runPostgresMigrations({ pool, ownerRole });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await pool.end();
}
