import test from 'node:test';
import assert from 'node:assert/strict';
import {
  telegramDigestSlot,
  telegramEventDecision,
  telegramNaturalIntent,
  telegramPriorityEvents,
  telegramQuietNow,
  telegramSettings,
  telegramSupplierTables,
} from '../netlify/functions/lib/domain/telegram-communication.mjs';

test('Telegram domyślnie wysyła tylko ważne zmiany i chroni ciszę nocną', () => {
  const settings = telegramSettings({});
  assert.equal(settings.mode, 'important');
  assert.equal(settings.onlyChanges, true);
  assert.equal(settings.supplierAlerts, false);
  assert.equal(telegramQuietNow(settings, new Date('2026-07-15T21:30:00Z')), true);
});

test('ten sam krytyczny problem nie jest wysyłany ponownie', () => {
  const event = { key: 'orders', category: 'operations', severity: 'critical', fingerprint: 'same' };
  const previous = { fingerprint: 'same', sentAt: '2026-07-15T08:00:00.000Z' };
  const decision = telegramEventDecision(event, { quietStart: '23:59', quietEnd: '00:01', onlyChanges: true }, previous, new Date('2026-07-15T12:00:00.000Z'));
  assert.equal(decision.deliver, false);
  assert.equal(decision.reason, 'brak nowej zmiany');
});

test('pierwsza kontrola tworzy punkt odniesienia zamiast zalewać starymi alertami', () => {
  const event = { key: 'messages', category: 'customer', severity: 'critical', fingerprint: 'first' };
  const decision = telegramEventDecision(event, { quietStart: '23:59', quietEnd: '00:01' }, null, new Date('2026-07-15T12:00:00.000Z'));
  assert.equal(decision.deliver, false);
  assert.match(decision.reason, /punkt odniesienia/);
});

test('raport zbiorczy uruchamia się tylko raz w danym oknie', () => {
  const now = new Date('2026-07-15T06:05:00.000Z'); // 08:05 w Warszawie
  const slot = telegramDigestSlot({ digestTimes: ['08:00'], quietStart: '21:00', quietEnd: '07:00' }, {}, now);
  assert.equal(slot, '2026-07-15T08:00');
  assert.equal(telegramDigestSlot({ digestTimes: ['08:00'] }, { lastDigestSlot: slot }, now), null);
});

test('bot rozumie zwykłe pytania bez komend', () => {
  assert.equal(telegramNaturalIntent('Czy mamy jakieś nowe zamówienia?'), 'orders');
  assert.equal(telegramNaturalIntent('Kto czeka na odpowiedź?'), 'communication');
  assert.equal(telegramNaturalIntent('Pokaż co jest teraz pilne'), 'status');
});

test('kolejka Telegram obejmuje tylko aktywne ostrzeżenia', () => {
  const events = telegramPriorityEvents({ priorities: [
    { actionId: 'one', severity: 'critical', count: 2, title: 'Nowe zamówienia', action: 'Sprawdź' },
    { actionId: 'two', severity: 'info', count: 4, title: 'Informacja' },
    { actionId: 'three', severity: 'warning', count: 0, title: 'Brak' },
  ] });
  assert.equal(events.length, 1);
  assert.equal(events[0].key, 'one');
});

test('tabela producenta zawiera tylko kod, nazwę i potrzebną ilość', () => {
  const tables = telegramSupplierTables({ id: 'Z-1', pozycje: [{ kod: 'ABC', nazwa: 'Gra testowa', ilosc: 3, dostawca: 'Alexander', ean: '123' }] });
  assert.equal(tables.length, 1);
  assert.match(tables[0].text, /KOD/);
  assert.match(tables[0].text, /NAZWA/);
  assert.match(tables[0].text, /POTRZEBNA ILOŚĆ/);
  assert.doesNotMatch(tables[0].text, /123/);
});
