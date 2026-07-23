import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('wszystkie aktywne produkty są objęte darmową promocją bez ręcznego włączania', async () => {
  const frontend = await read('src/frontend/09-seo.js');
  assert.match(frontend, /Darmowa promocja całego katalogu/);
  assert.match(frontend, /aktywnych produktów<\/b> jest objętych automatem bez ręcznego zaznaczania/);
  assert.match(frontend, /aktywnych w darmowej promocji/);
  assert.match(frontend, /Nadaj dodatkowy priorytet/);
  assert.match(frontend, /Usuń priorytet — promocja pozostaje/);
  assert.doesNotMatch(frontend, /Dodaj do darmowej promocji/);
  assert.doesNotMatch(frontend, /Usuń z promocji/);
});

test('IndexNow wykonuje pełne pierwsze zgłoszenie, a potem zgłasza tylko zmiany', async () => {
  const [backend, indexNow, automation] = await Promise.all([read('netlify/functions/lib/store-app.mjs'), read('netlify/functions/lib/domain/indexnow.mjs'), read('netlify/functions/lib/domain/seo-daily-automation.mjs')]);
  assert.match(backend, /runIndexNowPromotion\(\{ catalogProducts:/);
  assert.match(indexNow, /fullCatalogSubmission = !config\.indexNowFullCatalogAt/);
  assert.match(indexNow, /fullCatalogSubmission \? catalogProducts : changedProducts/);
  assert.match(indexNow, /scope = fullCatalogSubmission \? 'full-catalog' : 'changed-products'/);
  assert.match(backend, /indexNowFullCatalogAt: fullCatalogSubmission && promotion\.accepted/);
  assert.match(backend, /scheduledSeoRunForDay\(history, scheduledDay\)/);
  assert.match(automation, /reason: 'already-ran-today'/);
  assert.match(backend, /lastChannels: channels/);
});

test('drugi adres jest pokazany jako bezpieczny alias jednej domeny kanonicznej', async () => {
  const [frontend, config] = await Promise.all([read('src/frontend/09-seo.js'), read('netlify.toml')]);
  assert.match(frontend, /allsklep\.pl — drugi adres podpięty/);
  assert.match(frontend, /Jedna domena kanoniczna chroni pozycjonowanie przed duplikacją treści/);
  assert.match(config, /from = "https:\/\/allsklep\.pl\/\*"[\s\S]*to = "https:\/\/artwaytm\.pl\/:splat"[\s\S]*status = 301/);
  assert.match(config, /from = "https:\/\/www\.allsklep\.pl\/\*"[\s\S]*to = "https:\/\/artwaytm\.pl\/:splat"[\s\S]*status = 301/);
});
