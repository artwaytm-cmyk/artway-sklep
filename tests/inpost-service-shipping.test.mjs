import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  inpostServiceInvoicePayload,
  inpostServiceContractPricing,
  inpostServiceDefaultPriceList,
  inpostServiceDefaultSettings,
  inpostServicePricePayload,
  inpostServicePricing,
  inpostServiceShipxPayload,
  normalizeInpostServiceContact,
  normalizeInpostServiceDraft,
  safeInpostServiceRecord,
  summarizeInpostServiceBilling,
  validateInpostServiceDraft,
} from '../netlify/functions/lib/domain/inpost-service-shipment.mjs';
import { normalizeInpostServiceTracking } from '../netlify/functions/lib/domain/inpost-service-tracking.mjs';
import { createInpostServiceShipmentRoute } from '../netlify/functions/lib/inpost-service-shipment-route.mjs';
import { createInpostRoute } from '../netlify/functions/lib/inpost-route.mjs';

const sender = {
  companyName: 'Nadawca sp. z o.o.',
  taxCode: '9876543210',
  email: 'sklep@example.pl',
  phone: '530038914',
  address: { street: 'Gryfa Pomorskiego', buildingNumber: '1/A', postCode: '84-207', city: 'Bojano' },
};
const receiver = {
  companyName: 'Klient sp. z o.o.',
  taxCode: '1234567890',
  firstName: 'Jan',
  lastName: 'Kowalski',
  email: 'jan@example.pl',
  phone: '503434229',
  address: { street: 'Testowa', buildingNumber: '8', postCode: '80-209', city: 'Gdańsk' },
};

function draft(overrides = {}) {
  return normalizeInpostServiceDraft({
    requestId: 'REQ-1',
    reference: 'USL-1',
    sender,
    receiver,
    deliveryType: 'locker',
    targetPoint: 'BOJ01N',
    sendingMethod: 'parcel_locker',
    parcel: { template: 'small', weight: 1 },
    cod: { enabled: true, amount: 149.99 },
    insurance: { enabled: true, amount: 200 },
    weekend: true,
    additionalServices: ['labelless', 'forbidden'],
    billingMode: 'monthly',
    commissionGross: 4,
    billingMonth: '2026-07',
    ...overrides,
  }, { commissionGross: 4 }, {
    lockerService: 'inpost_locker_standard',
    courierService: 'inpost_courier_standard',
  });
}

test('nadanie usługowe waliduje klienta i obsługuje Paczkomat, pobranie, ochronę i Paczkę w Weekend', () => {
  const value = draft();
  assert.equal(validateInpostServiceDraft(value).ok, true);
  const payload = inpostServiceShipxPayload(value);
  assert.equal(payload.service, 'inpost_locker_standard');
  assert.equal(payload.custom_attributes.target_point, 'BOJ01N');
  assert.deepEqual(payload.additional_services, ['labelless']);
  assert.equal(payload.end_of_week_collection, true);
  assert.deepEqual(payload.cod, { amount: 149.99, currency: 'PLN' });
  assert.deepEqual(payload.insurance, { amount: 200, currency: 'PLN' });
});

test('wycena ShipX korzysta z tego samego szkicu i pokazuje pełny koszt z prowizją', () => {
  const value = draft();
  const payload = inpostServicePricePayload(value, 'QUOTE-1');
  assert.equal(payload.shipments.length, 1);
  assert.equal(payload.shipments[0].id, 'QUOTE-1');
  assert.equal(payload.shipments[0].service, 'inpost_locker_standard');
  assert.equal(payload.shipments[0].parcels.template, 'small');
  const pricing = inpostServicePricing([{
    id: 'QUOTE-1',
    calculated_charge_amount: '18.90',
    calculated_charge_amount_non_commission: '15.00',
    fuel_charge_amount: '1.50',
    cod_charge_amount: '2.40',
  }], { commissionGross: 4 });
  assert.equal(pricing.totalGross, 18.9);
  assert.equal(pricing.customerTotalGross, 22.9);
  assert.equal(pricing.breakdown.baseGross, 15);
  assert.equal(pricing.source, 'shipx_calculation');
  const unavailable = inpostServicePricing([{ calculated_charge_amount: null }], { commissionGross: 4 });
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.totalGross, null);
});

test('książka adresowa normalizuje jeden kontakt dla roli nadawcy i odbiorcy', () => {
  const contact = normalizeInpostServiceContact({
    id: 'IPA-1',
    label: 'Magazyn klienta',
    roles: ['sender', 'receiver'],
    ...receiver,
  });
  assert.equal(contact.id, 'IPA-1');
  assert.deepEqual(contact.roles, ['sender', 'receiver']);
  assert.equal(contact.address.post_code, '80-209');
  assert.equal(contact.address.building_number, '8');
});

