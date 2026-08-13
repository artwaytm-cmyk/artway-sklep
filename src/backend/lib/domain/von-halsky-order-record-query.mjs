const HAS_SHIPMENT = "COALESCE(NULLIF(data#>>'{_artwayShipment,trackingNumber}',''),NULLIF(data#>>'{_artwayShipment,inpostId}',''),NULLIF(data#>>'{delivery,parcels,0,trackingNumber}',''),'')<>''";
const DELIVERED = "(LOWER(COALESCE(data#>>'{_artwayShipment,status}',''))='delivered' OR LOWER(COALESCE(data#>>'{delivery,parcels,0,status}',''))='delivered' OR status='COMPLETED')";
const TRANSIT = "LOWER(COALESCE(data#>>'{_artwayShipment,status}','')) IN ('dispatched_by_sender','collected_from_sender','taken_by_courier','adopted_at_source_branch','sent_from_source_branch','out_for_delivery','ready_to_pickup','pickup_reminder_sent','pickup_time_expired','avizo','returned_to_sender')";

export function applyVonHalskyOrderRecordFilters(clauses, { delivery = '', fulfillment = '' } = {}) {
  const deliveryType = "UPPER(COALESCE(data#>>'{delivery,deliveryType}',''))";
  if (delivery === 'paczkomat') clauses.push(`${deliveryType} IN ('APM','LOCKER','PARCEL_LOCKER')`);
  else if (delivery === 'kurier') clauses.push(`(${deliveryType} LIKE '%COURIER%' OR ${deliveryType} IN ('P2D','ADDRESS'))`);
  else if (delivery === 'punkt') clauses.push(`${deliveryType} IN ('POP','PUDO','PICKUP_POINT')`);
  const facetsClauses = [...clauses];
  if (fulfillment === 'nowe') clauses.push("status IN ('CREATED','NEW','PAID')");
  else if (fulfillment === 'do_obslugi') clauses.push(`status IN ('CREATED','NEW','PAID','ACCEPTED','PROCESSING','READY') AND NOT (${HAS_SHIPMENT})`);
  else if (fulfillment === 'do_decyzji') clauses.push("status IN ('CREATED','NEW','PAID')");
  else if (fulfillment === 'do_nadania') clauses.push(`status IN ('ACCEPTED','PROCESSING','READY') AND NOT (${HAS_SHIPMENT})`);
  else if (fulfillment === 'nadane') clauses.push(`(${HAS_SHIPMENT}) AND NOT (${TRANSIT}) AND NOT (${DELIVERED})`);
  else if (fulfillment === 'w_transporcie') clauses.push(TRANSIT);
  else if (['dostarczone', 'zrealizowane'].includes(fulfillment)) clauses.push(DELIVERED);
  else if (fulfillment === 'anulowane') clauses.push("status IN ('REFUSED','CANCELLED','REFUNDED','RETURNED')");
  else if (fulfillment === 'zamkniete') clauses.push(`(${DELIVERED} OR status IN ('REFUSED','CANCELLED','REFUNDED','RETURNED'))`);
  return facetsClauses;
}

export function vonHalskyRecordOrderBy(sort = '') {
  const value = "CASE WHEN COALESCE(data#>>'{finalPrice,amount}',data#>>'{total,amount}','')~'^[0-9]+([.,][0-9]+)?$' THEN REPLACE(COALESCE(data#>>'{finalPrice,amount}',data#>>'{total,amount}'),',','.')::numeric ELSE 0 END";
  if (sort === 'najstarsze') return 'updated_at ASC,record_id';
  if (sort === 'wartosc_desc') return `${value} DESC,updated_at DESC,record_id`;
  if (sort === 'wartosc_asc') return `${value} ASC,updated_at DESC,record_id`;
  return 'updated_at DESC,record_id';
}

export const VON_HALSKY_ORDER_FACETS_SELECT = `
  SELECT
    COUNT(*)::integer wszystkie,
    COUNT(*) FILTER(WHERE status IN ('CREATED','NEW','PAID'))::integer nowe,
    COUNT(*) FILTER(WHERE status IN ('CREATED','NEW','PAID','ACCEPTED','PROCESSING','READY') AND NOT (${HAS_SHIPMENT}))::integer do_obslugi,
    COUNT(*) FILTER(WHERE status IN ('CREATED','NEW','PAID'))::integer do_decyzji,
    COUNT(*) FILTER(WHERE status IN ('ACCEPTED','PROCESSING','READY') AND NOT (${HAS_SHIPMENT}))::integer do_nadania,
    COUNT(*) FILTER(WHERE (${HAS_SHIPMENT}) AND NOT (${TRANSIT}) AND NOT (${DELIVERED}))::integer nadane,
    COUNT(*) FILTER(WHERE ${TRANSIT})::integer w_transporcie,
    COUNT(*) FILTER(WHERE ${DELIVERED})::integer zrealizowane,
    COUNT(*) FILTER(WHERE status IN ('REFUSED','CANCELLED','REFUNDED','RETURNED'))::integer anulowane
  FROM artway_von_halsky_records`;
