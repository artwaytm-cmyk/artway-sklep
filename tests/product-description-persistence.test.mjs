import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('edytor pokazuje niezależne pola sklepu, Allegro i Von Halsky', async () => {
  const source = await readFile('src/frontend/12-product-editor-workspace.js', 'utf8');
  assert.match(source, /name="opisKrotki"/);
  assert.match(source, /name="opis"/);
  assert.match(source, /name="allegroShortDescription"/);
  assert.match(source, /name="allegroDescription"/);
  assert.match(source, /name="vonHalskyTitle"/);
  assert.match(source, /name="vonHalskyShortDescription"/);
  assert.match(source, /name="vonHalskyDescription"/);
  assert.match(source, /Każdy kanał ma osobny zapis, walidację i kolejkę publikacji/);
  assert.match(source, /Kontakt ustawia się w profilu sklepu, nie w ofercie/);
});
test('ręczna zmiana sklepu nie nadpisuje opisów kanałowych', async () => {
  const source = await readFile('src/frontend/12-product-editor-workspace.js', 'utf8');
  const context = { allegroOfertaDlaProduktuSklepu: () => null };
  vm.createContext(context);
  vm.runInContext(source, context);
  const product = {
    id: 17, allegroOfferId: '123456', nazwa: 'Nowa nazwa', opisKrotki: 'Nowy skrót', opis: 'Nowy opis sklepu',
    allegroTitle: 'Tytuł Allegro', allegroShortDescription: 'Skrót Allegro', allegroDescription: 'Osobny opis Allegro',
    vonHalskyTitle: 'Tytuł Von Halsky', vonHalskyShortDescription: 'Skrót Von Halsky', vonHalskyDescription: 'Osobny opis Von Halsky',
  };
  const result = context.productEditorZastosujWspolnaTresc(product, { ...product, opis: 'Poprzedni opis sklepu' });
  assert.equal(result.allegroDescription, 'Osobny opis Allegro');
  assert.equal(result.vonHalskyDescription, 'Osobny opis Von Halsky');
  assert.equal(result.contentEditorial.channelStates.store.status, 'needs_review');
  assert.equal(result.contentEditorial.channels, 'independent_store_allegro_von_halsky');
  assert.equal(result.vonHalskyContentMode, 'custom');
});

test('zmiana Allegro kolejkuje tylko Allegro, a zmiana Von Halsky tylko Von Halsky', async () => {
  const source = await readFile('src/frontend/12-product-editor-workspace.js', 'utf8');
  const context = { allegroOfertaDlaProduktuSklepu: () => null };
  vm.createContext(context); vm.runInContext(source, context);
  const previous = { id: 1, allegroOfferId: 'offer', nazwa: 'Gra', opisKrotki: 'Sklep skrót', opis: 'Sklep opis', allegroDescription: 'Stare Allegro', vonHalskyDescription: 'Stare VH' };
  const changed = context.productEditorZastosujWspolnaTresc({ ...previous, allegroDescription: 'Nowe Allegro', vonHalskyDescription: 'Nowe VH' }, previous);
  assert.equal(changed.opis, 'Sklep opis');
  assert.equal(changed.allegroEditorialSyncPending, true);
  assert.equal(changed.vonHalskyEditorialSyncPending, true);
  assert.equal(changed.contentEditorial.channelStates.allegro.status, 'needs_review');
  assert.equal(changed.contentEditorial.channelStates.vonHalsky.status, 'needs_review');
});

test('synchronizacja zapisuje osobne wersje kanałów i pełny stan redakcji', async () => {
  const source = await readFile('src/frontend/03-cloud-sync.js', 'utf8');
  assert.match(source, /contentEditorial:p\.contentEditorial/);
  assert.match(source, /allegroShortDescription:p\.allegroShortDescription/);
  assert.match(source, /allegroDescription:p\.allegroDescription/);
  assert.match(source, /vonHalskyShortDescription:p\.vonHalskyShortDescription/);
  assert.match(source, /vonHalskyDescription:p\.vonHalskyDescription/);
  assert.match(source, /allegroDescriptionSource:"agent-independent-allegro-content"/);
});

test('witryna sklepu nie podmienia opisu na wersję Von Halsky ani Allegro', async () => {
  const source = await readFile('src/frontend/03-cloud-sync.js', 'utf8');
  const start = source.indexOf('function wspolnaTrescProduktu');
  const end = source.indexOf('function agentAIUtworzOpisKrotki', start);
  assert.ok(start >= 0 && end > start);
  assert.match(source.slice(start, end), /return p/);
  assert.doesNotMatch(source.slice(start, end), /vonHalskyDescription|allegroDescription/);
});

test('ręczna poprawa Allegro nie zapisuje wyniku do pól sklepu', async () => {
  const source = await readFile('src/frontend/03-cloud-sync.js', 'utf8');
  const start = source.indexOf('async function allegroPoprawOpisyWFormularzu');
  const end = source.indexOf('function tylkoCyfry', start);
  const block = source.slice(start, end);
  assert.match(block, /allegroTitle:d\.allegroTitle/);
  assert.match(block, /allegroDescription:d\.allegroDescription/);
  assert.doesNotMatch(block, /\{nazwa:d\.name|opisKrotki:d\.shortDescription|opis:d\.fullDescription/);
  assert.match(block, /Treść sklepu i Von Halsky nie została zmieniona/);
});

test('synchronizacja ofert nie przywraca starego opisu Allegro do pól sklepu', async () => {
  const source = await readFile('src/backend/lib/store-app.mjs', 'utf8');
  const start = source.indexOf('async function allegroAutoMapujOfertyZKartoteka');
  const end = source.indexOf('function allegroAgentWirtualnyProduktOferty', start);
  const mapping = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(mapping, /fields\.opis\s*=/);
  assert.doesNotMatch(mapping, /fields\.opisKrotki\s*=/);
  assert.match(mapping, /sourceMaterial[\s\S]*allegroOfferDescription/);
});

test('publikacja Allegro preferuje osobny opis kanału, a Von Halsky nie czyta opisu Allegro', async () => {
  const publication = await readFile('src/frontend/11-allegro-product-publication.js', 'utf8');
  const workspace = await readFile('src/frontend/11b-von-halsky-workspace.js', 'utf8');
  assert.match(publication, /improved\.allegroDescription\|\|safeFull/);
  const start = workspace.indexOf('function vonHalskyPrezentacjaProduktu'), end = workspace.indexOf('function vonHalskyGtin', start);
  assert.doesNotMatch(workspace.slice(start, end), /allegroDescription|opisAllegro/);
});
