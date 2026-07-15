import crypto from 'node:crypto';

export const PRODUCT_LINK_IMPORT_INDEX_KEY = 'product-link-import:index:v1';
export const PRODUCT_LINK_IMPORT_JOB_PREFIX = 'product-link-import:job:v1:';
export const PRODUCT_LINK_IMPORT_ITEMS_PREFIX = 'product-link-import:items:v1:';

const MAX_ROWS = 1000;
const ITEMS_PER_SHARD = 100;
const CAS_ATTEMPTS = 12;
const LEASE_MS = 5 * 60 * 1000;
const ITEM_STATUSES = Object.freeze(['queued', 'processing', 'added', 'skipped_existing', 'needs_review', 'failed', 'cancelled']);
const TERMINAL = new Set(['added', 'skipped_existing', 'needs_review', 'failed', 'cancelled']);
const ALEXANDER_HOSTS = new Set([
  'sklep.alexander.com.pl',
  'www.sklep.alexander.com.pl',
]);
const BLOCKED_HOST_SUFFIXES = Object.freeze(['.local', '.internal', '.localhost', '.test', '.invalid', '.example']);

const asArray = (value) => Array.isArray(value) ? value : [];
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const clean = (value, max = 1000) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const clone = (value) => structuredClone(value);

function serviceError(message, code = 'product_link_import_error', status = 409) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function dateFrom(now) {
  const result = now();
  const value = result instanceof Date ? result : new Date(result);
  return Number.isFinite(value.getTime()) ? value : new Date();
}

function isPublicProductHost(value) {
  const host = clean(value, 300).toLowerCase().replace(/\.$/, '');
  if (!host || !host.includes('.') || host.includes(':') || /^\d+(?:\.\d+){3}$/.test(host)) return false;
  if (host === 'localhost' || host === 'localhost.localdomain' || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return false;
  if (host.length > 253 || !/^[a-z0-9.-]+$/.test(host)) return false;
  const labels = host.split('.');
  if (labels.some((label) => !label || label.length > 63 || label.startsWith('-') || label.endsWith('-'))) return false;
  const tld = labels.at(-1) || '';
  return /^[a-z]{2,63}$/i.test(tld) || /^xn--[a-z0-9-]{2,59}$/i.test(tld);
}

function safeUrl(value) {
  try {
    const url = new URL(clean(value, 3000));
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!isPublicProductHost(host)) return null;
    if (url.username || url.password || (url.port && !['80', '443'].includes(url.port))) return null;
    const queryLooksLikeProduct = [...url.searchParams.keys()].some((key) => /^(?:p|id|sku|product|produkt|item|offer)(?:[_-]?id)?$/i.test(key));
    if ((!url.pathname || url.pathname === '/') && !queryLooksLikeProduct) return null;
    url.protocol = 'https:';
    url.hostname = ALEXANDER_HOSTS.has(host) ? 'www.sklep.alexander.com.pl' : host;
    url.port = '';
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|query_id|fbclid|gclid|ref|source)$/i.test(key)) url.searchParams.delete(key);
    }
    url.pathname = url.pathname.replace(/\/{2,}/g, '/');
    url.searchParams.sort();
    return url.toString().replace(/\?$/, '');
  } catch {
    return null;
  }
}

function rowUrl(row) {
  if (typeof row === 'string') return row;
  return row?.url || row?.link || row?.href || row?.sourceUrl || row?.['Link do produktu'] || row?.['link do produktu'] || '';
}

function normalizeRows(rows) {
  if (!Array.isArray(rows) || !rows.length) throw serviceError('Plik nie zawiera linków do produktów.', 'product_link_import_empty', 422);
  if (rows.length > MAX_ROWS) throw serviceError(`Jeden import może zawierać maksymalnie ${MAX_ROWS} linków.`, 'product_link_import_too_large', 422);
  return rows.map((row, index) => {
    const url = safeUrl(rowUrl(row));
    if (!url) throw serviceError(`Wiersz ${index + 1} zawiera nieprawidłowy link. Wymagana jest publiczna strona konkretnego produktu producenta lub dostawcy.`, 'product_link_import_source_not_allowed', 422);
    return {
      rowNumber: Math.max(1, Number(row?.rowNumber ?? row?.lp ?? row?.Lp) || index + 1),
      name: clean(row?.name || row?.nazwa || row?.['Nazwa produktu'], 500),
      url,
    };
  });
}

