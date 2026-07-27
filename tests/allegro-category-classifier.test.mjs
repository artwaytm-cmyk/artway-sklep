import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allegroCategoryIntentPhrases,
  allegroCorrectCategorySelection,
  allegroCategoryNeedsCorrection,
  allegroCategoryParentPath,
  allegroCategorySpecificScore,
} from '../src/backend/lib/domain/allegro-category-classifier.mjs';

test('pełna ścieżka kategorii obejmuje rodziców zwróconych przez Allegro', () => {
  const path = allegroCategoryParentPath({
    id: '11840',
    name: 'Puzzle',
    parent: { id: '11818', name: 'Zabawki', parent: { id: '11763', name: 'Dziecko', parent: null } },
  });
  assert.deepEqual(path, ['Dziecko', 'Zabawki', 'Puzzle']);
});

test('puzzle premiują kategorię Puzzle i odrzucają klocki lub gry', () => {
  const product = 'Drewniane puzzle 50 elementów';
  assert.equal(allegroCategorySpecificScore(product, 'Dziecko Zabawki Puzzle Tradycyjne'), 120);
  assert.equal(allegroCategorySpecificScore(product, 'Dziecko Zabawki Klocki Drewniane'), -120);
});

test('zamiar puzzli zawsze dodaje dokładną frazę kategorii zamiast samych ogólnych zabawek', () => {
  assert.deepEqual(allegroCategoryIntentPhrases('Drewniane puzzle Galaxies 150 elementów'), ['puzzle', 'puzzle drewniane']);
});

test('parametry graczy w kategorii puzzli uruchamiają automatyczną korektę kategorii', () => {
  const product = { nazwa: 'Puzzle drewniane Galaxies 150 elementów' };
  assert.equal(allegroCategoryNeedsCorrection(product, [
    { name: 'Minimalna liczba graczy' }, { name: 'Maksymalna liczba graczy' },
  ]), true);
  assert.equal(allegroCategoryNeedsCorrection(product, [{ name: 'Liczba elementów' }]), false);
});

test('parametry muzyczne przy puzzlach uruchamiają korektę błędnej kategorii', () => {
  const product = { nazwa: 'Puzzle 3D Zamek 216 elementów' };
  assert.equal(allegroCategoryNeedsCorrection(product, [
    { name: 'Nośnik' },
    { name: 'Gatunek' },
    { name: 'Wykonawca' },
    { name: 'Wytwórnia' },
    { name: 'Rok wydania' },
  ]), true);
});

test('brelok kreatywny nie może pozostać w kategorii wymagającej liczby graczy', () => {
  assert.equal(allegroCategoryNeedsCorrection(
    { nazwa: 'X-Press Me Brelok DIY Biedronka', producent: 'Alexander' },
    [{ name: 'Minimalna liczba graczy' }, { name: 'Maksymalna liczba graczy' }],
  ), true);
});

test('korekta kategorii pobiera parametry nowej kategorii tylko przy wykrytej pomyłce', async () => {
  const result = await allegroCorrectCategorySelection({
    product: { nazwa: 'Puzzle drewniane 50 elementów' },
    categoryId: 'gry',
    parameters: [{ name: 'Minimalna liczba graczy' }],
    suggest: async () => ({ selected: { id: 'puzzle' } }),
    loadParameters: async () => ({ parameters: [{ name: 'Liczba elementów' }], errors: [] }),
  });
  assert.equal(result.changed, true);
  assert.equal(result.categoryId, 'puzzle');
  assert.equal(result.parameters.parameters[0].name, 'Liczba elementów');
});

test('produkt zabawkowy Alexander odrzuca kategorię części samochodowych', () => {
  const product = { nazwa: 'Wiatrak B', producent: 'Alexander', kategoria: 'Wiatraczki' };
  assert.equal(allegroCategoryNeedsCorrection(product, [
    { name: 'Producent części' },
    { name: 'Typ samochodu' },
    { name: 'Numer katalogowy części' },
  ]), true);
  assert.ok(
    allegroCategorySpecificScore(
      'Wiatrak B Alexander Wiatraczki',
      'Motoryzacja Części samochodowe Numer katalogowy części',
    ) <= -1000,
  );
  assert.deepEqual(allegroCategoryIntentPhrases('Wiatrak B Alexander'), [
    'wiatraczki zabawki',
    'zabawki ogrodowe dla dzieci',
  ]);
});
