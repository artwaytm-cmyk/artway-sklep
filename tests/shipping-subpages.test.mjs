import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Centrum wysyłki ma trwałe adresy wszystkich podstron', async () => {
  const [shipping,router] = await Promise.all([read('src/frontend/07-admin-shipping.js'),read('src/frontend/06-router-and-storefront.js')]);
  for (const route of ['#/admin/wysylki/tracking','#/admin/wysylki/automatyzacje','#/admin/wysylki/ustawienia']) assert.match(shipping,new RegExp(route.replaceAll('/','\\/')));
  assert.match(router,/t\.startsWith\("\/admin\/wysylki\/"\)/);
  assert.match(router,/widokAdminWysylki\(t\.split\("\/"\)\[3\]\|\|"zlecenia"\)/);
  assert.match(shipping,/function widokAdminWysylki\(sekcja="zlecenia"\)/);
});

test('każda podstrona wysyłek ma własny widok i poprawny aktywny stan nawigacji', async () => {
  const shipping=await read('src/frontend/07-admin-shipping.js');
  for (const panel of ['panelZlecenWysylkowych','panelTrackinguWysylek','panelAutomatyzacjiWysylek','panelUstawienBramki']) assert.match(shipping,new RegExp(`function ${panel}\\(`));
  assert.match(shipping,/adminSubnavHTML\(\[/);
  assert.match(shipping,/wysylkiKontekstPodstronyHTML\(aktywna\)/);
  assert.match(shipping,/trasa\(\)\.startsWith\("\/admin\/wysylki"\)/);
});

test('Centrum wysyłki ma responsywną przestrzeń roboczą bez poziomego suwaka na całej stronie', async () => {
  const css=await read('src/styles/07-admin-domains.css');
  assert.match(css,/\.shipping-module-page\{display:grid/);
  assert.match(css,/\.shipping-page-context/);
  assert.match(css,/\.shipping-workspace>/);
  assert.match(css,/@media\(max-width:760px\).*\.shipping-workspace \.pipeline\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s);
});
