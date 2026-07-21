import crypto from 'node:crypto';

const SETTINGS_DOMAIN_CONFIGS = Object.freeze({
  artway_produkty_edytowane: objectConfig(),
  artway_produkty_dodane: arrayConfig(['id', 'externalId', 'sku', 'gtin', 'ean']),
  artway_produkty_katalog: arrayConfig(['id', 'externalId', 'sku', 'gtin', 'ean']),
  artway_produkty_ukryte: arrayConfig(),
  artway_produkty_definitywne: arrayConfig(),
  artway_stany: objectConfig(),
  artway_dostepnosc: objectConfig(),
  artway_ruchy_magazynowe: arrayConfig(['id', 'sourceRequestId']),
  artway_magazyn_produkty: objectConfig(),
  artway_magazyn_lokalizacje: arrayConfig(['id', 'kod']),
  artway_magazyn_lokalizacje_usuniete: arrayConfig(['id', 'kod']),
  artway_dokumenty_magazynowe: arrayConfig(['id', 'numer']),
  artway_dokumenty_magazynowe_usuniete: arrayConfig(['id', 'numer']),
  artway_dokumenty_magazynowe_seq: valueConfig(),
  artway_faktury_szkice: arrayConfig(['id', 'nr', 'numer']),
  artway_producenci: arrayConfig(['id', 'name', 'nazwa']),
  artway_agent_ai_zlecenia: arrayConfig(['id', 'numer']),
  artway_agent_ai_plan_cykl: valueConfig(),
  artway_agent_ai_pamiec: arrayConfig(['id']),
  artway_agent_ai_historia: arrayConfig(['id']),
  artway_agent_ai_linki_producentow: arrayConfig(['id', 'url']),
  artway_agent_ai_allegro_zadania: arrayConfig(['id']),
  artway_seo_historia: arrayConfig(['id', 'at', 'data']),
  artway_opinie: arrayConfig(['id']),
  artway_kosz_dodane: arrayConfig(),
  artway_kosz_meta: objectConfig(),
});

const DIRECT_DOMAIN_CONFIGS = Object.freeze({
  orders: containerConfig({ items: arrayConfig(['nr']) }),
  deleted_orders: containerConfig({ items: arrayConfig(['nr']) }),
  users: containerConfig({ items: arrayConfig(['email']) }),
  allegro_offers: containerConfig({ items: arrayConfig(['id']) }),
  allegro_mappings: containerConfig({ items: objectConfig() }),
  allegro_orders: containerConfig({ items: arrayConfig(['id', 'checkoutFormId']) }),
  allegro_communications: containerConfig({
    threads: arrayConfig(['id', 'threadId']), issues: arrayConfig(['id', 'issueId']), errors: arrayConfig(['id', 'at']),
  }),
  agent_specialists_state: containerConfig({
    history: arrayConfig(['id', 'runId', 'at']), decisions: arrayConfig(['id', 'decisionId']), decisionReceipts: arrayConfig(['id', 'decisionId']),
  }),
  agent_action_runs: containerConfig({ items: arrayConfig(['id', 'runId']) }),
  agent_runtime: containerConfig({
    activity: arrayConfig(['id', 'runId', 'at']), history: arrayConfig(['id', 'runId', 'at']),
  }),
  allegro_operation_receipts: containerConfig({ items: objectConfig() }),
  product_url_cache: containerConfig({ items: objectConfig() }),
  supplier_availability_audit: containerConfig({ items: arrayConfig(['id', 'at']) }),
  allegro_compliance_audit: containerConfig({ items: arrayConfig(['id', 'at']) }),
  allegro_communication_internal_history: containerConfig({ items: arrayConfig(['id', 'at']) }),
  allegro_communication_internal: containerConfig({ items: objectConfig() }),
  allegro_fee_preview_audit: containerConfig({ items: arrayConfig(['id', 'at']) }),
  allegro_offer_defaults_audit: containerConfig({ items: objectConfig() }),
  codex_agent_jobs: containerConfig({ items: arrayConfig(['id', 'jobId']) }),
  allegro_duplicate_resolution_audit: containerConfig({ items: arrayConfig(['id', 'at']) }),
  allegro_offer_withdrawal_audit: containerConfig({ items: arrayConfig(['id', 'at']) }),
  allegro_availability_automation: containerConfig({ items: objectConfig() }),
  allegro_auto_replies: containerConfig({ items: objectConfig() }),
  inpost_webhooks: containerConfig({ items: arrayConfig(['id', 'at']) }),
  allegro_mapping_audit: containerConfig({ items: arrayConfig(['id', 'at']) }),
  allegro_communication_telegram_alerts: containerConfig({ items: objectConfig() }),
  allegro_catalog_maintenance: containerConfig({ errors: arrayConfig(['id', 'at']) }),
  allegro_autonomous_agent_state: containerConfig({ recentActions: arrayConfig(['id', 'at']) }),
  ai_banner_assets: containerConfig({ items: arrayConfig(['id']) }),
  allegro_autonomous_agent_review: containerConfig({ items: arrayConfig(['id', 'at']) }),
  supplier_order_email_audit: containerConfig({ items: objectConfig() }),
  inventory_stock_decisions: containerConfig({ items: arrayConfig(['id', 'decisionId']) }),
  infakt_supplier_access: containerConfig({ items: arrayConfig(['id', 'supplierId']) }),
  infakt_invoice_links: containerConfig({ items: objectConfig() }),
  infakt_purchase_price_sync: containerConfig({
    costDocuments: objectConfig(), documents: objectConfig(), lineMappings: objectConfig(),
    errors: arrayConfig(['id', 'at']), pendingItems: arrayConfig(['id', 'ean', 'sku']), recentMatches: arrayConfig(['id', 'ean', 'sku']),
  }),
  catalog_quality_audit: containerConfig({
    history: arrayConfig(['id', 'at']), orphanArchive: arrayConfig(['id', 'externalId', 'sku', 'ean']),
  }),
  telegram_communication_state: containerConfig({
    events: objectConfig(), history: arrayConfig(['id', 'at']), outbox: arrayConfig(['id', 'at']),
  }),
});

