import test from 'node:test';
import assert from 'node:assert/strict';
import { createStoreDataRoute } from '../src/backend/lib/store-data-route.mjs';

function dependencies(overrides = {}) {
  return {
    odpowiedz: (body, status = 200) => ({ body, status }),
    czyAdmin: () => true,
    czytaj: async (key, fallback) => fallback,
    productLinkImport: { payload: async () => ({ imported_catalog_rev: 'r1', imported_catalog_count: 0 }) },
    ustawieniaPubliczneBezDanychPrywatnych: (value) => value,
    czytajUsunieteZamowienia: async () => [],
    filtrujNieusunieteZamowienia: (items) => items,
    oczyscUstawienia: (value) => value || {},
    tekst: (value, max = 400) => String(value || '').slice(0, max),
    czytajWersjonowane: async (key) => ({ value: { items: key === 'users' ? [{ email: 'admin@example.test', rola: 'admin' }] : [], updated_at: '2026-07-21T00:00:00Z' }, etag: '"7"', exists: true }),
    czytajUstawieniaBazowe: async () => ({ data: { artway_ustawienia: { nazwa: 'Artway' } }, rev: 12, updated_at: '2026-07-21T00:00:00Z' }),
    czytajUstawieniaPrzyrostowo: async (fallback, options) => ({ value: { ...options.base, data: { ...options.base.data, artway_stany: { 10: 3 } } }, domainVersions: { artway_stany: 9 }, changedKeys: ['artway_stany'] }),
    publicUser: (user) => ({ email: user.email, rola: user.rola }),
    ...overrides,
  };
}

test('pull zwraca tylko przyrost domen i bez ciężkich danych administratora', async () => {
  let deltaOptions = null;
  const deps = dependencies({ czytajUstawieniaPrzyrostowo: async (fallback, options) => { deltaOptions = options; return { value: { ...options.base, data: { ...options.base.data, artway_stany: { 10: 3 } } }, domainVersions: { artway_stany: 9 }, changedKeys: ['artway_stany'] }; } });
  const route = createStoreDataRoute(deps), request = { method: 'GET' };
  const result = await route(request, new URL('https://artwaytm.pl/api/store?action=pull&settingsRev=11&settingsDomains=%7B%22artway_stany%22%3A8%7D&adminData=0'), 'pull');
  assert.deepEqual(deltaOptions.versions, { artway_stany: 8 });
  assert.deepEqual(result.body.settings_domain_versions, { artway_stany: 9 });
  assert.deepEqual(result.body.settings_changed_keys, ['artway_stany']);
  assert.equal(result.body.orders, undefined);
  assert.equal(result.body.users, undefined);
  assert.equal(result.body.admin, true);
});

test('publiczny bootstrap centralnego katalogu pomija ciężkie mapy produktów', async () => {
  let deltaOptions = null;
  const deps = dependencies({ czyAdmin: () => false, czytajUstawieniaPrzyrostowo: async (fallback, options) => { deltaOptions = options; return { value: options.base, domainVersions: {}, changedKeys: [] }; } });
  const route = createStoreDataRoute(deps);
  const result = await route({ method: 'GET' }, new URL('https://artwaytm.pl/api/store?action=pull&catalogMode=central&adminData=0'), 'pull');
  assert.equal(result.body.catalog_central, true);
  assert.ok(deltaOptions.excludeKeys.includes('artway_produkty_edytowane'));
  assert.ok(deltaOptions.excludeKeys.includes('artway_produkty_dodane'));
  assert.equal(result.body.orders, undefined);
});

test('słownik użytkowników ma osobną wersjonowaną kolejkę', async () => {
  const route = createStoreDataRoute(dependencies()), request = { method: 'GET' };
  const first = await route(request, new URL('https://artwaytm.pl/api/store?action=store-users-admin'), 'store-users-admin');
  assert.equal(first.body.usersVersion, '7');
  assert.deepEqual(first.body.users, [{ email: 'admin@example.test', rola: 'admin' }]);
  const unchanged = await route(request, new URL('https://artwaytm.pl/api/store?action=store-users-admin&usersVersion=7&count=1'), 'store-users-admin');
  assert.equal(unchanged.body.unchanged, true);
  assert.equal(unchanged.body.users, undefined);
});
