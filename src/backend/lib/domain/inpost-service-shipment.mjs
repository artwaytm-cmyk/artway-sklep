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
    building_number: clean(raw.buildingNumber || raw.building_number || raw.nrDomu, 30),
    flat_number: clean(raw.flatNumber || raw.flat_number || raw.nrLokalu, 30),
    city: clean(raw.city || raw.miasto, 80),
    post_code: postCode(raw.postCode || raw.post_code || raw.kod || raw.kodPocztowy),
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

export function inpostServiceDefaultPriceList() {
  return {
    label: 'Umowa abonamentowa InPost • 12 miesięcy',
    currency: 'PLN',
    subscriptionNet: 300,
    subscriptionGross: 369,
    settlementPeriod: 'monthly',
    paymentDays: 7,
    locker: {
      small: { label: 'Paczkomat gabaryt A', net: 11.51, gross: 14.16 },
      medium: { label: 'Paczkomat gabaryt B', net: 12.95, gross: 15.93 },
      large: { label: 'Paczkomat gabaryt C', net: 15.16, gross: 18.65 },
    },
    courierStandard: [
      { label: 'do 5 kg', maxKg: 5, net: 14.29, gross: 17.58 },
      { label: 'powyżej 5 kg do 10 kg', maxKg: 10, net: 15.83, gross: 19.47 },
      { label: 'powyżej 10 kg do 15 kg', maxKg: 15, net: 16.92, gross: 20.81 },
      { label: 'powyżej 15 kg do 20 kg', maxKg: 20, net: 18.03, gross: 22.18 },
      { label: 'powyżej 20 kg do 25 kg', maxKg: 25, net: 19.04, gross: 23.42 },
      { label: 'powyżej 25 kg do 30 kg', maxKg: 30, net: 19.96, gross: 24.55 },
    ],
    courierManager: {
      small: { label: 'Gabaryt A', net: 14.29, gross: 17.58 },
      medium: { label: 'Gabaryt B', net: 15.83, gross: 19.47 },
      large: { label: 'Gabaryt C', net: 16.92, gross: 20.81 },
      xlarge: { label: 'Gabaryt D', net: 19.96, gross: 24.55 },
    },
    handoff: {
      small: { label: 'Gabaryt A', net: 4.49, gross: 5.52 },
      medium: { label: 'Gabaryt B', net: 5.49, gross: 6.75 },
      large: { label: 'Gabaryt C', net: 6.49, gross: 7.98 },
    },
    quickReturns: {
      small: { label: 'Paczkomat gabaryt A', net: 9.42, gross: 11.59 },
      medium: { label: 'Paczkomat gabaryt B', net: 9.75, gross: 11.99 },
      large: { label: 'Paczkomat gabaryt C', net: 10.10, gross: 12.42 },
    },
    extras: {
      codGross: null,
      insuranceGross: null,
      weekendGross: null,
      pickupGross: null,
      smsGross: null,
      emailGross: null,
      saturdayGross: null,
      dor1720Gross: null,
      rodGross: null,
      nonStandardGross: null,
    },
    updatedAt: '2026-07-23T00:00:00.000Z',
  };
}

function optionalMoney(value, fallback = null) {
  if (value == null || String(value).trim() === '') return fallback;
  return money(value, fallback ?? 0);
}

function normalizeRate(raw = {}, fallback = {}) {
  return {
    label: clean(raw.label || fallback.label, 120),
    ...(fallback.maxKg != null || raw.maxKg != null ? { maxKg: Math.max(0.01, Number(raw.maxKg ?? fallback.maxKg) || fallback.maxKg) } : {}),
    net: money(raw.net, fallback.net),
    gross: money(raw.gross, fallback.gross),
  };
}

export function normalizeInpostServicePriceList(raw = {}) {
  const base = inpostServiceDefaultPriceList();
  const groups = {};
  for (const key of ['locker', 'courierManager', 'handoff', 'quickReturns']) {
    groups[key] = {};
    for (const [size, fallback] of Object.entries(base[key])) groups[key][size] = normalizeRate(raw?.[key]?.[size], fallback);
  }
  return {
    label: clean(raw.label || base.label, 160),
    currency: 'PLN',
    subscriptionNet: money(raw.subscriptionNet, base.subscriptionNet),
    subscriptionGross: money(raw.subscriptionGross, base.subscriptionGross),
    settlementPeriod: 'monthly',
    paymentDays: Math.max(1, Math.min(90, Math.round(Number(raw.paymentDays) || base.paymentDays))),
    ...groups,
    courierStandard: base.courierStandard.map((fallback, index) => normalizeRate(raw?.courierStandard?.[index], fallback)),
    extras: Object.fromEntries(Object.keys(base.extras).map((key) => [key, optionalMoney(raw?.extras?.[key], base.extras[key])])),
    updatedAt: clean(raw.updatedAt || base.updatedAt, 120),
  };
}

