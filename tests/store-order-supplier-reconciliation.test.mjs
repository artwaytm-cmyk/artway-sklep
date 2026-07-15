import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStoreOrderSupplierReconciliation,
  normalizeOrderInventoryModes,
} from '../netlify/functions/lib/store-order-supplier-reconciliation.mjs';
import { markAllegroInventoryTransitions } from '../netlify/functions/lib/domain/allegro-supplier-demand.mjs';

const FIXED_NOW = new Date('2026-07-15T16:00:00.000Z');

function memoryRepository(initial = {}, conflicts = {}) {
  const records = new Map();
  const versions = new Map();
  for (const [key, value] of Object.entries(initial)) {
    records.set(key, structuredClone(value));
    versions.set(key, 1);
  }
  const remainingConflicts = { ...conflicts };
  return {
    records,
    async readVersioned(key, fallback) {
      const exists = records.has(key);
      return {
        value: structuredClone(exists ? records.get(key) : fallback),
        exists,
        etag: exists ? `v${versions.get(key)}` : '',
      };
    },
    async writeIfVersion(key, value, version) {
      if ((remainingConflicts[key] || 0) > 0) {
        remainingConflicts[key] -= 1;
        return { modified: false };
      }
      const exists = records.has(key);
      const currentEtag = exists ? `v${versions.get(key)}` : '';
      if (exists !== version.exists || (exists && currentEtag !== version.etag)) return { modified: false };
      records.set(key, structuredClone(value));
      versions.set(key, (versions.get(key) || 0) + 1);
      return { modified: true };
    },
  };
}

function service(repo, overrides = {}) {
  return createStoreOrderSupplierReconciliation({
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
    mergeImportedSettings: async (data) => data,
    catalogProducts: (data) => data.artway_produkty_dodane || [],
    now: () => FIXED_NOW,
    ...overrides,
  });
}

