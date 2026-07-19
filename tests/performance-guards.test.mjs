import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('ciężka synchronizacja działa co 15 minut i nie odświeża widoku bez zmian', async () => {
  const cloud = await readFile('src/frontend/03-cloud-sync.js', 'utf8');
  const shipping = await readFile('src/frontend/07-admin-shipping.js', 'utf8');
  const allegro = await readFile('src/frontend/11-allegro-refresh-runtime.js', 'utf8');
  assert.match(cloud, /const CHMURA_AUTO_SYNC_MS = 15\*60\*1000;/);
  assert.match(cloud, /const CHMURA_FOCUS_SYNC_MIN_MS = 5\*60\*1000;/);
  assert.match(cloud, /if\(localStorage\.getItem\(klucz\)===serial\)zmieniono=false;/);
  assert.match(shipping, /if\(powod!=="timer"&&teraz-chmuraAutoSyncOstatniStart<CHMURA_FOCUS_SYNC_MIN_MS\)return false;/);
  assert.match(shipping, /if\(daneZmienione\)\{\s*zastosujUstawienia\(\); zbudujProdukty\(\);/);
  assert.match(allegro, /daneZmienione=ok&&przedWersja!==allegroWersjaDanychDoOdswiezenia\(\)/);
  assert.match(allegro, /return !!daneZmienione;/);
});

test('router scala szybkie renderowania i nie skanuje wielokrotnie całego DOM', async () => {
  const router = await readFile('src/frontend/06-router-and-storefront.js', 'utf8');
  assert.match(router, /if\(renderowanieWidoku\)\{renderPonowniePoBiezacym=true;return;\}/);
  assert.match(router, /current\.isEqualNode\(next\)/);
  assert.match(router, /const keyed=new Map\(\);/);
  assert.match(router, /function zaplanujRenderPoWpisaniu\(opoznienie=180\)/);
  assert.match(router, /admin-workspace-content/);
  assert.match(router, /ADMIN_CACHE_PODSTRON_MAX_LACZNIE=24000/);
  assert.match(router, /currentContainer\?\.appendChild\(nextWorkspace\.cloneNode\(true\)\)/);
  assert.doesNotMatch(router, /else current\.appendChild\(nextWorkspace\.cloneNode\(true\)\)/);
});

test('powtórne wejście do panelu pobiera tylko rewizję zamiast wielomegabajtowego snapshotu', async () => {
  const [cloud, backend] = await Promise.all([
    readFile('src/frontend/03-cloud-sync.js', 'utf8'),
    readFile('netlify/functions/lib/store-app.mjs', 'utf8'),
  ]);
  assert.match(cloud, /settingsRev:lokalnaRewizja/);
  assert.match(backend, /settings_unchanged: true/);
  assert.match(backend, /key !== 'artway_produkty_katalog'/);
  assert.match(backend, /requestedSettingsRev === rev/);
  const pullStart=backend.indexOf("if (action === 'pull' || action === 'store-data')"),pullEnd=backend.indexOf("if (action === 'settings')",pullStart),pullRoute=backend.slice(pullStart,pullEnd);
  assert.doesNotMatch(pullRoute, /reconcileDraftsSafely/);
});

test('ciężkie podstrony magazynu są budowane wyłącznie dla aktywnej karty', async () => {
  const inventory = await readFile('assets/admin.js', 'utf8');
  assert.match(inventory, /if\(aktywna==="plan"\)return adminSzkielet/);
  for (const section of ['dostawcy', 'pulpit', 'lokalizacje', 'stany', 'ruchy']) {
    const inline = inventory.includes(`\${aktywna==="${section}"?\``);
    const delegated = section === 'lokalizacje' && inventory.includes('${aktywna==="lokalizacje"?magazynLokalizacjePanelHTML(');
    assert.ok(inline || delegated, `sekcja ${section} musi być generowana warunkowo`);
  }
  assert.ok(!inventory.includes('style="${aktywna==="stany"?"":"display:none"}"'), 'lista stanów nie może powstawać jako niewidoczny DOM');
});

test('główne wyszukiwarki nie przebudowują strony po każdej literze', async () => {
  const sources = await Promise.all([
    readFile('src/frontend/06-router-and-storefront.js', 'utf8'),
    readFile('src/frontend/07-admin-shipping.js', 'utf8'),
    readFile('assets/admin.js', 'utf8'),
    readFile('assets/admin.js', 'utf8'),
  ]);
  const all = sources.join('\n');
  for (const state of ['frazaListyProduktow', 'szukajWysylek', 'szukajAllegroZamowien', 'szukajAllegroOfert', 'szukajAllegroWystawiania', 'szukajZamowien', 'szukajKlientow', 'szukajInfakt']) {
    assert.ok(!new RegExp(`${state}=this\\.value[^"\\n]{0,80};renderuj\\(\\)`).test(all), `${state} nadal renderuje natychmiast`);
  }
});
