#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { postgresRuntimeUrl } from './lib/postgres-runtime-url.mjs';

const namespace = process.env.ARTWAY_NAMESPACE || 'artway-sklep';
const target = path.resolve(process.argv[2] || 'products.json');
const pool = new pg.Pool({ connectionString: await postgresRuntimeUrl() });

try {
  const result = await pool.query(`
    SELECT list_data
    FROM artway_storefront_products
    WHERE namespace=$1 AND record_status='active' AND sale_available=true
    ORDER BY NULLIF(external_id,'') ASC NULLS LAST,
      NULLIF(sku,'') ASC NULLS LAST,product_id ASC
  `, [namespace]);
  const temporary = `${target}.next-${process.pid}`;
  await fs.writeFile(temporary, `${JSON.stringify(result.rows.map((row) => row.list_data), null, 2)}\n`, { mode: 0o644 });
  await fs.rename(temporary, target);
  process.stdout.write(`${JSON.stringify({ ok: true, target, products: result.rowCount, source: 'artway_storefront_products' })}\n`);
} finally {
  await pool.end();
}
