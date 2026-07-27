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
