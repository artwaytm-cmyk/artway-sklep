import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  inpostServiceInvoicePayload,
  inpostServicePricePayload,
  inpostServicePricing,
  inpostServiceShipxPayload,
  normalizeInpostServiceContact,
  normalizeInpostServiceDraft,
  safeInpostServiceRecord,
  summarizeInpostServiceBilling,
  validateInpostServiceDraft,
} from '../netlify/functions/lib/domain/inpost-service-shipment.mjs';
import { createInpostServiceShipmentRoute } from '../netlify/functions/lib/inpost-service-shipment-route.mjs';

const sender = {
  companyName: 'Artway-TM sp. z o.o.',
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
  assert.equal(payload.shipments[0].parcels.dimensions.length, '300');
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

test('FV miesięczna wymaga firmy i NIP, a faktura zawiera tylko prowizję Artway-TM', () => {
  const invalid = draft({ receiver: { ...receiver, companyName: '', taxCode: '' } });
  assert.equal(validateInpostServiceDraft(invalid).ok, false);
  assert.ok(validateInpostServiceDraft(invalid).errors.some((error) => error.field === 'receiver.taxCode'));
  const base = draft();
  const record = {
    id: 'IPS-1',
    reference: base.reference,
    trackingNumber: '620000000000000000000000',
    receiver: base.receiver,
    billing: base.billing,
  };
  const payload = inpostServiceInvoicePayload([record], { invoiceDate: '2026-07-23' });
  assert.equal(payload.invoice.services.length, 1);
  assert.equal(payload.invoice.services[0].gross_price, 400);
  assert.equal(payload.invoice.client_tax_code, '1234567890');
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

test('podsumowanie miesięczne grupuje wyłącznie aktywne, nierozliczone nadania', () => {
  const common = { receiver, billing: { mode: 'monthly', status: 'pending', month: '2026-07', clientKey: receiver.taxCode, commissionGross: 4 } };
  const summary = summarizeInpostServiceBilling([
    { id: '1', status: 'label_ready', ...common },
    { id: '2', status: 'label_ready', ...common },
    { id: '3', status: 'cancelled', ...common },
  ]);
  assert.equal(summary.pendingMonthly, 2);
  assert.equal(summary.commissionPendingGross, 8);
  assert.equal(summary.groups.length, 1);
  assert.equal(summary.groups[0].count, 2);
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
  assert.match(shipping, /Wybierz z książki adresowej/);
  assert.match(shipping, /Sprawdź koszt teraz/);
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
  assert.match(source, /inpost-service-quote/);
  assert.match(source, /shipments\/calculate/);
  assert.doesNotMatch(source, /carrierCost\s*:/);
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
  assert.equal(quote.body.pricing.totalGross, 16.5);
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
});
