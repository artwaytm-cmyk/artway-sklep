import assert from 'node:assert/strict';
import test from 'node:test';

import { vonHalskyDefaultSettings } from '../src/backend/lib/domain/von-halsky-catalog.mjs';
import {
  mergeVonHalskyOrderWithLocalState,
  vonHalskyOrderShippingStage,
  vonHalskyOrderToInpostOrder,
  vonHalskyShipmentCanEdit,
  vonHalskyShipmentLinked,
} from '../src/backend/lib/domain/von-halsky-order-shipment.mjs';
import { createVonHalskyRoute } from '../src/backend/lib/von-halsky-route.mjs';

const order = {
  id: 'C09Q3VF',
  status: 'ACCEPTED',
  finalPrice: { amount: 81.97, currency: 'PLN' },
  customer: { firstName: 'Jan', lastName: 'Testowy', email: 'jan@example.test', phoneNumber: '+48 500 600 700' },
  delivery: {
    deliveryType: 'APM',
    deliveryPoint: 'BOJ01N',
    email: 'jan@example.test',
    phoneNumber: '+48 500 600 700',
    address: { street: 'Testowa', building: '1', flat: '2', postCode: '00-001', city: 'Warszawa', countryCode: 'PL' },
    parcels: [],
  },
  orderLines: [{ offer: { product: { name: 'Produkt testowy', ean: '5901234123457', sku: 'TEST-1' } } }],
};

test('zamówienie Von Halsky jest mapowane do ShipX z dokładnym ID jako reference', () => {
  const mapped = vonHalskyOrderToInpostOrder(order, {
    gabaryt: 'large', sposobNadania: 'dispatch_order', targetPoint: 'WAW01N',
    recipientEmail: 'korekta@example.test', recipientPhone: '600700800',
  });
  assert.equal(mapped.nr, 'C09Q3VF');
  assert.equal(mapped.dostawaId, 'paczkomat');
  assert.equal(mapped.paczkomat, 'WAW01N');
  assert.equal(mapped.wysylka.gabaryt, 'large');
  assert.equal(mapped.wysylka.sposobNadania, 'dispatch_order');
  assert.equal(mapped.klient.telefon, '600700800');
  assert.equal(mapped.klient.email, 'korekta@example.test');
});

test('zamówienie z numerem przesyłki nie pozostaje w kolejce do obsługi', () => {
  assert.deepEqual(vonHalskyOrderShippingStage(order), {
    key: 'awaiting_shipment', label: 'Do nadania', requiresAction: true, trackingNumber: '',
  });
  const shipped = {
    ...order,
    delivery: { ...order.delivery, parcels: [{ trackingNumber: 'TRACK-1', status: 'UNKNOWN' }] },
    _artwayShipment: { inpostId: 'SHIPX-1', trackingNumber: 'TRACK-1', status: 'confirmed', labelReady: true },
  };
  assert.deepEqual(vonHalskyOrderShippingStage(shipped), {
    key: 'shipped', label: 'Nadana', requiresAction: false, trackingNumber: 'TRACK-1',
  });
  assert.equal(vonHalskyShipmentCanEdit(shipped._artwayShipment), false);
  assert.equal(vonHalskyShipmentCanEdit({ status: 'offers_prepared', trackingNumber: '' }), true);
  assert.equal(vonHalskyOrderShippingStage({ ...shipped, _artwayShipment: { ...shipped._artwayShipment, status: 'pickup_reminder_sent' } }).key, 'in_transit');
});

test('lokalne ID ShipX nie znika po ponownym pobraniu zamówienia i tracking jest rozpoznawany w delivery.parcels', () => {
  const previous = { ...order, _artwayShipment: { inpostId: 'SHIPX-1', trackingNumber: 'TRACK-1' } };
  const incoming = { ...order, status: 'PROCESSING', delivery: { ...order.delivery, parcels: [{ trackingNumber: 'TRACK-1' }] } };
  const merged = mergeVonHalskyOrderWithLocalState(previous, incoming);
  assert.equal(merged._artwayShipment.inpostId, 'SHIPX-1');
  assert.equal(vonHalskyShipmentLinked(merged, 'TRACK-1', 'SHIPX-1'), true);
});

