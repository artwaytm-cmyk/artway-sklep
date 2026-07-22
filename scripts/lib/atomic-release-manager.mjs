import crypto from 'node:crypto';
import { appendFile, cp, lstat, mkdir, open, readFile, readdir, realpath, rename, rm, stat, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PUBLIC_ENTRIES = Object.freeze([
  'index.html',
  'assets',
  'icons',
  'manifest.webmanifest',
  'products.json',
  'robots.txt',
  'sw.js',
  'kontakt',
  'regulamin',
  'prywatnosc',
  'dostawa',
  'zwroty',
]);
const RELEASE_MANAGER_ID = 'artway-atomic-release-v1';

export const REQUIRED_PUBLIC_FILES = Object.freeze([
  'index.html',
  'assets/app.js',
  'assets/styles.css',
  'assets/admin-core.js',
  'assets/admin-system.js',
  'manifest.webmanifest',
  'products.json',
  'robots.txt',
  'sw.js',
  'kontakt/index.html',
  'regulamin/index.html',
  'prywatnosc/index.html',
  'dostawa/index.html',
  'zwroty/index.html',
]);

function safeReleaseId(value) {
  const releaseId = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,119}$/.test(releaseId)) throw new Error('Nieprawidłowy identyfikator wydania.');
  return releaseId;
}

async function exists(file) {
  return lstat(file).then(() => true).catch((error) => {
    if (error?.code === 'ENOENT') return false;
    throw error;
  });
}

async function digest(file) {
  const data = await readFile(file);
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function collectFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Wydanie nie może zawierać symlinków: ${path.relative(root, absolute)}`);
    if (entry.isDirectory()) files.push(...await collectFiles(root, absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function releaseVersion(indexHtml) {
  return String(indexHtml).match(/<meta\s+name=["']artway-version["']\s+content=["']([^"']+)/i)?.[1] || 'unknown';
}

export async function validateStaticRelease(releaseDir, expectedReleaseId = '') {
  for (const relative of REQUIRED_PUBLIC_FILES) {
    const file = path.join(releaseDir, relative);
    const info = await stat(file).catch(() => null);
    if (!info?.isFile() || info.size < 1) throw new Error(`Wydanie nie zawiera wymaganego pliku: ${relative}`);
  }
  const indexHtml = await readFile(path.join(releaseDir, 'index.html'), 'utf8');
  for (const reference of ['/assets/app.js', '/assets/styles.css']) {
    if (!indexHtml.includes(reference)) throw new Error(`index.html nie odwołuje się do ${reference}`);
  }
  const manifest = JSON.parse(await readFile(path.join(releaseDir, 'release.json'), 'utf8'));
  if (expectedReleaseId && manifest.releaseId !== expectedReleaseId) throw new Error('Manifest wskazuje inne wydanie.');
  if (!manifest.commit || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Manifest wydania jest niekompletny.');
  return manifest;
}

async function copyPublicTree(sourceRoot, targetRoot) {
  for (const entry of PUBLIC_ENTRIES) {
    const source = path.join(sourceRoot, entry);
    if (!await exists(source)) continue;
    await cp(source, path.join(targetRoot, entry), { recursive: true, force: false, errorOnExist: true });
  }
  const rootFiles = await readdir(sourceRoot, { withFileTypes: true });
  for (const entry of rootFiles) {
    if (!entry.isFile() || !/^[a-f0-9]{32}\.txt$/i.test(entry.name)) continue;
    await cp(path.join(sourceRoot, entry.name), path.join(targetRoot, entry.name), { force: false, errorOnExist: true });
  }
}

export async function createStaticRelease({ sourceRoot, releasesRoot, releaseId, commit = 'unknown', createdAt = new Date().toISOString() }) {
  const id = safeReleaseId(releaseId);
  const root = path.resolve(releasesRoot);
  const finalDir = path.join(root, id);
  const stagingDir = path.join(root, `.staging-${id}-${process.pid}`);
  await mkdir(root, { recursive: true });
  if (await exists(finalDir)) throw new Error(`Wydanie ${id} już istnieje.`);
  await rm(stagingDir, { recursive: true, force: true });
  await mkdir(stagingDir, { recursive: false, mode: 0o755 });
  try {
    await copyPublicTree(path.resolve(sourceRoot), stagingDir);
    const indexHtml = await readFile(path.join(stagingDir, 'index.html'), 'utf8');
    const files = await collectFiles(stagingDir);
    const fileEntries = [];
    for (const file of files) {
      const info = await stat(file);
      fileEntries.push({
        path: path.relative(stagingDir, file).split(path.sep).join('/'),
        bytes: info.size,
        sha256: await digest(file),
      });
    }
    const manifest = {
      managedBy: RELEASE_MANAGER_ID,
      releaseId: id,
      version: releaseVersion(indexHtml),
      commit: String(commit || 'unknown').slice(0, 80),
      createdAt,
      files: fileEntries,
    };
    await writeFile(path.join(stagingDir, 'release.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
    await validateStaticRelease(stagingDir, id);
    await rename(stagingDir, finalDir);
    return { releaseDir: finalDir, manifest };
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true });
    throw error;
  }
}

export async function resolveActiveRelease(currentLink) {
  const link = path.resolve(currentLink);
  const info = await lstat(link).catch(() => null);
  if (!info) return null;
  if (!info.isSymbolicLink()) throw new Error(`${link} musi być symlinkiem do aktywnego wydania.`);
  return realpath(link);
}

export async function activateRelease(currentLink, releaseDir) {
  const link = path.resolve(currentLink);
  const target = path.resolve(releaseDir);
  const relativeTarget = path.relative(path.dirname(link), target) || '.';
  const temporaryLink = `${link}.next-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  await mkdir(path.dirname(link), { recursive: true });
  await symlink(relativeTarget, temporaryLink, 'dir');
  try {
    await rename(temporaryLink, link);
  } catch (error) {
    await rm(temporaryLink, { force: true });
    throw error;
  }
  const active = await realpath(link);
  if (active !== target) throw new Error('Nie udało się potwierdzić aktywnego symlinku wydania.');
  return active;
}

