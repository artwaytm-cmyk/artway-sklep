import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('ręczny wybór administratora zawsze zastępuje konflikt i synchronizuje wskazaną ofertę', async () => {
  const [frontend, ui] = await Promise.all([
    readFile(new URL('../src/frontend/11-allegro-manual-mapping-actions.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/frontend/11-allegro-and-orders.js', import.meta.url), 'utf8'),
  ]);
  assert.match(frontend, /manualDecision=id&&options\.manualDecision!==false/);
  assert.match(frontend, /force:manualDecision\|\|options\.force===true/);
  assert.match(frontend, /replaceExisting:manualDecision\|\|options\.replaceExisting===true/);
  assert.match(frontend, /mappedOfferId:String\(offerId\)/);
  assert.match(frontend, /preserveStock:true/);
  assert.match(ui, /Połącz i aktualizuj/);
});

test('backend rozdziela decyzję ręczną od automatycznych progów i aktualizuje dokładnie wskazaną ofertę', async () => {
  const [backend, patch] = await Promise.all([
    readFile(new URL('../netlify/functions/lib/store-app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../netlify/functions/lib/domain/allegro-offer-patch.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(backend, /manualDecision = body\.manualDecision === true/);
  assert.match(backend, /manualDecision \|\| body\.force === true/);
  assert.match(backend, /manualDecision \|\| body\.replaceExisting === true/);
  assert.match(backend, /operator: manualDecision \? 'admin-manual-decision'/);
  assert.match(backend, /reason: 'ręczna decyzja administratora'/);
  assert.match(patch, /options\.preserveStock !== true/);
});
