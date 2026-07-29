import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('edytor ma trzy kompletne i jednoznaczne sekcje kanałów', async () => {
  const [editor, workspace] = await Promise.all([
    readFile('src/frontend/12-product-editor.js', 'utf8'),
    readFile('src/frontend/12-product-editor-workspace.js', 'utf8'),
  ]);
  assert.match(workspace, /id="product-editor-store"/);
  assert.match(editor, /id="product-editor-allegro"/);
  assert.match(workspace, /id="product-editor-von-halsky"/);
  assert.match(workspace, /function productEditorKanalDefinicja/);
  assert.match(workspace, /function productEditorKanalKontrolaHTML/);
  assert.match(workspace, /Dane wspólne/);
  assert.match(workspace, /Profil producenta/);
  assert.match(workspace, /Media wspólne/);
});

test('brakujące treści kanałów są uzupełniane z kartoteki wspólnej bez nadpisywania ręcznej wersji', async () => {
  const workspace = await readFile('src/frontend/12-product-editor-workspace.js', 'utf8');
  assert.match(workspace, /function productEditorUzupelnijKanalyZDanychWspolnych/);
  assert.match(workspace, /target\.dataset\.inherited==="1"/);
  assert.match(workspace, /function productEditorKanalPoleWpisane/);
  assert.match(workspace, /delete input\.dataset\.inherited/);
  for (const field of [
    'allegroTitle', 'allegroShortDescription', 'allegroDescription',
    'vonHalskyTitle', 'vonHalskyShortDescription', 'vonHalskyDescription',
  ]) assert.match(workspace, new RegExp(`"${field}"`));
});

test('sekcja Allegro obejmuje cenę, dostawę i komplet warunków posprzedażowych', async () => {
  const [editor, publication, backend, saver, settingsUi, settingsDomain] = await Promise.all([
    readFile('src/frontend/12-product-editor.js', 'utf8'),
    readFile('src/frontend/11-allegro-product-publication.js', 'utf8'),
    readFile('src/backend/lib/store-app.mjs', 'utf8'),
    readFile('src/backend/lib/domain/catalog-product-field-save.mjs', 'utf8'),
    readFile('src/frontend/11-allegro-settings.js', 'utf8'),
    readFile('src/backend/lib/domain/allegro-offer-settings.mjs', 'utf8'),
  ]);
  for (const field of [
    'cenaAllegro', 'allegroShippingRateId', 'allegroReturnPolicyId',
    'allegroImpliedWarrantyId', 'allegroWarrantyId',
  ]) {
    assert.match(editor, new RegExp(`name="${field}"`));
    assert.match(saver, new RegExp(`'${field}'`));
  }
  assert.match(publication, /allegroPobierzWarunkiDoEdytora/);
  assert.match(publication, /allegro-offer-support/);
  assert.match(backend, /product\.allegroShippingRateId \|\| offerSettings\.shippingRateId/);
  assert.match(backend, /returnPolicyId: product\.allegroReturnPolicyId/);
  assert.match(backend, /impliedWarrantyId: product\.allegroImpliedWarrantyId/);
  assert.match(backend, /warrantyId: product\.allegroWarrantyId/);
  for (const field of ['shippingRateId', 'returnPolicyId', 'impliedWarrantyId', 'warrantyId']) {
    assert.match(settingsUi, new RegExp(`name="${field}"`));
    assert.match(settingsDomain, new RegExp(`${field}:`));
  }
  assert.match(settingsUi, /Domyślne dla nowych i aktualizowanych ofert/);
});

test('Von Halsky ma własną cenę, kategorię, treść i pełną kontrolę danych wspólnych', async () => {
  const [editor, workspace] = await Promise.all([
    readFile('src/frontend/12-product-editor.js', 'utf8'),
    readFile('src/frontend/12-product-editor-workspace.js', 'utf8'),
  ]);
  assert.match(workspace, /name="cenaVonHalsky"/);
  assert.match(workspace, /name="vonHalskyCategoryId"/);
  assert.match(workspace, /name="vonHalskyTitle"/);
  assert.match(workspace, /name="vonHalskyShortDescription"/);
  assert.match(workspace, /name="vonHalskyDescription"/);
  assert.match(editor, /\["vonHalskyCategoryId","vonHalskyCategoryId"\]/);
});
