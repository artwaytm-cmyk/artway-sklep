import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('panel ma wspólną warstwę płynnego układu bez poziomego przewijania', async () => {
  const [css, build] = await Promise.all([read('src/styles/30-admin-fluid-layout.css'), read('scripts/build-assets.mjs')]);
  assert.match(build, /src\/styles\/30-admin-fluid-layout\.css/);
  assert.match(css, /body\.admin-mode\{max-width:100%;overflow-x:clip\}/);
  assert.match(css, /table-layout:fixed/);
  assert.match(css, /overflow:visible!important/);
  assert.match(css, /repeat\(auto-fit,minmax\(min\(100%,180px\),1fr\)\)/);
  assert.doesNotMatch(css, /overflow-x:auto/);
});

test('szerokie tabele zmieniają się w opisane karty zamiast tworzyć suwak', async () => {
  const [script, css, build] = await Promise.all([
    read('src/frontend/08a-admin-responsive-layout.js'),
    read('src/styles/30-admin-fluid-layout.css'),
    read('scripts/build-assets.mjs'),
  ]);
  assert.match(build, /src\/frontend\/08a-admin-responsive-layout\.js/);
  assert.match(script, /cell\.dataset\.label=headers\[column\]/);
  assert.match(script, /MutationObserver/);
  assert.match(script, /requestIdleCallback/);
  assert.match(css, /content:attr\(data-label\)/);
  assert.match(css, /max-width:1280px/);
});

test('zakładki, filtry i statystyki zawijają się do dostępnej szerokości', async () => {
  const css = await read('src/styles/30-admin-fluid-layout.css');
  assert.match(css, /admin-main-tabs[\s\S]*flex-wrap:wrap/);
  assert.match(css, /warehouse-stock-toolbar[\s\S]*grid-template-columns:repeat\(auto-fit/);
  assert.match(css, /agent-module-groups[\s\S]*flex-wrap:wrap/);
  assert.match(css, /max-height:none;overflow:visible/);
});

test('przyciski pozostają jednoliniowe, a układ przenosi całe kontrolki do kolejnego rzędu', async () => {
  const [css, script] = await Promise.all([
    read('src/styles/30-admin-fluid-layout.css'),
    read('src/frontend/08a-admin-responsive-layout.js'),
  ]);
  assert.match(css, /white-space:nowrap!important;overflow:hidden;text-overflow:ellipsis/);
  assert.match(css, /\.btn\{min-height:40px\}/);
  assert.match(css, /select\{overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/);
  assert.match(css, /\[class\*="-actions"\][\s\S]*max-width:100%;min-width:0/);
  assert.match(css, /flex:1 1 100%;width:100%;max-width:100%/);
  assert.match(css, /@media\(max-width:560px\)/);
  assert.match(script, /control\.scrollWidth>control\.clientWidth\+1/);
  assert.match(script, /control\.setAttribute\('title',label\)/);
});

test('nazwy produktów w responsywnym katalogu pozostają we własnej kolumnie', async () => {
  const css = await read('src/styles/30-admin-fluid-layout.css');
  assert.match(css, /assortment-product-cell[\s\S]*grid-template-columns:auto minmax\(0,1fr\)/);
  assert.match(css, /assortment-product-table td\[data-label="Produkt"\]\{grid-column:1\/-1;grid-template-columns:minmax\(92px,15%\) minmax\(0,1fr\)\}/);
  assert.match(css, /assortment-product-cell[\s\S]*white-space:normal!important;overflow-wrap:anywhere/);
  assert.match(css, /assortment-data-status>span[\s\S]*overflow-wrap:anywhere/);
});
