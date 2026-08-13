import os from 'node:os';
import path from 'node:path';
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  statfs,
  writeFile,
} from 'node:fs/promises';

const DAY_MS = 24 * 60 * 60 * 1000;
const RELEASE_MANAGER_ID = 'artway-atomic-release-v1';
const DEFAULT_ROOTS = Object.freeze({
  disk: '/srv/artway',
  releases: '/srv/artway/releases',
  currentRelease: '/srv/artway/releases/current',
  backups: '/srv/artway/backups',
  project: '/srv/artway/shop',
  temporary: '/tmp',
  status: '/srv/artway/ops/maintenance/status.json',
});

function rootsFromEnvironment(overrides = {}) {
  return {
    disk: process.env.ARTWAY_DISK_ROOT || DEFAULT_ROOTS.disk,
    releases: process.env.ARTWAY_RELEASES_ROOT || DEFAULT_ROOTS.releases,
    currentRelease: process.env.ARTWAY_CURRENT_RELEASE || DEFAULT_ROOTS.currentRelease,
    backups: process.env.ARTWAY_BACKUPS_ROOT || DEFAULT_ROOTS.backups,
    project: process.env.ARTWAY_PROJECT_ROOT || DEFAULT_ROOTS.project,
    temporary: process.env.ARTWAY_TEMP_ROOT || DEFAULT_ROOTS.temporary,
    status: process.env.ARTWAY_MAINTENANCE_STATUS || DEFAULT_ROOTS.status,
    ...overrides,
  };
}

async function exists(file) {
  return lstat(file).then(() => true).catch((error) => {
    if (error?.code === 'ENOENT') return false;
    throw error;
  });
}

async function readJson(file, fallback = null) {
  return readFile(file, 'utf8').then(JSON.parse).catch(() => fallback);
}

async function directoryUsage(root, { maxEntries = 250_000 } = {}) {
  if (!await exists(root)) return { bytes: 0, files: 0, directories: 0, truncated: false };
  const queue = [path.resolve(root)];
  let bytes = 0, files = 0, directories = 0, visited = 0;
  while (queue.length) {
    const directory = queue.pop();
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    directories += 1;
    for (const entry of entries) {
      visited += 1;
      if (visited > maxEntries) return { bytes, files, directories, truncated: true };
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) queue.push(absolute);
      else if (entry.isFile()) {
        const info = await stat(absolute).catch(() => null);
        if (info) {
          bytes += info.size;
          files += 1;
        }
      }
    }
  }
  return { bytes, files, directories, truncated: false };
}

async function activeReleasePath(currentRelease) {
  return realpath(currentRelease).catch(() => null);
}

async function releaseInventory(roots) {
  const active = await activeReleasePath(roots.currentRelease);
  const entries = await readdir(roots.releases, { withFileTypes: true }).catch(() => []);
  const releases = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const absolute = path.join(roots.releases, entry.name);
    const manifest = await readJson(path.join(absolute, 'release.json'));
    const info = await stat(absolute).catch(() => null);
    const canonical = await realpath(absolute).catch(() => path.resolve(absolute));
    releases.push({
      name: entry.name,
      path: absolute,
      active: active === canonical,
      managed: manifest?.managedBy === RELEASE_MANAGER_ID,
      createdAt: manifest?.createdAt || info?.mtime?.toISOString() || '',
      mtimeMs: info?.mtimeMs || 0,
    });
  }
  releases.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return { active, releases };
}

function memoryStatus() {
  const total = os.totalmem(), free = os.freemem();
  return {
    totalBytes: total,
    availableBytes: free,
    usedBytes: Math.max(0, total - free),
    usedPercent: total ? Math.round(((total - free) / total) * 1000) / 10 : 0,
  };
}

async function diskStatus(root) {
  const info = await statfs(root);
  const totalBytes = Number(info.blocks) * Number(info.bsize);
  const availableBytes = Number(info.bavail) * Number(info.bsize);
  const usedBytes = Math.max(0, totalBytes - availableBytes);
  return {
    totalBytes,
    usedBytes,
    availableBytes,
    usedPercent: totalBytes ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0,
  };
}

