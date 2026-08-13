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
  inpostServiceRoundedCustomerPrice,
  inpostServiceShipxPayload,
  normalizeInpostServiceContact,
  normalizeInpostServiceDraft,
  safeInpostServiceRecord,
  summarizeInpostServiceBilling,
  validateInpostServiceDraft,
} from '../src/backend/lib/domain/inpost-service-shipment.mjs';
import { normalizeInpostServiceTracking } from '../src/backend/lib/domain/inpost-service-tracking.mjs';
import { createInpostService } from '../src/backend/lib/inpost-service.mjs';
import { createInpostServiceShipmentRoute } from '../src/backend/lib/inpost-service-shipment-route.mjs';
import { createInpostRoute } from '../src/backend/lib/inpost-route.mjs';
import { inpostErrorDetails, inpostErrorText } from '../src/backend/lib/domain/inpost-error.mjs';

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
    dropoffPoint: 'BOJ01N',
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
  assert.deepEqual(value.principal, value.sender);
  const payload = inpostServiceShipxPayload(value);
  assert.equal(payload.service, 'inpost_locker_standard');
  assert.equal(payload.custom_attributes.target_point, 'BOJ01N');
  assert.equal(payload.custom_attributes.dropoff_point, 'BOJ01N');
  assert.equal('external_customer_id' in payload, false);
  assert.deepEqual(payload.additional_services, ['labelless']);
  assert.equal(payload.end_of_week_collection, true);
  assert.deepEqual(payload.cod, { amount: 149.99, currency: 'PLN' });
  assert.deepEqual(payload.insurance, { amount: 200, currency: 'PLN' });
});

test('kurier standard nie przełącza po cichu Paczkomatu na PaczkoPunkt', () => {
  const invalid = draft({
    deliveryType: 'courier',
    targetPoint: '',
    dropoffPoint: 'BOJ01N',
    sendingMethod: 'parcel_locker',
    weekend: true,
    additionalServices: ['sms'],
    parcel: { template: 'small', length: 64, width: 38, height: 8, weight: 1 },
  });
  assert.equal(invalid.sendingMethod, '');
  assert.equal(validateInpostServiceDraft(invalid).ok, false);
  assert.ok(validateInpostServiceDraft(invalid).errors.some((error) => error.field === 'sendingMethod'));

  const value = draft({
    deliveryType: 'courier',
    targetPoint: '',
    dropoffPoint: '',
    sendingMethod: 'pop',
    weekend: true,
    additionalServices: ['sms'],
    parcel: { template: 'small', length: 64, width: 38, height: 8, weight: 1 },
  });
  assert.equal(value.sendingMethod, 'pop');
  assert.equal(value.weekend, false);
  assert.equal(validateInpostServiceDraft(value).ok, true);
  const payload = inpostServiceShipxPayload(value);
  assert.equal(payload.service, 'inpost_courier_standard');
  assert.deepEqual(payload.custom_attributes, { sending_method: 'pop' });
  assert.deepEqual(payload.additional_services, ['sms']);
  assert.equal(payload.parcels[0].template, undefined);
  assert.deepEqual(payload.parcels[0].dimensions, { length: '640', width: '380', height: '80', unit: 'mm' });
  assert.deepEqual(payload.parcels[0].weight, { amount: '1', unit: 'kg' });
});

test('aktywny Kurier C2C zachowuje domyślne nadanie w Paczkomacie', () => {
  const value = normalizeInpostServiceDraft({
    requestId: 'REQ-C2C',
    reference: 'USL-C2C',
    sender,
    receiver,
    deliveryType: 'courier',
    sendingMethod: 'parcel_locker',
    dropoffPoint: 'BOJ01N',
    parcel: { template: 'small', length: 64, width: 38, height: 8, weight: 1 },
  }, { sender }, {
    services: ['inpost_courier_standard', 'inpost_courier_c2c'],
    courierService: 'inpost_courier_standard',
  });
  assert.equal(value.sendingMethod, 'parcel_locker');
  assert.equal(value.service, 'inpost_courier_c2c');
  assert.equal(validateInpostServiceDraft(value).ok, true);
  const payload = inpostServiceShipxPayload(value);
  assert.equal(payload.service, 'inpost_courier_c2c');
  assert.deepEqual(payload.custom_attributes, { sending_method: 'parcel_locker', dropoff_point: 'BOJ01N' });
  assert.equal(value.pricing.manualGross, 0);
});

