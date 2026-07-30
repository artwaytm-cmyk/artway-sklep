import { assertPostgresRelations } from './postgres-schema-contract.mjs';

const DOMAIN_TABLES = Object.freeze({
  'kv:orders': 'artway_store_orders',
  'kv:deleted_orders': 'artway_store_orders',
  'kv:allegro_orders': 'artway_allegro_orders',
  'kv:allegro_offers': 'artway_allegro_offers',
  'kv:allegro_mappings': 'artway_allegro_mappings',
  'kv:allegro_communications': 'artway_allegro_communications',
  'kv:allegro_communication_internal_history': 'artway_allegro_communications',
  'kv:allegro_communication_internal': 'artway_allegro_communications',
  'kv:allegro_auto_replies': 'artway_allegro_communications',
  'settings:artway_agent_ai_historia': 'artway_agent_records',
  'settings:artway_agent_ai_pamiec': 'artway_agent_records',
  'settings:artway_agent_ai_zlecenia': 'artway_agent_records',
  'settings:artway_agent_ai_allegro_zadania': 'artway_agent_records',
  'kv:agent_specialists_state': 'artway_agent_records',
  'kv:agent_action_runs': 'artway_agent_records',
  'kv:agent_runtime': 'artway_agent_records',
  'kv:codex_agent_jobs': 'artway_agent_records',
  'settings:artway_stany': 'artway_warehouse_records',
  'settings:artway_magazyn_niedobory_wydan': 'artway_warehouse_records',
  'settings:artway_dostepnosc': 'artway_warehouse_records',
  'settings:artway_ruchy_magazynowe': 'artway_warehouse_records',
  'settings:artway_magazyn_produkty': 'artway_warehouse_records',
  'settings:artway_magazyn_ustawienia': 'artway_warehouse_records',
  'settings:artway_magazyn_lokalizacje': 'artway_warehouse_records',
  'settings:artway_magazyn_lokalizacje_usuniete': 'artway_warehouse_records',
  'settings:artway_dokumenty_magazynowe': 'artway_warehouse_records',
  'settings:artway_dokumenty_magazynowe_usuniete': 'artway_warehouse_records',
  'settings:artway_dokumenty_magazynowe_seq': 'artway_warehouse_records',
});

export const DEDICATED_DOMAIN_MIGRATION = 'dedicated-domain-tables-v3';

export function dedicatedTableForDomain(domain) {
  return DOMAIN_TABLES[String(domain || '')] || '';
}

export function dedicatedDomains() {
  return Object.keys(DOMAIN_TABLES);
}

export async function ensureDedicatedDomainSchema(client) {
  return assertPostgresRelations(client, [
    'artway_store_orders',
    'artway_allegro_orders',
    'artway_allegro_offers',
    'artway_allegro_mappings',
    'artway_allegro_communications',
    'artway_agent_records',
    'artway_warehouse_records',
    'artway_domain_records_archive_v2',
  ], 'dedykowanych domen');
}

export async function readDedicatedDomainRecords(client, namespace, domain) {
  const table = dedicatedTableForDomain(domain);
  if (!table) return null;
  const result = await client.query(
    `SELECT collection,record_id,ordinal,data FROM ${table} WHERE namespace=$1 AND domain=$2 ORDER BY collection,ordinal,record_id`,
    [namespace, domain],
  );
  return result.rows.map((row) => ({
    collection: row.collection,
    recordId: row.record_id,
    ordinal: Number(row.ordinal),
    data: row.data,
  }));
}

