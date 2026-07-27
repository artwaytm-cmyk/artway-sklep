#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { mergeCatalogProducts } from '../src/backend/lib/domain/catalog-quality.mjs';

const gzipAsync = promisify(gzip);
const NAMESPACE = 'artway-sklep';
const MIGRATION_ID = 'canonical-product-storage-v1';
const APPLY = process.argv.includes('--apply');
const PRODUCT_DOMAINS = Object.freeze({
  'settings:artway_produkty_dodane': { key: 'artway_produkty_dodane', kind: 'array' },
  'settings:artway_produkty_edytowane': { key: 'artway_produkty_edytowane', kind: 'object' },
  'settings:artway_produkty_katalog': { key: 'artway_produkty_katalog', kind: 'array' },
  'settings:artway_produkty_ukryte': { key: 'artway_produkty_ukryte', kind: 'array' },
  'settings:artway_produkty_definitywne': { key: 'artway_produkty_definitywne', kind: 'array' },
  'settings:artway_kosz_dodane': { key: 'artway_kosz_dodane', kind: 'array' },
  'settings:artway_kosz_meta': { key: 'artway_kosz_meta', kind: 'object' },
});
const LEGACY_KV_PATTERN = /^imported-product-catalog:(?:manifest|shard):v1(?::|$)/;

function poolOptions() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
  return { host: '/var/run/postgresql', database: 'artway', user: 'artway' };
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hydrate(rows, config) {
  const sorted = rows.slice().sort((left, right) => Number(left.ordinal) - Number(right.ordinal));
  if (config.kind === 'object') return Object.fromEntries(sorted.map((row) => [row.record_id, row.data]));
  return sorted.map((row) => row.data);
}

function productDifferences(legacyProduct, canonicalProduct) {
  return Object.keys(legacyProduct || {})
    .filter((field) => !['_catalog', 'stan', 'dostepny'].includes(field))
    .filter((field) => stable(legacyProduct[field]) !== stable(canonicalProduct?.[field]));
}

