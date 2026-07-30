#!/usr/bin/env node
import pg from 'pg';
import { postgresRuntimeUrl } from './lib/postgres-runtime-url.mjs';

const { Pool } = pg;
const strict = process.argv.includes('--strict');
const namespace = process.env.ARTWAY_NAMESPACE || 'artway-sklep';
const pool = new Pool({
  connectionString: await postgresRuntimeUrl(),
  max: 1,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 60_000,
  query_timeout: 65_000,
});

const definitions = [
  {
    name: 'orders',
    source: `
      SELECT count(*)::bigint count FROM (
        SELECT namespace,'store' channel,
          COALESCE(NULLIF(data->>'id',''),NULLIF(data->>'checkoutFormId',''),
            NULLIF(data->>'nr',''),record_id) id
        FROM artway_store_orders WHERE namespace=$1
        UNION
        SELECT namespace,'allegro',
          COALESCE(NULLIF(data->>'id',''),NULLIF(data->>'checkoutFormId',''),
            NULLIF(data->>'nr',''),record_id)
        FROM artway_allegro_orders WHERE namespace=$1
        UNION
        SELECT namespace,'von_halsky',
          COALESCE(NULLIF(data->>'id',''),record_id)
        FROM artway_von_halsky_records WHERE namespace=$1 AND kind='orders'
      ) source`,
    projected: `SELECT count(*)::bigint count FROM artway_order_headers WHERE namespace=$1`,
    mismatches: `
      WITH source AS (
        SELECT namespace,'store' channel,
          COALESCE(NULLIF(data->>'id',''),NULLIF(data->>'checkoutFormId',''),
            NULLIF(data->>'nr',''),record_id) id,md5(data::text) hash
        FROM artway_store_orders WHERE namespace=$1
        UNION ALL
        SELECT namespace,'allegro',
          COALESCE(NULLIF(data->>'id',''),NULLIF(data->>'checkoutFormId',''),
            NULLIF(data->>'nr',''),record_id),md5(data::text)
        FROM artway_allegro_orders WHERE namespace=$1
        UNION ALL
        SELECT namespace,'von_halsky',
          COALESCE(NULLIF(data->>'id',''),record_id),md5(data::text)
        FROM artway_von_halsky_records WHERE namespace=$1 AND kind='orders'
      )
      SELECT count(*)::bigint count FROM source s
      FULL JOIN artway_order_headers p
        ON p.namespace=s.namespace AND p.channel=s.channel AND p.order_id=s.id
      WHERE COALESCE(s.namespace,p.namespace)=$1
        AND (s.id IS NULL OR p.order_id IS NULL OR s.hash<>p.source_hash)`,
  },
  {
    name: 'offers',
    source: `
      SELECT count(*)::bigint count FROM (
        SELECT namespace,'allegro' channel,
          COALESCE(NULLIF(data->>'offerId',''),NULLIF(data->>'id',''),record_id) id
        FROM artway_allegro_offers WHERE namespace=$1
        UNION
        SELECT namespace,'von_halsky',
          COALESCE(NULLIF(data->>'offerId',''),record_id)
        FROM artway_von_halsky_records WHERE namespace=$1 AND kind='offers'
      ) source`,
    projected: `SELECT count(*)::bigint count FROM artway_channel_offers WHERE namespace=$1`,
    mismatches: `
      WITH source AS (
        SELECT namespace,'allegro' channel,
          COALESCE(NULLIF(data->>'offerId',''),NULLIF(data->>'id',''),record_id) id,
          md5(data::text) hash
        FROM artway_allegro_offers WHERE namespace=$1
        UNION ALL
        SELECT namespace,'von_halsky',
          COALESCE(NULLIF(data->>'offerId',''),record_id),md5(data::text)
        FROM artway_von_halsky_records WHERE namespace=$1 AND kind='offers'
      )
      SELECT count(*)::bigint count FROM source s
      FULL JOIN artway_channel_offers p
        ON p.namespace=s.namespace AND p.channel=s.channel AND p.offer_id=s.id
      WHERE COALESCE(s.namespace,p.namespace)=$1
        AND (s.id IS NULL OR p.offer_id IS NULL OR s.hash<>p.source_hash)`,
  },
  {
    name: 'agent_work',
    source: `
      SELECT (
        (SELECT count(*) FROM artway_agent_records WHERE namespace=$1)
        +(SELECT count(*) FROM artway_agent_events WHERE namespace=$1)
      )::bigint count`,
    projected: `SELECT count(*)::bigint count FROM artway_agent_work_items WHERE namespace=$1`,
    mismatches: `
      WITH source AS (
        SELECT namespace,'record:'||domain||':'||collection kind,record_id id,
          md5(data::text) hash
        FROM artway_agent_records WHERE namespace=$1
        UNION ALL
        SELECT namespace,'event',event_id,
          md5(concat_ws('|',event_type,status,attempts,payload::text,result::text,last_error))
        FROM artway_agent_events WHERE namespace=$1
      )
      SELECT count(*)::bigint count FROM source s
      FULL JOIN artway_agent_work_items p
        ON p.namespace=s.namespace AND p.source_kind=s.kind AND p.work_id=s.id
      WHERE COALESCE(s.namespace,p.namespace)=$1
        AND (s.id IS NULL OR p.work_id IS NULL OR s.hash<>p.source_hash)`,
  },
  {
    name: 'warehouse',
    source: `
      SELECT (
        (SELECT count(*) FROM artway_domain_records
          WHERE namespace=$1 AND domain='settings:artway_magazyn_lokalizacje')
        +(SELECT count(DISTINCT record_id) FROM artway_domain_records
          WHERE namespace=$1 AND domain IN (
            'settings:artway_stany','settings:artway_magazyn_produkty'
          ))
        +(SELECT count(*) FROM artway_domain_records
          WHERE namespace=$1 AND domain='settings:artway_ruchy_magazynowe')
        +(SELECT count(*) FROM artway_domain_records
          WHERE namespace=$1 AND domain='settings:artway_dokumenty_magazynowe')
      )::bigint count`,
    projected: `
      SELECT (
        (SELECT count(*) FROM artway_inventory_locations WHERE namespace=$1)
        +(SELECT count(*) FROM artway_inventory_balances WHERE namespace=$1)
        +(SELECT count(*) FROM artway_inventory_movements WHERE namespace=$1)
        +(SELECT count(*) FROM artway_warehouse_documents WHERE namespace=$1)
      )::bigint count`,
    mismatches: `
      SELECT (
        abs(
          (SELECT count(*) FROM artway_domain_records WHERE namespace=$1
            AND domain='settings:artway_magazyn_lokalizacje')
          -(SELECT count(*) FROM artway_inventory_locations WHERE namespace=$1)
        )
        +abs(
          (SELECT count(DISTINCT record_id) FROM artway_domain_records
            WHERE namespace=$1 AND domain IN (
              'settings:artway_stany','settings:artway_magazyn_produkty'
            ))
          -(SELECT count(*) FROM artway_inventory_balances WHERE namespace=$1)
        )
        +abs(
          (SELECT count(*) FROM artway_domain_records WHERE namespace=$1
            AND domain='settings:artway_ruchy_magazynowe')
          -(SELECT count(*) FROM artway_inventory_movements WHERE namespace=$1)
        )
        +abs(
          (SELECT count(*) FROM artway_domain_records WHERE namespace=$1
            AND domain='settings:artway_dokumenty_magazynowe')
          -(SELECT count(*) FROM artway_warehouse_documents WHERE namespace=$1)
        )
      )::bigint count`,
  },
  {
    name: 'storefront_products',
    source: `SELECT count(*)::bigint count FROM artway_products WHERE namespace=$1`,
    projected: `SELECT count(*)::bigint count FROM artway_storefront_products WHERE namespace=$1`,
    mismatches: `
      SELECT count(*)::bigint count
      FROM artway_products s
      FULL JOIN artway_storefront_products p USING(namespace,product_id)
      WHERE COALESCE(s.namespace,p.namespace)=$1 AND (
        s.product_id IS NULL OR p.product_id IS NULL
        OR md5(s.public_data::text||'|'||s.public_list_data::text)<>p.source_hash
      )`,
  },
  {
    name: 'mutation_history',
    source: `SELECT count(*)::bigint count FROM artway_product_mutations WHERE namespace=$1 AND created_at>=NOW()-COALESCE((SELECT (operational_days::text||' days')::interval FROM artway_retention_policies WHERE data_class='mutation_history'),INTERVAL '180 days')`,
    projected: `SELECT count(*)::bigint count FROM artway_mutation_history WHERE namespace=$1 AND entity_type='product' AND created_at>=NOW()-COALESCE((SELECT (operational_days::text||' days')::interval FROM artway_retention_policies WHERE data_class='mutation_history'),INTERVAL '180 days')`,
    mismatches: `
      SELECT count(*)::bigint count
      FROM artway_product_mutations s
      FULL JOIN artway_mutation_history p
        ON p.namespace=s.namespace AND p.mutation_id=s.mutation_id
          AND p.created_at=s.created_at AND p.entity_type='product'
      WHERE COALESCE(s.namespace,p.namespace)=$1
        AND COALESCE(s.created_at,p.created_at)>=NOW()-COALESCE(
          (SELECT (operational_days::text||' days')::interval
           FROM artway_retention_policies WHERE data_class='mutation_history'),
          INTERVAL '180 days'
        )
        AND (s.mutation_id IS NULL OR p.mutation_id IS NULL
          OR s.product_id<>p.entity_id OR s.status<>p.status)`,
  },
];

