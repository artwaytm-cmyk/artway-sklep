import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('kod aplikacji jest rewalidowany, a przeglądarka ma bezpieczną trasę naprawczą', async () => {
  const nginx = await readFile('ops/nginx/artway-production.conf', 'utf8');
  assert.match(nginx, /location ~\* \\\.\(\?:css\|js\)\$/);
  assert.match(nginx, /Cache-Control "no-cache, must-revalidate"/);
  assert.match(nginx, /location = \/aktualizuj-przegladarke/);
  assert.match(nginx, /Clear-Site-Data "\\"cache\\""/);
  assert.doesNotMatch(
    nginx,
    /location ~\* \\\.\(\?:css\|js\|png[\s\S]{0,300}immutable/,
    'kod wykonywalny nie może być niezmiennie cachowany pod stałą nazwą',
  );
});

test('aktualizacja PWA nie kasuje danych konta ani magazynu z IndexedDB', async () => {
  const pwa = await readFile('src/frontend/18-pwa.js', 'utf8');
  assert.match(pwa, /setTimeout\(\(\)=>void pwaSprawdzNajnowszeWydanie\(\),800\)/);
  assert.doesNotMatch(pwa, /deleteDatabase/);
  assert.doesNotMatch(pwa, /registration\.unregister/);
  assert.match(pwa, /localStorage\.setItem\(PWA_CACHE_KEY_VERSION/);
});

test('ręczna aktualizacja czeka na przejęcie kontroli przez dokładne wydanie', async () => {
  const pwa = await readFile('src/frontend/18-pwa.js', 'utf8');
  assert.match(pwa, /serviceWorker\.register\(`\/sw\.js\?v=\$\{encodeURIComponent\(version\)\}`,\{scope:"\/",updateViaCache:"none"\}\)/);
  assert.match(pwa, /pwaPoczekajNaKontroler/);
  assert.match(pwa, /artway_oczekiwane_wydanie/);
  assert.match(pwa, /url\.searchParams\.set\("artway_release",version\)/);
  assert.match(pwa, /location\.replace\(/);
  assert.doesNotMatch(pwa, /lokalnieZapisanaWersja[\s\S]{0,300}pwaPokazNoweWydanie/);
});

test('PWA nie pokazuje ponownie komunikatu dla już uruchomionego wydania', async () => {
  const pwa = await readFile('src/frontend/18-pwa.js', 'utf8');
  assert.match(pwa, /if\(!nowe\|\|nowe===biezace\)\{[\s\S]*?pwaSchowajKomunikatWydania\(\)/);
  assert.match(pwa, /pwaWydanieWorkera\(registration\.waiting\)/);
  assert.doesNotMatch(pwa, /pwaPokazNoweWydanie\(pwaBiezaceWydanie\(\)\)/);
});
