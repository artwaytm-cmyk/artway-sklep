import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const frontend = await readFile(new URL('../src/frontend/11-allegro-and-orders.js', import.meta.url), 'utf8');

test('wewnętrznie załatwiona sprawa jest częścią filtra Obsłużone', () => {
  assert.match(frontend, /function allegroKomunikacjaObsluzona\(item=\{\}\)\{\s*return !allegroKomunikacjaWymagaOdpowiedzi\(item\);/);
  assert.match(frontend, /filter==="obsluzone"&&!allegroKomunikacjaObsluzona\(item\)/);
  assert.doesNotMatch(frontend, /filter==="obsluzone"&&\(need\|\|resolved\)/);
});

test('licznik Obsłużone obejmuje również sprawy załatwione wewnętrznie', () => {
  assert.match(frontend, /handled=all\.filter\(allegroKomunikacjaObsluzona\)\.length/);
  assert.match(frontend, /obsłużonych łącznie/);
  assert.match(frontend, /trafia także do filtra „Obsłużone”/);
});
