function text(value, max = 240) {
  return String(value ?? '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function addressValue(address = {}, ...keys) {
  for (const key of keys) {
    const value = text(address?.[key], 160);
    if (value) return value;
  }
  return '';
}

function splitName(value = '') {
  const parts = text(value, 160).split(' ').filter(Boolean);
  return {
    firstName: parts.shift() || '',
    lastName: parts.join(' '),
  };
}

export function mergeVonHalskyOrderWithLocalState(previous = {}, incoming = {}) {
  return {
    ...previous,
    ...incoming,
    ...(previous?._artwayShipment ? { _artwayShipment: previous._artwayShipment } : {}),
    ...(Array.isArray(previous?._artwayShipmentHistory) ? { _artwayShipmentHistory: previous._artwayShipmentHistory } : {}),
    ...(previous?._artwayCommunication ? { _artwayCommunication: previous._artwayCommunication } : {}),
  };
}

export function vonHalskyOrderToInpostOrder(order = {}, options = {}) {
  const orderId = text(order.id, 80);
  const customer = order.customer && typeof order.customer === 'object' ? order.customer : {};
  const delivery = order.delivery && typeof order.delivery === 'object' ? order.delivery : {};
  const deliveryAddress = delivery.address && typeof delivery.address === 'object' ? delivery.address : {};
  const customerAddress = customer.address && typeof customer.address === 'object' ? customer.address : {};
  const address = Object.keys(deliveryAddress).length ? deliveryAddress : customerAddress;
  const deliveryName = splitName(delivery.name);
  const deliveryType = text(delivery.deliveryType || delivery.type, 20).toUpperCase();
  const locker = deliveryType === 'APM' || Boolean(text(delivery.deliveryPoint, 40));
  const gabaryt = ['small', 'medium', 'large'].includes(text(options.gabaryt, 20).toLowerCase())
    ? text(options.gabaryt, 20).toLowerCase()
    : 'medium';
  const sendingMethod = text(options.sposobNadania || options.sendingMethod, 40) || 'parcel_locker';
  return {
    nr: orderId,
    email: text(options.recipientEmail || delivery.email || customer.email, 200).toLowerCase(),
    telefon: text(options.recipientPhone || delivery.phoneNumber || customer.phoneNumber || customer.phone, 40),
    klient: {
      imie: text(options.recipientFirstName || customer.firstName || deliveryName.firstName, 80) || 'Klient',
      nazwisko: text(options.recipientLastName || customer.lastName || deliveryName.lastName, 80) || orderId,
      email: text(options.recipientEmail || delivery.email || customer.email, 200).toLowerCase(),
      telefon: text(options.recipientPhone || delivery.phoneNumber || customer.phoneNumber || customer.phone, 40),
      firma: text(customer.companyName || customer.company, 160),
    },
    adresDostawy: {
      ulica: text(options.street, 160) || addressValue(address, 'street', 'streetName', 'line1'),
      nrDomu: text(options.buildingNumber, 40) || addressValue(address, 'building', 'buildingNumber', 'houseNumber'),
      nrLokalu: text(options.flatNumber, 40) || addressValue(address, 'flat', 'flatNumber', 'apartmentNumber'),
      kod: text(options.postCode, 20) || addressValue(address, 'postCode', 'postalCode', 'zipCode'),
      miasto: text(options.city, 120) || addressValue(address, 'city', 'town'),
      kraj: text(options.countryCode, 8).toUpperCase() || addressValue(address, 'countryCode', 'country') || 'PL',
    },
    dostawaId: locker ? 'paczkomat' : 'kurier_inpost',
    paczkomat: locker ? text(options.targetPoint || delivery.deliveryPoint, 40).toUpperCase() : '',
    razem: Number(order.finalPrice?.amount ?? order.total?.amount ?? 0) || 0,
    wysylka: {
      gabaryt,
      sposobNadania: sendingMethod,
      punktNadania: text(options.punktNadania || options.dropoffPoint, 40).toUpperCase(),
      punktKod: locker ? text(options.targetPoint || delivery.deliveryPoint, 40).toUpperCase() : '',
    },
  };
}

export function vonHalskyShipmentOptions(body = {}) {
  return Object.fromEntries([
    'gabaryt', 'sposobNadania', 'punktNadania', 'targetPoint',
    'recipientFirstName', 'recipientLastName', 'recipientEmail', 'recipientPhone',
    'street', 'buildingNumber', 'flatNumber', 'postCode', 'city', 'countryCode',
  ].map((key) => [key, body[key]]));
}

export function vonHalskyShippingDraft(mapped = {}) {
  return {
    gabaryt: mapped.wysylka?.gabaryt || 'medium',
    sposobNadania: mapped.wysylka?.sposobNadania || 'parcel_locker',
    punktNadania: mapped.wysylka?.punktNadania || '',
    targetPoint: mapped.paczkomat || mapped.wysylka?.punktKod || '',
    recipientFirstName: mapped.klient?.imie || '', recipientLastName: mapped.klient?.nazwisko || '',
    recipientEmail: mapped.klient?.email || mapped.email || '', recipientPhone: mapped.klient?.telefon || mapped.telefon || '',
    street: mapped.adresDostawy?.ulica || '', buildingNumber: mapped.adresDostawy?.nrDomu || '',
    flatNumber: mapped.adresDostawy?.nrLokalu || '', postCode: mapped.adresDostawy?.kod || '',
    city: mapped.adresDostawy?.miasto || '', countryCode: mapped.adresDostawy?.kraj || 'PL',
  };
}

const TERMINAL_ORDER_STATUSES = new Set(['COMPLETED', 'REFUSED', 'CANCELLED', 'REFUNDED', 'RETURNED']);
const DECISION_ORDER_STATUSES = new Set(['CREATED', 'NEW', 'PAID']);
const READY_ORDER_STATUSES = new Set(['ACCEPTED', 'PROCESSING', 'READY']);
const DELIVERED_SHIPMENT_STATUSES = new Set(['delivered']);
const TRANSIT_SHIPMENT_STATUSES = new Set([
  'dispatched_by_sender', 'collected_from_sender', 'taken_by_courier',
  'adopted_at_source_branch', 'sent_from_source_branch', 'out_for_delivery', 'ready_to_pickup',
  'pickup_reminder_sent', 'pickup_time_expired', 'avizo', 'returned_to_sender',
]);
const EDITABLE_SHIPMENT_STATUSES = new Set(['created', 'offers_prepared', 'offer_selected']);

function parcelIdentifiers(parcel = {}) {
  return [
    parcel.trackingNumber,
    parcel.tracking_number,
    parcel.number,
    parcel.shipmentId,
    parcel.shipment_id,
    parcel.id,
  ].map((value) => text(value, 160)).filter(Boolean);
}

export function vonHalskyOrderParcels(order = {}) {
  const source = order?.delivery?.parcels;
  const parcels = Array.isArray(source) ? source : source ? [source] : [];
  return parcels.map((parcel) => ({
    ...parcel,
    identifiers: parcelIdentifiers(parcel),
  }));
}

export function vonHalskyShipmentLinked(order = {}, trackingNumber = '', inpostId = '') {
  const expected = new Set([text(trackingNumber, 160), text(inpostId, 160)].filter(Boolean));
  if (!expected.size) return false;
  return vonHalskyOrderParcels(order).some((parcel) => parcel.identifiers.some((value) => expected.has(value)));
}

export function vonHalskyOrderShippingStage(order = {}) {
  const orderStatus = text(order.status, 80).toUpperCase();
  const shipment = order?._artwayShipment && typeof order._artwayShipment === 'object' ? order._artwayShipment : {};
  const shipmentStatus = text(shipment.status, 80).toLowerCase();
  const parcels = vonHalskyOrderParcels(order);
  const parcelStatuses = parcels.map((parcel) => text(parcel.status, 80).toLowerCase()).filter(Boolean);
  const trackingNumber = text(shipment.trackingNumber, 160)
    || parcels.flatMap((parcel) => parcel.identifiers).find(Boolean)
    || '';
  if (TERMINAL_ORDER_STATUSES.has(orderStatus)) {
    return { key: 'closed', label: orderStatus === 'COMPLETED' ? 'Zakończone' : 'Zamknięte', requiresAction: false, trackingNumber };
  }
  if (DELIVERED_SHIPMENT_STATUSES.has(shipmentStatus) || parcelStatuses.some((status) => DELIVERED_SHIPMENT_STATUSES.has(status))) {
    return { key: 'delivered', label: 'Dostarczona', requiresAction: false, trackingNumber };
  }
  if (TRANSIT_SHIPMENT_STATUSES.has(shipmentStatus) || parcelStatuses.some((status) => TRANSIT_SHIPMENT_STATUSES.has(status))) {
    return { key: 'in_transit', label: 'W transporcie', requiresAction: false, trackingNumber };
  }
  if (trackingNumber || shipment.inpostId || shipment.labelReady === true || parcels.length) {
    return { key: 'shipped', label: 'Nadana', requiresAction: false, trackingNumber };
  }
  if (DECISION_ORDER_STATUSES.has(orderStatus)) return { key: 'decision', label: 'Do decyzji', requiresAction: true, trackingNumber: '' };
  if (READY_ORDER_STATUSES.has(orderStatus)) return { key: 'awaiting_shipment', label: 'Do nadania', requiresAction: true, trackingNumber: '' };
  return { key: 'unknown', label: 'Do sprawdzenia', requiresAction: true, trackingNumber: '' };
}

export function vonHalskyShipmentCanEdit(shipment = {}) {
  return !text(shipment.trackingNumber, 160)
    && EDITABLE_SHIPMENT_STATUSES.has(text(shipment.status, 80).toLowerCase());
}

export function vonHalskyShipmentView(order = {}) {
  const shipment = order?._artwayShipment && typeof order._artwayShipment === 'object' ? order._artwayShipment : {};
  const stage = vonHalskyOrderShippingStage(order);
  return {
    inpostId: text(shipment.inpostId, 80),
    trackingNumber: text(shipment.trackingNumber, 160),
    status: text(shipment.status, 80),
    labelReady: shipment.labelReady === true,
    vonHalskyLinked: shipment.vonHalskyLinked === true,
    linkedAt: text(shipment.linkedAt, 80),
    createdAt: text(shipment.createdAt, 80),
    checkedAt: text(shipment.checkedAt, 80),
    reference: text(shipment.reference || order.id, 80),
    parcels: vonHalskyOrderParcels(order),
    configuration: shipment.configuration && typeof shipment.configuration === 'object' ? shipment.configuration : {},
    editable: vonHalskyShipmentCanEdit(shipment),
    stage,
    history: Array.isArray(order?._artwayShipmentHistory) ? order._artwayShipmentHistory.slice(-10) : [],
  };
}