test('ręcznie wyczyszczona firma nadawcy nie wraca z domyślnych ani starszych pól ustawień', () => {
  const value = normalizeInpostServiceDraft({
    requestId: 'REQ-PERSON',
    sender: { ...sender, companyName: '', taxCode: '', firstName: 'Piotr', lastName: 'Modelski' },
    receiver,
    deliveryType: 'courier',
    sendingMethod: 'pop',
    parcel: { template: 'small', length: 64, width: 38, height: 8, weight: 1 },
  }, {
    sender: { ...sender, companyName: 'Artway-TM', firma: 'Starsza nazwa Artway-TM' },
  }, { courierService: 'inpost_courier_standard' });
  assert.equal(value.sender.companyName, '');
  assert.equal(value.sender.firstName, 'Piotr');
  assert.equal(value.sender.lastName, 'Modelski');
  assert.equal(inpostServiceShipxPayload(value).sender.company_name, undefined);
});

test('zwykłe nadanie pokazuje klienta jako nadawcę i nie dopisuje automatycznych uwag', () => {
  const clientAddress = { street: 'Wałowa', buildingNumber: '12', postCode: '83-011', city: 'Wiślinka' };
  const value = normalizeInpostServiceDraft({
    requestId: 'REQ-RETURN',
    reference: 'USL-RETURN',
    sender: { ...sender, firstName: 'Piotr', lastName: 'Modelski', email: '', phone: '', address: clientAddress },
    receiver: { ...receiver, email: '', phone: '' },
    deliveryType: 'courier',
    sendingMethod: 'pop',
    comments: '',
    parcel: { template: 'small', length: 64, width: 38, height: 8, weight: 1 },
  }, { sender }, {
    services: ['inpost_courier_standard'],
    courierService: 'inpost_courier_standard',
  });
  assert.equal(value.sender.companyName, '');
  assert.equal(value.sender.taxCode, '');
  assert.equal(value.sender.email, sender.email);
  assert.equal(value.sender.phone, sender.phone);
  assert.equal(value.receiver.email, sender.email);
  assert.equal(value.receiver.phone, sender.phone);
  assert.equal(value.returnAddress.street, 'Wałowa');
  assert.equal(value.returnAddressNote, '');
  assert.equal(value.comments, '');
  const payload = inpostServiceShipxPayload(value);
  assert.equal(payload.sender.company_name, undefined);
  assert.equal(payload.sender.first_name, 'Piotr');
  assert.equal('comments' in payload, false);
});

test('wyjątkowy tryb Artway pokazuje firmę na etykiecie i dopisuje klienta w uwagach', () => {
  const clientAddress = { street: 'Wałowa', buildingNumber: '12', postCode: '83-011', city: 'Wiślinka' };
  const value = normalizeInpostServiceDraft({
    requestId: 'REQ-TECHNICAL-SENDER',
    reference: 'USL-TECHNICAL-SENDER',
    sender: { ...sender, firstName: 'Piotr', lastName: 'Modelski', companyName: '', taxCode: '', address: clientAddress },
    receiver,
    technicalSenderRequired: true,
    deliveryType: 'courier',
    sendingMethod: 'pop',
    parcel: { template: 'small', length: 64, width: 38, height: 8, weight: 1 },
  }, { sender }, { courierService: 'inpost_courier_standard' });
  assert.equal(validateInpostServiceDraft(value).ok, true);
  assert.equal(value.returnAddressNote, 'Zwroty kierować pod adres nadawcy: Piotr Modelski, Wałowa 12, 83-011 Wiślinka.');
  assert.equal(value.comments, value.returnAddressNote);
  const payload = inpostServiceShipxPayload(value);
  assert.equal(payload.sender.company_name, sender.companyName);
  assert.equal(payload.comments, value.returnAddressNote);
});

