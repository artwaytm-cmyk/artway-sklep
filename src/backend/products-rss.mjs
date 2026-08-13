import { loadStorefrontSeoCatalog } from './lib/domain/storefront-seo-catalog.mjs';

const ORIGIN = 'https://artwaytm.pl';
const xml = (value) => String(value ?? '').replace(/[<>&'\"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char]));
const plain = (value, max = 500) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

function productDate(product = {}, fallback = '') {
  const raw = product.seoContentUpdatedAt || product.updatedAt || product.createdAt || product?._catalog?.syncedAt || fallback;
  const date = new Date(raw || 0);
  return Number.isFinite(date.getTime()) ? date : new Date(0);
}

export default async () => {
  const catalog = await loadStorefrontSeoCatalog();
  const items = [...catalog.sellableProducts]
    .sort((a, b) => productDate(b, catalog.updatedAt) - productDate(a, catalog.updatedAt))
    .slice(0, 100);
  const latest = items[0] ? productDate(items[0], catalog.updatedAt) : new Date();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Nowości i aktualne produkty Artway-TM</title>
    <link>${ORIGIN}/</link>
    <description>Automatyczny, bezpłatny kanał najnowszych dostępnych produktów sklepu Artway-TM.</description>
    <language>pl-PL</language>
    <lastBuildDate>${latest.toUTCString()}</lastBuildDate>
    <atom:link href="${ORIGIN}/produkty.rss" rel="self" type="application/rss+xml" />
${items.map((product) => {
    const url = `${ORIGIN}/produkt/${encodeURIComponent(product.id)}`;
    const name = plain(product.seoTitle || product.nazwa || product.name, 150) || `Produkt ${product.id}`;
    const description = plain(product.seoDescription || product.opisKrotki || product.krotkiOpis || product.opis, 600);
    return `    <item>
      <guid isPermaLink="true">${xml(url)}</guid>
      <title>${xml(name)}</title>
      <link>${xml(url)}</link>
      <description>${xml(description)}</description>
      <category>${xml(plain(product.kategoria, 120))}</category>
      <pubDate>${productDate(product, catalog.updatedAt).toUTCString()}</pubDate>
    </item>`;
  }).join('\n')}
  </channel>
</rss>`;
  return new Response(body, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=1800, stale-while-revalidate=3600',
      'x-artway-items': String(items.length),
    },
  });
};
