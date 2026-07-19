import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('edytor produktu ma niezależny opis krótki i długi oraz tytuł Allegro', async () => {
  const source = await readFile('src/frontend/12-customers-and-inventory.js', 'utf8');
  assert.match(source, /name="opisKrotki"/);
  assert.match(source, /name="opis"/);
  assert.match(source, /Opis długi/);
  assert.match(source, /name="allegroTitle"/);
  assert.match(source, /Redakcja automatyczna/);
  assert.doesNotMatch(source, /<button[^>]+agentAIPoprawOpisyWFormularzu/);
  assert.doesNotMatch(source, /<button[^>]+allegroPoprawOpisyWFormularzu/);
});

test('panel Agenta nie wymaga ręcznego zatwierdzania treści produktu', async () => {
  const source = await readFile('src/frontend/10-agent-ai.js', 'utf8');
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
  const source = await readFile('src/frontend/12-customers-and-inventory.js', 'utf8');
  const missing = source.match(/const missing=\{([^\n]+)\};/)?.[1] || '';
  assert.match(missing, /sourceMaterial:/);
  assert.match(missing, /shortDescription:s\.opisKrotki/);
  assert.match(missing, /longDescription:s\.opis/);
  assert.doesNotMatch(missing, /(?:^|,)nazwa:s\.nazwa|(?:^|,)opisKrotki:s\.opisKrotki|(?:^|,)opis:s\.opis/);
  const force = source.match(/canonicalUrl=s\.sourceUrl[^\n]+force=\{([^\n]+)\}/)?.[1] || '';
  assert.ok(force);
  assert.doesNotMatch(force, /opisKrotki:|opis:/);
});

test('krótki opis Allegro zachowuje własną wersję zamiast skrótu opisu długiego', async () => {
  const source = await readFile('src/frontend/11-allegro-and-orders.js', 'utf8');
  assert.match(source, /safeShort=improved\.storeShortDescription\|\|improved\.shortDescription\|\|p\.opisKrotki/);
});

test('synchronizacja ofert nie przywraca starego opisu Allegro do edytora produktu', async () => {
  const source = await readFile('netlify/functions/lib/store-app.mjs', 'utf8');
  const start = source.indexOf('async function allegroAutoMapujOfertyZKartoteka');
  const end = source.indexOf('function allegroAgentWirtualnyProduktOferty', start);
  const mapping = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(mapping, /fields\.opis\s*=/);
  assert.doesNotMatch(mapping, /fields\.opisKrotki\s*=/);
  assert.match(mapping, /sourceMaterial[\s\S]*allegroOfferDescription/);
  assert.match(mapping, /const latestSettings = await czytaj\('settings'/);
});
