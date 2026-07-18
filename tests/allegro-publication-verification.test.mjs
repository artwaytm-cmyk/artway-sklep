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

test('aktywacja wysyła jednoznaczny status ACTIVE i wznawianie', () => {
  const patch = allegroPatchZDraftu({ name: 'Pieniądze Alexander Tablice' }, { publicationAction: 'activate' });
  assert.deepEqual(patch.publication, { status: 'ACTIVE', republish: true });
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
