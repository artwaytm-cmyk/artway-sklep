import crypto from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const MIGRATION_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/;

function checksum(content = '') {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function runPostgresMigrations({
  pool,
  directory = path.resolve(process.cwd(), 'db/migrations'),
} = {}) {
  if (!pool || typeof pool.connect !== 'function') {
    throw new TypeError('Migracje PostgreSQL wymagają puli połączeń.');
  }
  const files = (await readdir(directory))
    .filter((name) => MIGRATION_PATTERN.test(name))
    .sort((left, right) => left.localeCompare(right));
  const client = await pool.connect();
  const applied = [];
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('artway-schema-migrations-v1'))");
    await client.query(`
      CREATE TABLE IF NOT EXISTS artway_schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    for (const name of files) {
      const version = name.slice(0, 4);
      const sql = await readFile(path.join(directory, name), 'utf8');
      const digest = checksum(sql);
      const existing = await client.query(
        'SELECT checksum FROM artway_schema_migrations WHERE version=$1',
        [version],
      );
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== digest) {
          throw new Error(`Migracja ${name} została zmieniona po zastosowaniu.`);
        }
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO artway_schema_migrations(version,name,checksum) VALUES($1,$2,$3)',
          [version, name, digest],
        );
        await client.query('COMMIT');
        applied.push(name);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      }
    }
    return { ok: true, applied, total: files.length };
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('artway-schema-migrations-v1'))").catch(() => {});
    client.release();
  }
}
