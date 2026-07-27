import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allegroAutomaticCategoryParameters,
  allegroProductParameterCatalog,
  normalizeAllegroParameterName,
  resolveAllegroCategoryParameter,
} from '../src/backend/lib/domain/allegro-category-parameter-resolver.mjs';

const dictionary = (id, name, values) => ({
  id,
  name,
  required: true,
  options: { describesProduct: true },
  dictionary: values.map(([valueId, value]) => ({ id: valueId, value })),
});

test('scala aliasy parametrów producenta bez tworzenia nowych pól produktu', () => {
  const product = {
    ean: '5906395300310',
    kodProducenta: '0031',
    producent: 'Multigra',
    parametryZrodla: { 'Liczba Graczy': '2+', 'Wiek Graczy Od': '5 lat' },
    parametryProducenta: { liczbaGraczy: '2+', wiek: '5 lat', liczbaElementow: '152 szt' },
  };
  const catalog = allegroProductParameterCatalog(product);
  assert.equal(catalog.get('ean').value, '5906395300310');
  assert.equal(catalog.get('numer referencyjny').value, '0031');
  assert.equal(catalog.get('liczba graczy').value, '2+');
  assert.equal(catalog.get('wiek').value, '5 lat');
  assert.equal(product.minimalnyWiekDziecka, undefined);
  assert.equal(product.minimalnaLiczbaGraczy, undefined);
});

test('uzupełnia cztery wymagane parametry Allegro z wieku i zakresu graczy 2+', () => {
  const product = {
    parametryProducenta: { wiek: '5 lat', liczbaGraczy: '2+' },
    parametryZrodla: { 'Wiek Graczy Od': '5 lat', 'Liczba Graczy': '2+' },
  };
  const parameters = [
    dictionary('3475', 'Wiek dziecka', [['3475_55', '5 lat +'], ['3475_66', '6 lat +']]),
    dictionary('130493', 'Minimalna liczba graczy', [['130493_1', '1'], ['130493_2', '2'], ['130493_3', '3']]),
    dictionary('130494', 'Maksymalna liczba graczy', [['130494_2', '2'], ['130494_6', '6'], ['130494_7', 'Więcej niż 6']]),
    dictionary('250062', 'Minimalny wiek dziecka', [['250062_1794309', '4'], ['250062_1794310', '5'], ['250062_1794311', '6']]),
  ];
  assert.deepEqual(allegroAutomaticCategoryParameters(product, parameters), [
    { id: '3475', valuesIds: ['3475_55'] },
    { id: '130493', valuesIds: ['130493_2'] },
    { id: '130494', valuesIds: ['130494_7'] },
    { id: '250062', valuesIds: ['250062_1794310'] },
  ]);
});

test('zakres graczy 2-4 ustawia osobno minimum i maksimum', () => {
  const product = { parametryProducenta: { liczbaGraczy: '2–4 graczy' } };
  const parameters = [
    dictionary('min', 'Minimalna liczba graczy', [['min-2', '2'], ['min-4', '4']]),
    dictionary('max', 'Maksymalna liczba graczy', [['max-2', '2'], ['max-4', '4']]),
  ];
  assert.deepEqual(allegroAutomaticCategoryParameters(product, parameters), [
    { id: 'min', valuesIds: ['min-2'] },
    { id: 'max', valuesIds: ['max-4'] },
  ]);
});

test('liczbę elementów i materiał odczytuje z jednoznacznej nazwy puzzli', () => {
  const product = { nazwa: 'Drewniane puzzle Galaxies – Jednorożec, 150 elementów' };
  const parameters = [
    { id: 'elements', name: 'Liczba elementów', required: true, options: { describesProduct: true }, dictionary: [] },
    dictionary('material', 'Materiał', [['wood', 'Drewno'], ['cardboard', 'Karton']]),
  ];
  assert.deepEqual(allegroAutomaticCategoryParameters(product, parameters), [
    { id: 'elements', values: ['150'] },
    { id: 'material', valuesIds: ['wood'] },
  ]);
});

test('wymagany parametr Nazwa korzysta z kanonicznej nazwy produktu', () => {
  const result = resolveAllegroCategoryParameter(
    { nazwa: 'Drewniane puzzle Buddy Dogs – 50 elementów' },
    { id: 'name-1', name: 'Nazwa', required: true, options: { describesProduct: true } },
  );
  assert.deepEqual(result?.payload, { id: 'name-1', values: ['Drewniane puzzle Buddy Dogs – 50 elementów'] });
});

test('normalizuje polskie nazwy oraz camelCase do jednego klucza', () => {
  assert.equal(normalizeAllegroParameterName('LiczbaElementów'), 'liczba elementow');
  assert.equal(normalizeAllegroParameterName('Numer Referencyjny'), 'numer referencyjny');
});

test('wydawcę ustawia z kanonicznego producenta, a materiał odczytuje z pełnego opisu', () => {
  const product = {
    producent: 'Alexander',
    opis: 'Tarcza została wykonana z solidnej tektury, a wskazówki z tworzywa.',
    allegroParameterEvidence: {
      language: { value: 'Polska', source: 'polskie źródło', confidence: 0.9 },
      type: { value: 'gra edukacyjna', source: 'rodzaj produktu', confidence: 0.9 },
    },
  };
  const parameters = [
    dictionary('publisher', 'Wydawca', [['alexander', 'Alexander'], ['other', 'Inny']]),
    dictionary('language', 'Wersja językowa gry', [['pl', 'Polska'], ['en', 'Angielska']]),
    dictionary('type', 'Typ', [['educational', 'gra edukacyjna'], ['family', 'gra rodzinna']]),
    dictionary('material', 'Materiał', [['cardboard', 'Tektura'], ['plastic', 'Tworzywo sztuczne']]),
  ];
  assert.deepEqual(allegroAutomaticCategoryParameters(product, parameters), [
    { id: 'publisher', valuesIds: ['alexander'] },
    { id: 'language', valuesIds: ['pl'] },
    { id: 'type', valuesIds: ['educational'] },
    { id: 'material', valuesIds: ['cardboard'] },
  ]);
});

test('słownik Allegro dopasowuje jednoznaczny wariant znaczeniowy zamiast wymagać identycznej odmiany', () => {
  const resolved = resolveAllegroCategoryParameter(
    { allegroParameterEvidence: { type: { value: 'gra edukacyjna', source: 'nazwa i opis', confidence: 0.9 } } },
    dictionary('type', 'Typ', [['educational', 'Edukacyjna'], ['family', 'Rodzinna']]),
  );
  assert.deepEqual(resolved?.payload, { id: 'type', valuesIds: ['educational'] });
});
