const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value, max = 1000) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const numberOrNull = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};
const normalize = (value) => text(value, 5000).toLocaleLowerCase('pl-PL').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, ' ').trim();

export function encodeCatalogCursor(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeCatalogCursor(value) {
  try {
    return asObject(JSON.parse(Buffer.from(text(value, 2048), 'base64url').toString('utf8')));
  } catch {
    return {};
  }
}

export function centralCatalogQueryOptions(raw = {}) {
  const allowedSort = new Set(['external', 'id', 'nazwa', 'producent', 'kategoria', 'cena-rosnaco', 'cena-malejaco', 'stan', 'braki-danych', 'najnowsze', 'ocena']);
  const list = (value, max = 1000) => [...new Set((Array.isArray(value) ? value : String(value || '').split(',')).map((item) => text(item, 300)).filter(Boolean))].slice(0, max);
  return {
    query: normalize(raw.query || raw.q), category: text(raw.category, 300), producer: text(raw.producer, 300), status: text(raw.status || 'active', 40), source: text(raw.source || 'wszystkie', 40), stock: text(raw.stock || 'wszystkie', 40), allegro: text(raw.allegro || 'wszystkie', 40), data: text(raw.data || 'wszystkie', 40), sale: text(raw.sale || 'wszystkie', 40), promotion: text(raw.promotion || 'wszystkie', 40), link: text(raw.link || 'wszystkie', 40),
    categories: list(raw.categories, 200), ids: list(raw.ids, 1000), special: text(raw.special, 40), minRating: numberOrNull(raw.minRating),
    priceMin: numberOrNull(raw.priceMin), priceMax: numberOrNull(raw.priceMax), allegroPriceMin: numberOrNull(raw.allegroPriceMin), allegroPriceMax: numberOrNull(raw.allegroPriceMax),
    sort: allowedSort.has(String(raw.sort)) ? String(raw.sort) : 'external', page: Math.max(1, Number(raw.page) || 1), limit: Math.max(1, Math.min(1000, Number(raw.limit) || 50)), cursor: text(raw.cursor, 2048), admin: raw.admin === true,
  };
}