function importFingerprint(rows) {
  return crypto.createHash('sha256').update(rows.map((row) => `${row.rowNumber}\t${row.url}`).join('\n')).digest('hex');
}

function normalizeJob(value = {}) {
  const source = asObject(value);
  const total = Math.max(0, Number(source.total) || 0);
  return {
    schemaVersion: 1,
    id: clean(source.id, 160),
    fingerprint: clean(source.fingerprint, 100),
    fileName: clean(source.fileName, 300),
    createdBy: clean(source.createdBy, 300),
    state: ['running', 'paused', 'cancelled', 'completed'].includes(source.state) ? source.state : 'running',
    total,
    itemShards: asArray(source.itemShards).map((entry, index) => ({
      index: Math.max(0, Number(entry?.index) || index),
      key: clean(entry?.key, 400),
      count: Math.max(0, Number(entry?.count) || 0),
    })).filter((entry) => entry.key),
    cursorShard: Math.max(0, Number(source.cursorShard) || 0),
    lease: asObject(source.lease),
    summary: normalizeStoredSummary(source.summary, total),
    completedItems: asObject(source.completedItems),
    createdAt: clean(source.createdAt, 50) || null,
    updatedAt: clean(source.updatedAt, 50) || null,
  };
}

function publicItem(item = {}) {
  const result = {
    id: clean(item.id, 220),
    rowNumber: Math.max(1, Number(item.rowNumber) || 1),
    name: clean(item.name, 500),
    url: clean(item.url, 3000),
    status: ITEM_STATUSES.includes(item.status) ? item.status : 'queued',
    attempts: Math.max(0, Number(item.attempts) || 0),
    updatedAt: clean(item.updatedAt, 50) || null,
  };
  if (item.productId !== undefined && item.productId !== null && item.productId !== '') result.productId = item.productId;
  if (item.duplicateProductId !== undefined && item.duplicateProductId !== null && item.duplicateProductId !== '') result.duplicateProductId = item.duplicateProductId;
  if (clean(item.reason, 1000)) result.reason = clean(item.reason, 1000);
  if (clean(item.error, 1000)) result.error = clean(item.error, 1000);
  return result;
}

function summary(items) {
  const counts = Object.fromEntries(ITEM_STATUSES.map((status) => [status, 0]));
  for (const item of items) counts[ITEM_STATUSES.includes(item.status) ? item.status : 'queued'] += 1;
  const processed = [...TERMINAL].reduce((sum, status) => sum + counts[status], 0);
  return { total: items.length, ...counts, processed, percent: items.length ? Math.round(processed * 1000 / items.length) / 10 : 100 };
}

function normalizeStoredSummary(value, total = 0) {
  const source = asObject(value), result = { total: Math.max(0, Number(total) || Number(source.total) || 0) };
  for (const status of ITEM_STATUSES) result[status] = Math.max(0, Number(source[status]) || 0);
  if (!Object.keys(source).length && result.total) result.queued = result.total;
  result.processing = 0;
  result.processed = [...TERMINAL].reduce((sum, status) => sum + result[status], 0);
  result.percent = result.total ? Math.round(result.processed * 1000 / result.total) / 10 : 100;
  return result;
}

