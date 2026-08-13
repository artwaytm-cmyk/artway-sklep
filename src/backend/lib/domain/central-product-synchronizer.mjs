const DEFAULT_SYNC_BATCH_SIZE = 100;

function synchronizationBatchSize(value = process.env.ARTWAY_CATALOG_SYNC_BATCH) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(25, Math.min(250, Math.trunc(parsed)))
    : DEFAULT_SYNC_BATCH_SIZE;
}

function safeConnectionError(error) {
  return {
    code: String(error?.code || '').slice(0, 40),
    message: String(error?.message || error || 'Błąd połączenia PostgreSQL').slice(0, 500),
  };
}

export function createCentralProductSynchronizer(context = {}) {
  const {
    available, ensureSchema, text, pool, ns, asObject, asArray,
    centralCatalogBuildRecords, aggregateCache, CENTRAL_PRODUCT_SCHEMA_VERSION,
    logger = console,
  } = context;

  return async function synchronize(data = {}, options = {}) {
    if (!available) return { available: false, synchronized: false, count: 0 };
    await ensureSchema();
    const sourceRevision = text(options.sourceRevision, 300);
    const client = await pool.connect();
    let advisoryLocked = false;
    let transactionOpen = false;
    let connectionError = null;
    const onClientError = (error) => {
      connectionError = error;
      logger.error?.('central_product_catalog_connection_error', safeConnectionError(error));
    };
    client.on?.('error', onClientError);

    try {
      // Blokada sesyjna nie otwiera transakcji, dlatego kosztowne składanie
      // kartoteki nie podlega idle_in_transaction_session_timeout. Chroni też
      // przed równoległą pełną przebudową podczas krótkiego nakładania wydań.
      const lock = await client.query(
        'SELECT pg_try_advisory_lock(hashtextextended($1,0)) locked',
        [`${ns}:central-product-catalog-sync`],
      );
      if (lock.rows[0]?.locked !== true) {
        return { available: true, synchronized: false, inProgress: true, count: 0 };
      }
      advisoryLocked = true;

      // Jeden spójny odczyt danych, pól autorytatywnych i fingerprintów.
      // Nie blokujemy wierszy na czas pracy JavaScript. Późniejszy zapis używa
      // fingerprintu jako blokady optymistycznej i nigdy nie nadpisuje mutacji,
      // która pojawiła się po tym odczycie.
      const snapshot = await client.query(`
        SELECT p.product_id,x.data,x.authoritative_fields,p.fingerprint,
               p.record_status,statement_timestamp() sync_started_at
        FROM artway_products p
        JOIN artway_product_payloads x
          ON x.namespace=p.namespace AND x.product_id=p.product_id
        WHERE p.namespace=$1
        ORDER BY p.product_id
      `, [ns]);
      const syncStartedAt = snapshot.rows[0]?.sync_started_at
        || (await client.query('SELECT clock_timestamp() sync_started_at')).rows[0].sync_started_at;
      const snapshotById = new Map(snapshot.rows.map((row) => [String(row.product_id), row]));

      let canonicalProducts = asArray(options.canonicalProducts);
      if (options.preferCanonicalCatalog && snapshot.rows.length) {
        canonicalProducts = snapshot.rows.filter((row) => row.record_status !== 'removed').map((row) => ({
          ...asObject(row.data),
          id: asObject(row.data).id ?? row.product_id,
        }));
      }
      const authoritativeProducts = canonicalProducts.length
        ? new Map()
        : new Map(snapshot.rows.map((row) => [
          String(row.product_id),
          { data: asObject(row.data), fields: asArray(row.authoritative_fields) },
        ]));

      let sourceData = data;
      let importedProducts = asArray(options.importedProducts);
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

      // Najcięższa część synchronizacji musi zakończyć się przed BEGIN.
      const records = centralCatalogBuildRecords(sourceData, {
        ...options,
        importedProducts,
        sourceRevision,
        authoritativeProducts,
      });
      const batchSize = synchronizationBatchSize(options.batchSize);

      await client.query('BEGIN');
      transactionOpen = true;
      await client.query("SET LOCAL lock_timeout='5s'");
      await client.query("SET LOCAL statement_timeout='120s'");
      await client.query(`
        CREATE TEMP TABLE artway_product_sync_ids(
          product_id TEXT PRIMARY KEY,
          expected_fingerprint TEXT
        ) ON COMMIT DROP
      `);

      let appliedChangedCount = 0;
      let changedCount = 0;
      let unchangedCount = 0;
      for (let start = 0; start < records.length; start += batchSize) {
        const batch = records.slice(start, start + batchSize).map((record) => ({
          ...record,
          expectedFingerprint: snapshotById.get(String(record.id))?.fingerprint || null,
        }));
        const serializedBatch = JSON.stringify(batch);
        await client.query(`
          WITH payload AS (SELECT value item FROM jsonb_array_elements($1::jsonb))
          INSERT INTO artway_product_sync_ids(product_id,expected_fingerprint)
          SELECT item->>'id',NULLIF(item->>'expectedFingerprint','') FROM payload
          ON CONFLICT(product_id) DO UPDATE
          SET expected_fingerprint=EXCLUDED.expected_fingerprint
        `, [serializedBatch]);
        const changedBatch = batch.filter((record) => {
          const existing = snapshotById.get(String(record.id));
          return !existing
            || existing.fingerprint !== record.fingerprint
            || existing.record_status !== record.recordStatus;
        });
        changedCount += changedBatch.length;
        unchangedCount += batch.length - changedBatch.length;
        if (!changedBatch.length) continue;
        const serializedChangedBatch = JSON.stringify(changedBatch);
        const applied = await client.query(`
          WITH payload AS (SELECT value item FROM jsonb_array_elements($2::jsonb))
          INSERT INTO artway_products(namespace,product_id,data,public_data,admin_list_data,public_list_data,name,search_text,category,producer,external_id,sku,ean,source,record_status,stock,sale_available,has_source,has_allegro,allegro_status,missing_fields,missing_count,price,allegro_price,promotion,new_product,rating,rating_count,duplicate_store,duplicate_allegro,fingerprint,updated_at)
          SELECT $1,item->>'id',item->'data',item->'publicData',item->'adminListData',item->'publicListData',item->>'name',item->>'searchText',item->>'category',item->>'producer',item->>'externalId',item->>'sku',item->>'ean',item->>'source',item->>'recordStatus',NULLIF(item->>'stock','')::numeric,COALESCE((item->>'saleAvailable')::boolean,false),COALESCE((item->>'hasSource')::boolean,false),COALESCE((item->>'hasAllegro')::boolean,false),item->>'allegroStatus',item->'missingFields',COALESCE((item->>'missingCount')::integer,0),NULLIF(item->>'price','')::numeric,NULLIF(item->>'allegroPrice','')::numeric,COALESCE((item->>'promotion')::boolean,false),COALESCE((item->>'newProduct')::boolean,false),NULLIF(item->>'rating','')::numeric,COALESCE((item->>'ratingCount')::integer,0),COALESCE((item->>'duplicateStore')::boolean,false),COALESCE((item->>'duplicateAllegro')::boolean,false),item->>'fingerprint',NOW() FROM payload
          ON CONFLICT(namespace,product_id) DO UPDATE SET data=EXCLUDED.data,public_data=EXCLUDED.public_data,admin_list_data=EXCLUDED.admin_list_data,public_list_data=EXCLUDED.public_list_data,name=EXCLUDED.name,search_text=EXCLUDED.search_text,category=EXCLUDED.category,producer=EXCLUDED.producer,external_id=EXCLUDED.external_id,sku=EXCLUDED.sku,ean=EXCLUDED.ean,source=EXCLUDED.source,record_status=EXCLUDED.record_status,stock=EXCLUDED.stock,sale_available=EXCLUDED.sale_available,has_source=EXCLUDED.has_source,has_allegro=EXCLUDED.has_allegro,allegro_status=EXCLUDED.allegro_status,missing_fields=EXCLUDED.missing_fields,missing_count=EXCLUDED.missing_count,price=EXCLUDED.price,allegro_price=EXCLUDED.allegro_price,promotion=EXCLUDED.promotion,new_product=EXCLUDED.new_product,rating=EXCLUDED.rating,rating_count=EXCLUDED.rating_count,duplicate_store=EXCLUDED.duplicate_store,duplicate_allegro=EXCLUDED.duplicate_allegro,fingerprint=EXCLUDED.fingerprint,updated_at=CASE WHEN artway_products.fingerprint<>EXCLUDED.fingerprint THEN NOW() ELSE artway_products.updated_at END
          WHERE artway_products.fingerprint=(
            SELECT sync.expected_fingerprint
            FROM artway_product_sync_ids sync
            WHERE sync.product_id=EXCLUDED.product_id
              AND sync.expected_fingerprint IS NOT NULL
          )
          RETURNING product_id
        `, [ns, serializedChangedBatch]);
        appliedChangedCount += applied.rowCount;
      }

      const removed = await client.query(`
        UPDATE artway_products p
        SET record_status='removed',sale_available=false,updated_at=NOW()
        WHERE p.namespace=$1
          AND p.record_status<>'removed'
          AND p.updated_at<$2
          AND NOT EXISTS(
            SELECT 1 FROM artway_product_sync_ids sync
            WHERE sync.product_id=p.product_id
          )
      `, [ns, syncStartedAt]);
      const skippedCount = Math.max(0, changedCount - appliedChangedCount);
      const appliedCount = unchangedCount + appliedChangedCount;
      await client.query(`
        INSERT INTO artway_product_catalog_meta(namespace,schema_version,source_revision,product_count,synced_at)
        VALUES($1,$2,$3,$4,NOW())
        ON CONFLICT(namespace) DO UPDATE SET
          schema_version=EXCLUDED.schema_version,
          source_revision=EXCLUDED.source_revision,
          product_count=EXCLUDED.product_count,
          synced_at=NOW()
      `, [ns, CENTRAL_PRODUCT_SCHEMA_VERSION, sourceRevision, records.length]);
      await client.query('COMMIT');
      transactionOpen = false;
      aggregateCache.clear();
      return {
        available: true,
        // Pominięty rekord nie jest błędem synchronizacji: oznacza nowszą,
        // autorytatywną mutację produktu wykonaną równolegle przez panel lub
        // Agenta. Pozostawiamy ją bez nadpisania i zatwierdzamy rewizję źródła.
        synchronized: true,
        retryRequired: false,
        count: records.length,
        appliedCount,
        changedCount,
        unchangedCount,
        skippedCount,
        concurrentMutationCount: skippedCount,
        removedCount: removed.rowCount,
        sourceRevision,
      };
    } catch (error) {
      if (transactionOpen) await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      if (advisoryLocked && !connectionError) {
        await client.query(
          'SELECT pg_advisory_unlock(hashtextextended($1,0))',
          [`${ns}:central-product-catalog-sync`],
        ).catch(() => {});
      }
      client.removeListener?.('error', onClientError);
      client.release(connectionError || undefined);
    }
  };
}
