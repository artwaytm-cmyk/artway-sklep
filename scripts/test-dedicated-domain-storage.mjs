import assert from 'node:assert/strict';
import pg from 'pg';
import { createPostgresStoreRepository, postgresPoolFor } from '../netlify/functions/lib/core/postgres-store-repository.mjs';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('Brakuje DATABASE_URL do izolowanej bazy testowej.');
const seed = new Client({ connectionString });
await seed.connect();

const tables = [
  'artway_domain_records_archive_v2', 'artway_agent_records', 'artway_allegro_communications',
  'artway_allegro_mappings', 'artway_allegro_offers', 'artway_allegro_orders', 'artway_store_orders',
  'artway_domain_legacy_backup', 'artway_domain_migrations', 'artway_domain_records',
  'artway_domain_snapshots', 'artway_kv_store',
];

try {
  const identity = await seed.query('SELECT current_database() AS database,current_user AS username');
  assert.equal(identity.rows[0]?.database, 'artway_benchmark', 'Test wolno uruchamiać wyłącznie w bazie artway_benchmark.');
  assert.equal(identity.rows[0]?.username, 'artway_benchmark', 'Test wymaga izolowanej roli artway_benchmark.');
  await seed.query(`DROP TABLE IF EXISTS ${tables.join(',')} CASCADE`);
  await seed.query(`CREATE TABLE artway_kv_store(
    namespace text NOT NULL,key text NOT NULL,value jsonb NOT NULL,version bigint NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(namespace,key))`);
  await seed.query(`CREATE TABLE artway_domain_snapshots(
    namespace text NOT NULL,domain text NOT NULL,metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    content_hash text NOT NULL DEFAULT '',version bigint NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(namespace,domain))`);
  await seed.query(`CREATE TABLE artway_domain_records(
    namespace text NOT NULL,domain text NOT NULL,collection text NOT NULL,record_id text NOT NULL,
    ordinal bigint NOT NULL DEFAULT 0,data jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(namespace,domain,collection,record_id),
    FOREIGN KEY(namespace,domain) REFERENCES artway_domain_snapshots(namespace,domain) ON DELETE CASCADE)`);
  await seed.query(`CREATE TABLE artway_domain_migrations(
    namespace text NOT NULL,migration_id text NOT NULL,details jsonb NOT NULL DEFAULT '{}'::jsonb,
    completed_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(namespace,migration_id))`);
  await seed.query(`CREATE TABLE artway_domain_legacy_backup(
    namespace text NOT NULL,key text NOT NULL,migration_id text NOT NULL,value jsonb NOT NULL,
    version bigint NOT NULL,updated_at timestamptz NOT NULL,backed_up_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(namespace,key,migration_id))`);
  await seed.query("INSERT INTO artway_domain_migrations(namespace,migration_id) VALUES('artway-sklep','domain-records-v1')");
  await seed.query(`INSERT INTO artway_kv_store(namespace,key,value) VALUES
    ('artway-sklep','settings','{"data":{},"rev":1}'::jsonb)`);
  await seed.query(`INSERT INTO artway_domain_snapshots(namespace,domain,metadata,content_hash,version) VALUES
    ('artway-sklep','kv:orders','{"updated_at":"2026-07-22T08:00:00Z"}'::jsonb,'seed-orders',4),
    ('artway-sklep','kv:allegro_offers','{}'::jsonb,'seed-offers',7),
    ('artway-sklep','settings:artway_agent_ai_historia','{}'::jsonb,'seed-agent',3)`);
  await seed.query(`INSERT INTO artway_domain_records(namespace,domain,collection,record_id,ordinal,data) VALUES
    ('artway-sklep','kv:orders','items','ATM-TEST-1',0,'{"nr":"ATM-TEST-1","status":"nowe"}'::jsonb),
    ('artway-sklep','kv:orders','items','ATM-TEST-2',1,'{"nr":"ATM-TEST-2","status":"wyslane"}'::jsonb),
    ('artway-sklep','kv:allegro_offers','items','OFF-1',0,'{"id":"OFF-1","status":"ACTIVE","productId":"P-1"}'::jsonb),
    ('artway-sklep','settings:artway_agent_ai_historia','value','RUN-1',0,'{"id":"RUN-1","status":"done"}'::jsonb)`);
} finally {
  await seed.end();
}

const repository = createPostgresStoreRepository({ name: 'artway-sklep', connectionString });
const pool = postgresPoolFor(connectionString);
try {
  const orders = await repository.read('orders', { items: [] });
  assert.deepEqual(orders.items.map((item) => item.nr), ['ATM-TEST-1', 'ATM-TEST-2']);
  const offers = await repository.readVersioned('allegro_offers', { items: [] });
  assert.equal(offers.etag, '"7"');
  assert.equal(offers.value.items[0]?.productId, 'P-1');
  const settings = await repository.read('settings', { data: {} });
  assert.equal(settings.data.artway_agent_ai_historia[0]?.id, 'RUN-1');

  const changed = structuredClone(offers.value);
  changed.items[0].status = 'ENDED';
  assert.equal((await repository.writeIfVersion('allegro_offers', changed, offers)).modified, true);
  const current = await repository.read('allegro_offers', { items: [] });
  assert.equal(current.items[0]?.status, 'ENDED');

  const status = await repository.storageStatus();
  assert.equal(status.engine, 'postgres-domain-tables-v2');
  assert.equal(status.migrated, true);
  assert.equal(status.activeGenericDedicatedRecords, 0);
  assert.equal(status.activeLegacyDomains, 0);
  assert.equal(status.dedicatedRecords, 4);
  const archive = await pool.query("SELECT count(*)::int AS count FROM artway_domain_records_archive_v2 WHERE namespace='artway-sklep'");
  assert.equal(Number(archive.rows[0]?.count), 4);
  process.stdout.write(`${JSON.stringify({ ok: true, ...status })}\n`);
} finally {
  await pool.end();
}
