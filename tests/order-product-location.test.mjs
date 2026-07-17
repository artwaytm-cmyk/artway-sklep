import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const orders = await readFile(new URL('../src/frontend/11-allegro-and-orders.js', import.meta.url), 'utf8');
const locations = await readFile(new URL('../src/frontend/11-order-location-ui.js', import.meta.url), 'utf8');
const source = `${locations}\n${orders}`;
const styles = await readFile(new URL('../src/styles/21-warehouse-workspace.css', import.meta.url), 'utf8');

test('obsługa zamówienia sklepu pokazuje lokalizację każdej pozycji bez blokowania procesu', () => {
  assert.match(source, /function adminProduktDlaPozycjiZamowienia/);
  assert.match(source, /function adminLokalizacjaPozycjiZamowieniaHTML/);
  assert.match(source, /adminLokalizacjaPozycjiZamowieniaHTML\(p\)/);
  assert.match(source, /Informacja dla magazynu — nie blokuje obsługi/);
  assert.match(source, /Nie rozpoznano kartoteki produktu/);
});

test('zamówienia Allegro mają osobną kolumnę lokalizacji magazynowej', () => {
  assert.match(source, /function allegroLokalizacjaPozycjiHTML/);
  assert.match(source, /Lokalizacja magazynowa/);
  assert.match(source, /allegroLokalizacjaPozycjiHTML\(p\)/);
  assert.match(source, /Brak lokalizacji/);
});

test('status lokalizacji jest czytelny i neutralny wizualnie', () => {
  assert.match(styles, /warehouse-order-location\.is-set/);
  assert.match(styles, /warehouse-order-location\.is-missing/);
  assert.match(styles, /border-style:dashed/);
});
