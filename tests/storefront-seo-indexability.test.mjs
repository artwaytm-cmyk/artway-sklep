import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildStorefrontSeoCatalogSnapshot } from '../src/backend/lib/domain/storefront-seo-catalog.mjs';
import { renderPublicCompliancePage, PUBLIC_COMPLIANCE_PAGES } from '../scripts/public-compliance-pages.mjs';
import { renderStorefrontSeoPage, seoRouteMatches } from '../src/backend/lib/domain/storefront-seo-renderer.mjs';

test('sitemap i serwerowy rendering SEO korzystają z jednej centralnej kartoteki produktów', async () => {
  const [sitemap, renderer] = await Promise.all([
    readFile('src/backend/sitemap.mjs', 'utf8'),
    readFile('src/backend/lib/domain/storefront-seo-renderer.mjs', 'utf8'),
  ]);
  assert.match(sitemap, /loadStorefrontSeoCatalog/);
  assert.match(renderer, /loadStorefrontSeoCatalog/);
  assert.doesNotMatch(renderer, /mergeCatalogProducts/);
});

test('centralna kartoteka ma pierwszeństwo, a czasowo niedostępny produkt zachowuje indeksowalną kartę', () => {
  const snapshot = buildStorefrontSeoCatalogSnapshot({
    data: {
      artway_produkty_dodane: [{ id: 'legacy', nazwa: 'Stara kopia', cena: 10 }],
      artway_produkty_ukryte: ['hidden'],
    },
    updatedAt: '2026-07-28T01:00:00Z',
    canonicalProducts: [
      { id: 'active', nazwa: 'Aktywny', cena: 49, _catalog: { availability: { saleAvailable: true } } },
      { id: 'paused', nazwa: 'Wstrzymany', cena: 59, _catalog: { availability: { saleAvailable: false } } },
      { id: 'hidden', nazwa: 'Ukryty', cena: 69, _catalog: { availability: { saleAvailable: true } } },
    ],
  });
  assert.equal(snapshot.source, 'central-postgres');
  assert.deepEqual(snapshot.pageProducts.map((product) => product.id), ['active', 'paused']);
  assert.deepEqual(snapshot.indexableProducts.map((product) => product.id), ['active', 'paused']);
  assert.deepEqual(snapshot.sellableProducts.map((product) => product.id), ['active']);
  assert.equal(snapshot.pageProducts.find((product) => product.id === 'paused').__saleUnavailable, true);
});

test('identyczny silny identyfikator daje jedną kartę kanoniczną w mapie i feedzie', () => {
  const snapshot = buildStorefrontSeoCatalogSnapshot({
    canonicalProducts: [
      { id: '10', nazwa: 'Gra A', cena: 20, ean: '5901234123457', zdjecie: '/a.jpg', opis: 'Pełny opis produktu.' },
      { id: '20', nazwa: 'Gra A kopia', cena: 20, ean: '5901234123457', zdjecie: '/a.jpg' },
    ],
  });
  assert.equal(snapshot.duplicateGroups, 1);
  assert.equal(snapshot.indexableProducts.length, 1);
  assert.equal(snapshot.duplicateCanonicalById.size, 1);
});

test('strona główna i każda strona informacyjna mają dokładnie jeden samodzielny canonical', async () => {
  const index = await readFile('index.html', 'utf8');
  assert.equal((index.match(/rel="canonical"/g) || []).length, 1);
  assert.match(index, /<link rel="canonical" href="https:\/\/artwaytm\.pl\/">/);
  for (const page of PUBLIC_COMPLIANCE_PAGES) {
    const html = renderPublicCompliancePage(index, page);
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
    assert.ok(html.includes(`<link rel="canonical" href="https://artwaytm.pl/${page.route}/">`));
  }
});

test('dane produktów dla Google zawierają rzeczywistą dostawę i politykę zwrotów', async () => {
  const [renderer, shipping] = await Promise.all([
    readFile('src/backend/lib/domain/storefront-seo-renderer.mjs', 'utf8'),
    readFile('src/backend/lib/domain/store-shipping-config.mjs', 'utf8'),
  ]);
  assert.match(renderer, /shippingDetails/);
  assert.match(shipping, /Paczkomat® \/ PaczkoPunkt InPost/);
  assert.match(shipping, /Kurier InPost/);
  assert.match(renderer, /hasMerchantReturnPolicy/);
  assert.match(renderer, /MerchantReturnFiniteReturnWindow/);
  assert.match(renderer, /merchantReturnDays: 14/);
  assert.match(renderer, /ReturnFeesCustomerResponsibility/);
  assert.match(renderer, /ratingCount < 1/);
});

test('O nas i FAQ mają serwerową treść, własne metadata, canonical i dane uporządkowane', async () => {
  for (const path of ['/o-nas', '/faq']) assert.equal(seoRouteMatches(path), true);
  const about = await (await renderStorefrontSeoPage(new Request('https://artwaytm.pl/o-nas'))).text();
  assert.match(about, /<title>O nas – poznaj sklep Artway-TM<\/title>/);
  assert.match(about, /rel="canonical" href="https:\/\/artwaytm\.pl\/o-nas"/);
  assert.match(about, /data-server-rendered="true"/);
  assert.match(about, /"@type":"AboutPage"/);
  assert.doesNotMatch(about, /Największy wybór gier/);

  const faq = await (await renderStorefrontSeoPage(new Request('https://artwaytm.pl/faq'))).text();
  assert.match(faq, /<title>FAQ – dostawa, płatności i zwroty \| Artway-TM<\/title>/);
  assert.match(faq, /rel="canonical" href="https:\/\/artwaytm\.pl\/faq"/);
  assert.match(faq, /"@type":"FAQPage"/);
  assert.match(faq, /Jak zwrócić produkt\?/);
});

test('katalog konkursów ma serwerową treść, canonical i dane uporządkowane', async () => {
  assert.equal(seoRouteMatches('/konkursy'), true);
  const html = await (await renderStorefrontSeoPage(new Request('https://artwaytm.pl/konkursy'))).text();
  assert.match(html, /<title>Konkursy – zadania i nagrody \| Artway-TM<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/artwaytm\.pl\/konkursy"/);
  assert.match(html, /"@type":"CollectionPage"/);
  assert.match(html, /Ranking pozostaje ukryty/);
});

test('strona główna ma rendering serwerowy i aktualny kanał RSS', async () => {
  assert.equal(seoRouteMatches('/'), true);
  const html = await (await renderStorefrontSeoPage(new Request('https://artwaytm.pl/'))).text();
  assert.match(html, /data-server-rendered="true"/);
  assert.match(html, /"OnlineStore"/);
  assert.match(html, /application\/rss\+xml/);
  assert.match(html, /rel="canonical" href="https:\/\/artwaytm\.pl\/"/);
});

test('sitemap oraz konfiguracja Nginx udostępniają O nas, FAQ i konkursy jako indeksowalne adresy', async () => {
  const [sitemap, nginx] = await Promise.all([
    readFile('src/backend/sitemap.mjs', 'utf8'),
    readFile('ops/nginx/artway-seo-pages.conf', 'utf8'),
  ]);
  assert.match(sitemap, /\$\{origin\}\/o-nas/);
  assert.match(sitemap, /\$\{origin\}\/faq/);
  assert.match(sitemap, /\$\{origin\}\/konkursy/);
  assert.match(nginx, /nowosci\|konkursy\|o-nas/);
  assert.match(nginx, /produkt\|kategoria\|konkurs/);
});
