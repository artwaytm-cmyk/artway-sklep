import { createStoreRepository } from '../netlify/functions/lib/core/store-repository.mjs';

const repository = createStoreRepository({ name: 'artway-sklep' });
const token = String(process.env.ARTWAY_ADMIN_TOKEN || '').trim();
const endpoint = String(process.env.ARTWAY_INTERNAL_ORIGIN || 'http://127.0.0.1:3000').replace(/\/$/, '');
if (!token) throw new Error('Brak ARTWAY_ADMIN_TOKEN dla dziennego automatu SEO.');

const record = await repository.read('settings', { data: {} });
const config = record?.data?.artway_seo_ustawienia || {};
const today = new Date().toISOString().slice(0, 10);
if (config.enabled === false) {
  console.log('SEO daily: automat wyłączony w panelu.');
  process.exit(0);
}
if (String(config.lastRunAt || '').startsWith(today)) {
  console.log(`SEO daily: dzisiejszy przebieg już wykonano (${config.lastRunAt}).`);
  process.exit(0);
}

async function run(action, body) {
  const response = await fetch(`${endpoint}/api/store?action=${encodeURIComponent(action)}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': token }, body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${action}: HTTP ${response.status} ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

const seo = await run('seo-daily-run', { source: 'scheduled-vps-seo-daily' });
const quality = await run('catalog-quality-audit', { source: 'scheduled-vps-catalog-quality', fixSafe: true, quarantineOrphans: true });
console.log(JSON.stringify({ ok: true, seo: { processed: seo.processed, promotion: seo.promotion?.status, submitted: seo.promotion?.count }, catalog: quality.report?.summary || null }));
