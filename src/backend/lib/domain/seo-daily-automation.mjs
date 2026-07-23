const WARSAW_TIME_ZONE = 'Europe/Warsaw';

export function seoAutomationDay(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: WARSAW_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isScheduledSeoSource(value = '') {
  return String(value || '').trim().toLowerCase().startsWith('scheduled');
}

export function scheduledSeoRunForDay(history = [], day = seoAutomationDay()) {
  return (Array.isArray(history) ? history : []).find((entry) => {
    if (!entry || entry.type !== 'daily' || !isScheduledSeoSource(entry.source)) return false;
    return String(entry.scheduledDay || seoAutomationDay(entry.at)) === String(day);
  }) || null;
}

export function buildSeoChannelReport({
  selectedProducts = [],
  catalogProducts = [],
  promotion = {},
  runAt = new Date().toISOString(),
} = {}) {
  const selected = Array.isArray(selectedProducts) ? selectedProducts : [];
  const catalog = Array.isArray(catalogProducts) ? catalogProducts : [];
  const imageCount = catalog.filter((product) => product?.zdjecie || (Array.isArray(product?.zdjecia) && product.zdjecia.length)).length;
  const metadataStatus = selected.length ? 'completed' : 'no-changes';
  return {
    runAt,
    metadata: { status: metadataStatus, count: selected.length, label: 'Tytuły, opisy i frazy' },
    structuredData: { status: metadataStatus, count: selected.length, label: 'Product, Offer i Open Graph' },
    sitemap: { status: 'published', count: catalog.length, label: 'Mapa strony' },
    googleFeed: { status: 'published', count: catalog.length, label: 'Bezpłatny feed Google' },
    images: { status: imageCount ? 'published' : 'no-products', count: imageCount, label: 'Google Images i Lens' },
    indexNow: {
      status: String(promotion?.status || 'skipped'),
      count: Math.max(0, Number(promotion?.count || 0) - (promotion?.submitted ? 1 : 0)),
      requestCount: Math.max(0, Number(promotion?.count || 0)),
      label: 'IndexNow / Bing',
      httpStatus: promotion?.httpStatus ?? null,
      scope: String(promotion?.scope || ''),
    },
  };
}

export function duplicateScheduledSeoResult(entry = {}, limit = 50) {
  return {
    processed: 0,
    limit,
    skipped: true,
    reason: 'already-ran-today',
    previousRunAt: entry.at || '',
    scheduledDay: entry.scheduledDay || seoAutomationDay(entry.at),
    promotion: entry.promotion || { status: 'skipped', count: 0 },
    channels: entry.channels || null,
  };
}
