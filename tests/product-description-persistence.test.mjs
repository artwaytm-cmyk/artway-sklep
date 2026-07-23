import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('edytor produktu ma jedno pole opisu krótkiego i długiego używane przez wszystkie kanały', async () => {
  const source = await readFile('assets/admin.js', 'utf8');
  assert.match(source, /name="opisKrotki"/);
  assert.match(source, /name="opis"/);
  assert.match(source, /Opis długi/);
  assert.match(source, /name="allegroTitle"/);
  assert.match(source, /Jeden opis dla sklepu, Von Halsky i Allegro/);
  assert.match(source, /Agent redakcji/);
  assert.doesNotMatch(source, /<button[^>]+agentAIPoprawOpisyWFormularzu/);
  assert.doesNotMatch(source, /<button[^>]+allegroPoprawOpisyWFormularzu/);
});

test('Von Halsky i sklep mają jedną kanoniczną prezentację bez osobnych pól opisowych', async () => {
  const editor = await readFile('src/frontend/12-product-editor-workspace.js', 'utf8');
  const save = await readFile('src/frontend/12-product-editor.js', 'utf8');
  const workspace = await readFile('src/frontend/11b-von-halsky-workspace.js', 'utf8');
  assert.match(editor, /Sklep = 🐕 Von Halsky/);
  assert.match(editor, /Von Halsky nie ma już osobnego pola opisu/);
  assert.doesNotMatch(editor, /name="vonHalskyContentMode"/);
  assert.doesNotMatch(editor, /name="vonHalskyTitle"/);
  assert.doesNotMatch(editor, /name="vonHalskyShortDescription"/);
  assert.doesNotMatch(editor, /name="vonHalskyDescription"/);
  assert.match(save, /vonHalskyContentSource="store-canonical-content"/);
  assert.match(workspace, /function vonHalskyOtworzPodglad/);
  assert.match(workspace, /Podgląd oferty/);
  assert.doesNotMatch(workspace.slice(workspace.indexOf('function vonHalskyPrezentacjaProduktu'), workspace.indexOf('function vonHalskyGtin')), /opisAllegro|allegroDescription/);
});

test('panel Agenta nie wymaga ręcznego zatwierdzania treści produktu', async () => {
  const source = await readFile('assets/admin.js', 'utf8');
  assert.doesNotMatch(source, /<button[^>]+agentAISpecjalistaZatwierdzProdukt/);
  assert.match(source, /Agent ponowi redakcję automatycznie — bez klikania/);
});

test('poprawa zapisuje wspólną treść sklepu i Allegro oraz układ w kartotece serwerowej', async () => {
  const source = await readFile('src/frontend/03-cloud-sync.js', 'utf8');
  assert.match(source, /allegroDescriptionSource:"agent-editorial-shared-content"/);
  assert.match(source, /opisKrotki:d\.shortDescription/);
  assert.match(source, /opis:d\.fullDescription/);
  assert.match(source, /nazwa:d\.name/);
  assert.match(source, /allegroDescription:d\.allegroDescription/);
  assert.match(source, /contentEditorial:d\.contentEditorial/);
  assert.match(source, /cloudSaved=await chmuraZapiszUstawienia/);
});

test('odświeżenie linku zachowuje surową treść tylko jako materiał źródłowy', async () => {
  const source = await readFile('assets/admin.js', 'utf8');
  const missing = source.match(/const missing=\{([^\n]+)\};/)?.[1] || '';
  assert.match(missing, /sourceMaterial:/);
  assert.match(missing, /shortDescription:s\.opisKrotki/);
  assert.match(missing, /longDescription:s\.opis/);
  assert.doesNotMatch(missing, /(?:^|,)nazwa:s\.nazwa|(?:^|,)opisKrotki:s\.opisKrotki|(?:^|,)opis:s\.opis/);
  const force = source.match(/canonicalUrl=s\.sourceUrl[^\n]+force=\{([^\n]+)\}/)?.[1] || '';
  assert.ok(force);
  assert.doesNotMatch(force, /opisKrotki:|opis:/);
});

test('wspólny opis krótki nie jest zastępowany automatycznym skrótem opisu długiego', async () => {
  const source = await readFile('assets/admin.js', 'utf8');
  assert.match(source, /safeShort=improved\.storeShortDescription\|\|improved\.shortDescription\|\|p\.opisKrotki/);
});

