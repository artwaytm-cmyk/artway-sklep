import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { centralCatalogQueryOptions } from '../src/backend/lib/domain/central-product-catalog.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFile(path.join(projectRoot, name), 'utf8');

test('schemat PostgreSQL powstaje wyłącznie przez numerowane migracje', async () => {
  const migrationNames = (await readdir(path.join(projectRoot, 'db/migrations'))).sort();
  assert.deepEqual(migrationNames, [
    '0000_runtime_schema_baseline.sql',
    '0001_von_halsky_channel_storage.sql',
    '0002_relational_shadow_models.sql',
    '0003_read_models_history_observability.sql',
    '0004_pitr_restore_verification.sql',
    '0005_product_payload_contraction.sql',
    '0006_product_payload_lookup_indexes.sql',
    '0007_von_halsky_operational_read_models.sql',
    '0008_repair_product_payload_hashes.sql',
    '0009_channel_publication_ledger.sql',
    '0010_decouple_allegro_von_halsky_history.sql',
    '0011_product_agent_review_state.sql',
    '0012_product_agent_state_payload_source.sql',
    '0013_strict_product_review_confirmation.sql',
    '0014_product_review_compliance_guard.sql',
    '0015_event_driven_agent_runtime.sql',
    '0016_close_legacy_agent_feedback_tasks.sql',
  ]);
  const runtimeFiles = [
    'src/backend/lib/core/postgres-store-repository.mjs',
    'src/backend/lib/core/normalized-domain-repository.mjs',
    'src/backend/lib/core/dedicated-domain-storage.mjs',
    'src/backend/lib/domain/central-product-catalog.mjs',
    'src/backend/lib/domain/allegro-preparation-postgres-queue.mjs',
    'src/backend/lib/domain/agent-event-queue.mjs',
    'src/backend/lib/domain/codex-agent-postgres-queue.mjs',
  ];
  for (const file of runtimeFiles) {
    assert.doesNotMatch(await read(file), /CREATE TABLE|ALTER TABLE|CREATE INDEX/, file);
  }
});

test('aplikacja, właściciel i migrator mają oddzielne role oraz timeouty', async () => {
  const roles = await read('ops/postgres/roles.sql');
  const backend = await read('ops/systemd/artway-backend.service');
  const migrator = await read('ops/systemd/artway-postgres-migrate.service');
  const maintenance = await read('ops/systemd/artway-maintenance.service');
  const seo = await read('ops/systemd/artway-seo-daily.service');
  assert.match(roles, /CREATE ROLE artway_owner NOLOGIN/);
  assert.match(roles, /CREATE ROLE artway_migrator LOGIN/);
  assert.match(roles, /CREATE ROLE artway_app LOGIN/);
  assert.match(roles, /statement_timeout='30s'/);
  assert.match(roles, /lock_timeout='3s'/);
  assert.match(backend, /postgresql:\/\/artway_app@localhost\/artway/);
  assert.match(migrator, /User=artway-migrator/);
  assert.match(migrator, /ARTWAY_MIGRATION_OWNER_ROLE=artway_owner/);
  assert.match(roles, /GRANT CONNECT,TEMPORARY ON DATABASE artway TO artway_migrator/);
  assert.match(maintenance, /postgresql:\/\/artway_app@localhost\/artway/);
  assert.match(seo, /postgresql:\/\/artway_app@localhost\/artway/);
});

test('relacyjne cienie obejmują zamówienia, kanały, Agenta i magazyn', async () => {
  const migration = await read('db/migrations/0002_relational_shadow_models.sql');
  for (const table of [
    'artway_order_headers',
    'artway_order_items',
    'artway_channel_offers',
    'artway_agent_work_items',
    'artway_inventory_locations',
    'artway_inventory_balances',
    'artway_inventory_movements',
    'artway_warehouse_documents',
  ]) assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(migration, /artway_record_projection_error/);
  assert.match(migration, /AFTER INSERT OR UPDATE OR DELETE/);
});

