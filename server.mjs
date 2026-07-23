import http from 'node:http';
import { pathToFileURL } from 'node:url';
import storeHandler from './src/backend/store.mjs';
import telegramWebhookHandler from './src/backend/telegram-webhook.mjs';
import sitemapHandler from './src/backend/sitemap.mjs';
import googleProductsHandler from './src/backend/google-products.mjs';
import { renderStorefrontSeoPage, seoRouteMatches } from './src/backend/lib/domain/storefront-seo-renderer.mjs';
import { handleSeoAnalytics } from './src/backend/lib/domain/seo-analytics.mjs';
import { createResilientServerRuntime } from './src/backend/server-runtime.mjs';

const MAX_BODY_BYTES = 5 * 1024 * 1024;

async function requestBody(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Żądanie jest zbyt duże.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function fetchRequestFromNode(request) {
  const origin = String(process.env.ARTWAY_PUBLIC_ORIGIN || 'https://artwaytm.pl').replace(/\/$/, '');
  return new Request(`${origin}${request.url || '/'}`, {
    method: request.method,
    headers: request.headers,
    body: await requestBody(request),
  });
}

async function sendFetchResponse(response, nodeResponse) {
  const headers = {};
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') headers[key] = value;
  });
  const setCookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  if (setCookies.length) headers['set-cookie'] = setCookies;
  nodeResponse.writeHead(response.status, headers);
  if (response.body === null) return nodeResponse.end();
  nodeResponse.end(Buffer.from(await response.arrayBuffer()));
}

function routeHandler(pathname) {
  if (pathname === '/api/store' || pathname === '/.netlify/functions/store') return storeHandler;
  if (pathname === '/api/telegram/webhook' || pathname === '/.netlify/functions/telegram-webhook') return telegramWebhookHandler;
  if (pathname === '/sitemap.xml') return sitemapHandler;
  if (pathname === '/google-products.xml') return googleProductsHandler;
  if (pathname === '/api/seo/performance' || pathname === '/api/seo/event') return handleSeoAnalytics;
  if (seoRouteMatches(pathname)) return renderStorefrontSeoPage;
  return null;
}

export function createArtwayServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://localhost');
      if (url.pathname === '/healthz') {
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        return response.end(JSON.stringify({ ok: true, service: 'artway-vps' }));
      }
      const handler = routeHandler(url.pathname);
      if (!handler) {
        response.writeHead(404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        return response.end(JSON.stringify({ ok: false, error: 'Nie znaleziono endpointu.' }));
      }
      await sendFetchResponse(await handler(await fetchRequestFromNode(request), {}), response);
    } catch (error) {
      const status = Number(error?.status) || 500;
      response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ ok: false, error: status === 500 ? 'Błąd serwera.' : String(error?.message || error) }));
    }
  });
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Math.max(1, Math.min(65_535, Number(process.env.PORT || 3000) || 3000));
  const server = createArtwayServer();
  server.requestTimeout = 125_000;
  server.headersTimeout = 130_000;
  server.keepAliveTimeout = 65_000;
  createResilientServerRuntime({ server, host, port }).start();
}