async function buildAudit(client) {
  const domains = Object.keys(PRODUCT_DOMAINS);
  // Jedno połączenie PostgreSQL wykonuje zapytania sekwencyjnie. Równoległe
  // client.query() na tym samym kliencie jest wycofywane w pg 9 i utrudnia
  // jednoznaczny audyt migracji.
  const domainRows = await client.query(`
      SELECT domain,collection,record_id,ordinal,data,updated_at
      FROM artway_domain_records
      WHERE namespace=$1 AND domain=ANY($2::text[])
      ORDER BY domain,collection,ordinal,record_id
    `, [NAMESPACE, domains]);
  const snapshots = await client.query(`
      SELECT domain,metadata,version,updated_at
      FROM artway_domain_snapshots
      WHERE namespace=$1 AND domain=ANY($2::text[])
    `, [NAMESPACE, domains]);
  const kvRows = await client.query(`
      SELECT key,value,version,updated_at
      FROM artway_kv_store
      WHERE namespace=$1
        AND (key LIKE 'imported-product-catalog:manifest:v1'
          OR key LIKE 'imported-product-catalog:shard:v1:%'
          OR key='allegro_preparation_queue')
      ORDER BY key
    `, [NAMESPACE]);
  const centralRows = await client.query(`
      SELECT product_id,data,source,record_status,fingerprint,authoritative_fields
      FROM artway_products
      WHERE namespace=$1 AND record_status<>'removed'
      ORDER BY product_id
    `, [NAMESPACE]);
  const queueState = await client.query(`
      SELECT to_regclass('public.artway_allegro_preparation_state') relation
    `);
  const queueTasks = await client.query(`
      SELECT to_regclass('public.artway_allegro_preparation_tasks') relation
    `);
  const byDomain = new Map();
  for (const row of domainRows.rows) {
    const list = byDomain.get(row.domain) || [];
    list.push(row);
    byDomain.set(row.domain, list);
  }
  const settings = {};
  for (const [domain, config] of Object.entries(PRODUCT_DOMAINS)) {
    settings[config.key] = hydrate(byDomain.get(domain) || [], config);
  }
  const imported = kvRows.rows
    .filter((row) => String(row.key).startsWith('imported-product-catalog:shard:v1:'))
    .flatMap((row) => Array.isArray(row.value?.items) ? row.value.items : []);
  const legacy = mergeCatalogProducts(settings, imported).products;
  const canonical = new Map(centralRows.rows.map((row) => [String(row.product_id), row.data]));
  const missing = [];
  const differing = [];
  for (const product of legacy) {
    const id = String(product?.id ?? '');
    if (!canonical.has(id)) {
      missing.push(id);
      continue;
    }
    const fields = productDifferences(product, canonical.get(id));
    if (fields.length) differing.push({ id, fields });
  }
  const legacyIds = new Set(legacy.map((product) => String(product?.id ?? '')));
  const extra = [...canonical.keys()].filter((id) => !legacyIds.has(id));
  let relationalQueue = { available: false, migrated: false, tasks: 0 };
  if (queueState.rows[0]?.relation && queueTasks.rows[0]?.relation) {
    // Jeden klient pg wykonuje zapytania sekwencyjnie. Jawna kolejność eliminuje
    // pozorną równoległość i ułatwia wiarygodny audyt przed destrukcyjnym etapem.
    const state = await client.query('SELECT legacy_migrated FROM artway_allegro_preparation_state WHERE namespace=$1', [NAMESPACE]);
    const tasks = await client.query('SELECT COUNT(*)::bigint count FROM artway_allegro_preparation_tasks WHERE namespace=$1', [NAMESPACE]);
    relationalQueue = {
      available: true,
      migrated: state.rows[0]?.legacy_migrated === true,
      tasks: Number(tasks.rows[0]?.count) || 0,
    };
  }
  const legacyQueue = kvRows.rows.find((row) => row.key === 'allegro_preparation_queue')?.value || {};
  return {
    settings,
    imported,
    legacy,
    canonical,
    domainRows: domainRows.rows,
    snapshots: snapshots.rows,
    kvRows: kvRows.rows,
    report: {
      legacyProducts: legacy.length,
      canonicalProducts: canonical.size,
      missing,
      differing,
      extra,
      legacyDomains: domainRows.rows.length,
      legacyProductKv: kvRows.rows.filter((row) => LEGACY_KV_PATTERN.test(row.key)).length,
      legacyQueue: {
        exists: kvRows.rows.some((row) => row.key === 'allegro_preparation_queue'),
        pending: Array.isArray(legacyQueue.pending) ? legacyQueue.pending.length : 0,
        active: legacyQueue.active ? 1 : 0,
        results: Array.isArray(legacyQueue.results) ? legacyQueue.results.length : 0,
      },
      relationalQueue,
    },
  };
}

async function backupToFile(audit) {
  const root = process.env.ARTWAY_MIGRATION_BACKUP_DIR || '/srv/artway/backups/migrations';
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const payload = {
    migrationId: MIGRATION_ID,
    namespace: NAMESPACE,
    createdAt: new Date().toISOString(),
    report: audit.report,
    settings: audit.settings,
    importedProducts: audit.imported,
    kv: audit.kvRows.map((row) => ({
      key: row.key,
      value: row.value,
      version: Number(row.version),
      updatedAt: row.updated_at,
    })),
  };
  const body = Buffer.from(JSON.stringify(payload));
  const digest = crypto.createHash('sha256').update(body).digest('hex');
  const target = path.join(root, `${MIGRATION_ID}-${new Date().toISOString().replace(/[:.]/g, '-')}.json.gz`);
  await fs.writeFile(target, await gzipAsync(body, { level: 9 }), { mode: 0o600 });
  return { target, digest, bytes: body.length };
}

