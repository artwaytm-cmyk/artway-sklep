import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allegroCategoryConsensus,
  allegroCategoryIntentPhrases,
  allegroCorrectCategorySelection,
  allegroCategoryNeedsCorrection,
  allegroCategoryParentPath,
  allegroCategorySpecificScore,
} from '../src/backend/lib/domain/allegro-category-classifier.mjs';

test('Agent dziedziczy kategorię Allegro z wyraźnej większości potwierdzonych produktów tej samej grupy', () => {
  const related = [
    ...Array.from({ length: 8 }, (_, index) => ({
      id: `P-${index}`,
      nazwa: `Puzzle drewniane Dream Team ${index}`,
      kategoria: 'Dream Team',
      allegroCategoryId: '257813',
      allegroProductId: `CATALOG-${index}`,
    })),
    {
      id: 'P-X',
      nazwa: 'Puzzle drewniane Dream Team stary błąd',
      kategoria: 'Dream Team',
      allegroCategoryId: '46097',
      allegroOfferId: 'O-X',
    },
  ];
  const result = allegroCategoryConsensus({
    id: 'TARGET',
    nazwa: 'Puzzle drewniane Dream Team Kotek 50 elementów',
    kategoria: 'Dream Team',
    allegroCategoryId: '46097',
  }, related);
  assert.equal(result.selected.id, '257813');
  assert.equal(result.replaceCurrent, true);
  assert.ok(result.confidence >= 95);
  assert.equal(result.selected.count, 8);
});

test('Agent nie zgaduje kategorii, gdy historia grupy jest podzielona', () => {
  const related = [
    { id: '1', nazwa: 'Gra A', kategoria: 'Gry rodzinne', allegroCategoryId: '6105', allegroProductId: 'A' },
    { id: '2', nazwa: 'Gra B', kategoria: 'Gry rodzinne', allegroCategoryId: '6105', allegroProductId: 'B' },
    { id: '3', nazwa: 'Gra C', kategoria: 'Gry rodzinne', allegroCategoryId: '6106', allegroProductId: 'C' },
    { id: '4', nazwa: 'Gra D', kategoria: 'Gry rodzinne', allegroCategoryId: '6106', allegroProductId: 'D' },
  ];
  const result = allegroCategoryConsensus({ id: 'TARGET', nazwa: 'Gra rodzinna', kategoria: 'Gry rodzinne' }, related);
  assert.equal(result.selected, null);
  assert.match(result.reason, /różnych kategorii/);
});

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
