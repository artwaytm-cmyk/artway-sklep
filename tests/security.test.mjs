import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAccountSession,
  createOrderAccess,
  hashPassword,
  requestSession,
  verifyOrderAccess,
  verifyPassword,
} from '../netlify/functions/lib/core/security.mjs';
import { bezpieczneZamowienieKlienta } from '../netlify/functions/lib/domain/checkout.mjs';

process.env.ARTWAY_SESSION_SECRET = 'test-secret-that-is-not-used-in-production';

test('podpisana sesja wskazuje właściciela i rolę konta', () => {
  const token = createAccountSession({ email: 'Klient@Example.com', rola: 'klient' });
  const request = new Request('https://artwaytm.pl/api/store', { headers: { authorization: `Bearer ${token}` } });
  assert.deepEqual(requestSession(request), { email: 'klient@example.com', role: 'klient', exp: requestSession(request).exp });
  assert.equal(requestSession(new Request('https://artwaytm.pl/api/store', { headers: { authorization: `${token}x` } })), null);
});

test('token zamówienia działa wyłącznie dla właściwego numeru i e-maila', () => {
  const order = { nr: 'ATM-123456', email: 'klient@example.com' };
  const token = createOrderAccess(order);
  assert.equal(verifyOrderAccess(token, order), true);
  assert.equal(verifyOrderAccess(token, { ...order, nr: 'ATM-654321' }), false);
  assert.equal(verifyOrderAccess(token, { ...order, email: 'inna@example.com' }), false);
});

test('hasło jest solone i weryfikowane po stronie serwera', async () => {
  const first = await hashPassword('bezpieczne-haslo-123');
  const second = await hashPassword('bezpieczne-haslo-123');
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('bezpieczne-haslo-123', first), true);
  assert.equal(await verifyPassword('bledne-haslo', first), false);
});

test('serwer przelicza zamówienie z katalogu zamiast ufać cenie klienta', () => {
  const settings = {
    artway_produkty_katalog: [{ id: 7, nazwa: 'Gra testowa', sku: 'GRA-7', cena: 25 }],
    artway_ustawienia: {
      darmowaDostawaOd: 200,
      dostawy: [{ id: 'paczkomat', nazwa: 'Paczkomat InPost 24/7', koszt: 12 }],
      platnosci: [{ id: 'pobranie', nazwa: 'Za pobraniem', oplata: 5 }],
      kodyRabatowe: { TEST10: 10 },
    },
  };
  const order = bezpieczneZamowienieKlienta({
    nr: 'ATM-123456', email: 'klient@example.com', rabatKod: 'test10',
    pozycjeDane: [{ id: 7, ilosc: 2, cena: 0.01, wartosc: 0.02 }],
    klient: { imie: 'Jan', nazwisko: 'Kowalski', telefon: '500600700' },
    adresDostawy: { ulica: 'Testowa', nrDomu: '1', kod: '00-001', miasto: 'Warszawa' },
    dostawaId: 'paczkomat', paczkomat: 'WAW01A', paczkaWeekend: true,
    platnoscId: 'pobranie', razem: 0.02,
  }, settings);
  assert.equal(order.pozycjeDane[0].cena, 25);
  assert.equal(order.koszty.rabat, 5);
  assert.equal(order.razem, 67);
  assert.equal(order.status, 'nowe');
});

test('zamówienia nie można utworzyć dla produktu spoza aktywnego katalogu', () => {
  assert.throws(() => bezpieczneZamowienieKlienta({
    nr: 'ATM-123456', email: 'klient@example.com', pozycjeDane: [{ id: 999, ilosc: 1 }],
  }, { artway_produkty_katalog: [] }), /nie jest dostępny/);
});
