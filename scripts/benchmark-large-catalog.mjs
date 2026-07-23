import crypto from 'node:crypto';
import pg from 'pg';
import { createCentralProductCatalog } from '../src/backend/lib/domain/central-product-catalog.mjs';
import { verifyIsolatedBenchmarkDatabase } from './lib/benchmark-database-guard.mjs';

const { Pool } = pg;

const rowsArgument = process.argv.find((value) => value.startsWith('--rows='));
const rows = Math.max(10_000, Math.min(250_000, Number(rowsArgument?.split('=')[1]) || 100_000));
const connectionString = process.env.ARTWAY_BENCHMARK_DATABASE_URL;
if (!connectionString) throw new Error('Benchmark wymaga odizolowanego ARTWAY_BENCHMARK_DATABASE_URL.');

const namespace = `artway-benchmark-${crypto.randomUUID()}`;
const pool = new Pool({
  connectionString,
  max: 2,
  connectionTimeoutMillis: 10_000,
  application_name: 'artway-isolated-catalog-benchmark',
});
const catalog = createCentralProductCatalog({ pool, namespace });
const elapsed = async (label, operation) => {
  const started = performance.now();
  const result = await operation();
  return { label, milliseconds: Number((performance.now() - started).toFixed(2)), total: Number(result?.total) || 0, returned: Array.isArray(result?.items) ? result.items.length : 0 };
};

let lockClient = null;
let isolatedDatabaseVerified = false;
try {
  const identity = await verifyIsolatedBenchmarkDatabase(pool);
  isolatedDatabaseVerified = true;
  lockClient = await pool.connect();
  const lock = await lockClient.query('SELECT pg_try_advisory_lock($1) AS acquired', [2_607_202_604]);
  if (lock.rows[0]?.acquired !== true) throw new Error('Inny izolowany benchmark katalogu już działa.');
  await catalog.ensureSchema();
  await pool.query(`
    INSERT INTO artway_products(
      namespace,product_id,data,public_data,admin_list_data,public_list_data,name,search_text,category,producer,
      external_id,sku,ean,source,record_status,stock,sale_available,has_source,has_allegro,allegro_status,
      missing_fields,missing_count,price,allegro_price,promotion,duplicate_store,duplicate_allegro,fingerprint,updated_at
    )
    SELECT $1, n::text,
      jsonb_build_object('id',n::text,'nazwa','Produkt testowy '||n,'cena',(n%500)+1),
      jsonb_build_object('id',n::text,'nazwa','Produkt testowy '||n,'cena',(n%500)+1),
      jsonb_build_object('id',n::text,'nazwa','Produkt testowy '||n,'externalId','EXT-'||lpad(n::text,7,'0'),'cena',(n%500)+1),
      jsonb_build_object('id',n::text,'nazwa','Produkt testowy '||n,'externalId','EXT-'||lpad(n::text,7,'0'),'cena',(n%500)+1),
      'Produkt testowy '||n, 'produkt testowy '||n||' ext '||n, 'Kategoria '||(n%40), 'Producent '||(n%20),
      'EXT-'||lpad(n::text,7,'0'), 'SKU-'||n, lpad((5900000000000+n)::text,13,'0'), 'import', 'active', n%30, true, true,
      n%3=0, CASE WHEN n%3=0 THEN 'ACTIVE' ELSE '' END, '[]'::jsonb, 0, (n%500)+1, (n%500)+3, n%25=0, false, false,
      md5(n::text), NOW()
    FROM generate_series(1,$2::int) n
  `, [namespace, rows]);
  await pool.query(`INSERT INTO artway_product_catalog_meta(namespace,schema_version,source_revision,product_count,synced_at)
    VALUES($1,2,'benchmark-revision',$2,NOW())`, [namespace, rows]);

  const results = [];
  results.push(await elapsed('pierwsza strona', () => catalog.query({ admin: true, page: 1, limit: 50 })));
  results.push(await elapsed('środkowa strona', () => catalog.query({ admin: true, page: Math.ceil(rows / 100), limit: 100 })));
  results.push(await elapsed('wyszukiwanie pełnotekstowe', () => catalog.query({ admin: true, query: `Produkt testowy ${Math.floor(rows / 2)}`, page: 1, limit: 50 })));
  results.push(await elapsed('filtry producenta i stanu', () => catalog.query({ admin: true, producer: 'Producent 1', stock: 'niskie', page: 1, limit: 50 })));
  console.log(JSON.stringify({ ok: true, rows, isolated: true, database: identity.database, role: identity.role, namespace, results }, null, 2));
} finally {
  if (isolatedDatabaseVerified) {
    await pool.query('DELETE FROM artway_products WHERE namespace=$1', [namespace]).catch(() => {});
    await pool.query('DELETE FROM artway_product_catalog_meta WHERE namespace=$1', [namespace]).catch(() => {});
  }
  if (lockClient) {
    await lockClient.query('SELECT pg_advisory_unlock($1)', [2_607_202_604]).catch(() => {});
    lockClient.release();
  }
  await pool.end();
}
