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

function send(response, status, body, contentType) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': contentType,
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
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