test('brak nadawcy klienta nie podstawia po cichu danych Artway', () => {
  const value = normalizeInpostServiceDraft({
    requestId: 'REQ-NO-SENDER',
    receiver,
    deliveryType: 'courier',
    sendingMethod: 'pop',
    parcel: { template: 'small', length: 64, width: 38, height: 8, weight: 1 },
  }, { sender }, { courierService: 'inpost_courier_standard' });
  const validation = validateInpostServiceDraft(value);
  assert.equal(value.sender.companyName, '');
  assert.equal(value.sender.firstName, '');
  assert.equal(value.sender.address.street, '');
  assert.equal(value.sender.email, sender.email);
  assert.equal(value.sender.phone, sender.phone);
  assert.equal(value.returnAddressNote, '');
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.field === 'sender.firstName'));
  assert.ok(validation.errors.some((error) => error.field === 'sender.address.street'));
  assert.equal(inpostServiceShipxPayload(value).sender.company_name, undefined);
});

test('formularz nowej przesyłki zaczyna od pustego rzeczywistego nadawcy', async () => {
  const frontend = await readFile(new URL('../src/frontend/07e-inpost-service-address-book-pricing.js', import.meta.url), 'utf8');
  const shared = await readFile(new URL('../src/frontend/07d-inpost-service-shipping.js', import.meta.url), 'utf8');
  assert.match(shared, /function inpostServicePustyNadawcaKlienta\(\)/);
  assert.match(frontend, /const sender=inpostServicePustyNadawcaKlienta\(\),settings=/);
  assert.doesNotMatch(frontend, /const sender=inpostServiceNadawca\(\),settings=/);
  assert.match(frontend, /Na etykiecie nadawcą jest wybrany klient/);
  assert.match(frontend, /Wyjątkowo: InPost wymaga danych Artway-TM/);
  assert.match(frontend, /Domyślnie nic nie dopisujemy do uwag/);
  assert.match(shared, /Wybierz z książki albo wpisz rzeczywistego nadawcę przesyłki/);
});

test('konkretny punkt nadania jest wymagany tylko dla metod, które tego potrzebują', () => {
  const missing = draft({ sendingMethod: 'parcel_locker', dropoffPoint: '' });
  const validation = validateInpostServiceDraft(missing);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.field === 'dropoffPoint'));
  const anyPoint = draft({ sendingMethod: 'any_point', dropoffPoint: '' });
  assert.equal(validateInpostServiceDraft(anyPoint).ok, true);
});

test('zagnieżdżone błędy ShipX są czytelne i zachowują ścieżkę pola', () => {
  const details = {
    custom_attributes: {
      sending_method: ['nie pasuje do wybranej usługi'],
      dropoff_point: [{ message: 'wybierz punkt nadania' }],
    },
  };
  assert.deepEqual(inpostErrorDetails(details), [
    { field: 'custom_attributes.sending_method', message: 'nie pasuje do wybranej usługi' },
    { field: 'custom_attributes.dropoff_point', message: 'wybierz punkt nadania' },
  ]);
  const message = inpostErrorText({ message: 'Błąd walidacji', details }, 'Błąd InPost');
  assert.match(message, /custom_attributes\.sending_method: nie pasuje/);
  assert.match(message, /custom_attributes\.dropoff_point: wybierz punkt nadania/);
  assert.doesNotMatch(message, /\[object Object\]/);
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
  assert.equal(pricing.customerTotalGross, 23);
  assert.equal(pricing.commissionGross, 4.1);
  assert.equal(pricing.breakdown.baseGross, 15);
  assert.equal(pricing.source, 'shipx_calculation');
  const unavailable = inpostServicePricing([{ calculated_charge_amount: null }], { commissionGross: 4 });
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.totalGross, null);
});

