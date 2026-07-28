import { seoSlug } from './lib/domain/seo-catalog.mjs';
import { loadStorefrontSeoCatalog } from './lib/domain/storefront-seo-catalog.mjs';

const origin = 'https://artwaytm.pl';
const xml = (value) => String(value ?? '').replace(/[<>&'\"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const imageOf = (product = {}) => String(product.zdjecie || product.image || product.imageUrl || '').trim();

export default async () => {
  const catalog = await loadStorefrontSeoCatalog();
  const products = catalog.indexableProducts;
  const urls = [
    { loc: `${origin}/`, lastmod: catalog.updatedAt },
    { loc: `${origin}/promocje`, lastmod: catalog.updatedAt },
    { loc: `${origin}/nowosci`, lastmod: catalog.updatedAt },
    ...['kontakt', 'regulamin', 'prywatnosc', 'dostawa', 'zwroty'].map((route) => ({ loc: `${origin}/${route}/`, lastmod: catalog.updatedAt })),
    ...[...new Set(products.map((p) => String(p.kategoria || '').trim()).filter(Boolean))].map((category) => ({ loc: `${origin}/kategoria/${seoSlug(category)}`, lastmod: catalog.updatedAt })),
    ...products.map((p) => ({ loc: `${origin}/produkt/${encodeURIComponent(p.id)}`, lastmod: p.seoReviewedAt || p.updatedAt || catalog.updatedAt || '', image: imageOf(p), caption: p.nazwa || '' })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.map((u) => `  <url><loc>${xml(u.loc)}</loc>${u.lastmod ? `<lastmod>${xml(String(u.lastmod).slice(0, 10))}</lastmod>` : ''}${u.image ? `<image:image><image:loc>${xml(u.image)}</image:loc>${u.caption ? `<image:caption>${xml(u.caption)}</image:caption>` : ''}</image:image>` : ''}</url>`).join('\n')}\n</urlset>`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=1800' } });
};
