import assert from 'node:assert/strict';
import test from 'node:test';
import { createSiteReleaseCenterRoute } from '../src/backend/lib/site-release-center-route.mjs';

const clone = (value) => value === undefined ? undefined : structuredClone(value);

function fixture() {
  const records = new Map([
    ['settings', { data: { artway_ustawienia: { heroTytul: 'Stary tytuł', darmowaDostawaOd: 150 } }, rev: 1, updated_at: '2026-08-09T08:00:00.000Z' }],
  ]);
  const versions = new Map([['settings', 1]]);
  const products = new Map([['100', { id: '100', nazwa: 'Puzzle', cena: 20, opis: 'Stary opis' }]]);
  const read = async (key, fallback) => clone(records.has(key) ? records.get(key) : fallback);
  const readVersioned = async (key, fallback) => ({ value: await read(key, fallback), etag: String(versions.get(key) || 0), exists: records.has(key) });
  const writeIfVersion = async (key, value, expected) => {
    if (String(versions.get(key) || 0) !== String(expected?.etag || 0)) return { modified: false };
    records.set(key, clone(value)); versions.set(key, (versions.get(key) || 0) + 1);
    return { modified: true };
  };
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const catalog = {
    get: async (id) => clone(products.get(String(id)) || null),
    patchProductFields: async (id, fields, remove, options = {}) => {
      const key = String(id), current = products.get(key);
      if (!current) return { updated: false, reason: 'not_found' };
      const conflicts = Object.entries(options.expectedFields || {}).filter(([field, expected]) => {
        const present = Object.hasOwn(current, field);
        return present !== (expected?.present === true) || (present && !same(current[field], expected.value));
      });
      if (conflicts.length) return { updated: false, reason: 'field_conflict', conflicts: conflicts.map(([field]) => field) };
      const next = { ...current, ...clone(fields) };
      for (const field of remove || []) delete next[field];
      products.set(key, next);
      return { updated: true, product: clone(next), mutationId: options.mutationId };
    },
  };
  const respond = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
  const route = createSiteReleaseCenterRoute({ read, readVersioned, writeIfVersion, catalog, respond, isAdmin: (request) => request.headers.get('x-test-admin') === '1', sessionOf: () => ({ email: 'admin@artwaytm.pl' }) });
  const call = async (action, { method = 'GET', body, admin = true, query = '' } = {}) => {
    const url = new URL(`https://artwaytm.pl/api/store?action=${action}${query}`);
    const headers = { 'content-type': 'application/json' };
    if (admin) headers['x-test-admin'] = '1';
    const response = await route(new Request(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), url, action);
    return { response, data: await response.json() };
  };
  return { records, versions, products, route, call };
}

test('wersja robocza przechowuje układ i cenę bez zmiany strony klientów', async () => {
  const previous = process.env.ARTWAY_SITE_PREVIEW_SECRET;
  process.env.ARTWAY_SITE_PREVIEW_SECRET = 'site-release-test-secret';
  const { records, products, call } = fixture();
  try {
    let result = await call('site-release-draft-settings', { method: 'POST', body: { changes: { heroTytul: 'Nowy tytuł' } } });
    assert.equal(result.response.status, 200);
    result = await call('site-release-draft-products', { method: 'POST', body: { operations: [{ productId: '100', fields: { cena: 24.99 } }] } });
    assert.equal(result.data.state.draft.summary.settings, 1);
    assert.equal(result.data.state.draft.summary.products, 1);
    assert.equal(records.get('settings').data.artway_ustawienia.heroTytul, 'Stary tytuł');
    assert.equal(products.get('100').cena, 20);

    const tokenResult = await call('site-release-preview-token', { method: 'POST', body: {} });
    const preview = await call('site-release-preview', { admin: false, query: `&token=${encodeURIComponent(tokenResult.data.token)}` });
    assert.equal(preview.response.status, 200);
    assert.equal(preview.data.draft.settingsPatch.heroTytul, 'Nowy tytuł');
    assert.equal(preview.data.draft.productPatches['100'].fields.cena, 24.99);
    const forbiddenEditor = await call('site-release-preview', { admin: false, query: `&editor=1&token=${encodeURIComponent(tokenResult.data.token)}` });
    assert.equal(forbiddenEditor.response.status, 401);
    assert.equal(forbiddenEditor.data.code, 'auth');
    const adminEditor = await call('site-release-preview', { query: `&editor=1&token=${encodeURIComponent(tokenResult.data.token)}` });
    assert.equal(adminEditor.response.status, 200);
  } finally {
    if (previous === undefined) delete process.env.ARTWAY_SITE_PREVIEW_SECRET;
    else process.env.ARTWAY_SITE_PREVIEW_SECRET = previous;
  }
});