function backupHealth(status, nowMs, maxAgeHours = 36) {
  const checkedAt = status?.timestamp || status?.finished_at || status?.finishedAt || status?.checked_at || status?.checkedAt || '';
  const ageHours = checkedAt ? Math.max(0, (nowMs - Date.parse(checkedAt)) / 3_600_000) : null;
  return {
    ok: status?.status === 'ok' || status?.ok === true,
    checkedAt,
    ageHours: Number.isFinite(ageHours) ? Math.round(ageHours * 10) / 10 : null,
    stale: !Number.isFinite(ageHours) || ageHours > maxAgeHours,
    error: String(status?.error || ''),
  };
}

function candidateRecord({ absolute, root, type, reason, info, protectedItem = false }) {
  return {
    id: `${type}:${path.basename(absolute)}`,
    type,
    name: path.basename(absolute),
    relativePath: path.relative(root, absolute) || path.basename(absolute),
    absolute,
    reason,
    bytes: info?.size || 0,
    modifiedAt: info?.mtime?.toISOString() || '',
    protected: protectedItem,
  };
}

async function staleNamedEntries(root, { pattern, olderThanMs, nowMs, type, reason }) {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const candidates = [];
  for (const entry of entries) {
    if (!pattern.test(entry.name) || entry.isSymbolicLink()) continue;
    const absolute = path.join(root, entry.name);
    const info = await stat(absolute).catch(() => null);
    if (!info || nowMs - info.mtimeMs < olderThanMs || info.uid !== process.getuid()) continue;
    const usage = entry.isDirectory() ? await directoryUsage(absolute) : { bytes: info.size };
    candidates.push({ ...candidateRecord({ absolute, root, type, reason, info }), bytes: usage.bytes });
  }
  return candidates;
}

export async function buildServerCleanupPlan({
  roots: rootOverrides = {},
  now = new Date(),
  keepManagedReleases = 8,
  temporaryRetentionDays = 7,
} = {}) {
  const roots = rootsFromEnvironment(rootOverrides), nowMs = now.getTime();
  const inventory = await releaseInventory(roots);
  const candidates = [];
  candidates.push(...await staleNamedEntries(roots.releases, {
    pattern: /^\.staging-[A-Za-z0-9._-]+$/,
    olderThanMs: DAY_MS,
    nowMs,
    type: 'release-staging',
    reason: 'Niedokończone wydanie starsze niż 24 godziny',
  }));
  const managedInactive = inventory.releases.filter((entry) => entry.managed && !entry.active);
  for (const release of managedInactive.slice(Math.max(0, keepManagedReleases - 1))) {
    const info = await stat(release.path);
    const usage = await directoryUsage(release.path);
    candidates.push({
      ...candidateRecord({
        absolute: release.path,
        root: roots.releases,
        type: 'managed-release',
        reason: `Nadmiarowe wydanie atomowe; zachowywane jest ${keepManagedReleases} najnowszych`,
        info,
      }),
      bytes: usage.bytes,
    });
  }
  candidates.push(...await staleNamedEntries(roots.backups, {
    pattern: /^\.(?:incomplete|drill)-[A-Za-z0-9._-]+$/,
    olderThanMs: DAY_MS,
    nowMs,
    type: 'incomplete-backup',
    reason: 'Niedokończona operacja kopii starsza niż 24 godziny',
  }));
  candidates.push(...await staleNamedEntries(roots.temporary, {
    pattern: /^(?:artway-|playwright-artway-|artway-test-)[A-Za-z0-9._-]+$/,
    olderThanMs: Math.max(2, temporaryRetentionDays) * DAY_MS,
    nowMs,
    type: 'temporary-artifact',
    reason: `Plik techniczny projektu starszy niż ${Math.max(2, temporaryRetentionDays)} dni`,
  }));
  const active = inventory.releases.find((entry) => entry.active);
  return {
    generatedAt: now.toISOString(),
    policy: {
      managedReleases: keepManagedReleases,
      temporaryRetentionDays: Math.max(2, temporaryRetentionDays),
      localBackupRetentionDays: 30,
      monthlyBackupRetentionDays: 370,
      offsiteLocalRetentionDays: 7,
    },
    protected: {
      activeRelease: active?.name || null,
      backups: 'Kompletne kopie są obsługiwane przez osobną retencję i nie należą do tego planu.',
      unmanagedReleases: inventory.releases.filter((entry) => !entry.managed).length,
    },
    candidates: candidates.map(({ absolute, ...candidate }) => candidate),
    internalCandidates: candidates,
    totalBytes: candidates.reduce((sum, entry) => sum + Number(entry.bytes || 0), 0),
    totalItems: candidates.length,
  };
}

