import { createImportedProductCatalog, IMPORTED_PRODUCT_CATALOG_MANIFEST_KEY } from './domain/imported-product-catalog.mjs';
import { createProductLinkImportService } from './domain/product-link-import.mjs';
import { createProductLinkImportPreparer } from './domain/product-link-import-preparation.mjs';

export function createProductLinkImportRoute({ service, catalog, sanitize = (value) => value, isAdmin, rateLimit, respond, sessionOf, text, adminEmail = () => '' } = {}) {
  if (!service || !catalog || typeof isAdmin !== 'function' || typeof respond !== 'function' || typeof text !== 'function') {
    throw new Error('Trasa importu linków wymaga serwisu, autoryzacji i odpowiedzi HTTP.');
  }
  const actions = new Set(['product-link-import-create', 'product-link-import-status', 'product-link-import-process-next', 'product-link-import-control', 'product-link-import-catalog']);
  return async function productLinkImportRoute(req, url, action) {
    if (!actions.has(action)) return null;
    if (action === 'product-link-import-catalog') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const limited = rateLimit?.(req, 'product-link-import-catalog', 600, 60 * 60 * 1000);
      if (limited) return limited;
      const result = await catalog.page({ offset: url.searchParams.get('offset'), limit: url.searchParams.get('limit') });
      const admin = isAdmin(req, url);
      const products = admin ? result.products : result.products.map((entry) => {
        const safe = sanitize(entry); delete safe.importItemKey; delete safe.createdBy; return safe;
      });
      return respond({ ok: true, products, offset: result.offset, limit: result.limit, total: result.total, nextOffset: result.nextOffset, imported_catalog_rev: result.revision });
    }
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);

    if (action === 'product-link-import-create') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const limited = rateLimit?.(req, 'product-link-import-create', 20, 24 * 60 * 60 * 1000);
      if (limited) return limited;
      const body = await req.json().catch(() => ({}));
      const session = sessionOf?.(req);
      const result = await service.create({
        fileName: text(body.fileName, 300), rows: Array.isArray(body.rows) ? body.rows : [],
        createdBy: text(session?.email || adminEmail() || 'administrator', 200),
      });
      return respond({ ok: true, ...result }, 201);
    }
    if (action === 'product-link-import-status') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const jobId = text(url.searchParams.get('jobId'), 180).trim();
      if (!jobId) return respond({ ok: false, error: 'Brak identyfikatora importu', code: 'validation' }, 422);
      return respond({ ok: true, ...(await service.status(jobId)) });
    }
    if (action === 'product-link-import-process-next') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const limited = rateLimit?.(req, 'product-link-import-process-next', 1500, 60 * 60 * 1000);
      if (limited) return limited;
      const body = await req.json().catch(() => ({})), jobId = text(body.jobId, 180).trim();
      if (!jobId) return respond({ ok: false, error: 'Brak identyfikatora importu', code: 'validation' }, 422);
      return respond({ ok: true, ...(await service.processNext(jobId)) });
    }

    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    const body = await req.json().catch(() => ({})), jobId = text(body.jobId, 180).trim(), command = text(body.command, 40).trim().toLowerCase();
    if (!jobId) return respond({ ok: false, error: 'Brak identyfikatora importu', code: 'validation' }, 422);
    const methods = { pause: 'pause', resume: 'resume', cancel: 'cancel', retry_failures: 'retryFailures' };
    const method = methods[command];
    if (!method) return respond({ ok: false, error: 'Nieprawidłowe polecenie sterujące importem', code: 'validation' }, 422);
    return respond({ ok: true, ...(await service[method](jobId)) });
  };
}

export async function productLinkImportedCatalogPayload({ catalog, manifest, requestedRev = '', admin = false, sanitize = (value) => value } = {}) {
  const revision = String(manifest?.updatedAt || `catalog-${Number(manifest?.count) || 0}`).slice(0, 100);
  return { imported_catalog_rev: revision, imported_catalog_count: Math.max(0, Number(manifest?.count) || 0) };
}

export function createProductLinkImportBundle(options = {}) {
  const catalog = createImportedProductCatalog({ read: options.read, readVersioned: options.readVersioned, writeIfVersion: options.writeIfVersion });
  const prepareProduct = createProductLinkImportPreparer({ ...options.preparation, catalog });
  const service = createProductLinkImportService({ read: options.read, readVersioned: options.readVersioned, writeIfVersion: options.writeIfVersion, catalog, prepareProduct });
  const route = createProductLinkImportRoute({ service, catalog, sanitize: options.sanitize, ...options.route });
  return Object.freeze({
    catalog, route,
    async mergeSettings(data = {}) {
      const imported = await catalog.list(), added = Array.isArray(data.artway_produkty_dodane) ? data.artway_produkty_dodane : [], ids = new Set(added.map((product) => String(product?.id)));
      return { ...data, artway_produkty_dodane: [...added, ...imported.filter((product) => !ids.has(String(product?.id)))] };
    },
    async payload({ requestedRev, admin }) {
      const manifest = await options.read(IMPORTED_PRODUCT_CATALOG_MANIFEST_KEY, { count: 0, updatedAt: null });
      return productLinkImportedCatalogPayload({ catalog, manifest, requestedRev, admin, sanitize: options.sanitize });
    },
  });
}
