import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { ASSET_BUNDLES, buildAssets } from '../scripts/build-assets.mjs';

test('wygenerowane assets odpowiadają modułom źródłowym', async () => {
  await assert.doesNotReject(() => buildAssets({ check: true }));
});

test('moduły źródłowe mają kontrolowany rozmiar i jednoznaczną kolejność', async () => {
  const sources = ASSET_BUNDLES.flatMap((bundle) => bundle.sources);
  assert.equal(new Set(sources).size, sources.length);
  for (const source of sources) {
    const content = await readFile(source, 'utf8');
    assert.ok(content.trim().length > 0, `${source} nie może być pusty`);
    assert.ok(Buffer.byteLength(content) <= 300_000, `${source} przekroczył budżet 300 kB; podziel domenę`);
    const lines = content.split('\n').length;
    assert.ok(lines <= 2600, `${source} ma ${lines} linii; podziel domenę na mniejsze moduły`);
  }
});

test('główny backend pozostaje poniżej budżetu migracyjnego', async () => {
  const file = await stat('netlify/functions/lib/store-app.mjs');
  assert.ok(file.size < 500_000, `store-app.mjs urósł do ${file.size} B; wydziel kolejną domenę`);
});

test('pierwsze wejście klienta nie pobiera ciężkiego panelu administratora', async () => {
  const publicBundle = ASSET_BUNDLES.find((bundle) => bundle.output === 'assets/app.js');
  const adminBundle = ASSET_BUNDLES.find((bundle) => bundle.output === 'assets/admin.js');
  const publicJs = await stat('assets/app.js');
  const publicCss = await stat('assets/styles.css');
  assert.ok(publicBundle && adminBundle, 'konfiguracja musi zawierać osobny pakiet sklepu i panelu');
  assert.ok(!publicBundle.sources.some((source) => adminBundle.sources.includes(source)), 'kod panelu nie może wejść do pakietu klienta');
  assert.ok(publicJs.size < 500_000, `początkowy JavaScript urósł do ${publicJs.size} B; moduły panelu muszą pozostać ładowane na żądanie`);
  assert.ok(publicCss.size < 70_000, `początkowy CSS urósł do ${publicCss.size} B; style panelu muszą pozostać ładowane na żądanie`);
});

test('HTML startowy ma komplet podstaw technicznego SEO', async () => {
  const html = await readFile('index.html', 'utf8');
  for (const marker of ['name="description"', 'name="robots"', 'property="og:site_name"', 'name="twitter:card"', 'type="application/ld+json"', '<script defer src="/assets/app.js']) {
    assert.ok(html.includes(marker), `index.html nie zawiera: ${marker}`);
  }
  assert.ok(!html.includes('sklep wielobranżowy'), 'opis startowy nie może reklamować nieaktualnego asortymentu');
});
