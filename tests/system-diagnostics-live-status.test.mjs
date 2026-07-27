import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('diagnostyka uruchamia kontrolę serwera zamiast pokazywać stan początkowy jako awarię', () => {
  const router = read('src/frontend/06-router-and-storefront.js');
  const diagnostics = read('src/frontend/16-diagnostics.js');
  assert.match(router, /admin\/system\/diagnostyka[\s\S]{0,300}systemOdswiezDiagnostyke\(true\)/);
  assert.match(diagnostics, /!integracjeSprawdzone\?"pending"/);
  assert.match(diagnostics, /Trwa automatyczna kontrola backendu VPS/);
  assert.match(diagnostics, /Trwa automatyczna kontrola wydania/);
});

test('diagnostyka korzysta wyłącznie z bramki Node VPS', () => {
  const shipping = read('src/frontend/07a-shipping-workflow.js');
  const integrations = read('src/frontend/07b-shipping-integrations.js');
  assert.match(shipping, /apiEndpoint:"\/api\/store"/);
  assert.doesNotMatch(integrations, /Awaryjna bramka PHP/);
  assert.doesNotMatch(integrations, /Serwer nie uruchomił PHP/);
});

test('ciężka kopia danych serwerowych jest usuwana z localStorage po potwierdzeniu bazy', () => {
  const storage = read('src/frontend/01b-storage-foundation.js');
  const cloud = read('src/frontend/03-cloud-sync.js');
  assert.match(storage, /function chmuraCzyscSerweroweKopieLS\(\)/);
  assert.match(storage, /!chmuraStan\.dostepna/);
  assert.match(cloud, /if \(pomijamyLs\)[\s\S]{0,700}chmuraUsuńDuzyKluczLS\(klucz\)/);
  assert.match(cloud, /chmuraUsunChunksLS\(klucz\)/);
});

test('centralny PostgreSQL jest źródłem katalogu, a products.json kopią startową', () => {
  const diagnostics = read('src/frontend/16-diagnostics.js');
  assert.match(diagnostics, /"Centralny katalog produktów"/);
  assert.match(diagnostics, /PostgreSQL jest źródłem prawdy/);
  assert.match(diagnostics, /products\.json pełni wyłącznie rolę startowej kopii awaryjnej/);
});
