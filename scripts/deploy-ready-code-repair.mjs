#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.env.ARTWAY_CODE_REPAIR_ROOT || '/srv/artway/shop');
const stateRoot = path.resolve(process.env.ARTWAY_CODE_REPAIR_STATE_DIR || '/srv/artway/ops/code-repairs');
const markerPath = path.join(stateRoot, 'pending.json');
const allowedDirty = new Set(['ops/backup/artway-backup.sh', 'ops/postgres/pgbackrest.conf', 'ops/postgres/roles.sql', 'products.json']);
const allowedPath = (value = '') => /^(?:src\/(?:backend|frontend|styles)\/.+\.(?:js|mjs|css)|tests\/.+\.(?:js|mjs)|assets\/.+\.(?:js|css))$/.test(String(value));

function run(file, args, options = {}) {
  return String(execFileSync(file, args, { cwd: root, encoding: 'utf8', stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'], timeout: options.timeout || 120_000, env: process.env, maxBuffer: 24 * 1024 * 1024 }) || '').trim();
}

function statusPaths(raw = '') {
  return String(raw).split('\0').filter(Boolean).map((line) => line.slice(3)).filter(Boolean);
}

async function report(marker, repairStatus, fields = {}) {
  const token = String(process.env.ARTWAY_ADMIN_TOKEN || '').trim();
  if (!token) throw new Error('Brakuje tokenu kontrolera wdrożenia.');
  const response = await fetch('http://127.0.0.1:3000/api/store?action=diagnostics-code-repair-report', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify({ ids: [marker.diagnosticId], repairStatus, jobId: marker.jobId, ...fields }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Raport naprawy zwrócił HTTP ${response.status}.`);
}

async function archive(marker, folder) {
  const targetDir = path.join(stateRoot, folder);
  await mkdir(targetDir, { recursive: true });
  const target = path.join(targetDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${marker.diagnosticId}.json`);
  await writeFile(markerPath, `${JSON.stringify(marker, null, 2)}\n`, { mode: 0o600 });
  await rename(markerPath, target);
}

async function main() {
  const marker = JSON.parse(await readFile(markerPath, 'utf8'));
  if (!marker?.diagnosticId || !/^[a-f0-9]{7,64}$/i.test(marker.commit || '') || !/^[a-f0-9]{7,64}$/i.test(marker.baseCommit || '')) throw new Error('Marker naprawy kodu jest nieprawidłowy.');
  const head = run('git', ['rev-parse', 'HEAD']), parent = run('git', ['rev-parse', `${marker.commit}^`]);
  if (head !== marker.commit || parent !== marker.baseCommit) throw new Error('Repozytorium nie wskazuje dokładnie zatwierdzonej poprawki Agenta.');
  const subject = run('git', ['show', '-s', '--format=%s', marker.commit]);
  if (!subject.startsWith('Agent repair: ')) throw new Error('Commit nie pochodzi z kontrolowanego procesu naprawczego.');
  const changed = run('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', marker.commit]).split('\n').filter(Boolean);
  if (!changed.length || changed.length > 14 || changed.some((file) => !allowedPath(file))) throw new Error('Zakres plików poprawki nie spełnia polityki bezpieczeństwa.');
  if (JSON.stringify([...changed].sort()) !== JSON.stringify([...(marker.changedPaths || [])].sort())) throw new Error('Marker i commit wskazują inny zestaw plików.');
  const unexpectedDirty = statusPaths(run('git', ['status', '--porcelain=v1', '-z'])).filter((file) => !allowedDirty.has(file));
  if (unexpectedDirty.length) throw new Error(`Przed wdrożeniem wykryto inne zmiany: ${unexpectedDirty.join(', ')}`);
  const currentManifest = await readFile('/srv/artway/releases/current/release.json', 'utf8').then(JSON.parse).catch(() => ({}));
  let release = currentManifest;
  if (String(currentManifest.commit || '') !== marker.commit) {
    await report(marker, 'deploying', { commit: marker.commit, testedAt: marker.testedAt, summary: 'Kontroler ponownie uruchamia pełne testy przed atomowym wydaniem.' });
    run('npm', ['test'], { inherit: true, timeout: 35 * 60_000 });
    run('npm', ['run', 'deploy:atomic'], { inherit: true, timeout: 20 * 60_000 });
    release = JSON.parse(await readFile('/srv/artway/releases/current/release.json', 'utf8'));
    if (String(release.commit || '') !== marker.commit) throw new Error('Aktywne wydanie nie potwierdziło commita poprawki.');
  }
  const summary = `Poprawka ${marker.commit.slice(0, 12)} przeszła pełne testy, atomowe wdrożenie i kontrolę aktywnego wydania ${release.releaseId || ''}.`;
  await report(marker, 'completed', { verified: true, commit: marker.commit, release: release.releaseId || '', testedAt: marker.testedAt, summary });
  await archive({ ...marker, release: release.releaseId || '', deployedAt: new Date().toISOString(), summary }, 'completed');
  process.stdout.write(`${summary}\n`);
}

main().catch(async (error) => {
  try {
    const marker = JSON.parse(await readFile(markerPath, 'utf8'));
    const attempts = Math.max(0, Number(marker.deployAttempts) || 0) + 1;
    const updated = { ...marker, deployAttempts: attempts, lastDeployError: String(error?.message || error).slice(0, 700), lastDeployAttemptAt: new Date().toISOString() };
    await writeFile(markerPath, `${JSON.stringify(updated, null, 2)}\n`, { mode: 0o600 });
    await report(updated, attempts >= 3 ? 'failed' : 'ready', { commit: updated.commit, error: updated.lastDeployError, summary: attempts >= 3 ? 'Kontroler zatrzymał poprawkę po trzech nieudanych próbach; produkcja nie została przełączona.' : `Wdrożenie zostanie bezpiecznie ponowione (próba ${attempts}/3).` }).catch(() => {});
    if (attempts >= 3) await archive(updated, 'failed');
  } catch {}
  console.error(error?.stack || error);
  process.exitCode = 1;
});
