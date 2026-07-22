import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

test('CI uruchamia prawdziwe Chromium po zwykłej bramce jakości', async () => {
  const workflow = await read('.github/workflows/ci.yml');
  assert.match(workflow, /browser:\n[\s\S]*needs: verify/);
  assert.match(workflow, /playwright install --with-deps chromium/);
  assert.match(workflow, /npm run test:e2e/);
  assert.match(workflow, /playwright-report/);
});

test('Playwright zachowuje materiał diagnostyczny tylko przy błędach', async () => {
  const config = await read('playwright.config.mjs');
  assert.match(config, /trace: 'retain-on-failure'/);
  assert.match(config, /screenshot: 'only-on-failure'/);
  assert.match(config, /video: 'retain-on-failure'/);
  assert.match(config, /name: 'chromium'/);
});

test('scenariusze obejmują sklep, koszyk, telefon i panel administratora', async () => {
  const scenarios = await read('tests/e2e/storefront.spec.mjs');
  assert.match(scenarios, /waitForCatalog/);
  assert.match(scenarios, /#cartCount/);
  assert.match(scenarios, /setViewportSize/);
  assert.match(scenarios, /#loginForm/);
  assert.match(scenarios, /\.admin-page/);
});

test('akcje publicznego katalogu zachowują tekstowe identyfikatory produktów', async () => {
  const catalog = await read('src/frontend/06b-storefront-catalog.js');
  const cart = await read('src/frontend/17-cart-and-checkout.js');
  assert.match(catalog, /dodajZKarty\(\$\{jsArg\(p\.id\)\}/);
  assert.match(catalog, /przelaczUlubione\(\$\{jsArg\(p\.id\)\}/);
  assert.doesNotMatch(catalog, /dodajZKarty\(\$\{p\.id\}/);
  assert.match(cart, /function tenSamProdukt/);
  assert.match(cart, /produkty\.find\(p=>tenSamProdukt\(p\.id,x\.id\)\)/);
});
