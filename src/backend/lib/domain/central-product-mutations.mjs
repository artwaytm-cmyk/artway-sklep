export function createCentralProductMutations(context = {}) {
  const {
    available, ensureSchema, text, pool, ns, centralCatalogBuildRecords,
    asObject, asArray, own, stableJson, centralCatalogListProduct,
    produktBezDanychPrywatnych, CENTRAL_PRODUCT_SCHEMA_VERSION,
    aggregateCache, CENTRAL_PRODUCT_DERIVED_FIELDS, numberOrNull, normalize,
    centralCatalogMissingFields, crypto,
  } = context;
  const upsertProduct = async (product = {}, {
    mutationId = '', actor = 'administrator', source = 'dodany', allowUpdate = true,
  } = {}) => {
    if (!available) return { available: false, updated: false };
    await ensureSchema();
    const sourceProduct = { ...asObject(product) };
    const productId = text(sourceProduct.id, 120);
    if (!productId) throw Object.assign(new Error('Produkt nie ma identyfikatora.'), { status: 422 });
    const safeSource = ['import', 'dodany', 'bazowy'].includes(text(source, 40)) ? text(source, 40) : 'dodany';
    const existing = await pool.query(
      'SELECT 1 FROM artway_products WHERE namespace=$1 AND product_id=$2',
      [ns, productId],
    );
    if (existing.rowCount && !allowUpdate) {
      throw Object.assign(new Error('Produkt o tym identyfikatorze już istnieje.'), {
        status: 409,
        code: 'catalog_product_exists',
      });
    }
    const record = centralCatalogBuildRecords(
      safeSource === 'dodany'
        ? { artway_produkty_dodane: [sourceProduct] }
        : safeSource === 'bazowy'
          ? { artway_produkty_katalog: [sourceProduct] }
          : {},
      {
        importedProducts: safeSource === 'import' ? [sourceProduct] : [],
      sourceRevision: `canonical-import:${new Date().toISOString()}`,
      },
    )[0];
    if (!record) throw new Error('Nie udało się przygotować rekordu produktu.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO artway_products(
          namespace,product_id,data,public_data,admin_list_data,public_list_data,
          name,search_text,category,producer,external_id,sku,ean,source,record_status,
          stock,sale_available,has_source,has_allegro,allegro_status,missing_fields,
          missing_count,price,allegro_price,promotion,new_product,rating,rating_count,
          duplicate_store,duplicate_allegro,fingerprint,authoritative_fields,updated_at
        ) VALUES(
          $1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,
          $14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22,$23,$24,$25,$26,$27,$28,
          $29,$30,$31,$32::jsonb,NOW()
        )
        ON CONFLICT(namespace,product_id) DO UPDATE SET
          data=EXCLUDED.data,public_data=EXCLUDED.public_data,
          admin_list_data=EXCLUDED.admin_list_data,public_list_data=EXCLUDED.public_list_data,
          name=EXCLUDED.name,search_text=EXCLUDED.search_text,category=EXCLUDED.category,
          producer=EXCLUDED.producer,external_id=EXCLUDED.external_id,sku=EXCLUDED.sku,
          ean=EXCLUDED.ean,source=EXCLUDED.source,record_status=EXCLUDED.record_status,
          stock=EXCLUDED.stock,sale_available=EXCLUDED.sale_available,
          has_source=EXCLUDED.has_source,has_allegro=EXCLUDED.has_allegro,
          allegro_status=EXCLUDED.allegro_status,missing_fields=EXCLUDED.missing_fields,
          missing_count=EXCLUDED.missing_count,price=EXCLUDED.price,
          allegro_price=EXCLUDED.allegro_price,promotion=EXCLUDED.promotion,
          new_product=EXCLUDED.new_product,rating=EXCLUDED.rating,
          rating_count=EXCLUDED.rating_count,duplicate_store=EXCLUDED.duplicate_store,
          duplicate_allegro=EXCLUDED.duplicate_allegro,fingerprint=EXCLUDED.fingerprint,
          authoritative_fields=(
            SELECT jsonb_agg(DISTINCT field)
            FROM jsonb_array_elements(
              artway_products.authoritative_fields || EXCLUDED.authoritative_fields
            ) field
          ),
          updated_at=NOW()
      `, [
        ns, record.id, JSON.stringify(record.data), JSON.stringify(record.publicData),
        JSON.stringify(record.adminListData), JSON.stringify(record.publicListData),
        record.name, record.searchText, record.category, record.producer,
        record.externalId, record.sku, record.ean, safeSource, record.recordStatus,
        record.stock, record.saleAvailable, record.hasSource, record.hasAllegro,
        record.allegroStatus, JSON.stringify(record.missingFields), record.missingCount,
        record.price, record.allegroPrice, record.promotion, record.newProduct,
        record.rating, record.ratingCount, record.duplicateStore, record.duplicateAllegro,
        record.fingerprint,
        JSON.stringify(Object.keys(sourceProduct).filter((field) => !CENTRAL_PRODUCT_DERIVED_FIELDS.has(field))),
      ]);
      const durableMutationId = text(mutationId || `product-upsert:${productId}:${Date.now().toString(36)}`, 200);
      await client.query(`
        INSERT INTO artway_product_mutations(
          namespace,mutation_id,product_id,area,actor,fields,remove_fields,
          before_fingerprint,after_fingerprint,status,created_at
        ) VALUES($1,$2,$3,'product-upsert',$4,$5::jsonb,'[]'::jsonb,'',$6,'applied',NOW())
        ON CONFLICT(namespace,mutation_id) DO NOTHING
      `, [ns, durableMutationId, productId, text(actor, 200), JSON.stringify(sourceProduct), record.fingerprint]);
      await client.query(`
        INSERT INTO artway_product_catalog_meta(namespace,schema_version,source_revision,product_count,synced_at)
        VALUES($1,$2,'canonical',1,NOW())
        ON CONFLICT(namespace) DO UPDATE SET
          schema_version=EXCLUDED.schema_version,
          source_revision='canonical',
          product_count=(SELECT COUNT(*) FROM artway_products WHERE namespace=$1 AND record_status<>'removed'),
          synced_at=NOW()
      `, [ns, CENTRAL_PRODUCT_SCHEMA_VERSION]);
      await client.query('COMMIT');
      aggregateCache.clear();
      return { available: true, updated: true, product: record.data, mutationId: durableMutationId };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  };

  const upsertImportedProduct = (product = {}, options = {}) => upsertProduct(product, {
    ...options,
    source: 'import',
    actor: options.actor || 'product-link-import',
  });

  const setRecordStatus = async (id, status, {
    mutationId = '', actor = 'administrator', area = 'product-lifecycle',
  } = {}) => {
    if (!available) return { available: false, updated: false };
    await ensureSchema();
    const productId = text(id, 120);
    const recordStatus = text(status, 40);
    if (!productId || !['active', 'trash'].includes(recordStatus)) {
      throw Object.assign(new Error('Nieprawidłowy produkt albo status kartoteki.'), { status: 422 });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        'SELECT data,public_data,fingerprint,sale_available FROM artway_products WHERE namespace=$1 AND product_id=$2 AND record_status<>$3 FOR UPDATE',
        [ns, productId, 'removed'],
      );
      if (!current.rowCount) {
        await client.query('ROLLBACK');
        return { available: true, updated: false, reason: 'not_found' };
      }
      const now = new Date().toISOString();
      const data = { ...asObject(current.rows[0].data) };
      const previousCatalog = asObject(data._catalog);
      const saleAvailable = recordStatus === 'active'
        ? previousCatalog.previousSaleAvailable !== false
        : false;
      data._catalog = {
        ...previousCatalog,
        recordStatus,
        previousSaleAvailable: recordStatus === 'trash'
          ? current.rows[0].sale_available !== false
          : previousCatalog.previousSaleAvailable,
        trashedAt: recordStatus === 'trash' ? now : null,
        restoredAt: recordStatus === 'active' ? now : null,
      };
      const publicData = {
        ...asObject(current.rows[0].public_data),
        dostepny: saleAvailable,
        _catalog: {
          ...asObject(asObject(current.rows[0].public_data)._catalog),
          recordStatus,
          availability: {
            ...asObject(asObject(asObject(current.rows[0].public_data)._catalog).availability),
            saleAvailable,
          },
        },
      };
      const adminListData = centralCatalogListProduct(data, data._catalog, { admin: true });
      const publicListData = centralCatalogListProduct(publicData, publicData._catalog);
      const fingerprint = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
      await client.query(`
        UPDATE artway_products
        SET data=$3::jsonb,public_data=$4::jsonb,admin_list_data=$5::jsonb,
            public_list_data=$6::jsonb,record_status=$7,
            sale_available=$8,fingerprint=$9,updated_at=NOW()
        WHERE namespace=$1 AND product_id=$2
      `, [
        ns, productId, JSON.stringify(data), JSON.stringify(publicData),
        JSON.stringify(adminListData), JSON.stringify(publicListData),
        recordStatus, saleAvailable, fingerprint,
      ]);
      const durableMutationId = text(mutationId || `product-status:${productId}:${now}`, 200);
      await client.query(`
        INSERT INTO artway_product_mutations(
          namespace,mutation_id,product_id,area,actor,fields,remove_fields,
          before_fingerprint,after_fingerprint,status,created_at
        ) VALUES($1,$2,$3,$4,$5,$6::jsonb,'[]'::jsonb,$7,$8,'applied',NOW())
        ON CONFLICT(namespace,mutation_id) DO NOTHING
      `, [
        ns, durableMutationId, productId, text(area, 80), text(actor, 200),
        JSON.stringify({ recordStatus }), current.rows[0].fingerprint || '', fingerprint,
      ]);
      await client.query('COMMIT');
      aggregateCache.clear();
      return { available: true, updated: true, productId, recordStatus, mutationId: durableMutationId };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  };

  const purgeProduct = async (id, {
    mutationId = '', actor = 'administrator',
  } = {}) => {
    if (!available) return { available: false, deleted: false };
    await ensureSchema();
    const productId = text(id, 120);
    if (!productId) throw Object.assign(new Error('Brak identyfikatora produktu.'), { status: 422 });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        "SELECT data,fingerprint FROM artway_products WHERE namespace=$1 AND product_id=$2 AND record_status='trash' FOR UPDATE",
        [ns, productId],
      );
      if (!current.rowCount) {
        await client.query('ROLLBACK');
        return { available: true, deleted: false, reason: 'not_in_trash' };
      }
      const durableMutationId = text(mutationId || `product-purge:${productId}:${Date.now().toString(36)}`, 200);
      await client.query(`
        INSERT INTO artway_product_mutations(
          namespace,mutation_id,product_id,area,actor,fields,remove_fields,
          before_fingerprint,after_fingerprint,status,created_at
        ) VALUES($1,$2,$3,'product-purge',$4,$5::jsonb,'[]'::jsonb,$6,'','applied',NOW())
        ON CONFLICT(namespace,mutation_id) DO NOTHING
      `, [
        ns, durableMutationId, productId, text(actor, 200),
        JSON.stringify({ snapshot: asObject(current.rows[0].data) }),
        current.rows[0].fingerprint || '',
      ]);
      await client.query('DELETE FROM artway_products WHERE namespace=$1 AND product_id=$2', [ns, productId]);
      await client.query(`
        UPDATE artway_product_catalog_meta
        SET product_count=(SELECT COUNT(*) FROM artway_products WHERE namespace=$1 AND record_status<>'removed'),
            synced_at=NOW()
        WHERE namespace=$1
      `, [ns]);
      await client.query('COMMIT');
      aggregateCache.clear();
      return { available: true, deleted: true, productId, mutationId: durableMutationId };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  };

  const patchProductFields = async (id, fields = {}, remove = [], {
    sourceRevision = '', mutationId = '', actor = 'system', area = 'product', expectedFields = null,
  } = {}) => {
    if (!available) return { available: false, updated: false };
    await ensureSchema();
    const productId = text(id, 120), safeFields = asObject(fields), removeFields = [...new Set(asArray(remove).map((field) => text(field, 120)).filter(Boolean))];
    if (!productId || (!Object.keys(safeFields).length && !removeFields.length)) return { available: true, updated: false, reason: 'empty_patch' };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const durableMutationId = text(mutationId || safeFields.lastAdminMutationId || `catalog:${productId}:${Date.now().toString(36)}`, 200);
      const current = await client.query(`
        SELECT data,public_data,authoritative_fields,
          EXISTS(
            SELECT 1 FROM artway_product_mutations
            WHERE namespace=$1 AND mutation_id=$4
          ) mutation_exists,
          (
            SELECT fields FROM artway_product_mutations
            WHERE namespace=$1 AND mutation_id=$4
          ) mutation_fields,
          (
            SELECT remove_fields FROM artway_product_mutations
            WHERE namespace=$1 AND mutation_id=$4
          ) mutation_remove_fields
        FROM artway_products
        WHERE namespace=$1 AND product_id=$2 AND record_status<>$3
        FOR UPDATE
      `, [ns, productId, 'removed', durableMutationId]);
      if (!current.rowCount) { await client.query('ROLLBACK'); return { available: true, updated: false, reason: 'not_found' }; }
      const currentData = asObject(current.rows[0].data);
      if (current.rows[0].mutation_exists === true) {
        // Idempotencja musi być rozstrzygnięta przed UPDATE. Dawniej powtórka
        // z tym samym mutationId zmieniała produkt, a ON CONFLICT pomijał
        // jedynie wpis dziennika. Powstawała wtedy niewidoczna zmiana, której
        // nie dało się odtworzyć ani wyjaśnić w audycie.
        const receiptFields = new Set([
          'lastAdminMutationId', 'lastAdminMutationAt', 'lastAdminMutationBy',
          'lastAdminMutationArea', 'lastAdminMutationFields',
        ]);
        const businessPayload = (value) => Object.fromEntries(
          Object.entries(asObject(value)).filter(([field]) => !receiptFields.has(field)),
        );
        const storedFields = businessPayload(current.rows[0].mutation_fields);
        const requestedFields = businessPayload(safeFields);
        const storedRemove = [...new Set(asArray(current.rows[0].mutation_remove_fields).map((field) => text(field, 120)).filter(Boolean))].sort();
        const requestedRemove = [...removeFields].sort();
        if (stableJson(storedFields) !== stableJson(requestedFields)
          || stableJson(storedRemove) !== stableJson(requestedRemove)) {
          await client.query('ROLLBACK');
          const error = new Error('Ten identyfikator operacji został już użyty z innym zestawem zmian.');
          error.status = 409;
          error.code = 'catalog_mutation_payload_conflict';
          throw error;
        }
        await client.query('COMMIT');
        return {
          available: true,
          updated: true,
          idempotent: true,
          productId,
          mutationId: durableMutationId,
          authoritativeFields: asArray(current.rows[0].authoritative_fields),
          sourceRevision: text(sourceRevision, 300),
          product: currentData,
        };
      }
      const fieldConflicts = Object.entries(asObject(expectedFields)).filter(([field, expectation]) => {
        const rule = asObject(expectation), present = own(currentData, field);
        return present !== (rule.present === true)
          || (present && stableJson(currentData[field]) !== stableJson(rule.value));
      }).map(([field]) => field);
      if (fieldConflicts.length) {
        await client.query('ROLLBACK');
        return { available: true, updated: false, reason: 'field_conflict', conflictedFields: fieldConflicts };
      }
      const beforeFingerprint = crypto.createHash('sha256').update(JSON.stringify(currentData)).digest('hex');
      const adminData = { ...currentData, ...safeFields };
      for (const field of removeFields) delete adminData[field];
      const syncedAt = new Date().toISOString();
      const previousCatalogMeta = asObject(adminData._catalog);
      const previousChannels = asObject(previousCatalogMeta.channels);
      const previousAllegroChannel = asObject(previousChannels.allegro);
      const allegroOfferId = text(adminData.allegroOfferId || previousAllegroChannel.offerId, 120);
      const allegroStatus = text(adminData.allegroStatus || adminData.allegroPublicationStatus || previousAllegroChannel.status, 80).toUpperCase();
      const catalogMeta = {
        ...previousCatalogMeta,
        sourceRevision: text(sourceRevision, 300),
        syncedAt,
        channels: {
          ...previousChannels,
          allegro: {
            ...previousAllegroChannel,
            offerId: allegroOfferId,
            status: allegroStatus,
          },
        },
      };
      adminData._catalog = catalogMeta;
      const previousPublic = asObject(current.rows[0].public_data), publicData = {
        ...produktBezDanychPrywatnych(adminData),
        ...(own(previousPublic, 'dostepny') ? { dostepny: previousPublic.dostepny } : {}),
        _catalog: {
          ...asObject(previousPublic._catalog),
          schemaVersion: CENTRAL_PRODUCT_SCHEMA_VERSION,
          channels: {
            ...asObject(asObject(previousPublic._catalog).channels),
            allegro: { offerId: allegroOfferId, status: allegroStatus },
          },
        },
      };
      const adminListData = centralCatalogListProduct(adminData, catalogMeta, { admin: true });
      const publicListData = centralCatalogListProduct(publicData, publicData._catalog);
      const missing = centralCatalogMissingFields(adminData), price = numberOrNull(adminData.cena), allegroPrice = numberOrNull(adminData.cenaAllegro ?? adminData.cena);
      const name = text(adminData.nazwa || adminData.name, 500), category = text(adminData.kategoria || adminData.category, 300);
      const producer = text(adminData.producent || adminData.marka || adminData.brand, 300);
      const externalId = text(adminData.externalId, 200), sku = text(adminData.sku, 200);
      const ean = text(adminData.gtin || adminData.ean, 80).replace(/\s/g, '');
      const hasSource = !!text(adminData.sourceUrl || adminData.producentUrl || adminData.urlProducenta);
      const searchText = normalize([
        productId, name, adminData.opisKrotki, category, sku, externalId, ean,
        adminData.kodProducenta, adminData.mpn, producer, allegroOfferId,
      ].join(' '));
      const promotion = Number(adminData.staraCena) > Number(adminData.cena);
      const newProduct = text(adminData.badge, 80).toLowerCase() === 'nowość';
      const missingCount = missing.filter((field) => field !== 'koszt').length;
      const fingerprint = crypto.createHash('sha256').update(JSON.stringify(adminData)).digest('hex');
      const authoritativeFields = [...new Set([
        ...asArray(current.rows[0].authoritative_fields),
        ...Object.keys(safeFields),
        ...removeFields,
      ].map((field) => text(field, 120)).filter((field) => field && !CENTRAL_PRODUCT_DERIVED_FIELDS.has(field)))];
      await client.query(`UPDATE artway_products SET data=$3::jsonb,public_data=$4::jsonb,admin_list_data=$5::jsonb,public_list_data=$6::jsonb,name=$7,search_text=$8,category=$9,producer=$10,external_id=$11,sku=$12,ean=$13,has_source=$14,has_allegro=$15,allegro_status=$16,price=$17,allegro_price=$18,promotion=$19,new_product=$20,missing_fields=$21::jsonb,missing_count=$22,fingerprint=$23,authoritative_fields=$24::jsonb,updated_at=NOW() WHERE namespace=$1 AND product_id=$2`, [
        ns, productId, JSON.stringify(adminData), JSON.stringify(publicData), JSON.stringify(adminListData), JSON.stringify(publicListData),
        name, searchText, category, producer, externalId, sku, ean, hasSource, !!allegroOfferId, allegroStatus,
        price, allegroPrice, promotion, newProduct, JSON.stringify(missing), missingCount, fingerprint, JSON.stringify(authoritativeFields),
      ]);
      await client.query(`
        INSERT INTO artway_product_mutations(namespace,mutation_id,product_id,area,actor,fields,remove_fields,before_fingerprint,after_fingerprint,status,created_at)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,'applied',NOW())
        ON CONFLICT(namespace,mutation_id) DO NOTHING
      `, [
        ns, durableMutationId, productId, text(area, 80) || 'product', text(actor, 200) || 'system',
        JSON.stringify(safeFields), JSON.stringify(removeFields), beforeFingerprint, fingerprint,
      ]);
      if (sourceRevision) await client.query('UPDATE artway_product_catalog_meta SET source_revision=$2,synced_at=NOW() WHERE namespace=$1', [ns, text(sourceRevision, 300)]);
      await client.query('COMMIT'); aggregateCache.clear();
      return {
        available: true, updated: true, productId, mutationId: durableMutationId,
        authoritativeFields, sourceRevision: text(sourceRevision, 300), syncedAt,
        product: adminData,
      };
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); }
  };

  return {
    upsertProduct, upsertImportedProduct, setRecordStatus, purgeProduct,
    patchProductFields,
  };
}