test('pierwszy token podglądu zapisuje wersję roboczą i pozostaje ważny', async () => {
  const previous = process.env.ARTWAY_SITE_PREVIEW_SECRET;
  process.env.ARTWAY_SITE_PREVIEW_SECRET = 'site-release-first-preview-secret';
  const { records, call } = fixture();
  try {
    assert.equal(records.has('site_release_center_v1'), false);
    const tokenResult = await call('site-release-preview-token', { method: 'POST', body: {} });
    assert.equal(tokenResult.response.status, 200);
    assert.equal(records.has('site_release_center_v1'), true);
    const savedDraftId = records.get('site_release_center_v1').draft.id;

    const preview = await call('site-release-preview', { admin: false, query: `&token=${encodeURIComponent(tokenResult.data.token)}` });
    assert.equal(preview.response.status, 200);
    assert.equal(preview.data.draft.id, savedDraftId);

    const state = await call('site-release-state');
    assert.equal(state.data.state.draft.id, savedDraftId);
  } finally {
    if (previous === undefined) delete process.env.ARTWAY_SITE_PREVIEW_SECRET;
    else process.env.ARTWAY_SITE_PREVIEW_SECRET = previous;
  }
});

test('jedna publikacja udostępnia układ i ceny oraz zapisuje historię i bezpieczne cofnięcie', async () => {
  const { records, products, call } = fixture();
  await call('site-release-draft-settings', { method: 'POST', body: { changes: { heroTytul: 'Wydanie sierpniowe' } } });
  await call('site-release-draft-products', { method: 'POST', body: { operations: [{ productId: '100', fields: { cena: 25 } }] } });
  const published = await call('site-release-publish', { method: 'POST', body: { name: 'Nowy układ i ceny', confirm: true } });
  assert.equal(published.response.status, 200);
  assert.equal(records.get('settings').data.artway_ustawienia.heroTytul, 'Wydanie sierpniowe');
  assert.equal(products.get('100').cena, 25);
  assert.equal(published.data.state.history.length, 1);
  assert.equal(published.data.state.draft.summary.settings, 0);

  const rollback = await call('site-release-rollback-draft', { method: 'POST', body: { releaseId: published.data.release.id } });
  assert.equal(rollback.response.status, 200);
  assert.equal(rollback.data.state.draft.settingsPatch.heroTytul, 'Stary tytuł');
  assert.equal(rollback.data.state.draft.productPatches['100'].fields.cena, 20);
  assert.equal(records.get('settings').data.artway_ustawienia.heroTytul, 'Wydanie sierpniowe');
  assert.equal(products.get('100').cena, 25);
});

test('konflikt zatrzymuje całe wydanie przed zmianą produktu', async () => {
  const { records, versions, products, call } = fixture();
  await call('site-release-draft-settings', { method: 'POST', body: { changes: { heroTytul: 'Szkic' } } });
  await call('site-release-draft-products', { method: 'POST', body: { operations: [{ productId: '100', fields: { cena: 30 } }] } });
  records.get('settings').data.artway_ustawienia.heroTytul = 'Zmiana zewnętrzna';
  versions.set('settings', versions.get('settings') + 1);
  const published = await call('site-release-publish', { method: 'POST', body: { name: 'Wydanie konfliktowe', confirm: true } });
  assert.equal(published.response.status, 409);
  assert.equal(published.data.code, 'site_release_live_conflict');
  assert.equal(records.get('settings').data.artway_ustawienia.heroTytul, 'Zmiana zewnętrzna');
  assert.equal(products.get('100').cena, 20);
});

