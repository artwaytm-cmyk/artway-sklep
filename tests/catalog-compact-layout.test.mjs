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

test('karta produktu korzysta z czterech logicznych stref wzorcowego centrum', async () => {
  const [css,script] = await Promise.all([read('src/styles/29-commerce-catalog-actions.css'),read('src/frontend/12-warehouse-views.js')]);
  assert.match(script, /allegro-publication-card catalog-product-card/);
  assert.match(script, /catalog-product-identity/);
  assert.match(script, /catalog-product-readiness/);
  assert.match(script, /catalog-product-operational-data/);
  assert.match(script, /catalog-product-actions/);
  assert.match(css, /grid-template-columns:minmax\(300px,1\.35fr\) minmax\(190px,\.8fr\) minmax\(255px,1\.05fr\) minmax\(270px,1\.1fr\)/);
  assert.match(css, /\.catalog-product-identity h3\{overflow-wrap:break-word;word-break:normal\}/);
  assert.match(css, /\.catalog-product-buttons>\.btn\{width:auto;white-space:nowrap\}/);
  assert.match(css, /@container\(max-width:820px\)\{\.catalog-product-list \.catalog-product-card\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /@container\(max-width:520px\)\{\.catalog-product-card \.catalog-product-operational-data\{grid-template-columns:minmax\(0,1fr\)/);
});
