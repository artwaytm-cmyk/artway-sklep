import test from 'node:test';
import assert from 'node:assert/strict';
import { createInventoryNaturalCommandHandler, matchInventoryProduct, parseInventoryNaturalCommand } from '../src/backend/lib/domain/inventory-command.mjs';
import { createInventoryDecisionService, INVENTORY_DECISIONS_KEY } from '../src/backend/lib/domain/inventory-decisions.mjs';

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

test('pierwsza wiadomość i handler Agenta nie mogą wykonać końcowej decyzji magazynowej', async () => {
  const stores = { settings: {
    value: {
      rev: 10,
      data: {
        artway_produkty_dodane: [{ id: '31', nazwa: 'Gorący Ziemniak Familijny', externalId: '1410', ean: '5906018014105' }],
        artway_stany: { 31: 1 },
        artway_ruchy_magazynowe: [],
        artway_magazyn_produkty: { 31: { lokalizacja: 'A-R01-P01' } },
        artway_magazyn_lokalizacje: [{ kod: 'A-R01-P01', nazwa: 'Półka 1', aktywna: true }],
      },
    },
    etag: 'etag-10',
    exists: true,
  } };
  let etag = 20;
  const readVersioned = async (key, fallback) => structuredClone(stores[key] || { value: fallback, etag: '', exists: false });
  const writeIfVersion = async (key, record, expected) => {
    const current = stores[key];
    if (current && current.etag !== expected.etag) return { modified: false };
    if (!current && expected.exists !== false) return { modified: false };
    stores[key] = { value: structuredClone(record), etag: `etag-${++etag}`, exists: true };
    return { modified: true };
  };
  const decisions = createInventoryDecisionService({ readVersioned, writeIfVersion });
  const handle = createInventoryNaturalCommandHandler({ readVersioned, decisions });
  const meta = { requestId: 'telegram-123', user: 'Artway', userId: '100', chatId: '-200', source: 'telegram-webhook' };
  for (const command of ['/status', '/magazyn', '/zamowienia', '/agent sprawdź status']) {
    assert.equal(await handle(command, { ...meta, requestId: `slash-${command}` }), null, `${command} nie może być lokalizacją`);
  }
  const first = await handle('mam na stanie ziemniaka 1410 8 szt i zatwierdź', meta);
  assert.match(first.message, /Podaj lokalizację/);
  assert.equal(stores.settings.value.data.artway_stany['31'], 1);
  assert.equal(stores.settings.value.data.artway_ruchy_magazynowe.length, 0);
  const draft = stores[INVENTORY_DECISIONS_KEY].value.items[0];
  assert.equal(draft.status, 'awaiting_location');

  const locationQuestion = await handle(`czy lokalizacja ${draft.id} A-R01-P01?`, { ...meta, requestId: 'telegram-location-question' });
  assert.equal(locationQuestion, null);
  assert.equal(stores[INVENTORY_DECISIONS_KEY].value.items[0].status, 'awaiting_location');

  const located = await handle('A-R01-P01', { ...meta, requestId: 'telegram-124' });
  assert.match(located.message, /Potwierdź zmianę/);
  assert.equal(stores.settings.value.data.artway_stany['31'], 1);

  const blockedConfirmation = await handle(`potwierdzam ${draft.id}`, { ...meta, requestId: 'telegram-125' });
  assert.match(blockedConfirmation.message, /Decyzja wymaga człowieka/);
  const blockedRejection = await handle(`nie potwierdzam ${draft.id}`, { ...meta, requestId: 'telegram-126' });
  assert.match(blockedRejection.message, /Decyzja wymaga człowieka/);
  assert.equal(stores.settings.value.data.artway_stany['31'], 1);
  assert.equal(stores.settings.value.data.artway_ruchy_magazynowe.length, 0);
  assert.equal(stores[INVENTORY_DECISIONS_KEY].value.items[0].status, 'pending_confirmation');

  const confirmed = await decisions.confirm(draft.id, { id: '100', name: 'Artway przez zweryfikowany webhook Telegrama' });
  assert.equal(confirmed.decision.status, 'confirmed');
  assert.equal(stores.settings.value.data.artway_stany['31'], 8);
  assert.equal(stores.settings.value.data.artway_ruchy_magazynowe.length, 1);
  assert.equal(stores.settings.value.data.artway_ruchy_magazynowe[0].sourceRequestId, `inventory-decision:${draft.id}`);

  const duplicate = await handle('mam na stanie ziemniaka 1410 8 szt i zatwierdź', meta);
  assert.match(duplicate.message, /wcześniej potwierdzona przez administratora/);
  assert.equal(stores.settings.value.data.artway_ruchy_magazynowe.length, 1);
});
