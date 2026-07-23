const MONEY_MAX = 1_000_000;
const BILLING_MODES = new Set(['none', 'single', 'monthly']);
const DELIVERY_TYPES = new Set(['locker', 'courier']);
const SENDING_METHODS = new Set(['parcel_locker', 'any_point', 'pok', 'pop', 'courier_pok', 'branch', 'dispatch_order']);
const LOCKER_EXTRAS = new Set(['labelless']);
const COURIER_EXTRAS = new Set(['sms', 'email', 'saturday', 'dor1720', 'rod', 'labelless']);

function clean(value, max = 200) {
  return String(value ?? '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function digits(value, max = 20) {
  return String(value ?? '').replace(/\D/g, '').slice(-max);
}

function money(value, fallback = 0) {
  const number = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(MONEY_MAX, Math.round(number * 100) / 100));
}

function postCode(value) {
  const match = clean(value, 12).replace(/\s/g, '').match(/^(\d{2})-?(\d{3})$/);
  return match ? `${match[1]}-${match[2]}` : clean(value, 12);
}

function phone(value) {
  const valueDigits = digits(value);
  return valueDigits.length === 11 && valueDigits.startsWith('48') ? valueDigits.slice(2) : valueDigits.slice(-9);
}

function emailOk(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function address(raw = {}) {
  return {
    street: clean(raw.street || raw.ulica, 120),
    building_number: clean(raw.buildingNumber || raw.nrDomu, 30),
    flat_number: clean(raw.flatNumber || raw.nrLokalu, 30),
    city: clean(raw.city || raw.miasto, 80),
    post_code: postCode(raw.postCode || raw.kod || raw.kodPocztowy),
    country_code: 'PL',
  };
}

function party(raw = {}) {
  return {
    companyName: clean(raw.companyName || raw.company || raw.firma, 160),
    taxCode: digits(raw.taxCode || raw.nip, 10),
    firstName: clean(raw.firstName || raw.imie, 80),
    lastName: clean(raw.lastName || raw.nazwisko, 80),
    email: clean(raw.email, 200).toLowerCase(),
    phone: phone(raw.phone || raw.telefon),
    address: address(raw.address || raw),
  };
}

function shipxParty(value, includeAddress = true) {
  const result = {
    first_name: value.firstName || (value.companyName ? 'Obsługa' : 'Klient'),
    last_name: value.lastName || (value.companyName ? value.companyName.slice(0, 80) : 'InPost'),
    email: value.email,
    phone: value.phone,
  };
  if (value.companyName) result.company_name = value.companyName;
  if (includeAddress) result.address = Object.fromEntries(Object.entries(value.address).filter(([, item]) => item));
  return result;
}

function parcel(raw = {}) {
  const template = clean(raw.template || raw.gabaryt, 20).toLowerCase();
  if (['small', 'medium', 'large'].includes(template)) return { template };
  return {
    dimensions: {
      length: String(Math.round((Number(raw.length || raw.dlugosc) || 30) * 10)),
      width: String(Math.round((Number(raw.width || raw.szerokosc) || 20) * 10)),
      height: String(Math.round((Number(raw.height || raw.wysokosc) || 15) * 10)),
      unit: 'mm',
    },
    weight: { amount: String(Number(raw.weight || raw.waga) || 1), unit: 'kg' },
    ...(raw.nonStandard === true ? { is_non_standard: true } : {}),
  };
}

export function inpostServiceDefaultSettings() {
  return { commissionGross: 4, sender: {}, updatedAt: null };
}

export function normalizeInpostServiceDraft(raw = {}, settings = {}, services = {}) {
  const deliveryType = DELIVERY_TYPES.has(clean(raw.deliveryType, 20)) ? clean(raw.deliveryType, 20) : 'locker';
  const sendingMethod = SENDING_METHODS.has(clean(raw.sendingMethod, 40)) ? clean(raw.sendingMethod, 40) : 'parcel_locker';
  const allowedExtras = deliveryType === 'locker' ? LOCKER_EXTRAS : COURIER_EXTRAS;
  const extras = [...new Set((Array.isArray(raw.additionalServices) ? raw.additionalServices : []).map((item) => clean(item, 30)).filter((item) => allowedExtras.has(item)))];
  const billingMode = BILLING_MODES.has(clean(raw.billingMode, 20)) ? clean(raw.billingMode, 20) : 'none';
  const commissionGross = money(raw.commissionGross, money(settings.commissionGross, 4));
  const sender = party({ ...(settings.sender || {}), ...(raw.sender || {}) });
  const receiver = party(raw.receiver || {});
  const service = deliveryType === 'locker'
    ? clean(services.lockerService || services.locker || 'inpost_locker_standard', 80)
    : clean(services.courierService || services.courier || 'inpost_courier_standard', 80);
  return {
    requestId: clean(raw.requestId, 100),
    reference: clean(raw.reference, 80),
    comments: clean(raw.comments, 100),
    deliveryType,
    service,
    sendingMethod,
    targetPoint: clean(raw.targetPoint, 40).toUpperCase(),
    dropoffPoint: clean(raw.dropoffPoint, 40).toUpperCase(),
    sender,
    receiver,
    parcel: {
      template: clean(raw.parcel?.template || raw.template, 20).toLowerCase(),
      length: Number(raw.parcel?.length || raw.length) || 30,
      width: Number(raw.parcel?.width || raw.width) || 20,
      height: Number(raw.parcel?.height || raw.height) || 15,
      weight: Number(raw.parcel?.weight || raw.weight) || 1,
      nonStandard: raw.parcel?.nonStandard === true || raw.nonStandard === true,
    },
    cod: { enabled: raw.cod?.enabled === true, amount: money(raw.cod?.amount) },
    insurance: { enabled: raw.insurance?.enabled === true, amount: money(raw.insurance?.amount) },
    weekend: deliveryType === 'locker' && raw.weekend === true,
    additionalServices: extras,
    pickupRequested: raw.pickupRequested === true || sendingMethod === 'dispatch_order',
    billing: {
      mode: billingMode,
      commissionGross,
      month: /^\d{4}-\d{2}$/.test(clean(raw.billingMonth, 7)) ? clean(raw.billingMonth, 7) : new Date().toISOString().slice(0, 7),
      clientKey: receiver.taxCode || receiver.email,
    },
  };
}

export function validateInpostServiceDraft(draft = {}) {
  const errors = [];
  for (const [prefix, person] of [['sender', draft.sender], ['receiver', draft.receiver]]) {
    if (!person?.companyName && !person?.firstName) errors.push({ field: `${prefix}.firstName`, message: `Podaj imię albo firmę ${prefix === 'sender' ? 'nadawcy' : 'odbiorcy'}.` });
    if (!emailOk(person?.email)) errors.push({ field: `${prefix}.email`, message: `Podaj poprawny e-mail ${prefix === 'sender' ? 'nadawcy' : 'odbiorcy'}.` });
    if (!/^\d{9}$/.test(person?.phone || '')) errors.push({ field: `${prefix}.phone`, message: `Podaj 9-cyfrowy telefon ${prefix === 'sender' ? 'nadawcy' : 'odbiorcy'}.` });
  }
  const requiredAddresses = [['sender', draft.sender?.address], ...(draft.deliveryType === 'courier' ? [['receiver', draft.receiver?.address]] : [])];
  for (const [prefix, value] of requiredAddresses) {
    if (!value?.street) errors.push({ field: `${prefix}.address.street`, message: 'Brak ulicy.' });
    if (!value?.building_number) errors.push({ field: `${prefix}.address.buildingNumber`, message: 'Brak numeru budynku.' });
    if (!/^\d{2}-\d{3}$/.test(value?.post_code || '')) errors.push({ field: `${prefix}.address.postCode`, message: 'Niepoprawny kod pocztowy.' });
    if (!value?.city) errors.push({ field: `${prefix}.address.city`, message: 'Brak miejscowości.' });
  }
  if (draft.deliveryType === 'locker' && !draft.targetPoint) errors.push({ field: 'targetPoint', message: 'Wybierz Paczkomat lub PaczkoPunkt odbiorcy.' });
  if (draft.cod?.enabled && draft.cod.amount <= 0) errors.push({ field: 'cod.amount', message: 'Podaj kwotę pobrania.' });
  if (draft.insurance?.enabled && draft.insurance.amount <= 0) errors.push({ field: 'insurance.amount', message: 'Podaj wartość ubezpieczenia.' });
  if (draft.billing?.mode === 'monthly' && (!draft.receiver?.companyName || !/^\d{10}$/.test(draft.receiver?.taxCode || ''))) errors.push({ field: 'receiver.taxCode', message: 'Faktura miesięczna wymaga nazwy firmy i 10-cyfrowego NIP.' });
  if (draft.billing?.mode !== 'none' && draft.billing.commissionGross <= 0) errors.push({ field: 'commissionGross', message: 'Prowizja do faktury musi być większa od 0 zł.' });
  if (!draft.requestId) errors.push({ field: 'requestId', message: 'Brak identyfikatora operacji. Odśwież formularz.' });
  return { ok: errors.length === 0, errors };
}

export function inpostServiceShipxPayload(draft = {}) {
  const customAttributes = { sending_method: draft.sendingMethod };
  if (draft.deliveryType === 'locker') customAttributes.target_point = draft.targetPoint;
  if (draft.dropoffPoint && ['parcel_locker', 'pok', 'pop', 'courier_pok'].includes(draft.sendingMethod)) customAttributes.dropoff_point = draft.dropoffPoint;
  const payload = {
    sender: shipxParty(draft.sender, true),
    receiver: shipxParty(draft.receiver, draft.deliveryType === 'courier'),
    parcels: [parcel(draft.parcel)],
    service: draft.service,
    reference: draft.reference,
    comments: draft.comments || `Nadanie usługowe ${draft.reference}`.slice(0, 100),
    external_customer_id: draft.billing.clientKey || undefined,
    only_choice_of_offer: false,
    custom_attributes: customAttributes,
  };
  if (draft.additionalServices.length) payload.additional_services = draft.additionalServices;
  if (draft.weekend) payload.end_of_week_collection = true;
  if (draft.cod.enabled) payload.cod = { amount: draft.cod.amount, currency: 'PLN' };
  if (draft.insurance.enabled || draft.cod.enabled) payload.insurance = { amount: Math.max(draft.insurance.amount, draft.cod.amount), currency: 'PLN' };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
  return payload;
}

export function inpostServicePickupPayload(record = {}) {
  const sender = record.sender || {}, addressValue = sender.address || {};
  return {
    shipments: [record.inpostId],
    comment: clean(`Odbiór przesyłki ${record.reference || record.id}`, 100),
    name: clean(sender.companyName || `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || 'Artway-TM', 100),
    phone: sender.phone,
    email: sender.email,
    address: {
      street: addressValue.street,
      building_number: addressValue.building_number,
      city: addressValue.city,
      post_code: addressValue.post_code,
      country_code: 'PL',
    },
  };
}

export function inpostServiceBillingKey(record = {}) {
  if (record.billing?.mode === 'monthly') return `INPOST-MONTHLY:${record.billing.month}:${clean(record.billing.clientKey, 120).toLowerCase()}`;
  return `INPOST:${clean(record.id, 120)}`;
}

export function inpostServiceInvoicePayload(records = [], options = {}) {
  const items = (Array.isArray(records) ? records : []).filter((record) => record?.billing?.commissionGross > 0);
  if (!items.length) {
    const error = new Error('Brak prowizji InPost do rozliczenia.');
    error.code = 'inpost_billing_empty'; error.status = 422; throw error;
  }
  const receiver = items[0].receiver || {}, billingMonth = items[0].billing?.month || new Date().toISOString().slice(0, 7);
  const invoiceDate = /^\d{4}-\d{2}-\d{2}$/.test(clean(options.invoiceDate, 10)) ? clean(options.invoiceDate, 10) : new Date().toISOString().slice(0, 10);
  const paymentDate = new Date(`${invoiceDate}T12:00:00Z`); paymentDate.setUTCDate(paymentDate.getUTCDate() + 7);
  const services = items.map((record) => ({
    name: clean(`Obsługa nadania InPost ${record.trackingNumber || record.reference || record.id}`, 300),
    quantity: 1,
    gross_price: Math.round(money(record.billing.commissionGross) * 100),
    tax_symbol: '23',
    unit: 'szt.',
  }));
  const payload = {
    status: 'draft',
    currency: 'PLN',
    payment_method: 'transfer',
    invoice_date: invoiceDate,
    sale_date: invoiceDate,
    payment_date: paymentDate.toISOString().slice(0, 10),
    sale_type: 'service',
    notes: clean(items.length > 1 ? `Miesięczne rozliczenie obsługi nadań InPost: ${billingMonth}` : `Obsługa nadania InPost: ${items[0].reference || items[0].id}`, 500),
    client_business_activity_kind: receiver.companyName || receiver.taxCode ? 'other_business' : 'private_person',
    client_company_name: receiver.companyName || undefined,
    client_first_name: receiver.companyName ? undefined : (receiver.firstName || 'Klient'),
    client_last_name: receiver.companyName ? undefined : (receiver.lastName || 'InPost'),
    client_tax_code: receiver.taxCode || undefined,
    client_street: receiver.address?.street || undefined,
    client_street_number: receiver.address?.building_number || undefined,
    client_flat_number: receiver.address?.flat_number || undefined,
    client_city: receiver.address?.city || undefined,
    client_post_code: receiver.address?.post_code || undefined,
    services,
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
  return { invoice: payload, send_to_ksef: false };
}

export function safeInpostServiceRecord(record = {}) {
  const safe = JSON.parse(JSON.stringify(record || {}));
  delete safe.carrierCost;
  delete safe.carrierRate;
  delete safe.selectedOffer;
  delete safe.offers;
  return safe;
}

export function summarizeInpostServiceBilling(items = []) {
  const active = (Array.isArray(items) ? items : []).filter((item) => item?.status !== 'cancelled');
  const pending = active.filter((item) => item?.billing?.mode === 'monthly' && item?.billing?.status === 'pending');
  const groups = new Map();
  for (const item of pending) {
    const key = `${item.billing.month}|${item.billing.clientKey}`;
    const group = groups.get(key) || { key, month: item.billing.month, clientKey: item.billing.clientKey, companyName: item.receiver?.companyName || '', taxCode: item.receiver?.taxCode || '', count: 0, commissionGross: 0, recordIds: [] };
    group.count += 1; group.commissionGross += money(item.billing.commissionGross); group.recordIds.push(item.id); groups.set(key, group);
  }
  return {
    total: active.length,
    pendingMonthly: pending.length,
    commissionPendingGross: Math.round(pending.reduce((sum, item) => sum + money(item.billing.commissionGross), 0) * 100) / 100,
    groups: [...groups.values()].map((group) => ({ ...group, commissionGross: Math.round(group.commissionGross * 100) / 100 })),
  };
}
