import { createStoreRepository } from '../core/store-repository.mjs';
import crypto from 'node:crypto';
import { requestSession } from '../core/security.mjs';

const repository = createStoreRepository({ name: 'artway-sklep' });
const KEY = 'seo_performance';
const CHANNELS = new Set(['google', 'bing', 'duckduckgo', 'yahoo', 'ecosia', 'other_search', 'direct', 'referral', 'campaign']);
const EVENTS = new Set(['landing', 'product_view', 'add_to_cart', 'order']);
const DOMAINS = new Set(['artwaytm.pl', 'allsklep.pl']);
const METRICS = ['landing', 'product_view', 'add_to_cart', 'order'];
const requestWindows = new Map();

const isoDay = (value = new Date()) => new Date(value).toISOString().slice(0, 10);
const number = (value, max = 1_000_000) => Math.max(0, Math.min(max, Number(value) || 0));
const text = (value, max = 120) => String(value ?? '').replace(/[^a-zA-Z0-9_.:/-]/g, '').slice(0, max);
const domain = (value) => {
  const normalized = String(value || '').toLowerCase().replace(/^www\./, '').split(':')[0];
  return DOMAINS.has(normalized) ? normalized : 'artwaytm.pl';
};
const landingPath = (value) => {
  const clean = String(value || '/').split(/[?#]/)[0].replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180);
  return clean.startsWith('/') ? clean : '/';
};
const referrerDomain = (value) => String(value || '').toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9.-]/g, '').slice(0, 120);
const campaign = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 80);
const emptyMetrics = () => ({ landing: 0, product_view: 0, add_to_cart: 0, order: 0, revenue: 0 });
const incrementMetrics = (target, event, amount = 0) => {
  target[event] = number(target[event], 100_000_000) + 1;
  if (event === 'order') target.revenue = +(number(target.revenue, 1_000_000_000) + amount).toFixed(2);
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

function emptyState() { return { version: 2, days: {}, updatedAt: null }; }
function emptyDay() { return { totals: emptyMetrics(), channels: {}, products: {}, domains: {} }; }

function trimRanking(values, max = 150) {
  const entries = Object.entries(values || {});
  if (entries.length <= max) return values;
  return Object.fromEntries(entries.sort((a, b) => number(b[1]) - number(a[1])).slice(0, max));
}

function incrementState(state, input, now = new Date()) {
  const channel = CHANNELS.has(input.channel) ? input.channel : '';
  const event = EVENTS.has(input.event) ? input.event : '';
  if (!channel || !event) return false;
  const dayKey = isoDay(now), day = state.days[dayKey] || emptyDay(), amount = event === 'order' ? number(input.value, 100_000) : 0;
  day.totals ||= emptyMetrics(); day.channels ||= {}; day.products ||= {}; day.domains ||= {};
  incrementMetrics(day.totals, event, amount);
  const channelData = day.channels[channel] || emptyMetrics();
  incrementMetrics(channelData, event, amount);
  day.channels[channel] = channelData;
  const entryDomain = domain(input.entryDomain), domainData = day.domains[entryDomain] || { ...emptyMetrics(), channels: {}, landingPages: {}, campaigns: {}, referrers: {} };
  incrementMetrics(domainData, event, amount);
  const domainChannel = domainData.channels[channel] || emptyMetrics();
  incrementMetrics(domainChannel, event, amount); domainData.channels[channel] = domainChannel;
  if (event === 'landing') {
    const path = landingPath(input.landingPath), campaignName = campaign(input.campaign), referrer = referrerDomain(input.referrerDomain);
    domainData.landingPages[path] = number(domainData.landingPages[path], 100_000_000) + 1;
    if (campaignName) domainData.campaigns[campaignName] = number(domainData.campaigns[campaignName], 100_000_000) + 1;
    if (referrer) domainData.referrers[referrer] = number(domainData.referrers[referrer], 100_000_000) + 1;
    domainData.landingPages = trimRanking(domainData.landingPages);
    domainData.campaigns = trimRanking(domainData.campaigns, 80);
    domainData.referrers = trimRanking(domainData.referrers, 80);
  }
  day.domains[entryDomain] = domainData;
  const productId = text(input.productId, 100);
  if (productId && ['product_view', 'add_to_cart'].includes(event)) {
    const product = day.products[productId] || { views: 0, carts: 0 };
    if (event === 'product_view') product.views += 1;
    if (event === 'add_to_cart') product.carts += 1;
    day.products[productId] = product;
  }
  state.version = 2; state.days[dayKey] = day;
  const cutoff = new Date(now); cutoff.setUTCDate(cutoff.getUTCDate() - 400);
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

function performance(state, requestedDays = 30) {
  const days = Math.max(7, Math.min(365, Number(requestedDays) || 30)), today = new Date(), keys = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) { const date = new Date(today); date.setUTCDate(date.getUTCDate() - offset); keys.push(isoDay(date)); }
  const totals = emptyMetrics(), channels = {}, products = {}, timeline = [], domains = {}, landingPages = {}, campaigns = {}, referrers = {};
  for (const name of DOMAINS) domains[name] = { ...emptyMetrics(), channels: {} };
  for (const key of keys) {
    const day = state.days?.[key] || emptyDay();
    for (const metric of METRICS) totals[metric] += number(day.totals?.[metric]);
    totals.revenue += number(day.totals?.revenue, 1_000_000_000);
    for (const [channel, values] of Object.entries(day.channels || {})) {
      const target = channels[channel] || emptyMetrics();
      for (const metric of METRICS) target[metric] += number(values?.[metric]);
      target.revenue += number(values?.revenue, 1_000_000_000); channels[channel] = target;
    }
    const timelineDomains = {};
    for (const [name, values] of Object.entries(day.domains || {})) {
      const normalized = domain(name), target = domains[normalized] || { ...emptyMetrics(), channels: {} };
      for (const metric of METRICS) target[metric] += number(values?.[metric]);
      target.revenue += number(values?.revenue, 1_000_000_000);
      for (const [channel, channelValues] of Object.entries(values?.channels || {})) {
        const channelTarget = target.channels[channel] || emptyMetrics();
        for (const metric of METRICS) channelTarget[metric] += number(channelValues?.[metric]);
        channelTarget.revenue += number(channelValues?.revenue, 1_000_000_000); target.channels[channel] = channelTarget;
      }
      for (const [path, count] of Object.entries(values?.landingPages || {})) landingPages[`${normalized}|${landingPath(path)}`] = number(landingPages[`${normalized}|${landingPath(path)}`], 100_000_000) + number(count);
      for (const [nameValue, count] of Object.entries(values?.campaigns || {})) campaigns[`${normalized}|${campaign(nameValue)}`] = number(campaigns[`${normalized}|${campaign(nameValue)}`], 100_000_000) + number(count);
      for (const [host, count] of Object.entries(values?.referrers || {})) referrers[`${normalized}|${referrerDomain(host)}`] = number(referrers[`${normalized}|${referrerDomain(host)}`], 100_000_000) + number(count);
      target.revenue = +target.revenue.toFixed(2); domains[normalized] = target;
      timelineDomains[normalized] = { landing: number(values?.landing), carts: number(values?.add_to_cart), orders: number(values?.order) };
    }
    // Dane sprzed wdrożenia podziału domenowego pochodziły wyłącznie z domeny głównej.
    const primary = domains['artwaytm.pl'];
    for (const metric of METRICS) {
      const attributed = [...DOMAINS].reduce((sum, name) => sum + number(day.domains?.[name]?.[metric]), 0);
      primary[metric] += Math.max(0, number(day.totals?.[metric]) - attributed);
    }
    const attributedRevenue = [...DOMAINS].reduce((sum, name) => sum + number(day.domains?.[name]?.revenue, 1_000_000_000), 0);
    primary.revenue = +(primary.revenue + Math.max(0, number(day.totals?.revenue, 1_000_000_000) - attributedRevenue)).toFixed(2);
    for (const [id, values] of Object.entries(day.products || {})) { const target = products[id] || { views: 0, carts: 0 }; target.views += number(values?.views); target.carts += number(values?.carts); products[id] = target; }
    timeline.push({ day: key, landing: number(day.totals?.landing), carts: number(day.totals?.add_to_cart), orders: number(day.totals?.order), domains: timelineDomains });
  }
  totals.revenue = +totals.revenue.toFixed(2);
  const productRanking = Object.entries(products).map(([productId, values]) => ({ productId, ...values })).sort((a, b) => b.carts - a.carts || b.views - a.views).slice(0, 20);
  const ranking = (source, key) => Object.entries(source).map(([compound, count]) => { const [entryDomain, ...rest] = compound.split('|'); return { entryDomain, [key]: rest.join('|'), count }; }).filter((entry) => entry[key]).sort((a, b) => b.count - a.count).slice(0, 20);
  return { days, totals, channels, domains, landingPages: ranking(landingPages, 'path'), campaigns: ranking(campaigns, 'campaign'), referrers: ranking(referrers, 'referrerDomain'), timeline, products: productRanking, updatedAt: state.updatedAt || null, privacy: 'Wyłącznie anonimowe sumy dzienne; bez adresów IP, danych klientów, pełnych adresów odsyłających i tekstów zapytań.' };
}

export async function handleSeoAnalytics(request) {
  if (request.method === 'GET') {
    if (!adminRequest(request)) return Response.json({ ok: false, error: 'Brak uprawnień administratora' }, { status: 401 });
    const url = new URL(request.url), state = await repository.read(KEY, emptyState());
    return Response.json({ ok: true, ...performance(state, url.searchParams.get('days')) }, { headers: { 'cache-control': 'no-store' } });
  }
  if (request.method !== 'POST') return Response.json({ ok: false, error: 'Metoda niedozwolona' }, { status: 405 });
  if (!allowedOrigin(request)) return Response.json({ ok: false, error: 'Niedozwolone źródło' }, { status: 403 });
  if (rateLimited(request)) return Response.json({ ok: false, error: 'Zbyt wiele zdarzeń' }, { status: 429 });
  const body = await request.json().catch(() => ({}));
  const result = await record({ event: String(body.event || ''), channel: String(body.channel || ''), productId: body.productId, value: body.value, entryDomain: body.entryDomain, landingPath: body.landingPath, campaign: body.campaign, referrerDomain: body.referrerDomain });
  return Response.json({ ok: result.accepted }, { status: result.accepted ? 202 : result.retry ? 503 : 400, headers: { 'cache-control': 'no-store' } });
}

export const seoAnalyticsInternals = Object.freeze({ incrementState, performance });
