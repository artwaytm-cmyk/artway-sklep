import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accountSessionCookie,
  createAccountSession,
  createOrderAccess,
  hashPassword,
  requestSession,
  verifyOrderAccess,
  verifyPassword,
} from '../netlify/functions/lib/core/security.mjs';
import { createAdminMfaChallenge, verifyAdminMfaChallenge, verifyMfaCode } from '../netlify/functions/lib/core/mfa.mjs';
import { bezpieczneZamowienieKlienta } from '../netlify/functions/lib/domain/checkout.mjs';

process.env.ARTWAY_SESSION_SECRET = 'test-secret-that-is-not-used-in-production';

test('podpisana sesja wskazuje właściciela i rolę konta', () => {
  const token = createAccountSession({ email: 'Klient@Example.com', rola: 'klient' });
  const request = new Request('https://artwaytm.pl/api/store', { headers: { authorization: `Bearer ${token}` } });
  assert.deepEqual(requestSession(request), { email: 'klient@example.com', role: 'klient', exp: requestSession(request).exp });
  assert.equal(requestSession(new Request('https://artwaytm.pl/api/store', { headers: { authorization: `${token}x` } })), null);
});

test('sesja konta działa z ciasteczka HttpOnly i nie wymaga tokenu w JavaScript', () => {
  const token = createAccountSession({ email: 'admin@example.com', rola: 'admin' });
  const cookie = accountSessionCookie(token);
  assert.match(cookie, /^artway_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  const request = new Request('https://artwaytm.pl/api/store', { headers: { cookie: cookie.split(';')[0] } });
  assert.equal(requestSession(request)?.role, 'admin');
  assert.equal(requestSession(request)?.email, 'admin@example.com');
});

test('wyzwanie MFA wygasa jako osobny zakres i TOTP toleruje tylko sąsiednie okno czasu', () => {
  const challenge = createAdminMfaChallenge('ADMIN@example.com', true);
  assert.deepEqual(verifyAdminMfaChallenge(challenge), { email: 'admin@example.com', setup: true });
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  assert.equal(verifyMfaCode(rfcSecret, '287082', 59_000), true);
  assert.equal(verifyMfaCode(rfcSecret, '287083', 59_000), false);
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

test('kontrolowany stan magazynowy znosi zbędne potwierdzenie większej ilości', () => {
  const base = {
    nr: 'ATM-STOCK8', email: 'klient@example.com', pozycjeDane: [{ id: 7, ilosc: 8 }],
    klient: { imie: 'Jan', nazwisko: 'Kowalski', telefon: '500600700' },
    adresDostawy: { ulica: 'Testowa', nrDomu: '1', kod: '00-001', miasto: 'Warszawa' },
    dostawaId: 'paczkomat', paczkomat: 'WAW01A', platnoscId: 'telefon',
  };
  const settings = { artway_produkty_katalog: [{ id: 7, nazwa: 'Gra testowa', cena: 20 }], artway_stany: { 7: 8 } };
  const covered = bezpieczneZamowienieKlienta(base, settings);
  assert.equal(covered.wymagaPotwierdzeniaDostepnosci, false);
  const shortage = bezpieczneZamowienieKlienta({ ...base, nr: 'ATM-STOCK9', pozycjeDane: [{ id: 7, ilosc: 9 }] }, settings);
  assert.equal(shortage.wymagaPotwierdzeniaDostepnosci, true);
  assert.deepEqual(shortage.dostepnoscDoPotwierdzenia[0], { id: 7, nazwa: 'Gra testowa', ilosc: 9, stanMagazynowy: 8 });
});

test('backend niezależnie nalicza zaawansowane reguły rabatowe', () => {
  const base = {
    nr: 'ATM-RABAT1', email: 'klient@example.com', rabatKod: 'gry20', pozycjeDane: [{ id: 7, ilosc: 1 }, { id: 8, ilosc: 1 }],
    klient: { imie: 'Jan', nazwisko: 'Kowalski', telefon: '500600700' },
    adresDostawy: { ulica: 'Testowa', nrDomu: '1', kod: '00-001', miasto: 'Warszawa' },
    dostawaId: 'paczkomat', paczkomat: 'WAW01A', platnoscId: 'telefon',
  };
  const settings = {
    artway_produkty_katalog: [{ id: 7, nazwa: 'Gra', kategoria: 'Gry', cena: 100 }, { id: 8, nazwa: 'Balon', kategoria: 'Balony', cena: 50 }],
    artway_ustawienia: {
      darmowaDostawaOd: 200,
      kodyRabatoweZaawansowane: [
        { kod: 'GRY20', typ: 'procent', wartosc: 20, zakres: 'kategorie', kategorie: ['Gry'], maxRabat: 15, aktywny: true },
        { kod: 'WYSYLKA0', typ: 'darmowa_dostawa', zakres: 'wszystkie', aktywny: true },
      ],
    },
  };
  const discount = bezpieczneZamowienieKlienta(base, settings);
  assert.equal(discount.koszty.rabat, 15);
  assert.equal(discount.razem, 147);
  assert.equal(discount.rabatKod, 'GRY20');
  const freeShipping = bezpieczneZamowienieKlienta({ ...base, nr: 'ATM-RABAT2', rabatKod: 'wysylka0' }, settings);
  assert.equal(freeShipping.koszty.dostawa, 0);
  assert.equal(freeShipping.razem, 150);
  assert.equal(freeShipping.rabatTyp, 'darmowa_dostawa');
});