test('otwarcie karty jest lokalnym odczytem bez zdalnego API i bez przeliczenia Planu', async () => {
  let remoteReads = 0, coordinated = 0, inspected = 0;
  const state = {
    settings: vonHalskyDefaultSettings(), sync: {}, diagnostics: [], categories: [], offers: [], orders: [structuredClone(order)],
    returns: [{ id: 'RETURN-1', status: 'NEW', relatedOrder: { orderId: 'C09Q3VF' } }],
    claims: [{ claimId: 'CLAIM-1', state: 'APPROVED', relatedOrder: { orderId: 'C09Q3VF' } }],
    events: [], commands: [], publicationQueue: {},
  };
  const route = createVonHalskyRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    readVersioned: async () => ({ value: structuredClone(state), revision: 1 }),
    writeIfVersion: async () => ({ modified: true }),
    api: { getOrder: async () => { remoteReads += 1; return { payload: structuredClone(order) }; } },
    inpost: {
      configure: () => ({ configured: true, sendingMethod: 'parcel_locker' }),
      validateShipment: () => ({ ok: true, errors: [] }),
    },
    coordinateWarehouseOrders: async () => { coordinated += 1; return { ok: true }; },
    inspectWarehouseOrders: async () => { inspected += 1; return { ok: true, readOnly: true, supplierDocuments: [] }; },
  });
  const request = new Request('https://artwaytm.pl/api?action=von-halsky-order-shipment-preview&orderId=C09Q3VF');
  const response = await route(request, new URL(request.url), 'von-halsky-order-shipment-preview');
  assert.equal(response.status, 200);
  assert.equal(response.body.warehouse.readOnly, true);
  assert.equal(response.body.afterSales.returns.length, 1);
  assert.equal(response.body.afterSales.claims.length, 1);
  assert.equal(response.body.afterSales.open, 1);
  assert.equal(remoteReads, 0);
  assert.equal(coordinated, 0);
  assert.equal(inspected, 1);
});

