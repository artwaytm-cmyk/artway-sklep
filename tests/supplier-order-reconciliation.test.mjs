import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reconcileSupplierOrderDrafts,
  resolveProductSupplier,
  supplierDraftIsEditable,
} from '../netlify/functions/lib/domain/supplier-order-reconciliation.mjs';

const NOW = new Date('2026-07-15T15:00:00.000Z');

function product(id, overrides = {}) {
  return {
    id,
    nazwa: `Produkt ${id}`,
    externalId: `KOD-${id}`,
    ean: `590000000${String(id).padStart(3, '0')}`,
    producent: 'Alexander',
    ...overrides,
  };
}

function order(number, productId, amount, overrides = {}) {
  return {
    nr: number,
    status: 'nowe',
    inventoryMode: 'reserved_until_shipment',
    pozycjeDane: [{ id: productId, ilosc: amount }],
    ...overrides,
  };
}

function run(overrides = {}) {
  return reconcileSupplierOrderDrafts({
    orders: [],
    products: [],
    settings: { artway_stany: {}, artway_magazyn_produkty: {} },
    supplierDrafts: [],
    now: NOW,
    ...overrides,
  });
}

test('stan wystarczający nie tworzy szkicu producenta', () => {
  const result = run({
    orders: [order('ATM-1', 1, 2)],
    products: [product(1)],
    settings: { artway_stany: { 1: 5 } },
  });

  assert.equal(result.changed, false);
  assert.deepEqual(result.activeDrafts, []);
  assert.deepEqual(result.shortages, []);
});

test('częściowy stan tworzy tylko rzeczywisty brak, bez odejmowania stanu przy create', () => {
  const settings = { artway_stany: { 1: 2 } };
  const result = run({ orders: [order('ATM-2', 1, 5)], products: [product(1)], settings });
  const [draft] = result.activeDrafts;
  const [line] = draft.pozycje;

  assert.equal(draft.supplier, 'Alexander');
  assert.equal(draft.revision, 1);
  assert.equal(line.stan, 2);
  assert.equal(line.rezerwacje, 5);
  assert.equal(line.iloscPotrzebna, 3);
  assert.equal(line.ilosc, 3);
  assert.equal(line.manualExtra, 0);
  assert.deepEqual(line.zamowienia, ['ATM-2']);
  assert.deepEqual(settings, { artway_stany: { 1: 2 } }, 'moduł nie zmienia fizycznego stanu');
});

test('brak wynika z sumy rezerwacji wszystkich aktywnych zamówień', () => {
  const result = run({
    orders: [
      order('ATM-2A', 1, 2),
      order('ATM-2B', 1, 4),
      order('ATM-2C', 1, 20, { status: 'wysłane' }),
    ],
    products: [product(1)],
    settings: { artway_stany: { 1: 3 } },
  });

  const [line] = result.activeDrafts[0].pozycje;
  assert.equal(line.rezerwacje, 6);
  assert.equal(line.iloscPotrzebna, 3);
  assert.deepEqual(line.zamowienia, ['ATM-2B']);
  assert.deepEqual(line.orderAllocations, { 'ATM-2B': 3 }, 'stan pokrywa pierwsze zlecenie, a zakup zostaje przypisany do rzeczywistego braku');
  assert.equal(result.diagnostics.skippedInactiveOrders, 1);
});

test('powstaje dokładnie jeden osobny szkic na każdego dostawcę', () => {
  const products = [
    product(1, { producent: 'Niewłaściwa marka' }),
    product(2, { producent: '', marka: 'Multigra' }),
  ];
  const settings = {
    artway_stany: { 1: 0, 2: 0 },
    artway_magazyn_produkty: { 1: { dostawca: 'Alexander' } },
  };
  const result = run({
    orders: [order('ATM-3', 1, 1), order('ATM-4', 2, 2)],
    products,
    settings,
  });

  assert.equal(result.activeDrafts.length, 2);
  assert.deepEqual(result.activeDrafts.map((draft) => draft.supplier).sort(), ['Alexander', 'Multigra']);
  assert.ok(result.activeDrafts.every((draft) => new Set(draft.pozycje.map((line) => line.dostawca)).size === 1));
});

