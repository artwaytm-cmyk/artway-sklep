import test from 'node:test';
import assert from 'node:assert/strict';
import { createWarehouseDocumentService } from '../netlify/functions/lib/domain/warehouse-documents.mjs';

function harness({ stock = { '1': 5 } } = {}) {
  let value = { data: { artway_stany: stock, artway_magazyn_ustawienia: { nazwa: 'Magazyn główny' }, artway_magazyn_produkty: { '1': { lokalizacja: 'R1-P1' } }, artway_ruchy_magazynowe: [] }, rev: 1, updated_at: null };
  let etag = 1;
  const products = [
    { id: 1, nazwa: 'Puzzle magnetyczne Farma', ean: '5906018026788', externalId: '2678', sku: 'FARMA-2678' },
    { id: 2, nazwa: 'Gra bez stanu', ean: '5906018003796', externalId: '379' },
  ];
  const service = createWarehouseDocumentService({
    readVersioned: async () => ({ value: structuredClone(value), etag: String(etag), exists: true }),
    writeIfVersion: async (_key, next, version) => {
      if (String(version.etag) !== String(etag)) return { modified: false };
      value = structuredClone(next); etag += 1; return { modified: true, etag: String(etag) };
    },
    mergeSettings: async (data) => data,
    catalogProducts: () => products,
    now: () => new Date('2026-07-16T12:00:00.000Z'),
  });
  return { service, current: () => structuredClone(value) };
}

test('PZ rozpoznaje EAN-13 także po skanie GTIN-14 z zerem i sumuje kolejne skany', async () => {
  const { service } = harness();
  const created = await service.create({ type: 'PZ', reference: 'Spis własny' }, 'admin@artway.pl');
  assert.match(created.document.number, /^PZ\/2026\/07\/0001$/);
  const first = await service.upsertLine({ documentId: created.document.id, expectedRevision: 1, scanCode: '0 5906018026788', quantity: 1, requestId: 'scan-1' }, 'admin@artway.pl');
  assert.equal(first.line.productId, '1');
  assert.equal(first.line.matchedBy, 'EAN/GTIN');
  const second = await service.upsertLine({ documentId: created.document.id, expectedRevision: 2, scanCode: '5906018026788', quantity: 2, requestId: 'scan-2' }, 'admin@artway.pl');
  assert.equal(second.document.lines[0].quantity, 3);
  assert.equal(second.document.lines[0].scanCount, 2);
});

test('zatwierdzenie całego PZ atomowo zwiększa stan i zapisuje ruch z numerem dokumentu', async () => {
  const { service, current } = harness();
  const created = await service.create({ type: 'PZ', reference: 'Towar własny' }, 'administrator');
  const line = await service.upsertLine({ documentId: created.document.id, expectedRevision: 1, productId: '1', quantity: 3, mode: 'set', location: 'R2-P4', requestId: 'line-1' }, 'administrator');
  const confirmed = await service.confirm({ documentId: created.document.id, expectedRevision: line.document.revision, requestId: 'confirm-1' }, 'administrator');
  assert.equal(confirmed.document.status, 'confirmed');
  assert.equal(confirmed.stockUpdates['1'], 8);
  assert.equal(current().data.artway_stany['1'], 8);
  assert.equal(current().data.artway_magazyn_produkty['1'].lokalizacja, 'R2-P4');
  assert.equal(current().data.artway_ruchy_magazynowe[0].typ, 'przyjęcie PZ');
  assert.equal(current().data.artway_ruchy_magazynowe[0].dokument, created.document.number);
  const duplicate = await service.confirm({ documentId: created.document.id, expectedRevision: line.document.revision, requestId: 'confirm-1' }, 'administrator');
  assert.equal(duplicate.duplicate, true);
  assert.equal(current().data.artway_stany['1'], 8);
});

test('PZ rozpoczyna kontrolę produktu bez stanu od zera, a WZ takiego produktu nie księguje', async () => {
  const { service, current } = harness({ stock: {} });
  const pz = await service.create({ type: 'PZ' }, 'administrator');
  const pzLine = await service.upsertLine({ documentId: pz.document.id, expectedRevision: 1, productId: '2', quantity: 4, mode: 'set', requestId: 'pz-line' }, 'administrator');
  await service.confirm({ documentId: pz.document.id, expectedRevision: pzLine.document.revision, requestId: 'pz-confirm' }, 'administrator');
  assert.equal(current().data.artway_stany['2'], 4);
  const wz = await service.create({ type: 'WZ' }, 'administrator');
  const wzLine = await service.upsertLine({ documentId: wz.document.id, expectedRevision: 1, productId: '1', quantity: 1, mode: 'set', requestId: 'wz-line' }, 'administrator');
  await assert.rejects(() => service.confirm({ documentId: wz.document.id, expectedRevision: wzLine.document.revision, requestId: 'wz-confirm' }, 'administrator'), (error) => error.code === 'warehouse_document_untracked_stock');
});

test('WZ nie pozwala zejść poniżej zera i poprawnie księguje dostępny rozchód', async () => {
  const { service, current } = harness();
  const tooLarge = await service.create({ type: 'WZ' }, 'administrator');
  const tooLargeLine = await service.upsertLine({ documentId: tooLarge.document.id, expectedRevision: 1, productId: '1', quantity: 6, mode: 'set', requestId: 'wz-too-large' }, 'administrator');
  await assert.rejects(() => service.confirm({ documentId: tooLarge.document.id, expectedRevision: tooLargeLine.document.revision, requestId: 'wz-too-large-confirm' }, 'administrator'), (error) => error.code === 'warehouse_document_insufficient_stock' && error.details.available === 5);
  const valid = await service.create({ type: 'WZ' }, 'administrator');
  const validLine = await service.upsertLine({ documentId: valid.document.id, expectedRevision: 1, productId: '1', quantity: 2, mode: 'set', requestId: 'wz-valid' }, 'administrator');
  await service.confirm({ documentId: valid.document.id, expectedRevision: validLine.document.revision, requestId: 'wz-valid-confirm' }, 'administrator');
  assert.equal(current().data.artway_stany['1'], 3);
  assert.equal(current().data.artway_ruchy_magazynowe[0].typ, 'rozchód WZ');
  assert.equal(current().data.artway_ruchy_magazynowe[0].ilosc, -2);
});

test('stara rewizja nie może dopisać pozycji, a anulowany szkic pozostaje w historii', async () => {
  const { service } = harness();
  const created = await service.create({ type: 'PZ' }, 'administrator');
  await service.upsertLine({ documentId: created.document.id, expectedRevision: 1, productId: '1', quantity: 1, requestId: 'line' }, 'administrator');
  await assert.rejects(() => service.upsertLine({ documentId: created.document.id, expectedRevision: 1, productId: '1', quantity: 1, requestId: 'stale' }, 'administrator'), (error) => error.code === 'warehouse_document_revision_conflict');
  const cancelled = await service.cancel({ documentId: created.document.id, expectedRevision: 2, reason: 'Błędny dokument' }, 'administrator');
  assert.equal(cancelled.document.status, 'cancelled');
  assert.equal((await service.list()).documents.some((document) => document.id === created.document.id), true);
});
