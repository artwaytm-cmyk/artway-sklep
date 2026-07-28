import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildStorefrontSeoCatalogSnapshot } from '../src/backend/lib/domain/storefront-seo-catalog.mjs';
import { renderPublicCompliancePage, PUBLIC_COMPLIANCE_PAGES } from '../scripts/public-compliance-pages.mjs';

test('sitemap i serwerowy rendering SEO korzystają z jednej centralnej kartoteki produktów', async () => {
  const [sitemap, renderer] = await Promise.all([
    readFile('src/backend/sitemap.mjs', 'utf8'),
    readFile('src/backend/lib/domain/storefront-seo-renderer.mjs', 'utf8'),
  ]);
  assert.match(sitemap, /loadStorefrontSeoCatalog/);
  assert.match(renderer, /loadStorefrontSeoCatalog/);
  assert.doesNotMatch(renderer, /mergeCatalogProducts/);
});

test('centralna kartoteka ma pierwszeństwo, a sitemap nie publikuje produktów ukrytych lub niedostępnych', () => {
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
  assert.deepEqual(snapshot.indexableProducts.map((product) => product.id), ['active']);
  assert.equal(snapshot.pageProducts.find((product) => product.id === 'paused').__saleUnavailable, true);
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
  const renderer = await readFile('src/backend/lib/domain/storefront-seo-renderer.mjs', 'utf8');
  assert.match(renderer, /shippingDetails/);
  assert.match(renderer, /Paczkomat lub PaczkoPunkt InPost/);
  assert.match(renderer, /Kurier InPost/);
  assert.match(renderer, /hasMerchantReturnPolicy/);
  assert.match(renderer, /MerchantReturnFiniteReturnWindow/);
  assert.match(renderer, /merchantReturnDays: 14/);
  assert.match(renderer, /ReturnFeesCustomerResponsibility/);
  assert.match(renderer, /ratingCount < 1/);
});