test('centrum wersji wymaga administratora, a źródła budowania zawierają panel i podgląd', async () => {
  const { call } = fixture();
  assert.equal((await call('site-release-state', { admin: false })).response.status, 401);
  const { readFile } = await import('node:fs/promises');
  const build = await readFile(new URL('../scripts/build-assets.mjs', import.meta.url), 'utf8');
  const preview = await readFile(new URL('../src/frontend/01c-site-release-preview.js', import.meta.url), 'utf8');
  const shell = await readFile(new URL('../src/frontend/07-admin-shipping.js', import.meta.url), 'utf8');
  for (const marker of ['01c-site-release-preview.js', '08b-site-release-runtime.js', '15h-site-release-center.js', '13-site-release-preview.css', '41-site-release-center.css']) assert.match(build, new RegExp(marker.replaceAll('.', '\\.')));
  assert.match(preview, /Panel administratora/);
  assert.match(preview, /siteReleaseEditorOpenWorkspace\('wersje','porownanie'\)/);
  assert.doesNotMatch(shell, /siteReleaseAdminBannerHTML/);
});

test('edytor zapisuje strukturalne funkcje paska informacyjnego jako jeden szkic', async () => {
  const { records, call } = fixture();
  const configuration = {
    deliveryEnabled: true,
    shippingEnabled: true,
    returnsEnabled: true,
    promotionEnabled: false,
    returnDays: 30,
  };
  const staged = await call('site-release-draft-settings', {
    method: 'POST',
    body: { changes: { pasekInfoKonfiguracja: configuration, czasWysylki: '2 dni robocze' } },
  });
  assert.equal(staged.response.status, 200);
  assert.deepEqual(staged.data.state.draft.settingsPatch.pasekInfoKonfiguracja, configuration);
  assert.equal(records.get('settings').data.artway_ustawienia.pasekInfoKonfiguracja, undefined);

  const published = await call('site-release-publish', { method: 'POST', body: { name: 'Panel informacyjny', confirm: true } });
  assert.equal(published.response.status, 200);
  assert.deepEqual(records.get('settings').data.artway_ustawienia.pasekInfoKonfiguracja, configuration);
  assert.equal(records.get('settings').data.artway_ustawienia.czasWysylki, '2 dni robocze');
});

test('edytor wizualny ma stabilne ogniskowanie, ochronę uruchomienia i pomoc Agenta AI', async () => {
  const { readFile } = await import('node:fs/promises');
  const preview = await readFile(new URL('../src/frontend/01c-site-release-preview.js', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../src/frontend/08b-site-release-runtime.js', import.meta.url), 'utf8');
  const navigation = await readFile(new URL('../src/frontend/08-admin-navigation.js', import.meta.url), 'utf8');
  const storefront = await readFile(new URL('../src/frontend/01-config-and-catalog.js', import.meta.url), 'utf8');

  assert.match(runtime, /__artwaySiteEditorOpening/);
  assert.match(runtime, /__artwaySiteEditorClickBound/);
  assert.match(navigation, /personalizacjaFocusujElement/);
  assert.match(navigation, /data-banner-editor-id/);
  assert.match(preview, /agent-specialist-run/);
  assert.match(preview, /Agent tworzy szkic — nigdy nie publikuje sam/);
  assert.match(preview, /data-site-release-quick-form="info"/);
  assert.match(preview, /Dostawa i płatności/);
  assert.match(storefront, /pasekInfoKonfiguracja/);
});
