import pg from 'pg';

const { Pool } = pg;
const pools = new Map();

function poolFor(connectionString) {
  if (!pools.has(connectionString)) {
    pools.set(connectionString, new Pool({
      connectionString,
      max: Math.max(2, Math.min(30, Number(process.env.ARTWAY_DB_POOL_MAX || 10) || 10)),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    }));
  }
  return pools.get(connectionString);
}

export function postgresVersionFromEtag(etag = '') {
  const normalized = String(etag || '').replace(/^W\//, '').replace(/^"|"$/g, '').trim();
  return /^\d+$/.test(normalized) ? Number(normalized) : null;
}

export function createPostgresStoreRepository({ name, connectionString = process.env.DATABASE_URL } = {}) {
  if (!name) throw new Error('Nazwa magazynu danych jest wymagana.');
  if (!connectionString) throw new Error('Dla magazynu PostgreSQL wymagane jest DATABASE_URL.');

  const pool = poolFor(connectionString);
  let initialization = null;
  const ensureSchema = () => {
    if (!initialization) {
      initialization = pool.query(`
        CREATE TABLE IF NOT EXISTS artway_kv_store (
          namespace TEXT NOT NULL,
          key TEXT NOT NULL,
          value JSONB NOT NULL,
          version BIGINT NOT NULL DEFAULT 1,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (namespace, key)
        )
      `).then(() => undefined);
    }
    return initialization;
  };

  return Object.freeze({
    async read(key, fallback) {
      await ensureSchema();
      const result = await pool.query('SELECT value FROM artway_kv_store WHERE namespace = $1 AND key = $2', [name, key]);
      return result.rowCount ? result.rows[0].value : fallback;
    },
    async readVersioned(key, fallback) {
      await ensureSchema();
      const result = await pool.query('SELECT value, version FROM artway_kv_store WHERE namespace = $1 AND key = $2', [name, key]);
      if (!result.rowCount) return { value: fallback, etag: '', exists: false };
      return { value: result.rows[0].value, etag: `"${result.rows[0].version}"`, exists: true };
    },
    async write(key, value) {
      await ensureSchema();
      await pool.query(`
        INSERT INTO artway_kv_store (namespace, key, value, version, updated_at)
        VALUES ($1, $2, $3::jsonb, 1, NOW())
        ON CONFLICT (namespace, key) DO UPDATE
        SET value = EXCLUDED.value, version = artway_kv_store.version + 1, updated_at = NOW()
      `, [name, key, JSON.stringify(value)]);
      return { modified: true };
    },
    async writeIfVersion(key, value, version = {}) {
      await ensureSchema();
      if (version.exists === false) {
        const created = await pool.query(`
          INSERT INTO artway_kv_store (namespace, key, value, version, updated_at)
          VALUES ($1, $2, $3::jsonb, 1, NOW())
          ON CONFLICT (namespace, key) DO NOTHING
          RETURNING version
        `, [name, key, JSON.stringify(value)]);
        return { modified: created.rowCount === 1 };
      }
      const expectedVersion = postgresVersionFromEtag(version.etag);
      if (!Number.isSafeInteger(expectedVersion)) return { modified: false };
      const updated = await pool.query(`
        UPDATE artway_kv_store
        SET value = $3::jsonb, version = version + 1, updated_at = NOW()
        WHERE namespace = $1 AND key = $2 AND version = $4
        RETURNING version
      `, [name, key, JSON.stringify(value), expectedVersion]);
      return { modified: updated.rowCount === 1 };
    },
    async delete(key) {
      await ensureSchema();
      const result = await pool.query('DELETE FROM artway_kv_store WHERE namespace = $1 AND key = $2', [name, key]);
      return { deleted: result.rowCount === 1 };
    },
    async listKeys() {
      await ensureSchema();
      const result = await pool.query('SELECT key, version FROM artway_kv_store WHERE namespace = $1 ORDER BY key ASC', [name]);
      return result.rows.map((row) => ({ key: row.key, etag: `"${row.version}"` }));
    },
  });
}
