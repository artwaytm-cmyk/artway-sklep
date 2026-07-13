import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filtrujNieusunieteZamowienia,
  mapaUsunietych,
  normalizujKlienta,
  normalizujUsunieteZamowienie,
  normalizujZamowienie,
} from '../netlify/functions/lib/domain/orders.mjs';

test('normalizacja zamówienia czyści numer, e-mail i uzupełnia czas', () => {
  const order = normalizujZamowienie({ nr: '  ATM-123  ', email: ' KLIENT@EXAMPLE.COM ' }, 123456);
  assert.deepEqual(order, { nr: 'ATM-123', email: 'klient@example.com', ts: 123456 });
  assert.equal(normalizujZamowienie({ nr: '   ' }), null);
});

test('normalizacja klienta wymaga e-maila', () => {
  assert.equal(normalizujKlienta({ email: '' }), null);
  assert.deepEqual(normalizujKlienta({ email: ' TEST@EXAMPLE.COM ' }), { email: 'test@example.com' });
});

test('usunięte zamówienie nie wraca do aktywnej listy', () => {
  const deleted = normalizujUsunieteZamowienie({ number: 'ATM-2', email: 'A@B.PL', by: 'admin' }, '2026-07-13T10:00:00.000Z');
  const map = mapaUsunietych([deleted, { nr: 'ATM-2', by: 'customer' }]);
  assert.equal(map.size, 1);
  assert.deepEqual(filtrujNieusunieteZamowienia([{ nr: 'ATM-1' }, { nr: 'ATM-2' }], map), [{ nr: 'ATM-1' }]);
});
