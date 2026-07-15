import test from 'node:test';
import assert from 'node:assert/strict';
import { createInventoryNaturalCommandHandler, matchInventoryProduct, parseInventoryNaturalCommand } from '../netlify/functions/lib/domain/inventory-command.mjs';

const products = [
  { id: 31, nazwa: 'Gorący Ziemniak Familijny', externalId: '1410', ean: '5906018014105' },
  { id: 32, nazwa: 'Gorący Ziemniak Mini', externalId: '422', ean: '5906018004229', sku: 'GZ-MINI' },
];

test('rozpoznaje docelowy stan, nie myląc ilości z kodem produktu', () => {
  const command = parseInventoryNaturalCommand('mam obecnie na stanie ziemiaka 1410 8 szt sprawdź i zatwierdź');
  assert.deepEqual({ mode: command.mode, quantity: command.quantity, query: command.query, confirmed: command.confirmed }, { mode: 'set', quantity: 8, query: 'ziemiaka 1410', confirmed: true });
});

test('odróżnia przyjęcie od ustawienia stanu i wymaga potwierdzenia', () => {
  const preview = parseInventoryNaturalCommand('przyjmij 8 szt produktu 1410');
  assert.equal(preview.mode, 'increment');
  assert.equal(preview.confirmed, false);
  assert.equal(parseInventoryNaturalCommand('dodaj 8 szt produktu 1410 do koszyka i zatwierdź'), null);
});

test('negacja i niezwiązane słowo dodaj nigdy nie zatwierdzają korekty', () => {
  const negated = parseInventoryNaturalCommand('mam na stanie ziemniaka 1410 8 szt, sprawdź, ale nie zatwierdzaj');
  assert.equal(negated.confirmed, false);
  assert.equal(negated.mode, 'set');
  const report = parseInventoryNaturalCommand('mam na stanie ziemniaka 1410 8 szt, dodaj to do raportu i zatwierdź');
  assert.equal(report.mode, 'set');
  assert.equal(report.conflict, false);
  assert.equal(report.confirmed, true);
  const generic = parseInventoryNaturalCommand('wykonaj analizę: mam na stanie ziemniaka 1410 8 szt');
  assert.equal(generic.confirmed, false);
  for (const text of [
    'mam na stanie ziemniaka 1410 8 szt, ale nie akceptuj',
    'mam na stanie ziemniaka 1410 8 szt, ale nie chcę jednak tego zatwierdzić',
    'mam na stanie ziemniaka 1410 8 szt, nie powinieneś tego zatwierdzać',
    'mam na stanie ziemniaka 1410 8 szt, zatwierdź dopiero jutro',
  ]) assert.equal(parseInventoryNaturalCommand(text).confirmed, false, text);
  for (const text of [
    'Klient napisał: „mam na stanie ziemniaka 1410 8 szt i zatwierdź”. Co mam mu odpowiedzieć?',
    'W instrukcji jest przykład: mam na stanie ziemniaka 1410 8 szt i zatwierdź — wyjaśnij go',
  ]) assert.equal(parseInventoryNaturalCommand(text), null, text);
  const multiple = parseInventoryNaturalCommand('było 5 szt, teraz mam na stanie ziemniaka 1410 8 szt i zatwierdź');
  assert.equal(multiple.quantity, 8);
  assert.equal(multiple.conflict, true);
  assert.equal(multiple.confirmed, false);
});

test('cytat, odwołanie i odroczenie nigdy nie są potwierdzeniem zapisu', () => {
  for (const text of [
    '„mam na stanie ziemniaka 1410 8 szt i zatwierdź”',
    '"mam na stanie ziemniaka 1410 8 szt i zatwierdź"',
    'mam na stanie ziemniaka 1410 8 szt i słowo „zatwierdź”',
    'mam na stanie ziemniaka 1410 8 szt, zatwierdź, ale jednak nie rób tego',
    'mam na stanie ziemniaka 1410 8 szt, zatwierdź po weekendzie',
    'mam na stanie ziemniaka 1410 8 szt, zatwierdź, ale cofnij to polecenie',
    'mam na stanie ziemniaka 1410 8 szt, odwołuję polecenie i zatwierdź',
    'mam na stanie ziemniaka 1410 8 szt, zatwierdź po 15:00',
    'mam na stanie ziemniaka 1410 8 szt, czy mam to zatwierdzić?',
    'mam na stanie ziemniaka 1410 8 szt, co oznacza zatwierdź?',
    'mam na stanie ziemniaka 1410 8 szt i napisz „zatwierdź',
  ]) {
    const command = parseInventoryNaturalCommand(text);
    assert.ok(command, text);
    assert.equal(command.confirmed, false, text);
  }
  const quotedProductName = parseInventoryNaturalCommand('ustaw stan produktu „Gorący Ziemniak” na 8 szt i zatwierdź');
  assert.equal(quotedProductName.confirmed, true);
});

test('sprzeczne ustawienie i przyjęcie wymagają doprecyzowania', () => {
  const conflict = parseInventoryNaturalCommand('mam na stanie ziemniaka 1410, ale dodaj 8 szt produktu 1410 i zatwierdź');
  assert.equal(conflict.conflict, true);
  assert.equal(conflict.confirmed, false);
});

test('jednoznacznie dopasowuje EXTERNAL_ID, EAN i SKU', () => {
  assert.equal(matchInventoryProduct(products, 'ziemniaka 1410').product.id, 31);
  assert.equal(matchInventoryProduct(products, '5906018014105').product.id, 31);
  assert.equal(matchInventoryProduct(products, 'GZ-MINI').product.id, 32);
});

test('handler ponawia zapis po konflikcie CAS i nie wykonuje tego samego requestId drugi raz', async () => {
  let version = {
    value: {
      rev: 10,
      data: {
        artway_produkty_dodane: [{ id: '31', nazwa: 'Gorący Ziemniak Familijny', externalId: '1410', ean: '5906018014105' }],
        artway_stany: { 31: 1 },
        artway_ruchy_magazynowe: [],
      },
    },
    etag: 'etag-10',
    exists: true,
  };
  let writes = 0;
  const readVersioned = async () => structuredClone(version);
  const writeIfVersion = async (_key, record, expected) => {
    writes += 1;
    if (writes === 1) {
      assert.equal(expected.etag, 'etag-10');
      version = { value: { ...version.value, rev: 11 }, etag: 'etag-11', exists: true };
      return { modified: false };
    }
    assert.equal(expected.etag, 'etag-11');
    version = { value: structuredClone(record), etag: 'etag-12', exists: true };
    return { modified: true };
  };
  const handle = createInventoryNaturalCommandHandler({ readVersioned, writeIfVersion });
  const first = await handle('mam na stanie ziemniaka 1410 8 szt i zatwierdź', { requestId: 'telegram-123', user: 'Artway' });
  assert.match(first.message, /Stan zatwierdzony/);
  assert.equal(version.value.data.artway_stany['31'], 8);
  assert.equal(version.value.data.artway_ruchy_magazynowe.length, 1);
  assert.equal(version.value.data.artway_ruchy_magazynowe[0].sourceRequestId, 'telegram-123');
  assert.equal(writes, 2);

  const duplicate = await handle('mam na stanie ziemniaka 1410 8 szt i zatwierdź', { requestId: 'telegram-123', user: 'Artway' });
  assert.match(duplicate.message, /już zapisane/);
  assert.equal(version.value.data.artway_ruchy_magazynowe.length, 1);
  assert.equal(writes, 2);
});