test('synchronizacja ofert nie przywraca starego opisu Allegro do edytora produktu', async () => {
  const source = await readFile('src/backend/lib/store-app.mjs', 'utf8');
  const start = source.indexOf('async function allegroAutoMapujOfertyZKartoteka');
  const end = source.indexOf('function allegroAgentWirtualnyProduktOferty', start);
  const mapping = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(mapping, /fields\.opis\s*=/);
  assert.doesNotMatch(mapping, /fields\.opisKrotki\s*=/);
  assert.match(mapping, /sourceMaterial[\s\S]*allegroOfferDescription/);
  assert.match(mapping, /zapiszOperacjeProduktow\(pendingUpdates, now\)/);
  assert.doesNotMatch(mapping, /zapisz\('settings'/);
});

test('zapis edytora zawsze ustanawia jeden kanoniczny opis sklepu, Von Halsky i Allegro', async () => {
  const editor = await readFile('src/frontend/12-product-editor.js', 'utf8');
  const workspace = await readFile('src/frontend/12-product-editor-workspace.js', 'utf8');
  assert.match(editor, /productEditorZastosujWspolnaTresc\(p,poprzedni\)/);
  assert.match(workspace, /p\.allegroDescription=String\(p\.opis\|\|""\)/);
  assert.match(workspace, /delete p\.allegroDescriptionSections/);
  assert.match(workspace, /allegroEditorialSyncPending=true/);
  assert.match(workspace, /channels:allegroSelected\?"shared_store_allegro_von_halsky":"shared_store_von_halsky"/);
  assert.match(workspace, /targets:\{store:true,vonHalsky:true,allegro:allegroSelected\}/);
  assert.match(workspace, /p\.vonHalskyContentMode="store"/);
});

test('starszy produkt z ofertą rzeczywiście dostaje aktualne oba opisy i kolejkę synchronizacji', async () => {
  const source = await readFile('src/frontend/12-product-editor-workspace.js', 'utf8');
  const context = { allegroOfertaDlaProduktuSklepu: () => null };
  vm.createContext(context);
  vm.runInContext(source, context);
  const product = {
    id: 17,
    allegroOfferId: '123456',
    nazwa: 'Nowa nazwa',
    opisKrotki: 'Nowy opis krótki',
    opis: 'Nowy opis długi',
    allegroDescription: 'Stary opis',
    allegroDescriptionSections: [{ items: [{ type: 'TEXT', content: '<p>Stare</p>' }] }],
  };
  const result = context.productEditorZastosujWspolnaTresc(product, {
    ...product,
    opisKrotki: 'Poprzedni skrót',
    opis: 'Poprzedni opis',
  });
  assert.equal(result.allegroDescription, 'Nowy opis długi');
  assert.equal(result.opisKrotki, 'Nowy opis krótki');
  assert.equal(result.allegroShortDescription, undefined);
  assert.equal(result.allegroDescriptionSections, undefined);
  assert.equal(result.allegroEditorialSyncPending, true);
  assert.equal(result.allegroEditorialSyncState, 'queued');
  assert.equal(result.contentEditorial.channels, 'shared_store_allegro_von_halsky');
  assert.deepEqual({ ...result.contentEditorial.targets }, { store: true, vonHalsky: true, allegro: true });
  assert.equal(result.vonHalskyContentMode, 'store');
});

test('starszy własny opis Von Halsky jest od razu wyświetlany w sklepie i trafia do pól głównych przy zapisie', async () => {
  const source = await readFile('src/frontend/03-cloud-sync.js', 'utf8');
  const workspace = await readFile('src/frontend/12-product-editor-workspace.js', 'utf8');
  assert.match(source, /function wspolnaTrescProduktu/);
  assert.match(source, /vonHalskyDescription\|\|p\.opis/);
  assert.match(workspace, /legacyVonHalsky\?p\.vonHalskyDescription\|\|p\.opis/);
});

test('przygotowanie oferty nie wybiera starego opisu Allegro przed aktualnym opisem produktu', async () => {
  const publication = await readFile('src/frontend/11-allegro-product-publication.js', 'utf8');
  const actions = await readFile('src/frontend/12a-product-actions.js', 'utf8');
  assert.match(publication, /allegroFull=improved\.allegroDescription\|\|safeFull\|\|allegroTekstZBezpiecznychSekcji/);
  assert.match(actions, /allegroFull=String\(improved\.allegroDescription\|\|full\|\|allegroTekstZBezpiecznychSekcji/);
  assert.doesNotMatch(publication, /allegroTekstZBezpiecznychSekcji\(safeSections\)\|\|p\.allegroDescription/);
});
