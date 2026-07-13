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
