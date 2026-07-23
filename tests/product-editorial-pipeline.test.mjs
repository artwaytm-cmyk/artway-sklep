import test from 'node:test';
import assert from 'node:assert/strict';
import { linkedProductSourceMaterial, normalizeEditorialTitle, prepareLinkedProductEditorial } from '../src/backend/lib/domain/product-editorial-pipeline.mjs';

const result = (id, specialist, fields) => ({
  id, specialist, model: 'gpt-5-nano',
  result: {
    confidence: 0.97, complianceStatus: 'ready', readyForApproval: true, warnings: [], missingFacts: [],
    fields: Object.entries(fields).map(([key, value]) => ({ key, value })),
  },
});
function specialistResult(input) {
  if (input.specialist === 'product_content') return result('store-1', input.specialist, {
    title: 'Origami 3D – Kwiaty kreatywny zestaw',
    short_description: 'Stwórz efektowne kompozycje z papierowych modułów i rozwijaj cierpliwość.',
    long_description: '<h2>Kreatywna zabawa</h2><p>Zestaw pozwala przygotować przestrzenne kwiaty zgodnie z instrukcją.</p><ul><li>Ćwiczy precyzję</li><li>Daje satysfakcję z własnej pracy</li></ul>',
    seo_title: 'Origami 3D Kwiaty – zestaw kreatywny', seo_description: 'Zestaw Origami 3D Kwiaty do tworzenia przestrzennych dekoracji.', seo_keywords: 'origami 3D, kwiaty',
  });
  if (input.specialist === 'allegro_offer') return result('allegro-1', input.specialist, {
    allegro_title: 'Origami 3D Kwiaty Alexander zestaw kreatywny',
    allegro_description: '<h2>Przestrzenne kwiaty</h2><p>Zestaw pozwala tworzyć dekoracyjne kwiaty z papierowych modułów i ćwiczyć dokładność.</p><ul><li>Czytelna instrukcja</li><li>Kreatywna praca</li></ul>',
  });
  return result('vh-1', input.specialist, {
    von_halsky_title: 'Origami 3D Kwiaty Alexander',
    von_halsky_short_description: 'Kreatywny zestaw do tworzenia przestrzennych kwiatów z papierowych modułów.',
    von_halsky_description: '<h2>Kreatywne origami</h2><p>Zestaw pozwala przygotować przestrzenne kwiaty z papierowych modułów i rozwijać dokładność.</p><ul><li>Czytelna instrukcja</li><li>Efektowna dekoracja</li></ul>',
  });
}

test('źródło pozostaje materiałem faktów, a trzy kanały dostają niezależne wersje i statusy', async () => {
  const calls = [];
  const raw = { nazwa: 'ORIGAMI 3D KWIATY | Sklep producenta', opisKrotki: 'Opis skopiowany ze źródła.', opis: 'Surowy opis producenta.', producent: 'Alexander', ean: '5906018022889', sourceUrl: 'https://example.test/product' };
  const prepared = await prepareLinkedProductEditorial(raw, { runSpecialist: async (input) => { calls.push(input); return specialistResult(input); }, now: () => new Date('2026-07-18T12:00:00.000Z') });

  assert.deepEqual(calls.map((call) => call.specialist), ['product_content', 'allegro_offer', 'von_halsky_offer']);
  assert.equal(calls[0].context.rule, 'raw_source_is_facts_only');
  assert.equal(prepared.product.sourceMaterial.title, raw.nazwa);
  assert.equal(prepared.product.sourceMaterial.longDescription, raw.opis);
  assert.notEqual(prepared.product.nazwa, raw.nazwa);
  assert.notEqual(prepared.product.opis, prepared.product.allegroDescription);
  assert.notEqual(prepared.product.opis, prepared.product.vonHalskyDescription);
  assert.equal(prepared.product.vonHalskyContentMode, 'custom');
  assert.ok(Array.isArray(prepared.product.allegroDescriptionSections));
  assert.equal(prepared.product.contentEditorial.status, 'ready');
  assert.equal(prepared.product.contentEditorial.channels, 'independent_store_allegro_von_halsky');
  assert.deepEqual(Object.fromEntries(Object.entries(prepared.product.contentEditorial.channelStates).map(([key, value]) => [key, value.status])), { store: 'ready', allegro: 'ready', vonHalsky: 'ready' });
  assert.equal(prepared.product.ean, raw.ean);
});

test('awaria jednego kanału nie cofa zapisanych wyników pozostałych kanałów', async () => {
  const prepared = await prepareLinkedProductEditorial({ nazwa: 'GRA RODZINNA | Sklep producenta', opis: 'Faktyczny opis produktu.', opisKrotki: 'Gra rodzinna.', producent: 'Alexander' }, {
    runSpecialist: async (input) => {
      if (input.specialist === 'allegro_offer') throw new Error('Allegro chwilowo niedostępne');
      return specialistResult(input);
    },
  });
  assert.equal(prepared.status, 'partial_ready');
  assert.equal(prepared.product.contentEditorial.channelStates.store.status, 'ready');
  assert.equal(prepared.product.contentEditorial.channelStates.vonHalsky.status, 'ready');
  assert.equal(prepared.product.contentEditorial.channelStates.allegro.status, 'needs_review');
  assert.ok(prepared.product.opis);
  assert.ok(prepared.product.vonHalskyDescription);
  assert.equal(prepared.product.allegroDescription, undefined);
  assert.match(prepared.warnings.join(' '), /Allegro chwilowo niedostępne/);
});

test('normalizacja awaryjna usuwa dopisek strony i porządkuje wielkie litery', () => {
  assert.equal(normalizeEditorialTitle('ORIGAMI 3D KWIATY | Sklep producenta'), 'Origami 3D Kwiaty');
  assert.equal(linkedProductSourceMaterial({ nazwa: 'Gra', opis: '<p>Opis</p>', ean: '123' }, 'https://example.test').title, 'Gra');
});