test('utworzenie przesyłki zapisuje ShipX, potwierdza parcelę Von Halsky i nie dubluje ponownego żądania', async () => {
  let state = {
    settings: vonHalskyDefaultSettings(),
    sync: {}, diagnostics: [], categories: [], offers: [], orders: [structuredClone(order)],
    returns: [], claims: [], events: [], commands: [], publicationQueue: {},
  };
  let revision = 0, createCalls = 0, orderReads = 0, warehouseCalls = 0, createdPayload = null;
  const api = {
    getOrder: async () => {
      orderReads += 1;
      return { payload: orderReads > 1 ? { ...order, delivery: { ...order.delivery, parcels: [{ trackingNumber: 'TRACK-1' }] } } : structuredClone(order) };
    },
  };
  const inpost = {
    configure: () => ({ configured: true, orgId: 'ORG-1', sendingMethod: 'parcel_locker', lockerService: 'locker', courierService: 'courier' }),
    validateShipment: () => ({ ok: true, errors: [], doPaczkomatu: true, punkt: 'BOJ01N', email: 'jan@example.test', phone: '500600700' }),
    organization: async () => ({ services: [] }),
    serviceAvailability: (config) => ({ services: [], locker: true, courier: true, lockerService: config.lockerService, courierService: config.courierService }),
    shipmentPayload: (mapped) => ({ reference: mapped.nr, receiver: {}, parcels: [{}], service: 'locker', custom_attributes: { target_point: 'BOJ01N' } }),
    call: async (_path, options) => { createCalls += 1; createdPayload = options.bodyObj; return { id: 'SHIPX-1', status: 'confirmed', tracking_number: 'TRACK-1' }; },
    waitForLabel: async () => ({ id: 'SHIPX-1', status: 'confirmed', tracking_number: 'TRACK-1' }),
    trackingNumber: (value) => value?.tracking_number || '',
    shipmentStatus: (value) => value?.status || '',
    labelReady: (value) => value?.status === 'confirmed',
  };
  const route = createVonHalskyRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    readVersioned: async () => ({ value: structuredClone(state), revision }),
    writeIfVersion: async (_key, value) => { state = structuredClone(value); revision += 1; return { modified: true }; },
    api,
    inpost,
    coordinateWarehouseOrders: async (orders) => {
      warehouseCalls += 1;
      return { ok: true, inventory: [{ number: `Von Halsky ${orders[0].id}`, changed: warehouseCalls === 1 }], supplierDocuments: [] };
    },
  });
  const request = () => new Request('https://artwaytm.pl/api?action=von-halsky-order-shipment-create', {
    method: 'POST', body: JSON.stringify({ orderId: 'C09Q3VF', gabaryt: 'medium', confirmed: true }),
  });
  const firstRequest = request();
  const first = await route(firstRequest, new URL(firstRequest.url), 'von-halsky-order-shipment-create');
  assert.equal(first.status, 201);
  assert.equal(createdPayload.reference, 'C09Q3VF');
  assert.equal(first.body.shipment.inpostId, 'SHIPX-1');
  assert.equal(first.body.shipment.vonHalskyLinked, true);
  assert.equal(first.body.warehouse.inventory[0].number, 'Von Halsky C09Q3VF');
  assert.equal(state.orders[0]._artwayShipment.trackingNumber, 'TRACK-1');
  const secondRequest = request();
  const second = await route(secondRequest, new URL(secondRequest.url), 'von-halsky-order-shipment-create');
  assert.equal(second.status, 200);
  assert.equal(second.body.idempotent, true);
  assert.equal(createCalls, 1);
  assert.equal(warehouseCalls, 2, 'ponowne żądanie nadal bezpiecznie uzgadnia stan, ale nie tworzy drugiej przesyłki');
});

