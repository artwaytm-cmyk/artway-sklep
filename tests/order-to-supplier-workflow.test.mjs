import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { renderSupplierOrderEmail } from '../netlify/functions/lib/domain/supplier-order-email.mjs';
import { reconcileSupplierOrderDrafts } from '../netlify/functions/lib/domain/supplier-order-reconciliation.mjs';

const product = {
  id: 1410,
  nazwa: 'Ziemniak 1410',
  producent: 'Alexander',
  kodProducenta: '1410',
  ean: '5901234123457',
};
const settings = { artway_stany: { 1410: 8 }, artway_magazyn_produkty: {} };
const order = (nr, ilosc, status = 'nowe') => ({
  nr,
  status,
  inventoryMode: 'reserved_until_shipment',
  pozycjeDane: [{ id: 1410, nazwa: product.nazwa, ilosc }],
});

test('zamówienie klienta przechodzi stan → realny brak → szkic → zatwierdzenie → bezcenowy e-mail i Optima', () => {
  const covered = reconcileSupplierOrderDrafts({
    orders: [order('ATM-1', 5)],
    settings,
    products: [product],
    supplierDrafts: [],
    now: new Date('2026-07-15T16:00:00.000Z'),
  });
  assert.equal(covered.activeDrafts.length, 0, 'stan 8 pokrywa zamówienie 5 i nie tworzy zakupu');

  const shortage = reconcileSupplierOrderDrafts({
    orders: [order('ATM-1', 5), order('ATM-2', 5)],
    settings,
    products: [product],
    supplierDrafts: covered.drafts,
    now: new Date('2026-07-15T16:01:00.000Z'),
  });
  assert.equal(shortage.activeDrafts.length, 1);
  const draft = shortage.activeDrafts[0];
  assert.equal(draft.status, 'szkic');
  assert.equal(draft.supplier, 'Alexander');
  assert.equal(draft.pozycje[0].ilosc, 2, 'do producenta trafia tylko brak ponad fizyczny stan');
  assert.deepEqual(draft.pozycje[0].zamowienia, ['ATM-2'], 'zakup zostaje przypisany do zlecenia, którego nie pokrył stan');
  assert.deepEqual(draft.pozycje[0].orderAllocations, { 'ATM-2': 2 });

  const approved = structuredClone(shortage.drafts);
  approved[0].status = 'zaakceptowane';
  approved[0].approvedAt = '2026-07-15T16:02:00.000Z';
  approved[0].approvedBy = 'administrator';
  approved[0].approvalRevision = approved[0].revision;
  const stable = reconcileSupplierOrderDrafts({
    orders: [order('ATM-1', 5), order('ATM-2', 5)],
    settings,
    products: [product],
    supplierDrafts: approved,
    now: new Date('2026-07-15T16:03:00.000Z'),
  });
  assert.equal(stable.changed, false);
  assert.equal(stable.activeDrafts[0].approvalRevision, stable.activeDrafts[0].revision);

  const mail = renderSupplierOrderEmail(stable.activeDrafts[0], {
    name: 'Alexander',
    orderEmail: 'zamowienia@example.test',
  });
  assert.match(mail.text, /1410 \| Ziemniak 1410 \| 2/);
  assert.doesNotMatch(mail.text, /EAN|wartość|zł|\d+[,.]\d{2}/i);
  assert.doesNotMatch(mail.html.replace(/<[^>]+>/g, ' '), /EAN|wartość|zł|\d+[,.]\d{2}/i);
  assert.match(mail.text, /Pobieraj ceny z programu/);
  assert.equal(mail.optima.content, '1410;2;');
  assert.doesNotMatch(mail.optima.content, /\d+[,.]\d{2}$/);
});

test('nowy brak zwiększa rewizję i unieważnia wcześniejsze zatwierdzenie', () => {
  const first = reconcileSupplierOrderDrafts({
    orders: [order('ATM-1', 10)],
    settings,
    products: [product],
    supplierDrafts: [],
    now: new Date('2026-07-15T16:00:00.000Z'),
  });
  const approved = structuredClone(first.drafts);
  approved[0].status = 'zaakceptowane';
  approved[0].approvedAt = '2026-07-15T16:01:00.000Z';
  approved[0].approvalRevision = approved[0].revision;

  const changed = reconcileSupplierOrderDrafts({
    orders: [order('ATM-1', 10), order('ATM-2', 1)],
    settings,
    products: [product],
    supplierDrafts: approved,
    now: new Date('2026-07-15T16:02:00.000Z'),
  });
  assert.equal(changed.activeDrafts[0].pozycje[0].ilosc, 3);
  assert.equal(changed.activeDrafts[0].revision, first.activeDrafts[0].revision + 1);
  assert.equal(changed.activeDrafts[0].status, 'do sprawdzenia');
  assert.equal(Object.hasOwn(changed.activeDrafts[0], 'approvedAt'), false);
  assert.equal(Object.hasOwn(changed.activeDrafts[0], 'approvalRevision'), false);
});

test('szczegóły zamówienia pokazują kontrolę magazynu i drogę do szkicu producenta', async () => {
  const source = `${await readFile(new URL('../src/frontend/11-allegro-procurement-actions.js', import.meta.url), 'utf8')}\n${await readFile(new URL('../assets/admin.js', import.meta.url), 'utf8')}`;
  const styles = (await Promise.all(['07-admin-domains.css','07a-admin-domains.css','07b-admin-domains.css'].map(name=>readFile(new URL(`../src/styles/${name}`, import.meta.url), 'utf8')))).join('\n');
  assert.match(source, /function adminZaopatrzenieZamowieniaHTML/);
  assert.match(source, /Magazyn → producent/);
  assert.match(source, /Stan sprawdzony/);
  assert.match(source, /Zatwierdź i wyślij/);
  assert.match(source, /supplier-order-from-allegro/);
  assert.match(source, /Utwórz.*zamówienie producenta/);
  assert.match(source, /adminZaopatrzenieZamowieniaHTML\(z\)/);
  assert.match(styles, /\.procurement-flow/);
  assert.match(styles, /\.procurement-order-table/);
});
