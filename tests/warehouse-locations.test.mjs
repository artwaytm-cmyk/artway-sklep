import test from 'node:test';
import assert from 'node:assert/strict';
import { createWarehouseLocationService } from '../src/backend/lib/domain/warehouse-locations.mjs';

function harness() {
  let value = { data: {
    artway_stany: { '1': 8, '2': 3 },
    artway_magazyn_lokalizacje: [
      { kod: 'PAK', nazwa: 'Pakownia', typ: 'strefa', aktywna: true },
      { kod: 'PAK-RA', nazwa: 'Regał A', typ: 'regał', parentKod: 'PAK', aktywna: true },
      { kod: 'PAK-RA-P01', nazwa: 'Półka 1', typ: 'półka', parentKod: 'PAK-RA', aktywna: true },
      { kod: 'PAK-RB', nazwa: 'Regał B', typ: 'regał', parentKod: 'PAK', aktywna: true },
      { kod: 'PAK-RB-P01', nazwa: 'Półka 1', typ: 'półka', parentKod: 'PAK-RB', aktywna: true },
    ],
    artway_magazyn_produkty: { '1': { lokalizacja: 'PAK-RA-P01' }, '2': { lokalizacja: 'PAK-RB-P01' } },
    artway_dokumenty_magazynowe: [
      { id: 'draft', number: 'PZ/1', status: 'draft', revision: 1, lines: [{ lineId: 'l1', productId: '1', location: 'PAK-RA-P01' }] },
      { id: 'history', number: 'PZ/0', status: 'confirmed', revision: 2, lines: [{ lineId: 'l0', productId: '1', location: 'PAK-RA-P01' }] },
    ],
  }, rev: 1, updated_at: null };
  let etag = 1;
  const service = createWarehouseLocationService({
    readVersioned: async () => ({ value: structuredClone(value), etag: String(etag), exists: true }),
    writeIfVersion: async (_key, next, version) => {
      if (String(version.etag) !== String(etag)) return { modified: false };
      value = structuredClone(next); etag++; return { modified: true };
    },
    now: () => new Date('2026-07-20T12:00:00.000Z'),
  });
  return { service, current: () => structuredClone(value) };
}

test('podgląd usunięcia pokazuje produkty, szkice i historię bez zmiany danych', async () => {
  const { service, current } = harness(), before = current();
  const preview = await service.preview({ code: 'PAK-RA-P01' });
  assert.equal(preview.affectedProducts, 1);
  assert.equal(preview.affectedDraftLines, 1);
  assert.equal(preview.historicalReferences, 1);
  assert.equal(preview.directDelete, false);
  assert.deepEqual(current(), before);
});

test('usunięcie półki przenosi kartotekę i szkic, ale nie zmienia stanu ani historii', async () => {
  const { service, current } = harness();
  const result = await service.remove({ code: 'PAK-RA-P01', targetLocation: 'PAK-RB-P01' }, 'admin@artway.pl');
  assert.equal(result.deleted, true);
  assert.equal(result.movedProducts, 1);
  assert.equal(current().data.artway_magazyn_produkty['1'].lokalizacja, 'PAK-RB-P01');
  assert.equal(current().data.artway_dokumenty_magazynowe.find((item) => item.id === 'draft').lines[0].location, 'PAK-RB-P01');
  assert.equal(current().data.artway_dokumenty_magazynowe.find((item) => item.id === 'history').lines[0].location, 'PAK-RA-P01');
  assert.deepEqual(current().data.artway_stany, { '1': 8, '2': 3 });
  assert.equal(current().data.artway_magazyn_lokalizacje_usuniete[0].deletedBy, 'admin@artway.pl');
});

test('usunięcie regału wymaga jawnego potwierdzenia całej gałęzi', async () => {
  const { service, current } = harness();
  await assert.rejects(() => service.remove({ code: 'PAK-RA', clearAssignments: true }), (error) => error.code === 'warehouse_location_has_children');
  const removed = await service.remove({ code: 'PAK-RA', includeDescendants: true, clearAssignments: true }, 'administrator');
  assert.deepEqual(new Set(removed.removedCodes), new Set(['PAK-RA', 'PAK-RA-P01']));
  assert.equal(current().data.artway_magazyn_produkty['1'].lokalizacja, '');
  assert.equal(current().data.artway_stany['1'], 8);
});
