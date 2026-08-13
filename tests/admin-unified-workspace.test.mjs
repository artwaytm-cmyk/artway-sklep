import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('wszystkie podstrony panelu korzystają z jednego kontraktu wizualnego', async () => {
  const [router, shell, runtime, css, build, vonHalsky] = await Promise.all([
    read('src/frontend/06-router-and-storefront.js'),
    read('src/frontend/07-admin-shipping.js'),
    read('src/frontend/08a-admin-responsive-layout.js'),
    read('src/styles/35-admin-unified-workspace.css'),
    read('scripts/build-assets.mjs'),
    read('src/frontend/11b-von-halsky-workspace.js'),
  ]);
  assert.match(shell, /admin-unified-view/);
  assert.match(vonHalsky, /von-halsky-workspace-head admin-unified-hero/);
  assert.match(shell, /data-admin-layout="unified-v2"/);
  assert.match(runtime, /window\.adminUjednolicWidok=opiszStruktureWidoku/);
  assert.match(runtime, /admin-unified-tabs/);
  assert.match(runtime, /admin-unified-hero/);
  assert.match(runtime, /\.von-halsky-workspace-head/);
  assert.match(runtime, /admin-unified-metrics/);
  assert.doesNotMatch(runtime, /'\.warehouse-dashboard-metrics'/);
  assert.match(runtime, /admin-unified-panel/);
  assert.match(router, /window\.adminUjednolicWidok\(zakres\)/);
  assert.match(css, /--admin-ui-soft:color-mix\(in srgb,var\(--brand\)/);
  assert.match(css, /\.admin-unified-tabs/);
  assert.match(css, /\.admin-unified-search/);
  assert.match(css, /table\.admin-standard-table/);
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(build, /35-admin-unified-workspace\.css/);
});

test('wspólny wzorzec nie zastępuje kolorystyki sklepu własną paletą', async () => {
  const css = await read('src/styles/35-admin-unified-workspace.css');
  assert.match(css, /var\(--brand\)/);
  assert.match(css, /var\(--panel\)/);
  assert.match(css, /var\(--line\)/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}/i);
});