async function applyMigration(client, audit, backup) {
  if (audit.report.missing.length) throw new Error(`Brakuje ${audit.report.missing.length} produktów w centralnej kartotece.`);
  if (audit.report.canonicalProducts !== audit.report.legacyProducts || audit.report.extra.length) {
    throw new Error('Liczba albo zbiór produktów centralnych nie zgadza się ze starym źródłem.');
  }
  if (audit.report.legacyQueue.exists
    && (!audit.report.relationalQueue.available || !audit.report.relationalQueue.migrated)) {
    throw new Error('Kolejka Allegro nie została jeszcze przeniesiona do rekordów PostgreSQL.');
  }
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${NAMESPACE}:${MIGRATION_ID}`]);
    const done = await client.query(
      'SELECT details FROM artway_domain_migrations WHERE namespace=$1 AND migration_id=$2',
      [NAMESPACE, MIGRATION_ID],
    );
    if (done.rowCount) {
      await client.query('ROLLBACK');
      return { alreadyApplied: true, details: done.rows[0].details };
    }
    for (const snapshot of audit.snapshots) {
      const config = PRODUCT_DOMAINS[snapshot.domain];
      await client.query(`
        INSERT INTO artway_domain_legacy_backup(
          namespace,key,migration_id,value,version,updated_at
        ) VALUES($1,$2,$3,$4::jsonb,$5,$6)
        ON CONFLICT DO NOTHING
      `, [
        NAMESPACE,
        `domain:${snapshot.domain}`,
        MIGRATION_ID,
        JSON.stringify(audit.settings[config.key]),
        Number(snapshot.version),
        snapshot.updated_at,
      ]);
    }
    for (const row of audit.kvRows) {
      await client.query(`
        INSERT INTO artway_domain_legacy_backup(
          namespace,key,migration_id,value,version,updated_at
        ) VALUES($1,$2,$3,$4::jsonb,$5,$6)
        ON CONFLICT DO NOTHING
      `, [NAMESPACE, `kv:${row.key}`, MIGRATION_ID, JSON.stringify(row.value), Number(row.version), row.updated_at]);
    }
    await client.query(
      'DELETE FROM artway_domain_snapshots WHERE namespace=$1 AND domain=ANY($2::text[])',
      [NAMESPACE, Object.keys(PRODUCT_DOMAINS)],
    );
    await client.query(`
      DELETE FROM artway_kv_store
      WHERE namespace=$1 AND (
        key LIKE 'imported-product-catalog:manifest:v1'
        OR key LIKE 'imported-product-catalog:shard:v1:%'
        OR key='allegro_preparation_queue'
      )
    `, [NAMESPACE]);
    const legacyKeys = Object.values(PRODUCT_DOMAINS).map((config) => config.key);
    for (const key of legacyKeys) {
      await client.query(`
        UPDATE artway_kv_store
        SET value=value #- ARRAY['data',$2]::text[],version=version+1,updated_at=NOW()
        WHERE namespace=$1 AND key='settings' AND value#>ARRAY['data',$2]::text[] IS NOT NULL
      `, [NAMESPACE, key]);
    }
    const details = {
      ...audit.report,
      differing: audit.report.differing.map((item) => ({
        ...item,
        resolution: 'kept-newer-canonical-value',
      })),
      backup,
      completedAt: new Date().toISOString(),
    };
    await client.query(`
      INSERT INTO artway_domain_migrations(namespace,migration_id,details,completed_at)
      VALUES($1,$2,$3::jsonb,NOW())
    `, [NAMESPACE, MIGRATION_ID, JSON.stringify(details)]);
    await client.query('COMMIT');
    return { alreadyApplied: false, details };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

const pool = new pg.Pool(poolOptions());
const client = await pool.connect();
try {
  const audit = await buildAudit(client);
  if (!APPLY) {
    console.log(JSON.stringify({ mode: 'audit', migrationId: MIGRATION_ID, ...audit.report }, null, 2));
  } else {
    const backup = await backupToFile(audit);
    const result = await applyMigration(client, audit, backup);
    const after = await buildAudit(client);
    console.log(JSON.stringify({
      mode: 'applied',
      migrationId: MIGRATION_ID,
      result,
      after: after.report,
    }, null, 2));
  }
} finally {
  client.release();
  await pool.end();
}
