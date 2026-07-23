#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { acquireDeploymentLock, deployStaticRelease } from './lib/atomic-release-manager.mjs';

function argument(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] || '') : fallback;
}

const sourceRoot = path.resolve(argument('source', process.cwd()));
const releasesRoot = path.resolve(argument('releases-root', process.env.ARTWAY_RELEASES_ROOT || '/srv/artway/releases'));
const currentLink = path.resolve(argument('current-link', process.env.ARTWAY_CURRENT_RELEASE || path.join(releasesRoot, 'current')));
const origin = argument('origin', process.env.ARTWAY_PUBLIC_ORIGIN || 'https://artwaytm.pl').replace(/\/$/, '');
const keep = Math.max(3, Math.min(30, Number(argument('keep', '8')) || 8));
const commit = argument('commit') || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim();
const version = String(execFileSync('git', ['show', '-s', '--format=%cd', '--date=format:%Y%m%d-%H%M%S', commit], { cwd: sourceRoot, encoding: 'utf8' })).trim();
const releaseId = argument('release', `${version}-${commit.slice(0, 12)}`);
const backendService = argument('backend-service', process.env.ARTWAY_BACKEND_SERVICE || 'artway-backend.service');

async function fetchJson(url, timeoutMs = 8000) {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`${url} zwrócił HTTP ${response.status}`);
  return response.json();
}

async function productionHealthCheck(manifest) {
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const [backend, release] = await Promise.all([
        fetchJson(`${origin}/healthz?release=${encodeURIComponent(manifest.releaseId)}&attempt=${attempt}`),
        fetchJson(`${origin}/release.json?release=${encodeURIComponent(manifest.releaseId)}&attempt=${attempt}`),
      ]);
      if (backend?.ok !== true) throw new Error('Backend nie potwierdził stanu OK.');
      if (release?.releaseId !== manifest.releaseId) throw new Error(`Nginx nadal obsługuje wydanie ${release?.releaseId || 'nieznane'}.`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 8) await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }
  throw lastError || new Error('Kontrola zdrowia nie powiodła się.');
}

function restartProductionBackend() {
  if (!backendService || backendService === 'none') return;
  if (!/^[A-Za-z0-9_.@-]+$/.test(backendService)) throw new Error('Nieprawidłowa nazwa usługi backendu.');
  execFileSync('sudo', ['-n', 'systemctl', 'restart', backendService], { stdio: 'inherit' });
}

let releaseLock;
try {
  execFileSync('npm', ['run', 'build:check'], { cwd: sourceRoot, stdio: 'inherit' });
  releaseLock = await acquireDeploymentLock(releasesRoot);
  // Backend działa z kontrolowanego katalogu roboczego, a statyczny frontend z
  // atomowego symlinku. Restart przed przełączeniem gwarantuje, że health-check
  // sprawdza bieżący kod API, a nie proces pozostawiony po poprzednim wdrożeniu.
  restartProductionBackend();
  const result = await deployStaticRelease({ sourceRoot, releasesRoot, currentLink, releaseId, commit, healthCheck: productionHealthCheck, keep });
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
} catch (error) {
  console.error(`❌ ${error?.message || error}`);
  process.exitCode = 1;
} finally {
  if (releaseLock) await releaseLock();
}
