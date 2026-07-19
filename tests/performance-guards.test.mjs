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

test('techniczne przywracanie pozycji panelu nie uruchamia kosztownego płynnego przewijania', async () => {
  const [router, customers, shipping] = await Promise.all([
    readFile('src/frontend/06-router-and-storefront.js', 'utf8'),
    readFile('src/frontend/12-customers-and-inventory.js', 'utf8'),
    readFile('src/frontend/07-admin-shipping.js', 'utf8'),
  ]);
  assert.match(router, /scrollTo\(\{top:Math\.max\(0,Number\(entry\.scrollY\)\|\|0\),behavior:"instant"\}\)/);
  const calls = `${router}\n${customers}\n${shipping}`.match(/scrollTo\(\{[^}]+\}\)/g) || [];
  assert.ok(calls.length >= 5);
  calls.forEach(call => assert.match(call, /behavior:"instant"/));
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

test('importowany katalog ma trwały cache IndexedDB i nie wraca z API po każdym uruchomieniu', async () => {
  const cloud = await readFile('src/frontend/03-cloud-sync.js', 'utf8');
  assert.match(cloud, /const CHMURA_KATALOG_CACHE_DB = "artway-runtime-cache"/);
  assert.match(cloud, /indexedDB\.open\(CHMURA_KATALOG_CACHE_DB,1\)/);
  assert.match(cloud, /String\(cache\.revision\|\|""\)===revision/);
  assert.match(cloud, /cache\.products\.length===count/);
  assert.match(cloud, /chmuraKatalogCacheZapisz\(revision,imported\)/);
});

test('moduły aktywnej podstrony panelu są pobierane równolegle po rdzeniu', async () => {
  const [router, responsive] = await Promise.all([readFile('src/frontend/06-router-and-storefront.js', 'utf8'), readFile('src/frontend/08a-admin-responsive-layout.js', 'utf8')]);
  assert.match(router, /const core=modules\.includes\("core"\)\?zaladujAdminModul\("core",version\)/);
  assert.match(router, /Promise\.all\(modules\.filter\(module=>module!=="core"\)\.map\(module=>zaladujAdminModul\(module,version\)\)\)/);
  assert.doesNotMatch(router, /modules\.reduce\(\(chain,module\)=>chain\.then/);
  assert.match(responsive, /requestIdleCallback\(fn,\{timeout:2500\}\)/);
  assert.match(router, /zaplanujWstepneLadowaniePanelu\(version\)/);
});

test('responsywna warstwa nie modyfikuje masowo kontrolek ani nie wymusza przeliczeń układu', async () => {
  const responsive = await readFile('src/frontend/08a-admin-responsive-layout.js', 'utf8');
  assert.doesNotMatch(responsive, /control\.scrollWidth|control\.clientWidth/);
  assert.doesNotMatch(responsive, /opiszKontrolki|setAttribute\('aria-label',label\)|setAttribute\('title',label\)/);
  assert.match(responsive, /querySelector\('\.assortment-catalog-workspace'\)/);
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

test('duży katalog renderuje produkty progresywnie zamiast układać setki kart naraz', async () => {
  const inventory = await readFile('src/frontend/12-warehouse-views.js', 'utf8');
  assert.match(inventory, /const ASORTYMENT_PARTIA_KART=10/);
  assert.match(inventory, /IntersectionObserver/);
  assert.match(inventory, /asortymentKartyOczekujace\.splice\(0,ASORTYMENT_PARTIA_KART\)/);
  assert.match(inventory, /asortymentPrzygotujKartyProgresywnie\(fragment\.map/);
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