async function recordDeployment(releasesRoot, record) {
  const line = `${JSON.stringify(record)}\n`;
  await appendFile(path.join(releasesRoot, 'deployments.jsonl'), line, { mode: 0o600 });
  await writeFile(path.join(releasesRoot, 'last-deployment.json'), `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
}

export async function pruneStaticReleases({ releasesRoot, currentLink, keep = 8 }) {
  const active = await resolveActiveRelease(currentLink);
  const entries = await readdir(releasesRoot, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const absolute = path.join(releasesRoot, entry.name);
    if (active === absolute) continue;
    const releaseManifest = await readFile(path.join(absolute, 'release.json'), 'utf8')
      .then((value) => JSON.parse(value))
      .catch(() => null);
    // Ten katalog był używany również przez starsze, ręczne wdrożenia.
    // Retencja nie może usuwać niczego, czego nie utworzył ten manager.
    if (releaseManifest?.managedBy !== RELEASE_MANAGER_ID) continue;
    const info = await stat(absolute);
    candidates.push({ absolute, mtimeMs: info.mtimeMs });
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const removed = [];
  for (const item of candidates.slice(Math.max(0, Number(keep) - 1))) {
    await rm(item.absolute, { recursive: true, force: true });
    removed.push(path.basename(item.absolute));
  }
  return removed;
}

export async function deployStaticRelease({ sourceRoot, releasesRoot, currentLink, releaseId, commit, healthCheck, keep = 8 }) {
  if (typeof healthCheck !== 'function') throw new Error('Wdrożenie wymaga kontroli zdrowia nowej wersji.');
  const previousRelease = await resolveActiveRelease(currentLink);
  const { releaseDir, manifest } = await createStaticRelease({ sourceRoot, releasesRoot, releaseId, commit });
  await activateRelease(currentLink, releaseDir);
  try {
    await healthCheck(manifest);
  } catch (error) {
    if (previousRelease) {
      await activateRelease(currentLink, previousRelease);
      await healthCheck(JSON.parse(await readFile(path.join(previousRelease, 'release.json'), 'utf8')), { rollback: true });
    } else {
      await rm(currentLink, { force: true });
    }
    const failed = { releaseId: manifest.releaseId, failedAt: new Date().toISOString(), error: String(error?.message || error), rolledBackTo: previousRelease ? path.basename(previousRelease) : null };
    await writeFile(path.join(releaseDir, 'failed-deployment.json'), `${JSON.stringify(failed, null, 2)}\n`, { mode: 0o600 });
    await recordDeployment(releasesRoot, { ...failed, status: 'rolled_back' });
    const wrapped = new Error(`Kontrola wydania nie powiodła się; przywrócono poprzednią wersję: ${failed.error}`);
    wrapped.cause = error;
    throw wrapped;
  }
  const record = { releaseId: manifest.releaseId, version: manifest.version, commit: manifest.commit, deployedAt: new Date().toISOString(), previousRelease: previousRelease ? path.basename(previousRelease) : null, status: 'active' };
  await recordDeployment(releasesRoot, record);
  const removed = await pruneStaticReleases({ releasesRoot, currentLink, keep });
  return { ...record, releaseDir, removed };
}

export async function acquireDeploymentLock(releasesRoot, { staleAfterMs = 30 * 60 * 1000 } = {}) {
  await mkdir(releasesRoot, { recursive: true });
  const lockFile = path.join(releasesRoot, '.deploy.lock');
  const previous = await stat(lockFile).catch(() => null);
  if (previous && Date.now() - previous.mtimeMs > staleAfterMs) await rm(lockFile, { force: true });
  let handle;
  try {
    handle = await open(lockFile, 'wx', 0o600);
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error('Inne wdrożenie jest już w toku.');
    throw error;
  }
  await handle.writeFile(`${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
  await handle.close();
  return async () => rm(lockFile, { force: true });
}
