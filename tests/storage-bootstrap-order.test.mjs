import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('pamięć przeglądarki jest inicjalizowana przed stanem sklepu i synchronizacją', async () => {
  const build = await readFile(new URL('../scripts/build-assets.mjs', import.meta.url), 'utf8');
  const storagePosition = build.indexOf("'src/frontend/01b-storage-foundation.js'");
  const statePosition = build.indexOf("'src/frontend/02-runtime-state.js'");
  const syncPosition = build.indexOf("'src/frontend/03-cloud-sync.js'");

  assert.ok(storagePosition >= 0, 'Brakuje modułu fundamentu pamięci');
  assert.ok(storagePosition < statePosition, 'Stan sklepu nie może wyprzedzać inicjalizacji pamięci');
  assert.ok(statePosition < syncPosition, 'Synchronizacja ma startować po zbudowaniu stanu sklepu');
});

test('odczyt localStorage nie zależy od później inicjalizowanych stałych synchronizacji', async () => {
  const storage = await readFile(new URL('../src/frontend/01b-storage-foundation.js', import.meta.url), 'utf8');
  const cloud = await readFile(new URL('../src/frontend/03-cloud-sync.js', import.meta.url), 'utf8');

  assert.match(storage, /const CHMURA_LS_CHUNK_PREFIX/);
  assert.match(storage, /function wczytajLS/);
  assert.doesNotMatch(cloud, /const CHMURA_LS_CHUNK_PREFIX/);
  assert.doesNotMatch(cloud, /function wczytajLS/);
});
