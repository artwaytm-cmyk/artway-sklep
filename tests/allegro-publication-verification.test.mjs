import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { allegroOfferVerification, allegroPatchZDraftu } from '../netlify/functions/lib/domain/allegro-offer-patch.mjs';

test('edytor domyślnie aktywuje nową lub nieaktywną ofertę, a aktywnej nie wyłącza', async () => {
  const source = await readFile('src/frontend/12-customers-and-inventory.js', 'utf8');
  assert.match(source, /domyslnaPublikacjaAllegro=ofertaAllegroStatus==="ACTIVE"\?"keep":"activate"/);
  assert.match(source, /Zapisz i aktywuj sprzedaż/);
  assert.match(source, /Wynik zostanie ponownie odczytany bezpośrednio z Allegro/);
});

test('synchronizacja samej treści może dołączyć wyłącznie ID istniejącego produktu katalogowego', () => {
  const patch = allegroPatchZDraftu({
    name: 'Gra edukacyjna',
    productSet: [{ product: { id: 'catalog-product-123', name: 'wartość, której nie wysyłamy' }, quantity: { value: 2 } }],
    sellingMode: { price: { amount: '99.99', currency: 'PLN' } },
    stock: { available: 8 },
    description: { sections: [{ items: [{ type: 'TEXT', content: '<p>Opis</p>' }] }] },
  }, { contentOnly: true, includeCatalogProduct: true, publicationAction: 'keep' });

  assert.deepEqual(patch.productSet, [{ product: { id: 'catalog-product-123' } }]);
  assert.equal(patch.sellingMode, undefined);
  assert.equal(patch.stock, undefined);
  assert.deepEqual(patch.publication, { republish: true });
});

test('naprawa potwierdzonej kategorii katalogowej nie włącza zmian ceny ani stanu', () => {
  const patch = allegroPatchZDraftu({
    name: 'Gra', category: { id: '6106' }, productSet: [{ product: { id: 'catalog-1' } }],
    sellingMode: { price: { amount: '20.00', currency: 'PLN' } }, stock: { available: 5 },
    description: { sections: [{ items: [{ type: 'TEXT', content: '<p>Opis gry</p>' }] }] },
  }, { contentOnly: true, includeCatalogProduct: true, repairCatalogCategory: true });
  assert.deepEqual(patch.category, { id: '6106' });
  assert.equal(patch.sellingMode, undefined);
  assert.equal(patch.stock, undefined);
});

test('aktywacja wysyła jednoznaczny status ACTIVE i wznawianie', () => {
  const patch = allegroPatchZDraftu({ name: 'Pieniądze Alexander Tablice' }, { publicationAction: 'activate' });
  assert.deepEqual(patch.publication, { status: 'ACTIVE', republish: true });
});

test('automatyczna synchronizacja treści Allegro nie zmienia ceny, stanu ani warunków sprzedaży', () => {
  const patch = allegroPatchZDraftu({
    name: 'Gra rodzinna Alexander',
    sellingMode: { price: { amount: '99.99', currency: 'PLN' } },
    stock: { available: 500 }, external: { id: 'SKU-1' }, delivery: { shippingRates: { id: 'rate-1' } },
    images: ['https://example.com/image.jpg'], description: { sections: [{ items: [{ type: 'TEXT', content: '<p>Opis</p>' }] }] },
    parameters: [{ id: '1', values: ['x'] }], productSet: [{ product: { id: 'catalog-1' } }],
  }, { publicationAction: 'keep', contentOnly: true });
  assert.deepEqual(Object.keys(patch).sort(), ['description', 'images', 'name', 'publication']);
  assert.deepEqual(patch.publication, { republish: true });
  assert.equal(patch.sellingMode, undefined);
  assert.equal(patch.stock, undefined);
});

test('backend po zapisie ponownie odczytuje ofertę i zwraca zweryfikowany status', async () => {
  const source = await readFile('netlify/functions/lib/store-app.mjs', 'utf8');
  assert.match(source, /verifiedOffer = await allegroWywolaj\(req, `\/sale\/product-offers\/\$\{encodeURIComponent\(offerId\)\}`\)/);
  assert.match(source, /verification: allegroOfferVerification\(result, !!verifiedOffer\)/);
  assert.deepEqual(allegroOfferVerification({ publication: { status: 'ACTIVE' }, description: { sections: [{ items: [] }, { items: [] }] } }, true), { checked: true, status: 'ACTIVE', active: true, descriptionSections: 2 });
});

test('panel nie oznacza szkicu jako opublikowanej oferty', async () => {
  const source = await readFile('src/frontend/11-allegro-and-orders.js', 'utf8');
  assert.match(source, /allegroAgentPreparationStatus:remoteStatus==="ACTIVE"\?"published":"draft"/);
});
