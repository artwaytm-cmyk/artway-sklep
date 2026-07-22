import { createStoreRepository } from '../core/store-repository.mjs';
import crypto from 'node:crypto';
import { requestSession } from '../core/security.mjs';

const repository = createStoreRepository({ name: 'artway-sklep' });
const KEY = 'seo_performance';
const CHANNELS = new Set(['google', 'bing', 'duckduckgo', 'yahoo', 'ecosia', 'other_search', 'direct', 'referral', 'campaign']);
const EVENTS = new Set(['landing', 'product_view', 'add_to_cart', 'order']);
const DOMAINS = new Set(['artwaytm.pl', 'allsklep.pl']);
const METRICS = ['landing', 'product_view', 'add_to_cart', 'order'];
const MAX_REPORT_DAYS = 400;
const requestWindows = new Map();

const warsawDayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' });
const isoDay = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = warsawDayFormatter.formatToParts(date), get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};
const number = (value, max = 1_000_000) => Math.max(0, Math.min(max, Number(value) || 0));
const text = (value, max = 120) => String(value ?? '').replace(/[^a-zA-Z0-9_.:/-]/g, '').slice(0, max);
const safeKey = (value, max = 120) => {
  const key = text(value, max);
  return !key || Object.prototype.hasOwnProperty.call(Object.prototype, key) ? '' : key;
};
const domain = (value) => {
  const normalized = String(value || '').toLowerCase().replace(/^www\./, '').split(':')[0];
  return DOMAINS.has(normalized) ? normalized : 'artwaytm.pl';
};
const landingPath = (value) => {
  const clean = String(value || '/').split(/[?#]/)[0].replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180);
  return clean.startsWith('/') ? clean : '/';
};
const referrerDomain = (value) => safeKey(String(value || '').toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9.-]/g, ''), 120);
const campaign = (value) => safeKey(String(value || '').toLowerCase().replace(/[^a-z0-9_.-]/g, ''), 80);
const emptyMetrics = () => ({ landing: 0, product_view: 0, add_to_cart: 0, order: 0, revenue: 0 });
const emptyDimension = () => ({ ...emptyMetrics(), landingPages: {}, campaigns: {}, referrers: {}, products: {} });
const incrementMetrics = (target, event, amount = 0) => {
  target[event] = number(target[event], 100_000_000) + 1;
  if (event === 'order') target.revenue = +(number(target.revenue, 1_000_000_000) + amount).toFixed(2);
};
const addMetrics = (target, values = {}) => {
  for (const metric of METRICS) target[metric] += number(values?.[metric], 100_000_000);
  target.revenue += number(values?.revenue, 1_000_000_000);
  target.revenue = +target.revenue.toFixed(2);
  return target;
};
const metricDifference = (total = {}, attributed = {}) => {
  const result = emptyMetrics();
  for (const metric of METRICS) result[metric] = Math.max(0, number(total?.[metric], 100_000_000) - number(attributed?.[metric], 100_000_000));
  result.revenue = Math.max(0, +(number(total?.revenue, 1_000_000_000) - number(attributed?.revenue, 1_000_000_000)).toFixed(2));
  return result;
};

function allowedOrigin(request) {
  const origin = String(request.headers.get('origin') || '');
  const referer = String(request.headers.get('referer') || '');
  return !origin || /^https?:\/\/(?:www\.)?(?:artwaytm\.pl|allsklep\.pl)(?::\d+)?$/i.test(origin) || /^https?:\/\/(?:www\.)?(?:artwaytm\.pl|allsklep\.pl)(?:[:/]|$)/i.test(referer);
}
function adminRequest(request) {
  if (requestSession(request)?.role === 'admin') return true;
  const supplied = Buffer.from(String(request.headers.get('x-admin-token') || ''));
  const expected = Buffer.from(String(process.env.ARTWAY_ADMIN_TOKEN || ''));
  return !!expected.length && supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}
