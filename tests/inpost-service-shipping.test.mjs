import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  inpostServiceInvoicePayload,
  inpostServiceContractPricing,
  inpostServiceCommissionFor,
  inpostServiceDefaultPriceList,
  inpostServiceDefaultCommissionTiers,
  inpostServiceDefaultSettings,
  inpostServicePricePayload,
  inpostServicePricing,
  inpostServiceSenderComment,
  inpostServiceShipxPayload,
  normalizeInpostServiceContact,
  normalizeInpostServiceCommissionTiers,
  normalizeInpostServiceDraft,
  safeInpostServiceRecord,
  summarizeInpostServiceBilling,
  validateInpostServiceDraft,
} from '../src/backend/lib/domain/inpost-service-shipment.mjs';
import { normalizeInpostServiceTracking } from '../src/backend/lib/domain/inpost-service-tracking.mjs';
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
    customer: sender,
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
  }, { commissionGross: 4, sender: inpostServiceDefaultSettings().sender }, {
    lockerService: 'inpost_locker_standard',
    courierService: 'inpost_courier_standard',
  });
}

test('nadanie usługowe obsługuje Paczkomat, pobranie, ochronę i Paczkę w Weekend bez wysyłania nadawcy', () => {
  const value = draft();
  assert.equal(validateInpostServiceDraft(value).ok, true);
  const payload = inpostServiceShipxPayload(value);
  assert.equal(payload.service, 'inpost_locker_standard');
  assert.equal(payload.custom_attributes.target_point, 'BOJ01N');
  assert.equal(payload.custom_attributes.dropoff_point, 'BOJ01N');
  assert.deepEqual(payload.additional_services, ['labelless']);
  assert.equal(payload.end_of_week_collection, true);
  assert.deepEqual(payload.cod, { amount: 149.99, currency: 'PLN' });
  assert.deepEqual(payload.insurance, { amount: 200, currency: 'PLN' });
  assert.equal(payload.sender, undefined);
  assert.equal(payload.external_customer_id, undefined);
  assert.equal(value.reference, 'USL-1');
  assert.match(value.comments, /^Nadawca: Nadawca sp\. z o\.o\./);
  assert.match(value.comments, /Gryfa Pomorskiego 1\/A/);
  assert.match(value.comments, /84-207, Bojano/);
  assert.equal(payload.comments, value.comments);
  assert.ok(value.comments.length <= 100);
});

test('pełny adres klienta zlecającego trafia do uwag, a ręczna referencja pozostaje krótka', () => {
  const value = draft({
    reference: 'USL-ABC123 • Stara firma • Stara 1, 00-001, Warszawa',
    comments: '',
  });
  assert.equal(value.reference, 'USL-ABC123');
  assert.match(value.comments, /^Nadawca:/);
  assert.match(value.comments, /Gryfa Pomorskiego 1\/A, 84-207, Bojano/);
  assert.equal(inpostServiceSenderComment({}, 'Uwaga operatora'), 'Uwaga operatora');
});

test('klient zlecający jest opcjonalny, a bezpieczna wycena nie wysyła nadawcy do ShipX', () => {
  const value = draft({ customer: {}, billingMode: 'none' });
  assert.equal(validateInpostServiceDraft(value).ok, true);
  assert.equal(value.customer.email, '');
  assert.equal(value.reference, 'USL-1');
  const shipment = inpostServiceShipxPayload(value);
  const quote = inpostServicePricePayload(value, 'SAFE-TEST');
  assert.equal(shipment.sender, undefined);
  assert.equal(quote.shipments[0].sender, undefined);
  assert.equal(quote.shipments[0].id, 'SAFE-TEST');
});

test('kurier zachowuje wybór jednego z trzech sposobów nadania jak Manager InPost', () => {
  const value = draft({
    deliveryType: 'courier',
    targetPoint: '',
    dropoffPoint: 'BOJ01N',
    sendingMethod: 'parcel_locker',
    weekend: true,
    additionalServices: ['sms'],
  });
  assert.equal(value.sendingMethod, 'parcel_locker');
  assert.equal(value.pickupRequested, false);
  assert.equal(value.weekend, false);
  assert.equal(validateInpostServiceDraft(value).ok, true);
  const payload = inpostServiceShipxPayload(value);
  assert.equal(payload.service, 'inpost_courier_standard');
  assert.deepEqual(payload.custom_attributes, { sending_method: 'parcel_locker', dropoff_point: 'BOJ01N' });
  assert.deepEqual(payload.additional_services, ['sms']);
  assert.equal(draft({ deliveryType: 'courier', targetPoint: '', pickupRequested: true }).pickupRequested, true);
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
  assert.match(inpostErrorText({ message: 'Błąd walidacji', details: { custom_attributes: ['[object Object]'] } }), /sposób nadania nie pasuje/i);
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
  assert.equal(unavailable.status, 'no_price');
});