function arrayConfig(idFields = []) { return { kind: 'array', idFields }; }
function objectConfig() { return { kind: 'object', idFields: [] }; }
function valueConfig() { return { kind: 'value', idFields: [] }; }
function containerConfig(collections) { return { kind: 'container', collections }; }

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function contentHash(value) {
  return crypto.createHash('sha256').update(stable(value)).digest('hex');
}

function fallbackRecordId(value, ordinal) {
  const fingerprint = crypto.createHash('sha1').update(stable(value)).digest('hex').slice(0, 20);
  return `auto-${fingerprint}-${ordinal}`;
}

function arrayRecordId(value, config, ordinal, used) {
  let base = '';
  if (value && typeof value === 'object') {
    for (const field of config.idFields || []) {
      if (value[field] !== undefined && value[field] !== null && String(value[field]).trim()) { base = String(value[field]).trim(); break; }
    }
  } else if (value !== undefined && value !== null && String(value).trim()) base = `value-${String(value).trim()}`;
  if (!base) base = fallbackRecordId(value, ordinal);
  let id = base, suffix = 1;
  while (used.has(id)) id = `${base}#${++suffix}`;
  used.add(id); return id;
}

export function splitNormalizedValue(value, config) {
  if (config.kind === 'value') return { metadata: {}, records: [{ collection: 'value', recordId: 'singleton', ordinal: 0, data: clone(value) }] };
  if (config.kind === 'array') {
    const used = new Set();
    return { metadata: {}, records: (Array.isArray(value) ? value : []).map((data, ordinal) => ({ collection: 'value', recordId: arrayRecordId(data, config, ordinal, used), ordinal, data: clone(data) })) };
  }
  if (config.kind === 'object') {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return { metadata: {}, records: Object.entries(source).map(([recordId, data], ordinal) => ({ collection: 'value', recordId, ordinal, data: clone(data) })) };
  }
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const metadata = clone(source);
  const records = [];
  for (const [field, childConfig] of Object.entries(config.collections || {})) {
    delete metadata[field];
    const split = splitNormalizedValue(source[field], childConfig);
    for (const row of split.records) records.push({ ...row, collection: field });
  }
  return { metadata, records };
}

