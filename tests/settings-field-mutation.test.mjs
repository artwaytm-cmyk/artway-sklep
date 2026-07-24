import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSettingsFieldMutationHandler } from '../src/backend/lib/domain/settings-field-mutation.mjs';

function harness(initial) {
  let current = { value: structuredClone(initial), etag: `v${initial.rev}`, exists: true };
  let writes = 0;
  const handler = createSettingsFieldMutationHandler({
    isAdmin: () => true,
    readVersioned: async () => structuredClone(current),
    writeIfVersion: async (_key, value, version) => {
      writes++;
      if (version.etag !== current.etag) return { modified: false };
      current = { value: structuredClone(value), etag: `v${value.rev}`, exists: true };
      return { modified: true };
    },
    respond: (body, status = 200) => ({ body, status }),
    sanitizeSettings: (value) => structuredClone(value),
  });
  return { handler, get current() { return current; }, get writes() { return writes; } };
}

test('zmiana jednego pola ustawień nie nadpisuje pozostałej konfiguracji', async () => {
  const store = harness({
    rev: 12,
    updated_at: '2026-07-24T10:00:00.000Z',
    data: {
      artway_ustawienia: {
        kosztPaczkomat: '12',
        kosztKurierInpost: '20',
        kody: { START5: 5 },
        wyglad: { density: 'compact' },
      },
      artway_stany: { 31: 8 },
    },
  });
  const request = { method: 'POST', json: async () => ({ mutationId: 'delivery-1', changes: { kosztPaczkomat: '18' }, expectedRev: 4 }) };
  const response = await store.handler(request, new URL('https://artwaytm.pl/api/store?action=settings-field-mutation'));
  assert.equal(response.status, 200);
  assert.equal(store.current.value.data.artway_ustawienia.kosztPaczkomat, '18');
  assert.equal(store.current.value.data.artway_ustawienia.kosztKurierInpost, '20');
  assert.deepEqual(store.current.value.data.artway_ustawienia.kody, { START5: 5 });
  assert.deepEqual(store.current.value.data.artway_stany, { 31: 8 });
  assert.equal(response.body.authoritative.values.kosztPaczkomat, '18');
  assert.equal(response.body.rebased, true);
});

test('usunięcie rabatu zapisuje pustą regułę dokładnie raz i zwraca potwierdzenie serwera', async () => {
  const store = harness({
    rev: 8,
    data: { artway_ustawienia: { kody: { START5: 5 }, kodyRabatoweZaawansowane: [{ kod: 'START5' }], promocjaGlowna: 'START5' } },
  });
  const body = { mutationId: 'discount-remove-1', changes: { kody: {}, kodyRabatoweZaawansowane: [], promocjaGlowna: '' } };
  const first = await store.handler({ method: 'POST', json: async () => body }, new URL('https://artwaytm.pl/api/store?action=settings-field-mutation'));
  const writesAfterFirst = store.writes;
  const duplicate = await store.handler({ method: 'POST', json: async () => body }, new URL('https://artwaytm.pl/api/store?action=settings-field-mutation'));
  assert.equal(first.status, 200);
  assert.deepEqual(store.current.value.data.artway_ustawienia.kody, {});
  assert.deepEqual(store.current.value.data.artway_ustawienia.kodyRabatoweZaawansowane, []);
  assert.equal(store.current.value.data.artway_ustawienia.promocjaGlowna, '');
  assert.equal(duplicate.body.duplicatePrevented, true);
  assert.equal(store.writes, writesAfterFirst);
  assert.deepEqual(duplicate.body.authoritative.values.kody, {});
});

test('każdy formularz ustawień korzysta z trwałej kolejki i atomowego endpointu', () => {
  const sync = fs.readFileSync(new URL('../src/frontend/03b-settings-field-mutations.js', import.meta.url), 'utf8');
  const settings = fs.readFileSync(new URL('../src/frontend/09-seo.js', import.meta.url), 'utf8');
  const discounts = fs.readFileSync(new URL('../src/frontend/15c-campaign-studio-pro.js', import.meta.url), 'utf8');
  assert.match(sync, /CHMURA_MUTACJE_POL_USTAWIEN_KEY/);
  assert.match(sync, /settings-field-mutation/);
  assert.match(sync, /authoritative/);
  assert.match(settings, /chmuraDodajMutacjePolUstawien\(zmiany,usunKlucze\)/);
  assert.match(settings, /Zapisane na serwerze i aktywne wszędzie/);
  assert.match(discounts, /await zapiszCzescUstawien\(\{kodyRabatoweZaawansowane:unique,kody:legacy,promocjaGlowna/);
});

test('pasek sklepu usuwa tekst kodu po wycofaniu ostatniej promocji', () => {
  const source = fs.readFileSync(new URL('../src/frontend/01-config-and-catalog.js', import.meta.url), 'utf8');
  assert.match(source, /const kodWPasie=/);
  assert.match(source, /else\{\s*t=t\.replace\([\s\S]{0,300}🎁/);
  for (const page of ['index.html', 'regulamin/index.html', 'zwroty/index.html', 'kontakt/index.html', 'dostawa/index.html', 'prywatnosc/index.html']) {
    const html = fs.readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
    assert.doesNotMatch(html, /START5/);
  }
});
