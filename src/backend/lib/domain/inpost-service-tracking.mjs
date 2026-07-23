const STATUS_LABELS = {
  created: 'Przesyłka utworzona',
  confirmed: 'Przesyłka potwierdzona',
  dispatched_by_sender: 'Przekazana przez nadawcę',
  collected_from_sender: 'Odebrana od nadawcy',
  taken_by_courier: 'Odebrana przez kuriera',
  adopted_at_source_branch: 'Przyjęta w oddziale nadawczym',
  sent_from_source_branch: 'Wysłana z oddziału nadawczego',
  adopted_at_sorting_center: 'Przyjęta w sortowni',
  sent_from_sorting_center: 'Wysłana z sortowni',
  adopted_at_target_branch: 'Przyjęta w oddziale docelowym',
  out_for_delivery: 'Wydana do doręczenia',
  ready_to_pickup: 'Gotowa do odbioru',
  pickup_reminder_sent: 'Wysłano przypomnienie o odbiorze',
  delivered: 'Doręczona',
  avizo: 'Nieudana próba doręczenia',
  undelivered: 'Nie doręczono',
  missing: 'Przesyłka poszukiwana',
  returned_to_sender: 'Zwrócona do nadawcy',
  cancelled: 'Przesyłka anulowana',
};

function clean(value, max = 200) {
  return String(value ?? '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function trackingDate(value, fallback = '') {
  const source = clean(value, 80);
  if (!source) return fallback;
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function trackingLocation(value) {
  if (!value) return '';
  if (typeof value === 'string') return clean(value, 160);
  return clean(value.name || value.description || value.city || value.address || value.location, 160);
}

function normalizeEvent(event = {}) {
  const status = clean(event.status || event.type || event.code, 100).toLowerCase();
  return {
    status,
    originStatus: clean(event.originStatus || event.origin_status, 80),
    label: clean(event.title || event.label || STATUS_LABELS[status] || status.replaceAll('_', ' '), 180),
    description: clean(event.description, 300),
    location: trackingLocation(event.location || event.agency),
    occurredAt: trackingDate(event.occurredAt || event.datetime || event.occurred_at || event.date, ''),
    source: 'inpost',
  };
}

export function normalizeInpostServiceTracking(raw = {}, previous = [], checkedAt = new Date().toISOString()) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const details = Array.isArray(source.tracking_details)
    ? source.tracking_details
    : Array.isArray(source.trackingDetails)
      ? source.trackingDetails
      : Array.isArray(source.events)
        ? source.events
        : [];
  const fresh = details.map(normalizeEvent).filter((event) => event.status || event.occurredAt);
  const currentStatus = clean(source.status, 100).toLowerCase();
  const currentDate = trackingDate(source.updated_at || source.updatedAt, trackingDate(checkedAt, new Date().toISOString()));
  if (currentStatus && !fresh.some((event) => event.status === currentStatus)) {
    fresh.push(normalizeEvent({
      status: currentStatus,
      label: STATUS_LABELS[currentStatus] || currentStatus.replaceAll('_', ' '),
      occurredAt: currentDate,
    }));
  }
  const combined = [...fresh, ...(Array.isArray(previous) ? previous : []).map(normalizeEvent)]
    .filter((event) => event.status || event.occurredAt);
  const unique = new Map();
  for (const event of combined) {
    const key = `${event.status}|${event.originStatus}|${event.occurredAt}|${event.location}`;
    if (!unique.has(key)) unique.set(key, event);
  }
  return [...unique.values()]
    .sort((left, right) => String(right.occurredAt).localeCompare(String(left.occurredAt)))
    .slice(0, 100);
}