const results = [];
try {
  for (const definition of definitions) {
    const [source, projected, mismatches] = await Promise.all([
      pool.query(definition.source, [namespace]),
      pool.query(definition.projected, [namespace]),
      pool.query(definition.mismatches, [namespace]),
    ]);
    const sourceCount = Number(source.rows[0]?.count) || 0;
    const projectionCount = Number(projected.rows[0]?.count) || 0;
    const mismatchCount = Number(mismatches.rows[0]?.count) || 0;
    const matches = sourceCount === projectionCount && mismatchCount === 0;
    if (matches) {
      await pool.query(`
        UPDATE artway_projection_errors
        SET resolved_at=NOW()
        WHERE namespace=$1 AND projection=$2 AND resolved_at IS NULL
      `, [namespace, definition.name]);
    }
    const updated = await pool.query(`
      UPDATE artway_projection_checks SET
        source_count=$3,projection_count=$4,mismatch_count=$5,
        compared_at=NOW(),
        consecutive_matches=CASE WHEN $6 THEN consecutive_matches+1 ELSE 0 END,
        details=jsonb_build_object('matches',$6,'verifiedBy','projection-verifier-v1')
      WHERE namespace=$1 AND projection=$2
      RETURNING consecutive_matches
    `, [
      namespace, definition.name, sourceCount, projectionCount,
      mismatchCount, matches,
    ]);
    results.push({
      projection: definition.name,
      sourceCount,
      projectionCount,
      mismatchCount,
      matches,
      consecutiveMatches: Number(updated.rows[0]?.consecutive_matches) || 0,
    });
  }
  const ok = results.every((result) => result.matches);
  process.stdout.write(`${JSON.stringify({ ok, namespace, results }, null, 2)}\n`);
  if (strict && !ok) process.exitCode = 2;
} finally {
  await pool.end();
}
