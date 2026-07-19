import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('cały panel korzysta z pełnego schematu podstron bez zmiany kolorystyki sklepu', async () => {
  const [shell, catalog, pattern, build] = await Promise.all([
    readFile('src/frontend/07-admin-shipping.js', 'utf8'),
    readFile('src/frontend/12-warehouse-views.js', 'utf8'),
    readFile('src/styles/31-admin-page-pattern.css', 'utf8'),
    readFile('scripts/build-assets.mjs', 'utf8'),
  ]);
  assert.match(shell, /admin-workspace-content admin-page-pattern/);
  assert.match(catalog, /assortment-catalog-workspace/);
  assert.match(catalog, /panel assortment-catalog-hero/);
  assert.match(catalog, /admin-pattern-metrics/);
  assert.match(catalog, /admin-pattern-surface/);
  assert.match(catalog, /admin-responsive-table assortment-product-table/);
  assert.match(catalog, /allegro-listing-catalog catalog-product-table-center/);
  assert.match(catalog, /assortment-results-toolbar allegro-listing-results-head/);
  assert.match(catalog, /assortment-bulk-editor allegro-listing-selection/);
  assert.match(catalog, /catalog-product-table-shell/);
  assert.match(catalog, /pagination allegro-listing-pagination/);
  assert.match(catalog, /data-label="Produkt"/);
  assert.match(pattern, /--admin-pattern-accent:var\(--brand\)/);
  assert.match(pattern, /allegro-listing-hero/);
  assert.match(pattern, /assortment-catalog-hero/);
  assert.match(pattern, /@container\(max-width:1180px\)/);
  assert.match(pattern, /@container\(max-width:820px\)/);
  assert.match(pattern, /@container\(max-width:520px\)/);
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
  assert.match(pattern, /\.catalog-product-table-center/);
  assert.match(pattern, /grid-template-areas:"product identifiers prices allegro"/);
  assert.match(pattern, /grid-template-areas:"product" "identifiers" "classification" "prices" "stock" "allegro" "actions"/);
  assert.match(build, /31-admin-page-pattern\.css/);
});

test('pole kodu rabatowego ma programową etykietę i bezpieczny typ przycisku', async () => {
  const html = await readFile('index.html', 'utf8');
  assert.match(html, /<label class="sr-only" for="promoInput">Kod rabatowy<\/label>/);
  assert.match(html, /<input id="promoInput" name="promo-code"/);
  assert.match(html, /<button type="button" onclick="zastosujKod\(\)">Zastosuj kod rabatowy<\/button>/);
});
