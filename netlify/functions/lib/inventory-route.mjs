import { mergeCatalogProducts } from './domain/catalog-quality.mjs';
import { applyInventoryStockSet } from './domain/inventory.mjs';

export function createInventoryStockRoute({ isAdmin, rateLimit, readVersioned, respond, settingsLimit, text, writeIfVersion } = {}) {
  return async function inventoryStockRoute(req, url, action) {
    if (action !== 'inventory-stock-set') return null;
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    const limited = rateLimit(req, 'inventory-stock-set', 120, 60 * 60 * 1000);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const version = await readVersioned('settings', { data: {}, rev: 0, updated_at: null });
    const current = version.value || { data: {}, rev: 0, updated_at: null };
    try {
      const productId = text(body.productId || '', 120).trim();
      const catalogProduct = mergeCatalogProducts(current.data || {}).activeProducts.find((product) => String(product.id) === productId);
      if (!catalogProduct) return respond({ ok: false, error: 'Nie znaleziono kartoteki produktu w aktualnym katalogu.', code: 'inventory_product_not_found' }, 404);
      const requestId = text(body.requestId || '', 160).trim();
      const previous = requestId && Array.isArray(current.data?.artway_ruchy_magazynowe)
        ? current.data.artway_ruchy_magazynowe.find((movement) => String(movement?.sourceRequestId || '') === requestId)
        : null;
      if (previous) {
        const quantity = Number(body.quantity), mode = String(body.mode || 'set').toLowerCase();
        const requestedAfter = mode === 'increment' && previous.stanPrzed !== null ? Number(previous.stanPrzed) + quantity : quantity;
        if (String(previous.produktId || '') !== productId || !Number.isFinite(requestedAfter) || Number(previous.stanPo) !== requestedAfter) {
          return respond({ ok: false, error: 'Identyfikator żądania był już użyty dla innej korekty.', code: 'inventory_request_id_conflict' }, 409);
        }
        return respond({
          ok: true, duplicate: true, changed: false,
          product: { id: productId, name: catalogProduct.nazwa || catalogProduct.name || `Produkt ${productId}` },
          before: previous.stanPrzed ?? null, after: previous.stanPo, delta: previous.ilosc,
          movementId: previous.id || null, rev: Number(current.rev || 0), updated_at: current.updated_at || null,
        });
      }
      const mutation = applyInventoryStockSet(current, {
        ...body,
        productId, requestId,
        product: {
          name: catalogProduct.nazwa || catalogProduct.name || `Produkt ${productId}`,
          sku: catalogProduct.sku || catalogProduct.SKU || '',
          externalId: catalogProduct.externalId || catalogProduct.EXTERNAL_ID || catalogProduct.mpn || '',
          ean: catalogProduct.ean || catalogProduct.gtin || catalogProduct.EAN || catalogProduct.GTIN || '',
        },
      }, new Date());
      if (JSON.stringify(mutation.record.data || {}).length > settingsLimit) {
        return respond({ ok: false, error: 'Ustawienia są zbyt duże', code: 'settings_too_large' }, 413);
      }
      const write = await writeIfVersion('settings', mutation.record, version);
      if (!write?.modified) return respond({ ok: false, error: 'Baza zmieniła się podczas zapisu. Odczytaj aktualny stan i spróbuj ponownie.', code: 'inventory_write_conflict' }, 409);
      return respond({ ok: true, ...mutation.result });
    } catch (error) {
      return respond({
        ok: false,
        error: error?.message || 'Nie udało się zmienić stanu magazynowego.',
        code: error?.code || 'inventory_error',
        ...(error?.details || {}),
      }, Number(error?.status || 422));
    }
  };
}
