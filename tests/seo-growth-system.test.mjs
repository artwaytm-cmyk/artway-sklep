import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { seoAnalyticsInternals } from '../netlify/functions/lib/domain/seo-analytics.mjs';
import { seoRouteMatches, seoSlug } from '../netlify/functions/lib/domain/storefront-seo-renderer.mjs';

test('czyste adresy produktów, kategorii i ofert specjalnych mają rendering serwerowy', async () => {
  assert.equal(seoRouteMatches('/produkt/20'), true);
  assert.equal(seoRouteMatches('/kategoria/gry-edukacyjne'), true);
  assert.equal(seoRouteMatches('/promocje'), true);
  assert.equal(seoRouteMatches('/admin/seo'), false);
  assert.equal(seoSlug('Gry zręcznościowe'), 'gry-zrecznosciowe');
  const [server, nginx] = await Promise.all([readFile('server.mjs', 'utf8'), readFile('ops/nginx/artway-seo-pages.conf', 'utf8')]);
  assert.match(server, /renderStorefrontSeoPage/);
  assert.match(nginx, /produkt\|kategoria/);
  assert.match(nginx, /api\/seo/);
});

test('anonimowy pomiar SEO sumuje kanały bez danych klientów', () => {
  const state = { version: 1, days: {}, updatedAt: null }, now = new Date('2026-07-18T12:00:00Z');
  assert.equal(seoAnalyticsInternals.incrementState(state, { event: 'landing', channel: 'google' }, now), true);
  assert.equal(seoAnalyticsInternals.incrementState(state, { event: 'add_to_cart', channel: 'google', productId: '20' }, now), true);
  assert.equal(seoAnalyticsInternals.incrementState(state, { event: 'order', channel: 'google', value: 129.99 }, now), true);
  assert.equal(seoAnalyticsInternals.incrementState(state, { event: 'landing', channel: 'paid_ads' }, now), false);
  const report = seoAnalyticsInternals.performance(state, 30);
  assert.equal(report.totals.landing, 1);
  assert.equal(report.totals.add_to_cart, 1);
  assert.equal(report.totals.order, 1);
  assert.equal(report.totals.revenue, 129.99);
  assert.equal(report.products[0].productId, '20');
  assert.match(report.privacy, /bez adresów IP/);
  assert.ok(!JSON.stringify(state).includes('email'));
});

test('raport sprzedaży organicznej nie jest publicznym endpointem', async () => {
  const source = await readFile('netlify/functions/lib/domain/seo-analytics.mjs', 'utf8');
  assert.match(source, /if \(!adminRequest\(request\)\).*status: 401/);
  assert.match(source, /timingSafeEqual/);
});

test('mapa, feed i panel wykorzystują komplet bezpłatnych mechanizmów', async () => {
  const [sitemap, feed, frontend, analytics, timer] = await Promise.all([
    readFile('netlify/functions/sitemap.mjs', 'utf8'),
    readFile('netlify/functions/google-products.mjs', 'utf8'),
    readFile('src/frontend/09-seo.js', 'utf8'),
    readFile('src/frontend/09a-seo-analytics.js', 'utf8'),
    readFile('ops/systemd/artway-seo-daily.timer', 'utf8'),
  ]);
  assert.match(sitemap, /xmlns:image/);
  assert.match(sitemap, /\/kategoria\//);
  assert.match(feed, /g:canonical_link/);
  assert.match(feed, /g:additional_image_link/);
  assert.match(frontend, /Ruch i sprzedaż z wyszukiwarek/);
  assert.match(frontend, /HTML produktów dla Google/);
  assert.match(analytics, /wyłącznie dzienne sumy/i);
  assert.match(timer, /OnCalendar=\*-\*-\* 04:15:00 Europe\/Warsaw/);
});