function rateLimited(request) {
  const forwarded = String(request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const key = forwarded || 'unknown', now = Date.now(), current = requestWindows.get(key);
  if (!current || now - current.startedAt > 60_000) { requestWindows.set(key, { startedAt: now, count: 1 }); return false; }
  current.count += 1;
  if (requestWindows.size > 5000) for (const [entry, state] of requestWindows) if (now - state.startedAt > 120_000) requestWindows.delete(entry);
  return current.count > 90;
}

function emptyState() { return { version: 3, days: {}, updatedAt: null, granularSince: null }; }
function emptyDay() { return { totals: emptyMetrics(), channels: {}, products: {}, domains: {} }; }
function trimRanking(values, max = 150) {
  const entries = Object.entries(values || {});
  if (entries.length <= max) return values;
  return Object.fromEntries(entries.sort((a, b) => number(b[1]) - number(a[1])).slice(0, max));
}
function ensureDimension(value) {
  const target = value && typeof value === 'object' ? value : emptyDimension();
  target.landingPages ||= {}; target.campaigns ||= {}; target.referrers ||= {}; target.products ||= {};
  for (const metric of [...METRICS, 'revenue']) target[metric] = number(target[metric], metric === 'revenue' ? 1_000_000_000 : 100_000_000);
  return target;
}
function incrementAcquisition(target, input) {
  const path = landingPath(input.landingPath), campaignName = campaign(input.campaign), referrer = referrerDomain(input.referrerDomain);
  target.landingPages[path] = number(target.landingPages[path], 100_000_000) + 1;
  if (campaignName) target.campaigns[campaignName] = number(target.campaigns[campaignName], 100_000_000) + 1;
  if (referrer) target.referrers[referrer] = number(target.referrers[referrer], 100_000_000) + 1;
  target.landingPages = trimRanking(target.landingPages); target.campaigns = trimRanking(target.campaigns, 80); target.referrers = trimRanking(target.referrers, 80);
}
function incrementProduct(target, productId, event) {
  if (!productId || !['product_view', 'add_to_cart'].includes(event)) return;
  const product = target.products[productId] || { views: 0, carts: 0, orders: 0, units: 0, revenue: 0 };
  product.views = number(product.views); product.carts = number(product.carts); product.orders = number(product.orders); product.units = number(product.units); product.revenue = number(product.revenue, 1_000_000_000);
  if (event === 'product_view') product.views += 1;
  if (event === 'add_to_cart') product.carts += 1;
  target.products[productId] = product;
}
function normalizedOrderItems(values) {
  return (Array.isArray(values) ? values : []).slice(0, 100).map((item) => ({
    productId: safeKey(item?.productId || item?.id, 100), units: Math.max(1, Math.floor(number(item?.units || item?.quantity, 999))), revenue: number(item?.revenue || item?.value, 100_000),
  })).filter((item) => item.productId);
}
function incrementProductOrder(target, item) {
  const product = target.products[item.productId] || { views: 0, carts: 0, orders: 0, units: 0, revenue: 0 };
  product.views = number(product.views); product.carts = number(product.carts); product.orders = number(product.orders) + 1; product.units = number(product.units) + item.units; product.revenue = +(number(product.revenue, 1_000_000_000) + item.revenue).toFixed(2);
  target.products[item.productId] = product;
}

function incrementState(state, input, now = new Date()) {
  const channel = CHANNELS.has(input.channel) ? input.channel : '';
  const event = EVENTS.has(input.event) ? input.event : '';
  if (!channel || !event) return false;
  const dayKey = isoDay(now), day = state.days[dayKey] || emptyDay(), amount = event === 'order' ? number(input.value, 100_000) : 0;
  day.totals ||= emptyMetrics(); day.channels ||= {}; day.products ||= {}; day.domains ||= {};
  incrementMetrics(day.totals, event, amount);
  const channelData = ensureDimension(day.channels[channel]); incrementMetrics(channelData, event, amount); day.channels[channel] = channelData;
  const entryDomain = domain(input.entryDomain), domainData = ensureDimension(day.domains[entryDomain]); incrementMetrics(domainData, event, amount);
  const domainChannel = ensureDimension(domainData.channels?.[channel]); domainData.channels ||= {}; incrementMetrics(domainChannel, event, amount); domainData.channels[channel] = domainChannel;
  if (event === 'landing') { incrementAcquisition(domainData, input); incrementAcquisition(domainChannel, input); incrementAcquisition(channelData, input); }
  const productId = safeKey(input.productId, 100);
  incrementProduct({ products: day.products }, productId, event); incrementProduct(channelData, productId, event); incrementProduct(domainData, productId, event); incrementProduct(domainChannel, productId, event);
  if (event === 'order') for (const item of normalizedOrderItems(input.items)) {
    incrementProductOrder({ products: day.products }, item); incrementProductOrder(channelData, item); incrementProductOrder(domainData, item); incrementProductOrder(domainChannel, item);
  }
  day.domains[entryDomain] = domainData;
  state.version = 3; state.days[dayKey] = day; state.granularSince ||= now.toISOString();
  const cutoff = new Date(now); cutoff.setUTCDate(cutoff.getUTCDate() - 401);
  for (const key of Object.keys(state.days)) if (key < isoDay(cutoff)) delete state.days[key];
  state.updatedAt = now.toISOString();
  return true;
}

async function record(input) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const version = await repository.readVersioned(KEY, emptyState());
    const state = version.value && typeof version.value === 'object' ? structuredClone(version.value) : emptyState();
    if (!incrementState(state, input)) return { accepted: false };
    const result = await repository.writeIfVersion(KEY, state, version);
    if (result?.modified) return { accepted: true };
  }
  return { accepted: false, retry: true };
}

