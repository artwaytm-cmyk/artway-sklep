import { mergeCatalogProducts } from './catalog-quality.mjs';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const INDEXNOW_HOST = 'artwaytm.pl';
const INDEXNOW_ORIGIN = `https://${INDEXNOW_HOST}`;

// Klucz IndexNow jest publiczny z założenia protokołu i musi być dostępny także jako plik w katalogu głównym domeny.
export const INDEXNOW_KEY = '76eefb8a8d3d827b1aeb9dd2aa35d064';
export const INDEXNOW_KEY_LOCATION = `${INDEXNOW_ORIGIN}/${INDEXNOW_KEY}.txt`;

export function normalizeIndexNowUrls(urls = []) {
  const normalized = [];
  const seen = new Set();
  for (const value of Array.isArray(urls) ? urls : []) {
    try {
      const url = new URL(String(value || '').trim(), `${INDEXNOW_ORIGIN}/`);
      if (url.protocol !== 'https:' || url.hostname !== INDEXNOW_HOST) continue;
      url.hash = '';
      const href = url.href;
      if (!seen.has(href)) { seen.add(href); normalized.push(href); }
      if (normalized.length >= 10000) break;
    } catch (error) { /* błędny lub obcy adres nie trafia do zgłoszenia */ }
  }
  return normalized;
}

function productIsUnavailable(product = {}, availability = {}) {
  const record = availability?.[String(product?.id)] || availability?.[product?.id] || null;
  if (!record) return false;
  const decision = String(record.decision || record.decyzja || '').toLowerCase();
  if (decision === 'manual_available') return false;
  if (decision === 'grace') {
    const expires = Date.parse(record.expiresAt || record.waznaDo || '');
    return Number.isFinite(expires) && expires <= Date.now();
  }
  return String(record.status || '').toLowerCase() === 'niedostepny';
}

export function eligiblePromotionProducts(data = {}) {
  const availability = data.artway_dostepnosc && typeof data.artway_dostepnosc === 'object' ? data.artway_dostepnosc : {};
  return mergeCatalogProducts(data).activeProducts.filter((product) => Number(product.cena) > 0 && !productIsUnavailable(product, availability));
}

export async function submitIndexNow(urls = [], { fetchImpl = globalThis.fetch } = {}) {
  const urlList = normalizeIndexNowUrls(urls);
  if (!urlList.length) return { submitted: false, accepted: false, status: 'skipped', count: 0, httpStatus: null };
  if (typeof fetchImpl !== 'function') throw new Error('Brak obsługi połączenia z IndexNow.');
  const response = await fetchImpl(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: INDEXNOW_HOST, key: INDEXNOW_KEY, keyLocation: INDEXNOW_KEY_LOCATION, urlList }),
  });
  const accepted = response.status === 200 || response.status === 202;
  if (!accepted) throw new Error(`IndexNow odrzucił zgłoszenie (HTTP ${response.status}).`);
  return { submitted: true, accepted: true, status: 'accepted', count: urlList.length, httpStatus: response.status };
}

export async function runIndexNowPromotion({ catalogProducts = [], changedProducts = [], config = {}, fetchImpl = globalThis.fetch } = {}) {
  const fullCatalogSubmission = !config.indexNowFullCatalogAt;
  const scope = fullCatalogSubmission ? 'full-catalog' : 'changed-products';
  if (config.indexNowEnabled === false) return { submitted: false, accepted: false, status: 'disabled', count: 0, httpStatus: null, scope };
  if (!fullCatalogSubmission && !changedProducts.length) return { submitted: false, accepted: false, status: 'skipped', count: 0, httpStatus: null, scope };
  try {
    const products = fullCatalogSubmission ? catalogProducts : changedProducts;
    return { ...await submitIndexNow(['https://artwaytm.pl/', ...products.map((product) => `https://artwaytm.pl/produkt/${encodeURIComponent(product.id)}`)], { fetchImpl }), scope };
  } catch (error) {
    return { submitted: true, accepted: false, status: 'error', count: 0, httpStatus: null, scope, error: String(error?.message || error).slice(0, 300) };
  }
}