test('historia transportu scala zdarzenia ShipX, zachowuje starsze wpisy i tłumaczy statusy', () => {
  const history = normalizeInpostServiceTracking({
    status: 'ready_to_pickup',
    updated_at: '2026-07-23T08:10:00+02:00',
    tracking_details: [
      { origin_status: 'UWP', status: 'ready_to_pickup', datetime: '2026-07-23T08:10:00+02:00' },
      { origin_status: 'PDD_2', status: 'out_for_delivery', datetime: '2026-07-23T06:15:00+02:00', location: 'Gdańsk' },
    ],
  }, [
    { status: 'confirmed', label: 'Przesyłka potwierdzona', occurredAt: '2026-07-22T10:00:00.000Z' },
  ], '2026-07-23T08:11:00.000Z');
  assert.equal(history.length, 3);
  assert.equal(history[0].status, 'ready_to_pickup');
  assert.equal(history[0].label, 'Gotowa do odbioru');
  assert.equal(history[1].location, 'Gdańsk');
  assert.equal(history[2].status, 'confirmed');
});

test('FV miesięczna wymaga firmy i NIP, a Artway-TM fakturuje koszt nadania wraz z prowizją', () => {
  const invalid = draft({ sender: { ...sender, companyName: '', taxCode: '' } });
  assert.equal(validateInpostServiceDraft(invalid).ok, false);
  assert.ok(validateInpostServiceDraft(invalid).errors.some((error) => error.field === 'sender.taxCode'));
  const base = draft();
  const record = {
    id: 'IPS-1',
    reference: base.reference,
    trackingNumber: '620000000000000000000000',
    sender: base.sender,
    receiver: base.receiver,
    billing: base.billing,
    pricing: { totalGross: 14.16, customerTotalGross: 18.16, complete: true },
  };
  const payload = inpostServiceInvoicePayload([record], { invoiceDate: '2026-07-23' });
  assert.equal(payload.invoice.services.length, 1);
  assert.equal(payload.invoice.services[0].gross_price, 1816);
  assert.match(payload.invoice.services[0].name, /Nadanie przesyłki InPost/);
  assert.equal(payload.invoice.client_tax_code, '9876543210');
  assert.equal(payload.invoice.client_company_name, 'Nadawca sp. z o.o.');
  assert.doesNotMatch(JSON.stringify(payload), /carrierCost|carrierRate|selectedOffer|offers/);
});

test('publiczny rejestr nigdy nie ujawnia ceny ani stawek przewoźnika', () => {
  const safe = safeInpostServiceRecord({
    id: 'IPS-1',
    carrierCost: 12.34,
    carrierRate: { gross: 12.34 },
    selectedOffer: { rate: 12.34 },
    offers: [{ rate: 12.34 }],
    billing: { commissionGross: 4 },
  });
  assert.equal(safe.carrierCost, undefined);
  assert.equal(safe.carrierRate, undefined);
  assert.equal(safe.selectedOffer, undefined);
  assert.equal(safe.offers, undefined);
  assert.equal(safe.billing.commissionGross, 4);
});

test('podsumowanie miesięczne grupuje pełny koszt klienta, nie tylko prowizję', () => {
  const common = { sender, receiver, pricing: { totalGross: 14.16, customerTotalGross: 18.16, complete: true }, billing: { mode: 'monthly', status: 'pending', month: '2026-07', clientKey: sender.taxCode, commissionGross: 4 } };
  const summary = summarizeInpostServiceBilling([
    { id: '1', status: 'label_ready', ...common },
    { id: '2', status: 'label_ready', ...common },
    { id: '3', status: 'cancelled', ...common },
  ]);
  assert.equal(summary.pendingMonthly, 2);
  assert.equal(summary.carrierPendingGross, 28.32);
  assert.equal(summary.commissionPendingGross, 8);
  assert.equal(summary.groups.length, 1);
  assert.equal(summary.groups[0].count, 2);
  assert.equal(summary.groups[0].clientKey, '9876543210');
  assert.equal(summary.groups[0].carrierGross, 28.32);
  assert.equal(summary.groups[0].customerTotalGross, 36.32);
});

