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
  const outOfStock = catalog.filter((product) => product?.__saleUnavailable === true || product?._catalog?.availability?.saleAvailable === false).length;
  const metadataStatus = selected.length ? 'completed' : 'no-changes';
  return {
    runAt,
    metadata: { status: metadataStatus, count: selected.length, label: 'Tytuły, opisy i frazy' },
    structuredData: { status: metadataStatus, count: selected.length, label: 'Product, Offer i Open Graph' },
    sitemap: { status: 'published', count: catalog.length, outOfStock, label: 'Mapa strony' },
    googleFeed: { status: 'published', count: catalog.length, outOfStock, label: 'Bezpłatny feed Google' },
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

function compactText(value, max = 160) {
  return String(value ?? '').trim().slice(0, max);
}

export function buildSeoAutomationStatus(data = {}, { updatedAt = '', now = new Date().toISOString() } = {}) {
  const source = data && typeof data === 'object' ? data : {};
  const config = {
    enabled: true,
    dailyLimit: 50,
    autoAllProducts: true,
    autoFillMissing: true,
    preferBestsellers: true,
    indexNowEnabled: true,
    ...(source.artway_seo_ustawienia || {}),
  };
  const history = Array.isArray(source.artway_seo_historia) ? source.artway_seo_historia : [];
  const today = seoAutomationDay(now);
  const scheduledToday = scheduledSeoRunForDay(history, today)
    || (String(config.lastScheduledDay || '') === today ? history.find((item) => String(item?.at || '').startsWith(today)) : null);
  const last = history[0] || null;
  const channels = config.lastChannels && typeof config.lastChannels === 'object' ? config.lastChannels : {};
  const dailyLimit = Math.max(1, Math.min(50, Number(config.dailyLimit) || 50));
  return {
    enabled: config.enabled !== false,
    mode: 'background-systemd-timer',
    settings: {
      dailyLimit,
      autoAllProducts: config.autoAllProducts !== false,
      autoFillMissing: config.autoFillMissing !== false,
      preferBestsellers: config.preferBestsellers !== false,
      indexNowEnabled: config.indexNowEnabled !== false,
    },
    today: {
      day: today,
      completed: Boolean(scheduledToday || String(config.lastScheduledDay || '') === today),
      processed: Number(scheduledToday?.count ?? (String(config.lastScheduledDay || '') === today ? config.lastRunCount : 0)) || 0,
      limit: dailyLimit,
    },
    lastRunAt: config.lastRunAt || last?.at || '',
    lastRunCount: Number(config.lastRunCount ?? last?.count) || 0,
    channels,
    promotion: {
      status: config.lastPromotionStatus || channels.indexNow?.status || '',
      count: Number(config.lastPromotionCount ?? channels.indexNow?.requestCount) || 0,
      httpStatus: Number(config.lastPromotionHttpStatus ?? channels.indexNow?.httpStatus) || 0,
      at: config.lastPromotionAt || '',
    },
    schedule: {
      timezone: WARSAW_TIME_ZONE,
      window: 'codziennie 04:15–04:23',
      persistent: true,
      nextRun: String(config.lastScheduledDay || '') === today ? 'jutro 04:15–04:23' : 'najbliższe 04:15–04:23',
    },
    recent: history.slice(0, 5).map((item) => ({
      id: compactText(item?.id),
      at: item?.at || '',
      source: compactText(item?.source, 100),
      count: Number(item?.count) || 0,
      scheduledDay: compactText(item?.scheduledDay, 20),
      promotion: item?.promotion || null,
    })),
    updatedAt: updatedAt || config.lastRunAt || last?.at || '',
  };
}