test('retry przeliczenia jest idempotentny i nie podwaja ilości ani szkiców', () => {
  const first = run({
    orders: [order('ATM-5', 1, 4)],
    products: [product(1)],
    settings: { artway_stany: { 1: 1 } },
  });
  const second = run({
    orders: [order('ATM-5', 1, 4)],
    products: [product(1)],
    settings: { artway_stany: { 1: 1 } },
    supplierDrafts: first.drafts,
  });

  assert.equal(first.activeDrafts.length, 1);
  assert.equal(second.activeDrafts.length, 1);
  assert.equal(second.activeDrafts[0].id, first.activeDrafts[0].id);
  assert.equal(second.activeDrafts[0].revision, 1);
  assert.equal(second.activeDrafts[0].pozycje[0].ilosc, 3);
  assert.equal(second.changed, false);
  assert.deepEqual(second.unchanged, [first.activeDrafts[0].id]);
});

test('legacy aktywny szkic bez rewizji dostaje wersję 1 nawet bez zmiany treści', () => {
  const initial = run({
    orders: [order('ATM-LEGACY-REV', 1, 2)], products: [product(1)], settings: { artway_stany: { 1: 0 } },
  });
  const legacy = structuredClone(initial.drafts[0]);
  delete legacy.revision;
  const migrated = run({
    orders: [order('ATM-LEGACY-REV', 1, 2)], products: [product(1)], settings: { artway_stany: { 1: 0 } }, supplierDrafts: [legacy],
  });
  assert.equal(migrated.changed, true);
  assert.equal(migrated.activeDrafts[0].revision, 1);
});

test('zmniejszenie i anulowanie zamówienia obniża ilość, zachowując wyłącznie ręczną nadwyżkę', () => {
  const initial = run({
    orders: [order('ATM-6', 1, 5)],
    products: [product(1)],
    settings: { artway_stany: { 1: 1 } },
  });
  const approved = structuredClone(initial.drafts);
  approved[0].pozycje[0].manualExtra = 2;
  approved[0].pozycje[0].nadwyzka = 2;
  approved[0].pozycje[0].ilosc = 6;
  approved[0].status = 'zaakceptowane';
  approved[0].approvedAt = '2026-07-15T15:01:00.000Z';
  approved[0].approvedBy = 'admin@example.com';
  approved[0].approvalRevision = 1;

  const decreased = run({
    orders: [order('ATM-6', 1, 2)],
    products: [product(1)],
    settings: { artway_stany: { 1: 1 } },
    supplierDrafts: approved,
  });
  const changedDraft = decreased.activeDrafts[0];
  assert.equal(changedDraft.pozycje[0].iloscPotrzebna, 1);
  assert.equal(changedDraft.pozycje[0].manualExtra, 2);
  assert.equal(changedDraft.pozycje[0].ilosc, 3);
  assert.equal(changedDraft.revision, 2);
  assert.equal(changedDraft.status, 'do sprawdzenia');
  assert.equal(Object.hasOwn(changedDraft, 'approvedAt'), false);
  assert.equal(Object.hasOwn(changedDraft, 'approvalRevision'), false);

  const cancelled = run({
    orders: [order('ATM-6', 1, 2, { status: 'anulowane' })],
    products: [product(1)],
    settings: { artway_stany: { 1: 1 } },
    supplierDrafts: decreased.drafts,
  });
  assert.equal(cancelled.activeDrafts[0].pozycje[0].iloscPotrzebna, 0);
  assert.equal(cancelled.activeDrafts[0].pozycje[0].manualExtra, 2);
  assert.equal(cancelled.activeDrafts[0].pozycje[0].ilosc, 2);
  assert.equal(cancelled.activeDrafts[0].revision, 3);
});

