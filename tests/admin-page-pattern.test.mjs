import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('cały panel korzysta z pełnego schematu podstron bez zmiany kolorystyki sklepu', async () => {
  const [shell, catalog, pattern, commerce, build] = await Promise.all([
    readFile('assets/app.js', 'utf8'),
    readFile('assets/admin.js', 'utf8'),
    readFile('src/styles/31-admin-page-pattern.css', 'utf8'),
    readFile('src/styles/29-commerce-catalog-actions.css', 'utf8'),
    readFile('scripts/build-assets.mjs', 'utf8'),
  ]);
  assert.match(shell, /admin-workspace-content admin-page-pattern/);
  assert.match(catalog, /assortment-catalog-workspace/);
  assert.match(catalog, /panel assortment-catalog-hero/);
  assert.match(catalog, /admin-pattern-metrics/);
  assert.match(catalog, /admin-pattern-surface/);
  assert.match(catalog, /allegro-listing-catalog catalog-product-card-center/);
  assert.match(catalog, /assortment-results-toolbar allegro-listing-results-head/);
  assert.match(catalog, /assortment-bulk-editor allegro-listing-selection/);
  assert.match(catalog, /allegro-publication-list catalog-product-list/);
  assert.match(catalog, /allegro-publication-card catalog-product-card/);
  assert.match(catalog, /pagination allegro-listing-pagination/);
  assert.match(catalog, /data-assortment-product-card/);
  assert.match(pattern, /--admin-pattern-accent:var\(--brand\)/);
  assert.match(pattern, /allegro-listing-hero/);
  assert.match(pattern, /assortment-catalog-hero/);
  assert.match(commerce, /@container\(max-width:1180px\)/);
  assert.match(commerce, /@container\(max-width:820px\)/);
  assert.match(commerce, /@container\(max-width:520px\)/);
  assert.match(pattern, /\.admin-pattern-table-wrap/);
  assert.match(pattern, /\.admin-pattern-card/);
  assert.match(pattern, /\.admin-pattern-filter/);
  assert.match(pattern, /\.admin-pattern-toolbar/);
  assert.match(pattern, /details>summary/);
  assert.match(pattern, /\.admin-pattern-empty/);
  assert.match(pattern, /\.admin-pattern-pagination/);
  assert.match(pattern, /\.orders-stat-grid/);
  assert.match(pattern, /\.admin-search-standard/);
  assert.match(pattern, /table tbody tr:hover/);
  assert.match(pattern, /\.catalog-product-card-center/);
  assert.match(pattern, /\.module-tabs-panel>\.admin-main-tabs\{width:100%;padding:0;border:0/);
  assert.match(commerce, /grid-template-columns:minmax\(300px,1\.35fr\) minmax\(190px,\.8fr\) minmax\(255px,1\.05fr\) minmax\(270px,1\.1fr\)/);
  assert.match(commerce, /content-visibility:auto/);
  assert.match(pattern, /\.admin-standard-table-wrap/);
  assert.match(pattern, /table\.admin-standard-table:not\(\.assortment-product-table\)/);
  assert.match(pattern, /\.catalog-product-card-center \.catalog-product-list/);
  assert.match(build, /31-admin-page-pattern\.css/);
});

test('pole kodu rabatowego ma programową etykietę i bezpieczny typ przycisku', async () => {
  const html = await readFile('index.html', 'utf8');
  assert.match(html, /<label class="sr-only" for="promoInput">Kod rabatowy<\/label>/);
  assert.match(html, /<input id="promoInput" name="promo-code"/);
  assert.match(html, /<button type="button" onclick="zastosujKod\(\)">Zastosuj kod rabatowy<\/button>/);
});
