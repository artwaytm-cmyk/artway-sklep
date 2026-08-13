import { seoSlug } from './lib/domain/seo-catalog.mjs';
import { loadStorefrontSeoContests } from './lib/domain/storefront-contest-seo.mjs';
import { loadStorefrontSeoCatalog } from './lib/domain/storefront-seo-catalog.mjs';

const origin = 'https://artwaytm.pl';
const xml = (value) => String(value ?? '').replace(/[<>&'\"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const imageOf = (product = {}) => String(product.zdjecie || product.image || product.imageUrl || '').trim();
const contentLastmod = (product = {}) => product.seoContentUpdatedAt || product.contentUpdatedAt || product.updatedAt || product.createdAt || '';

export default async () => {
  const catalog = await loadStorefrontSeoCatalog();
  const contests = await loadStorefrontSeoContests();
  const products = catalog.indexableProducts;
  const categorySlugs = new Set(['promocje', 'nowosci']);
  const urls = [
    { loc: `${origin}/` },
    { loc: `${origin}/promocje` },
    { loc: `${origin}/nowosci` },
    { loc: `${origin}/konkursy` },
    { loc: `${origin}/o-nas` },
    { loc: `${origin}/faq` },
    ...contests.map((contest) => ({ loc: `${origin}/konkurs/${encodeURIComponent(contest.slug)}`, lastmod: contest.endsAt || contest.startsAt || '' })),
    ...['kontakt', 'regulamin', 'prywatnosc', 'dostawa', 'zwroty'].map((route) => ({ loc: `${origin}/${route}/` })),
    ...[...new Set(products.map((p) => String(p.kategoria || '').trim()).filter(Boolean))]
      .filter((category) => !categorySlugs.has(seoSlug(category)))
      .map((category) => ({ loc: `${origin}/kategoria/${seoSlug(category)}` })),
    ...products.map((p) => ({ loc: `${origin}/produkt/${encodeURIComponent(p.id)}`, lastmod: contentLastmod(p), image: imageOf(p), caption: p.nazwa || '' })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.map((u) => `  <url><loc>${xml(u.loc)}</loc>${u.lastmod ? `<lastmod>${xml(String(u.lastmod).slice(0, 10))}</lastmod>` : ''}${u.image ? `<image:image><image:loc>${xml(u.image)}</image:loc>${u.caption ? `<image:caption>${xml(u.caption)}</image:caption>` : ''}</image:image>` : ''}</url>`).join('\n')}\n</urlset>`;
  return new Response(body, { headers: {
    'content-type': 'application/xml; charset=utf-8',
    'cache-control': 'public, max-age=1800, stale-while-revalidate=3600',
    'x-artway-urls': String(urls.length),
    'x-artway-products': String(products.length),
    'x-artway-out-of-stock': String(products.filter((product) => product.__saleUnavailable === true).length),
    'x-artway-canonicalized-duplicate-groups': String(catalog.duplicateGroups || 0),
  } });
};
