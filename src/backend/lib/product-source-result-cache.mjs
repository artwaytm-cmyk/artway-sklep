import { tekst } from './core/http.mjs';

export function productSourceCacheKey(value = '') {
  try {
    const raw = String(value || '').trim().replace(/https\/\//gi, 'https://').replace(/http\/\//gi, 'http://');
    const url = new URL(raw);
    ['query_id', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid']
      .forEach((key) => url.searchParams.delete(key));
    url.hash = '';
    return url.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return String(value || '').trim().toLowerCase();
  }
}

function resultAliases(target = '', result = {}) {
  return [...new Set([
    target,
    result.requestedUrl,
    result.resolvedUrl,
    result.canonicalUrl,
    ...(Array.isArray(result.alternatives)
      ? result.alternatives.flatMap((item) => [item?.url, item?.product?.sourceUrl, item?.product?.producentUrl])
      : []),
  ].map(productSourceCacheKey).filter(Boolean))].slice(0, 20);
}

export function createProductSourceResultCache({ read, write, inspectLive }) {
  return async function inspectWithCache(target = '') {
    const cacheRecord = await read('product_url_cache', { items: {}, updated_at: null });
    const items = cacheRecord.items && typeof cacheRecord.items === 'object' ? { ...cacheRecord.items } : {};
    const key = productSourceCacheKey(target);
    try {
      const result = await inspectLive(target);
      const now = new Date().toISOString();
      items[key] = { key, aliases: resultAliases(target, result), fetchedAt: now, result };
      const trimmed = Object.fromEntries(Object.entries(items)
        .sort((left, right) => String(right[1]?.fetchedAt || '').localeCompare(String(left[1]?.fetchedAt || '')))
        .slice(0, 250));
      await write('product_url_cache', { items: trimmed, updated_at: now });
      return { ...result, fromCache: false, cacheSavedAt: now };
    } catch (error) {
      const cached = items[key] || Object.values(items)
        .find((item) => Array.isArray(item?.aliases) && item.aliases.includes(key));
      const ageMs = cached?.fetchedAt ? Date.now() - new Date(cached.fetchedAt).getTime() : Infinity;
      const transient = ['product_link_unavailable', 'fetch_error'].includes(String(error?.code || 'product_link_unavailable'));
      if (!cached?.result || ageMs > 30 * 86400000 || !transient) throw error;
      const previous = cached.result;
      return {
        ...previous,
        fromCache: true,
        stale: true,
        cacheSavedAt: cached.fetchedAt,
        cacheAgeHours: Math.max(0, Math.round(ageMs / 360000) / 10),
        diagnostics: {
          ...(previous.diagnostics || {}),
          cacheFallback: true,
          retryRecommended: true,
          liveFailure: {
            message: tekst(error?.message || error, 500),
            code: tekst(error?.code || '', 120),
            attempts: error?.linkDiagnostics?.attempts || [],
          },
        },
      };
    }
  };
}