test('wycena ShipX odczytuje odpowiedź opakowaną i zachowuje czytelny powód braku ceny', () => {
  const wrapped = inpostServicePricing({ shipments: [{ calculated_charge_amount: '21.37', currency: 'PLN' }] });
  assert.equal(wrapped.totalGross, 21.37);
  assert.equal(wrapped.status, 'priced');
  const noPrice = inpostServicePricing({ calculations: [{ key: 'no_offers', message: 'Brak dostępnej ceny dla konta' }] });
  assert.equal(noPrice.totalGross, null);
  assert.equal(noPrice.status, 'no_price');
  assert.equal(noPrice.code, 'no_offers');
  assert.equal(noPrice.message, 'Brak dostępnej ceny dla konta');
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
  const invalid = draft({ customer: { ...sender, companyName: '', taxCode: '' } });
  assert.equal(validateInpostServiceDraft(invalid).ok, false);
  assert.ok(validateInpostServiceDraft(invalid).errors.some((error) => error.field === 'customer.taxCode'));
  const base = draft();
  const record = {
    id: 'IPS-1',
    reference: base.reference,
    trackingNumber: '620000000000000000000000',
    sender: base.sender,
    customer: base.customer,
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
  const common = { sender: inpostServiceDefaultSettings().sender, customer: sender, receiver, pricing: { totalGross: 14.16, customerTotalGross: 18.16, complete: true }, billing: { mode: 'monthly', status: 'pending', month: '2026-07', clientKey: sender.taxCode, commissionGross: 4 } };
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

test('konto postpaid używa pełnej stawki umownej i nie księguje domyślnej ceny ShipX', () => {
  const list = inpostServiceDefaultPriceList();
  assert.deepEqual(Object.values(list.locker).map((rate) => rate.gross), [14.16, 15.93, 18.65]);
  assert.deepEqual(list.courierStandard.map((rate) => rate.gross), [17.58, 19.47, 20.81, 22.18, 23.42, 24.55]);
  assert.deepEqual(Object.values(list.courierManager).map((rate) => rate.gross), [17.58, 19.47, 20.81, 24.55]);
  assert.deepEqual(Object.values(list.handoff).map((rate) => rate.gross), [5.52, 6.75, 7.98]);
  assert.deepEqual(Object.values(list.quickReturns).map((rate) => rate.gross), [11.59, 11.99, 12.42]);
  const settings = inpostServiceDefaultSettings();
  const basic = draft({ cod: { enabled: false, amount: 0 }, insurance: { enabled: false, amount: 0 }, weekend: false });
  const locker = inpostServiceContractPricing(basic, settings, [{ calculated_charge_amount: '1.00' }]);
  assert.equal(locker.totalGross, 14.16);
  assert.equal(locker.customerTotalGross, 18.16);
  assert.equal(locker.source, 'contract_postpaid');
  assert.equal(locker.pricingMode, 'contract_postpaid');
  assert.equal(locker.apiComparison.totalGross, 1);
  assert.equal(locker.apiComparison.trusted, false);
  assert.equal(locker.apiComparison.usedForBilling, false);
  assert.equal(locker.apiComparison.code, 'postpaid_calculation_not_contractual');
  assert.equal(locker.contractComparison.totalGross, 14.16);
  assert.equal(locker.contractComparison.differenceGross, -13.16);
  assert.equal(locker.subscription.gross, 369);
  assert.equal(locker.subscription.includedInShipment, false);

  const prepaid = inpostServiceContractPricing(basic, { ...settings, pricingMode: 'prepaid' }, [{ calculated_charge_amount: '16.50' }]);
  assert.equal(prepaid.totalGross, 16.5);
  assert.equal(prepaid.source, 'shipx_calculation');
  assert.equal(prepaid.apiComparison.trusted, true);
  assert.equal(prepaid.customerTotalGross, 20.5);

  const courier = draft({ deliveryType: 'courier', parcel: { template: 'small', weight: 12 }, targetPoint: '', cod: { enabled: false, amount: 0 }, insurance: { enabled: false, amount: 0 }, weekend: false });
  const courierPrice = inpostServiceContractPricing(courier, settings, {});
  assert.equal(courierPrice.rateLabel, 'powyżej 10 kg do 15 kg');
  assert.equal(courierPrice.totalGross, 20.81);
  assert.equal(courierPrice.contractComparison.totalGross, 20.81);
});

test('metoda dispatch_order nie dolicza odbioru kuriera bez osobnego zlecenia', () => {
  const settings = inpostServiceDefaultSettings();
  const courier = draft({
    deliveryType: 'courier',
    targetPoint: '',
    dropoffPoint: '',
    sendingMethod: 'dispatch_order',
    pickupRequested: false,
    parcel: { template: 'small', weight: 1 },
    cod: { enabled: false, amount: 0 },
    insurance: { enabled: false, amount: 0 },
    weekend: false,
    additionalServices: [],
  });
  const withoutPickup = inpostServiceContractPricing(courier, settings, {});
  assert.equal(withoutPickup.totalGross, 17.58);
  assert.equal(withoutPickup.complete, true);
  assert.equal(withoutPickup.contractComparison.totalGross, 17.58);
  assert.deepEqual(withoutPickup.unpricedOptions, []);
  const explicitPickup = inpostServiceContractPricing({ ...courier, pickupRequested: true }, settings, {});
  assert.equal(explicitPickup.complete, false);
  assert.deepEqual(explicitPickup.unpricedOptions, ['Odbiór przez kuriera']);
  assert.equal(explicitPickup.contractComparison.complete, false);
});

test('prowizja ma co najmniej cztery automatyczne progi kosztu wysyłki', () => {
  const tiers = inpostServiceDefaultCommissionTiers();
  assert.deepEqual(tiers, [
    { upToGross: 20, commissionGross: 4 },
    { upToGross: 30, commissionGross: 6 },
    { upToGross: 40, commissionGross: 8 },
    { upToGross: 50, commissionGross: 10 },
  ]);
  assert.equal(inpostServiceCommissionFor(14.16, tiers).commissionGross, 4);
  assert.equal(inpostServiceCommissionFor(20, tiers).commissionGross, 4);
  assert.equal(inpostServiceCommissionFor(20.01, tiers).commissionGross, 6);
  assert.equal(inpostServiceCommissionFor(30.01, tiers).commissionGross, 8);
  assert.equal(inpostServiceCommissionFor(40.01, tiers).commissionGross, 10);
  assert.deepEqual(inpostServiceCommissionFor(75, tiers), { upToGross: 50, commissionGross: 10, index: 3, overflow: true });
  assert.deepEqual(normalizeInpostServiceCommissionTiers([{ upToGross: 99, commissionGross: 1 }]), tiers);
  assert.equal(inpostServiceDefaultSettings().commissionTiers.length, 4);
  assert.equal(inpostServiceDefaultSettings().defaultSendingMethod, 'parcel_locker');
  assert.equal(inpostServiceDefaultSettings().defaultDeliveryType, 'locker');
  assert.equal(inpostServiceDefaultSettings().defaultParcelTemplate, 'small');
  assert.equal(inpostServiceDefaultSettings().defaultParcelWeight, 1);
  assert.equal(inpostServiceDefaultSettings().defaultBillingMode, 'none');
  assert.equal(inpostServiceDefaultSettings().defaultDropoffPoint, '');
  assert.equal(inpostServiceDefaultSettings().labelDefaultFormat, 'A6');
  assert.equal(inpostServiceDefaultSettings().labelOpenMode, 'preview');
  assert.equal(inpostServiceDefaultSettings().labelAutoPrint, false);
  assert.equal(inpostServiceDefaultSettings().pricingMode, 'contract_postpaid');
});

test('brak stawki za wybraną dopłatę blokuje fakturę, ale pełny koszt ręczny ją odblokowuje', () => {
  const settings = inpostServiceDefaultSettings();
  const withWeekend = inpostServiceContractPricing(draft({ weekend: true }), settings, {});
  assert.equal(withWeekend.complete, false);
  assert.deepEqual(withWeekend.unpricedOptions, ['Pobranie', 'Dodatkowa ochrona', 'Paczka w Weekend']);
  const manual = inpostServiceContractPricing(draft({ weekend: true, carrierCostOverride: 22.5 }), settings, {});
  assert.equal(manual.complete, true);
  assert.equal(manual.totalGross, 22.5);
  assert.equal(manual.commissionGross, 6);
  assert.equal(manual.customerTotalGross, 28.5);
});

test('panel udostępnia ręczne nadania oraz wspólną kartę rozliczeń inFakt', async () => {
  const [shipping, inventory, core, css, printCss] = await Promise.all([
    readFile(new URL('../assets/admin-shipping.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/admin-inventory.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/admin-core.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/admin.css', import.meta.url), 'utf8'),
    readFile(new URL('../assets/inpost-print.css', import.meta.url), 'utf8'),
  ]);
  assert.match(shipping, /#\/admin\/wysylki\/inpost/);
  assert.match(shipping, /#\/admin\/wysylki\/inpost-ustawienia/);
  assert.match(shipping, /function panelWysylkiUslugowejInpost/);
  assert.match(shipping, /function panelUstawienWysylkiInpost/);
  assert.match(shipping, /Książka adresowa/);
  assert.match(shipping, /Klienci zlecający/);
  assert.match(shipping, /Odbiorcy/);
  assert.match(shipping, /inpostServiceOtworzKsiazke/);
  assert.match(shipping, /Użyj wybranego adresu/);
  assert.match(shipping, /Używaj tego adresu jako/);
  assert.match(shipping, /Paczkomaty przy tym adresie/);
  assert.match(shipping, /FV: Artway‑TM → klient zlecający/);
  assert.match(shipping, /Przy tworzeniu paczki nie wysyłamy pola nadawcy/);
  assert.match(shipping, /Klient zlecający — opcjonalnie/);
  assert.match(shipping, /Test bez tworzenia/);
  assert.match(shipping, /Utwórz prawdziwą przesyłkę/);
  assert.doesNotMatch(shipping, /name="senderEmail" type="email" required/);
  assert.match(shipping, /Numer referencyjny/);
  assert.match(shipping, /Dane nadawcy są automatycznie przenoszone do pola „Uwagi”/);
  assert.match(shipping, /Uwagi dla InPost — nadawca klienta/);
  assert.match(shipping, /nazwa nadawcy i pełny adres/);
  assert.match(shipping, /maxlength="100"/);
  assert.match(shipping, /Cennik umowny/);
  assert.match(shipping, /pełna stawka umowna jest ceną podstawową/);
  assert.match(shipping, /cennik umowny • postpaid/);
  assert.match(shipping, /inpost-rejestr/);
  assert.match(shipping, /if\(value==null\|\|String\(value\)\.trim\(\)===\"\"\)return null/);
  assert.match(shipping, /Odbiór ze stałego adresu Artway‑TM/);
  assert.match(shipping, /customer:inpostServiceStronaOsoby/);
  assert.match(shipping, /courier:\[\s*\["parcel_locker"/);
  assert.match(shipping, /\["dispatch_order","Przesyłkę odbierze kurier InPost"\]/);
  assert.match(shipping, /\["pop","Nadam w PaczkoPunkcie"\]/);
  assert.match(shipping, /Cennik umowny/);
  assert.match(shipping, /Stawki InPost/);
  assert.match(shipping, /Progi mojej prowizji/);
  assert.match(shipping, /minimum 4/);
  assert.match(shipping, /Powyżej ostatniego progu obowiązuje ostatnia prowizja/);
  assert.doesNotMatch(shipping, /Abonament netto|Abonament brutto|Umowa abonamentowa/);
  assert.match(shipping, /inpostServicePotwierdzenie/);
  assert.match(shipping, /Drukuj \/ zapisz PDF/);
  assert.match(shipping, /inpost-print\.css/);
  assert.match(printCss, /\.facts\{display:grid/);
  assert.match(shipping, /Historia przesyłki/);
  assert.match(shipping, /Koszt nadania/);
  assert.match(shipping, /inpostServiceHistoriaPrzesylki/);
  assert.match(shipping, /Domyślny automat nadawczy/);
  assert.match(shipping, /defaultSendingMethod/);
  assert.match(shipping, /#\/admin\/wysylki\/odbior-kuriera/);
  assert.match(shipping, /function panelOdbioruKurieraInpost/);
  assert.match(shipping, /Sposób nadania/);
  assert.match(shipping, /Numer przesyłki/);
  assert.match(shipping, /inpostServiceZastosujZgodnoscTypu/);
  assert.match(shipping, /Automat nadawczy \*/);
  assert.match(shipping, /cennik umowny InPost • postpaid/);
  assert.match(shipping, /Ostatnia próba połączenia z ShipX/);
  assert.equal((shipping.match(/function inpostServiceUstawTyp\(/g) || []).length, 1);
  assert.match(core, /#\/admin\/infakt\/wysylki/);
  assert.match(inventory, /function infaktWysylkiInpostPanelHTML/);
  assert.match(css, /\.inpost-service-workspace/);
  assert.match(css, /\.inpost-book-dialog/);
  assert.match(css, /width:min\(100%,1180px\)/);
  assert.match(css, /grid-template-areas:"delivery" "size" "receiver" "extras" "method" "customer" "settlement"/);
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
  assert.match(source, /shipments\/calculate/);
  assert.doesNotMatch(source, /await activeServices/);
  assert.doesNotMatch(source, /carrierCost\s*:/);
});

test('otwarcie centrum wysyłek nie czeka na zdalny odczyt organizacji ShipX', async () => {
  let organizationCalls = 0;
  const route = createInpostServiceShipmentRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    text: (value, max = 200) => String(value ?? '').slice(0, max),
    readVersioned: async (_key, fallback) => ({ value: structuredClone(fallback), version: 1 }),
    publicConfig: () => ({ configured: true }),
    configure: () => ({ configured: true, orgId: 'ORG-1', lockerService: 'inpost_locker_standard', courierService: 'inpost_courier_standard' }),
    organization: async () => { organizationCalls += 1; throw new Error('nie wywołuj przy otwarciu strony'); },
  });
  const request = new Request('http://localhost/api?action=inpost-service-shipments');
  const result = await route(request, new URL(request.url), 'inpost-service-shipments');
  assert.equal(result.status, 200);
  assert.equal(organizationCalls, 0);
  assert.equal(result.body.settings.priceList.locker.small.gross, 14.16);
  assert.equal(result.body.serviceAvailability.configured, true);
  assert.equal(result.body.serviceAvailability.verified, false);
});

test('stara techniczna cena ShipX nie pozostaje kosztem oczekującego rozliczenia postpaid', async () => {
  const settings = inpostServiceDefaultSettings();
  const oldRecord = {
    id: 'IPS-OLD', status: 'label_ready', createdAt: '2026-08-08T10:00:00.000Z', updatedAt: '2026-08-08T10:05:00.000Z',
    ...draft({ cod: { enabled: false, amount: 0 }, insurance: { enabled: false, amount: 0 }, weekend: false }),
    pricing: { totalGross: 1, source: 'shipx_calculation', complete: true, checkedAt: '2026-08-08T10:04:00.000Z' },
    billing: { mode: 'monthly', status: 'pending', commissionGross: 4 },
  };
  const route = createInpostServiceShipmentRoute({
    respond: (body, status = 200) => ({ body, status }), isAdmin: () => true,
    text: (value, max = 200) => String(value ?? '').slice(0, max),
    readVersioned: async (key, fallback) => ({ value: key === 'inpost_service_shipments' ? { items: [oldRecord], contacts: [], settings } : fallback, version: 1 }),
    publicConfig: () => ({ configured: true }), configure: () => ({ configured: true, orgId: 'ORG-1', lockerService: 'inpost_locker_standard', courierService: 'inpost_courier_standard' }),
  });
  const request = new Request('http://localhost/api?action=inpost-service-shipments');
  const result = await route(request, new URL(request.url), 'inpost-service-shipments');
  assert.equal(result.body.items[0].pricing.totalGross, 14.16);
  assert.equal(result.body.items[0].pricing.source, 'contract_postpaid');
  assert.equal(result.body.items[0].pricing.apiComparison.totalGross, 1);
  assert.equal(result.body.items[0].pricing.correctedFromLegacyShipxPrice, true);
  assert.equal(result.body.items[0].pricing.checkedAt, '2026-08-08T10:04:00.000Z');
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

test('wycena zamówienia sklepu odrzuca techniczną cenę ShipX na koncie postpaid', async () => {
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
    configure: () => ({ configured: true, orgId: 'ORG-1', lockerService: 'inpost_locker_standard' }),
    shipmentPayload: () => ({ service: 'inpost_locker_standard', parcels: [{ template: 'small' }], custom_attributes: { target_point: 'BOJ01N' } }),
    call: async () => [{ id: 'ATM-TEST', calculated_charge_amount: '16.50' }],
    text: (value, max = 200) => String(value ?? '').slice(0, max),
  });
  const request = new Request('http://localhost/api?action=inpost-order-quote&nr=ATM-TEST');
  const result = await route(request, new URL(request.url), 'inpost-order-quote');
  assert.equal(result.status, 200);
  assert.equal(result.body.pricing.totalGross, 14.16);
  assert.equal(result.body.pricing.source, 'contract_postpaid');
  assert.equal(result.body.pricing.apiComparison.totalGross, 16.5);
  assert.equal(result.body.pricing.apiComparison.trusted, false);
  assert.equal(result.body.pricing.rateLabel, 'Paczkomat gabaryt A');
  assert.equal(result.body.pricing.contractComparison.totalGross, 14.16);
  assert.equal(result.body.pricing.subscription, undefined);
  assert.equal(result.body.pricing.priceListLabel, undefined);
  assert.equal(result.body.pricing.contractNet, undefined);
});

test('etykieta InPost używa funkcji gotowości bez kolizji nazwy i zwraca PDF', async () => {
  const route = createInpostRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    text: (value, max = 200) => String(value ?? '').slice(0, max),
    orderNumber: (value) => String(value || ''),
    configure: () => ({ configured: true }),
    waitForLabel: async () => ({ id: 'SHIPX-1', status: 'confirmed', tracking_number: 'TRACK-1' }),
    shipmentStatus: (value) => value?.status || '',
    trackingNumber: (value) => value?.tracking_number || '',
    labelReady: (value) => value?.status === 'confirmed',
    call: async () => ({ base64: 'JVBERi0xLjQK' }),
  });
  const request = new Request('http://localhost/api?action=inpost-label&id=SHIPX-1&type=A6');
  const result = await route(request, new URL(request.url), 'inpost-label');
  assert.equal(result.status, 200);
  assert.equal(result.body.labelReady, true);
  assert.equal(result.body.format, 'pdf');
  assert.equal(result.body.base64, 'JVBERi0xLjQK');
});

test('wspólny podgląd etykiety dostaje bezpośredni PDF z bezpiecznymi nagłówkami', async () => {
  const route = createInpostRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    text: (value, max = 200) => String(value ?? '').slice(0, max),
    orderNumber: (value) => String(value || ''),
    configure: () => ({ configured: true }),
    waitForLabel: async () => ({ id: 'SHIPX-1', status: 'confirmed', tracking_number: 'TRACK-1' }),
    shipmentStatus: (value) => value?.status || '',
    trackingNumber: (value) => value?.tracking_number || '',
    labelReady: (value) => value?.status === 'confirmed',
    call: async () => ({ base64: 'JVBERi0xLjQK' }),
  });
  const request = new Request('http://localhost/api?action=inpost-label-file&id=SHIPX-1&type=A6');
  const response = await route(request, new URL(request.url), 'inpost-label-file');
  assert.ok(response instanceof Response);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.match(response.headers.get('content-disposition'), /^inline;/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(Buffer.from(await response.arrayBuffer()).toString(), '%PDF-1.4\n');
});

test('sklep, nadania usługowe i Von Halsky korzystają z jednego podglądu oraz ustawień druku', async () => {
  const [shipping, service, vonHalsky, settings, style] = await Promise.all([
    readFile(new URL('../src/frontend/07b-shipping-integrations.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/frontend/07d-inpost-service-shipping.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/frontend/11d-von-halsky-operations-workspace.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/frontend/07e-inpost-service-address-book-pricing.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles/37-von-halsky-workspace.css', import.meta.url), 'utf8'),
  ]);
  assert.match(shipping, /function inpostOtworzPodgladEtykiety/);
  assert.match(shipping, /function inpostEtykietaPrzejdzDoUstawien/);
  assert.match(shipping, /von-halsky-record-dialog-shell/);
  assert.match(shipping, /inpost-label-file/);
  assert.match(shipping, /inpost-label-preview/);
  assert.match(service, /inpostOtworzPodgladEtykiety/);
  assert.match(vonHalsky, /inpostOtworzPodgladEtykiety/);
  assert.match(settings, /name="labelDefaultFormat"/);
  assert.match(settings, /name="labelOpenMode"/);
  assert.match(settings, /name="labelAutoPrint"/);
  assert.match(style, /\.inpost-label-preview-shell/);
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
  const initialRequest = new Request('http://localhost/api?action=inpost-service-shipments');
  const initialState = await route(initialRequest, new URL(initialRequest.url), 'inpost-service-shipments');
  assert.equal(initialState.body.settings.defaultParcelWeight, 1);
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
      cod: { enabled: false, amount: 0 },
      insurance: { enabled: false, amount: 0 },
      weekend: false,
    }),
  });
  const quote = await route(quoteRequest, new URL(quoteRequest.url), 'inpost-service-quote');
  assert.equal(quote.status, 200);
  assert.equal(quote.body.testOnly, true);
  assert.equal(quote.body.created, false);
  assert.equal(quote.body.pricing.totalGross, 14.16);
  assert.equal(quote.body.pricing.source, 'contract_postpaid');
  assert.equal(quote.body.pricing.apiComparison.totalGross, 16.5);
  assert.equal(quote.body.pricing.apiComparison.trusted, false);
  assert.equal(quote.body.pricing.contractComparison.totalGross, 14.16);
  assert.equal(calls[0].path, '/v1/organizations/ORG-1/shipments/calculate');
  assert.equal(calls[0].options.bodyObj.shipments[0].custom_attributes.target_point, 'BOJ01N');
  assert.equal(calls[0].options.bodyObj.shipments[0].sender, undefined);
  assert.equal(storage.has('inpost_service_shipments'), false);

  const settingsRequest = new Request('http://localhost/api?action=inpost-service-settings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pricingMode: 'prepaid', defaultDeliveryType: 'courier', defaultSendingMethod: 'parcel_locker', defaultDropoffPoint: 'boj01n', defaultParcelTemplate: 'medium', defaultParcelWeight: 2.5, defaultBillingMode: 'monthly', defaultWeekend: true, labelDefaultFormat: 'A4', labelOpenMode: 'browser', labelAutoPrint: true, commissionTiers: [
      { upToGross: 20, commissionGross: 4 },
      { upToGross: 30, commissionGross: 6 },
      { upToGross: 40, commissionGross: 8 },
      { upToGross: 50, commissionGross: 10 },
      { upToGross: 70, commissionGross: 12 },
    ] }),
  });
  const savedSettings = await route(settingsRequest, new URL(settingsRequest.url), 'inpost-service-settings');
  assert.equal(savedSettings.status, 200);
  assert.equal(savedSettings.body.settings.commissionTiers.length, 5);
  assert.equal(savedSettings.body.settings.commissionGross, 4);
  assert.equal(savedSettings.body.settings.defaultSendingMethod, 'parcel_locker');
  assert.equal(savedSettings.body.settings.pricingMode, 'prepaid');
  assert.equal(savedSettings.body.settings.defaultDeliveryType, 'courier');
  assert.equal(savedSettings.body.settings.defaultParcelTemplate, 'medium');
  assert.equal(savedSettings.body.settings.defaultParcelWeight, 2.5);
  assert.equal(savedSettings.body.settings.defaultBillingMode, 'monthly');
  assert.equal(savedSettings.body.settings.defaultWeekend, true);
  assert.equal(savedSettings.body.settings.defaultDropoffPoint, 'BOJ01N');
  assert.equal(savedSettings.body.settings.labelDefaultFormat, 'A4');
  assert.equal(savedSettings.body.settings.labelOpenMode, 'browser');
  assert.equal(savedSettings.body.settings.labelAutoPrint, true);

  const getSettingsRequest = new Request('http://localhost/api?action=inpost-service-settings');
  const fetchedSettings = await route(getSettingsRequest, new URL(getSettingsRequest.url), 'inpost-service-settings');
  assert.equal(fetchedSettings.body.settings.labelDefaultFormat, 'A4');
  assert.equal(fetchedSettings.body.settings.labelAutoPrint, true);

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
      parcel: { template: 'small', weight: 1 },
      billingMode: 'none',
      commissionGross: 4,
    }),
  });
  const result = await route(request, new URL(request.url), 'inpost-service-create');
  assert.equal(result.status, 201);
  assert.equal(result.body.item.status, 'label_ready');
  const createCall = calls.find((entry) => /\/shipments$/.test(entry.path));
  assert.ok(createCall);
  assert.equal(createCall.options.bodyObj.service, 'inpost_courier_standard');
  assert.deepEqual(createCall.options.bodyObj.custom_attributes, { sending_method: 'dispatch_order' });
});
