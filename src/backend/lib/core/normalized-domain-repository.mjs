import {
  dedicatedDomainStorageStatus,
  dedicatedTableForDomain,
  deleteDedicatedDomainRecords,
  migrateDedicatedDomainRecords,
  readDedicatedDomainRecords,
  replaceDedicatedDomainRecords,
} from './dedicated-domain-storage.mjs';
import { assertPostgresRelations } from './postgres-schema-contract.mjs';
import {
  DIRECT_DOMAIN_CONFIGS,
  SETTINGS_DOMAIN_CONFIGS,
  cloneNormalizedValue as clone,
  hydrateNormalizedValue,
  normalizedContentHash as contentHash,
  splitNormalizedValue,
} from './normalized-domain-shape.mjs';

export { DIRECT_DOMAIN_CONFIGS, SETTINGS_DOMAIN_CONFIGS, hydrateNormalizedValue, splitNormalizedValue } from './normalized-domain-shape.mjs';

const SETTINGS_DOMAIN_KEYS = new Set(Object.keys(SETTINGS_DOMAIN_CONFIGS));

function domainForDirectKey(key) { return `kv:${key}`; }
function domainForSetting(key) { return `settings:${key}`; }
function settingsDomainFromKey(key = '') {
  const value = String(key || '');
  if (value.startsWith('settings:')) return value.slice('settings:'.length);
  return SETTINGS_DOMAIN_KEYS.has(value) ? value : '';
}

function settingsDomainConfig(key) {
  const normalized = settingsDomainFromKey(key);
  return normalized ? SETTINGS_DOMAIN_CONFIGS[normalized] : undefined;
}

function readSettingsDomain(client, namespace, key, fallback, versioned = false, legacy = null) {
  const normalized = settingsDomainFromKey(key);
  const config = normalized ? SETTINGS_DOMAIN_CONFIGS[normalized] : null;
  if (!config) {
    if (!legacy) throw new Error(`Brak repozytorium zgodności dla domeny ustawień: ${key}`);
    return versioned ? legacy.readVersioned(key, fallback) : legacy.read(key, fallback);
  }
  return (async () => {
    const domain = await readDomain(client, namespace, domainForSetting(normalized), config);
    if (!domain) return versioned ? { value: fallback, etag: '0', exists: false } : fallback;
    const record = { value: domain.value, exists: true, etag: `"${domain.version}"` };
    return versioned ? record : record.value;
  })();
}