export function inpostServiceDefaultSettings() {
  return { commissionGross: 4, sender: {}, priceList: inpostServiceDefaultPriceList(), updatedAt: null };
}

export function normalizeInpostServiceContact(raw = {}, options = {}) {
  const value = party(raw);
  const roles = [...new Set((Array.isArray(raw.roles) ? raw.roles : [options.role || raw.role])
    .map((role) => clean(role, 20))
    .filter((role) => ['sender', 'receiver'].includes(role)))];
  const label = clean(raw.label || raw.name || value.companyName || `${value.firstName} ${value.lastName}`.trim() || value.email, 160);
  return {
    id: clean(raw.id, 100),
    label,
    roles: roles.length ? roles : ['receiver'],
    favoriteSender: raw.favoriteSender === true,
    favoriteReceiver: raw.favoriteReceiver === true,
    ...value,
  };
}

export function inpostServiceContactFingerprint(raw = {}) {
  const value = normalizeInpostServiceContact(raw);
  return [
    value.taxCode,
    value.email,
    value.phone,
    value.address.street,
    value.address.building_number,
    value.address.flat_number,
    value.address.post_code,
    value.address.city,
  ].map((item) => clean(item, 200).toLowerCase()).join('|');
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
      clientKey: sender.taxCode || sender.email,
    },
    pricing: {
      manualGross: money(raw.carrierCostOverride),
      currency: 'PLN',
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
  if (draft.deliveryType === 'courier' && (draft.parcel?.weight <= 0 || draft.parcel?.weight > 30)) errors.push({ field: 'parcel.weight', message: 'Kurier Standard z tego cennika obsługuje wagę od 0,01 do 30 kg.' });
  if (draft.billing?.mode === 'monthly' && (!draft.sender?.companyName || !/^\d{10}$/.test(draft.sender?.taxCode || ''))) errors.push({ field: 'sender.taxCode', message: 'Faktura miesięczna dla nadawcy wymaga nazwy firmy i 10-cyfrowego NIP.' });
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

export function inpostServicePricePayload(draft = {}, id = 'QUOTE') {
  const shipment = inpostServiceShipxPayload(draft);
  return {
    shipments: [{
      id: clean(id, 100) || 'QUOTE',
      ...shipment,
      parcels: Array.isArray(shipment.parcels) ? shipment.parcels[0] : shipment.parcels,
    }],
  };
}

function amount(value) {
  if (value == null || String(value).trim() === '') return null;
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
}

export function inpostServicePricing(raw = {}, options = {}) {
  const value = Array.isArray(raw) ? (raw[0] || {}) : (raw || {});
  const selectedOffer = value.selected_offer || value.selectedOffer || {};
  const offer = selectedOffer.rate != null
    ? selectedOffer
    : (Array.isArray(value.offers) ? value.offers.find((item) => item?.rate != null) : null);
  const calculated = amount(value.calculated_charge_amount);
  const offerRate = amount(offer?.rate);
  const manual = amount(options.manualGross);
  const totalGross = calculated ?? offerRate ?? (manual && manual > 0 ? manual : null);
  const source = calculated != null ? 'shipx_calculation' : offerRate != null ? 'shipx_offer' : totalGross != null ? 'manual' : 'unavailable';
  const commissionGross = amount(options.commissionGross) || 0;
  return {
    totalGross,
    currency: clean(value.currency || offer?.currency || options.currency || 'PLN', 8) || 'PLN',
    source,
    estimated: source === 'manual',
    available: totalGross != null,
    customerTotalGross: totalGross == null ? null : Math.round((totalGross + commissionGross) * 100) / 100,
    commissionGross,
    breakdown: {
      baseGross: amount(value.calculated_charge_amount_non_commission),
      fuelGross: amount(value.fuel_charge_amount),
      notificationGross: amount(value.notification_charge_amount),
      codGross: amount(value.cod_charge_amount),
      insuranceGross: amount(value.insurance_charge_amount),
    },
    checkedAt: new Date().toISOString(),
  };
}

function contractRate(draft = {}, priceList = {}) {
  if (draft.deliveryType === 'locker') {
    let template = ['small', 'medium', 'large'].includes(draft.parcel?.template) ? draft.parcel.template : '';
    if (!template) {
      const dimensions = [draft.parcel?.length, draft.parcel?.width, draft.parcel?.height].map(Number).sort((a, b) => b - a);
      if (dimensions[0] <= 64 && dimensions[1] <= 38) {
        if (dimensions[2] <= 8) template = 'small';
        else if (dimensions[2] <= 19) template = 'medium';
        else if (dimensions[2] <= 41) template = 'large';
      }
    }
    const selected = priceList.locker?.[template];
    return selected ? { ...selected, key: `locker.${template}` } : null;
  }
  const weight = Number(draft.parcel?.weight) || 0;
  const selected = (priceList.courierStandard || []).find((rate) => weight <= Number(rate.maxKg));
  return selected ? { ...selected, key: `courierStandard.${selected.maxKg}` } : null;
}

export function inpostServiceContractPricing(draft = {}, settings = {}, shipxRaw = {}) {
  const priceList = normalizeInpostServicePriceList(settings.priceList || {});
  const api = inpostServicePricing(shipxRaw, { commissionGross: draft.billing?.commissionGross });
  const manual = amount(draft.pricing?.manualGross);
  const rate = contractRate(draft, priceList);
  const extras = priceList.extras || {};
  const selectedExtras = [];
  if (draft.cod?.enabled) selectedExtras.push(['Pobranie', 'codGross']);
  if (draft.insurance?.enabled) selectedExtras.push(['Dodatkowa ochrona', 'insuranceGross']);
  if (draft.weekend) selectedExtras.push(['Paczka w Weekend', 'weekendGross']);
  if (draft.pickupRequested || draft.sendingMethod === 'dispatch_order') selectedExtras.push(['Odbiór przez kuriera', 'pickupGross']);
  if (draft.parcel?.nonStandard) selectedExtras.push(['Element niestandardowy', 'nonStandardGross']);
  for (const service of draft.additionalServices || []) {
    const labels = { sms: 'Powiadomienie SMS', email: 'Powiadomienie e-mail', saturday: 'Doręczenie w sobotę', dor1720: 'Doręczenie 17:00–20:00', rod: 'Zwrot dokumentów' };
    if (labels[service]) selectedExtras.push([labels[service], `${service}Gross`]);
  }
  const unpricedOptions = selectedExtras.filter(([, key]) => extras[key] == null).map(([label]) => label);
  const extraGross = selectedExtras.reduce((sum, [, key]) => sum + (extras[key] == null ? 0 : Number(extras[key]) || 0), 0);
  const commissionGross = amount(draft.billing?.commissionGross) || 0;
  const contractGross = rate ? Math.round((Number(rate.gross || 0) + extraGross) * 100) / 100 : null;
  const totalGross = manual != null && manual > 0 ? manual : contractGross;
  const source = manual != null && manual > 0 ? 'manual' : rate ? 'contract_price_list' : 'unavailable';
  const complete = totalGross != null && (source === 'manual' || unpricedOptions.length === 0);
  return {
    totalGross,
    currency: 'PLN',
    source,
    available: totalGross != null,
    complete,
    estimated: false,
    rateKey: rate?.key || '',
    rateLabel: rate?.label || '',
    contractNet: rate?.net ?? null,
    commissionGross,
    customerTotalGross: totalGross == null ? null : Math.round((totalGross + commissionGross) * 100) / 100,
    breakdown: {
      baseGross: rate?.gross ?? null,
      extrasGross: Math.round(extraGross * 100) / 100,
      fuelIncluded: true,
    },
    unpricedOptions,
    apiComparison: {
      totalGross: api.totalGross,
      source: api.source,
      differenceGross: api.totalGross == null || totalGross == null ? null : Math.round((api.totalGross - totalGross) * 100) / 100,
      checkedAt: api.checkedAt,
    },
    subscription: {
      net: priceList.subscriptionNet,
      gross: priceList.subscriptionGross,
      settlementPeriod: priceList.settlementPeriod,
      includedInShipment: false,
    },
    priceListLabel: priceList.label,
    checkedAt: new Date().toISOString(),
  };
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

export function inpostServiceBillingClientKey(record = {}) {
  return clean(record.sender?.taxCode || record.sender?.email || record.billing?.clientKey, 120).toLowerCase();
}

export function inpostServiceBillingKey(record = {}) {
  if (record.billing?.mode === 'monthly') return `INPOST-MONTHLY:${record.billing.month}:${inpostServiceBillingClientKey(record)}`;
  return `INPOST:${clean(record.id, 120)}`;
}

export function inpostServiceInvoicePayload(records = [], options = {}) {
  const items = (Array.isArray(records) ? records : []).filter(Boolean);
  if (!items.length) {
    const error = new Error('Brak poprawnie wyliczonych nadań InPost do rozliczenia.');
    error.code = 'inpost_billing_empty'; error.status = 422; throw error;
  }
  const missing = items.filter((record) => !(record?.pricing?.customerTotalGross > 0));
  if (missing.length) {
    const error = new Error(`Nie można wystawić FV: ${missing.length} nadań nie ma wyliczonego kosztu i prowizji.`);
    error.code = 'inpost_billing_missing_price'; error.status = 422; throw error;
  }
  const incomplete = items.filter((record) => record?.pricing?.complete !== true);
  if (incomplete.length) {
    const error = new Error(`Nie można wystawić FV: ${incomplete.length} nadań nie ma kompletnego kosztu umownego. Uzupełnij brakujące dopłaty albo wpisz pełny koszt ręcznie.`);
    error.code = 'inpost_billing_incomplete_price'; error.status = 422; throw error;
  }
  const sender = items[0].sender || {}, billingMonth = items[0].billing?.month || new Date().toISOString().slice(0, 7);
  const invoiceDate = /^\d{4}-\d{2}-\d{2}$/.test(clean(options.invoiceDate, 10)) ? clean(options.invoiceDate, 10) : new Date().toISOString().slice(0, 10);
  const paymentDate = new Date(`${invoiceDate}T12:00:00Z`); paymentDate.setUTCDate(paymentDate.getUTCDate() + 7);
  const services = items.map((record) => ({
    name: clean(`Nadanie przesyłki InPost ${record.trackingNumber || record.reference || record.id}`, 300),
    quantity: 1,
    gross_price: Math.round(money(record.pricing.customerTotalGross) * 100),
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
    notes: clean(items.length > 1 ? `Miesięczne rozliczenie nadań InPost Artway-TM: ${billingMonth}. Kwoty obejmują koszt nadania według cennika umownego oraz prowizję Artway-TM.` : `Nadanie InPost Artway-TM: ${items[0].reference || items[0].id}. Kwota obejmuje koszt nadania oraz prowizję Artway-TM.`, 500),
    client_business_activity_kind: sender.companyName || sender.taxCode ? 'other_business' : 'private_person',
    client_company_name: sender.companyName || undefined,
    client_first_name: sender.companyName ? undefined : (sender.firstName || 'Klient'),
    client_last_name: sender.companyName ? undefined : (sender.lastName || 'InPost'),
    client_tax_code: sender.taxCode || undefined,
    client_street: sender.address?.street || undefined,
    client_street_number: sender.address?.building_number || undefined,
    client_flat_number: sender.address?.flat_number || undefined,
    client_city: sender.address?.city || undefined,
    client_post_code: sender.address?.post_code || undefined,
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
    const clientKey = inpostServiceBillingClientKey(item);
    const key = `${item.billing.month}|${clientKey}`;
    const group = groups.get(key) || { key, month: item.billing.month, clientKey, companyName: item.sender?.companyName || '', taxCode: item.sender?.taxCode || '', count: 0, carrierGross: 0, commissionGross: 0, customerTotalGross: 0, incompletePrices: 0, recordIds: [] };
    group.count += 1;
    group.carrierGross += money(item.pricing?.totalGross);
    group.commissionGross += money(item.billing.commissionGross);
    group.customerTotalGross += money(item.pricing?.customerTotalGross);
    if (item.pricing?.complete !== true) group.incompletePrices += 1;
    group.recordIds.push(item.id); groups.set(key, group);
  }
  return {
    total: active.length,
    pendingMonthly: pending.length,
    carrierPendingGross: Math.round(pending.reduce((sum, item) => sum + money(item.pricing?.totalGross), 0) * 100) / 100,
    commissionPendingGross: Math.round(pending.reduce((sum, item) => sum + money(item.billing.commissionGross), 0) * 100) / 100,
    customerPendingGross: Math.round(pending.reduce((sum, item) => sum + money(item.pricing?.customerTotalGross), 0) * 100) / 100,
    groups: [...groups.values()].map((group) => ({
      ...group,
      carrierGross: Math.round(group.carrierGross * 100) / 100,
      commissionGross: Math.round(group.commissionGross * 100) / 100,
      customerTotalGross: Math.round(group.customerTotalGross * 100) / 100,
    })),
  };
}