function candidateStillInside(candidate, roots) {
  const allowedRoot = candidate.type === 'temporary-artifact'
    ? roots.temporary
    : candidate.type === 'incomplete-backup'
      ? roots.backups
      : roots.releases;
  const relative = path.relative(path.resolve(allowedRoot), path.resolve(candidate.absolute));
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export async function executeServerCleanup(options = {}) {
  const roots = rootsFromEnvironment(options.roots || {});
  const plan = await buildServerCleanupPlan(options);
  const active = await activeReleasePath(roots.currentRelease);
  const removed = [], failed = [];
  for (const candidate of plan.internalCandidates) {
    try {
      if (!candidateStillInside(candidate, roots)) throw new Error('Ścieżka wykracza poza chroniony katalog.');
      const resolved = path.resolve(candidate.absolute);
      if (active && resolved === active) throw new Error('Aktywne wydanie jest chronione.');
      const info = await stat(resolved);
      if (info.uid !== process.getuid()) throw new Error('Plik nie należy do użytkownika usługi.');
      await rm(resolved, { recursive: info.isDirectory(), force: true });
      removed.push({ ...candidate, absolute: undefined });
    } catch (error) {
      failed.push({ id: candidate.id, name: candidate.name, error: String(error?.message || error) });
    }
  }
  const result = {
    ok: failed.length === 0,
    finishedAt: new Date().toISOString(),
    removedItems: removed.length,
    freedBytes: removed.reduce((sum, entry) => sum + Number(entry.bytes || 0), 0),
    removed,
    failed,
  };
  await mkdir(path.dirname(roots.status), { recursive: true, mode: 0o750 });
  await writeFile(roots.status, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  return result;
}

export async function collectServerStatus({ roots: rootOverrides = {}, now = new Date() } = {}) {
  const roots = rootsFromEnvironment(rootOverrides), nowMs = now.getTime();
  const [disk, releasesUsage, backupsUsage, projectUsage, inventory, backup, offsite, restoreTest, lastCleanup] = await Promise.all([
    diskStatus(roots.disk),
    directoryUsage(roots.releases),
    directoryUsage(roots.backups),
    directoryUsage(roots.project),
    releaseInventory(roots),
    readJson(path.join(roots.backups, 'status.json'), {}),
    readJson(path.join(roots.backups, 'offsite-status.json'), {}),
    readJson(path.join(roots.backups, 'restore-test-status.json'), {}),
    readJson(roots.status, null),
  ]);
  const cpus = Math.max(1, os.cpus().length), load = os.loadavg();
  return {
    checkedAt: now.toISOString(),
    host: {
      hostname: os.hostname(),
      platform: `${os.type()} ${os.release()}`,
      cpuCount: cpus,
      load: load.map((value) => Math.round(value * 100) / 100),
      loadPercent: Math.round((load[0] / cpus) * 1000) / 10,
      uptimeSeconds: Math.floor(os.uptime()),
    },
    disk,
    memory: memoryStatus(),
    process: {
      pid: process.pid,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryBytes: process.memoryUsage().rss,
      node: process.version,
      status: 'online',
    },
    storage: {
      releases: { ...releasesUsage, count: inventory.releases.length, managed: inventory.releases.filter((entry) => entry.managed).length },
      backups: backupsUsage,
      project: projectUsage,
    },
    release: {
      active: inventory.releases.find((entry) => entry.active)?.name || null,
      managedCount: inventory.releases.filter((entry) => entry.managed).length,
      unmanagedCount: inventory.releases.filter((entry) => !entry.managed).length,
    },
    backups: {
      local: backupHealth(backup, nowMs),
      offsite: backupHealth(offsite, nowMs),
      restoreTest: backupHealth(restoreTest, nowMs, 8 * 24),
    },
    maintenance: {
      scheduled: true,
      schedule: 'codziennie 02:35',
      lastCleanup,
    },
    thresholds: { diskWarningPercent: 75, diskCriticalPercent: 90, memoryWarningPercent: 85, loadWarningPercent: 80 },
  };
}
