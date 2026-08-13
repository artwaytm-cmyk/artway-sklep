import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Zamówienia Allegro mają jeden profesjonalny rejestr operacyjny', async () => {
  const [orders, workspace, styles] = await Promise.all([
    readFile('src/frontend/11-allegro-operations.js', 'utf8'),
    readFile('src/frontend/11-allegro-workspace.js', 'utf8'),
    readFile('src/styles/27-allegro-listing-workspace.css', 'utf8'),
  ]);

  for (const marker of ['allegro-orders-workspace', 'allegro-orders-command', 'allegro-orders-pulse', 'allegro-orders-register']) {
    assert.ok(orders.includes(marker), `brak elementu widoku: ${marker}`);
    assert.ok(styles.includes(`.${marker}`), `brak stylu widoku: ${marker}`);
  }
  assert.match(orders,/adminEtapyRealizacjiZamowienHTML/);
  assert.match(orders,/adminNaglowekListyZamowienHTML/);
  assert.match(orders, /adminAkcjeCentrumZamowienHTML/);
  assert.match(orders, /Wymaga działania/);
  assert.match(orders, /Status Allegro pozostaje tylko do odczytu/);
  assert.match(orders, /analiza\.braki>0\|\|analiza\.nierozpoznane>0\|\|analiza\.bezStanu>0\?"open":""/);

  const headerPosition = workspace.indexOf('allegroWorkspaceSectionHTML(aktywna,mapped,niepodpiete,staty)');
  const contentPosition = workspace.indexOf('aktywna==="zamowienia"?allegroZamowieniaTabelaHTML()');
  assert.ok(headerPosition >= 0 && headerPosition < contentPosition, 'nagłówek podstrony musi być nad rejestrem, a nie pod nim');
});

test('sklep, Allegro i Von Halsky mają wspólny przełącznik i standard centrum zamówień', async () => {
  const [core, responsive, store, allegro, von, sharedStyles, unifiedStyles] = await Promise.all([
    readFile('src/frontend/08-admin-navigation.js', 'utf8'),
    readFile('src/frontend/08a-admin-responsive-layout.js', 'utf8'),
    readFile('src/frontend/11-store-orders.js', 'utf8'),
    readFile('src/frontend/11-allegro-operations.js', 'utf8'),
    readFile('src/frontend/11b-von-halsky-workspace.js', 'utf8'),
    readFile('src/styles/05-content-and-account.css', 'utf8'),
    readFile('src/styles/35-admin-unified-workspace.css', 'utf8'),
  ]);
  assert.match(core, /function adminKanalyZamowienHTML/);
  assert.match(core, /function adminCentrumZamowienHTML/);
  assert.match(store, /adminKanalyZamowienHTML\("sklep"\)/);
  assert.match(allegro, /adminKanalyZamowienHTML\("allegro"\)/);
  assert.match(von, /adminKanalyZamowienHTML\("von-halsky"\)/);
  assert.match(store, /adminCentrumZamowienHTML/);
  assert.match(allegro, /adminCentrumZamowienHTML/);
  assert.match(von, /vonHalskyOrdersWorkspaceHTML/);
  assert.match(sharedStyles, /\.orders-channel-switch/);
  assert.match(sharedStyles, /\.channel-orders-hero/);
  assert.match(sharedStyles, /\.orders-command-hero/);
  assert.match(responsive, /'\.orders-command-hero'/);
  assert.match(unifiedStyles, /\.orders-command-hero\.admin-unified-hero/);
  assert.match(unifiedStyles, /\.orders-command-hero \.orders-command-head/);
});
