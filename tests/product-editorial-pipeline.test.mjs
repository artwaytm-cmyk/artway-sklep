import test from 'node:test';
import assert from 'node:assert/strict';
import { linkedProductSourceMaterial, normalizeEditorialTitle, prepareLinkedProductEditorial } from '../netlify/functions/lib/domain/product-editorial-pipeline.mjs';

const result = (id, fields) => ({ id, model: 'gpt-5-nano', result: { confidence: 0.97, complianceStatus: 'ready', fields: Object.entries(fields).map(([key, value]) => ({ key, value })) } });

test('treść źródłowa jest zachowana oddzielnie, a sklep i Allegro dostają jedną wspólną redakcję', async () => {
  const calls = [];
  const runSpecialist = async (input) => {
    calls.push(input);
    if (input.specialist === 'product_content') return result('store-1', {
      title: 'Origami 3D – Kwiaty kreatywny zestaw',
      short_description: 'Stwórz efektowne kompozycje z papierowych modułów i rozwijaj cierpliwość.',
      long_description: '<h2>Kreatywna zabawa</h2><p>Zestaw pozwala przygotować przestrzenne kwiaty zgodnie z instrukcją.</p><ul><li>Ćwiczy precyzję</li><li>Daje satysfakcję z własnej pracy</li></ul>',
      seo_title: 'Origami 3D Kwiaty – zestaw kreatywny', seo_description: 'Zestaw Origami 3D Kwiaty do tworzenia przestrzennych dekoracji.',
    });
    throw new Error('nie powinno być drugiego wariantu treści');
  };
  const raw = { nazwa: 'ORIGAMI 3D KWIATY | Sklep producenta', opisKrotki: 'Opis skopiowany ze źródła.', opis: 'Surowy opis producenta.', producent: 'Alexander', ean: '5906018022889', sourceUrl: 'https://example.test/product' };
  const prepared = await prepareLinkedProductEditorial(raw, { runSpecialist, now: () => new Date('2026-07-18T12:00:00.000Z') });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].context.rule, 'raw_source_is_facts_only');
  assert.equal(prepared.product.sourceMaterial.title, raw.nazwa);
  assert.equal(prepared.product.sourceMaterial.longDescription, raw.opis);
  assert.notEqual(prepared.product.nazwa, raw.nazwa);
  assert.notEqual(prepared.product.opis, raw.opis);
  assert.match(prepared.product.opis, /Kreatywna zabawa\n\nZestaw pozwala/);
  assert.equal(prepared.product.allegroTitle, prepared.product.nazwa);
  assert.equal(prepared.product.allegroDescription, prepared.product.opis);
  assert.equal(prepared.product.contentEditorial.sourceRole, 'facts_only');
  assert.equal(prepared.product.contentEditorial.status, 'ready');
  assert.equal(prepared.product.ean, raw.ean);
});

test('normalizacja awaryjna usuwa dopisek strony i porządkuje wielkie litery', () => {
  assert.equal(normalizeEditorialTitle('ORIGAMI 3D KWIATY | Sklep producenta'), 'Origami 3D Kwiaty');
  assert.equal(linkedProductSourceMaterial({ nazwa: 'Gra', opis: '<p>Opis</p>', ean: '123' }, 'https://example.test').title, 'Gra');
});

test('awaria modelu nie miesza źródła z kanałami i oznacza treść do kontroli', async () => {
  const prepared = await prepareLinkedProductEditorial({ nazwa: 'GRA RODZINNA | Sklep producenta', opis: 'Faktyczny opis.' }, { runSpecialist: async () => { throw new Error('limit'); } });
  assert.equal(prepared.status, 'needs_review');
  assert.equal(prepared.product.nazwa, 'Gra Rodzinna');
  assert.equal(prepared.product.sourceMaterial.title, 'GRA RODZINNA | Sklep producenta');
  assert.equal(prepared.warnings.length, 1);
});
