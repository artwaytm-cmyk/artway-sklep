import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const source=(file)=>readFile(path.join(root,file),'utf8');

test('aktualizacja, publikacja i diagnostyka są jednym Centrum systemu',async()=>{
  const [menu,navigation,router,system,legacy]=await Promise.all([
    source('src/frontend/07-admin-shipping.js'),source('src/frontend/08-admin-navigation.js'),source('src/frontend/06-router-and-storefront.js'),source('src/frontend/16-diagnostics.js'),source('src/frontend/15d-publication-and-export.js')
  ]);
  assert.match(menu,/"\/admin\/system","🛠️","Centrum systemu"/);
  assert.doesNotMatch(menu,/"\/admin\/aktualizacja"/);
  assert.doesNotMatch(menu,/"\/admin\/publikacja"/);
  assert.match(navigation,/function systemSubnavHTML/);
  for(const route of ['#/admin/system','#/admin/system/diagnostyka','#/admin/system/logi','#/admin/system/kopie'])assert.ok(navigation.includes(route));
  assert.match(router,/t\.startsWith\("\/admin\/aktualizacja"\)\|\|t\.startsWith\("\/admin\/publikacja"\)/);
  assert.match(router,/widokAdminSystem\("status"\)/);
  assert.match(system,/function widokAdminSystem/);
  assert.doesNotMatch(legacy,/function widokAdminAktualizacja|function widokAdminPublikacja|site-publish|site-rollback/);
});

test('przycisk przeglądarki pobiera pełne wydanie bez kasowania danych',async()=>{
  const [system,worker,releaseManager]=await Promise.all([source('src/frontend/16-diagnostics.js'),source('sw.js'),source('scripts/lib/atomic-release-manager.mjs')]);
  assert.match(system,/fetch\(`\/release\.json\?ts=/);
  assert.match(system,/registration\?\.update\(\)/);
  assert.match(system,/keys\.filter\(key=>key\.startsWith\("artway-"\)\)/);
  assert.match(system,/setTimeout\(\(\)=>location\.reload\(\),350\)/);
  assert.doesNotMatch(system,/systemPobierzNajnowszaWersje[\s\S]{0,1800}localStorage\.clear\(/);
  assert.match(worker,/CLEAR_APP_CACHE/);
  assert.match(worker,/SKIP_WAITING/);
  assert.match(releaseManager,/stampBrowserRelease\(stagingDir, id\)/);
  assert.match(releaseManager,/artway-admin-\$\{releaseId\}/);
});
