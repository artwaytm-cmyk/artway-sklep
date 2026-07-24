import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Zamówienia Allegro mają jeden profesjonalny rejestr operacyjny', async () => {
  const [orders, workspace, styles] = await Promise.all([
    readFile('src/frontend/11-allegro-operations.js', 'utf8'),
    readFile('src/frontend/11-allegro-workspace.js', 'utf8'),
    readFile('src/styles/27-allegro-listing-workspace.css', 'utf8'),
  ]);

  for (const marker of ['allegro-orders-workspace', 'allegro-orders-command', 'allegro-orders-pulse', 'allegro-orders-status-tabs', 'allegro-orders-register']) {
    assert.ok(orders.includes(marker), `brak elementu widoku: ${marker}`);
    assert.ok(styles.includes(`.${marker}`), `brak stylu widoku: ${marker}`);
  }
  assert.match(orders, /Sprawdź nowe zlecenia/);
  assert.match(orders, /Status Allegro pozostaje tylko do odczytu/);
  assert.match(orders, /analiza\.braki>0\|\|analiza\.nierozpoznane>0\|\|analiza\.bezStanu>0\?"open":""/);

  const headerPosition = workspace.indexOf('allegroWorkspaceSectionHTML(aktywna,mapped,niepodpiete,staty)');
  const contentPosition = workspace.indexOf('aktywna==="zamowienia"?allegroZamowieniaTabelaHTML()');
  assert.ok(headerPosition >= 0 && headerPosition < contentPosition, 'nagłówek podstrony musi być nad rejestrem, a nie pod nim');
});