function shiftDay(day, offset) {
  const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10);
}
function inclusiveDays(from, to) { return Math.round((new Date(`${to}T12:00:00Z`) - new Date(`${from}T12:00:00Z`)) / 86_400_000) + 1; }
function normalizeRange(input = 30, today = new Date()) {
  const options = typeof input === 'object' && input ? input : { days: input };
  const current = isoDay(today), requested = Math.max(1, Math.min(MAX_REPORT_DAYS, Number(options.days) || 30));
  let to = /^\d{4}-\d{2}-\d{2}$/.test(String(options.to || '')) ? String(options.to) : current;
  let from = /^\d{4}-\d{2}-\d{2}$/.test(String(options.from || '')) ? String(options.from) : shiftDay(to, -(requested - 1));
  if (from > to) [from, to] = [to, from];
  const originalDays = inclusiveDays(from, to); if (originalDays > MAX_REPORT_DAYS) from = shiftDay(to, -(MAX_REPORT_DAYS - 1));
  const days = inclusiveDays(from, to);
  return { from, to, days, previousFrom: shiftDay(from, -days), previousTo: shiftDay(from, -1), limited: originalDays > MAX_REPORT_DAYS };
}
function rangeKeys(range) { const result = []; for (let day = range.from; day <= range.to; day = shiftDay(day, 1)) result.push(day); return result; }
function sumDomainMetrics(day, name, channel = '') {
  const source = channel ? day.domains?.[name]?.channels?.[channel] : day.domains?.[name];
  const result = addMetrics(emptyMetrics(), source);
  if (name !== 'artwaytm.pl') return result;
  const total = channel ? day.channels?.[channel] : day.totals;
  const attributed = emptyMetrics();
  for (const domainName of DOMAINS) addMetrics(attributed, channel ? day.domains?.[domainName]?.channels?.[channel] : day.domains?.[domainName]);
  return addMetrics(result, metricDifference(total, attributed));
}
function selectedMetrics(day, filters) {
  if (filters.entryDomain !== 'all') return sumDomainMetrics(day, filters.entryDomain, filters.channel === 'all' ? '' : filters.channel);
  if (filters.channel !== 'all') return addMetrics(emptyMetrics(), day.channels?.[filters.channel]);
  return addMetrics(emptyMetrics(), day.totals);
}
function selectedDimensions(day, filters) {
  if (filters.entryDomain !== 'all' && filters.channel !== 'all') return [ensureDimension(day.domains?.[filters.entryDomain]?.channels?.[filters.channel])];
  if (filters.entryDomain !== 'all') return [ensureDimension(day.domains?.[filters.entryDomain])];
  if (filters.channel !== 'all') return [...DOMAINS].map((name) => ensureDimension(day.domains?.[name]?.channels?.[filters.channel]));
  return [...DOMAINS].map((name) => ensureDimension(day.domains?.[name]));
}
function addRanking(target, source) { for (const [key, count] of Object.entries(source || {})) target[key] = number(target[key], 100_000_000) + number(count, 100_000_000); }
function addProducts(target, source) { for (const [id, values] of Object.entries(source || {})) { const item = target[id] || { views: 0, carts: 0, orders: 0, units: 0, revenue: 0 }; item.views += number(values?.views); item.carts += number(values?.carts); item.orders += number(values?.orders); item.units += number(values?.units); item.revenue = +(item.revenue + number(values?.revenue, 1_000_000_000)).toFixed(2); target[id] = item; } }
function rates(metrics) {
  return {
    productViewRate: metrics.landing ? metrics.product_view * 100 / metrics.landing : 0,
    cartRate: metrics.product_view ? metrics.add_to_cart * 100 / metrics.product_view : 0,
    orderRate: metrics.landing ? metrics.order * 100 / metrics.landing : 0,
    cartToOrderRate: metrics.add_to_cart ? metrics.order * 100 / metrics.add_to_cart : 0,
    averageOrderValue: metrics.order ? metrics.revenue / metrics.order : 0,
  };
}
function normalizedFilters(options = {}) {
  const channel = CHANNELS.has(String(options.channel || '')) ? String(options.channel) : 'all';
  const requestedDomain = String(options.entryDomain || options.domain || 'all').toLowerCase();
  return { channel, entryDomain: DOMAINS.has(requestedDomain) ? requestedDomain : 'all' };
}

