import crypto from 'node:crypto';
import { synchronizeProductIdentifierAliases } from './product-identifiers.mjs';
import { PRODUCT_LINK_IMPORT_INDEX_KEY, PRODUCT_LINK_IMPORT_JOB_PREFIX, PRODUCT_LINK_IMPORT_ITEMS_PREFIX, MAX_ROWS, ITEMS_PER_SHARD, CAS_ATTEMPTS, LEASE_MS, ITEM_STATUSES, TERMINAL, REVIEW_PATCH_FIELDS, ALEXANDER_HOSTS, BLOCKED_HOST_SUFFIXES, asArray, asObject, clean, clone, serviceError, dateFrom, isPublicProductHost, safeUrl, rowUrl, normalizeRows, importFingerprint, normalizeJob, reviewDraft, reviewPatch, reviewMissing, publicItem, summary, normalizeStoredSummary } from './product-link-import-support.mjs';

export function createProductLinkImportService({ read, readVersioned, writeIfVersion, catalog, prepareProduct, updateExistingProduct = null, now = () => new Date(), randomUUID = () => crypto.randomUUID() } = {}) {
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
        id: job.id, fileName: job.fileName, state, updateExisting: job.updateExisting, createdAt: job.createdAt, updatedAt: job.updatedAt,
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
        id: job.id, fileName: job.fileName, state: job.state, updateExisting: job.updateExisting, createdAt: job.createdAt, updatedAt: job.updatedAt,
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

  async function create({ fileName = '', rows, createdBy = '', updateExisting = false } = {}) {
    const normalized = normalizeRows(rows);
    const refreshExisting = updateExisting === true;
    const fingerprint = importFingerprint(normalized, refreshExisting);
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
      updateExisting: refreshExisting,
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
        ...(status === 'needs_review' ? {
          reviewDraft: reviewDraft(patch.reviewDraft, item.url),
          missingFields: asArray(patch.missingFields).map((entry) => clean(entry, 100)).filter(Boolean).slice(0, 20),
        } : {}),
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
      ...(item.status === 'needs_review' ? {
        reviewDraft: reviewDraft(item.reviewDraft, item.url),
        missingFields: asArray(item.missingFields).map((entry) => clean(entry, 100)).filter(Boolean).slice(0, 20),
      } : {}),
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
          updateExisting: lease.job.updateExisting === true,
        });
        const packageValue = asObject(prepared);
        const product = packageValue.product && typeof packageValue.product === 'object' ? packageValue.product : prepared;
        if (packageValue.needsReview || !product || typeof product !== 'object' || Array.isArray(product)) {
          const draft = reviewDraft(product, claim.item.url), missingFields = reviewMissing(draft);
          terminalPatch = {
            status: 'needs_review',
            reason: clean(packageValue.reviewReason, 1000) || `Uzupełnij: ${missingFields.join(', ') || 'dane wymagające decyzji'}.`,
            reviewDraft: draft,
            missingFields,
          };
        } else if (packageValue.updateExisting && packageValue.existingProduct) {
          const existingId = packageValue.existingProduct.id;
          let refreshed = typeof catalog.updateFromSource === 'function' ? await catalog.updateFromSource(existingId, product) : { notFound: true };
          if (refreshed?.notFound && typeof updateExistingProduct === 'function') refreshed = await updateExistingProduct(existingId, product, packageValue.existingProduct);
          terminalPatch = refreshed?.updated
            ? { status: 'updated_existing', productId: refreshed.product?.id || existingId, reason: `Uzupełniono istniejącą kartotekę z aktualnego źródła${refreshed.changedFields?.length ? `: ${refreshed.changedFields.join(', ')}` : ''}.` }
            : { status: 'skipped_existing', duplicateProductId: existingId, reason: 'Kartoteka jest już aktualna — nie zmieniono ceny, stanu ani ręcznych opisów.' };
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

  async function findReviewItem(job, itemId) {
    for (const descriptor of job.itemShards) {
      const record = await read(descriptor.key, { items: [] });
      const item = asArray(record?.items).find((entry) => clean(entry?.id, 220) === itemId);
      if (item) return { descriptor, item };
    }
    return null;
  }

  /** Uzupełnia pojedyncze lub zaznaczone szkice i dodaje tylko kompletne produkty. */
  async function resolveReviews({ jobId = '', items = [], commonPatch = {}, actor = 'administrator' } = {}) {
    const safeJobId = clean(jobId, 180), job = normalizeJob(await read(jobKey(safeJobId), null));
    if (!job.id) throw serviceError('Nie znaleziono importu linków.', 'product_link_import_not_found', 404);
    if (asArray(items).length > 200) throw serviceError('Jedna operacja masowa może obejmować maksymalnie 200 produktów.', 'product_link_import_review_too_large', 422);
    const decisions = asArray(items).map((entry) => ({
      itemId: clean(entry?.itemId || entry?.id, 220),
      patch: reviewPatch({ ...asObject(commonPatch), ...asObject(entry?.patch) }),
    })).filter((entry) => entry.itemId);
    if (!decisions.length) throw serviceError('Zaznacz co najmniej jedną pozycję do uzupełnienia.', 'product_link_import_review_empty', 422);
    const unique = new Set(), results = [];
    for (const decision of decisions) {
      if (unique.has(decision.itemId)) continue;
      unique.add(decision.itemId);
      const located = await findReviewItem(job, decision.itemId);
      if (!located) { results.push({ itemId: decision.itemId, status: 'not_found' }); continue; }
      const current = located.item;
      if (current.status !== 'needs_review') { results.push({ itemId: decision.itemId, status: current.status, skipped: true }); continue; }
      let prepared = {}, preparationError = '';
      try {
        prepared = asObject(await prepareProduct(current.url, {
          jobId: job.id, itemId: current.id, rowNumber: current.rowNumber, name: current.name, review: true,
        }));
      } catch (error) {
        preparationError = clean(error?.message || 'Nie udało się ponownie pobrać źródła.', 500);
      }
      const preparedProduct = asObject(prepared.product && typeof prepared.product === 'object' ? prepared.product : prepared);
      const storedDraft = reviewDraft(current.reviewDraft, current.url);
      const storedValues = Object.fromEntries(Object.entries(storedDraft).filter(([field, value]) => {
        if (field === 'cena') return Number(value) > 0;
        if (Array.isArray(value)) return value.length > 0;
        if (['ikona', 'kolor', 'sourceUrl', 'producentUrl'].includes(field)) return !!value;
        return clean(value, 10).length > 0;
      }));
      let product = {
        ...preparedProduct,
        ...reviewDraft(preparedProduct, current.url),
        ...storedValues,
        ...decision.patch,
        sourceUrl: current.url,
        producentUrl: current.url,
      };
      if (!product.marka && product.producent) product.marka = product.producent;
      if (!product.producent && product.marka) product.producent = product.marka;
      if (!product.gtin && product.ean) product.gtin = product.ean;
      if (!product.ean && product.gtin) product.ean = product.gtin;
      product = synchronizeProductIdentifierAliases(product, { code: product.kodProducenta || product.mpn || product.externalId || product.sku, overwrite: !!product.kodProducenta });
      const missingFields = reviewMissing(product);
      if (missingFields.length) {
        const reason = `Nadal uzupełnij: ${missingFields.join(', ')}.${preparationError ? ` Źródło: ${preparationError}` : ''}`;
        await updateShard(located.descriptor.key, (shardItems) => {
          const index = shardItems.findIndex((entry) => clean(entry?.id, 220) === decision.itemId && entry.status === 'needs_review');
          if (index < 0) return null;
          const nextItems = [...shardItems];
          nextItems[index] = { ...nextItems[index], reviewDraft: product, missingFields, reason, updatedAt: isoNow() };
          return { items: nextItems, value: nextItems[index] };
        });
        results.push({ itemId: decision.itemId, status: 'needs_review', missingFields });
        continue;
      }
      const catalogResult = await catalog.add(product, {
        sourceUrl: current.url,
        importItemKey: current.id,
        extraProducts: asArray(prepared.extraProducts),
      });
      const nextStatus = catalogResult.added || catalogResult.idempotent ? 'added' : 'skipped_existing';
      const saved = await updateShard(located.descriptor.key, (shardItems) => {
        const index = shardItems.findIndex((entry) => clean(entry?.id, 220) === decision.itemId && entry.status === 'needs_review');
        if (index < 0) return null;
        const nextItems = [...shardItems];
        nextItems[index] = {
          ...nextItems[index], status: nextStatus,
          ...(nextStatus === 'added' ? { productId: catalogResult.product?.id } : { duplicateProductId: catalogResult.product?.id }),
          reason: nextStatus === 'added' ? 'Uzupełniono braki i dodano po decyzji administratora.' : clean(catalogResult.reason, 300) || 'Pewny duplikat produktu.',
          error: '', missingFields: [], reviewDraft: undefined, reviewedAt: isoNow(), reviewedBy: clean(actor, 200) || 'administrator', updatedAt: isoNow(),
        };
        return { items: nextItems, value: nextItems[index] };
      });
      results.push({ itemId: decision.itemId, status: saved.value?.status || nextStatus, productId: catalogResult.product?.id });
    }
    await reconcileProgress(job.id);
    return snapshot(job.id, {
      reviewResults: results,
      resolved: results.filter((entry) => ['added', 'skipped_existing'].includes(entry.status)).length,
      stillNeedsReview: results.filter((entry) => entry.status === 'needs_review').length,
    });
  }

  return Object.freeze({ create, status, processNext, pause, resume, cancel, retryFailures, resolveReviews });
}

export { PRODUCT_LINK_IMPORT_INDEX_KEY, PRODUCT_LINK_IMPORT_JOB_PREFIX, PRODUCT_LINK_IMPORT_ITEMS_PREFIX };
