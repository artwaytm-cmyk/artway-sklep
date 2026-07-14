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
