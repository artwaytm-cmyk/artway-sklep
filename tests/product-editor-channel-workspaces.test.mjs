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
  assert.match(workspace, /function productEditorDaneWspolneDefinicja/);
  assert.match(workspace, /function productEditorDaneWspolnePanelHTML/);
  assert.match(workspace, /id="product-editor-shared-data"/);
  assert.match(workspace, /Producent, identyfikatory, GPSR i zdjęcia nie są kopiowane/);
});

test('każdy kanał ma osobny podgląd klienta aktualizowany bez przeładowania formularza', async () => {
  const [editor, workspace, styles] = await Promise.all([
    readFile('src/frontend/12-product-editor.js', 'utf8'),
    readFile('src/frontend/12-product-editor-workspace.js', 'utf8'),
    readFile('src/styles/32-product-editor-workspace.css', 'utf8'),
  ]);
  assert.match(workspace, /function productEditorKanalPodgladHTML/);
  assert.match(workspace, /function productEditorPodgladWnetrzeHTML/);
  assert.match(workspace, /data-product-channel-preview=/);
  assert.match(workspace, /product-preview-store/);
  assert.match(workspace, /product-preview-allegro/);
  assert.match(workspace, /product-preview-vh/);
  assert.match(workspace, /requestAnimationFrame/);
  assert.match(editor, /productEditorPodgladyPodlacz/);
  assert.match(styles, /\.product-channel-live-preview/);
  assert.match(styles, /@media\(max-width:620px\)/);
});

test('producent i inne dane wspólne nie są powielane w listach pól kanałów', async () => {
  const workspace = await readFile('src/frontend/12-product-editor-workspace.js', 'utf8');
  const definitionStart = workspace.indexOf('function productEditorKanalDefinicja');
  const controlStart = workspace.indexOf('function productEditorKanalKontrolaHTML');
  const definition = workspace.slice(definitionStart, controlStart);
  assert.match(definition, /const shared=productEditorDaneWspolneDefinicja\(p\)/);
  assert.match(definition, /return \{items:own,shared/);
  assert.doesNotMatch(definition, /items=\[\.\.\.own,\.\.\.common\]/);
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
