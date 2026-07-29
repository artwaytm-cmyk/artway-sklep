import test from 'node:test';
import assert from 'node:assert/strict';
import {
  editorialProductContentReport,
  editorialSourceNoiseReport,
  editorialTextLooksValid,
} from '../src/backend/lib/domain/product-editorial-safety.mjs';
import { buildProfessionalProductDescription } from '../src/backend/lib/domain/product-content-layout.mjs';

test('fałszywy tytuł i urwany tekst źródła nie przechodzą jako gotowa redakcja', () => {
  assert.equal(editorialTextLooksValid(':{', 5), false);
  const report = editorialProductContentReport({
    nazwa: ':{',
    opisKrotki: 'Opis produktu [...]Read More...',
    opis: '5.00/5.00 Opinie (1) Opis produktu [...]Read More...',
  }, 'store');
  assert.equal(report.ready, false);
  assert.ok(report.issues.includes('invalid_title'));
  assert.equal(editorialSourceNoiseReport(report.longDescription).noisy, true);
});

test('parametry camelCase są scalane z ich polskimi odpowiednikami', () => {
  const description = buildProfessionalProductDescription({
    parametryProducenta: {
      LiczbaGraczy: '2–4',
      'Liczba graczy': '2–4',
      LiczbaElementow: '50',
      'Liczba elementów': '50',
    },
  }, 'Rodzinna gra logiczna pomaga ćwiczyć koncentrację i planowanie. Rozgrywka opiera się na prostych zasadach i sprawdzi się podczas wspólnego czasu.');
  assert.equal((description.match(/Liczba graczy:/g) || []).length, 1);
  assert.equal((description.match(/Liczba elementów:/g) || []).length, 1);
  assert.doesNotMatch(description, /LiczbaGraczy|LiczbaElementow/);
});

test('techniczne etykiety producenta są czytelne i zachowują skróty EAN oraz GTIN', () => {
  const description = buildProfessionalProductDescription({
    parametryProducenta: {
      IloscWOpakowaniuZbiorczym: '30 szt.',
      KodProducenta: '0014',
      NumerReferencyjny: '0014',
      EAN: '5906395300143',
      WymiaryOpakowaniaZbiorczego: '34/30,5/21 cm',
    },
  }, 'Zestaw edukacyjny pomaga dziecku rozwijać wyobraźnię oraz cierpliwość podczas wykonywania kolorowych prac. Proste zasady pozwalają szybko rozpocząć twórczą zabawę.');
  assert.match(description, /Ilość w opakowaniu zbiorczym: 30 szt\./);
  assert.match(description, /Kod producenta: 0014/);
  assert.match(description, /Numer referencyjny: 0014/);
  assert.match(description, /EAN: 5906395300143/);
  assert.match(description, /Wymiary opakowania zbiorczego: 34\/30,5\/21 cm/);
  assert.doesNotMatch(description, /WOpakowaniu|Kod Producenta|Numer Referencyjny|\bEan:/);
});