export async function replaceDedicatedDomainRecords(client, namespace, domain, records, updatedAt) {
  const table = dedicatedTableForDomain(domain);
  if (!table) return false;
  const payload = (records || []).map((row) => ({
    collection: row.collection,
    record_id: row.recordId ?? row.record_id,
    ordinal: Number(row.ordinal) || 0,
    data: row.data,
  }));
  if (payload.length) {
    await client.query(`WITH incoming AS (
      SELECT collection,record_id,ordinal,data FROM jsonb_to_recordset($3::jsonb)
        AS x(collection text,record_id text,ordinal bigint,data jsonb)
    ) INSERT INTO ${table}(namespace,domain,collection,record_id,ordinal,data,updated_at)
      SELECT $1,$2,collection,record_id,ordinal,data,$4 FROM incoming
      ON CONFLICT(namespace,domain,collection,record_id) DO UPDATE
      SET ordinal=EXCLUDED.ordinal,data=EXCLUDED.data,updated_at=EXCLUDED.updated_at
      WHERE ${table}.ordinal IS DISTINCT FROM EXCLUDED.ordinal OR ${table}.data IS DISTINCT FROM EXCLUDED.data`,
    [namespace, domain, JSON.stringify(payload), updatedAt]);
    await client.query(`DELETE FROM ${table} r WHERE namespace=$1 AND domain=$2 AND NOT EXISTS (
      SELECT 1 FROM jsonb_to_recordset($3::jsonb) AS x(collection text,record_id text,ordinal bigint,data jsonb)
      WHERE x.collection=r.collection AND x.record_id=r.record_id)`, [namespace, domain, JSON.stringify(payload)]);
  } else await client.query(`DELETE FROM ${table} WHERE namespace=$1 AND domain=$2`, [namespace, domain]);
  return true;
}

export async function deleteDedicatedDomainRecords(client, namespace, domain) {
  const table = dedicatedTableForDomain(domain);
  if (!table) return false;
  await client.query(`DELETE FROM ${table} WHERE namespace=$1 AND domain=$2`, [namespace, domain]);
  return true;
}

export async function migrateDedicatedDomainRecords(client, namespace) {
  const done = await client.query(
    'SELECT 1 FROM artway_domain_migrations WHERE namespace=$1 AND migration_id=$2',
    [namespace, DEDICATED_DOMAIN_MIGRATION],
  );
  if (done.rowCount) return { migrated: false, domains: 0, records: 0 };
  let domains = 0, records = 0;
  for (const domain of dedicatedDomains()) {
    const source = await client.query(
      'SELECT collection,record_id,ordinal,data,updated_at FROM artway_domain_records WHERE namespace=$1 AND domain=$2 ORDER BY collection,ordinal,record_id',
      [namespace, domain],
    );
    if (!source.rowCount) continue;
    await client.query(`INSERT INTO artway_domain_records_archive_v2(
      migration_id,namespace,domain,collection,record_id,ordinal,data,updated_at)
      SELECT $3,namespace,domain,collection,record_id,ordinal,data,updated_at
      FROM artway_domain_records WHERE namespace=$1 AND domain=$2 ON CONFLICT DO NOTHING`,
    [namespace, domain, DEDICATED_DOMAIN_MIGRATION]);
    const timestamp = source.rows.reduce((latest, row) => row.updated_at > latest ? row.updated_at : latest, source.rows[0].updated_at);
    await replaceDedicatedDomainRecords(client, namespace, domain, source.rows, timestamp);
    await client.query('DELETE FROM artway_domain_records WHERE namespace=$1 AND domain=$2', [namespace, domain]);
    domains++; records += source.rowCount;
  }
  await client.query(
    'INSERT INTO artway_domain_migrations(namespace,migration_id,details) VALUES($1,$2,$3::jsonb)',
    [namespace, DEDICATED_DOMAIN_MIGRATION, JSON.stringify({ domains, records, tables: [...new Set(Object.values(DOMAIN_TABLES))] })],
  );
  return { migrated: true, domains, records };
}

export async function dedicatedDomainStorageStatus(client, namespace) {
  const tables = [...new Set(Object.values(DOMAIN_TABLES))];
  const counts = {};
  for (const table of tables) {
    const result = await client.query(`SELECT count(*)::int AS count FROM ${table} WHERE namespace=$1`, [namespace]);
    counts[table] = Number(result.rows[0]?.count) || 0;
  }
  const generic = await client.query(
    'SELECT count(*)::int AS count FROM artway_domain_records WHERE namespace=$1 AND domain=ANY($2::text[])',
    [namespace, dedicatedDomains()],
  );
  const migration = await client.query(
    'SELECT 1 FROM artway_domain_migrations WHERE namespace=$1 AND migration_id=$2',
    [namespace, DEDICATED_DOMAIN_MIGRATION],
  );
  return {
    migrated: migration.rowCount === 1,
    tables: counts,
    records: Object.values(counts).reduce((sum, value) => sum + value, 0),
    activeGenericRecords: Number(generic.rows[0]?.count) || 0,
  };
}
