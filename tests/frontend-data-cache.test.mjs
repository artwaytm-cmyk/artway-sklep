import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('przełączanie kart nie uruchamia ponownie tego samego odczytu sieciowego', async () => {
  const [cloud, state, allegro] = await Promise.all([
    read('src/frontend/03-cloud-sync.js'),
    read('src/frontend/02-runtime-state.js'),
    read('src/frontend/11-allegro-and-orders.js'),
  ]);
  assert.match(cloud, /chmuraPobraniaWToku\.get\(requestKey\)/);
  assert.match(cloud, /chmuraPobraniaWToku\.set\(requestKey,request\)/);
  assert.match(allegro, /ALLEGRO_DANE_TTL_MS=15\*60\*1000/);
  assert.match(allegro, /allegroDaneObietnice\.get\(zakres\)/);
  assert.match(allegro, /zaladowany&&Date\.now\(\)-ostatni<ALLEGRO_DANE_TTL_MS/);
  assert.match(allegro, /allegroPanelStatyCache/);
  assert.doesNotMatch(state, /wczytajLS\("artway_allegro_(?:zamowienia|oferty|mapowania|komunikacja)_cache"/);
  assert.match(allegro, /allegroIndeksOfert\(\)\.byId/);
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
