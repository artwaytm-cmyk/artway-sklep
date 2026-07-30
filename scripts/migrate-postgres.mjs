#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { runPostgresMigrations } from '../src/backend/lib/core/postgres-migrations.mjs';

const { Pool } = pg;

async function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const service = await readFile('/etc/systemd/system/artway-backend.service', 'utf8').catch(() => '');
  const raw = service.split('\n').find((line) => line.startsWith('Environment=DATABASE_URL='))?.slice('Environment=DATABASE_URL='.length) || '';
  return raw.replace(/^"|"$/g, '');
}

const connectionString = await databaseUrl();
if (!connectionString) throw new Error('Brak DATABASE_URL dla migracji PostgreSQL.');
const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
try {
  const result = await runPostgresMigrations({ pool });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await pool.end();
}