test('zapis zamówienia jest CAS, ponawia konflikt i nie tworzy duplikatu', async () => {
  const repo = memoryRepository({ orders: { items: [], updated_at: null } }, { orders: 1 });
  const workflow = service(repo);
  const order = { nr: 'ATM-100', inventoryMode: 'reserved_until_shipment', pozycjeDane: [] };

  const first = await workflow.saveOrder({ order });
  const duplicate = await workflow.saveOrder({ order });

  assert.equal(first.stored, true);
  assert.equal(first.attempts, 2);
  assert.equal(duplicate.stored, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(repo.records.get('orders').items.length, 1);
});

test('usunięty numer zamówienia nie wraca do aktywnego zbioru', async () => {
  const repo = memoryRepository({ orders: { items: [] } });
  const workflow = service(repo);
  const result = await workflow.saveOrder({
    order: { nr: 'ATM-USUNIETE' },
    deletedOrderNumbers: new Set(['ATM-USUNIETE']),
  });

  assert.equal(result.deleted, true);
  assert.equal(result.stored, false);
  assert.deepEqual(repo.records.get('orders').items, []);
});

test('nowe zamówienie rezerwuje stan i tworzy szkic wyłącznie na rzeczywisty brak', async () => {
  const repo = memoryRepository({
    orders: {
      items: [{
        nr: 'ATM-101', status: 'nowe', inventoryMode: 'reserved_until_shipment',
        pozycjeDane: [{ id: 1, ilosc: 5 }],
      }],
    },
    settings: {
      rev: 8,
      data: {
        artway_stany: { 1: 2 },
        artway_produkty_dodane: [{ id: 1, nazwa: 'Gra', producent: 'Alexander', externalId: '1748', ean: '5901234567890' }],
        artway_agent_ai_zlecenia: [],
      },
    },
  });
  const workflow = service(repo);

  const result = await workflow.reconcileDrafts();
  const saved = repo.records.get('settings');
  const line = saved.data.artway_agent_ai_zlecenia[0].pozycje[0];

  assert.equal(result.changed, true);
  assert.equal(saved.rev, 9);
  assert.deepEqual(saved.data.artway_stany, { 1: 2 }, 'przeliczenie nie odejmuje stanu fizycznego');
  assert.equal(line.ilosc, 3);
  assert.equal(line.kod, '1748');
  assert.equal(line.ean, '5901234567890');
});

test('katalog importowany jest dołączany do obliczeń, lecz nie wraca do rekordu settings', async () => {
  let mergeCalls = 0;
  const repo = memoryRepository({
    orders: { items: [{ nr: 'ATM-IMPORT', status: 'nowe', inventoryMode: 'reserved_until_shipment', pozycjeDane: [{ id: 1000001, ilosc: 2 }] }] },
    settings: { rev: 2, data: { artway_stany: {}, artway_agent_ai_zlecenia: [] } },
  });
  const workflow = service(repo, {
    mergeImportedSettings: async (data) => {
      mergeCalls += 1;
      return {
        ...data,
        artway_produkty_dodane: [{ id: 1000001, nazwa: 'Produkt importowany', producent: 'Multigra', externalId: 'MG-1' }],
      };
    },
  });

  await workflow.reconcileDrafts();
  const savedData = repo.records.get('settings').data;

  assert.equal(mergeCalls, 1);
  assert.equal(savedData.artway_produkty_dodane, undefined, 'duży scalony katalog pozostaje w shardach');
  assert.equal(savedData.artway_agent_ai_zlecenia[0].supplier, 'Multigra');
  assert.equal(savedData.artway_agent_ai_zlecenia[0].pozycje[0].produktId, '1000001');
});

test('legacy bez inventoryMode jest rozpoznane po order-stock i nie liczy stanu podwójnie', async () => {
  const movements = [{
    sourceRequestId: 'order-stock:ATM-LEGACY', dokument: 'ATM-LEGACY', produktId: '1', stanPrzed: 2, stanPo: 0, ilosc: -3,
  }];
  const normalized = normalizeOrderInventoryModes([{ nr: 'ATM-LEGACY' }, { nr: 'ATM-NOWE' }], { artway_ruchy_magazynowe: movements });
  assert.equal(normalized[0].inventoryMode, 'deducted_on_create');
  assert.equal(normalized[1].inventoryMode, 'reserved_until_shipment');

  const repo = memoryRepository({
    orders: { items: [{ nr: 'ATM-LEGACY', status: 'nowe', pozycjeDane: [{ id: 1, ilosc: 3 }] }] },
    settings: {
      rev: 1,
      data: {
        artway_stany: { 1: 0 }, artway_ruchy_magazynowe: movements,
        artway_produkty_dodane: [{ id: 1, nazwa: 'Gra legacy', producent: 'Alexander' }],
        artway_agent_ai_zlecenia: [],
      },
    },
  });
  await service(repo).reconcileDrafts();
  const line = repo.records.get('settings').data.artway_agent_ai_zlecenia[0].pozycje[0];
  assert.equal(line.rezerwacje, 0);
  assert.equal(line.legacyShortage, 1);
  assert.equal(line.ilosc, 1);
});

test('awaria przeliczenia szkicu nie cofa już zapisanego zamówienia', async () => {
  const repo = memoryRepository({ orders: { items: [] }, settings: { rev: 0, data: {} } });
  const workflow = service(repo, {
    mergeImportedSettings: async () => { throw new Error('katalog chwilowo niedostępny'); },
  });
  await workflow.saveOrder({ order: { nr: 'ATM-102', inventoryMode: 'reserved_until_shipment', pozycjeDane: [] } });

  await assert.rejects(() => workflow.reconcileDrafts(), /katalog chwilowo niedostępny/);
  assert.equal(repo.records.get('orders').items[0].nr, 'ATM-102');
});

test('stan fizyczny jest odejmowany raz dopiero po wysłaniu zamówienia', async () => {
  const order = {
    nr: 'ATM-WYSYLKA', status: 'nowe', inventoryMode: 'reserved_until_shipment',
    pozycjeDane: [{ id: 1, nazwa: 'Ziemniak 1410', ilosc: 3 }],
  };
  const repo = memoryRepository({
    orders: { items: [order] },
    settings: { rev: 3, data: { artway_stany: { 1: 8 }, artway_ruchy_magazynowe: [] } },
  });
  const workflow = service(repo);

  const beforeShipment = await workflow.deductInventoryOnShipment(order);
  assert.equal(beforeShipment.eligible, false);
  assert.equal(repo.records.get('settings').data.artway_stany[1], 8);

  const shipped = { ...order, status: 'nadane' };
  const first = await workflow.deductInventoryOnShipment(shipped);
  const second = await workflow.deductInventoryOnShipment(shipped);
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(second.alreadyDeducted, true);
  assert.equal(repo.records.get('settings').data.artway_stany[1], 5);
  assert.equal(repo.records.get('settings').data.artway_ruchy_magazynowe.length, 1);
  assert.equal(repo.records.get('settings').data.artway_ruchy_magazynowe[0].sourceRequestId, 'order-stock:ATM-WYSYLKA');

  await workflow.markOrderInventoryMode({ number: order.nr, inventoryMode: first.inventoryMode, deductedAt: FIXED_NOW.toISOString() });
  assert.equal(repo.records.get('orders').items[0].inventoryMode, 'deducted_on_shipment');
});

test('anulowanie przed wysyłką zwalnia rezerwację bez ruchu fizycznego stanu', async () => {
  const repo = memoryRepository({
    orders: { items: [] },
    settings: { rev: 0, data: { artway_stany: { 1: 8 }, artway_ruchy_magazynowe: [] } },
  });
  const result = await service(repo).deductInventoryOnShipment({
    nr: 'ATM-ANULOWANE', status: 'anulowane', inventoryMode: 'reserved_until_shipment',
    pozycjeDane: [{ id: 1, ilosc: 3 }],
  });

  assert.equal(result.eligible, false);
  assert.equal(repo.records.get('settings').data.artway_stany[1], 8);
  assert.deepEqual(repo.records.get('settings').data.artway_ruchy_magazynowe, []);
});

test('Allegro zasila ten sam Plan bez duplikatów; spakowane rezerwuje do wysyłki, a status końcowy usuwa brak', async () => {
  const position = (offerId, quantity) => ({ offerId, productId: 'P-1', nazwa: 'Gra Allegro', ilosc: quantity, match: 'EAN/GTIN', confidence: 99, supplierMatchVerified: true });
  const repo = memoryRepository({
    orders: { items: [] },
    allegro_orders: { items: [
      { id: 'ALG-SPAKOWANE', status: 'READY_FOR_PROCESSING', warehouseStage: 'spakowane', agentAnalysis: { positions: [position('O-1', 1)] } },
      { id: 'ALG-NOWE', status: 'READY_FOR_PROCESSING', warehouseStage: 'do_sprawdzenia', agentAnalysis: { positions: [position('O-2', 1)] } },
    ] },
    allegro_mappings: { items: {} },
    settings: { rev: 4, data: {
      artway_stany: { 'P-1': 1 },
      artway_produkty_dodane: [{ id: 'P-1', nazwa: 'Gra Allegro', producent: 'Alexander', externalId: 'A-1' }],
      artway_agent_ai_zlecenia: [],
    } },
  });
  const workflow = service(repo);

  const first = await workflow.reconcileDrafts();
  const firstDrafts = repo.records.get('settings').data.artway_agent_ai_zlecenia;
  assert.equal(first.changed, true);
  assert.equal(first.diagnostics.allegro.converted, 2);
  assert.equal(firstDrafts.length, 1);
  assert.equal(firstDrafts[0].pozycje.length, 1);
  assert.equal(firstDrafts[0].pozycje[0].iloscPotrzebna, 1, '2 rezerwacje przy stanie 1 dają brak 1');

  const second = await workflow.reconcileDrafts();
  const secondDrafts = repo.records.get('settings').data.artway_agent_ai_zlecenia;
  assert.equal(second.changed, false);
  assert.equal(secondDrafts.length, 1);
  assert.equal(secondDrafts[0].pozycje.length, 1, 'ponowna synchronizacja nie dopisuje tej samej pozycji');
  assert.equal(secondDrafts[0].pozycje[0].iloscPotrzebna, 1);

  repo.records.set('allegro_orders', { items: [
    { id: 'ALG-SPAKOWANE', status: 'SENT', warehouseStage: 'spakowane', agentAnalysis: { positions: [position('O-1', 1)] } },
    { id: 'ALG-NOWE', status: 'CANCELLED', warehouseStage: 'do_sprawdzenia', agentAnalysis: { positions: [position('O-2', 1)] } },
  ] });
  const closed = await workflow.reconcileDrafts();
  const closedDrafts = repo.records.get('settings').data.artway_agent_ai_zlecenia;
  assert.equal(closed.changed, true);
  assert.equal(closed.diagnostics.allegro.skippedFinal, 2);
  assert.equal(closedDrafts.length, 1, 'historia dokumentu nie jest kasowana');
  assert.deepEqual(closedDrafts[0].pozycje, [], 'zamknięte zlecenia nie pozostawiają aktywnego braku');
  assert.equal(closedDrafts[0].status, 'wyczyszczone');
});

test('oferta Allegro bez produktu sklepu tworzy osobny szkic producenta z kodem oferty', async () => {
  const repo = memoryRepository({
    orders: { items: [] },
    allegro_orders: { items: [{
      id: 'ALG-MOZAIKA', status: 'READY_FOR_PROCESSING', fulfillmentStatus: 'NEW',
      lineItems: [{ offerId: 'O-MOZAIKA', externalId: 'M0195', offerName: 'Mozaika 200 elementów - Multigra', quantity: 1 }],
      agentAnalysis: { positions: [{ offerId: 'O-MOZAIKA', nazwa: 'Mozaika 200 elementów', ilosc: 1, decision: 'nierozpoznany' }] },
    }] },
    allegro_mappings: { items: { 'O-MOZAIKA': { productId: '', blocked: true, operator: 'admin-unmapped' } } },
    allegro_offers: { items: [{
      id: 'O-MOZAIKA', name: 'Mozaika 200 elementów - Multigra - gry dla każdego', externalId: 'M0195',
      ean: '05906395301959', manufacturerCode: 'MG1959',
    }] },
    settings: { rev: 1, data: { artway_stany: {}, artway_produkty_dodane: [], artway_agent_ai_zlecenia: [] } },
  });

  const result = await service(repo).reconcileDrafts();
  const draft = repo.records.get('settings').data.artway_agent_ai_zlecenia.find((item) => item.pozycje?.length);
  assert.equal(result.changed, true);
  assert.equal(draft.supplier, 'Multigra');
  assert.deepEqual(draft.pozycje.map((line) => ({ id: line.produktId, kod: line.kod, ilosc: line.ilosc })), [
    { id: 'allegro-offer:O-MOZAIKA', kod: 'M0195', ilosc: 1 },
  ]);
});

test('wysłane Allegro zdejmuje zmapowany stan dokładnie raz, a kolejne zlecenie widzi rzeczywisty brak', async () => {
  const mappedPosition = (quantity = 1) => ({ offerId: 'O-1', productId: 'P-1', nazwa: 'Gra Allegro', ilosc: quantity, match: 'EAN/GTIN', confidence: 99, supplierMatchVerified: true });
  const sent = { id: 'ALG-SENT', status: 'READY_FOR_PROCESSING', fulfillmentStatus: 'SENT', inventoryDeductionPending: true, agentAnalysis: { positions: [mappedPosition()] } };
  const active = { id: 'ALG-ACTIVE', status: 'READY_FOR_PROCESSING', fulfillmentStatus: 'NEW', agentAnalysis: { positions: [mappedPosition()] } };
  const repo = memoryRepository({
    orders: { items: [] },
    allegro_orders: { items: [sent] },
    allegro_mappings: { items: { 'O-1': { productId: 'P-1' } } },
    settings: { rev: 1, data: {
      artway_stany: { 'P-1': 1 }, artway_ruchy_magazynowe: [],
      artway_produkty_dodane: [{ id: 'P-1', nazwa: 'Gra Allegro', producent: 'Alexander', externalId: 'A-1' }],
      artway_agent_ai_zlecenia: [],
    } },
  });
  const workflow = service(repo);

  const historicalBefore = { id: 'ALG-HISTORYCZNE', status: 'READY_FOR_PROCESSING', fulfillmentStatus: 'PROCESSING', agentAnalysis: { positions: [mappedPosition()] } };
  const historicalAfter = { ...historicalBefore, fulfillmentStatus: 'SENT' };
  const baselineItems = markAllegroInventoryTransitions([historicalAfter], [historicalBefore], { cutover: true, at: FIXED_NOW });
  const historical = await workflow.finalizeAllegroInventory(baselineItems);
  assert.equal(historical.ok, true);
  assert.equal(historical.changed, 0);
  assert.equal(repo.records.get('settings').data.artway_stany['P-1'], 1, 'historyczne SENT bez markera cutover nie jest odejmowane');

  const first = await workflow.finalizeAllegroInventory([sent]);
  const retry = await workflow.finalizeAllegroInventory([sent]);
  assert.equal(first.ok, true);
  assert.equal(first.changed, 1);
  assert.equal(first.marked, 1);
  assert.equal(repo.records.get('allegro_orders').items[0].inventoryDeductionPending, false);
  assert.equal(repo.records.get('allegro_orders').items[0].inventoryMode, 'deducted_on_shipment');
  assert.equal(retry.ok, true);
  assert.equal(retry.alreadyDeducted, 1);
  const settled = await workflow.finalizeAllegroInventory(repo.records.get('allegro_orders').items);
  assert.equal(settled.results.length, 0, 'zamknięty marker nie jest ponownie skanowany co 15 minut');
  assert.equal(repo.records.get('settings').data.artway_stany['P-1'], 0);
  assert.equal(repo.records.get('settings').data.artway_ruchy_magazynowe.length, 1);
  assert.equal(repo.records.get('settings').data.artway_ruchy_magazynowe[0].sourceRequestId, 'order-stock:Allegro ALG-SENT');

  repo.records.set('allegro_orders', { items: [sent, active] });
  await workflow.reconcileDrafts();
  const draft = repo.records.get('settings').data.artway_agent_ai_zlecenia.find((item) => item.pozycje?.length);
  assert.equal(draft.pozycje[0].produktId, 'P-1');
  assert.equal(draft.pozycje[0].iloscPotrzebna, 1);
});

test('częściowo zmapowane wysłane Allegro blokuje cały ruch i pozostawia stan do bezpiecznego retry', async () => {
  const repo = memoryRepository({
    orders: { items: [] }, allegro_orders: { items: [] },
    allegro_mappings: { items: { 'O-1': { productId: 'P-1' } } },
    settings: { rev: 1, data: {
      artway_stany: { 'P-1': 2 }, artway_ruchy_magazynowe: [],
      artway_produkty_dodane: [{ id: 'P-1', nazwa: 'Gra', producent: 'Alexander', externalId: 'A-1' }],
      artway_agent_ai_zlecenia: [],
    } },
  });
  const result = await service(repo).finalizeAllegroInventory([{
    id: 'ALG-PARTIAL', status: 'READY_FOR_PROCESSING', fulfillmentStatus: 'SENT', inventoryDeductionPending: true,
    lineItems: [{ offerId: 'O-1', quantity: 1 }, { offerId: 'O-X', quantity: 1 }],
  }]);
  assert.equal(result.ok, false);
  assert.equal(result.pendingRetry, 1);
  assert.equal(repo.records.get('settings').data.artway_stany['P-1'], 2);
  assert.deepEqual(repo.records.get('settings').data.artway_ruchy_magazynowe, []);
});
