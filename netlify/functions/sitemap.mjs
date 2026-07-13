import { getStore } from '@netlify/blobs';

const origin = 'https://artwaytm.pl';
const xml = (value) => String(value ?? '').replace(/[<>&'\"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

export default async () => {
  let settings = { data: {}, updated_at: null };
  try { settings = await getStore({ name: 'artway-sklep', consistency: 'strong' }).get('settings', { type: 'json' }) || settings; } catch (error) { /* pusta mapa nadal jest prawidłowa */ }
  const data = settings.data && typeof settings.data === 'object' ? settings.data : {}, map = new Map();
  const add = (p = {}) => { const id = String(p.id ?? '').trim(); if (id) map.set(id, { ...(map.get(id) || {}), ...p, id }); };
  for (const p of Array.isArray(data.artway_produkty_katalog) ? data.artway_produkty_katalog : []) add(p);
  for (const p of Array.isArray(data.artway_produkty_dodane) ? data.artway_produkty_dodane : []) add(p);
  for (const [id, patch] of Object.entries(data.artway_produkty_edytowane && typeof data.artway_produkty_edytowane === 'object' ? data.artway_produkty_edytowane : {})) add({ ...(patch || {}), id });
  const hidden = new Set([...(Array.isArray(data.artway_produkty_ukryte) ? data.artway_produkty_ukryte : []), ...(Array.isArray(data.artway_produkty_definitywne) ? data.artway_produkty_definitywne : []), ...(Array.isArray(data.artway_kosz_dodane) ? data.artway_kosz_dodane.map((p) => p?.id) : [])].map(String));
  const urls = [{ loc: `${origin}/`, lastmod: settings.updated_at }];
  for (const p of map.values()) if (!hidden.has(String(p.id)) && Number(p.cena) > 0) urls.push({ loc: `${origin}/produkt/${encodeURIComponent(p.id)}`, lastmod: p.seoReviewedAt || p.updatedAt || '' });
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${xml(u.loc)}</loc>${u.lastmod ? `<lastmod>${xml(String(u.lastmod).slice(0, 10))}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=1800' } });
};
