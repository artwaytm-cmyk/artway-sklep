import test from 'node:test';
import assert from 'node:assert/strict';
import { allegroOfferTitle, allegroOfferTitleValid } from '../netlify/functions/lib/domain/allegro-offer-content.mjs';

test('krótka nazwa produktu dostaje zgodny, faktyczny tytuł Allegro', () => {
  const title = allegroOfferTitle({ nazwa: 'Pieniądze', producent: 'Alexander', kategoria: 'Tablice edukacyjne i inne', kodProducenta: '0026' });
  assert.equal(allegroOfferTitleValid(title), true);
  assert.match(title, /Pieniądze/);
  assert.match(title, /Alexander/);
});

test('ręczny poprawny tytuł Allegro pozostaje bez zmian', () => {
  assert.equal(allegroOfferTitle({ nazwa: 'Gra', allegroTitle: 'Kasa edukacyjna dla dzieci' }), 'Kasa edukacyjna dla dzieci');
});

test('tytuł Allegro nie przekracza 75 znaków', () => {
  const title = allegroOfferTitle({ nazwa: 'Bardzo długa nazwa produktu '.repeat(6), producent: 'Alexander' });
  assert.ok(title.length <= 75);
  assert.equal(allegroOfferTitleValid(title), true);
});
