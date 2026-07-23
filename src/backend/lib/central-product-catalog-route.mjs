export function createCentralProductCatalogRoute({ catalog, isAdmin, rateLimit, respond, revisionState, synchronize } = {}) {
  return async function centralProductCatalogRoute(request, url, action) {
    if (!String(action || '').startsWith('product-catalog-')) return null;
    if (!catalog?.available) return respond({ ok: false, available: false, error: 'Centralna kartoteka wymaga PostgreSQL.', code: 'central_catalog_unavailable' }, 503);

    if (action === 'product-catalog-query') {
      if (request.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const admin = isAdmin(request, url) && url.searchParams.get('audience') !== 'public', [metaBefore, revision] = await Promise.all([catalog.metadata(), revisionState()]);
      let synchronization = null;
      if (!metaBefore.count || metaBefore.outdated) synchronization = await synchronize({ force: true, revision });
      else if (metaBefore.sourceRevision !== revision.sourceRevision) void synchronize({ revision }).catch((error) => console.error('central_product_catalog_sync', error));
      const result = await catalog.query({
        admin, query: url.searchParams.get('q'), category: url.searchParams.get('category'), categories: url.searchParams.get('categories'), ids: url.searchParams.get('ids'), special: url.searchParams.get('special'), minRating: url.searchParams.get('minRating'), producer: url.searchParams.get('producer'), status: url.searchParams.get('status'), source: url.searchParams.get('source'), stock: url.searchParams.get('stock'), allegro: url.searchParams.get('allegro'), data: url.searchParams.get('data'), sale: url.searchParams.get('sale'), promotion: url.searchParams.get('promotion'), link: url.searchParams.get('link'),
        priceMin: url.searchParams.get('priceMin'), priceMax: url.searchParams.get('priceMax'), allegroPriceMin: url.searchParams.get('allegroPriceMin'), allegroPriceMax: url.searchParams.get('allegroPriceMax'), sort: url.searchParams.get('sort'), page: url.searchParams.get('page'), limit: url.searchParams.get('limit'),
      });
      return respond({ ok: true, ...result, private: admin, stale: !synchronization?.synchronized && metaBefore.count > 0 && metaBefore.sourceRevision !== revision.sourceRevision, synchronization });
    }

    if (action === 'product-catalog-item') {
      if (request.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const admin = isAdmin(request, url) && url.searchParams.get('audience') !== 'public', product = await catalog.get(url.searchParams.get('id'), { admin });
      return product ? respond({ ok: true, product, private: admin }) : respond({ ok: false, error: 'Nie znaleziono produktu.', code: 'product_not_found' }, 404);
    }

    if (action === 'product-catalog-sync') {
      if (request.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!isAdmin(request, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const limited = rateLimit(request, 'product-catalog-sync', 12, 60 * 60 * 1000);
      if (limited) return limited;
      return respond({ ok: true, ...(await synchronize({ force: true })) });
    }

    if (action === 'product-catalog-status') {
      if (!isAdmin(request, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      return respond({ ok: true, ...(await catalog.metadata()) });
    }

    return respond({ ok: false, error: 'Nieznana operacja kartoteki.', code: 'unknown_catalog_action' }, 404);
  };
}
