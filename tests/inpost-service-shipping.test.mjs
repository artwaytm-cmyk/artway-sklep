import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  inpostServiceInvoicePayload,
  inpostServiceShipxPayload,
  normalizeInpostServiceDraft,
  safeInpostServiceRecord,
  summarizeInpostServiceBilling,
  validateInpostServiceDraft,
} from '../netlify/functions/lib/domain/inpost-service-shipment.mjs';

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
  assert.match(shipping, /Koszt umowny InPost jest ukryty/);
  assert.match(core, /#\/admin\/infakt\/wysylki/);
  assert.match(inventory, /function infaktWysylkiInpostPanelHTML/);
  assert.match(css, /\.inpost-service-workspace/);
});

test('trasa serwerowa zabezpiecza idempotencję i usuwa stawki InPost z odpowiedzi', async () => {
  const source = await readFile(new URL('../netlify/functions/lib/inpost-service-shipment-route.mjs', import.meta.url), 'utf8');
  assert.match(source, /duplicatePrevented/);
  assert.match(source, /concurrentDuplicate/);
  assert.match(source, /safeInpostServiceRecord/);
  assert.match(source, /inpost-service-bill/);
  assert.doesNotMatch(source, /carrierCost\s*:/);
});