test('pierwszy przedział dopasowuje prowizję 4–5 zł i zawsze daje pełną cenę klienta', () => {
  assert.deepEqual(inpostServiceRoundedCustomerPrice(14.16), { customerTotalGross: 19, commissionGross: 4.84, minimumGross: 4, maximumGross: 5 });
  assert.deepEqual(inpostServiceRoundedCustomerPrice(17.58), { customerTotalGross: 22, commissionGross: 4.42, minimumGross: 4, maximumGross: 5 });
  assert.deepEqual(inpostServiceRoundedCustomerPrice(18), { customerTotalGross: 22, commissionGross: 4, minimumGross: 4, maximumGross: 5 });
  for (const gross of [5.52, 11.59, 14.16, 15.93, 17.58, 24.55]) {
    const rounded = inpostServiceRoundedCustomerPrice(gross);
    assert.equal(Number.isInteger(rounded.customerTotalGross), true);
    assert.ok(rounded.commissionGross >= 4 && rounded.commissionGross <= 5);
  }
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

test('ustawienia InPost zapisują domyślny sposób nadania, automat i etykietę oraz dają się ponownie odczytać', async () => {
  const storage = new Map();
  const route = createInpostServiceShipmentRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    text: (value, max = 200) => String(value ?? '').slice(0, max),
    readVersioned: async (key, fallback) => ({ value: storage.has(key) ? storage.get(key) : structuredClone(fallback), version: 1 }),
    writeIfVersion: async (key, value) => { storage.set(key, structuredClone(value)); return { modified: true }; },
  });
  const saveRequest = new Request('http://localhost/api?action=inpost-service-settings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      commissionGross: 99,
      defaultDeliveryType: 'locker',
      defaultSendingMethod: 'parcel_locker',
      defaultDropoffPoint: 'boj01n',
      labelDefaultFormat: 'A4',
      labelOpenMode: 'preview',
      labelAutoPrint: true,
      sender,
    }),
  });
  const saved = await route(saveRequest, new URL(saveRequest.url), 'inpost-service-settings');
  assert.equal(saved.status, 200);
  assert.equal(saved.body.settings.commissionGross, 4);
  assert.equal(saved.body.settings.defaultDropoffPoint, 'BOJ01N');
  assert.equal(saved.body.settings.labelDefaultFormat, 'A4');
  assert.equal(saved.body.settings.labelAutoPrint, true);

  const getRequest = new Request('http://localhost/api?action=inpost-service-settings');
  const loaded = await route(getRequest, new URL(getRequest.url), 'inpost-service-settings');
  assert.equal(loaded.status, 200);
  assert.equal(loaded.body.settings.defaultSendingMethod, 'parcel_locker');
  assert.equal(loaded.body.settings.sender.address.street, 'Gryfa Pomorskiego');
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
  assert.equal(history[2].label, 'Etykieta utworzona — paczka czeka na nadanie');
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
    pricing: { totalGross: 14.16, commissionGross: 4.84, customerTotalGross: 19, complete: true },
  };
  const payload = inpostServiceInvoicePayload([record], { invoiceDate: '2026-07-23' });
  assert.equal(payload.invoice.services.length, 1);
  assert.equal(payload.invoice.services[0].gross_price, 1900);
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
  const common = { sender, receiver, pricing: { totalGross: 14.16, commissionGross: 4.84, customerTotalGross: 19, complete: true }, billing: { mode: 'monthly', status: 'pending', month: '2026-07', clientKey: sender.taxCode, commissionGross: 4.84 } };
  const summary = summarizeInpostServiceBilling([
    { id: '1', status: 'label_ready', ...common },
    { id: '2', status: 'label_ready', ...common },
    { id: '3', status: 'cancelled', ...common },
  ]);
  assert.equal(summary.pendingMonthly, 2);
  assert.equal(summary.carrierPendingGross, 28.32);
  assert.equal(summary.commissionPendingGross, 9.68);
  assert.equal(summary.groups.length, 1);
  assert.equal(summary.groups[0].count, 2);
  assert.equal(summary.groups[0].clientKey, '9876543210');
  assert.equal(summary.groups[0].carrierGross, 28.32);
  assert.equal(summary.groups[0].customerTotalGross, 38);
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
  assert.equal(locker.customerTotalGross, 19);
  assert.equal(locker.commissionGross, 4.84);
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
  const [shipping, inventory, core, css, confirmationHtml, confirmationCss] = await Promise.all([
    readFile(new URL('../assets/admin-shipping.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/admin-inventory.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/admin-core.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/admin.css', import.meta.url), 'utf8'),
    readFile(new URL('../assets/inpost-confirmation.html', import.meta.url), 'utf8'),
    readFile(new URL('../assets/inpost-confirmation.css', import.meta.url), 'utf8'),
  ]);
  assert.match(shipping, /#\/admin\/wysylki\/inpost/);
  assert.match(shipping, /function panelWysylkiUslugowejInpost/);
  assert.match(shipping, /Książka adresowa/);
  assert.match(shipping, /Nadawcy/);
  assert.match(shipping, /Odbiorcy/);
  assert.match(shipping, /inpostServiceOtworzKsiazke/);
  assert.match(shipping, /Użyj wybranego adresu/);
  assert.match(shipping, /Używaj tego adresu jako/);
  assert.match(shipping, /Paczkomaty przy tym adresie/);
  assert.match(shipping, /FV: Artway‑TM → nadawca/);
  assert.match(shipping, /Przelicz według umowy/);
  assert.match(shipping, /Stawki InPost/);
  assert.doesNotMatch(shipping, /Abonament netto|Abonament brutto|Umowa abonamentowa/);
  assert.match(shipping, /inpostServicePotwierdzenie/);
  assert.match(shipping, /inpostServiceUzupelnijKontaktTechniczny/);
  assert.match(shipping, /inpostServiceAktualizujKartyStron/);
  assert.match(shipping, /formularz użyje kontaktu Artway-TM/);
  assert.match(shipping, /Drukuj na Brother A4/);
  assert.match(shipping, /Aktualny przebieg transportu/);
  assert.match(shipping, /Cena końcowa usługi/);
  assert.match(shipping, /Potwierdzenie zbiorcze A4/);
  assert.match(shipping, /inpostServiceZastosujZgodnoscTypu/);
  assert.match(shipping, /Automat nadawczy \*/);
  assert.match(shipping, /Cena dopasowana do pełnej kwoty/);
  assert.match(shipping, /4–5 zł/);
  assert.match(shipping, /function panelUstawienWysylkiInpost/);
  assert.match(shipping, /function inpostServicePrzejdzDoEtapu/);
  assert.match(shipping, /inpost-service-postcode/);
  assert.match(shipping, /Kod rozpoznany/);
  assert.match(shipping, /Koszt nadania/);
  assert.match(shipping, /Prowizja Artway-TM/);
  assert.match(shipping, /Kwota na FV klienta/);
  assert.match(shipping, /Podpis osoby wystawiającej/);
  assert.match(shipping, /Pieczęć firmowa Artway-TM/);
  assert.match(shipping, /\/assets\/inpost-confirmation\.html/);
  assert.doesNotMatch(shipping, /<title>Potwierdzenie[^]*<style>/);
  assert.match(confirmationHtml, /\/assets\/inpost-confirmation\.css/);
  assert.match(confirmationCss, /\.signatures/);
  assert.match(confirmationCss, /\.stamp-box/);
  assert.doesNotMatch(shipping, /linear-gradient\(135deg,#111827,#312e81\)/);
  assert.match(shipping, /Kontrola ShipX:<\/b>.*niepotwierdzona/s);
  assert.equal((shipping.match(/function inpostServiceUstawTyp\(/g) || []).length, 1);
  assert.match(core, /#\/admin\/infakt\/wysylki/);
  assert.match(inventory, /function infaktWysylkiInpostPanelHTML/);
  assert.match(css, /\.inpost-service-workspace/);
  assert.match(css, /\.inpost-book-dialog/);
});

test('trasa serwerowa zabezpiecza idempotencję, książkę adresową i wycenę ShipX', async () => {
  const source = await readFile(new URL('../src/backend/lib/inpost-service-shipment-route.mjs', import.meta.url), 'utf8');
  assert.match(source, /duplicatePrevented/);
  assert.match(source, /concurrentDuplicate/);
  assert.match(source, /safeInpostServiceRecord/);
  assert.match(source, /inpost-service-bill/);
  assert.match(source, /inpost-service-contact-save/);
  assert.match(source, /inpost-service-contact-delete/);
  assert.match(source, /inpost-service-contact-import/);
  assert.match(source, /inpost-service-quote/);
  assert.match(source, /inpost-service-postcode/);
  assert.match(source, /shipments\/calculate/);
  assert.doesNotMatch(source, /carrierCost\s*:/);
});

test('zamówienia sklepu korzystają z tego samego cennika umownego bez ujawniania abonamentu', async () => {
  const [route, orderView, orderQuote] = await Promise.all([
    readFile(new URL('../src/backend/lib/inpost-route.mjs', import.meta.url), 'utf8'),
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

test('zamówienie sklepu trafia do własnej organizacji ShipX bez oznaczenia klienta brokera', async () => {
  const service = createInpostService({
    read: async () => ({ items: [] }),
    write: async () => {},
    onOrderStatusTransition: async () => ({}),
  });
  const order = {
    nr: 'ATM-SKLEP-1',
    dostawaId: 'paczkomat',
    paczkomat: 'BOJ01N',
    klient: { imie: 'Jan', nazwisko: 'Test', email: 'jan@example.pl', telefon: '530038914' },
    wysylka: { gabaryt: 'small', sposobNadania: 'parcel_locker', punktNadania: 'BOJ01N' },
  };
  const config = {
    orgId: '45690',
    lockerService: 'inpost_locker_standard',
    courierService: 'inpost_courier_standard',
    sendingMethod: 'parcel_locker',
  };
  const validation = service.walidujPrzesylkeInPost(order);
  const payload = service.przesylkaShipXPayload(order, config, validation);
  const route = await readFile(new URL('../src/backend/lib/inpost-route.mjs', import.meta.url), 'utf8');

  assert.equal(validation.ok, true);
  assert.equal(payload.reference, order.nr);
  assert.equal(payload.service, 'inpost_locker_standard');
  assert.equal(payload.custom_attributes.target_point, 'BOJ01N');
  assert.equal('external_customer_id' in payload, false);
  assert.ok(route.includes('/v1/organizations/${encodeURIComponent(c.orgId)}/shipments'));
});

test('etykieta A4 używa wspieranego przez ShipX typu normal, a A6 zachowuje A6', async () => {
  const calls = [];
  const route = createInpostRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    text: (value, max = 200) => String(value ?? '').slice(0, max),
    orderNumber: (value) => String(value || ''),
    configure: () => ({ configured: true }),
    waitForLabel: async () => ({ id: 'SHIP-1', status: 'confirmed', tracking_number: '620000000000000000000001' }),
    shipmentStatus: (value) => value?.status || '',
    trackingNumber: (value) => value?.tracking_number || '',
    labelReady: (value) => value?.status === 'confirmed',
    call: async (path, options) => { calls.push({ path, options }); return { base64: 'JVBERi0xLjQ=' }; },
  });
  for (const type of ['A4', 'A6']) {
    const request = new Request(`http://localhost/api?action=inpost-label&id=SHIP-1&type=${type}`);
    const result = await route(request, new URL(request.url), 'inpost-label');
    assert.equal(result.status, 200);
    assert.equal(result.body.type, type);
  }
  assert.match(calls[0].path, /type=normal$/);
  assert.match(calls[1].path, /type=A6$/);
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
    postcodeLookup: async (code) => ({ postCode: code, cities: ['Jurków'] }),
  });
  const postcodeRequest = new Request('http://localhost/api?action=inpost-service-postcode&code=34-634');
  const postcode = await route(postcodeRequest, new URL(postcodeRequest.url), 'inpost-service-postcode');
  assert.equal(postcode.status, 200);
  assert.equal(postcode.body.postCode, '34-634');
  assert.deepEqual(postcode.body.cities, ['Jurków']);
  assert.equal(postcode.body.found, true);
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
  assert.equal(quote.body.pricing.customerTotalGross, 19);
  assert.equal(quote.body.pricing.commissionGross, 4.84);
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

test('endpoint tworzenia przesyłki kurierskiej przekazuje wybrany odbiór przez kuriera', async () => {
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
    serviceAvailability: async () => ({ services: ['inpost_courier_standard'], locker: false, courier: true, lockerService: 'inpost_locker_standard', courierService: 'inpost_courier_standard' }),
    call: async (path, options) => {
      calls.push({ path, options });
      if (path.endsWith('/shipments/calculate')) return [{ id: 'REQ-COURIER', calculated_charge_amount: '17.58' }];
      return { id: 'SHIP-1', status: 'confirmed', tracking_number: '620000000000000000000001' };
    },
    waitForLabel: async () => ({ id: 'SHIP-1', status: 'confirmed', tracking_number: '620000000000000000000001' }),
    trackingNumber: (value) => value?.tracking_number || '',
    shipmentStatus: (value) => value?.status || '',
    labelReady: (value) => value?.status === 'confirmed',
    offerId: () => '',
    infaktPublicConfig: () => ({ configured: false }),
    infaktCall: async () => ({}),
    infaktReference: () => '',
  });
  const request = new Request('http://localhost/api?action=inpost-service-create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      requestId: 'REQ-COURIER',
      reference: 'USL-COURIER',
      sender,
      receiver,
      deliveryType: 'courier',
      sendingMethod: 'dispatch_order',
      targetPoint: '',
      dropoffPoint: '',
      comments: '',
      parcel: { template: 'small', length: 64, width: 38, height: 8, weight: 1 },
      billingMode: 'none',
      commissionGross: 4,
    }),
  });
  const result = await route(request, new URL(request.url), 'inpost-service-create');
  assert.equal(result.status, 201);
  assert.equal(result.body.item.status, 'label_ready');
  assert.equal(result.body.item.pricing.customerTotalGross, 22);
  assert.equal(result.body.item.pricing.commissionGross, 4.42);
  assert.equal(result.body.item.billing.commissionGross, 4.42);
  const createCall = calls.find((entry) => /\/shipments$/.test(entry.path));
  assert.ok(createCall);
  assert.equal(createCall.options.bodyObj.service, 'inpost_courier_standard');
  assert.deepEqual(createCall.options.bodyObj.custom_attributes, { sending_method: 'dispatch_order' });
  assert.deepEqual(createCall.options.bodyObj.parcels[0].dimensions, { length: '640', width: '380', height: '80', unit: 'mm' });
  assert.deepEqual(createCall.options.bodyObj.parcels[0].weight, { amount: '1', unit: 'kg' });
  assert.equal(result.body.item.comments, '');
  assert.equal('comments' in createCall.options.bodyObj, false);
  assert.equal(result.body.item.returnAddress.street, 'Gryfa Pomorskiego');
});
