import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('przełączanie kart nie uruchamia ponownie tego samego odczytu sieciowego', async () => {
  const [cloud, state, allegro] = await Promise.all([
    read('src/frontend/03-cloud-sync.js'),
    read('src/frontend/02-runtime-state.js'),
    read('assets/admin.js'),
  ]);
  assert.match(cloud, /chmuraPobraniaWToku\.get\(requestKey\)/);
  assert.match(cloud, /chmuraPobraniaWToku\.set\(requestKey,request\)/);
  assert.match(allegro, /ALLEGRO_DANE_TTL_MS=15\*60\*1000/);
  assert.match(allegro, /allegroDaneObietnice\.get\(zakres\)/);
  assert.match(allegro, /zaladowany&&Date\.now\(\)-ostatni<ALLEGRO_DANE_TTL_MS/);
  assert.match(allegro, /allegroPanelStatyCache/);
  assert.doesNotMatch(state, /wczytajLS\("artway_allegro_(?:zamowienia|oferty|mapowania|komunikacja)_cache"/);
  assert.match(allegro, /ALLEGRO_TRWALY_CACHE_KEY="allegro-offers-and-mappings-v2"/);
  assert.match(allegro, /function allegroOdtworzTrwalyCache/);
  assert.match(allegro, /chmuraRuntimeCacheOdczytaj\(ALLEGRO_TRWALY_CACHE_KEY\)/);
  assert.match(allegro, /allegroIndeksOfert\(\)\.byId/);
});

test('bazowy katalog i widoki panelu pozostają w trwałej, adaptacyjnej pamięci', async () => {
  const [catalog,cloud,router,responsive]=await Promise.all([
    read('assets/app.js'),read('src/frontend/03-cloud-sync.js'),read('assets/app.js'),read('src/frontend/08a-admin-responsive-layout.js'),
  ]);
  assert.match(catalog,/PRODUKTY_BAZOWE_CACHE_TTL_MS=6\*60\*60\*1000/);
  assert.match(catalog,/If-None-Match/);
  assert.match(cloud,/przed<7_500_000/);
  assert.doesNotMatch(cloud,/KLUCZE_PRZESTARZALYCH_CACHE[\s\S]{0,300}"artway_produkty_katalog"/);
  assert.match(responsive,/navigator\.storage\.persist\(\)/);
  assert.match(responsive,/ADMIN_PAMIEC_URZADZENIA_GB>=8\?16:12/);
  assert.match(router,/entry\.signature!==adminSygnaturaCacheTrasy\(route\)/);
  assert.match(cloud,/uniewaznijCachePodstronAdmina\(klucz\)/);
});

test('synchronizacja ostatniego okna pobiera wszystkie statusy, lecz kolejka zachowuje filtr pracy', async () => {
  const [backend, cron] = await Promise.all([
    read('netlify/functions/lib/store-app.mjs'),
    read('netlify/functions/cron-allegro-orders.mjs'),
  ]);
  const start = backend.indexOf("if (action === 'allegro-sync-orders')"), end = backend.indexOf("if (action === 'allegro-order-checked')", start), route = backend.slice(start, end);
  assert.match(route, /mergeRecentAllegroOrders/);
  assert.match(route, /\/order\/checkout-forms', \{ parameters: \{ limit: pageLimit, offset \} \}/);
  assert.doesNotMatch(route, /status: 'READY_FOR_PROCESSING'/);
  assert.match(route, /selectAllegroStatusRefreshCandidates/);
  assert.match(cron, /limit: 200/);
});
