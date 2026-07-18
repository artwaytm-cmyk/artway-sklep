import { createStoreRepository } from '../core/store-repository.mjs';
import crypto from 'node:crypto';
import { requestSession } from '../core/security.mjs';

const repository = createStoreRepository({ name: 'artway-sklep' });
const KEY = 'seo_performance';
const CHANNELS = new Set(['google', 'bing', 'duckduckgo', 'yahoo', 'ecosia', 'other_search']);
const EVENTS = new Set(['landing', 'product_view', 'add_to_cart', 'order']);
const requestWindows = new Map();

const isoDay = (value = new Date()) => new Date(value).toISOString().slice(0, 10);
const number = (value, max = 1_000_000) => Math.max(0, Math.min(max, Number(value) || 0));
const text = (value, max = 120) => String(value ?? '').replace(/[^a-zA-Z0-9_.:/-]/g, '').slice(0, max);

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

function emptyState() { return { version: 1, days: {}, updatedAt: null }; }
function emptyDay() { return { totals: { landing: 0, product_view: 0, add_to_cart: 0, order: 0, revenue: 0 }, channels: {}, products: {} }; }

function incrementState(state, input, now = new Date()) {
  const channel = CHANNELS.has(input.channel) ? input.channel : '';
  const event = EVENTS.has(input.event) ? input.event : '';
  if (!channel || !event) return false;
  const dayKey = isoDay(now), day = state.days[dayKey] || emptyDay(), amount = event === 'order' ? number(input.value, 100_000) : 0;
  day.totals[event] = number(day.totals[event], 100_000_000) + 1;
  if (event === 'order') day.totals.revenue = +(number(day.totals.revenue, 1_000_000_000) + amount).toFixed(2);
  const channelData = day.channels[channel] || { landing: 0, product_view: 0, add_to_cart: 0, order: 0, revenue: 0 };
  channelData[event] = number(channelData[event], 100_000_000) + 1;
  if (event === 'order') channelData.revenue = +(number(channelData.revenue, 1_000_000_000) + amount).toFixed(2);
  day.channels[channel] = channelData;
  const productId = text(input.productId, 100);
  if (productId && ['product_view', 'add_to_cart'].includes(event)) {
    const product = day.products[productId] || { views: 0, carts: 0 };
    if (event === 'product_view') product.views += 1;
    if (event === 'add_to_cart') product.carts += 1;
    day.products[productId] = product;
  }
  state.days[dayKey] = day;
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
  const totals = { landing: 0, product_view: 0, add_to_cart: 0, order: 0, revenue: 0 }, channels = {}, products = {}, timeline = [];
  for (const key of keys) {
    const day = state.days?.[key] || emptyDay();
    for (const metric of ['landing', 'product_view', 'add_to_cart', 'order']) totals[metric] += number(day.totals?.[metric]);
    totals.revenue += number(day.totals?.revenue, 1_000_000_000);
    for (const [channel, values] of Object.entries(day.channels || {})) {
      const target = channels[channel] || { landing: 0, product_view: 0, add_to_cart: 0, order: 0, revenue: 0 };
      for (const metric of ['landing', 'product_view', 'add_to_cart', 'order']) target[metric] += number(values?.[metric]);
      target.revenue += number(values?.revenue, 1_000_000_000); channels[channel] = target;
    }
    for (const [id, values] of Object.entries(day.products || {})) { const target = products[id] || { views: 0, carts: 0 }; target.views += number(values?.views); target.carts += number(values?.carts); products[id] = target; }
    timeline.push({ day: key, landing: number(day.totals?.landing), carts: number(day.totals?.add_to_cart), orders: number(day.totals?.order) });
  }
  totals.revenue = +totals.revenue.toFixed(2);
  const productRanking = Object.entries(products).map(([productId, values]) => ({ productId, ...values })).sort((a, b) => b.carts - a.carts || b.views - a.views).slice(0, 20);
  return { days, totals, channels, timeline, products: productRanking, updatedAt: state.updatedAt || null, privacy: 'Wyłącznie anonimowe sumy dzienne; bez adresów IP, danych klientów i tekstów zapytań.' };
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
  const result = await record({ event: String(body.event || ''), channel: String(body.channel || ''), productId: body.productId, value: body.value });
  return Response.json({ ok: result.accepted }, { status: result.accepted ? 202 : result.retry ? 503 : 400, headers: { 'cache-control': 'no-store' } });
}

export const seoAnalyticsInternals = Object.freeze({ incrementState, performance });
