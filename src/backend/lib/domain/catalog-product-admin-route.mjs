import {
  createCatalogProductFieldRoute,
  createPublishedCatalogProductFieldSaver,
  sanitizeCatalogProductFields,
} from './catalog-product-field-save.mjs';

export function createCatalogProductAdminRoute(deps = {}) {
  const {
    respond,
    isAdmin,
    text,
    sessionOf,
    saveOperations,
    saveFields,
    publishFields,
    createProduct,
    readProduct,
    setProductStatus,
    purgeProduct,
  } = deps;
  const saveAndPublishFields = createPublishedCatalogProductFieldSaver({
    saveFields,
    publishFields,
  });
  const fieldRoute = createCatalogProductFieldRoute({
    respond,
    isAdmin,
    text,
    sessionOf,
    saveFields: saveAndPublishFields,
  });

  return async function catalogProductAdminRoute(req, url, action) {
    if (action === 'catalog-product-price-update') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      if (typeof saveFields !== 'function') return respond({ ok: false, error: 'Atomowy zapis ceny nie jest dostępny.' }, 503);
      const body = await req.json().catch(() => ({}));
      const productId = text(body.productId, 100);
      const channel = text(body.channel, 30);
      const clear = body.clear === true;
      const config = {
        store: { field: 'cena', updatedAt: 'cenaZaktualizowanoAt', manual: 'cenaManualna', source: 'cenaZrodlo', clear: false },
        allegro: { field: 'cenaAllegro', updatedAt: 'cenaAllegroZaktualizowanoAt', manual: 'cenaAllegroManualna', source: 'cenaAllegroZrodlo', clear: true },
        vonHalsky: { field: 'cenaVonHalsky', updatedAt: 'cenaVonHalskyZaktualizowanoAt', manual: 'cenaVonHalskyManualna', source: 'cenaVonHalskyZrodlo', clear: true },
        purchase: { field: 'cenaZakupu', updatedAt: 'cenaZakupuZaktualizowanoAt', manual: 'cenaZakupuPrywatna', source: 'cenaZakupuZrodlo', clear: true },
      }[channel];
      if (!productId || !config || (clear && !config.clear)) return respond({ ok: false, error: 'Nieprawidłowy produkt, kanał albo sposób zapisu ceny.' }, 422);
      const value = Number(String(body.value ?? '').replace(',', '.'));
      if (!clear && (!Number.isFinite(value) || value < (channel === 'purchase' ? 0 : 0.01))) {
        return respond({ ok: false, error: 'Nieprawidłowa wartość ceny.' }, 422);
      }
      const updatedAt = new Date().toISOString();
      const actor = text(sessionOf(req)?.email || 'administrator', 200);
      const fields = {
        [config.updatedAt]: updatedAt,
        [config.manual]: !clear,
        [config.source]: clear ? 'dziedziczenie po kanale nadrzędnym' : `ręczna edycja administratora: ${actor}`,
        ...(clear ? {} : { [config.field]: +value.toFixed(2) }),
      };
      if (channel === 'purchase' && !clear) Object.assign(fields, { cenaZakupuDopasowanie: 'ręcznie' });
      const purchaseInvoiceFields = [
        'cenaZakupuNetto', 'cenaZakupuVat', 'cenaZakupuWaluta', 'cenaZakupuDokument',
        'cenaZakupuKsef', 'cenaZakupuDostawca', 'cenaZakupuDataDokumentu',
      ];
      const remove = clear
        ? [config.field, ...(channel === 'purchase' ? [...purchaseInvoiceFields, 'cenaZakupuDopasowanie'] : [])]
        : (channel === 'purchase' ? purchaseInvoiceFields : []);
      try {
        const saved = await saveFields({
          productId,
          fields,
          remove,
          mutationId: `inline-price:${productId}:${channel}:${Date.now().toString(36)}`,
          actor,
          area: 'assortment-inline-price',
        });
        return respond({
          ok: true,
          confirmed: true,
          productId,
          channel,
          field: config.field,
          value: clear ? null : +value.toFixed(2),
          clear,
          fields: saved.fields || fields,
          remove: saved.remove || remove,
          publication: { published: true, queued: false, readbackConfirmed: true },
          rev: saved.rev,
          updated_at: saved.confirmedAt || updatedAt,
        });
      } catch (error) {
        return respond({
          ok: false,
          error: text(error?.message || error, 800),
          code: error?.code || 'catalog_product_price_save_failed',
        }, error?.status || 500);
      }
    }

    if (action === 'catalog-product-fields-update') return fieldRoute(req, url);

    if (action === 'catalog-product-fields-batch-update') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      if (typeof saveOperations !== 'function' || typeof readProduct !== 'function') {
        return respond({ ok: false, error: 'Wsadowy zapis centralnej kartoteki nie jest dostępny.' }, 503);
      }
      const body = await req.json().catch(() => ({}));
      const input = Array.isArray(body.operations) ? body.operations.slice(0, 1000) : [];
      if (!input.length) return respond({ ok: false, error: 'Brak zmian produktów do zapisania.' }, 422);
      const actor = text(sessionOf(req)?.email || 'administrator', 200);
      const area = text(body.area || 'admin-product-batch', 80);
      const timestamp = new Date().toISOString();
      const operations = [];
      try {
        for (let index = 0; index < input.length; index += 1) {
          const raw = input[index] && typeof input[index] === 'object' ? input[index] : {};
          const productId = text(raw.productId ?? raw.id, 100).trim();
          if (!productId) throw Object.assign(new Error(`Pozycja ${index + 1} nie ma identyfikatora produktu.`), { status: 422 });
          const remove = [...new Set((Array.isArray(raw.remove) ? raw.remove : [])
            .map((field) => text(field, 100).trim()).filter(Boolean))];
          const fields = sanitizeCatalogProductFields(raw.fields || {}, { allowEmpty: remove.length > 0 });
          const mutationId = text(
            raw.mutationId || `${area}:${productId}:${Date.now().toString(36)}:${index}`,
            200,
          );
          operations.push({
            id: productId,
            fields: {
              ...fields,
              lastAdminMutationId: mutationId,
              lastAdminMutationAt: timestamp,
              lastAdminMutationBy: actor,
              lastAdminMutationArea: area,
              lastAdminMutationFields: Object.keys(fields),
            },
            remove,
          });
        }
      } catch (error) {
        return respond({
          ok: false,
          error: text(error?.message || error, 800),
          code: error?.code || 'catalog_product_batch_invalid',
        }, error?.status || 422);
      }
      const write = await saveOperations(operations, timestamp);
      const skipped = new Set((write?.skippedProductIds || []).map(String));
      const products = (await Promise.all(operations.map(async (operation) => {
        if (skipped.has(operation.id)) return null;
        const product = await readProduct(operation.id);
        if (!product) skipped.add(operation.id);
        return product || null;
      }))).filter(Boolean);
      return respond({
        ok: skipped.size === 0,
        confirmed: skipped.size === 0,
        changed: products.length,
        requested: operations.length,
        skippedProductIds: [...skipped],
        products,
        updated_at: timestamp,
      }, skipped.size ? 409 : 200);
    }

    if (action === 'catalog-products-import') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      if (typeof createProduct !== 'function' || typeof readProduct !== 'function'
        || typeof saveOperations !== 'function') {
        return respond({ ok: false, error: 'Centralny import kartoteki nie jest dostępny.' }, 503);
      }
      const body = await req.json().catch(() => ({}));
      const input = Array.isArray(body.products) ? body.products.slice(0, 500) : [];
      if (!input.length) return respond({ ok: false, error: 'Brak produktów do importu.' }, 422);
      const actor = text(sessionOf(req)?.email || 'administrator', 200);
      const importId = text(body.importId || `catalog-import:${Date.now().toString(36)}`, 160);
      const timestamp = new Date().toISOString();
      const existingOperations = [];
      const creates = [];
      try {
        for (let index = 0; index < input.length; index += 1) {
          const raw = input[index] && typeof input[index] === 'object' ? input[index] : {};
          const productId = text(raw.id, 100).trim();
          if (!productId) throw Object.assign(new Error(`Pozycja ${index + 1} nie ma identyfikatora produktu.`), { status: 422 });
          const fields = sanitizeCatalogProductFields(Object.fromEntries(
            Object.entries(raw).filter(([key, value]) => !['id', '_catalog', 'stan', 'dostepny'].includes(key) && value !== undefined),
          ));
          const existing = await readProduct(productId);
          if (existing) {
            existingOperations.push({
              id: productId,
              fields: {
                ...fields,
                lastAdminMutationId: `${importId}:${productId}`,
                lastAdminMutationAt: timestamp,
                lastAdminMutationBy: actor,
                lastAdminMutationArea: 'catalog-import',
                lastAdminMutationFields: Object.keys(fields),
                importedAt: timestamp,
              },
            });
          } else {
            creates.push({
              product: { id: productId, ...fields, importedAt: timestamp },
              mutationId: `${importId}:${productId}`,
            });
          }
        }
      } catch (error) {
        return respond({
          ok: false,
          error: text(error?.message || error, 800),
          code: error?.code || 'catalog_import_invalid',
        }, error?.status || 422);
      }
      const errors = [];
      if (existingOperations.length) {
        const write = await saveOperations(existingOperations, timestamp);
        for (const productId of write?.skippedProductIds || []) {
          errors.push({ productId: String(productId), error: 'Nie potwierdzono aktualizacji istniejącej kartoteki.' });
        }
      }
      let nextCreate = 0;
      const createResults = [];
      const createWorker = async () => {
        while (nextCreate < creates.length) {
          const item = creates[nextCreate++];
          try {
            const result = await createProduct(item.product, {
              source: 'import',
              mutationId: item.mutationId,
              actor,
              allowUpdate: false,
            });
            createResults.push(result);
          } catch (error) {
            errors.push({
              productId: String(item.product.id),
              error: text(error?.message || error, 800),
              code: text(error?.code || 'catalog_import_create_failed', 100),
            });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(8, creates.length) }, () => createWorker()));
      const products = (await Promise.all(input.map(async (raw) => {
        const productId = text(raw?.id, 100).trim();
        if (errors.some((item) => item.productId === productId)) return null;
        const product = await readProduct(productId);
        if (!product) errors.push({ productId, error: 'Brak produktu po kontrolnym odczycie centralnej kartoteki.' });
        return product || null;
      }))).filter(Boolean);
      return respond({
        ok: errors.length === 0,
        confirmed: errors.length === 0,
        requested: input.length,
        created: createResults.length,
        updated: existingOperations.length
          - errors.filter((item) => existingOperations.some((operation) => operation.id === item.productId)).length,
        products,
        errors,
        importId,
        updated_at: timestamp,
      }, errors.length ? 409 : 200);
    }

    if (action === 'catalog-product-create') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      if (typeof createProduct !== 'function') return respond({ ok: false, error: 'Centralny zapis nowych produktów nie jest dostępny.' }, 503);
      const body = await req.json().catch(() => ({}));
      const raw = body.product && typeof body.product === 'object' && !Array.isArray(body.product)
        ? body.product
        : {};
      const productId = text(raw.id ?? body.productId, 100).trim();
      if (!productId) return respond({ ok: false, error: 'Produkt nie ma identyfikatora.' }, 422);
      try {
        const fields = sanitizeCatalogProductFields(
          Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'id')),
        );
        const actor = text(sessionOf(req)?.email || 'administrator', 200);
        const result = await createProduct({ ...fields, id: productId }, {
          source: text(body.source || 'dodany', 40),
          mutationId: text(body.mutationId, 200),
          actor,
          allowUpdate: false,
        });
        return respond({ ok: true, product: result.product, productId, mutationId: result.mutationId }, 201);
      } catch (error) {
        return respond({
          ok: false,
          error: text(error?.message || error, 800),
          code: error?.code || 'catalog_product_create_failed',
        }, error?.status || 500);
      }
    }

    if (action === 'catalog-product-lifecycle') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const ids = [...new Set((Array.isArray(body.productIds) ? body.productIds : [body.productId])
        .map((id) => text(id, 100).trim()).filter(Boolean))].slice(0, 1000);
      const operation = text(body.operation, 30).toLowerCase();
      if (!ids.length || !['trash', 'restore', 'purge'].includes(operation)) {
        return respond({ ok: false, error: 'Nieprawidłowa operacja cyklu życia produktu.' }, 422);
      }
      if ((operation === 'purge' && typeof purgeProduct !== 'function')
        || (operation !== 'purge' && typeof setProductStatus !== 'function')) {
        return respond({ ok: false, error: 'Centralny cykl życia produktów nie jest dostępny.' }, 503);
      }
      const actor = text(sessionOf(req)?.email || 'administrator', 200);
      const results = [];
      for (const productId of ids) {
        const mutationId = text(
          body.mutationId
            ? `${body.mutationId}:${productId}`
            : `product-${operation}:${productId}:${Date.now().toString(36)}`,
          200,
        );
        const result = operation === 'purge'
          ? await purgeProduct(productId, { mutationId, actor })
          : await setProductStatus(productId, operation === 'trash' ? 'trash' : 'active', {
            mutationId,
            actor,
            area: 'product-lifecycle',
          });
        results.push({ productId, ...result });
      }
      return respond({
        ok: true,
        operation,
        results,
        changed: results.filter((result) => result.updated || result.deleted).length,
      });
    }

    return null;
  };
}
