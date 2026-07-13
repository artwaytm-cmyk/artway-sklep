import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySafeCatalogFixes,
  auditCatalog,
  mergeCatalogProducts,
  safeCatalogPatch,
} from '../netlify/functions/lib/domain/catalog-quality.mjs';

const completeProduct = {
  id: 1,
  nazwa: 'Gra edukacyjna Test',
  kategoria: 'Gry edukacyjne',
  cena: 49.9,
  producent: 'Alexander',
  marka: 'Alexander',
  gtin: '5906018000017',
  ean: '5906018000017',
  externalId: 'TEST-1',
  zdjecie: 'https://example.com/test.jpg',
  opisKrotki: 'Rozbudowana gra edukacyjna przeznaczona do wspólnej i angażującej zabawy całej rodziny.',
  opis: 'Rozbudowana gra edukacyjna przeznaczona do wspólnej i angażującej zabawy całej rodziny. Zestaw pomaga ćwiczyć spostrzegawczość, koncentrację oraz logiczne myślenie. W pudełku znajdują się trwałe elementy i czytelna instrukcja. Produkt został przygotowany z myślą o wygodnej rozgrywce w domu i podczas spotkań rodzinnych.',
  sourceUrl: 'https://example.com/product/test',
  seoTitle: 'Gra edukacyjna Test – Alexander | Artway-TM',
  seoDescription: 'Rozbudowana gra edukacyjna dla całej rodziny. Poznaj zawartość zestawu, zasady rozgrywki, aktualną cenę i dostępność w sklepie Artway-TM.',
};

test('osierocona edycja nie staje się produktem', () => {
  const merged = mergeCatalogProducts({
    artway_produkty_katalog: [completeProduct],
    artway_produkty_edytowane: { 1: { cena: 55 }, 24: { allegroOfferId: '123', opis: 'Szkic' } },
  });
  assert.equal(merged.products.length, 1);
  assert.equal(merged.products[0].cena, 55);
  assert.deepEqual(merged.orphanEdits.map((entry) => entry.id), ['24']);
});

test('bezpieczne poprawki nie wymyślają ceny, EAN-u ani źródła', () => {
  const patch = safeCatalogPatch({ id: 2, nazwa: '  Produkt   testowy ', opis: 'To jest wystarczająco długi opis produktu. Zawiera wyłącznie fakty zapisane już w karcie i może posłużyć do utworzenia krótkiego opisu.' });
  assert.equal(patch.nazwa, 'Produkt testowy');
  assert.ok(patch.opisKrotki);
  assert.equal('cena' in patch, false);
  assert.equal('ean' in patch, false);
  assert.equal('sourceUrl' in patch, false);
});

test('powtarzające się parametry są układane w jedną czytelną sekcję bez utraty faktów', () => {
  const patch = safeCatalogPatch({
    id: 8,
    nazwa: 'Gra Test',
    opis: 'Opis produktu pozostaje bez zmian.\n\nNajważniejsze informacje\n\nMarka: Alexander EAN/GTIN: 5906018000017\n\nNajważniejsze informacje\n\nMarka: Alexander EAN/GTIN: 5906018000017',
  });
  assert.match(patch.opis, /<h3>Najważniejsze informacje<\/h3>/);
  assert.match(patch.opis, /<strong>EAN\/GTIN:<\/strong> 5906018000017/);
  assert.equal((patch.opis.match(/Najważniejsze informacje/g) || []).length, 1);
});

test('zweryfikowane fakty producenta uzupełniają tylko rozpoznany EAN', () => {
  const known = safeCatalogPatch({ id: 85, nazwa: '15 Gier', gtin: '5906018003796', opis: '15 GIER', opisKrotki: '15 GIER' });
  assert.match(known.sourceUrl, /alexander\.com\.pl\/produkty\/15-gier/);
  assert.match(known.opis, /<h3>Zawartość opakowania<\/h3>/);
  assert.equal(known.contentSource, 'manufacturer-official');
  const unknown = safeCatalogPatch({ id: 86, nazwa: 'Inny produkt', gtin: '5901234123457', opis: 'Krótki opis' });
  assert.equal(unknown.contentSource, undefined);
});

test('audyt wykrywa braki i raportuje duplikaty', () => {
  const second = { ...completeProduct, id: 2, externalId: 'TEST-2', nazwa: 'Gra edukacyjna Test' };
  const report = auditCatalog({ artway_produkty_katalog: [completeProduct, second], artway_produkty_dodane: [{ id: 3, nazwa: '' }] });
  assert.equal(report.summary.total, 3);
  assert.ok(report.summary.critical >= 1);
  assert.ok(report.summary.duplicateGroups >= 1);
  assert.ok(report.rows.find((row) => row.id === '3').issues.some((issue) => issue.code === 'missing_name'));
});

test('bezpieczne czyszczenie archiwizuje osierocone edycje i zachowuje prawdziwy produkt', () => {
  const result = applySafeCatalogFixes({
    artway_produkty_katalog: [completeProduct],
    artway_produkty_edytowane: { 1: { opisKrotki: '' }, 99: { allegroOfferId: '999' } },
  }, { quarantineOrphans: true });
  assert.equal(result.orphanArchive.length, 1);
  assert.equal(result.orphanArchive[0].id, '99');
  assert.equal(result.data.artway_produkty_edytowane['99'], undefined);
  assert.equal(mergeCatalogProducts(result.data).products.length, 1);
});
