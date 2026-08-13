import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('chwilowy błąd połączenia nie wylogowuje administratora', async () => {
  const session = await readFile('src/frontend/07b-shipping-integrations.js', 'utf8');
  const restore = session.slice(session.indexOf('async function odtworzSesjeCentralna'), session.indexOf('function odswiezPoCichejSynchronizacji'));
  assert.match(restore, /const wygaslaSesja=e\?\.code==="auth"\|\|e\?\.status===401\|\|e\?\.status===403/);
  assert.match(restore, /if\(!wygaslaSesja\)[\s\S]*?logowanie lokalne pozostaje aktywne[\s\S]*?return false/);
  assert.match(restore, /throw Object\.assign\(new Error\("Sesja nie jest aktywna"\),\{code:"auth",status:401\}\)/);
  assert.ok(restore.indexOf('if(!wygaslaSesja)') < restore.indexOf('ustawSesje(null)'));
});

test('SSR korzysta z HTML aktywnego wydania zamiast starego pliku źródłowego', async () => {
  const releaseDir = await mkdtemp(path.join(tmpdir(), 'artway-release-'));
  const previous = process.env.ARTWAY_CURRENT_RELEASE;
  try {
    await writeFile(path.join(releaseDir, 'release.json'), JSON.stringify({ releaseId: 'test-release-current' }));
    const source = await readFile('index.html', 'utf8');
    await writeFile(path.join(releaseDir, 'index.html'), source.replace(/<meta name="artway-version" content="[^"]*">/, '<meta name="artway-version" content="test-release-current">'));
    process.env.ARTWAY_CURRENT_RELEASE = releaseDir;
    const renderer = await import(`../src/backend/lib/domain/storefront-seo-renderer.mjs?active-release=${Date.now()}`);
    const html = await (await renderer.renderStorefrontSeoPage(new Request('https://artwaytm.pl/o-nas'))).text();
    assert.match(html, /<meta name="artway-version" content="test-release-current">/);
  } finally {
    if (previous === undefined) delete process.env.ARTWAY_CURRENT_RELEASE;
    else process.env.ARTWAY_CURRENT_RELEASE = previous;
    await rm(releaseDir, { recursive: true, force: true });
  }
});

test('błąd pracownika kolejki jest przechwytywany i ponawiany bez wyłączenia backendu', async () => {
  const queue = await readFile('src/backend/lib/domain/allegro-preparation-postgres-queue.mjs', 'utf8');
  assert.match(queue, /workerPromise = Promise\.resolve\(\)\.then\(run\)\.then/);
  assert.match(queue, /\.catch\(\(error\) => \{/);
  assert.match(queue, /scheduleWorkerRetry\(\)/);
  assert.match(queue, /allegro_preparation_worker_retry/);
});
