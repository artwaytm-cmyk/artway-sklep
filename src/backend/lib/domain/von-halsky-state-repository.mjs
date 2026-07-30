import crypto from 'node:crypto';
import { postgresVersionFromEtag } from '../core/postgres-store-repository.mjs';

export const VON_HALSKY_STORE_KEY = 'inpost_von_halsky_channel';
const COLLECTIONS = Object.freeze([
  'diagnostics', 'offers', 'orders', 'returns',
  'claims', 'events', 'commands', 'categories',
]);

const clone = (value) => structuredClone(value);
const array = (value) => Array.isArray(value) ? value : [];
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const fingerprint = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function recordId(kind, data = {}, ordinal = 0) {
  const candidates = [
    data.offerId, data.commandId, data.claimId, data.eventId, data.id,
    data?.offer?.id,
  ];
  const selected = candidates.map((value) => String(value || '').trim()).find(Boolean);
  return selected || crypto.createHash('sha256').update(`${kind}:${ordinal}:${JSON.stringify(data)}`).digest('hex');
}

function splitState(value = {}) {
  const source = object(value), meta = { ...source };
  for (const key of ['settings', 'sync', ...COLLECTIONS]) delete meta[key];
  return {
    settings: object(source.settings),
    sync: object(source.sync),
    collections: Object.fromEntries(COLLECTIONS.map((kind) => [kind, array(source[kind])])),
    meta,
  };
}

function hydrateState(row = {}, records = []) {
  const collections = Object.fromEntries(COLLECTIONS.map((kind) => [kind, []]));
  for (const record of records) {
    if (collections[record.kind]) collections[record.kind].push(record.data);
  }
  return {
    ...object(row.meta),
    settings: object(row.settings),
    sync: object(row.sync),
    ...collections,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : row.meta?.updatedAt || null,
  };
}

async function readSnapshot(pool, namespace, fallback, kinds = COLLECTIONS) {
  const selected = [...new Set(array(kinds).filter((kind) => COLLECTIONS.includes(kind)))];
  const result = await pool.query(`
    SELECT s.settings,s.sync,s.version,s.updated_at,
      (SELECT COUNT(*)::integer
       FROM artway_von_halsky_records categories
       WHERE categories.namespace=s.namespace AND categories.kind='categories') category_count,
      COALESCE(
        jsonb_agg(
          jsonb_build_object('kind',r.kind,'ordinal',r.ordinal,'data',r.data)
          ORDER BY r.kind,r.ordinal
        ) FILTER (WHERE r.record_id IS NOT NULL),
        '[]'::jsonb
      ) records
    FROM artway_von_halsky_state s
    LEFT JOIN artway_von_halsky_records r
      ON r.namespace=s.namespace AND r.kind=ANY($2::text[])
    WHERE s.namespace=$1
    GROUP BY s.namespace,s.settings,s.sync,s.version,s.updated_at
  `, [namespace, selected]);
  if (!result.rowCount) return { ...clone(fallback), categoryCount: 0 };
  const row = result.rows[0];
  return {
    ...hydrateState({
      ...row,
      meta: { channel: 'InPost Von Halsky' },
    }, row.records || []),
    categoryCount: Number(row.category_count) || 0,
  };
}

async function tableAvailable(pool) {
  const result = await pool.query("SELECT to_regclass('public.artway_von_halsky_state') IS NOT NULL AS available");
  return result.rows[0]?.available === true;
}

