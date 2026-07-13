import { getStore } from '@netlify/blobs';
import { mergeCatalogProducts } from './lib/domain/catalog-quality.mjs';

const origin = 'https://artwaytm.pl';
const xml = (value) => String(value ?? '').replace(/[<>&'\"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
function productIsUnavailable(product, availability = {}) {
  const record = availability?.[String(product?.id)] || availability?.[product?.id] || null;
  if (!record) return false;
  const decision = String(record.decision || record.decyzja || '').toLowerCase();
  if (decision === 'manual_available') return false;
  if (decision === 'grace') {
    const expires = Date.parse(record.expiresAt || record.waznaDo || '');
    return Number.isFinite(expires) && expires <= Date.now();
  }
  return String(record.status || '').toLowerCase() === 'niedostepny';
}

export default async () => {
  let settings = { data: {}, updated_at: null };
  try { settings = await getStore({ name: 'artway-sklep', consistency: 'strong' }).get('settings', { type: 'json' }) || settings; } catch (error) { /* pusta mapa nadal jest prawidłowa */ }
  const data = settings.data && typeof settings.data === 'object' ? settings.data : {};
  const availability = data.artway_dostepnosc && typeof data.artway_dostepnosc === 'object' ? data.artway_dostepnosc : {};
  const hidden = new Set([...(Array.isArray(data.artway_produkty_ukryte) ? data.artway_produkty_ukryte : []), ...(Array.isArray(data.artway_produkty_definitywne) ? data.artway_produkty_definitywne : []), ...(Array.isArray(data.artway_kosz_dodane) ? data.artway_kosz_dodane.map((p) => p?.id) : [])].map(String));
  const urls = [{ loc: `${origin}/`, lastmod: settings.updated_at }];
  for (const p of mergeCatalogProducts(data).products) if (!hidden.has(String(p.id)) && !productIsUnavailable(p, availability) && Number(p.cena) > 0) urls.push({ loc: `${origin}/produkt/${encodeURIComponent(p.id)}`, lastmod: p.seoReviewedAt || p.updatedAt || '' });
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${xml(u.loc)}</loc>${u.lastmod ? `<lastmod>${xml(String(u.lastmod).slice(0, 10))}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=1800' } });
};