test('cennik umowny ze zrzutu jest nadrzędny wobec innej kwoty zwróconej przez ShipX', () => {
  const list = inpostServiceDefaultPriceList();
  assert.deepEqual(Object.values(list.locker).map((rate) => rate.gross), [14.16, 15.93, 18.65]);
  assert.deepEqual(list.courierStandard.map((rate) => rate.gross), [17.58, 19.47, 20.81, 22.18, 23.42, 24.55]);
  assert.deepEqual(Object.values(list.courierManager).map((rate) => rate.gross), [17.58, 19.47, 20.81, 24.55]);
  assert.deepEqual(Object.values(list.handoff).map((rate) => rate.gross), [5.52, 6.75, 7.98]);
  assert.deepEqual(Object.values(list.quickReturns).map((rate) => rate.gross), [11.59, 11.99, 12.42]);
  const settings = inpostServiceDefaultSettings();
  const locker = inpostServiceContractPricing(draft(), settings, [{ calculated_charge_amount: '99.99' }]);
  assert.equal(locker.totalGross, 14.16);
  assert.equal(locker.customerTotalGross, 18.16);
  assert.equal(locker.source, 'contract_price_list');
  assert.equal(locker.apiComparison.totalGross, 99.99);
  assert.equal(locker.subscription.gross, 369);
  assert.equal(locker.subscription.includedInShipment, false);

  const courier = draft({ deliveryType: 'courier', parcel: { template: 'small', weight: 12 }, targetPoint: '' });
  const courierPrice = inpostServiceContractPricing(courier, settings, {});
  assert.equal(courierPrice.rateLabel, 'powyżej 10 kg do 15 kg');
  assert.equal(courierPrice.totalGross, 20.81);
});

test('brak stawki za wybraną dopłatę blokuje fakturę, ale pełny koszt ręczny ją odblokowuje', () => {
  const settings = inpostServiceDefaultSettings();
  const withWeekend = inpostServiceContractPricing(draft({ weekend: true }), settings, {});
  assert.equal(withWeekend.complete, false);
  assert.deepEqual(withWeekend.unpricedOptions, ['Pobranie', 'Dodatkowa ochrona', 'Paczka w Weekend']);
  const manual = inpostServiceContractPricing(draft({ weekend: true, carrierCostOverride: 22.5 }), settings, {});
  assert.equal(manual.complete, true);
  assert.equal(manual.totalGross, 22.5);
});

test('panel udostępnia ręczne nadania oraz wspólną kartę rozliczeń inFakt', async () => {
  const [shipping, inventory, core, css] = await Promise.all([
    readFile(new URL('../assets/admin-shipping.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/admin-inventory.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/admin-core.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/admin.css', import.meta.url), 'utf8'),
  ]);
  assert.match(shipping, /#\/admin\/wysylki\/inpost/);
  assert.match(shipping, /function panelWysylkiUslugowejInpost/);
  assert.match(shipping, /Książka adresowa/);
  assert.match(shipping, /Nadawcy/);
  assert.match(shipping, /Odbiorcy/);
  assert.match(shipping, /Używaj tego adresu jako/);
  assert.match(shipping, /Paczkomaty przy tym adresie/);
  assert.match(shipping, /FV: Artway‑TM → nadawca/);
  assert.match(shipping, /Przelicz według umowy/);
  assert.match(shipping, /Stawki InPost/);
  assert.doesNotMatch(shipping, /Abonament netto|Abonament brutto|Umowa abonamentowa/);
  assert.match(shipping, /inpostServicePotwierdzenie/);
  assert.match(shipping, /Drukuj \/ zapisz PDF/);
  assert.match(shipping, /Historia transportu/);
  assert.match(core, /#\/admin\/infakt\/wysylki/);
  assert.match(inventory, /function infaktWysylkiInpostPanelHTML/);
  assert.match(css, /\.inpost-service-workspace/);
});

test('trasa serwerowa zabezpiecza idempotencję, książkę adresową i wycenę ShipX', async () => {
  const source = await readFile(new URL('../netlify/functions/lib/inpost-service-shipment-route.mjs', import.meta.url), 'utf8');
  assert.match(source, /duplicatePrevented/);
  assert.match(source, /concurrentDuplicate/);
  assert.match(source, /safeInpostServiceRecord/);
  assert.match(source, /inpost-service-bill/);
  assert.match(source, /inpost-service-contact-save/);
  assert.match(source, /inpost-service-contact-delete/);
  assert.match(source, /inpost-service-contact-import/);
  assert.match(source, /inpost-service-quote/);
  assert.match(source, /shipments\/calculate/);
  assert.doesNotMatch(source, /carrierCost\s*:/);
});

test('zamówienia sklepu korzystają z tego samego cennika umownego bez ujawniania abonamentu', async () => {
  const [route, orderView, orderQuote] = await Promise.all([
    readFile(new URL('../netlify/functions/lib/inpost-route.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/frontend/11-store-orders.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/frontend/11-inpost-order-contract-quote.js', import.meta.url), 'utf8'),
  ]);
  const orders = `${orderQuote}\n${orderView}`;
  assert.match(route, /inpost-order-quote/);
  assert.match(route, /inpostServiceContractPricing/);
  assert.match(route, /kosztUmowny: contractPricing/);
  assert.match(route, /subscription: _subscription/);
  assert.match(orders, /Koszt InPost brutto/);
  assert.match(orders, /inpostWycenaZamowieniaLaduj/);
  assert.doesNotMatch(orders, /abonament/i);
});

test('wycena zamówienia sklepu zwraca operacyjny koszt umowny bez danych abonamentu', async () => {
  const route = createInpostRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    orderNumber: (value) => String(value || ''),
    read: async () => ({
      items: [{
        nr: 'ATM-TEST',
        dostawaId: 'paczkomat',
        paczkomat: 'BOJ01N',
        wysylka: { gabaryt: 'small', waga: 1 },
      }],
    }),
    readVersioned: async (_key, fallback) => ({ value: fallback, version: 1 }),
    validateShipment: () => ({ ok: true, doPaczkomatu: true, punkt: 'BOJ01N' }),
  });
  const request = new Request('http://localhost/api?action=inpost-order-quote&nr=ATM-TEST');
  const result = await route(request, new URL(request.url), 'inpost-order-quote');
  assert.equal(result.status, 200);
  assert.equal(result.body.pricing.totalGross, 14.16);
  assert.equal(result.body.pricing.rateLabel, 'Paczkomat gabaryt A');
  assert.equal(result.body.pricing.subscription, undefined);
  assert.equal(result.body.pricing.priceListLabel, undefined);
  assert.equal(result.body.pricing.contractNet, undefined);
});

