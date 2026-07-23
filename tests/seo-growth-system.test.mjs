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

test('druga domena przekazuje sygnały SEO i zachowuje anonimowe źródło wejścia', async () => {
  const nginx = await readFile('ops/nginx/artway-production.conf', 'utf8');
  assert.match(nginx, /server_name allsklep\.pl www\.allsklep\.pl/);
  assert.match(nginx, /return 301 https:\/\/artwaytm\.pl\$uri\?entry_domain=allsklep\.pl&\$args/);
});

test('anonimowy pomiar SEO sumuje kanały bez danych klientów', () => {
  const state = { version: 1, days: {}, updatedAt: null }, now = new Date('2026-07-18T12:00:00Z');
  assert.equal(seoAnalyticsInternals.incrementState(state, { event: 'landing', channel: 'google', entryDomain: 'allsklep.pl', landingPath: '/produkt/20?ignored=1', campaign: 'Lato_2026', referrerDomain: 'google.pl' }, now), true);
  assert.equal(seoAnalyticsInternals.incrementState(state, { event: 'add_to_cart', channel: 'google', entryDomain: 'allsklep.pl', productId: '20' }, now), true);
  assert.equal(seoAnalyticsInternals.incrementState(state, { event: 'order', channel: 'google', entryDomain: 'allsklep.pl', value: 129.99 }, now), true);
  assert.equal(seoAnalyticsInternals.incrementState(state, { event: 'landing', channel: 'paid_ads' }, now), false);
  const report = seoAnalyticsInternals.performance(state, 30);
  assert.equal(report.totals.landing, 1);
  assert.equal(report.totals.add_to_cart, 1);
  assert.equal(report.totals.order, 1);
  assert.equal(report.totals.revenue, 129.99);
  assert.equal(report.products[0].productId, '20');
  assert.equal(report.domains['allsklep.pl'].landing, 1);
  assert.equal(report.domains['allsklep.pl'].order, 1);
  assert.equal(report.landingPages[0].path, '/produkt/20');
  assert.equal(report.campaigns[0].campaign, 'lato_2026');
  assert.match(report.privacy, /bez adresów IP/);
  assert.ok(!JSON.stringify(state).includes('email'));
});

test('historyczny ruch sprzed podziału domen pozostaje przypisany do domeny głównej', () => {
  const state = { version: 1, days: { '2026-07-18': { totals: { landing: 4, product_view: 2, add_to_cart: 1, order: 1, revenue: 50 }, channels: {}, products: {} } }, updatedAt: null };
  const report = seoAnalyticsInternals.performance(state, 30);
  assert.equal(report.domains['artwaytm.pl'].landing, 4);
  assert.equal(report.domains['artwaytm.pl'].revenue, 50);
  assert.equal(report.domains['allsklep.pl'].landing, 0);
});

