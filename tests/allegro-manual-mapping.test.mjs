import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('ręczny wybór administratora zapisuje trwałe powiązanie i synchronizuje wskazaną ofertę bez kasowania historii', async () => {
  const [frontend, ui] = await Promise.all([
    readFile(new URL('../src/frontend/11-allegro-manual-mapping-actions.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/admin.js', import.meta.url), 'utf8'),
  ]);
  assert.match(frontend, /manualDecision=id&&options\.manualDecision!==false/);
  assert.match(frontend, /force:manualDecision\|\|options\.force===true/);
  assert.doesNotMatch(frontend, /replaceExisting:/);
  assert.match(frontend, /d\.syncRequired!==false/);
  assert.match(frontend, /mappedOfferId:String\(offerId\)/);
  assert.match(frontend, /preserveStock:true/);
  assert.match(ui, /Ustaw jako ofertę główną/);
});

test('backend rozdziela decyzję ręczną od automatycznych progów i aktualizuje dokładnie wskazaną ofertę', async () => {
  const [backend, patch, canonical] = await Promise.all([
    readFile(new URL('../netlify/functions/lib/store-app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../netlify/functions/lib/domain/allegro-offer-patch.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../netlify/functions/lib/domain/allegro-canonical-mappings.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(backend, /manualDecision = body\.manualDecision === true/);
  assert.match(backend, /manualDecision \|\| body\.force === true/);
  assert.match(backend, /linkCanonicalAllegroMapping/);
  assert.match(backend, /operator: manualDecision \? 'admin-manual-decision'/);
  assert.match(canonical, /sourceOfTruth: 'store'/);
  assert.match(canonical, /reason: validation\.reason \|\| current\.reason \|\| 'ręczna decyzja administratora'/);
  assert.match(patch, /options\.preserveStock !== true/);
});