function aggregate(state, range, filters) {
  const totals = emptyMetrics(), channels = {}, products = {}, timeline = [], domains = {}, landingPages = {}, campaigns = {}, referrers = {};
  for (const name of DOMAINS) domains[name] = { ...emptyMetrics(), channels: {} };
  for (const key of rangeKeys(range)) {
    const day = state.days?.[key] || emptyDay(), selected = selectedMetrics(day, filters); addMetrics(totals, selected);
    const dayChannels = filters.entryDomain !== 'all' ? day.domains?.[filters.entryDomain]?.channels || {} : day.channels || {};
    for (const [channel, values] of Object.entries(dayChannels)) {
      if (filters.channel !== 'all' && channel !== filters.channel) continue;
      const target = channels[channel] || emptyMetrics(); addMetrics(target, values); channels[channel] = target;
    }
    for (const name of DOMAINS) {
      if (filters.entryDomain !== 'all' && name !== filters.entryDomain) continue;
      const values = sumDomainMetrics(day, name, filters.channel === 'all' ? '' : filters.channel), target = domains[name] || { ...emptyMetrics(), channels: {} };
      addMetrics(target, values); domains[name] = target;
    }
    const dimensions = selectedDimensions(day, filters);
    for (const dimension of dimensions) { addRanking(landingPages, dimension.landingPages); addRanking(campaigns, dimension.campaigns); addRanking(referrers, dimension.referrers); }
    if (filters.entryDomain === 'all' && filters.channel === 'all') addProducts(products, day.products);
    else for (const dimension of dimensions) addProducts(products, dimension.products);
    timeline.push({ day: key, ...selected, ...rates(selected) });
  }
  const ranking = (source, key) => Object.entries(source).map(([name, count]) => ({ [key]: name, count })).filter((entry) => entry[key]).sort((a, b) => b.count - a.count).slice(0, 100);
  const productRanking = Object.entries(products).map(([productId, values]) => ({ productId, ...values, effectiveness: values.views ? values.carts * 100 / values.views : 0, orderRate: values.views ? values.orders * 100 / values.views : 0 })).sort((a, b) => b.orders - a.orders || b.carts - a.carts || b.views - a.views).slice(0, 100);
  return {
    totals: { ...totals, ...rates(totals) }, channels, domains,
    landingPages: ranking(landingPages, 'path'), campaigns: ranking(campaigns, 'campaign'), referrers: ranking(referrers, 'referrerDomain'),
    timeline, products: productRanking,
  };
}
function compare(current, previous) {
  const fields = [...METRICS, 'revenue', 'productViewRate', 'cartRate', 'orderRate', 'cartToOrderRate', 'averageOrderValue'];
  return Object.fromEntries(fields.map((field) => { const now = number(current[field], 1_000_000_000), before = number(previous[field], 1_000_000_000); return [field, { current: now, previous: before, change: before ? (now - before) * 100 / Math.abs(before) : now ? 100 : 0 }]; }));
}

function performance(state, input = 30) {
  const options = typeof input === 'object' && input ? input : { days: input }, range = normalizeRange(options), filters = normalizedFilters(options);
  const current = aggregate(state, range, filters), previousRange = { from: range.previousFrom, to: range.previousTo, days: range.days }, previous = aggregate(state, previousRange, filters);
  return {
    days: range.days, range, filters, ...current, previous: { range: previousRange, totals: previous.totals }, comparison: compare(current.totals, previous.totals),
    options: { channels: [...CHANNELS], domains: [...DOMAINS] }, updatedAt: state.updatedAt || null, granularSince: state.granularSince || null,
    privacy: 'Wyłącznie anonimowe sumy dzienne; bez adresów IP, danych klientów, pełnych adresów odsyłających i tekstów zapytań.',
  };
}

export async function handleSeoAnalytics(request) {
  if (request.method === 'GET') {
    if (!adminRequest(request)) return Response.json({ ok: false, error: 'Brak uprawnień administratora' }, { status: 401 });
    const url = new URL(request.url), state = await repository.read(KEY, emptyState());
    return Response.json({ ok: true, ...performance(state, { days: url.searchParams.get('days'), from: url.searchParams.get('from'), to: url.searchParams.get('to'), entryDomain: url.searchParams.get('domain'), channel: url.searchParams.get('channel') }) }, { headers: { 'cache-control': 'no-store' } });
  }
  if (request.method !== 'POST') return Response.json({ ok: false, error: 'Metoda niedozwolona' }, { status: 405 });
  if (!allowedOrigin(request)) return Response.json({ ok: false, error: 'Niedozwolone źródło' }, { status: 403 });
  if (rateLimited(request)) return Response.json({ ok: false, error: 'Zbyt wiele zdarzeń' }, { status: 429 });
  const body = await request.json().catch(() => ({}));
  const result = await record({ event: String(body.event || ''), channel: String(body.channel || ''), productId: body.productId, value: body.value, items: body.items, entryDomain: body.entryDomain, landingPath: body.landingPath, campaign: body.campaign, referrerDomain: body.referrerDomain });
  return Response.json({ ok: result.accepted }, { status: result.accepted ? 202 : result.retry ? 503 : 400, headers: { 'cache-control': 'no-store' } });
}

export const seoAnalyticsInternals = Object.freeze({ incrementState, performance, normalizeRange });
