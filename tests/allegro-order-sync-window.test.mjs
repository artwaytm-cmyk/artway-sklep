import test from 'node:test';
import assert from 'node:assert/strict';
import { allegroOrderEventFingerprint, countChangedAllegroOrderEvents, mergeRecentAllegroOrders } from '../netlify/functions/lib/domain/allegro-order-sync-window.mjs';

const normalize = (order) => ({ ...order, id: String(order.id || '') });
const merge = (order, previous) => ({ ...previous, ...order, warehouseStage: ['SENT', 'CANCELLED', 'RETURNED'].includes(order.fulfillmentStatus) ? 'zamkniete' : (previous.warehouseStage || 'do_sprawdzenia') });
const isWorkItem = (order) => order.status === 'READY_FOR_PROCESSING' && ['NEW', 'PROCESSING', 'READY_FOR_SHIPMENT'].includes(order.fulfillmentStatus || 'NEW');

test('najnowsze okno aktualizuje znany status SENT, ale nie importuje obcego zakończonego zamówienia', () => {
  const result = mergeRecentAllegroOrders({
    fetched: [
      { id: 'known', status: 'READY_FOR_PROCESSING', fulfillmentStatus: 'SENT' },
      { id: 'new-active', status: 'READY_FOR_PROCESSING', fulfillmentStatus: 'NEW' },
      { id: 'foreign-sent', status: 'READY_FOR_PROCESSING', fulfillmentStatus: 'SENT' },
    ],
    previous: [{ id: 'known', fulfillmentStatus: 'PROCESSING', warehouseStage: 'spakowane' }],
    normalize, merge, isWorkItem, checkedAt: '2026-07-16T18:00:00Z',
  });
  assert.equal(result.byId.get('known').fulfillmentStatus, 'SENT');
  assert.equal(result.byId.get('known').warehouseStage, 'zamkniete');
  assert.equal(result.byId.get('known').officialStatusCheckedAt, '2026-07-16T18:00:00Z');
  assert.equal(result.byId.has('new-active'), true);
  assert.equal(result.byId.has('foreign-sent'), false);
  assert.deepEqual(result.newOrderIds, ['new-active']);
  assert.equal(result.refreshed, 1);
  assert.equal(result.imported, 1);
  assert.equal(result.ignoredTerminal, 1);
});

test('duplikat w stronie API jest scalany tylko raz, a archiwum nie wraca do kolejki', () => {
  const result = mergeRecentAllegroOrders({
    fetched: [
      { id: 'same', status: 'READY_FOR_PROCESSING', fulfillmentStatus: 'NEW' },
      { id: 'same', status: 'READY_FOR_PROCESSING', fulfillmentStatus: 'PROCESSING' },
      { id: 'archived', status: 'READY_FOR_PROCESSING', fulfillmentStatus: 'NEW' },
    ],
    previous: [], archivedLookup: { archived: '2026-06' }, normalize, merge, isWorkItem,
  });
  assert.deepEqual([...result.byId.keys()], ['same']);
  assert.equal(result.imported, 1);
});

test('detektor zdarzeń ignoruje techniczne czasy odczytu, ale widzi rzeczywistą zmianę statusu lub pozycji', () => {
  const previous = [{ id: '1', status: 'READY_FOR_PROCESSING', fulfillmentStatus: 'NEW', rawUpdatedAt: 'stary', lastSeenAt: 'stary', lineItems: [{ id: 'L1', offerId: 'O1', quantity: 1 }] }];
  const same = [{ ...previous[0], rawUpdatedAt: 'nowy', lastSeenAt: 'nowy', officialStatusCheckedAt: 'nowy' }];
  const changed = [{ ...same[0], fulfillmentStatus: 'SENT' }];
  assert.equal(allegroOrderEventFingerprint(previous[0]), allegroOrderEventFingerprint(same[0]));
  assert.equal(countChangedAllegroOrderEvents(previous, same), 0);
  assert.equal(countChangedAllegroOrderEvents(previous, changed), 1);
});
