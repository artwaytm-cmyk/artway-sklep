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
  'kv:allegro_communication_telegram_alerts': 'artway_allegro_communications',
  'settings:artway_agent_ai_historia': 'artway_agent_records',
  'settings:artway_agent_ai_pamiec': 'artway_agent_records',
  'settings:artway_agent_ai_zlecenia': 'artway_agent_records',
  'settings:artway_agent_ai_allegro_zadania': 'artway_agent_records',
  'kv:agent_specialists_state': 'artway_agent_records',
  'kv:agent_action_runs': 'artway_agent_records',
  'kv:agent_runtime': 'artway_agent_records',
  'kv:codex_agent_jobs': 'artway_agent_records',
  'kv:telegram_communication_state': 'artway_agent_records',
});

export const DEDICATED_DOMAIN_MIGRATION = 'dedicated-domain-tables-v2';

export function dedicatedTableForDomain(domain) {
  return DOMAIN_TABLES[String(domain || '')] || '';
}

export function dedicatedDomains() {
  return Object.keys(DOMAIN_TABLES);
}

export async function ensureDedicatedDomainSchema(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS artway_store_orders(
    namespace text NOT NULL,domain text NOT NULL,collection text NOT NULL,record_id text NOT NULL,
    ordinal bigint NOT NULL DEFAULT 0,data jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),
    status text GENERATED ALWAYS AS (COALESCE(data->>'status','')) STORED,
    customer_email text GENERATED ALWAYS AS (lower(COALESCE(data->>'email',data->>'customerEmail',''))) STORED,
    PRIMARY KEY(namespace,domain,collection,record_id),
    FOREIGN KEY(namespace,domain) REFERENCES artway_domain_snapshots(namespace,domain) ON DELETE CASCADE)`);
  await client.query('CREATE INDEX IF NOT EXISTS artway_store_orders_status_idx ON artway_store_orders(namespace,domain,status,ordinal)');
  await client.query('CREATE INDEX IF NOT EXISTS artway_store_orders_email_idx ON artway_store_orders(namespace,customer_email) WHERE customer_email<>\'\'');

  await client.query(`CREATE TABLE IF NOT EXISTS artway_allegro_orders(
    namespace text NOT NULL,domain text NOT NULL,collection text NOT NULL,record_id text NOT NULL,
    ordinal bigint NOT NULL DEFAULT 0,data jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),
    status text GENERATED ALWAYS AS (COALESCE(data->>'status',data->>'fulfillmentStatus','')) STORED,
    checkout_form_id text GENERATED ALWAYS AS (COALESCE(data->>'checkoutFormId',data->>'checkout_form_id','')) STORED,
    PRIMARY KEY(namespace,domain,collection,record_id),
    FOREIGN KEY(namespace,domain) REFERENCES artway_domain_snapshots(namespace,domain) ON DELETE CASCADE)`);
  await client.query('CREATE INDEX IF NOT EXISTS artway_allegro_orders_status_idx ON artway_allegro_orders(namespace,status,ordinal)');
  await client.query('CREATE INDEX IF NOT EXISTS artway_allegro_orders_checkout_idx ON artway_allegro_orders(namespace,checkout_form_id) WHERE checkout_form_id<>\'\'');

  await client.query(`CREATE TABLE IF NOT EXISTS artway_allegro_offers(
    namespace text NOT NULL,domain text NOT NULL,collection text NOT NULL,record_id text NOT NULL,
    ordinal bigint NOT NULL DEFAULT 0,data jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),
    status text GENERATED ALWAYS AS (COALESCE(data->>'status',data#>>'{publication,status}','')) STORED,
    product_id text GENERATED ALWAYS AS (COALESCE(data->>'productId',data#>>'{product,id}','')) STORED,
    PRIMARY KEY(namespace,domain,collection,record_id),
    FOREIGN KEY(namespace,domain) REFERENCES artway_domain_snapshots(namespace,domain) ON DELETE CASCADE)`);
  await client.query('CREATE INDEX IF NOT EXISTS artway_allegro_offers_status_idx ON artway_allegro_offers(namespace,status,ordinal)');
  await client.query('CREATE INDEX IF NOT EXISTS artway_allegro_offers_product_idx ON artway_allegro_offers(namespace,product_id) WHERE product_id<>\'\'');
  await client.query('CREATE INDEX IF NOT EXISTS artway_allegro_offers_data_idx ON artway_allegro_offers USING gin(data jsonb_path_ops)');

  await client.query(`CREATE TABLE IF NOT EXISTS artway_allegro_mappings(
    namespace text NOT NULL,domain text NOT NULL,collection text NOT NULL,record_id text NOT NULL,
    ordinal bigint NOT NULL DEFAULT 0,data jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),
    product_id text GENERATED ALWAYS AS (COALESCE(data->>'productId','')) STORED,
    mapping_state text GENERATED ALWAYS AS (COALESCE(data->>'mappingRole',data->>'lifecycle',data->>'status','')) STORED,
    PRIMARY KEY(namespace,domain,collection,record_id),
    FOREIGN KEY(namespace,domain) REFERENCES artway_domain_snapshots(namespace,domain) ON DELETE CASCADE)`);
  await client.query('CREATE INDEX IF NOT EXISTS artway_allegro_mappings_product_idx ON artway_allegro_mappings(namespace,product_id) WHERE product_id<>\'\'');
  await client.query('CREATE INDEX IF NOT EXISTS artway_allegro_mappings_state_idx ON artway_allegro_mappings(namespace,mapping_state)');

  await client.query(`CREATE TABLE IF NOT EXISTS artway_allegro_communications(
    namespace text NOT NULL,domain text NOT NULL,collection text NOT NULL,record_id text NOT NULL,
    ordinal bigint NOT NULL DEFAULT 0,data jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),
    status text GENERATED ALWAYS AS (COALESCE(data->>'status',data->>'state','')) STORED,
    buyer_login text GENERATED ALWAYS AS (lower(COALESCE(data->>'buyerLogin',data#>>'{interlocutor,login}',''))) STORED,
    PRIMARY KEY(namespace,domain,collection,record_id),
    FOREIGN KEY(namespace,domain) REFERENCES artway_domain_snapshots(namespace,domain) ON DELETE CASCADE)`);
  await client.query('CREATE INDEX IF NOT EXISTS artway_allegro_communications_status_idx ON artway_allegro_communications(namespace,domain,collection,status,ordinal)');
  await client.query('CREATE INDEX IF NOT EXISTS artway_allegro_communications_buyer_idx ON artway_allegro_communications(namespace,buyer_login) WHERE buyer_login<>\'\'');
  await client.query('CREATE INDEX IF NOT EXISTS artway_allegro_communications_data_idx ON artway_allegro_communications USING gin(data jsonb_path_ops)');

  await client.query(`CREATE TABLE IF NOT EXISTS artway_agent_records(
    namespace text NOT NULL,domain text NOT NULL,collection text NOT NULL,record_id text NOT NULL,
    ordinal bigint NOT NULL DEFAULT 0,data jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),
    state text GENERATED ALWAYS AS (COALESCE(data->>'state',data->>'status','')) STORED,
    event_at text GENERATED ALWAYS AS (COALESCE(data->>'at',data->>'createdAt',data->>'updatedAt','')) STORED,
    PRIMARY KEY(namespace,domain,collection,record_id),
    FOREIGN KEY(namespace,domain) REFERENCES artway_domain_snapshots(namespace,domain) ON DELETE CASCADE)`);
  await client.query('CREATE INDEX IF NOT EXISTS artway_agent_records_state_idx ON artway_agent_records(namespace,domain,collection,state,ordinal)');
  await client.query('CREATE INDEX IF NOT EXISTS artway_agent_records_time_idx ON artway_agent_records(namespace,event_at DESC) WHERE event_at<>\'\'');
  await client.query('CREATE INDEX IF NOT EXISTS artway_agent_records_data_idx ON artway_agent_records USING gin(data jsonb_path_ops)');

  await client.query(`CREATE TABLE IF NOT EXISTS artway_domain_records_archive_v2(
    migration_id text NOT NULL,namespace text NOT NULL,domain text NOT NULL,collection text NOT NULL,
    record_id text NOT NULL,ordinal bigint NOT NULL,data jsonb NOT NULL,updated_at timestamptz NOT NULL,
    archived_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(migration_id,namespace,domain,collection,record_id))`);
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
