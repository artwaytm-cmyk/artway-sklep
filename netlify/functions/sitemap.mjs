import { createStoreRepository } from './lib/core/store-repository.mjs';
import { mergeCatalogProducts } from './lib/domain/catalog-quality.mjs';
import { seoSlug } from './lib/domain/seo-catalog.mjs';

const origin = 'https://artwaytm.pl';
const repository = createStoreRepository({ name: 'artway-sklep' });
const xml = (value) => String(value ?? '').replace(/[<>&'\"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const imageOf = (product = {}) => String(product.zdjecie || product.image || product.imageUrl || '').trim();

export default async () => {
  let settings = { data: {}, updated_at: null };
  try { settings = await repository.read('settings', settings); } catch (error) { /* pusta mapa nadal jest prawidłowa */ }
  const data = settings.data && typeof settings.data === 'object' ? settings.data : {};
  const hidden = new Set([...(Array.isArray(data.artway_produkty_ukryte) ? data.artway_produkty_ukryte : []), ...(Array.isArray(data.artway_produkty_definitywne) ? data.artway_produkty_definitywne : []), ...(Array.isArray(data.artway_kosz_dodane) ? data.artway_kosz_dodane.map((p) => p?.id) : [])].map(String));
  const products = mergeCatalogProducts(data).products.filter((p) => !hidden.has(String(p.id)) && Number(p.cena) > 0);
  const urls = [
    { loc: `${origin}/`, lastmod: settings.updated_at },
    { loc: `${origin}/promocje`, lastmod: settings.updated_at },
    { loc: `${origin}/nowosci`, lastmod: settings.updated_at },
    ...['kontakt', 'regulamin', 'prywatnosc', 'dostawa', 'zwroty'].map((route) => ({ loc: `${origin}/${route}/`, lastmod: settings.updated_at })),
    ...[...new Set(products.map((p) => String(p.kategoria || '').trim()).filter(Boolean))].map((category) => ({ loc: `${origin}/kategoria/${seoSlug(category)}`, lastmod: settings.updated_at })),
    ...products.map((p) => ({ loc: `${origin}/produkt/${encodeURIComponent(p.id)}`, lastmod: p.seoReviewedAt || p.updatedAt || settings.updated_at || '', image: imageOf(p), caption: p.nazwa || '' })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.map((u) => `  <url><loc>${xml(u.loc)}</loc>${u.lastmod ? `<lastmod>${xml(String(u.lastmod).slice(0, 10))}</lastmod>` : ''}${u.image ? `<image:image><image:loc>${xml(u.image)}</image:loc>${u.caption ? `<image:caption>${xml(u.caption)}</image:caption>` : ''}</image:image>` : ''}</url>`).join('\n')}\n</urlset>`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=1800' } });
};
