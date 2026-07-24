const MAX_FIELDS = 80;
const MAX_PAYLOAD_BYTES = 750_000;

export const CATALOG_PRODUCT_PREPARATION_FIELDS = new Set([
  'nazwa', 'allegroTitle', 'opisKrotki', 'opis', 'allegroShortDescription',
  'allegroDescription', 'producent', 'marka', 'gtin', 'ean', 'kodProducenta',
  'mpn', 'zdjecie', 'zdjecia', 'sourceEvidence', 'sourceMaterial',
  'allegroCategoryId', 'allegroProductId', 'allegroParameters',
  'allegroDescriptionSections', 'allegroShippingSubsidy', 'contentEditorial',
  'contentEditorialPreparedAt', 'contentEditorialSource',
  'allegroDescriptionSource', 'allegroEditorialSyncPending',
  'allegroEditorialSyncRequestedAt', 'allegroEditorialSyncError',
  'allegroAgentPreparationStatus', 'allegroAgentPreparationMissing',
  'allegroAgentSavedFields', 'allegroAgentPreparedAt',
  'allegroAgentPreparationStartedAt', 'allegroAgentPreparationSource',
  'allegroAgentDraftOperation', 'allegroAgentCompliancePolicy',
  'allegroAgentComplianceCheckedAt', 'allegroAgentPreparationError',
  'allegroAgentPreparationCheckedAt',
]);

const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function sanitizeCatalogProductFields(fields = {}) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    const error = new Error('Pola produktu muszą być obiektem.');
    error.status = 422;
    throw error;
  }
  const entries = Object.entries(fields);
  if (!entries.length || entries.length > MAX_FIELDS) {
    const error = new Error('Nieprawidłowa liczba pól produktu.');
    error.status = 422;
    throw error;
  }
  const unknown = entries.map(([key]) => key).filter((key) => !CATALOG_PRODUCT_PREPARATION_FIELDS.has(key));
  if (unknown.length) {
    const error = new Error(`Niedozwolone pola kartoteki: ${unknown.slice(0, 8).join(', ')}`);
    error.status = 422;
    error.code = 'catalog_product_fields_not_allowed';
    throw error;
  }
  const clean = Object.fromEntries(entries.filter(([, value]) => value !== undefined));
  if (Buffer.byteLength(JSON.stringify(clean), 'utf8') > MAX_PAYLOAD_BYTES) {
    const error = new Error('Zmiana produktu jest zbyt duża.');
    error.status = 413;
    throw error;
  }
  return clean;
}

export function createCatalogProductFieldSaver({
  writeOperations,
  readProduct,
  now = () => new Date().toISOString(),
} = {}) {
  if (typeof writeOperations !== 'function' || typeof readProduct !== 'function') {
    throw new Error('Trwały zapis produktu wymaga zapisu operacji i odczytu centralnej kartoteki.');
  }
  return async function saveCatalogProductFields({
    productId,
    fields,
    mutationId,
    actor = 'administrator',
    area = 'allegro-preparation',
  } = {}) {
    const id = String(productId || '').trim();
    if (!id) {
      const error = new Error('Brakuje identyfikatora produktu.');
      error.status = 422;
      throw error;
    }
    const changedAt = now(), clean = sanitizeCatalogProductFields(fields);
    const receipt = {
      lastAdminMutationId: String(mutationId || `product-${id}-${Date.now().toString(36)}`).slice(0, 160),
      lastAdminMutationAt: changedAt,
      lastAdminMutationBy: String(actor || 'administrator').slice(0, 200),
      lastAdminMutationArea: String(area || 'product').slice(0, 80),
      lastAdminMutationFields: Object.keys(clean),
    };
    const expected = { ...clean, ...receipt };
    const saved = await writeOperations([{ id, fields: expected }], changedAt);
    if (saved?.skippedProductIds?.includes(id)) {
      const error = new Error('Produkt nie istnieje w centralnym katalogu.');
      error.status = 404;
      error.code = 'catalog_product_not_found';
      throw error;
    }
    const product = await readProduct(id, saved?.value?.data);
    if (!product) {
      const error = new Error('Po zapisie nie udało się odczytać centralnej kartoteki produktu.');
      error.status = 500;
      error.code = 'catalog_product_readback_missing';
      throw error;
    }
    const mismatches = Object.entries(expected)
      .filter(([key, value]) => !own(product, key) || !same(product[key], value))
      .map(([key]) => key);
    if (mismatches.length) {
      const error = new Error(`Serwer nie potwierdził pól: ${mismatches.slice(0, 12).join(', ')}`);
      error.status = 409;
      error.code = 'catalog_product_readback_mismatch';
      error.mismatches = mismatches;
      throw error;
    }
    return {
      productId: id,
      fields: expected,
      confirmedFields: Object.keys(expected),
      mutationId: receipt.lastAdminMutationId,
      confirmedAt: changedAt,
      rev: saved?.value?.rev,
      modified: saved?.modified === true,
      idempotent: saved?.modified !== true,
    };
  };
}

export function createCatalogProductFieldRoute({
  respond,
  isAdmin,
  text,
  sessionOf,
  saveFields,
} = {}) {
  return async function catalogProductFieldRoute(req, url) {
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    if (typeof saveFields !== 'function') return respond({ ok: false, error: 'Trwały zapis kartoteki nie jest dostępny.' }, 503);
    const body = await req.json().catch(() => ({}));
    try {
      const result = await saveFields({
        productId: text(body.productId, 100),
        fields: body.fields,
        mutationId: text(body.mutationId, 160),
        actor: text(sessionOf(req)?.email || 'administrator', 200),
        area: text(body.area || 'allegro-preparation', 80),
      });
      return respond({ ok: true, confirmed: true, ...result });
    } catch (error) {
      return respond({
        ok: false,
        confirmed: false,
        error: text(error?.message || error, 1000),
        code: error?.code || 'catalog_product_save_failed',
        mismatches: Array.isArray(error?.mismatches) ? error.mismatches : undefined,
      }, Number(error?.status) || 500);
    }
  };
}