test('lekki sklep, partycje, retencja i pomiar indeksów są wdrażane bez automatycznego usuwania indeksów', async () => {
  const migration = await read('db/migrations/0003_read_models_history_observability.sql');
  const maintenance = await read('scripts/maintain-postgres-partitions.mjs');
  const observation = await read('scripts/postgres-observability-snapshot.mjs');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS artway_storefront_products/);
  assert.match(migration, /PARTITION BY RANGE\(created_at\)/);
  assert.match(maintenance, /DETACH PARTITION/);
  assert.match(maintenance, /SET SCHEMA artway_archive/);
  assert.match(maintenance, /LIMIT \$2/);
  assert.match(maintenance, /quotedIdentifier/);
  assert.doesNotMatch(maintenance, /DO \$maintenance\$/);
  assert.match(observation, /artway_index_usage_samples/);
  assert.doesNotMatch(observation, /DROP INDEX/);
});

test('ciężkie dane produktów i magazynu mają oddzielne źródła oraz kontrolowany cutover', async () => {
  const migration = await read('db/migrations/0005_product_payload_contraction.sql');
  const lookupMigration = await read('db/migrations/0006_product_payload_lookup_indexes.sql');
  const queryHelpers = await read('src/backend/lib/domain/central-product-catalog-query.mjs');
  const verifier = await read('scripts/verify-postgres-projections.mjs');
  const observation = await read('scripts/postgres-observability-snapshot.mjs');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS artway_product_payloads/);
  assert.match(migration, /CREATE OR REPLACE VIEW artway_product_records/);
  assert.match(migration, /CREATE TRIGGER artway_product_payload_offload_trg/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS artway_warehouse_records/);
  assert.match(migration, /DELETE FROM artway_domain_records[\s\S]*settings:artway_stany/);
  assert.match(verifier, /INTERVAL '24 hours'/);
  assert.match(verifier, /consecutive_matches\+1>=4/);
  assert.match(verifier, /BEGIN ISOLATION LEVEL REPEATABLE READ/);
  assert.doesNotMatch(verifier, /pool\.query\(definition\./);
  assert.match(observation, /INTERVAL '7 days'/);
  assert.match(observation, /automaticDrop: false/);
  assert.match(lookupMigration, /artway_product_payloads_import_item_idx/);
  assert.match(lookupMigration, /artway_product_payloads_source_url_idx/);
  assert.match(lookupMigration, /artway_products_ean_lookup_idx/);
  assert.match(lookupMigration, /DROP INDEX IF EXISTS artway_products_source_url_idx/);
  assert.match(queryHelpers, /WITH candidates AS/);
  assert.match(queryHelpers, /artway_product_payloads x/);
});

test('katalog przyjmuje nieprzezroczysty kursor, a trasa przekazuje go do repozytorium', async () => {
  const catalog = await read('src/backend/lib/domain/central-product-catalog.mjs');
  const queryHelpers = await read('src/backend/lib/domain/central-product-catalog-query.mjs');
  const route = await read('src/backend/lib/central-product-catalog-route.mjs');
  assert.equal(centralCatalogQueryOptions({ cursor: 'abc', limit: 10000 }).cursor, 'abc');
  assert.equal(centralCatalogQueryOptions({ cursor: 'abc', limit: 10000 }).limit, 1000);
  assert.match(queryHelpers, /toString\('base64url'\)/);
  assert.match(catalog, /pagination: cursorSupported \? 'cursor' : 'offset'/);
  assert.match(route, /searchParams\.get\('cursor'\)/);
});

test('PITR archiwizuje WAL i ma automatyczne pełne, różnicowe i przyrostowe kopie', async () => {
  const pitr = await read('ops/postgres/30-artway-pitr.conf');
  const restore = await read('ops/postgres/test-pitr-restore.sh');
  const install = await read('ops/postgres/install-production.sh');
  assert.match(pitr, /archive_mode = on/);
  assert.match(pitr, /archive-push/);
  assert.match(pitr, /archive_timeout = 60s/);
  assert.match(restore, /--type=time/);
  assert.match(restore, /--target-action=promote/);
  assert.match(install, /--type=full backup/);
  assert.match(install, /artway-pgbackrest-incr\.timer/);
});

test('audyt trwałości Agenta używa produkcyjnej roli aplikacji zamiast roli NOLOGIN', async () => {
  const audit = await read('scripts/audit-agent-product-persistence.mjs');
  assert.match(audit, /import \{ postgresRuntimeUrl \}/);
  assert.match(audit, /connectionString: await postgresRuntimeUrl\(\)/);
  assert.doesNotMatch(audit, /PGUSER\s*\|\|\s*['"]artway['"]/);
});
