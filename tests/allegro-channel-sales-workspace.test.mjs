import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Allegro pokazuje stan kanału bez udostępniania masowego mapowania', async () => {
  const source = await readFile(new URL('../src/frontend/12c-commerce-catalog-actions.js', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../src/frontend/02-runtime-state.js', import.meta.url), 'utf8');
  assert.match(runtime, /filtrAllegroOfert="wszystkie", filtrStatusuAllegroOfert="sprzedaz"/);
  assert.match(source, /W sprzedaży \/ aktywne/);
  assert.match(source, /RZECZYWISTY STAN KANAŁU • API ALLEGRO/);
  assert.match(source, /Powiązania z produktami pozostają trwałe/);
  assert.match(source, /allegroCentrumOfertUstawTryb\('sprzedaz','sprzedaz'\)/);
  assert.doesNotMatch(source, /<b>Rejestr i powiązania<\/b>/);
  assert.doesNotMatch(source, /🧩 Połącz pewne/);
  assert.doesNotMatch(source, /<span>Stan powiązania<\/span>/);
});