test('anulowanie usuwa automatyczną pozycję, gdy nie ma ręcznej nadwyżki', () => {
  const initial = run({
    orders: [order('ATM-7', 1, 2)],
    products: [product(1)],
    settings: { artway_stany: { 1: 0 } },
  });
  const result = run({
    orders: [order('ATM-7', 1, 2, { status: 'anulowane' })],
    products: [product(1)],
    settings: { artway_stany: { 1: 0 } },
    supplierDrafts: initial.drafts,
  });

  assert.equal(result.activeDrafts.length, 0, 'pusty automatyczny dokument nie pozostaje aktywnym szkicem');
  const archived = result.drafts.find((item) => item.id === initial.drafts[0].id);
  assert.equal(archived.status, 'wyczyszczone');
  assert.deepEqual(archived.pozycje, []);
  assert.equal(archived.sztuk, 0);
  assert.equal(archived.revision, 2);
});

test('legacy deducted_on_create używa stanPrzed i nie rezerwuje ponownie obecnego stanu', () => {
  const legacy = order('ATM-LEGACY', 1, 3, { inventoryMode: 'deducted_on_create' });
  const result = run({
    orders: [legacy],
    products: [product(1)],
    settings: { artway_stany: { 1: 0 } },
    stockMovementByOrderProduct: new Map([
      ['ATM-LEGACY::1', { stanPrzed: 2, stanPo: 0, ilosc: -3 }],
    ]),
  });

  const line = result.activeDrafts[0].pozycje[0];
  assert.equal(line.rezerwacje, 0);
  assert.equal(line.legacyShortage, 1);
  assert.equal(line.iloscPotrzebna, 1);
});

test('legacy bez ruchu nie tworzy fałszywego pełnego braku i zgłasza diagnostykę', () => {
  const result = run({
    orders: [order('ATM-OLD', 1, 3, { inventoryMode: 'deducted_on_create' })],
    products: [product(1)],
    settings: { artway_stany: { 1: 0 } },
  });

  assert.equal(result.activeDrafts.length, 0);
  assert.deepEqual(result.diagnostics.legacyWithoutMovement, [
    { orderId: 'ATM-OLD', productId: '1', quantity: 3 },
  ]);
});

test('wspólny priorytet wybiera EXTERNAL_ID, a wewnętrzne ID nigdy nie staje się kodem eksportowym', () => {
  const preferred = run({
    orders: [order('ATM-KOD-1', 91, 1)],
    products: [product(91, { kodProducenta: 'ALEX-91', externalId: 'EXT-91', sku: 'SKU-91' })],
    settings: { artway_stany: { 91: 0 }, artway_magazyn_produkty: { 91: { kod: 'META-91' } } },
  });
  assert.equal(preferred.activeDrafts[0].pozycje[0].kod, 'EXT-91');
  assert.equal(preferred.activeDrafts[0].pozycje[0].externalId, 'EXT-91');
  assert.equal(preferred.activeDrafts[0].pozycje[0].sku, 'SKU-91');
  assert.equal(preferred.activeDrafts[0].pozycje[0].kodProducenta, 'ALEX-91');

  const withoutCode = run({
    orders: [order('ATM-KOD-2', 92, 1)],
    products: [{ id: 92, nazwa: 'Bez kodu', producent: 'Alexander' }],
    settings: { artway_stany: { 92: 0 } },
  });
  assert.equal(withoutCode.activeDrafts[0].pozycje[0].kod, '—');
  assert.notEqual(withoutCode.activeDrafts[0].pozycje[0].kod, '92');
});

test('wysłana i nieprzyjęta ilość pokrywa brak i nie jest zamawiana drugi raz', () => {
  const committed = {
    id: 'SENT-1',
    supplier: 'Alexander',
    status: 'wysłane do producenta',
    pozycje: [{ produktId: '1', ilosc: 3, przyjeto: 1, dostawca: 'Alexander' }],
  };
  const result = run({
    orders: [order('ATM-8', 1, 4)],
    products: [product(1)],
    settings: { artway_stany: { 1: 1 } },
    supplierDrafts: [committed],
  });

  assert.equal(result.shortages[0].committedQuantity, 2);
  assert.equal(result.shortages[0].requiredQuantity, 1);
  assert.equal(result.activeDrafts[0].pozycje[0].ilosc, 1);
});

