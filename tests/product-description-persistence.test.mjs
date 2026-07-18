import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('edytor produktu ma niezależny opis krótki i długi oraz tytuł Allegro', async () => {
  const source = await readFile('src/frontend/12-customers-and-inventory.js', 'utf8');
  assert.match(source, /name="opisKrotki"/);
  assert.match(source, /name="opis"/);
  assert.match(source, /Opis długi/);
  assert.match(source, /name="allegroTitle"/);
});

test('poprawa Allegro zapisuje oba opisy i układ w kartotece serwerowej', async () => {
  const source = await readFile('src/frontend/03-cloud-sync.js', 'utf8');
  assert.match(source, /allegroDescriptionSource:"admin-allegro-improve"/);
  assert.match(source, /opisKrotki:d\.shortDescription/);
  assert.match(source, /opis:d\.fullDescription/);
  assert.match(source, /cloudSaved=await chmuraZapiszUstawienia/);
});

test('odświeżenie linku producenta uzupełnia tylko brakujące opisy', async () => {
  const source = await readFile('src/frontend/12-customers-and-inventory.js', 'utf8');
  assert.match(source, /missing=\{[^\n]+opisKrotki:s\.opisKrotki\|\|"",opis:s\.opis\|\|""/);
  const force = source.match(/canonicalUrl=s\.sourceUrl[^\n]+force=\{([^\n]+)\}/)?.[1] || '';
  assert.ok(force);
  assert.doesNotMatch(force, /opisKrotki:|opis:/);
});

test('krótki opis Allegro zachowuje własną wersję zamiast skrótu opisu długiego', async () => {
  const source = await readFile('src/frontend/11-allegro-and-orders.js', 'utf8');
  assert.match(source, /safeShort=improved\.shortDescription\|\|p\.opisKrotki/);
});