test('endpoint wyceny naprawdę wysyła szkic do ShipX, a książka adresowa zapisuje kontakt', async () => {
  const storage = new Map(), calls = [];
  const route = createInpostServiceShipmentRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    text: (value, max = 200) => String(value ?? '').slice(0, max),
    readVersioned: async (key, fallback) => ({ value: storage.has(key) ? storage.get(key) : structuredClone(fallback), version: 1 }),
    writeIfVersion: async (key, value) => { storage.set(key, structuredClone(value)); return { modified: true }; },
    publicConfig: () => ({ configured: true }),
    configure: () => ({ configured: true, orgId: 'ORG-1', lockerService: 'inpost_locker_standard', courierService: 'inpost_courier_standard' }),
    organization: async () => ({ id: 'ORG-1' }),
    serviceAvailability: async () => ({ services: ['inpost_locker_standard'], locker: true, courier: false, lockerService: 'inpost_locker_standard', courierService: 'inpost_courier_standard' }),
    call: async (path, options) => {
      calls.push({ path, options });
      return [{ id: 'REQ-1', calculated_charge_amount: '16.50', fuel_charge_amount: '1.50' }];
    },
  });
  const quoteRequest = new Request('http://localhost/api?action=inpost-service-quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...draft(),
      sender,
      receiver,
      requestId: 'REQ-1',
      deliveryType: 'locker',
      targetPoint: 'BOJ01N',
    }),
  });
  const quote = await route(quoteRequest, new URL(quoteRequest.url), 'inpost-service-quote');
  assert.equal(quote.status, 200);
  assert.equal(quote.body.pricing.totalGross, 14.16);
  assert.equal(quote.body.pricing.apiComparison.totalGross, 16.5);
  assert.equal(calls[0].path, '/v1/organizations/ORG-1/shipments/calculate');
  assert.equal(calls[0].options.bodyObj.shipments[0].custom_attributes.target_point, 'BOJ01N');

  const contactRequest = new Request('http://localhost/api?action=inpost-service-contact-save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'receiver', contact: receiver }),
  });
  const contact = await route(contactRequest, new URL(contactRequest.url), 'inpost-service-contact-save');
  assert.equal(contact.status, 201);
  assert.equal(contact.body.addressBook.length, 1);
  assert.equal(contact.body.addressBook[0].taxCode, '1234567890');
  const bothRolesRequest = new Request('http://localhost/api?action=inpost-service-contact-save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      role: 'receiver',
      contact: { ...receiver, id: contact.body.addressBook[0].id, roles: ['sender', 'receiver'] },
    }),
  });
  const bothRoles = await route(bothRolesRequest, new URL(bothRolesRequest.url), 'inpost-service-contact-save');
  assert.deepEqual(bothRoles.body.contact.roles, ['sender', 'receiver']);

  const importRequest = new Request('http://localhost/api?action=inpost-service-contact-import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      source: 'Adresy_DPD.xlsx',
      contacts: [{
        role: 'sender',
        label: 'Nowy nadawca',
        firstName: 'Anna',
        lastName: 'Nowak',
        phone: '501002003',
        address: { street: 'Lipowa', buildingNumber: '7', postCode: '84-150', city: 'Hel' },
      }],
    }),
  });
  const imported = await route(importRequest, new URL(importRequest.url), 'inpost-service-contact-import');
  assert.equal(imported.status, 201);
  assert.equal(imported.body.created, 1);
  assert.equal(imported.body.total, 2);
});
