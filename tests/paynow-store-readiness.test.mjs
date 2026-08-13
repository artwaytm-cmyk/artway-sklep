import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('publiczne dane sprzedawcy są kompletne i zgodne z rejestrem', async () => {
  const config = await read('src/frontend/01-config-and-catalog.js');
  assert.match(config, /ARTWAY-TM SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ/);
  assert.match(config, /nip:\s*"5882468333"/);
  assert.match(config, /regon:\s*"388782967"/);
  assert.match(config, /kodPocztowy:\s*"84-207"/);
  assert.match(config, /miasto:\s*"Bojano"/);
});

test('checkout jednoznacznie tworzy obowiązek zapłaty i ukrywa nieskonfigurowane Paynow', async () => {
  const checkout = await read('src/frontend/17a-checkout-and-delivery.js');
  assert.match(checkout, /Zamówienie z obowiązkiem zapłaty/);
  assert.match(checkout, /name="regulaminAkceptacja" required/);
  assert.match(checkout, /Do zapłaty \(PLN\)/);
  assert.match(checkout, /p\.id!=="paynow"\|\|czyPaynowDostepnyPublicznie\(\)/);
});

test('regulamin i polityki zawierają pełną listę wymaganą przez Paynow', async () => {
  const content = await read('src/frontend/06d-storefront-content.js');
  for (const phrase of [
    'Podmiotem świadczącym obsługę płatności online',
    'mElements S.A.',
    'Autopay S.A.',
    'Visa Electron',
    'złotych polskich (<b>PLN</b>)',
    'w ciągu dwóch lat',
    'w ciągu 14 dni',
    'wyłącznie na terytorium Polski',
    'Wzór oświadczenia o odstąpieniu',
    'Cookies to niewielkie informacje',
  ]) assert.ok(content.includes(phrase), `brak wymaganej treści: ${phrase}`);
});

test('weryfikator bez JavaScriptu dostaje kompletne, samodzielne podstrony prawne', async () => {
  const required = {
    'kontakt/index.html': ['ARTWAY-TM SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', 'NIP: 5882468333', 'REGON: 388782967', 'artwaytm@gmail.com'],
    'regulamin/index.html': ['Zamówienie z obowiązkiem zapłaty', 'mElements S.A.', 'Autopay S.A.', 'PLN', 'w ciągu 14 dni'],
    'prywatnosc/index.html': ['Administratorem danych osobowych', 'Cookies', 'Prezesa Urzędu Ochrony Danych Osobowych'],
    'dostawa/index.html': ['Paczkomat', 'Kurier InPost', 'Waluta rozliczeń: PLN', 'InPost Pay'],
    'zwroty/index.html': ['Zwrot w ciągu 14 dni', 'Reklamacje', 'Wzór oświadczenia o odstąpieniu'],
  };
  for (const [file, phrases] of Object.entries(required)) {
    const html = await read(file);
    assert.match(html, /<link rel="canonical" href="https:\/\/artwaytm\.pl\//);
    for (const phrase of phrases) assert.ok(html.includes(phrase), `${file}: brak ${phrase}`);
  }
});

test('InPost Pay jest opisany jako osobny, opcjonalny kanał obok Paynow', async () => {
  const admin = await read('src/frontend/15e-payment-integration-readiness.js');
  assert.match(admin, /InPost Pay obok Paynow/);
  assert.match(admin, /wymaga osobnej umowy/);
  assert.match(admin, /obecne połączenie InPost[^\n]*ShipX/);
});

test('panel pokazuje formalną checklistę i oddziela sandbox od produkcji', async () => {
  const admin = await read('src/frontend/15-personalization-and-publishing.js');
  assert.match(admin, /Gotowość Paynow/);
  assert.match(admin, /PAYNOW_ENV=sandbox/);
  assert.match(admin, /Płatność jest bezpiecznie ukryta przed klientem/);
  assert.match(admin, /chronione środowisko backendu VPS/);
  assert.doesNotMatch(admin, /Paynow[^\n]*Netlify|Netlify[^\n]*Paynow/i);
});
