import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const storePath = new URL('../netlify/functions/lib/store-app.mjs', import.meta.url);
const frontendPath = new URL('../src/frontend/11-allegro-settings.js', import.meta.url);

test('mapowanie ręczne i automatyczne korzysta z kompletnego katalogu importowanego', async () => {
  const source = await readFile(storePath, 'utf8');
  assert.match(source, /productLinkImport\.catalog\.list\(\)/);
  assert.match(source, /allegroAgentProduktyKompletne\(data\)/);
  assert.match(source, /allegroAktualizatorProduktowCentralnych\(data, products\.keys\(\)\)/);
  assert.match(source, /action === 'allegro-auto-map-offers'/);
});

test('panel ustawień zapisuje mapowanie i oba interwały synchronizacji', async () => {
  const source = await readFile(frontendPath, 'utf8');
  assert.match(source, /name="autoMapping"/);
  assert.match(source, /name="mappingMinScore"/);
  assert.match(source, /min="55"/);
  assert.match(source, /this\.form\.requestSubmit\(\)/);
  assert.match(source, /name="lightSyncMinutes"/);
  assert.match(source, /name="fullSyncHours"/);
});
