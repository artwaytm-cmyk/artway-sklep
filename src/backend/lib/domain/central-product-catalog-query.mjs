const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value, max = 1000) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const numberOrNull = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};
const normalize = (value) => text(value, 5000).toLocaleLowerCase('pl-PL').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, ' ').trim();

export const CENTRAL_IMPORTED_PRODUCT_MATCH_SQL = `
  WITH candidates AS (
    SELECT x.data,'import_item_key'::text reason,1 priority,p.updated_at
    FROM artway_product_payloads x
    JOIN artway_products p USING(namespace,product_id)
    WHERE p.namespace=$1 AND p.record_status<>'removed'
      AND $2<>'' AND x.data->>'importItemKey'=$2
    UNION ALL
    SELECT x.data,'source_url',2,p.updated_at
    FROM artway_product_payloads x
    JOIN artway_products p USING(namespace,product_id)
    WHERE p.namespace=$1 AND p.record_status<>'removed'
      AND $3<>'' AND (
        x.data->>'sourceUrl'=$3 OR x.data->>'producentUrl'=$3
      )
    UNION ALL
    SELECT x.data,'gtin',3,p.updated_at
    FROM artway_products p
    JOIN artway_product_payloads x USING(namespace,product_id)
    WHERE p.namespace=$1 AND p.record_status<>'removed'
      AND $4<>'' AND p.ean=$4
    UNION ALL
    SELECT x.data,'external_id',4,p.updated_at
    FROM artway_products p
    JOIN artway_product_payloads x USING(namespace,product_id)
    WHERE p.namespace=$1 AND p.record_status<>'removed'
      AND $5<>'' AND (p.external_id=$5 OR p.sku=$5)
    UNION ALL
    SELECT x.data,'manufacturer_code',5,p.updated_at
    FROM artway_product_payloads x
    JOIN artway_products p USING(namespace,product_id)
    WHERE p.namespace=$1 AND p.record_status<>'removed'
      AND $6<>'' AND $7<>''
      AND regexp_replace(lower(p.producer),'[^a-z0-9]+','','g')=$6
      AND regexp_replace(lower(COALESCE(
        x.data->>'kodProducenta',x.data->>'mpn',''
      )),'[^a-z0-9]+','','g')=$7
  )
  SELECT data,reason
  FROM candidates
  ORDER BY priority,updated_at DESC
  LIMIT 1
`;

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
