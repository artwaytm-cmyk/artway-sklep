import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = Number(process.env.E2E_PORT || 4173);
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
]);
let productsPromise = null;

async function testProducts() {
  if (!productsPromise) productsPromise = readFile(path.join(root, 'products.json'), 'utf8').then(JSON.parse);
  return productsPromise;
}

function normalized(value) {
  return String(value || '').toLocaleLowerCase('pl-PL').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, ' ').trim();
}

function productAvailable(product = {}) {
  return product.dostepny !== false
    && product._catalog?.availability?.saleAvailable !== false
    && product._catalog?.channels?.store?.active !== false;
}

async function catalogApi(url, response) {
  const action = url.searchParams.get('action');
  if (!['product-catalog-query', 'product-catalog-item'].includes(action)) return false;
  const all = await testProducts();
  if (action === 'product-catalog-item') {
    const product = all.find((item) => String(item.id) === String(url.searchParams.get('id') || ''));
    return send(response, product ? 200 : 404, JSON.stringify(product
      ? { ok: true, product: { ...product, _catalog: { ...(product._catalog || {}), detailLevel: 'full' } }, private: false }
      : { ok: false, error: 'Nie znaleziono produktu.', code: 'product_not_found' }), 'application/json; charset=utf-8');
  }
  const available = all.filter(productAvailable), query = normalized(url.searchParams.get('q'));
  const categories = new Set(String(url.searchParams.get('categories') || url.searchParams.get('category') || '').split(',').filter(Boolean));
  const ids = new Set(String(url.searchParams.get('ids') || '').split(',').filter(Boolean));
  const parseOptionalNumber = value => {
    const normalized = String(value ?? '').trim().replace(',', '.');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const priceMin = parseOptionalNumber(url.searchParams.get('priceMin'));
  const priceMax = parseOptionalNumber(url.searchParams.get('priceMax'));
  let items = available.filter((product) => {
    const haystack = normalized([product.id, product.nazwa, product.kategoria, product.producent, product.sku, product.externalId, product.gtin, product.ean].join(' '));
    return (!query || query.split(' ').every((part) => haystack.includes(part)))
      && (!categories.size || categories.has(String(product.kategoria || '')))
      && (!ids.size || ids.has(String(product.id)))
      && (!url.searchParams.get('promotion') || Number(product.staraCena) > Number(product.cena))
      && (!url.searchParams.get('special') || normalized(product.badge) === 'nowosc')
      && (priceMin === null || Number(product.cena) >= priceMin)
      && (priceMax === null || Number(product.cena) <= priceMax);
  });
  const sort = url.searchParams.get('sort') || 'external';
  items.sort((a, b) => sort === 'cena-rosnaco' ? Number(a.cena) - Number(b.cena)
    : sort === 'cena-malejaco' ? Number(b.cena) - Number(a.cena)
      : sort === 'nazwa' ? String(a.nazwa).localeCompare(String(b.nazwa), 'pl')
        : String(a.externalId || a.sku || a.id).localeCompare(String(b.externalId || b.sku || b.id), 'pl', { numeric: true }));
  const total = items.length, page = Math.max(1, Number(url.searchParams.get('page')) || 1), limit = Math.max(1, Math.min(1000, Number(url.searchParams.get('limit')) || 50));
  items = items.slice((page - 1) * limit, page * limit).map((product) => ({ ...product, _catalog: { ...(product._catalog || {}), detailLevel: 'list' } }));
  const facet = (field) => [...available.reduce((map, product) => map.set(String(product[field] || ''), (map.get(String(product[field] || '')) || 0) + 1), new Map())]
    .filter(([value]) => value).map(([value, count]) => ({ value, count }));
  return send(response, 200, JSON.stringify({
    ok: true, available: true, private: false, items, total, page, limit, nextCursor: null, pagination: 'offset', revision: 'e2e-products',
    summary: { total: available.length, active: available.length, ready: available.length, promotions: available.filter((p) => Number(p.staraCena) > Number(p.cena)).length, new_products: available.filter((p) => normalized(p.badge) === 'nowosc').length },
    facets: { categories: facet('kategoria'), producers: facet('producent') },
  }), 'application/json; charset=utf-8');
}

function send(response, status, body, contentType) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': contentType,
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
  return true;
}

async function regularFile(candidate) {
  try {
    const details = await stat(candidate);
    return details.isFile() ? candidate : details.isDirectory() ? path.join(candidate, 'index.html') : null;
  } catch {
    return null;
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${host}:${port}`);
  if (url.pathname === '/healthz') return send(response, 200, '{"ok":true}', 'application/json; charset=utf-8');
  if (url.pathname.startsWith('/api/')) {
    if (await catalogApi(url, response)) return;
    return send(response, 503, '{"ok":false,"error":"E2E działa bez produkcyjnych integracji"}', 'application/json; charset=utf-8');
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return send(response, 400, 'Nieprawidłowy adres.', 'text/plain; charset=utf-8');
  }
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = path.resolve(root, relative);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    return send(response, 403, 'Brak dostępu.', 'text/plain; charset=utf-8');
  }

  let file = await regularFile(candidate);
  if (!file && !path.extname(relative)) file = path.join(root, 'index.html');
  if (!file) return send(response, 404, 'Nie znaleziono.', 'text/plain; charset=utf-8');

  try {
    const body = await readFile(file);
    return send(response, 200, body, mimeTypes.get(path.extname(file).toLowerCase()) || 'application/octet-stream');
  } catch {
    return send(response, 404, 'Nie znaleziono.', 'text/plain; charset=utf-8');
  }
});

server.listen(port, host, () => process.stdout.write(`E2E server: http://${host}:${port}\n`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
