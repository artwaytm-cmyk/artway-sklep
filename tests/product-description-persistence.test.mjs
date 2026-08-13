import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { buildProfessionalProductDescription, professionalDescriptionQuality } from '../src/backend/lib/domain/product-content-layout.mjs';

test('prosty tekst źródłowy jest zamieniany w profesjonalną kartę bez wymyślania danych', () => {
  const description = buildProfessionalProductDescription({
    parametryProducenta: { Wiek: '6+', 'Liczba graczy': '2–4', Materiał: 'karton', 'Liczba elementów': '91' },
  }, 'Gra rodzinna przenosi uczestników do świata piramid. Gracze planują kolejne ruchy i wspólnie sprawdzają swoje decyzje. Rozgrywka ćwiczy spostrzegawczość. Elementy mają czytelne ilustracje. Zasady pozwalają szybko rozpocząć zabawę.');
  assert.match(description, /## Najważniejsze cechy/);
  assert.match(description, /## Dla kogo/);
  assert.match(description, /## Zawartość zestawu/);
  assert.match(description, /## Informacje techniczne/);
  assert.match(description, /Wiek: 6\+/);
  assert.equal(professionalDescriptionQuality(description).professional, true);
});

test('pozorny opis z tekstem zastępczym nie przechodzi bramki jakości', () => {
  const result = professionalDescriptionQuality('Krótki wstęp o produkcie.\\n\\n## Najważniejsze cechy\\n• Pierwsza potwierdzona cecha\\n• Druga potwierdzona cecha');
  assert.equal(result.professional, false);
  assert.equal(result.placeholder, true);
});

test('edytor pokazuje niezależne pola sklepu, Allegro i Von Halsky', async () => {
  const source = await readFile('src/frontend/12-product-editor-workspace.js', 'utf8');
  assert.match(source, /name="opisKrotki"/);
  assert.match(source, /name="opis"/);
  assert.match(source, /name="allegroShortDescription"/);
  assert.match(source, /name="allegroDescription"/);
  assert.match(source, /name="vonHalskyTitle"/);
  assert.match(source, /name="vonHalskyShortDescription"/);
  assert.match(source, /name="vonHalskyDescription"/);
  assert.match(source, /Na ekranie pozostaje tylko jego formularz, kontrola kompletności i rzeczywisty podgląd klienta/);
  assert.match(source, /function productEditorAktywujKanal/);
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
  const [editor, workspace, cloud] = await Promise.all([
    readFile('src/frontend/12-product-editor.js', 'utf8'),
    readFile('src/frontend/12-product-editor-workspace.js', 'utf8'),
    readFile('src/frontend/03-cloud-sync.js', 'utf8'),
  ]);
  assert.match(editor, /const change=produktRoznicaCentralnegoZapisu\(product,previous\)/);
  assert.match(editor, /fields:change\.fields/);
  assert.match(editor, /remove:change\.remove/);
  assert.match(editor, /result\?\.confirmed!==true/);
  assert.match(workspace, /p\.contentEditorial=\{\.\.\.\(p\.contentEditorial\|\|\{\}\)/);
  assert.match(editor, /allegroShortDescription/);
  assert.match(editor, /allegroDescription/);
  assert.match(editor, /vonHalskyShortDescription/);
  assert.match(editor, /vonHalskyDescription/);
  assert.match(cloud, /allegroDescriptionSource:"agent-independent-allegro-content"/);
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