export function createVonHalskyStateRepository({
  pool,
  namespace = 'artway-sklep',
  legacy,
} = {}) {
  if (!pool || typeof pool.connect !== 'function') throw new TypeError('Repozytorium Von Halsky wymaga PostgreSQL.');
  if (!legacy?.readVersioned || !legacy?.writeIfVersion) throw new TypeError('Repozytorium Von Halsky wymaga bezpiecznego magazynu zgodnościowego.');
  let availability;
  const available = async () => {
    if (availability === undefined) availability = await tableAvailable(pool);
    return availability;
  };

  async function readVersioned(key, fallback) {
    if (key !== VON_HALSKY_STORE_KEY || !await available()) return legacy.readVersioned(key, fallback);
    const result = await pool.query(`
      SELECT s.settings,s.sync,s.version,s.updated_at,
        COALESCE(
          jsonb_agg(
            jsonb_build_object('kind',r.kind,'ordinal',r.ordinal,'data',r.data)
            ORDER BY r.kind,r.ordinal
          ) FILTER (WHERE r.record_id IS NOT NULL),
          '[]'::jsonb
        ) records
      FROM artway_von_halsky_state s
      LEFT JOIN artway_von_halsky_records r
        ON r.namespace=s.namespace
      WHERE s.namespace=$1
      GROUP BY s.namespace,s.settings,s.sync,s.version,s.updated_at
    `, [namespace]);
    if (!result.rowCount) return legacy.readVersioned(key, fallback);
    const row = result.rows[0], value = hydrateState({
      ...row,
      meta: { channel: 'InPost Von Halsky' },
    }, row.records || []);
    return {
      value,
      etag: `"${row.version}"`,
      exists: true,
      collectionFingerprints: Object.fromEntries(
        COLLECTIONS.map((kind) => [kind, fingerprint(value[kind])]),
      ),
    };
  }

  async function readOverview(fallback) {
    if (!await available()) return (await legacy.readVersioned(VON_HALSKY_STORE_KEY, fallback)).value;
    // Widok panelu nie potrzebuje ośmiotysięcznego drzewa kategorii. Samo
    // pominięcie tej kolekcji zmniejsza odczyt początkowy o ponad 1,7 MB.
    return readSnapshot(pool, namespace, fallback, COLLECTIONS.filter((kind) => kind !== 'categories'));
  }

  async function readStatus(fallback) {
    if (!await available()) return (await legacy.readVersioned(VON_HALSKY_STORE_KEY, fallback)).value;
    return readSnapshot(pool, namespace, fallback, ['offers', 'commands']);
  }

  async function replaceCollection(client, kind, items) {
    const payload = array(items).map((data, ordinal) => ({
      record_id: recordId(kind, data, ordinal),
      ordinal,
      data,
    }));
    if (payload.length) {
      await client.query(`
        WITH incoming AS (
          SELECT record_id,ordinal,data
          FROM jsonb_to_recordset($3::jsonb)
            AS x(record_id text,ordinal bigint,data jsonb)
        )
        INSERT INTO artway_von_halsky_records(
          namespace,kind,record_id,ordinal,data,updated_at
        )
        SELECT $1,$2,record_id,ordinal,data,NOW()
        FROM incoming
        ON CONFLICT(namespace,kind,record_id) DO UPDATE
        SET ordinal=EXCLUDED.ordinal,data=EXCLUDED.data,updated_at=NOW()
        WHERE artway_von_halsky_records.ordinal IS DISTINCT FROM EXCLUDED.ordinal
           OR artway_von_halsky_records.data IS DISTINCT FROM EXCLUDED.data
      `, [namespace, kind, JSON.stringify(payload)]);
      await client.query(`
        DELETE FROM artway_von_halsky_records current
        WHERE current.namespace=$1 AND current.kind=$2
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_to_recordset($3::jsonb)
              AS x(record_id text,ordinal bigint,data jsonb)
            WHERE x.record_id=current.record_id
          )
      `, [namespace, kind, JSON.stringify(payload)]);
    } else {
      await client.query(
        'DELETE FROM artway_von_halsky_records WHERE namespace=$1 AND kind=$2',
        [namespace, kind],
      );
    }
  }

  async function writeIfVersion(key, value, version = {}) {
    if (key !== VON_HALSKY_STORE_KEY || !await available()) return legacy.writeIfVersion(key, value, version);
    const expectedVersion = postgresVersionFromEtag(version.etag);
    if (!Number.isSafeInteger(expectedVersion)) return { modified: false };
    const next = splitState(value), previous = splitState(version.value);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(`
        UPDATE artway_von_halsky_state
        SET settings=$3::jsonb,sync=$4::jsonb,version=version+1,updated_at=NOW()
        WHERE namespace=$1 AND version=$2
        RETURNING version,updated_at
      `, [namespace, expectedVersion, JSON.stringify(next.settings), JSON.stringify(next.sync)]);
      if (!updated.rowCount) {
        await client.query('ROLLBACK');
        return { modified: false };
      }
      for (const kind of COLLECTIONS) {
        const before = version.collectionFingerprints?.[kind] || fingerprint(previous.collections[kind]);
        const after = fingerprint(next.collections[kind]);
        if (before !== after) await replaceCollection(client, kind, next.collections[kind]);
      }
      await client.query('COMMIT');
      return {
        modified: true,
        etag: `"${updated.rows[0].version}"`,
        updatedAt: updated.rows[0].updated_at,
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  return Object.freeze({ readVersioned, writeIfVersion, readOverview, readStatus, available });
}