export function createProductLinkImportService({ read, readVersioned, writeIfVersion, catalog, prepareProduct, now = () => new Date(), randomUUID = () => crypto.randomUUID() } = {}) {
  if (typeof read !== 'function' || typeof readVersioned !== 'function' || typeof writeIfVersion !== 'function') throw new Error('Import linków wymaga repozytorium z zapisem CAS.');
  if (!catalog || typeof catalog.add !== 'function' || typeof catalog.list !== 'function') throw new Error('Import linków wymaga katalogu importowanych produktów.');
  if (typeof prepareProduct !== 'function') throw new Error('Import linków wymaga funkcji przygotowania produktu.');

  const jobKey = (jobId) => `${PRODUCT_LINK_IMPORT_JOB_PREFIX}${clean(jobId, 160)}`;
  const shardKey = (jobId, index) => `${PRODUCT_LINK_IMPORT_ITEMS_PREFIX}${clean(jobId, 160)}:${String(index).padStart(4, '0')}`;
  const isoNow = () => dateFrom(now).toISOString();

  async function readItems(job) {
    const records = await Promise.all(job.itemShards.map((entry) => read(entry.key, { items: [] })));
    return records.flatMap((record) => asArray(record?.items)).sort((a, b) => Number(a.rowIndex) - Number(b.rowIndex));
  }

  async function snapshot(jobId, additions = {}) {
    const job = normalizeJob(await read(jobKey(jobId), null));
    if (!job.id) throw serviceError('Nie znaleziono importu linków.', 'product_link_import_not_found', 404);
    const rawItems = await readItems(job);
    const items = rawItems.map(publicItem);
    const stats = summary(items);
    const state = job.state === 'running' && stats.processed >= stats.total ? 'completed' : job.state;
    return {
      job: {
        id: job.id, fileName: job.fileName, state, createdAt: job.createdAt, updatedAt: job.updatedAt,
        total: job.total, processed: stats.processed, currentItemId: clean(job.lease?.itemId, 220) || null,
      },
      summary: stats,
      items,
      ...additions,
    };
  }

  function delta(job, processedItem = null, additions = {}) {
    const stats = normalizeStoredSummary(job.summary, job.total);
    return {
      job: {
        id: job.id, fileName: job.fileName, state: job.state, createdAt: job.createdAt, updatedAt: job.updatedAt,
        total: job.total, processed: stats.processed, currentItemId: clean(job.lease?.itemId, 220) || null,
      },
      summary: stats,
      processedItem: processedItem ? publicItem(processedItem) : null,
      ...additions,
    };
  }

  async function casSetNew(key, value) {
    for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt += 1) {
      const version = await readVersioned(key, null);
      if (version.exists || version.value) return false;
      const write = await writeIfVersion(key, value, version);
      if (write?.modified) return true;
    }
    throw serviceError('Nie udało się utworzyć rekordu importu.', 'product_link_import_create_conflict');
  }

  async function reserveJob(fingerprint, createdAt) {
    for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt += 1) {
      const version = await readVersioned(PRODUCT_LINK_IMPORT_INDEX_KEY, { fingerprints: {}, updatedAt: null });
      const current = { fingerprints: asObject(version.value?.fingerprints), updatedAt: version.value?.updatedAt || null };
      const existing = asObject(current.fingerprints[fingerprint]);
      if (existing.jobId) return { jobId: existing.jobId, duplicate: true };
      const uuid = clean(randomUUID(), 120).replace(/[^a-zA-Z0-9_-]/g, '') || fingerprint.slice(0, 24);
      const jobId = `PLI-${uuid}-${fingerprint.slice(0, 8)}`;
      const next = { fingerprints: { ...current.fingerprints, [fingerprint]: { jobId, createdAt } }, updatedAt: createdAt };
      const write = await writeIfVersion(PRODUCT_LINK_IMPORT_INDEX_KEY, next, version);
      if (write?.modified) return { jobId, duplicate: false };
    }
    throw serviceError('Lista importów zmieniła się podczas zapisu.', 'product_link_import_index_conflict');
  }

  async function create({ fileName = '', rows, createdBy = '' } = {}) {
    const normalized = normalizeRows(rows);
    const fingerprint = importFingerprint(normalized);
    const createdAt = isoNow();
    const reservation = await reserveJob(fingerprint, createdAt);
    const existing = await read(jobKey(reservation.jobId), null);
    if (existing?.id) return snapshot(reservation.jobId, { duplicate: true });

    const items = normalized.map((row, index) => ({
      id: `${reservation.jobId}:${index + 1}`,
      rowIndex: index,
      rowNumber: row.rowNumber,
      name: row.name,
      url: row.url,
      status: 'queued',
      attempts: 0,
      createdAt,
      updatedAt: createdAt,
    }));
    const itemShards = [];
    for (let offset = 0; offset < items.length; offset += ITEMS_PER_SHARD) {
      const index = Math.floor(offset / ITEMS_PER_SHARD);
      const key = shardKey(reservation.jobId, index);
      const part = items.slice(offset, offset + ITEMS_PER_SHARD);
      await casSetNew(key, { items: part, updatedAt: createdAt });
      itemShards.push({ index, key, count: part.length });
    }
    await casSetNew(jobKey(reservation.jobId), {
      schemaVersion: 1,
      id: reservation.jobId,
      fingerprint,
      fileName: clean(fileName, 300) || 'import-linkow.xlsx',
      createdBy: clean(createdBy, 300),
      state: 'running',
      total: items.length,
      itemShards,
      cursorShard: 0,
      lease: {},
      summary: normalizeStoredSummary({ queued: items.length }, items.length),
      completedItems: {},
      createdAt,
      updatedAt: createdAt,
    });
    return snapshot(reservation.jobId, { duplicate: reservation.duplicate });
  }

  async function status(jobId) {
    return snapshot(jobId);
  }

  async function updateJob(jobId, mutator) {
    for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt += 1) {
      const version = await readVersioned(jobKey(jobId), null);
      const job = normalizeJob(version.value);
      if (!job.id) throw serviceError('Nie znaleziono importu linków.', 'product_link_import_not_found', 404);
      const next = await mutator(job);
      if (!next) return job;
      const value = { ...job, ...next, updatedAt: isoNow() };
      const write = await writeIfVersion(jobKey(jobId), value, version);
      if (write?.modified) return normalizeJob(value);
    }
    throw serviceError('Import zmienił się podczas zapisu.', 'product_link_import_job_conflict');
  }

  async function updateShard(key, mutator) {
    for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt += 1) {
      const version = await readVersioned(key, { items: [], updatedAt: null });
      const items = asArray(version.value?.items);
      const result = await mutator(items);
      if (!result) return { items, value: null };
      const next = { items: result.items, updatedAt: isoNow() };
      const write = await writeIfVersion(key, next, version);
      if (write?.modified) return { items: next.items, value: result.value };
    }
    throw serviceError('Kolejka linków zmieniła się podczas zapisu.', 'product_link_import_items_conflict');
  }

  async function acquireJobLease(jobId) {
    const token = clean(randomUUID(), 160) || crypto.randomUUID();
    let acquired = false;
    const job = await updateJob(jobId, (current) => {
      if (current.state !== 'running') return null;
      const leaseUntil = Date.parse(current.lease?.until || '');
      if (current.lease?.token && Number.isFinite(leaseUntil) && leaseUntil > dateFrom(now).getTime()) return null;
      acquired = true;
      return { lease: { token, until: new Date(dateFrom(now).getTime() + LEASE_MS).toISOString(), itemId: null } };
    });
    return { acquired, token, job };
  }

  async function claimNext(job, token) {
    const nowMs = dateFrom(now).getTime();
    const start = Math.min(Math.max(0, Number(job.cursorShard) || 0), Math.max(0, job.itemShards.length - 1));
    for (let shardIndex = start; shardIndex < job.itemShards.length; shardIndex += 1) {
      const descriptor = job.itemShards[shardIndex];
      const claimed = await updateShard(descriptor.key, (items) => {
        const index = items.findIndex((item) => item.status === 'queued' || (item.status === 'processing' && Date.parse(item.leaseUntil || '') <= nowMs));
        if (index < 0) return null;
        const nextItems = [...items];
        const updatedAt = isoNow();
        const item = {
          ...nextItems[index], status: 'processing', attempts: Math.max(0, Number(nextItems[index].attempts) || 0) + 1,
          leaseToken: token, leaseUntil: new Date(dateFrom(now).getTime() + LEASE_MS).toISOString(), updatedAt,
          error: '', reason: '',
        };
        nextItems[index] = item;
        return { items: nextItems, value: { item, shardKey: descriptor.key, shardIndex } };
      });
      if (claimed.value) return claimed.value;
    }
    return null;
  }

  async function finishItem(claim, token, patch) {
    const result = await updateShard(claim.shardKey, (items) => {
      const index = items.findIndex((item) => item.id === claim.item.id);
      if (index < 0 || items[index].leaseToken !== token || items[index].status !== 'processing') return null;
      const nextItems = [...items];
      nextItems[index] = {
        ...nextItems[index], ...patch, leaseToken: '', leaseUntil: '', updatedAt: isoNow(),
      };
      return { items: nextItems, value: nextItems[index] };
    });
    return result.value || { ...claim.item, ...patch, leaseToken: '', leaseUntil: '', updatedAt: isoNow() };
  }

  async function recordCompletion(jobId, token, item, patch) {
    let recorded = null;
    const job = await updateJob(jobId, (current) => {
      const existing = asObject(current.completedItems[item.id]);
      if (existing.status) { recorded = existing; return null; }
      if (current.lease?.token !== token) return null;
      const status = TERMINAL.has(patch.status) ? patch.status : 'failed';
      const currentSummary = normalizeStoredSummary(current.summary, current.total);
      const nextSummary = { ...currentSummary, queued: Math.max(0, currentSummary.queued - 1), [status]: currentSummary[status] + 1 };
      nextSummary.processed = [...TERMINAL].reduce((sum, name) => sum + nextSummary[name], 0);
      nextSummary.percent = nextSummary.total ? Math.round(nextSummary.processed * 1000 / nextSummary.total) / 10 : 100;
      recorded = {
        status,
        ...(patch.productId !== undefined ? { productId: patch.productId } : {}),
        ...(patch.duplicateProductId !== undefined ? { duplicateProductId: patch.duplicateProductId } : {}),
        ...(clean(patch.reason, 1000) ? { reason: clean(patch.reason, 1000) } : {}),
        ...(clean(patch.error, 1000) ? { error: clean(patch.error, 1000) } : {}),
      };
      return { summary: nextSummary, completedItems: { ...current.completedItems, [item.id]: recorded } };
    });
    const saved = recorded || asObject(job.completedItems[item.id]);
    if (!saved.status) throw serviceError('Wygasła blokada przetwarzanego linku. Pozycja zostanie bezpiecznie wznowiona.', 'product_link_import_lease_lost', 409);
    return { job, patch: saved };
  }

  async function releaseLease(jobId, token) {
    return updateJob(jobId, (job) => {
      if (job.lease?.token !== token) return null;
      const stats = normalizeStoredSummary(job.summary, job.total);
      return { lease: {}, state: job.state === 'running' && stats.processed >= job.total ? 'completed' : job.state };
    });
  }

  async function reconcileProgress(jobId) {
    const current = normalizeJob(await read(jobKey(jobId), null));
    if (!current.id) throw serviceError('Nie znaleziono importu linków.', 'product_link_import_not_found', 404);
    const items = await readItems(current), stats = summary(items), completedItems = {};
    for (const item of items) if (TERMINAL.has(item.status)) completedItems[item.id] = {
      status: item.status,
      ...(item.productId !== undefined ? { productId: item.productId } : {}),
      ...(item.duplicateProductId !== undefined ? { duplicateProductId: item.duplicateProductId } : {}),
      ...(clean(item.reason, 1000) ? { reason: clean(item.reason, 1000) } : {}),
      ...(clean(item.error, 1000) ? { error: clean(item.error, 1000) } : {}),
    };
    return updateJob(jobId, (job) => ({
      summary: stats,
      completedItems,
      state: job.state === 'running' && stats.processed >= stats.total ? 'completed' : job.state,
    }));
  }

  async function processNext(jobId) {
    const lease = await acquireJobLease(jobId);
    if (!lease.acquired) {
      const result = delta(lease.job, null);
      return { ...result, busy: result.job.state === 'running' && !!lease.job.lease?.token, done: result.job.state === 'completed' };
    }
    const claim = await claimNext(lease.job, lease.token);
    if (!claim) {
      const released = await releaseLease(jobId, lease.token);
      const result = delta(released, null);
      return { ...result, done: result.job.state === 'completed' };
    }
    await updateJob(jobId, (job) => job.lease?.token === lease.token ? { lease: { ...job.lease, itemId: claim.item.id }, cursorShard: claim.shardIndex } : null);

    let terminalPatch = asObject(lease.job.completedItems[claim.item.id]);
    if (!terminalPatch.status) {
      try {
        const prepared = await prepareProduct(claim.item.url, {
          jobId,
          itemId: claim.item.id,
          rowNumber: claim.item.rowNumber,
          name: claim.item.name,
        });
        const packageValue = asObject(prepared);
        const product = packageValue.product && typeof packageValue.product === 'object' ? packageValue.product : prepared;
        if (packageValue.needsReview || !product || typeof product !== 'object' || Array.isArray(product)) {
          terminalPatch = { status: 'needs_review', reason: clean(packageValue.reviewReason, 1000) || 'Dane produktu wymagają decyzji administratora.' };
        } else {
          const result = await catalog.add(product, {
            sourceUrl: claim.item.url,
            importItemKey: claim.item.id,
            extraProducts: asArray(packageValue.extraProducts),
          });
          terminalPatch = result.added || result.idempotent
            ? { status: 'added', productId: result.product?.id, reason: result.idempotent ? 'Wznowiono zapis wcześniej dodanego produktu.' : '' }
            : { status: 'skipped_existing', duplicateProductId: result.product?.id, reason: clean(result.reason, 300) || 'Pewny duplikat produktu.' };
        }
      } catch (error) {
        terminalPatch = { status: 'failed', error: clean(error?.message || 'Nie udało się pobrać produktu.', 1000), reason: clean(error?.code, 200) };
      }
    }
    const recorded = await recordCompletion(jobId, lease.token, claim.item, terminalPatch);
    const completed = await finishItem(claim, lease.token, recorded.patch);
    const released = await releaseLease(jobId, lease.token);
    const result = delta(released, completed);
    return { ...result, done: result.job.state === 'completed' };
  }

  async function pause(jobId) {
    await updateJob(jobId, (job) => job.state === 'running' ? { state: 'paused' } : null);
    return snapshot(jobId);
  }

  async function resume(jobId) {
    await updateJob(jobId, (job) => job.state === 'paused' ? { state: 'running' } : null);
    return snapshot(jobId);
  }

  async function cancel(jobId) {
    const job = await updateJob(jobId, (current) => ['completed', 'cancelled'].includes(current.state) ? null : { state: 'cancelled' });
    for (const descriptor of job.itemShards) {
      await updateShard(descriptor.key, (items) => {
        let changed = false;
        const nextItems = items.map((item) => {
          if (item.status !== 'queued') return item;
          changed = true;
          return { ...item, status: 'cancelled', updatedAt: isoNow(), reason: 'Import anulowany przez administratora.' };
        });
        return changed ? { items: nextItems, value: true } : null;
      });
    }
    await reconcileProgress(jobId);
    return snapshot(jobId);
  }

  async function retryFailures(jobId) {
    const job = normalizeJob(await read(jobKey(jobId), null));
    if (!job.id) throw serviceError('Nie znaleziono importu linków.', 'product_link_import_not_found', 404);
    let retried = 0;
    for (const descriptor of job.itemShards) {
      await updateShard(descriptor.key, (items) => {
        let changed = false;
        const nextItems = items.map((item) => {
          if (item.status !== 'failed') return item;
          changed = true; retried += 1;
          return { ...item, status: 'queued', error: '', reason: '', leaseToken: '', leaseUntil: '', updatedAt: isoNow() };
        });
        return changed ? { items: nextItems, value: true } : null;
      });
    }
    if (retried) await updateJob(jobId, (current) => current.state !== 'cancelled' ? { state: 'running', lease: {}, cursorShard: 0 } : null);
    if (retried) await reconcileProgress(jobId);
    return snapshot(jobId, { retried });
  }

  return Object.freeze({ create, status, processNext, pause, resume, cancel, retryFailures });
}