export function hydrateNormalizedValue(metadata, records, config) {
  const byCollection = new Map();
  for (const row of records || []) {
    const list = byCollection.get(row.collection) || [];
    list.push(row); byCollection.set(row.collection, list);
  }
  const hydrateCollection = (childConfig, collection) => {
    const rows = (byCollection.get(collection) || []).slice().sort((a, b) => Number(a.ordinal) - Number(b.ordinal));
    if (childConfig.kind === 'value') return rows[0]?.data;
    if (childConfig.kind === 'array') return rows.map((row) => clone(row.data));
    if (childConfig.kind === 'object') return Object.fromEntries(rows.map((row) => [row.recordId, clone(row.data)]));
    return {};
  };
  if (config.kind !== 'container') return hydrateCollection(config, 'value');
  const result = clone(metadata) || {};
  for (const [field, childConfig] of Object.entries(config.collections || {})) result[field] = hydrateCollection(childConfig, field);
  return result;
}

function domainForDirectKey(key) { return `kv:${key}`; }
function domainForSetting(key) { return `settings:${key}`; }
function numericVersion(etag) {
  const value = String(etag || '').replace(/^W\//, '').replace(/^"|"$/g, '').trim();
  return /^\d+$/.test(value) ? Number(value) : null;
}

async function readDomain(client, namespace, domain, config) {
  const snapshot = await client.query('SELECT metadata,version,updated_at FROM artway_domain_snapshots WHERE namespace=$1 AND domain=$2', [namespace, domain]);
  if (!snapshot.rowCount) return null;
  const rows = await client.query('SELECT collection,record_id,ordinal,data FROM artway_domain_records WHERE namespace=$1 AND domain=$2 ORDER BY collection,ordinal,record_id', [namespace, domain]);
  const records = rows.rows.map((row) => ({ collection: row.collection, recordId: row.record_id, ordinal: Number(row.ordinal), data: row.data }));
  return { value: hydrateNormalizedValue(snapshot.rows[0].metadata, records, config), version: Number(snapshot.rows[0].version), updatedAt: snapshot.rows[0].updated_at };
}

async function readDomains(client, namespace, entries) {
  if (!entries.length) return new Map();
  const domains = entries.map(([domain]) => domain), configs = new Map(entries);
  const [snapshots, rows] = await Promise.all([
    client.query('SELECT domain,metadata,version,updated_at FROM artway_domain_snapshots WHERE namespace=$1 AND domain=ANY($2::text[])', [namespace, domains]),
    client.query('SELECT domain,collection,record_id,ordinal,data FROM artway_domain_records WHERE namespace=$1 AND domain=ANY($2::text[]) ORDER BY domain,collection,ordinal,record_id', [namespace, domains]),
  ]);
  const grouped = new Map();
  for (const row of rows.rows) {
    const records = grouped.get(row.domain) || [];
    records.push({ collection: row.collection, recordId: row.record_id, ordinal: Number(row.ordinal), data: row.data });
    grouped.set(row.domain, records);
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
  if (payload.length) {
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

async function ensureNormalizedSchema(pool, namespace) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE TABLE IF NOT EXISTS artway_kv_store(
      namespace text NOT NULL,key text NOT NULL,value jsonb NOT NULL,version bigint NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(namespace,key))`);
    await client.query(`CREATE TABLE IF NOT EXISTS artway_domain_snapshots(
      namespace text NOT NULL,domain text NOT NULL,metadata jsonb NOT NULL DEFAULT '{}'::jsonb,content_hash text NOT NULL DEFAULT '',version bigint NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(namespace,domain))`);
    await client.query("ALTER TABLE artway_domain_snapshots ADD COLUMN IF NOT EXISTS content_hash text NOT NULL DEFAULT ''");
    await client.query(`CREATE TABLE IF NOT EXISTS artway_domain_records(
      namespace text NOT NULL,domain text NOT NULL,collection text NOT NULL,record_id text NOT NULL,ordinal bigint NOT NULL DEFAULT 0,data jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(namespace,domain,collection,record_id))`);
    await client.query(`DO $$ BEGIN
      ALTER TABLE artway_domain_records ADD CONSTRAINT artway_domain_records_snapshot_fk
        FOREIGN KEY(namespace,domain) REFERENCES artway_domain_snapshots(namespace,domain) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await client.query('CREATE INDEX IF NOT EXISTS artway_domain_records_order_idx ON artway_domain_records(namespace,domain,collection,ordinal)');
    await client.query('CREATE INDEX IF NOT EXISTS artway_domain_records_data_idx ON artway_domain_records USING gin(data jsonb_path_ops)');
    await client.query(`CREATE TABLE IF NOT EXISTS artway_domain_migrations(
      namespace text NOT NULL,migration_id text NOT NULL,details jsonb NOT NULL DEFAULT '{}'::jsonb,completed_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(namespace,migration_id))`);
    await client.query(`CREATE TABLE IF NOT EXISTS artway_domain_legacy_backup(
      namespace text NOT NULL,key text NOT NULL,migration_id text NOT NULL,value jsonb NOT NULL,version bigint NOT NULL,updated_at timestamptz NOT NULL,backed_up_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(namespace,key,migration_id))`);
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
      const result = await replaceDomain(client, namespace, domainForDirectKey(key), value, config, { expectedVersion });
      if (!result.modified) { await client.query('ROLLBACK'); return result; }
      await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  };
  return Object.freeze({
    async readSettingsBase(fallback) { await ensure(); return legacy.read('settings', fallback); },
    async read(key, fallback) { await ensure(); if (key === 'settings') return readSettings(false, fallback); const config = directConfig(key); return config ? readDirect(key, config, fallback, false) : legacy.read(key, fallback); },
    async readVersioned(key, fallback) { await ensure(); if (key === 'settings') return readSettings(true, fallback); const config = directConfig(key); return config ? readDirect(key, config, fallback, true) : legacy.readVersioned(key, fallback); },
    async write(key, value) { await ensure(); if (key === 'settings') return writeSettingsIfVersion(value); const config = directConfig(key); return config ? writeDirect(key, value, config) : legacy.write(key, value); },
    async writeIfVersion(key, value, version) { await ensure(); if (key === 'settings') return writeSettingsIfVersion(value, version); const config = directConfig(key); return config ? writeDirect(key, value, config, version) : legacy.writeIfVersion(key, value, version); },
    async delete(key) { await ensure(); const config = directConfig(key); if (!config) return legacy.delete(key); const client = await pool.connect(); try { await client.query('BEGIN'); const result = await client.query('DELETE FROM artway_domain_snapshots WHERE namespace=$1 AND domain=$2', [namespace, domainForDirectKey(key)]); await client.query('DELETE FROM artway_domain_records WHERE namespace=$1 AND domain=$2', [namespace, domainForDirectKey(key)]); await client.query('COMMIT'); return { deleted: result.rowCount === 1 }; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } },
    async listKeys() { await ensure(); const [legacyKeys, domains] = await Promise.all([legacy.listKeys(), pool.query("SELECT domain,version FROM artway_domain_snapshots WHERE namespace=$1 AND domain LIKE 'kv:%'", [namespace])]); const mapped = domains.rows.map((row) => ({ key: row.domain.slice(3), etag: `"${row.version}"` })); return [...legacyKeys.filter((entry) => !directConfig(entry.key)), ...mapped].sort((a, b) => a.key.localeCompare(b.key)); },
    async storageStatus() {
      await ensure();
      const result = await pool.query(`SELECT
        EXISTS(SELECT 1 FROM artway_domain_migrations WHERE namespace=$1 AND migration_id='domain-records-v1') AS migrated,
        (SELECT count(*)::int FROM artway_domain_snapshots WHERE namespace=$1) AS domains,
        (SELECT count(*)::int FROM artway_domain_records WHERE namespace=$1) AS records,
        (SELECT count(*)::int FROM artway_domain_legacy_backup WHERE namespace=$1 AND migration_id='domain-records-v1') AS rollback_backups,
        (SELECT count(*)::int FROM artway_kv_store WHERE namespace=$1 AND key=ANY($2::text[])) AS active_legacy_domains,
        COALESCE((SELECT pg_column_size(value)::int FROM artway_kv_store WHERE namespace=$1 AND key='settings'),0) AS settings_bytes`, [namespace, Object.keys(DIRECT_DOMAIN_CONFIGS)]);
      const row = result.rows[0] || {};
      return {
        engine: 'postgres-normalized-v1', migrated: row.migrated === true,
        domains: Number(row.domains) || 0, records: Number(row.records) || 0,
        rollbackBackups: Number(row.rollback_backups) || 0,
        activeLegacyDomains: Number(row.active_legacy_domains) || 0,
        settingsBytes: Number(row.settings_bytes) || 0,
      };
    },
  });
}

export { SETTINGS_DOMAIN_CONFIGS, DIRECT_DOMAIN_CONFIGS };
