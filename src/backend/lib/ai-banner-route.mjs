export function createAiBannerRoute({ generator, isAdmin, rateLimit, respond, configured = () => false, model = () => 'gpt-image-2' } = {}) {
  if (!generator || typeof isAdmin !== 'function' || typeof respond !== 'function') throw new Error('Trasa bannerów AI wymaga zależności.');
  return async function aiBannerRoute(req, url, action) {
    if (action === 'ai-banner-image') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const asset = await generator.asset(url.searchParams.get('id'));
      if (!asset?.base64 || asset.mime !== 'image/webp') return respond({ ok: false, error: 'Nie znaleziono grafiki.', code: 'image_missing' }, 404);
      const etag = `"${asset.sha256}"`;
      if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: { etag, 'cache-control': 'public, max-age=31536000, immutable' } });
      return new Response(Buffer.from(asset.base64, 'base64'), { status: 200, headers: { 'content-type': asset.mime, 'content-length': String(asset.bytes || 0), 'cache-control': 'public, max-age=31536000, immutable', etag, 'x-content-type-options': 'nosniff' } });
    }
    if (action === 'ai-banner-assets') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const assets = await generator.list();
      return respond({ ok: true, configured: !!configured(), model: model(), ...assets });
    }
    if (action === 'ai-banner-generate') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const limited = rateLimit?.(req, 'ai-banner-generate', 12, 60 * 60 * 1000); if (limited) return limited;
      const body = await req.json().catch(() => ({})), asset = await generator.generate(body);
      return respond({ ok: true, generated: true, asset });
    }
    if (action === 'ai-banner-delete') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({})), deleted = await generator.deleteAsset(body.id);
      return respond({ ok: true, deleted });
    }
    return null;
  };
}
