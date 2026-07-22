import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const securityPath = 'ops/nginx/artway-security-headers.conf';

test('Nginx ma jeden kompletny zestaw nagłówków bezpieczeństwa', async () => {
  const source = await readFile(securityPath, 'utf8');
  for (const header of [
    'Strict-Transport-Security',
    'Content-Security-Policy',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'X-Frame-Options',
    'Permissions-Policy',
    'Cross-Origin-Opener-Policy',
    'Origin-Agent-Cluster',
    'X-Permitted-Cross-Domain-Policies',
  ]) {
    assert.match(source, new RegExp(`add_header\\s+${header}\\s+`), `brakuje ${header}`);
  }
  assert.match(source, /Strict-Transport-Security\s+"max-age=31536000"\s+always;/);
  assert.match(source, /X-XSS-Protection\s+"0"\s+always;/);
  assert.equal((source.match(/\balways;/g) || []).length, 10, 'każdy nagłówek musi działać także dla odpowiedzi błędów');
  for (const header of ['X-Content-Type-Options', 'Referrer-Policy', 'Content-Security-Policy', 'Strict-Transport-Security']) {
    assert.match(source, new RegExp(`proxy_hide_header\\s+${header};`), `proxy nie może dublować ${header}`);
  }
});

test('CSP blokuje nieznany kod, ramki i obiekty bez wyłączania InPost oraz skanera', async () => {
  const source = await readFile(securityPath, 'utf8');
  assert.match(source, /default-src 'self'/);
  assert.match(source, /base-uri 'self'/);
  assert.match(source, /object-src 'none'/);
  assert.match(source, /frame-ancestors 'self'/);
  assert.match(source, /script-src 'self' https:\/\/geowidget\.inpost\.pl/);
  assert.match(source, /script-src-elem 'self' https:\/\/geowidget\.inpost\.pl/);
  assert.match(source, /style-src 'self' https:\/\/geowidget\.inpost\.pl/);
  assert.match(source, /style-src-elem 'self' https:\/\/geowidget\.inpost\.pl/);
  assert.doesNotMatch(source, /(?:script|style)-src 'self'[^;]*'unsafe-inline'/);
  assert.match(source, /script-src-attr 'unsafe-inline'/);
  assert.match(source, /style-src-attr 'unsafe-inline'/);
  assert.doesNotMatch(source, /script-src[^;]*'unsafe-eval'/);
  assert.match(source, /frame-src 'self' https:\/\/geowidget-app\.inpost\.pl/);
  assert.match(source, /connect-src 'self' https:\/\/wl-api\.mf\.gov\.pl/);
  assert.match(source, /worker-src 'self' blob:/);
  assert.match(source, /upgrade-insecure-requests/);
});

test('index nie zawiera wykonywalnego kodu inline wymagającego unsafe-inline', async () => {
  const html = await readFile('index.html', 'utf8');
  const inlineScripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attributes]) => !/\bsrc\s*=/i.test(attributes));
  assert.ok(inlineScripts.length >= 2, 'oczekiwano bloków danych SEO i ustawień');
  for (const [, attributes] of inlineScripts) {
    assert.match(attributes, /\btype\s*=\s*["']application\/(?:ld\+json|json)["']/i);
  }
  assert.match(html, /id="artway-public-settings"\s+type="application\/json">\{\}<\/script>/);
  assert.doesNotMatch(html, /const\s+USTAWIENIA_PUBLICZNE\s*=/);
});

test('zapasowa konfiguracja Netlify zachowuje ten sam rygor skryptów i stylów', async () => {
  const source = await readFile('netlify.toml', 'utf8');
  assert.match(source, /script-src 'self' https:\/\/geowidget\.inpost\.pl/);
  assert.match(source, /script-src-elem 'self' https:\/\/geowidget\.inpost\.pl/);
  assert.match(source, /style-src 'self' https:\/\/geowidget\.inpost\.pl/);
  assert.match(source, /style-src-elem 'self' https:\/\/geowidget\.inpost\.pl/);
  assert.doesNotMatch(source, /(?:script|style)-src 'self'[^;\"]*'unsafe-inline'/);
});

test('lokacje z własnym Cache-Control ponownie dołączają zabezpieczenia', async () => {
  const [health, seo] = await Promise.all([
    readFile('ops/nginx/artway-health.conf', 'utf8'),
    readFile('ops/nginx/artway-seo-pages.conf', 'utf8'),
  ]);
  for (const [name, source] of [['healthz', health], ['SEO API', seo]]) {
    assert.match(source, /include \/srv\/artway\/shop\/ops\/nginx\/artway-security-headers\.conf;/, `${name} traci nagłówki przez własny add_header`);
  }
});