async function writeSettingsDomain(client, namespace, key, value, config, version = null) {
  const expectedVersion = version?.exists === false ? null : (version ? Number(String(version.etag || '').replace(/^W\//, '').replace(/^"|"$/g, '')) : null);
  if (version && version.exists !== false && !Number.isSafeInteger(expectedVersion)) return { modified: false };
  const existing = await client.query('SELECT version FROM artway_domain_snapshots WHERE namespace=$1 AND domain=$2', [namespace, domainForSetting(key)]);
  if (version?.exists === false && existing.rowCount) return { modified: false };
  return replaceDomain(client, namespace, domainForSetting(key), value, config, {
    expectedVersion: Number.isSafeInteger(expectedVersion) ? expectedVersion : null,
    skipIfEqual: true,
  });
}
export function normalizedRevisionToken(domains = [], rows = []) {
  const versions = new Map((rows || []).map((row) => [String(row.domain || ''), Math.max(0, Number(row.version) || 0)]));
  return ['ndv1', ...[...new Set((domains || []).map(String).filter(Boolean))].sort().map((domain) => `${domain}=${versions.get(domain) || 0}`)].join('|');
}
function numericVersion(etag) {
  const value = String(etag || '').replace(/^W\//, '').replace(/^"|"$/g, '').trim();
  return /^\d+$/.test(value) ? Number(value) : null;
}

async function readDomain(client, namespace, domain, config) {
  const snapshot = await client.query('SELECT metadata,version,updated_at FROM artway_domain_snapshots WHERE namespace=$1 AND domain=$2', [namespace, domain]);
  if (!snapshot.rowCount) return null;
  const dedicated = await readDedicatedDomainRecords(client, namespace, domain);
  const rows = dedicated === null
    ? await client.query('SELECT collection,record_id,ordinal,data FROM artway_domain_records WHERE namespace=$1 AND domain=$2 ORDER BY collection,ordinal,record_id', [namespace, domain])
    : null;
  const records = dedicated === null
    ? rows.rows.map((row) => ({ collection: row.collection, recordId: row.record_id, ordinal: Number(row.ordinal), data: row.data }))
    : dedicated;
  return { value: hydrateNormalizedValue(snapshot.rows[0].metadata, records, config), version: Number(snapshot.rows[0].version), updatedAt: snapshot.rows[0].updated_at };
}

async function readDomains(client, namespace, entries) {
  if (!entries.length) return new Map();
  const domains = entries.map(([domain]) => domain), configs = new Map(entries);
  const genericDomains = domains.filter((domain) => !dedicatedTableForDomain(domain));
  const snapshots = await client.query('SELECT domain,metadata,version,updated_at FROM artway_domain_snapshots WHERE namespace=$1 AND domain=ANY($2::text[])', [namespace, domains]);
  const rows = genericDomains.length
    ? await client.query('SELECT domain,collection,record_id,ordinal,data FROM artway_domain_records WHERE namespace=$1 AND domain=ANY($2::text[]) ORDER BY domain,collection,ordinal,record_id', [namespace, genericDomains])
    : { rows: [] };
  const grouped = new Map();
  for (const row of rows.rows) {
    const records = grouped.get(row.domain) || [];
    records.push({ collection: row.collection, recordId: row.record_id, ordinal: Number(row.ordinal), data: row.data });
    grouped.set(row.domain, records);
  }
  for (const domain of domains.filter((item) => dedicatedTableForDomain(item))) {
    grouped.set(domain, await readDedicatedDomainRecords(client, namespace, domain) || []);
  }
  const result = new Map();
  for (const snapshot of snapshots.rows) {
    const config = configs.get(snapshot.domain);
    if (!config) continue;
    result.set(snapshot.domain, {
      value: hydrateNormalizedValue(snapshot.metadata, grouped.get(snapshot.domain) || [], config),
      version: Number(snapshot.version), updatedAt: snapshot.updated_at,
    });
  }
  return result;
}

async function replaceDomain(client, namespace, domain, value, config, { expectedVersion = null, initialVersion = null, updatedAt = null, skipIfEqual = false } = {}) {
  const split = splitNormalizedValue(value, config), hash = contentHash(value);
  const current = await client.query('SELECT version,content_hash FROM artway_domain_snapshots WHERE namespace=$1 AND domain=$2 FOR UPDATE', [namespace, domain]);
  const currentVersion = current.rowCount ? Number(current.rows[0].version) : null;
  if (expectedVersion !== null && currentVersion !== expectedVersion) return { modified: false };
  if (skipIfEqual && current.rowCount && current.rows[0].content_hash === hash) return { modified: false, unchanged: true, version: currentVersion };
  const nextVersion = currentVersion === null ? Math.max(1, Number(initialVersion) || 1) : currentVersion + 1;
  const timestamp = updatedAt || new Date().toISOString();
  await client.query(`INSERT INTO artway_domain_snapshots(namespace,domain,metadata,content_hash,version,updated_at) VALUES($1,$2,$3::jsonb,$4,$5,$6)
    ON CONFLICT(namespace,domain) DO UPDATE SET metadata=EXCLUDED.metadata,content_hash=EXCLUDED.content_hash,version=EXCLUDED.version,updated_at=EXCLUDED.updated_at`, [namespace, domain, JSON.stringify(split.metadata || {}), hash, nextVersion, timestamp]);
  const payload = split.records.map((row) => ({ collection: row.collection, record_id: row.recordId, ordinal: row.ordinal, data: row.data }));
  if (dedicatedTableForDomain(domain)) {
    await replaceDedicatedDomainRecords(client, namespace, domain, split.records, timestamp);
  } else if (payload.length) {
    await client.query(`WITH incoming AS (
      SELECT collection,record_id,ordinal,data FROM jsonb_to_recordset($3::jsonb) AS x(collection text,record_id text,ordinal bigint,data jsonb)
    ) INSERT INTO artway_domain_records(namespace,domain,collection,record_id,ordinal,data,updated_at)
      SELECT $1,$2,collection,record_id,ordinal,data,$4 FROM incoming
      ON CONFLICT(namespace,domain,collection,record_id) DO UPDATE SET ordinal=EXCLUDED.ordinal,data=EXCLUDED.data,updated_at=EXCLUDED.updated_at
      WHERE artway_domain_records.ordinal IS DISTINCT FROM EXCLUDED.ordinal OR artway_domain_records.data IS DISTINCT FROM EXCLUDED.data`, [namespace, domain, JSON.stringify(payload), timestamp]);
    await client.query(`DELETE FROM artway_domain_records r WHERE namespace=$1 AND domain=$2 AND NOT EXISTS (
      SELECT 1 FROM jsonb_to_recordset($3::jsonb) AS x(collection text,record_id text,ordinal bigint,data jsonb)
      WHERE x.collection=r.collection AND x.record_id=r.record_id)`, [namespace, domain, JSON.stringify(payload)]);
  } else await client.query('DELETE FROM artway_domain_records WHERE namespace=$1 AND domain=$2', [namespace, domain]);
  return { modified: true, version: nextVersion };
}

async function bumpSettingsRevision(client, namespace) {
  const now = new Date().toISOString();
  const current = await client.query('SELECT value FROM artway_kv_store WHERE namespace=$1 AND key=$2 FOR UPDATE', [namespace, 'settings']);
  if (!current.rowCount) {
    const initial = { data: {}, rev: 1, updated_at: now };
    await client.query(
      `INSERT INTO artway_kv_store(namespace,key,value,version,updated_at) VALUES($1,'settings',$2::jsonb,1,$3)`,
      [namespace, JSON.stringify(initial), now],
    );
    return 1;
  }
  const value = current.rows[0].value && typeof current.rows[0].value === 'object' ? current.rows[0].value : {};
  const currentRev = Number(value?.rev);
  const rev = Number.isSafeInteger(currentRev) ? currentRev + 1 : 1;
  const nextValue = { ...value, rev, updated_at: now };
  await client.query(
    'UPDATE artway_kv_store SET value=$3::jsonb, version=version+1, updated_at=$4 WHERE namespace=$1 AND key=$2',
    [namespace, 'settings', JSON.stringify(nextValue), now],
  );
  return rev;
}

async function migrateLateDirectDomains(client, namespace) {
  const keys = Object.keys(DIRECT_DOMAIN_CONFIGS);
  if (!keys.length) return 0;
  const legacyRows = await client.query(
    'SELECT key,value,version,updated_at FROM artway_kv_store WHERE namespace=$1 AND key=ANY($2::text[]) ORDER BY key FOR UPDATE',
    [namespace, keys],
  );
  let migrated = 0;
  for (const row of legacyRows.rows) {
    const config = DIRECT_DOMAIN_CONFIGS[row.key];
    if (!config) continue;
    const domain = domainForDirectKey(row.key), migrationId = 'domain-records-incremental-v1';
    await client.query(
      `INSERT INTO artway_domain_legacy_backup(namespace,key,migration_id,value,version,updated_at)
       VALUES($1,$2,$3,$4::jsonb,$5,$6) ON CONFLICT DO NOTHING`,
      [namespace, row.key, migrationId, JSON.stringify(row.value), Number(row.version), row.updated_at],
    );
    const existing = await client.query(
      'SELECT 1 FROM artway_domain_snapshots WHERE namespace=$1 AND domain=$2',
      [namespace, domain],
    );
    if (!existing.rowCount) {
      const result = await replaceDomain(client, namespace, domain, row.value, config, {
        initialVersion: Number(row.version),
        updatedAt: row.updated_at,
      });
      if (!result.modified) throw new Error(`Nie udało się przyrostowo przenieść domeny ${row.key}`);
    }
    await client.query('DELETE FROM artway_kv_store WHERE namespace=$1 AND key=$2', [namespace, row.key]);
    migrated += 1;
  }
  return migrated;
}

async function ensureNormalizedSchema(pool, namespace) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await assertPostgresRelations(client, [
      'artway_kv_store',
      'artway_domain_snapshots',
      'artway_domain_records',
      'artway_domain_migrations',
      'artway_domain_legacy_backup',
      'artway_store_orders',
      'artway_allegro_orders',
      'artway_allegro_offers',
      'artway_allegro_mappings',
      'artway_allegro_communications',
      'artway_agent_records',
      'artway_diagnostic_issues',
      'artway_warehouse_records',
      'artway_domain_records_archive_v2',
    ], 'domen operacyjnych');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`artway-normalize:${namespace}`]);
    const migrationId = 'domain-records-v1';
    const done = await client.query('SELECT 1 FROM artway_domain_migrations WHERE namespace=$1 AND migration_id=$2', [namespace, migrationId]);
    if (!done.rowCount) {
      let migratedDomains = 0, migratedRecords = 0;
      const settingsRow = await client.query("SELECT value,version,updated_at FROM artway_kv_store WHERE namespace=$1 AND key='settings' FOR UPDATE", [namespace]);
      if (settingsRow.rowCount) {
        const row = settingsRow.rows[0], original = clone(row.value), next = clone(row.value), data = next.data && typeof next.data === 'object' ? next.data : {};
        await client.query(`INSERT INTO artway_domain_legacy_backup(namespace,key,migration_id,value,version,updated_at) VALUES($1,'settings',$2,$3::jsonb,$4,$5) ON CONFLICT DO NOTHING`, [namespace, migrationId, JSON.stringify(original), Number(row.version), row.updated_at]);
        for (const [key, config] of Object.entries(SETTINGS_DOMAIN_CONFIGS)) {
          if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
          const result = await replaceDomain(client, namespace, domainForSetting(key), data[key], config, { initialVersion: Number(row.version), updatedAt: row.updated_at });
          migratedDomains++; migratedRecords += splitNormalizedValue(data[key], config).records.length; delete data[key];
          if (!result.modified) throw new Error(`Nie udało się przenieść domeny ${key}`);
        }
        next.data = data; next.rev = Math.max(0, Number(next.rev) || 0) + 1; next.updated_at = new Date().toISOString();
        await client.query('UPDATE artway_kv_store SET value=$3::jsonb,version=version+1,updated_at=now() WHERE namespace=$1 AND key=$2', [namespace, 'settings', JSON.stringify(next)]);
      }
      for (const [key, config] of Object.entries(DIRECT_DOMAIN_CONFIGS)) {
        const record = await client.query('SELECT value,version,updated_at FROM artway_kv_store WHERE namespace=$1 AND key=$2 FOR UPDATE', [namespace, key]);
        if (!record.rowCount) continue;
        const row = record.rows[0];
        await client.query(`INSERT INTO artway_domain_legacy_backup(namespace,key,migration_id,value,version,updated_at) VALUES($1,$2,$3,$4::jsonb,$5,$6) ON CONFLICT DO NOTHING`, [namespace, key, migrationId, JSON.stringify(row.value), Number(row.version), row.updated_at]);
        await replaceDomain(client, namespace, domainForDirectKey(key), row.value, config, { initialVersion: Number(row.version), updatedAt: row.updated_at });
        migratedDomains++; migratedRecords += splitNormalizedValue(row.value, config).records.length;
        await client.query('DELETE FROM artway_kv_store WHERE namespace=$1 AND key=$2', [namespace, key]);
      }
      await client.query('INSERT INTO artway_domain_migrations(namespace,migration_id,details) VALUES($1,$2,$3::jsonb)', [namespace, migrationId, JSON.stringify({ migratedDomains, migratedRecords })]);
    }
    await migrateLateDirectDomains(client, namespace);
    await migrateDedicatedDomainRecords(client, namespace);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export function createNormalizedDomainRepository({ pool, namespace, legacy }) {
  let initialization = null;
  const ensure = () => initialization || (initialization = ensureNormalizedSchema(pool, namespace));
  const directConfig = (key) => DIRECT_DOMAIN_CONFIGS[key];
  const readSettings = async (versioned = false, fallback) => {
    const base = versioned ? await legacy.readVersioned('settings', fallback) : { value: await legacy.read('settings', fallback), etag: '', exists: true };
    const value = clone(base.value || fallback), data = value?.data && typeof value.data === 'object' ? value.data : {};
    const client = await pool.connect();
    try {
      const domains = await readDomains(client, namespace, Object.entries(SETTINGS_DOMAIN_CONFIGS).map(([key, config]) => [domainForSetting(key), config]));
      for (const [key, config] of Object.entries(SETTINGS_DOMAIN_CONFIGS)) {
        const domain = domains.get(domainForSetting(key));
        if (domain) data[key] = domain.value;
      }
    } finally { client.release(); }
    value.data = data; return versioned ? { ...base, value } : value;
  };
  const readSettingsDomainValue = async (key, fallback, versioned = false) => {
    const config = settingsDomainConfig(key);
    if (!config) return versioned ? legacy.readVersioned(key, fallback) : legacy.read(key, fallback);
    const client = await pool.connect();
    try { return await readSettingsDomain(client, namespace, key, fallback, versioned, legacy); }
    finally { client.release(); }
  };
  const writeSettingsDomainValue = async (key, value, version = null) => {
    const config = settingsDomainConfig(key);
    if (!config) return legacy.writeIfVersion(key, value, version);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await writeSettingsDomain(client, namespace, settingsDomainFromKey(key), value, config, version);
      if (result?.unchanged) {
        await client.query('ROLLBACK');
        return { ...result, modified: true };
      }
      if (!result?.modified) { await client.query('ROLLBACK'); return result; }
      const settingsRev = await bumpSettingsRevision(client, namespace);
      await client.query('COMMIT');
      return { ...result, settingsRev };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };
  const readSettingsDelta = async (fallback, { versions = {}, base = null, excludeKeys = [] } = {}) => {
    const baseValue = clone(base || await legacy.read('settings', fallback) || fallback), data = baseValue?.data && typeof baseValue.data === 'object' ? baseValue.data : {};
    const excluded = new Set((Array.isArray(excludeKeys) ? excludeKeys : []).map(String));
    const client = await pool.connect();
    try {
      const snapshots = await client.query("SELECT domain,version FROM artway_domain_snapshots WHERE namespace=$1 AND domain LIKE 'settings:%'", [namespace]);
      const domainVersions = {}, changedEntries = [];
      for (const row of snapshots.rows) {
        const key = String(row.domain || '').slice('settings:'.length), config = SETTINGS_DOMAIN_CONFIGS[key];
        if (!config || excluded.has(key)) continue;
        const version = Math.max(0, Number(row.version) || 0); domainVersions[key] = version;
        if (!Object.prototype.hasOwnProperty.call(versions || {}, key) || Math.max(0, Number(versions[key]) || 0) !== version) changedEntries.push([row.domain, config]);
      }
      const domains = await readDomains(client, namespace, changedEntries);
      const changedKeys = [];
      for (const [domain, config] of changedEntries) {
        const current = domains.get(domain); if (!current) continue;
        const key = domain.slice('settings:'.length); data[key] = current.value; changedKeys.push(key);
      }
      baseValue.data = data;
      return { value: baseValue, domainVersions, changedKeys };
    } finally { client.release(); }
  };
  const writeSettingsIfVersion = async (value, version = null) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query("SELECT version FROM artway_kv_store WHERE namespace=$1 AND key='settings' FOR UPDATE", [namespace]);
      const currentVersion = current.rowCount ? Number(current.rows[0].version) : null, expected = version ? numericVersion(version.etag) : currentVersion;
      if ((version?.exists === false && current.rowCount) || (version?.exists !== false && expected !== currentVersion)) { await client.query('ROLLBACK'); return { modified: false }; }
      const stored = clone(value), data = stored?.data && typeof stored.data === 'object' ? stored.data : {};
      const settingsDomains = Object.keys(SETTINGS_DOMAIN_CONFIGS).filter((key) => Object.prototype.hasOwnProperty.call(data, key)).map((key) => domainForSetting(key));
      const currentDomains = settingsDomains.length
        ? await client.query('SELECT domain,content_hash FROM artway_domain_snapshots WHERE namespace=$1 AND domain=ANY($2::text[]) ORDER BY domain FOR UPDATE', [namespace, settingsDomains])
        : { rows: [] };
      const hashes = new Map(currentDomains.rows.map((row) => [row.domain, row.content_hash]));
      for (const [key, config] of Object.entries(SETTINGS_DOMAIN_CONFIGS)) {
        if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
        const domain = domainForSetting(key);
        if (hashes.get(domain) !== contentHash(data[key])) await replaceDomain(client, namespace, domain, data[key], config);
        delete data[key];
      }
      stored.data = data;
      if (current.rowCount) await client.query("UPDATE artway_kv_store SET value=$2::jsonb,version=version+1,updated_at=now() WHERE namespace=$1 AND key='settings'", [namespace, JSON.stringify(stored)]);
      else await client.query("INSERT INTO artway_kv_store(namespace,key,value,version,updated_at) VALUES($1,'settings',$2::jsonb,1,now())", [namespace, JSON.stringify(stored)]);
      await client.query('COMMIT'); return { modified: true };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  };
  const readDirect = async (key, config, fallback, versioned = false) => {
    const client = await pool.connect();
    try {
      const domain = await readDomain(client, namespace, domainForDirectKey(key), config);
      if (!domain) return versioned ? legacy.readVersioned(key, fallback) : legacy.read(key, fallback);
      return versioned ? { value: domain.value, etag: `"${domain.version}"`, exists: true } : domain.value;
    } finally { client.release(); }
  };
  const writeDirect = async (key, value, config, version = null) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const expectedVersion = version?.exists === false ? null : (version ? numericVersion(version.etag) : null);
      if (version && version.exists !== false && expectedVersion === null) { await client.query('ROLLBACK'); return { modified: false }; }
      const exists = await client.query('SELECT version FROM artway_domain_snapshots WHERE namespace=$1 AND domain=$2', [namespace, domainForDirectKey(key)]);
      if (version?.exists === false && exists.rowCount) { await client.query('ROLLBACK'); return { modified: false }; }
      const result = await replaceDomain(client, namespace, domainForDirectKey(key), value, config, {
        expectedVersion,
        skipIfEqual: true,
      });
      if (result?.unchanged) {
        await client.query('ROLLBACK');
        return { ...result, modified: true };
      }
      if (!result.modified) { await client.query('ROLLBACK'); return result; }
      await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  };
  const readDiagnosticsProjection = async ({ status = 'all', level = 'all', limit = 200 } = {}) => {
    await ensure();
    const normalizedStatus = ['all', 'open', 'resolved', 'ignored', 'investigating'].includes(String(status)) ? String(status) : 'all';
    const normalizedLevel = ['all', 'blad', 'ostrzezenie'].includes(String(level)) ? String(level) : 'all';
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 200));
    const domain = domainForDirectKey('system_diagnostics');
    const result = await pool.query(`WITH snapshot AS (
      SELECT metadata,version,updated_at FROM artway_domain_snapshots
      WHERE namespace=$1 AND domain=$2
    ), totals AS (
      SELECT count(*)::int total,
        count(*) FILTER (WHERE status IN ('open','investigating'))::int open,
        count(*) FILTER (WHERE status IN ('open','investigating') AND level='blad')::int errors,
        count(*) FILTER (WHERE status IN ('open','investigating') AND level='ostrzezenie')::int warnings,
        COALESCE(sum(CASE WHEN status IN ('open','investigating') THEN GREATEST(1,COALESCE((data->>'count')::int,1)) ELSE 0 END),0)::int occurrences
      FROM artway_diagnostic_issues WHERE namespace=$1 AND domain=$2 AND collection='items'
    ), selected AS (
      SELECT data FROM artway_diagnostic_issues
      WHERE namespace=$1 AND domain=$2 AND collection='items'
        AND ($3='all' OR ($3='open' AND status IN ('open','investigating')) OR status=$3)
        AND ($4='all' OR level=$4)
      ORDER BY last_seen_at DESC,record_id
      LIMIT $5
    ) SELECT snapshot.metadata,snapshot.version,snapshot.updated_at,
      totals.total,totals.open,totals.errors,totals.warnings,totals.occurrences,
      COALESCE((SELECT jsonb_agg(data) FROM selected),'[]'::jsonb) items
    FROM snapshot CROSS JOIN totals`, [namespace, domain, normalizedStatus, normalizedLevel, safeLimit]);
    if (!result.rowCount) return { exists: false, version: '', updatedAt: '', metadata: {}, items: [], summary: { total: 0, open: 0, errors: 0, warnings: 0, occurrences: 0 } };
    const row = result.rows[0];
    return {
      exists: true,
      version: `"${Number(row.version) || 0}"`,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at || ''),
      metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
      items: Array.isArray(row.items) ? row.items : [],
      summary: {
        total: Number(row.total) || 0,
        open: Number(row.open) || 0,
        errors: Number(row.errors) || 0,
        warnings: Number(row.warnings) || 0,
        occurrences: Number(row.occurrences) || 0,
      },
    };
  };
  return Object.freeze({
    async readSettingsBase(fallback) { await ensure(); return legacy.read('settings', fallback); },
    async readSettingsDomain(key, fallback) { await ensure(); return readSettingsDomainValue(key, fallback, false); },
    async readSettingsDelta(fallback, options = {}) { await ensure(); return readSettingsDelta(fallback, options); },
    async readDiagnosticsProjection(options = {}) { return readDiagnosticsProjection(options); },
    async read(key, fallback) {
      await ensure();
      if (key === 'settings') return readSettings(false, fallback);
      const direct = directConfig(key);
      if (direct) return readDirect(key, direct, fallback, false);
      if (settingsDomainConfig(key)) return readSettingsDomainValue(key, fallback, false);
      return legacy.read(key, fallback);
    },
    async readVersioned(key, fallback) {
      await ensure();
      if (key === 'settings') return readSettings(true, fallback);
      const direct = directConfig(key);
      if (direct) return readDirect(key, direct, fallback, true);
      if (settingsDomainConfig(key)) return readSettingsDomainValue(key, fallback, true);
      return legacy.readVersioned(key, fallback);
    },
    async write(key, value) { await ensure(); if (key === 'settings') return writeSettingsIfVersion(value); const config = directConfig(key); return config ? writeDirect(key, value, config) : legacy.write(key, value); },
    async writeIfVersion(key, value, version) {
      await ensure();
      if (key === 'settings') return writeSettingsIfVersion(value, version);
      const config = directConfig(key);
      if (config) return writeDirect(key, value, config, version);
      if (settingsDomainConfig(key)) return writeSettingsDomainValue(key, value, version);
      return legacy.writeIfVersion(key, value, version);
    },
    async delete(key) {
      await ensure(); const config = directConfig(key); if (!config) return legacy.delete(key);
      const client = await pool.connect(), domain = domainForDirectKey(key);
      try {
        await client.query('BEGIN');
        await deleteDedicatedDomainRecords(client, namespace, domain);
        const result = await client.query('DELETE FROM artway_domain_snapshots WHERE namespace=$1 AND domain=$2', [namespace, domain]);
        await client.query('DELETE FROM artway_domain_records WHERE namespace=$1 AND domain=$2', [namespace, domain]);
        await client.query('COMMIT'); return { deleted: result.rowCount === 1 };
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    async listKeys() { await ensure(); const [legacyKeys, domains] = await Promise.all([legacy.listKeys(), pool.query("SELECT domain,version FROM artway_domain_snapshots WHERE namespace=$1 AND domain LIKE 'kv:%'", [namespace])]); const mapped = domains.rows.map((row) => ({ key: row.domain.slice(3), etag: `"${row.version}"` })); return [...legacyKeys.filter((entry) => !directConfig(entry.key)), ...mapped].sort((a, b) => a.key.localeCompare(b.key)); },
    async revisionToken({ settingsKeys = [], keys = [] } = {}) {
      await ensure();
      const domains = [
        ...settingsKeys.filter((key) => SETTINGS_DOMAIN_CONFIGS[key]).map(domainForSetting),
        ...keys.filter((key) => DIRECT_DOMAIN_CONFIGS[key]).map(domainForDirectKey),
      ];
      const unique = [...new Set(domains)];
      if (!unique.length) return normalizedRevisionToken([]);
      const result = await pool.query('SELECT domain,version FROM artway_domain_snapshots WHERE namespace=$1 AND domain=ANY($2::text[])', [namespace, unique]);
      return normalizedRevisionToken(unique, result.rows);
    },
    async storageStatus() {
      await ensure();
      const client = await pool.connect();
      try {
        const result = await client.query(`SELECT
        EXISTS(SELECT 1 FROM artway_domain_migrations WHERE namespace=$1 AND migration_id='domain-records-v1') AS migrated,
        (SELECT count(*)::int FROM artway_domain_snapshots WHERE namespace=$1) AS domains,
        (SELECT count(*)::int FROM artway_domain_records WHERE namespace=$1) AS records,
        (SELECT count(*)::int FROM artway_domain_legacy_backup WHERE namespace=$1 AND migration_id='domain-records-v1') AS rollback_backups,
        (SELECT count(*)::int FROM artway_kv_store WHERE namespace=$1 AND key=ANY($2::text[])) AS active_legacy_domains,
        COALESCE((SELECT pg_column_size(value)::int FROM artway_kv_store WHERE namespace=$1 AND key='settings'),0) AS settings_bytes`, [namespace, Object.keys(DIRECT_DOMAIN_CONFIGS)]);
        const row = result.rows[0] || {}, dedicated = await dedicatedDomainStorageStatus(client, namespace);
        return {
          engine: 'postgres-domain-tables-v3', migrated: row.migrated === true && dedicated.migrated,
          domains: Number(row.domains) || 0,
          records: (Number(row.records) || 0) + dedicated.records,
          genericRecords: Number(row.records) || 0,
          dedicatedRecords: dedicated.records,
          dedicatedTables: dedicated.tables,
          activeGenericDedicatedRecords: dedicated.activeGenericRecords,
          rollbackBackups: Number(row.rollback_backups) || 0,
          activeLegacyDomains: Number(row.active_legacy_domains) || 0,
          settingsBytes: Number(row.settings_bytes) || 0,
        };
      } finally { client.release(); }
    },
  });
}
