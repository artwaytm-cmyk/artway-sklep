import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { deployStaticRelease, REQUIRED_PUBLIC_FILES } from '../scripts/lib/atomic-release-manager.mjs';

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

async function fixture(root, version) {
  await mkdir(root, { recursive: true });
  for (const relative of REQUIRED_PUBLIC_FILES) {
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    let content = `${relative} ${version}`;
    if (relative === 'index.html') content = `<html><head><meta name="artway-version" content="${version}"><link rel="stylesheet" href="/assets/styles.css?v=${version}"></head><body><script src="/assets/app.js?v=${version}"></script></body></html>`;
    if (relative === 'sw.js') content = `const CACHE_NAME="artway-admin-${version}";\nconst APP_SHELL=["/assets/styles.css?v=${version}","/assets/app.js?v=${version}"];`;
    if (relative === 'products.json') content = '[]';
    if (relative === 'manifest.webmanifest') content = '{}';
    await writeFile(file, content);
  }
}

test('publikacja przełącza pełne wydanie jednym symlinkiem', async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'artway-release-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const source = path.join(temp, 'source'), releases = path.join(temp, 'releases'), current = path.join(releases, 'current');
  await fixture(source, '2026.07.22.30');
  const result = await deployStaticRelease({
    sourceRoot: source,
    releasesRoot: releases,
    currentLink: current,
    releaseId: 'release-one',
    commit: 'abc123',
    healthCheck: async (manifest) => assert.equal(manifest.releaseId, 'release-one'),
  });
  assert.equal(path.basename(await realpath(current)), 'release-one');
  assert.equal(JSON.parse(await readFile(path.join(current, 'release.json'), 'utf8')).commit, 'abc123');
  assert.match(await readFile(path.join(current, 'index.html'), 'utf8'), /artway-version" content="release-one"/);
  assert.match(await readFile(path.join(current, 'index.html'), 'utf8'), /app\.js\?v=release-one/);
  assert.match(await readFile(path.join(current, 'sw.js'), 'utf8'), /artway-admin-release-one/);
  assert.equal(result.status, 'active');
});

test('nieudany health-check automatycznie przywraca poprzednią wersję', async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'artway-rollback-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const source = path.join(temp, 'source'), releases = path.join(temp, 'releases'), current = path.join(releases, 'current');
  await fixture(source, '2026.07.22.31');
  await deployStaticRelease({ sourceRoot: source, releasesRoot: releases, currentLink: current, releaseId: 'release-good', commit: 'good123', healthCheck: async () => {} });
  await writeFile(path.join(source, 'robots.txt'), 'new version');
  await assert.rejects(
    deployStaticRelease({
      sourceRoot: source,
      releasesRoot: releases,
      currentLink: current,
      releaseId: 'release-bad',
      commit: 'bad123',
      healthCheck: async (manifest, options = {}) => {
        if (manifest.releaseId === 'release-bad' && !options.rollback) throw new Error('symulowana awaria');
      },
    }),
    /przywrócono poprzednią wersję/,
  );
  assert.equal(path.basename(await realpath(current)), 'release-good');
  const failure = JSON.parse(await readFile(path.join(releases, 'release-bad', 'failed-deployment.json'), 'utf8'));
  assert.equal(failure.rolledBackTo, 'release-good');
});

test('produkcja i CI korzystają z atomowej bramki publikacji', async () => {
  const nginx = await readFile(path.join(projectRoot, 'ops/nginx/artway-production.conf'), 'utf8');
  const workflow = await readFile(path.join(projectRoot, '.github/workflows/ci.yml'), 'utf8');
  const deployScript = await readFile(path.join(projectRoot, 'scripts/deploy-atomic-release.mjs'), 'utf8');
  const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.match(nginx, /root \/srv\/artway\/releases\/current;/);
  assert.match(workflow, /npm run verify/);
  assert.match(workflow, /npm run audit:architecture/);
  assert.match(workflow, /npm audit --audit-level=high/);
  assert.equal(packageJson.scripts['deploy:atomic'], 'node scripts/deploy-atomic-release.mjs');
  assert.match(deployScript, /systemctl', 'restart', backendService/);
  assert.match(deployScript, /restartProductionBackend\(\);[\s\S]*deployStaticRelease/);
});

test('retencja nigdy nie usuwa katalogów ze starszych systemów publikacji', async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'artway-retention-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const source = path.join(temp, 'source'), releases = path.join(temp, 'releases'), current = path.join(releases, 'current');
  await fixture(source, '2026.07.22.32');
  const legacy = path.join(releases, 'public-before-legacy');
  await mkdir(legacy, { recursive: true });
  await writeFile(path.join(legacy, 'index.html'), 'historyczna kopia');
  for (let index = 1; index <= 4; index += 1) {
    await deployStaticRelease({ sourceRoot: source, releasesRoot: releases, currentLink: current, releaseId: `managed-${index}`, commit: `commit-${index}`, keep: 3, healthCheck: async () => {} });
  }
  assert.equal(await readFile(path.join(legacy, 'index.html'), 'utf8'), 'historyczna kopia');
  assert.equal(path.basename(await realpath(current)), 'managed-4');
});
