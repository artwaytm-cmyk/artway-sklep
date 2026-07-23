import { mergeCatalogProducts } from './domain/catalog-quality.mjs';
import { createWarehouseDocumentService } from './domain/warehouse-documents.mjs';
import { createWarehouseLocationService } from './domain/warehouse-locations.mjs';

const DOCUMENT_ACTIONS = new Map([
  ['warehouse-document-create', 'create'],
  ['warehouse-document-update', 'update'],
  ['warehouse-document-line-upsert', 'upsertLine'],
  ['warehouse-document-line-remove', 'removeLine'],
  ['warehouse-document-confirm', 'confirm'],
  ['warehouse-document-cancel', 'cancel'],
  ['warehouse-document-delete', 'deleteDraft'],
  ['warehouse-document-correction', 'createCorrection'],
]);

// Bezpośrednia korekta stanu została celowo wyłączona. Każda zmiana — także
// ręczna — przechodzi przez trwały szkic, lokalizację i osobne potwierdzenie.
// Dzięki temu żaden klient posiadający ogólny token administracyjny nie może
// ominąć rejestru decyzji przez zmianę pola `source`.
export function createInventoryStockRoute({ isAdmin, rateLimit, readVersioned, respond, sessionOf, writeIfVersion, mergeSettings, settingsLimit } = {}) {
  const documents = createWarehouseDocumentService({
    readVersioned, writeIfVersion, mergeSettings,
    catalogProducts: (data) => mergeCatalogProducts(data).products,
    settingsLimit,
  });
  const locations = createWarehouseLocationService({ readVersioned, writeIfVersion });
  return async function inventoryStockRoute(req, url, action) {
    if (action === 'warehouse-location-delete-preview' || action === 'warehouse-location-delete') {
      if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const limited = rateLimit(req, 'warehouse-locations', 300, 60 * 60 * 1000);
      if (limited) return limited;
      const body = await req.json().catch(() => ({})), actor = sessionOf?.(req)?.email || 'administrator';
      try { return respond(action.endsWith('-preview') ? await locations.preview(body) : await locations.remove(body, actor)); }
      catch (error) { return respond({ ok: false, error: error?.message || 'Nie udało się usunąć lokalizacji.', code: error?.code || 'warehouse_location_error', ...(error?.details || {}) }, Number(error?.status || 422)); }
    }
    if (action === 'warehouse-documents-list') {
      if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      if (req.method !== 'GET' && req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      try { return respond(await documents.list({ limit: url.searchParams.get('limit') || 200 })); }
      catch (error) { return respond({ ok: false, error: error?.message || 'Nie udało się pobrać dokumentów.', code: error?.code || 'warehouse_document_error', ...(error?.details || {}) }, Number(error?.status || 422)); }
    }
    const documentMethod = DOCUMENT_ACTIONS.get(action);
    if (documentMethod) {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const limited = rateLimit(req, 'warehouse-documents', 2000, 60 * 60 * 1000);
      if (limited) return limited;
      const body = await req.json().catch(() => ({})), actor = sessionOf?.(req)?.email || 'administrator';
      try { return respond(await documents[documentMethod](body, actor)); }
      catch (error) { return respond({ ok: false, error: error?.message || 'Nie udało się zapisać dokumentu.', code: error?.code || 'warehouse_document_error', ...(error?.details || {}) }, Number(error?.status || 422)); }
    }
    if (action !== 'inventory-stock-set') return null;
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    const limited = rateLimit(req, 'inventory-stock-set', 30, 60 * 60 * 1000);
    if (limited) return limited;
    return respond({
      ok: false,
      error: 'Bezpośrednia zmiana stanu jest wyłączona. Utwórz decyzję, wskaż lokalizację i potwierdź ją osobno.',
      code: 'inventory_decision_required',
    }, 409);
  };
}
