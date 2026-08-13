import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('wszystkie wejścia przygotowania przekazują pełne zaznaczenie do trwałej kolejki', async () => {
  const [actions, listing, commerce, vonHalsky] = await Promise.all([
    read('src/frontend/12a-product-actions.js'),
    read('src/frontend/12b-allegro-listing-workspace.js'),
    read('src/frontend/12c-commerce-catalog-actions.js'),
    read('src/frontend/11c-von-halsky-preparation.js'),
  ]);
  assert.match(actions, /const ASORTYMENT_MAX_PRODUKTOW_KOLEJKI=2000/);
  assert.match(actions, /asortymentUruchomAgentaNaSerwerze\(requested,"product-full-review"\)/);
  assert.match(actions, /operation="product-full-review"/);
  assert.match(actions, /productIds:\[productId\],operation:"product-full-review"/);
  assert.match(actions, /Gotowy: sklep \+ Allegro \+ Von Halsky/);
  assert.doesNotMatch(actions, /asortymentProduktyZId\(ids\)\.slice\(0,250\)/);
  assert.doesNotMatch(listing, /allegroPublikacjaPrzygotujWybranePoId[\s\S]{0,240}slice\(0,250\)/);
  assert.doesNotMatch(commerce, /missingFiltered\.slice\(0,250\)/);
  assert.match(commerce, /Pełne przygotowanie wszystkich kanałów/);
  assert.match(commerce, /Przygotuj wszystkie zaznaczone \(\$\{selected\}\)/);
  assert.doesNotMatch(commerce, /Wykonaj dla zaznaczonych/);
  assert.doesNotMatch(vonHalsky, /requested=.*slice\(0,50\)/);
  assert.match(vonHalsky, /Agent zaczyna .*zaraz po aktualnej kartotece/);
});

test('przyciski decyzji prowadzą do konkretnego filtrowanego miejsca pracy', async () => {
  const [center, workspace, preview, orders] = await Promise.all([
    read('src/frontend/10-agent-ai-command-center.js'),
    read('src/frontend/11-agent-ai-workspace.js'),
    read('src/frontend/11a-agent-observability-workspace.js'),
    read('src/frontend/11-allegro-and-orders.js'),
  ]);
  assert.match(center, /function agentAIOtworzCentrumDecyzji/);
  for (const target of ['supplier', 'orders', 'offers', 'messages', 'issues', 'surplus', 'supplier_docs']) {
    assert.match(center, new RegExp(`target===\"${target}\"`));
  }
  assert.match(workspace, /hasDecision\?"#\/admin\/agent-ai\/obsluga"/);
  assert.doesNotMatch(preview, /agent-ai\/automatyzacje/);
  assert.match(orders, /filtrZamowien==="wymaga_decyzji"/);
});