test('potwierdzona przesyłka wymaga dwóch zgód przed utworzeniem korekty i zachowuje historię', async () => {
  const previousShipment = {
    inpostId: 'SHIPX-OLD', trackingNumber: 'TRACK-OLD', status: 'confirmed',
    labelReady: true, reference: 'C09Q3VF', createdAt: '2026-08-07T10:00:00.000Z',
  };
  let state = {
    settings: vonHalskyDefaultSettings(), sync: {}, diagnostics: [], categories: [], offers: [],
    orders: [{ ...structuredClone(order), _artwayShipment: previousShipment }],
    returns: [], claims: [], events: [], commands: [], publicationQueue: {},
  };
  let revision = 0, createCalls = 0;
  const api = { getOrder: async () => structuredClone(order) };
  const inpost = {
    configure: () => ({ configured: true, orgId: 'ORG-1', sendingMethod: 'parcel_locker', lockerService: 'locker', courierService: 'courier' }),
    validateShipment: () => ({ ok: true, errors: [], doPaczkomatu: true, punkt: 'BOJ01N', email: 'jan@example.test', phone: '500600700' }),
    organization: async () => ({ services: [] }),
    serviceAvailability: (config) => ({ services: [], locker: true, courier: true, lockerService: config.lockerService, courierService: config.courierService }),
    shipmentPayload: () => ({ receiver: {}, parcels: [{}], service: 'locker', custom_attributes: { target_point: 'BOJ01N' } }),
    call: async () => { createCalls += 1; return { id: 'SHIPX-NEW', status: 'confirmed', tracking_number: 'TRACK-NEW' }; },
    waitForLabel: async () => ({ id: 'SHIPX-NEW', status: 'confirmed', tracking_number: 'TRACK-NEW' }),
    trackingNumber: (value) => value?.tracking_number || '',
    shipmentStatus: (value) => value?.status || '',
    labelReady: (value) => value?.status === 'confirmed',
  };
  const route = createVonHalskyRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    readVersioned: async () => ({ value: structuredClone(state), revision }),
    writeIfVersion: async (_key, value) => { state = structuredClone(value); revision += 1; return { modified: true }; },
    api, inpost,
  });
  const request = (replacementConfirmed) => new Request('https://artwaytm.pl/api?action=von-halsky-order-shipment-create', {
    method: 'POST',
    body: JSON.stringify({
      orderId: 'C09Q3VF', gabaryt: 'large', confirmed: true,
      replaceExisting: true, replacementConfirmed,
    }),
  });
  const missingSecondConfirmation = request(false);
  const rejected = await route(missingSecondConfirmation, new URL(missingSecondConfirmation.url), 'von-halsky-order-shipment-create');
  assert.equal(rejected.status, 422);
  assert.equal(rejected.body.code, 'replacement_confirmation_required');
  assert.equal(createCalls, 0);

  const confirmed = request(true);
  const created = await route(confirmed, new URL(confirmed.url), 'von-halsky-order-shipment-create');
  assert.equal(created.status, 201);
  assert.equal(created.body.replacement, true);
  assert.equal(createCalls, 1);
  assert.equal(state.orders[0]._artwayShipment.inpostId, 'SHIPX-NEW');
  assert.equal(state.orders[0]._artwayShipment.replacementOf, 'SHIPX-OLD');
  assert.equal(state.orders[0]._artwayShipmentHistory[0].inpostId, 'SHIPX-OLD');
});

test('SOLDOUT jest wznawiany aktualizacją stanu, bez błędnego polecenia reopen', async () => {
  const offerId = '4cf4299d-6657-4ae9-8ff4-e7b4c552d485';
  let state = {
    settings: { ...vonHalskyDefaultSettings(), defaultStock: 6 }, sync: {}, diagnostics: [], categories: [],
    offers: [{ offerId, externalId: '2351', status: 'SOLDOUT' }], orders: [], returns: [], claims: [], events: [], commands: [], publicationQueue: {},
  };
  let revision = 0, stockPayload = null, reopenCalls = 0;
  const route = createVonHalskyRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    readVersioned: async () => ({ value: structuredClone(state), revision }),
    writeIfVersion: async (_key, value) => { state = structuredClone(value); revision += 1; return { modified: true }; },
    loadCatalog: async () => [{
      id: 'P-2351', externalId: '2351', vonHalskyOfferId: offerId, saleAvailable: true, aktywny: true,
      nazwa: 'Produkt z powrotem dostępny', opis: 'Pełny opis produktu dostępnego ponownie w sprzedaży kanału Von Halsky. '.repeat(3),
      ean: '5901234123457', zdjecie: 'https://artwaytm.pl/p.jpg', cena: 29.99,
    }],
    api: {
      getOffer: async () => ({ payload: { offerId, externalId: '2351', status: 'SOLDOUT' } }),
      updateStocks: async (items) => { stockPayload = items; return { payload: { commandId: 'CMD-STOCK' }, requestId: 'REQ-STOCK' }; },
      setOfferOpen: async () => { reopenCalls += 1; return { payload: {} }; },
    },
  });
  const request = new Request('https://artwaytm.pl/api?action=von-halsky-offer-resume', {
    method: 'POST', body: JSON.stringify({ offerId }),
  });
  const response = await route(request, new URL(request.url), 'von-halsky-offer-resume');
  assert.equal(response.status, 200);
  assert.equal(response.body.mode, 'stock-update');
  assert.equal(response.body.quantity, 6);
  assert.equal(stockPayload[0].stock.quantity, 6);
  assert.equal(reopenCalls, 0);
});
