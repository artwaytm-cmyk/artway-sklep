import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('strona główna zachowuje dokładnie jeden H1 przy każdym układzie sekcji', async () => {
  const [storefront, styles] = await Promise.all([
    readFile('assets/app.js', 'utf8'),
    readFile('src/styles/01-foundation.css', 'utf8'),
  ]);

  assert.match(storefront, /const widoczneSekcje=kolejnoscSekcji\(\)\.filter\(sekcjaWidoczna\)/);
  assert.match(storefront, /const heroMaNaglowekGlowny=widoczneSekcje\.includes\("hero"\)/);
  assert.match(storefront, /const ofertaMaNaglowekGlowny=!heroMaNaglowekGlowny&&widoczneSekcje\.includes\("produkty"\)/);
  assert.match(storefront, /<\$\{ofertaMaNaglowekGlowny\?"h1":"h2"\}>/);
  assert.match(storefront, /<h1 class="sr-only home-canonical-title">Gry, zabawki i artykuły imprezowe — Artway-TM<\/h1>/);
  assert.match(styles, /\.sr-only\{/);
});
