import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const backend = await readFile(new URL('../src/backend/lib/store-app.mjs', import.meta.url), 'utf8');
const frontend = await readFile(new URL('../src/frontend/11-allegro-operations.js', import.meta.url), 'utf8');

test('wyszukiwanie katalogu Allegro działa wyłącznie po poprawnym GTIN', () => {
  assert.match(backend, /if \(!gtinRaw\) return \{ selected: null[\s\S]*automat nie szuka ani nie podpina produktu katalogowego po nazwie/);
  assert.match(backend, /parameters = \{ phrase: gtinRaw\.replace\(\/\\D\/g, ''\), mode: 'GTIN'/);
  assert.doesNotMatch(backend, /searchedBy === 'name'/);
  assert.doesNotMatch(backend, /searchedBy === 'MPN'/);
});

test('publikacja ma serwerową blokadę niepotwierdzonego UUID katalogu', () => {
  assert.match(backend, /async function allegroZweryfikujTozsamoscPublikacji/);
  assert.match(backend, /code: 'allegro_identity_unverified'/);
  assert.match(backend, /const identityCheck = await allegroZweryfikujTozsamoscPublikacji/);
  assert.match(backend, /if \(!identityCheck\.ok\)/);
});

test('produkt bez EAN tworzy nową kartotekę zamiast zgadywać UUID', () => {
  assert.match(backend, /mode: productGtin \? 'new_product_with_gtin' : 'new_product_without_gtin'/);
  assert.match(backend, /Nowa kartoteka bez EAN/);
  assert.match(frontend, /if\(\(p\.gtin\|\|p\.ean\)&&!allegroPoprawnyGtin/);
  assert.doesNotMatch(frontend, /if\(!\(p\.gtin\|\|p\.ean\)\) braki\.push\("EAN"\)/);
});