test('rewizja zablokowana na czas SMTP pokrywa brak i nie tworzy drugiego szkicu', () => {
  const sending = {
    id: 'SENDING-1', supplier: 'Alexander', status: 'wysyłanie e-mail', revision: 4,
    sendLock: { id: 'send-lock', revision: 4, createdAt: NOW.toISOString() },
    pozycje: [{ produktId: '1', ilosc: 3, przyjeto: 0, dostawca: 'Alexander' }],
  };
  const result = run({
    orders: [order('ATM-SMTP-RACE', 1, 4)],
    products: [product(1)],
    settings: { artway_stany: { 1: 1 } },
    supplierDrafts: [sending],
  });
  assert.equal(result.changed, false);
  assert.equal(result.drafts.length, 1);
  assert.equal(result.drafts[0].id, 'SENDING-1');
  assert.equal(result.activeDrafts.length, 0);
  assert.deepEqual(result.shortages, []);
});

test('importowany produkt z wysokim ID jest pełnoprawnie mapowany po kluczu tekstowym', () => {
  const importedId = 1_000_023;
  const result = run({
    orders: [order('ATM-IMPORT', importedId, 2)],
    products: [product(importedId, {
      producent: '',
      sourceUrl: 'https://www.sklep.alexander.com.pl/product-pol-1188-ORIGAMI-3D-KWIATY.html',
      storageOrigin: 'product-link-file-import',
    })],
    settings: { artway_stany: { [importedId]: 0 } },
  });

  assert.equal(result.activeDrafts[0].supplier, 'Alexander');
  assert.equal(result.activeDrafts[0].pozycje[0].produktId, String(importedId));
  assert.equal(result.activeDrafts[0].pozycje[0].ilosc, 2);
});

test('mapowanie dostawcy respektuje kolejność fallbacków i brak przypisania', () => {
  const settings = { artway_magazyn_produkty: { 1: { dostawca: 'Magazynowy dostawca' } } };
  assert.equal(resolveProductSupplier(product(1, { producent: 'Alexander' }), settings, '1'), 'Magazynowy dostawca');
  assert.equal(resolveProductSupplier(product(2, { producent: '', marka: 'Multigra' }), {}, '2'), 'Multigra');
  assert.equal(resolveProductSupplier(product(20, { producent: 'MULTIGRA Sp. z o.o.' }), {}, '20'), 'Multigra');
  assert.equal(resolveProductSupplier(product(3, { producent: '', sourceUrl: 'https://multigra.com.pl/p/3' }), {}, '3'), 'Multigra');
  assert.equal(resolveProductSupplier(product(4, { producent: '', sourceUrl: '' }), {}, '4'), 'Bez przypisanego dostawcy');
  assert.equal(supplierDraftIsEditable({ status: 'zaakceptowane' }), true);
  assert.equal(supplierDraftIsEditable({ status: 'wysłane do producenta' }), false);
});

test('funkcja nie mutuje zamówień, katalogu ani przekazanych szkiców', () => {
  const orders = [order('ATM-9', 1, 2)];
  const products = [product(1)];
  const drafts = [{
    id: 'D-1', supplier: 'Alexander', status: 'szkic', revision: 1,
    pozycje: [{ produktId: '1', kod: 'KOD-1', nazwa: 'Produkt 1', dostawca: 'Alexander', ilosc: 1, iloscPotrzebna: 1 }],
  }];
  const snapshot = structuredClone({ orders, products, drafts });
  run({ orders, products, settings: { artway_stany: { 1: 0 } }, supplierDrafts: drafts });
  assert.deepEqual({ orders, products, drafts }, snapshot);
});
