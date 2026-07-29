export function createCentralProductSynchronizer(context = {}) {
  const {
    available, ensureSchema, text, pool, ns, asObject, asArray,
    centralCatalogBuildRecords, aggregateCache, CENTRAL_PRODUCT_SCHEMA_VERSION,
  } = context;
  return async function synchronize(data = {}, context = {}) {
    if (!available) return { available: false, synchronized: false, count: 0 };
    await ensureSchema(); const sourceRevision = text(context.sourceRevision, 300);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Blokada rekordów gwarantuje, że przebudowa indeksu nie minie się z
      // atomowym zapisem Agenta. Tylko pola wcześniej zapisane przez mutację
      // centralną mają pierwszeństwo nad starszym snapshotem domeny.
      const authorityRows = await client.query(
        'SELECT product_id,data,authoritative_fields FROM artway_products WHERE namespace=$1 FOR UPDATE',
        [ns],
      );
      const authoritativeProducts = new Map(authorityRows.rows.map((row) => [
        String(row.product_id),
        { data: asObject(row.data), fields: asArray(row.authoritative_fields) },
      ]));
      const canonicalProducts = asArray(context.canonicalProducts);
      let sourceData = data, importedProducts = asArray(context.importedProducts);
      if (canonicalProducts.length) {
        const added = [], base = [], imported = [], hidden = [];
        for (const product of canonicalProducts) {
          const source = text(product?._catalog?.source || product?.storageOrigin, 80).toLowerCase();
          if (text(product?._catalog?.recordStatus, 40).toLowerCase() === 'trash') hidden.push(product.id);
          if (source === 'import' || source === 'product-link-file-import') imported.push(product);
          else if (source === 'dodany') added.push(product);
          else base.push(product);
        }
        sourceData = {
          ...data,
          artway_produkty_katalog: base,
          artway_produkty_dodane: added,
          artway_produkty_edytowane: {},
          artway_produkty_ukryte: hidden,
          artway_produkty_definitywne: [],
        };
        importedProducts = imported;
      }
      const records = centralCatalogBuildRecords(sourceData, {
        ...context,
        importedProducts,
        sourceRevision,
        authoritativeProducts,
      });
      await client.query('CREATE TEMP TABLE artway_product_sync_ids(product_id TEXT PRIMARY KEY) ON COMMIT DROP');
      for (let start = 0; start < records.length; start += 500) {
        const batch = records.slice(start, start + 500);
        await client.query(`WITH payload AS (SELECT value item FROM jsonb_array_elements($1::jsonb)) INSERT INTO artway_product_sync_ids(product_id) SELECT item->>'id' FROM payload ON CONFLICT DO NOTHING`, [JSON.stringify(batch)]);
        await client.query(`
          WITH payload AS (SELECT value item FROM jsonb_array_elements($2::jsonb))
          INSERT INTO artway_products(namespace,product_id,data,public_data,admin_list_data,public_list_data,name,search_text,category,producer,external_id,sku,ean,source,record_status,stock,sale_available,has_source,has_allegro,allegro_status,missing_fields,missing_count,price,allegro_price,promotion,new_product,rating,rating_count,duplicate_store,duplicate_allegro,fingerprint,updated_at)
          SELECT $1,item->>'id',item->'data',item->'publicData',item->'adminListData',item->'publicListData',item->>'name',item->>'searchText',item->>'category',item->>'producer',item->>'externalId',item->>'sku',item->>'ean',item->>'source',item->>'recordStatus',NULLIF(item->>'stock','')::numeric,COALESCE((item->>'saleAvailable')::boolean,false),COALESCE((item->>'hasSource')::boolean,false),COALESCE((item->>'hasAllegro')::boolean,false),item->>'allegroStatus',item->'missingFields',COALESCE((item->>'missingCount')::integer,0),NULLIF(item->>'price','')::numeric,NULLIF(item->>'allegroPrice','')::numeric,COALESCE((item->>'promotion')::boolean,false),COALESCE((item->>'newProduct')::boolean,false),NULLIF(item->>'rating','')::numeric,COALESCE((item->>'ratingCount')::integer,0),COALESCE((item->>'duplicateStore')::boolean,false),COALESCE((item->>'duplicateAllegro')::boolean,false),item->>'fingerprint',NOW() FROM payload
          ON CONFLICT(namespace,product_id) DO UPDATE SET data=EXCLUDED.data,public_data=EXCLUDED.public_data,admin_list_data=EXCLUDED.admin_list_data,public_list_data=EXCLUDED.public_list_data,name=EXCLUDED.name,search_text=EXCLUDED.search_text,category=EXCLUDED.category,producer=EXCLUDED.producer,external_id=EXCLUDED.external_id,sku=EXCLUDED.sku,ean=EXCLUDED.ean,source=EXCLUDED.source,record_status=EXCLUDED.record_status,stock=EXCLUDED.stock,sale_available=EXCLUDED.sale_available,has_source=EXCLUDED.has_source,has_allegro=EXCLUDED.has_allegro,allegro_status=EXCLUDED.allegro_status,missing_fields=EXCLUDED.missing_fields,missing_count=EXCLUDED.missing_count,price=EXCLUDED.price,allegro_price=EXCLUDED.allegro_price,promotion=EXCLUDED.promotion,new_product=EXCLUDED.new_product,rating=EXCLUDED.rating,rating_count=EXCLUDED.rating_count,duplicate_store=EXCLUDED.duplicate_store,duplicate_allegro=EXCLUDED.duplicate_allegro,fingerprint=EXCLUDED.fingerprint,updated_at=CASE WHEN artway_products.fingerprint<>EXCLUDED.fingerprint THEN NOW() ELSE artway_products.updated_at END
        `, [ns, JSON.stringify(batch)]);
      }
      await client.query("UPDATE artway_products p SET record_status='removed',sale_available=false,updated_at=NOW() WHERE p.namespace=$1 AND NOT EXISTS(SELECT 1 FROM artway_product_sync_ids s WHERE s.product_id=p.product_id)", [ns]);
      await client.query(`INSERT INTO artway_product_catalog_meta(namespace,schema_version,source_revision,product_count,synced_at) VALUES($1,$2,$3,$4,NOW()) ON CONFLICT(namespace) DO UPDATE SET schema_version=EXCLUDED.schema_version,source_revision=EXCLUDED.source_revision,product_count=EXCLUDED.product_count,synced_at=NOW()`, [ns, CENTRAL_PRODUCT_SCHEMA_VERSION, sourceRevision, records.length]);
      await client.query('COMMIT'); aggregateCache.clear(); return { available: true, synchronized: true, count: records.length, sourceRevision };
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); }
  };


}
