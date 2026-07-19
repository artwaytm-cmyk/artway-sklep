import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('centrum operacji katalogu nie ściska liczników do pojedynczych liter', async () => {
  const [css, script] = await Promise.all([
    read('src/styles/29-commerce-catalog-actions.css'),
    read('src/frontend/12c-commerce-catalog-actions.js'),
  ]);
  assert.match(script, /class="catalog-action-count"/);
  assert.match(script, /class="catalog-action-note"/);
  assert.match(css, /grid-template-areas:"eyebrow" "count" "controls" "note"/);
  assert.match(css, /\.catalog-action-count\{[^}]*white-space:nowrap;overflow:hidden;text-overflow:ellipsis/);
  assert.match(css, /\.product-action-advanced\{grid-template-columns:minmax\(180px,1fr\) minmax\(210px,\.8fr\)\}/);
  assert.match(css, /@container\(max-width:1100px\)\{\.catalog-management-center \.product-action-columns\{grid-template-columns:1fr\}\}/);
});

test('wiersz produktu wykorzystuje szerokość i przenosi całe kontrolki zamiast tekstu', async () => {
  const css = await read('src/styles/31-admin-page-pattern.css');
  assert.match(css, /grid-template-areas:"product identifiers prices stock allegro" "classification identifiers prices stock actions"/);
  assert.match(css, /grid-auto-rows:min-content;align-items:start/);
  assert.match(css, /\.assortment-product-cell b\{white-space:normal;overflow-wrap:break-word;word-break:normal/);
  assert.match(css, /\.assortment-row-actions \.btn\{width:auto;min-height:38px;white-space:nowrap\}/);
  assert.match(css, /td\[data-label="Akcje"\]\{grid-area:actions;align-content:start;align-self:start\}/);
});