test('raport efektywności filtruje każdy dzień, domenę i kanał bez mieszania wyników', () => {
  const state = { version: 3, days: {}, updatedAt: null, granularSince: null };
  const events = [
    ['2026-07-19T10:00:00Z', { event: 'landing', channel: 'google', entryDomain: 'artwaytm.pl', landingPath: '/produkt/10', productId: '10' }],
    ['2026-07-19T10:01:00Z', { event: 'product_view', channel: 'google', entryDomain: 'artwaytm.pl', productId: '10' }],
    ['2026-07-19T10:02:00Z', { event: 'add_to_cart', channel: 'google', entryDomain: 'artwaytm.pl', productId: '10' }],
    ['2026-07-19T10:03:00Z', { event: 'order', channel: 'google', entryDomain: 'artwaytm.pl', value: 80, items: [{ productId: '10', units: 2, revenue: 70 }] }],
    ['2026-07-20T11:00:00Z', { event: 'landing', channel: 'referral', entryDomain: 'allsklep.pl', landingPath: '/promocje', referrerDomain: 'partner.example' }],
    ['2026-07-20T11:01:00Z', { event: 'order', channel: 'referral', entryDomain: 'allsklep.pl', value: 120 }],
  ];
  for (const [at, event] of events) assert.equal(seoAnalyticsInternals.incrementState(state, event, new Date(at)), true);

  const exactDay = seoAnalyticsInternals.performance(state, { from: '2026-07-19', to: '2026-07-19' });
  assert.equal(exactDay.range.days, 1);
  assert.equal(exactDay.timeline.length, 1);
  assert.equal(exactDay.totals.order, 1);
  assert.equal(exactDay.totals.revenue, 80);
  assert.equal(exactDay.totals.orderRate, 100);
  assert.equal(exactDay.products[0].orders, 1);
  assert.equal(exactDay.products[0].units, 2);
  assert.equal(exactDay.products[0].revenue, 70);

  const marketingReferral = seoAnalyticsInternals.performance(state, { from: '2026-07-19', to: '2026-07-21', domain: 'allsklep.pl', channel: 'referral' });
  assert.equal(marketingReferral.timeline.length, 3);
  assert.equal(marketingReferral.totals.landing, 1);
  assert.equal(marketingReferral.totals.order, 1);
  assert.equal(marketingReferral.totals.revenue, 120);
  assert.equal(marketingReferral.landingPages[0].path, '/promocje');
  assert.equal(marketingReferral.referrers[0].referrerDomain, 'partner.example');
  assert.equal(marketingReferral.domains['artwaytm.pl'].landing, 0);
});

test('raport porównuje wybrany okres z poprzednim zakresem tej samej długości', () => {
  const state = { version: 3, days: {}, updatedAt: null, granularSince: null };
  for (const at of ['2026-07-18T10:00:00Z', '2026-07-19T10:00:00Z', '2026-07-20T10:00:00Z']) {
    seoAnalyticsInternals.incrementState(state, { event: 'landing', channel: 'direct', entryDomain: 'artwaytm.pl' }, new Date(at));
  }
  const report = seoAnalyticsInternals.performance(state, { from: '2026-07-20', to: '2026-07-20' });
  assert.deepEqual(report.previous.range, { from: '2026-07-19', to: '2026-07-19', days: 1 });
  assert.equal(report.previous.totals.landing, 1);
  assert.equal(report.comparison.landing.change, 0);
});

test('raport sprzedaży organicznej nie jest publicznym endpointem', async () => {
  const source = await readFile('netlify/functions/lib/domain/seo-analytics.mjs', 'utf8');
  assert.match(source, /if \(!await adminRequest\(request\)\).*status: 401/);
  assert.match(source, /timingSafeEqual/);
});

test('mapa, feed i panel wykorzystują komplet bezpłatnych mechanizmów', async () => {
  const [sitemap, feed, frontendCore, frontendReport, analytics, timer] = await Promise.all([
    readFile('netlify/functions/sitemap.mjs', 'utf8'),
    readFile('netlify/functions/google-products.mjs', 'utf8'),
    readFile('src/frontend/09-seo.js', 'utf8'),
    readFile('src/frontend/09b-seo-effects-panel.js', 'utf8'),
    readFile('src/frontend/09a-seo-analytics.js', 'utf8'),
    readFile('ops/systemd/artway-seo-daily.timer', 'utf8'),
  ]);
  const frontend = `${frontendCore}\n${frontendReport}`;
  assert.match(sitemap, /xmlns:image/);
  assert.match(sitemap, /\/kategoria\//);
  assert.match(feed, /g:canonical_link/);
  assert.match(feed, /g:additional_image_link/);
  assert.match(frontend, /Wejścia, domeny i sprzedaż/);
  assert.match(frontend, /HTML produktów dla Google/);
  assert.match(analytics, /wyłącznie dzienne sumy/i);
  assert.match(analytics, /entry_domain/);
  assert.match(frontend, /Z którego adresu wszedł klient/);
  assert.match(timer, /OnCalendar=\*-\*-\* 04:15:00 Europe\/Warsaw/);
});
