import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { isValidAccountEmail, normalizeAccountEmail } from '../netlify/functions/lib/core/account-validation.mjs';

test('walidacja konta akceptuje prawdziwe adresy i odrzuca niepełne dane', () => {
  assert.equal(normalizeAccountEmail(' Klient@Example.PL '), 'klient@example.pl');
  assert.equal(isValidAccountEmail('klient@example.pl'), true);
  assert.equal(isValidAccountEmail('klient+zamowienia@example.com'), true);
  assert.equal(isValidAccountEmail('niepoprawny'), false);
  assert.equal(isValidAccountEmail('klient@localhost'), false);
  assert.equal(isValidAccountEmail('klient @example.pl'), false);
});

test('udane logowanie nie czeka na ciężką synchronizację danych', async () => {
  const source = await readFile(new URL('../src/frontend/06c-storefront-account.js', import.meta.url), 'utf8');
  assert.match(source, /location\.hash=cel;/);
  assert.match(source, /Promise\.resolve\(\)\.then\(synchronizacja\)\.catch/);
  assert.doesNotMatch(source, /await synchronizujBazeCentralna\(true\)/);
  assert.doesNotMatch(source, /await pobierzMojeZamowieniaCentralne\(true\)/);
});

test('formularze blokują wielokrotne wysłanie i pokazują konkretny błąd', async () => {
  const source = await readFile(new URL('../src/frontend/06c-storefront-account.js', import.meta.url), 'utf8');
  assert.match(source, /button\.disabled=true;button\.textContent="Loguję…"/);
  assert.match(source, /button\.disabled=true;button\.textContent="Tworzę konto…"/);
  assert.match(source, /Nie udało się zalogować\. Spróbuj ponownie\./);
  assert.match(source, /Nie udało się utworzyć konta\. Spróbuj ponownie\./);
});

test('router ponawia pobranie modułu po chwilowym błędzie sieci', async () => {
  const source = await readFile(new URL('../src/frontend/06-router-and-storefront.js', import.meta.url), 'utf8');
  assert.match(source, /proba<1/);
  assert.match(source, /retry=\$\{Date\.now\(\)\}/);
  assert.match(source, /Nie udało się wczytać tej strony/);
  assert.match(source, /Spróbuj ponownie/);
});
