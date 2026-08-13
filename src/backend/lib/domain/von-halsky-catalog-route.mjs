import {
  preferredVonHalskyOffers,
  reconcileVonHalskyCatalog,
  resolveVonHalskyRemoteOffer,
  vonHalskyEffectiveOfferStatus,
  vonHalskyOfferValidationMessages,
} from './von-halsky-catalog-reconciliation.mjs';
import { persistVonHalskyReconciliationState } from './von-halsky-publication-reconciliation.mjs';
import { officialManufacturerSourceCandidate, trustedSourceIdentifierPatch } from './product-source-identifier-repair.mjs';

const VON_HALSKY_PUBLICATION_TERMINAL = new Set(['completed', 'cancelled']);

function publicationQueueView(value = {}) {
  const productIds = [...new Set((Array.isArray(value.productIds) ? value.productIds : []).map(String).filter(Boolean))];
  const completedIds = [...new Set((Array.isArray(value.completedIds) ? value.completedIds : []).map(String).filter(Boolean))];
  const completed = new Set(completedIds);
  const currentBatchIds = (Array.isArray(value.currentBatchIds) ? value.currentBatchIds : []).map(String).filter(Boolean);
  const failures = Array.isArray(value.failures) ? value.failures.slice(-100) : [];
  return {
    id: String(value.id || ''),
    status: String(value.status || 'idle'),
    requestedAt: String(value.requestedAt || ''),
    startedAt: String(value.startedAt || ''),
    updatedAt: String(value.updatedAt || ''),
    completedAt: String(value.completedAt || ''),
    total: productIds.length,
    completed: completedIds.length,
    remaining: productIds.filter((id) => !completed.has(id)).length,
    failed: failures.length,
    currentBatchIds,
    current: currentBatchIds.length,
    failures,
  };
}

function publicationQueueId() {
  return `vh-publication-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function collisionSafeExternalId(item = {}, product = {}, remoteIndex = {}, pending = new Set()) {
  const slug = (value, max = 80) => String(value || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max);
  const brand = slug(item.brand || product.marka || product.producent, 45) || 'produkt';
  const code = slug(item.manufacturerCode || product.kodProducenta || product.sku || item.externalId, 55) || slug(product.id, 30);
  const bases = [`${brand}-${code}`, `${brand}-${code}-${slug(product.id, 30)}`].filter(Boolean);
  return bases.find((candidate) => (
    candidate.length <= 160
    && !remoteIndex.byExternalId?.get(candidate)
    && !remoteIndex.bySku?.get(candidate)
    && !pending.has(candidate)
  )) || '';
}

export function vonHalskyCreateReceipts(payload = {}) {
  const direct = Array.isArray(payload) ? payload : null;
  const nested = [
    payload?.data,
    payload?.commands,
    payload?.results,
    payload?.items,
    payload?.offers,
  ].find(Array.isArray);
  const rows = direct || nested || (payload && typeof payload === 'object' ? [payload] : []);
  return rows.filter((item) => item && typeof item === 'object').map((item) => ({
    ...item,
    commandId: String(item.commandId || item.command?.id || item.operationId || ''),
    offerId: String(item.offerId || item.offer?.id || ''),
    externalId: String(item.externalId || item.offer?.externalId || ''),
  }));
}

export function reconcileVonHalskyCommands(
  commands = [],
  remoteOffers = [],
  timestamp = new Date().toISOString(),
  graceMs = 24 * 60 * 60_000,
  minimumMissingChecks = 3,
) {
  const remote = preferredVonHalskyOffers(remoteOffers).byExternalId;
  const now = Date.parse(timestamp) || Date.now();
  return (Array.isArray(commands) ? commands : []).map((command) => {
    const offer = remote.get(String(command?.externalId || ''));
    const status = offer ? vonHalskyEffectiveOfferStatus(offer) : '';
    let nextStatus = String(command?.status || 'PENDING').toUpperCase();
    let error = String(command?.error || '');
    if (status === 'PUBLISHED' || ['CLOSED', 'SOLDOUT', 'INACTIVE'].includes(status)) {
      nextStatus = 'SUCCESS';
      error = '';
    } else if (['REJECTED', 'ERROR', 'VERIFICATION_ERROR'].includes(status)) {
      nextStatus = 'FAILED';
      error = vonHalskyOfferValidationMessages(offer).join(' • ').slice(0, 800)
        || 'Oferta wymaga poprawy danych w kanale.';
    } else if (['PENDING', 'PROCESSING'].includes(status)) {
      nextStatus = 'PENDING';
    } else {
      const age = now - Date.parse(String(command?.updatedAt || command?.createdAt || ''));
      const missingChecks = Math.max(0, Number(command?.missingChecks) || 0) + 1;
      const terminal = Number.isFinite(age)
        && age >= graceMs
        && missingChecks >= Math.max(1, Number(minimumMissingChecks) || 3);
      if (terminal) {
        nextStatus = 'NOT_FOUND';
        error = 'Po co najmniej trzech kontrolach i 24 godzinach oferta nie pojawiła się w katalogu API.';
      } else {
        nextStatus = 'PROVIDER_PROCESSING';
        error = '';
      }
      command = {
        ...command,
        missingChecks,
        firstMissingAt: command?.firstMissingAt || timestamp,
      };
    }
    return {
      ...command,
      status: nextStatus,
      error,
      missingChecks: status ? 0 : Math.max(0, Number(command?.missingChecks) || 0),
      firstMissingAt: status ? '' : String(command?.firstMissingAt || ''),
      remoteStatus: status || (nextStatus === 'NOT_FOUND' ? 'NOT_FOUND' : 'AWAITING_CATALOG'),
      checkedAt: timestamp,
    };
  });
}

export function createVonHalskyCatalogRoute(context = {}) {
  const {
    respond, readVersioned, STORE_KEY, initialState, cleanState, api, mutate,
    recordDiagnostic, loadCatalog, sourceUrlOf, inspectSource, sourceImages,
    resolveVonHalskyResponsibleProducer, categoryIndexFor,
    suggestVonHalskyCategory, matchVonHalskyAttributes,
    vonHalskyAgentPreparationPatch, saveProductFields, sessionOf, progress,
    updateProductPublication, prepareProductWithAgent, safeError, matchingText,
    matchingGtin, categoryRejectionForProduct, remoteOfferSummary,
    commandReceipt, mergeBy, summarizeVonHalskyCatalog,
    deduplicateVonHalskyOffers, vonHalskyOfferProposal,
    vonHalskyOfferProjection, vonHalskyProductReadiness,
    vonHalskyPublicConfig, normalizeVonHalskySettings, env,
    channelState,
  } = context;
  return async function route(req, url, action) {
    if (action === 'von-halsky-publication-queue') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const requestedIds = [...new Set((Array.isArray(body.productIds) ? body.productIds : []).map(String).filter(Boolean))];
      if (!requestedIds.length) return respond({ ok: false, error: 'Zaznacz co najmniej jeden produkt.' }, 400);
      const config = vonHalskyPublicConfig(env());
      if (!config.configured) return respond({
        ok: false,
        error: 'Najpierw uzupełnij prywatny kontrakt API Von Halsky na serwerze.',
        code: 'von_halsky_not_configured',
        config,
      }, 503);
      const products = await loadCatalog();
      const catalogIds = new Set((Array.isArray(products) ? products : [...(products?.values?.() || [])]).map((item) => String(item?.id || '')));
      const productIds = requestedIds.filter((id) => catalogIds.has(id));
      if (!productIds.length) return respond({ ok: false, error: 'Nie znaleziono zaznaczonych produktów w aktualnym katalogu.' }, 404);
      const now = new Date().toISOString();
      let queue;
      const updated = await mutate((current) => {
        const previous = current.sync?.publicationQueue || {};
        const active = previous.id && !VON_HALSKY_PUBLICATION_TERMINAL.has(String(previous.status || ''));
        const previousIds = active ? (Array.isArray(previous.productIds) ? previous.productIds : []) : [];
        const previousCompleted = active ? (Array.isArray(previous.completedIds) ? previous.completedIds : []) : [];
        queue = {
          ...(active ? previous : {}),
          id: active ? String(previous.id) : publicationQueueId(),
          status: active && previous.status === 'paused' ? 'paused' : active && previous.status === 'running' ? 'running' : 'queued',
          // Najnowsza świadoma decyzja administratora jest następna po już
          // dzierżawionej partii. Nie wolno chować kliknięcia na końcu starej
          // kolejki, ale zachowujemy idempotencję i wszystkie wcześniejsze ID.
          productIds: [...new Set([...productIds, ...previousIds.map(String)])],
          completedIds: previousCompleted.map(String),
          attempts: active && previous.attempts && typeof previous.attempts === 'object' ? previous.attempts : {},
          failures: active && Array.isArray(previous.failures) ? previous.failures : [],
          currentBatchIds: active && Array.isArray(previous.currentBatchIds) ? previous.currentBatchIds : [],
          leaseToken: active ? String(previous.leaseToken || '') : '',
          leaseUntil: active ? String(previous.leaseUntil || '') : '',
          requestedAt: active ? String(previous.requestedAt || now) : now,
          startedAt: active ? String(previous.startedAt || '') : '',
          completedAt: '',
          updatedAt: now,
        };
        current.sync = { ...current.sync, publicationQueue: queue };
        return current;
      });
      await recordDiagnostic({
        operation: 'catalog-publication-queued',
        status: 'ok',
        message: `Zapisano trwałą kolejkę publikacji: ${publicationQueueView(queue).remaining} pozostało z ${publicationQueueView(queue).total}.`,
      });
      return respond({ ok: true, queued: productIds.length, startsAfterCurrent: true, queue: publicationQueueView(queue), sync: updated.sync });
    }

    if (action === 'von-halsky-publication-queue-claim') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const limit = Math.max(1, Math.min(10, Number(body.limit) || 5));
      const now = new Date(), nowIso = now.toISOString();
      let claimed = [], leaseToken = '', queue;
      await mutate((current) => {
        const previous = current.sync?.publicationQueue || {};
        queue = { ...previous };
        if (!queue.id || ['paused', 'cancelled', 'completed'].includes(String(queue.status || ''))) return current;
        const leaseActive = queue.leaseToken && Date.parse(String(queue.leaseUntil || '')) > now.getTime();
        if (leaseActive) return current;
        const completed = new Set((Array.isArray(queue.completedIds) ? queue.completedIds : []).map(String));
        const attempts = queue.attempts && typeof queue.attempts === 'object' ? { ...queue.attempts } : {};
        claimed = (Array.isArray(queue.productIds) ? queue.productIds : [])
          .map(String)
          .filter((id) => !completed.has(id) && Number(attempts[id] || 0) < 3)
          .slice(0, limit);
        if (!claimed.length) {
          queue = { ...queue, status: 'completed', currentBatchIds: [], leaseToken: '', leaseUntil: '', completedAt: nowIso, updatedAt: nowIso };
        } else {
          for (const id of claimed) attempts[id] = Number(attempts[id] || 0) + 1;
          leaseToken = `vh-lease-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          queue = {
            ...queue,
            status: 'running',
            startedAt: queue.startedAt || nowIso,
            updatedAt: nowIso,
            attempts,
            currentBatchIds: claimed,
            leaseToken,
            leaseUntil: new Date(now.getTime() + 5 * 60_000).toISOString(),
          };
        }
        current.sync = { ...current.sync, publicationQueue: queue };
        return current;
      });
      return respond({ ok: true, claimed: claimed.length > 0, productIds: claimed, leaseToken, queue: publicationQueueView(queue) });
    }

    if (action === 'von-halsky-publication-queue-complete') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const now = new Date().toISOString();
      let queue, accepted = false;
      await mutate((current) => {
        const previous = current.sync?.publicationQueue || {};
        queue = { ...previous };
        if (!queue.id || !body.leaseToken || String(body.leaseToken) !== String(queue.leaseToken || '')) return current;
        accepted = true;
        const currentIds = (Array.isArray(queue.currentBatchIds) ? queue.currentBatchIds : []).map(String);
        const completed = new Set((Array.isArray(queue.completedIds) ? queue.completedIds : []).map(String));
        const attempts = queue.attempts && typeof queue.attempts === 'object' ? queue.attempts : {};
        const failures = Array.isArray(queue.failures) ? [...queue.failures] : [];
        const itemFailures = new Map((Array.isArray(body.failures) ? body.failures : []).map((item) => [String(item?.productId || ''), item]));
        const retryProductIds = new Set((Array.isArray(body.retryProductIds) ? body.retryProductIds : []).map(String));
        if (body.retry === true || retryProductIds.size) {
          for (const id of currentIds) {
            const shouldRetry = body.retry === true || retryProductIds.has(id);
            if (!shouldRetry) {
              completed.add(id);
              const failure = itemFailures.get(id);
              if (failure) failures.push({ productId: id, error: String(failure.error || 'Błąd publikacji produktu.').slice(0, 500), code: String(failure.code || ''), terminal: true, at: now });
              continue;
            }
            if (Number(attempts[id] || 0) < 3) continue;
            completed.add(id);
            failures.push({ productId: id, error: String(body.error || 'Kanał nie potwierdził oferty po trzech odczytach kontrolnych.').slice(0, 500), code: 'von_halsky_readback_timeout', terminal: true, at: now });
          }
        } else {
          for (const id of currentIds) {
            completed.add(id);
            const failure = itemFailures.get(id);
            if (failure) failures.push({ productId: id, error: String(failure.error || 'Błąd publikacji produktu.').slice(0, 500), code: String(failure.code || ''), terminal: true, at: now });
          }
        }
        const productIds = (Array.isArray(queue.productIds) ? queue.productIds : []).map(String);
        const remaining = productIds.filter((id) => !completed.has(id));
        const interruptedStatus = String(queue.status || '');
        queue = {
          ...queue,
          status: interruptedStatus === 'cancelled' ? 'cancelled' : remaining.length ? (interruptedStatus === 'paused' ? 'paused' : 'queued') : 'completed',
          completedIds: [...completed],
          failures: failures.slice(-100),
          currentBatchIds: [],
          leaseToken: '',
          leaseUntil: '',
          updatedAt: now,
          completedAt: interruptedStatus === 'cancelled' || !remaining.length ? now : '',
        };
        current.sync = { ...current.sync, publicationQueue: queue };
        return current;
      });
      if (!accepted) return respond({ ok: false, error: 'Nieaktualna dzierżawa kolejki. Serwer nie zmienił stanu.' }, 409);
      return respond({ ok: true, queue: publicationQueueView(queue) });
    }

    if (action === 'von-halsky-publication-queue-control') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const command = String(body.command || '');
      if (!['pause', 'resume', 'cancel'].includes(command)) return respond({ ok: false, error: 'Nieznane polecenie kolejki.' }, 400);
      const now = new Date().toISOString();
      let queue;
      await mutate((current) => {
        const previous = current.sync?.publicationQueue || {};
        queue = { ...previous };
        if (!queue.id || VON_HALSKY_PUBLICATION_TERMINAL.has(String(queue.status || ''))) return current;
        const activeLease = queue.leaseToken && Date.parse(String(queue.leaseUntil || '')) > Date.now();
        queue.status = command === 'pause' ? 'paused' : command === 'resume' ? (activeLease ? 'running' : 'queued') : 'cancelled';
        queue.updatedAt = now;
        if (command === 'cancel') queue.completedAt = now;
        if (command === 'resume' && !activeLease) {
          queue.leaseToken = '';
          queue.leaseUntil = '';
          queue.currentBatchIds = [];
        }
        current.sync = { ...current.sync, publicationQueue: queue };
        return current;
      });
      return respond({ ok: true, queue: publicationQueueView(queue) });
    }

    if (action === 'von-halsky-catalog-preview') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const state = cleanState((await readVersioned(STORE_KEY, initialState())).value);
      const products = await loadCatalog();
      const list = Array.isArray(products) ? products : [...(products?.values?.() || [])];
      const projections = list.map((product) => vonHalskyOfferProjection(product, state.settings));
      const deduplicated = deduplicateVonHalskyOffers(projections);
      return respond({
        ok: true,
        summary: summarizeVonHalskyCatalog(list),
        eligible: deduplicated.items.filter((item) => item.readiness.publishable && item.available).length,
        blocked: deduplicated.items.filter((item) => !item.readiness.publishable || !item.available).length,
        duplicates: deduplicated.conflicts.length,
        sample: projections.slice(0, 5).map((item) => ({
          externalId: item.externalId,
          gtin: item.gtin,
          name: item.name,
          ready: item.readiness.ready,
          publishable: item.readiness.publishable,
          issues: [...item.readiness.issues, ...item.readiness.publicationIssues],
        })),
      });
    }

    if (action === 'von-halsky-reconcile-catalog') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const compact = body?.compact === true;
      const source = String(body?.source || (compact ? 'background-worker' : 'administrator')).slice(0, 80);
      const config = vonHalskyPublicConfig(env());
      if (!config.configured) return respond({
        ok: false,
        error: 'Najpierw uzupełnij prywatny kontrakt API Von Halsky na serwerze.',
        code: 'von_halsky_not_configured',
        config,
      }, 503);
      try {
        const remoteResult = await api.listOffers();
        const remoteOffers = (Array.isArray(remoteResult.data) ? remoteResult.data : []).map(remoteOfferSummary);
        const products = await loadCatalog();
        const list = Array.isArray(products) ? products : [...(products?.values?.() || [])];
        const timestamp = new Date().toISOString();
        const reconciliation = await reconcileVonHalskyCatalog({
          remoteOffers,
          products: list,
          saveProductFields,
          timestamp,
        });
        const publicationState = await persistVonHalskyReconciliationState({
          channelState,
          products: list,
          productUpdates: reconciliation.productUpdates,
          timestamp,
          source,
        });
        const changedProductIds = [...new Set(
          (Array.isArray(reconciliation.productUpdates) ? reconciliation.productUpdates : [])
            .map((item) => String(item?.productId || ''))
            .filter(Boolean),
        )].slice(0, 2_000);
        let channelChanged = changedProductIds.length > 0;
        const updated = await mutate((current) => {
          const operationalSignature = (offers = [], commands = []) => JSON.stringify({
            offers: offers.map((item) => [item.offerId, item.externalId, item.status, item.validationErrors, item.rejectionReasons])
              .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
            commands: commands.map((item) => [item.commandId, item.status, item.entityId, item.type])
              .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
          });
          const beforeSignature = operationalSignature(current.offers, current.commands);
          current.offers = remoteOffers;
          current.commands = reconcileVonHalskyCommands(current.commands, remoteOffers, timestamp);
          channelChanged = channelChanged || beforeSignature !== operationalSignature(current.offers, current.commands);
          const pendingCommandCount = current.commands.filter((item) => (
            !['SUCCESS', 'FAILURE', 'FAILED', 'CANCELLED', 'NOT_FOUND'].includes(String(item?.status || 'PENDING').toUpperCase())
          )).length;
          current.sync = {
            ...current.sync,
            status: 'connected',
            lastCatalogAt: timestamp,
            lastCatalogVerifiedAt: timestamp,
            lastCatalogCount: reconciliation.truth.total,
            remoteOfferCount: reconciliation.truth.total,
            publishedOfferCount: reconciliation.truth.published,
            pendingOfferCount: reconciliation.truth.pending,
            rejectedOfferCount: reconciliation.truth.rejected,
            verificationErrorOfferCount: reconciliation.truth.verificationErrors,
            problemOfferCount: reconciliation.truth.problems,
            pendingCommandCount,
            lastError: '',
            lastRequestId: remoteResult.requestId || '',
            reconciliationRevision: channelChanged
              ? timestamp
              : current.sync.reconciliationRevision || timestamp,
            lastReconciliationSource: source,
            lastChangedProductIds: changedProductIds,
            lastPublicationStateCount: publicationState.observed,
            lastPublicationReceiptCount: publicationState.receipts,
            reconciliationMode: 'api_event_feed_with_catalog_verification',
          };
          return current;
        });
        if (channelChanged || source !== 'background-worker') {
          await recordDiagnostic({
            operation: 'catalog-reconciliation',
            status: 'ok',
            message: `API: ${reconciliation.truth.total}; w sprzedaży: ${reconciliation.truth.published}; wymaga poprawy: ${reconciliation.truth.problems}; usunięte fałszywe powiązania: ${reconciliation.counts.staleCleared}; rozdzielone duplikaty: ${reconciliation.counts.duplicateMappings}; zablokowane konflikty tożsamości: ${reconciliation.counts.identityConflicts}.`,
            requestId: remoteResult.requestId || '',
          });
        }
        const payload = {
          ok: true,
          truth: reconciliation.truth,
          reconciliation: reconciliation.counts,
          changedProductIds,
          revision: updated.sync.reconciliationRevision,
          sync: updated.sync,
          schedule: {
            intervalMinutes: Math.max(15, Number(updated.settings?.syncIntervalMinutes) || 15),
            pendingIntervalMinutes: 3,
          },
        };
        if (!compact) {
          payload.offers = remoteOffers;
          payload.productUpdates = reconciliation.productUpdates;
        }
        return respond(payload);
      } catch (error) {
        const safe = safeError(error);
        await recordDiagnostic({
          operation: 'catalog-reconciliation',
          status: 'error',
          message: safe.message,
          requestId: String(safe.details?.requestId || ''),
        });
        return respond({ ok: false, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }

    if (action === 'von-halsky-sync-catalog') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const state = cleanState((await readVersioned(STORE_KEY, initialState())).value);
      const config = vonHalskyPublicConfig(env());
      if (body.publish === true && !config.configured) {
        if (body.scheduled === true) return respond({ ok: true, skipped: true, reason: 'not-configured', config });
        return respond({ ok: false, error: 'Najpierw uzupełnij prywatny kontrakt API Von Halsky na serwerze.', code: 'von_halsky_not_configured', config }, 503);
      }
      if (body.publish === true && body.scheduled === true) {
        const previous = Date.parse(String(state.sync.lastCatalogAt || ''));
        const intervalMs = Math.max(15, Number(state.settings.syncIntervalMinutes) || 15) * 60_000;
        if (Number.isFinite(previous) && Date.now() - previous < intervalMs) {
          return respond({ ok: true, skipped: true, reason: 'not-due', nextAt: new Date(previous + intervalMs).toISOString(), sync: state.sync });
        }
      }
      const products = await loadCatalog();
      const list = Array.isArray(products) ? products : [...(products?.values?.() || [])];
      const requestedProductIds = new Set((Array.isArray(body.productIds) ? body.productIds : []).map((id) => String(id || '')).filter(Boolean));
      const operationFailures = [];
      const blockedProductIds = new Set();
      let selectedList = requestedProductIds.size ? list.filter((product) => requestedProductIds.has(String(product?.id))) : list;
      if (body.publish === true && requestedProductIds.size) {
        const verified = [];
        for (const product of selectedList) {
          try {
            const fields = {};
            const sourceUrl = typeof sourceUrlOf === 'function' ? sourceUrlOf(product) : '';
            if (sourceUrl && typeof inspectSource === 'function') {
              let inspected = await inspectSource(sourceUrl).catch(() => null);
              let inspectedUrl = sourceUrl;
              const officialCandidate = officialManufacturerSourceCandidate(product, sourceUrl);
              if (officialCandidate) {
                const officialInspection = await inspectSource(officialCandidate).catch(() => null);
                const officialProduct = officialInspection?.product && typeof officialInspection.product === 'object' ? officialInspection.product : null;
                const officialIdentity = officialProduct
                  ? trustedSourceIdentifierPatch(product, { ...officialProduct, sourceUrl: officialProduct.sourceUrl || officialCandidate })
                  : {};
                const officialImages = officialProduct && typeof sourceImages === 'function'
                  ? sourceImages({ ...product, ...officialIdentity, sourceUrl: officialCandidate }, officialInspection)
                  : null;
                if (officialImages?.ok && officialImages.patch) {
                  inspected = officialInspection;
                  inspectedUrl = officialCandidate;
                  Object.assign(fields, officialIdentity, officialImages.patch, {
                    sourceUrl: officialCandidate,
                    producentUrl: officialCandidate,
                    vonHalskySourceImageStatus: 'verified',
                    vonHalskySourceImageVerifiedAt: new Date().toISOString(),
                  });
                }
              }
              const sourceProduct = inspected?.product && typeof inspected.product === 'object' ? inspected.product : null;
              if (sourceProduct) Object.assign(fields, trustedSourceIdentifierPatch({ ...product, ...fields }, { ...sourceProduct, sourceUrl: sourceProduct.sourceUrl || inspectedUrl }));
            }
            const identityProduct = { ...product, ...fields };
            const categoryId = String(product.vonHalskyCategoryId || '').trim();
            let category = state.categories.find((item) => String(item?.id || '') === categoryId);
            if (categoryId && !category && typeof api.fetchCategories === 'function') {
              const categoryResult = await api.fetchCategories({ categoryId, depth: 0 });
              const payload = categoryResult?.payload;
              const candidate = Array.isArray(payload)
                ? payload.find((item) => String(item?.id || '') === categoryId) || payload[0]
                : payload?.data && !Array.isArray(payload.data) ? payload.data : payload;
              if (candidate && String(candidate.id || '') === categoryId) category = candidate;
            }
            fields.vonHalskyCategoryTreeValid = Boolean(categoryId && category?.leaf === true);
            if (categoryId && category?.leaf === true) {
              const attributeResult = await api.fetchCategoryAttributes(categoryId);
              const attributeMatch = matchVonHalskyAttributes(identityProduct, attributeResult.payload);
              fields.vonHalskyAttributeDefinitions = attributeMatch.definitions;
              fields.vonHalskyAttributes = { ...(product.vonHalskyAttributes || {}), ...attributeMatch.mapped };
              fields.vonHalskyRequiredAttributesMissing = attributeMatch.missingRequired;
              fields.vonHalskyAgentAttributeCoverage = attributeMatch.coverage;
              fields.vonHalskyAttributesVerifiedAt = new Date().toISOString();
              fields.vonHalskyDoesNotRequireGpsrInfo = category.doesNotRequireGpsrInfo === true;
              fields.vonHalskyGpsrRequired = category.doesNotRequireGpsrInfo !== true;
            }
            const responsibleProducer = resolveVonHalskyResponsibleProducer({ ...identityProduct, ...fields });
            fields.vonHalskyResponsibleProducerStatus = responsibleProducer.ready ? 'ready' : 'requires_data';
            fields.vonHalskyResponsibleProducerMissing = responsibleProducer.missing;
            if (responsibleProducer.ready) fields.vonHalskyResponsibleProducer = responsibleProducer.value;
            const merged = { ...product, ...fields };
            if (typeof saveProductFields === 'function' && Object.keys(fields).length) {
              const saved = await saveProductFields({
                productId: String(product.id),
                fields,
                mutationId: `von-halsky-publication-preflight:${product.id}:${categoryId || 'missing'}:${Date.now()}`,
                actor: 'von-halsky-api',
                area: 'von-halsky-publication-preflight',
              });
              verified.push(saved?.product || merged);
            } else verified.push(merged);
          } catch (error) {
            const safe = safeError(error), productId = String(product?.id || '');
            if (productId) blockedProductIds.add(productId);
            operationFailures.push({ productId, phase: 'preflight', error: safe.message, code: safe.code || 'von_halsky_preflight_failed' });
            verified.push(product);
          }
        }
        selectedList = verified;
      }
      const projections = selectedList.map((product) => vonHalskyOfferProjection(product, state.settings));
      // EXTERNAL_ID może się powtarzać w historycznych danych różnych
      // producentów. Powiązanie obiektu projekcji z kartoteką zachowujemy więc
      // przez referencję, a nie przez ten słaby identyfikator.
      const productByProjection = new Map(projections.map((projection, index) => [projection, selectedList[index]]));
      const productForItem = (item) => productByProjection.get(item) || null;
      const deduplicated = deduplicateVonHalskyOffers(projections);
      const eligible = deduplicated.items.filter((item) => {
        const product = productForItem(item);
        return item.readiness.publishable && item.available && !blockedProductIds.has(String(product?.id || ''));
      });
      const pendingCommandExternalIds = new Set((Array.isArray(state.commands) ? state.commands : [])
        .filter((command) => !['SUCCESS', 'FAILURE', 'FAILED', 'CANCELLED', 'NOT_FOUND'].includes(String(command?.status || 'PENDING').toUpperCase()))
        .map((command) => String(command?.externalId || '')).filter(Boolean));
      const allowNewOffer = (item) => {
        const product = productForItem(item);
        return Boolean(product && requestedProductIds.has(String(product.id)));
      };
      if (body.publish !== true) return respond({
        ok: true,
        dryRun: true,
        eligible: eligible.length,
        allowedToCreate: eligible.filter(allowNewOffer).length,
        publicationMode: 'manual_selection',
        blocked: deduplicated.items.length - eligible.length,
        duplicates: deduplicated.conflicts.length,
      });
      const batchSize = body.backgroundWorker === true ? 1 : Math.max(1, Math.min(100, Number(body.batchSize) || 50));
      let sent = 0, created = 0, unconfirmed = 0, updatedCount = 0, closed = 0, reopened = 0, skippedNew = 0, awaitingPrevious = 0;
      let lastRequestId = '';
      let activeBatchProducts = [];
      const writtenProductIds = new Set();
      const pendingCommands = [];
      const productUpdates = new Map();
      const rememberProductUpdates = (updates = []) => {
        for (const update of Array.isArray(updates) ? updates : []) {
          const id = String(update?.productId || '');
          if (!id) continue;
          const previous = productUpdates.get(id) || {};
          productUpdates.set(id, {
            productId: id,
            fields: { ...(previous.fields || {}), ...(update.fields || {}) },
            readbackConfirmed: update.readbackConfirmed === true || previous.readbackConfirmed === true,
            confirmedAt: update.confirmedAt || previous.confirmedAt || '',
          });
        }
      };
      const recordProductFailure = async (product, error, phase, { decisionRequired = false } = {}) => {
        const safe = safeError(error), productId = String(product?.id || '');
        operationFailures.push({ productId, phase, error: safe.message, code: safe.code || 'von_halsky_product_operation_failed' });
        if (!product) return;
        const timestamp = new Date().toISOString(), nextRetryAt = new Date(Date.now() + 15 * 60_000).toISOString();
        rememberProductUpdates(await updateProductPublication([product], decisionRequired ? 'decision_required' : 'retry', {
          timestamp,
          error: safe.message,
          nextRetryAt: decisionRequired ? '' : nextRetryAt,
        }).catch(() => []));
        await progress({
          id: `editorial:${product.id}:vonHalsky:${String(product.vonHalskyEditorialSyncRunId || product.vonHalskyEditorialSyncPendingAt || Date.now()).slice(0, 64)}`,
          runId: product.vonHalskyEditorialSyncRunId,
          productId,
          productName: String(product.nazwa || product.name || '').slice(0, 180),
          channel: 'vonHalsky',
          action: 'publikacja treści w kanale',
          phase,
          status: 'failed',
          target: 'katalog InPost Von Halsky',
          targetRef: product.vonHalskyOfferId || product.externalId || product.sku || productId,
          error: safe.message,
          nextRetryAt: decisionRequired ? '' : nextRetryAt,
          message: decisionRequired
            ? `Zatrzymano wyłącznie tę kartotekę do decyzji; żadna cudza oferta nie została zmieniona. ${safe.message}`
            : `Ten produkt odłożono do naprawy; pozostałe pozycje są nadal wykonywane. ${safe.message}`,
        }).catch(() => {});
      };
      try {
        let remoteResult = await api.listOffers();
        // Jedynym źródłem prawdy o ofercie jest aktualny odczyt API. Potwierdzeń
        // operacji zbiorczych nie dokładamy do listy ofert, dopóki GET /offers
        // faktycznie ich nie zwróci.
        let remoteOffers = (Array.isArray(remoteResult.data) ? remoteResult.data : []).map(remoteOfferSummary);
        const remoteIndex = preferredVonHalskyOffers(remoteOffers);
        const remoteResolutionForItem = (item = {}) => resolveVonHalskyRemoteOffer({
          externalId: item.externalId,
          sku: item.externalId,
          gtin: item.gtin,
          manufacturerCode: item.manufacturerCode,
          brand: item.brand,
        }, remoteIndex);
        const remoteForItem = (item = {}) => remoteResolutionForItem(item).offer;
        lastRequestId = remoteResult.requestId || '';
        const existing = deduplicated.items.filter((item) => remoteForItem(item));
        const remoteIdentityConflicts = eligible.filter((item) => {
          const resolution = remoteResolutionForItem(item);
          return !resolution.offer && resolution.conflicts.length > 0;
        });
        let resolvedIdentityConflicts = 0;
        for (const item of remoteIdentityConflicts) {
          const resolution = remoteResolutionForItem(item);
          const product = productForItem(item);
          const channelExternalId = collisionSafeExternalId(item, product, remoteIndex, pendingCommandExternalIds);
          if (channelExternalId && product && typeof saveProductFields === 'function') {
            const identityFields = {
              vonHalskyExternalId: channelExternalId,
              vonHalskyExternalIdReason: 'automatic-brand-sku-collision',
              vonHalskyExternalIdVerifiedAt: new Date().toISOString(),
            };
            await saveProductFields({
              productId: String(product.id),
              fields: identityFields,
              mutationId: `von-halsky-external-id-collision:${product.id}:${channelExternalId}`,
              actor: 'von-halsky-api',
              area: 'von-halsky-identity-repair',
            });
            Object.assign(product, identityFields);
            item.externalId = channelExternalId;
            item.sku = channelExternalId;
            resolvedIdentityConflicts += 1;
            await progress({
              id: `von-halsky-identity:${product.id}:${channelExternalId}`,
              productId: String(product.id),
              productName: String(product.nazwa || product.name || '').slice(0, 180),
              channel: 'vonHalsky',
              action: 'naprawa tożsamości kanału',
              phase: 'external_id_collision_resolved',
              status: 'confirmed',
              target: 'kartoteka InPost Von Halsky',
              targetRef: channelExternalId,
              fields: Object.keys(identityFields),
              message: `Kod ${resolution.conflicts[0]?.localGtin ? 'produktu' : 'sprzedawcy'} kolidował z inną marką. Zapisano osobny identyfikator kanału ${channelExternalId}; centralny SKU pozostał bez zmian.`,
            }).catch(() => {});
            continue;
          }
          const conflictingOfferId = String(resolution.conflicts[0]?.offerId || 'API');
          const error = Object.assign(
            new Error(`Konflikt tożsamości: EXTERNAL_ID/SKU ${item.externalId} wskazuje ofertę ${conflictingOfferId}, ale EAN lub producent nie zgadza się z kartoteką. Aktualizacja została bezpiecznie zablokowana.`),
            { code: 'von_halsky_identity_conflict', status: 409 },
          );
          await recordProductFailure(productForItem(item), error, 'identity_conflict', { decisionRequired: true });
        }
        const createCandidates = eligible.filter((item) => {
          const resolution = remoteResolutionForItem(item);
          return !resolution.offer && resolution.conflicts.length === 0 && allowNewOffer(item) && !pendingCommandExternalIds.has(String(item.externalId));
        });
        awaitingPrevious = eligible.filter((item) => {
          const resolution = remoteResolutionForItem(item);
          return !resolution.offer && resolution.conflicts.length === 0 && allowNewOffer(item) && pendingCommandExternalIds.has(String(item.externalId));
        }).length;
        skippedNew = eligible.filter((item) => !remoteForItem(item) && !allowNewOffer(item)).length;

        for (const item of existing) {
          const product = productForItem(item), remote = remoteForItem(item);
          activeBatchProducts = product ? [product] : [];
          try {
            if (
              product
              && remote?.offerId
              && String(product.vonHalskyOfferId || '') !== String(remote.offerId)
              && typeof saveProductFields === 'function'
            ) {
              const linkFields = { vonHalskyOfferId: String(remote.offerId) };
              const linked = await saveProductFields({
                productId: String(product.id),
                fields: linkFields,
                mutationId: `von-halsky-offer-link-existing:${product.id}:${remote.offerId}`,
                actor: 'von-halsky-api',
                area: 'von-halsky-offer-link',
              });
              rememberProductUpdates([{
                productId: String(product.id),
                fields: linkFields,
                readbackConfirmed: linked?.publication?.readbackConfirmed === true,
                confirmedAt: new Date().toISOString(),
              }]);
            }
            if (!item.available) {
              if (!['CLOSED', 'SOLDOUT'].includes(remote.status)) {
                const result = await api.setOfferOpen(remote.offerId, false);
                lastRequestId = result.requestId || lastRequestId;
                remote.status = 'CLOSED';
                closed += 1;
              }
              continue;
            }
            if (['CLOSED', 'INACTIVE'].includes(remote.status) && state.settings.automaticResume !== false) {
              const result = await api.setOfferOpen(remote.offerId, true);
              lastRequestId = result.requestId || lastRequestId;
              remote.status = 'PENDING';
              reopened += 1;
            }
            if (!item.readiness.publishable) continue;
            const contentDue = body.forceContent === true || requestedProductIds.has(String(product?.id || '')) || product?.vonHalskyEditorialSyncPending === true;
            if (contentDue) {
              const proposal = vonHalskyOfferProposal(item);
              const { externalId: _externalId, ...patch } = proposal;
              const result = await api.updateOffer(remote.offerId, patch);
              lastRequestId = result.requestId || lastRequestId;
              updatedCount += 1;
              writtenProductIds.add(String(product?.id || ''));
              rememberProductUpdates(await updateProductPublication([product], 'publishing', {
                timestamp: new Date().toISOString(),
                receiptId: result.requestId || lastRequestId,
                targetRef: remote.offerId,
              }));
            }
          } catch (error) {
            await recordProductFailure(product, error, 'existing_offer_update_failed');
          }
        }

        if (state.settings.automaticPriceSync !== false) {
          const prices = existing.filter((item) => item.available && Number(item.price) > 0).map((item) => ({
            offerId: remoteForItem(item).offerId,
            price: { amount: Number(Number(item.price).toFixed(2)), currency: item.currency || 'PLN' },
          }));
          for (let offset = 0; offset < prices.length; offset += batchSize) {
            const part = prices.slice(offset, offset + batchSize);
            try {
              const result = await api.updatePrices(part);
              lastRequestId = result.requestId || lastRequestId;
              updatedCount += part.length;
            } catch (error) {
              for (const price of part) {
                const item = existing.find((candidate) => String(remoteForItem(candidate)?.offerId || '') === String(price.offerId || ''));
                await recordProductFailure(item ? productForItem(item) : null, error, 'price_update_failed');
              }
            }
          }
        }
        if (state.settings.automaticStockSync !== false) {
          const stocks = existing
            .filter((item) => remoteForItem(item).status !== 'SOLDOUT' || state.settings.automaticResume !== false)
            .map((item) => ({
            offerId: remoteForItem(item).offerId,
            stock: { quantity: item.available ? item.stock : 0, unit: 'UNIT' },
          }));
          for (let offset = 0; offset < stocks.length; offset += batchSize) {
            const part = stocks.slice(offset, offset + batchSize);
            try {
              const result = await api.updateStocks(part);
              lastRequestId = result.requestId || lastRequestId;
              updatedCount += part.length;
            } catch (error) {
              for (const stock of part) {
                const item = existing.find((candidate) => String(remoteForItem(candidate)?.offerId || '') === String(stock.offerId || ''));
                await recordProductFailure(item ? productForItem(item) : null, error, 'stock_update_failed');
              }
            }
          }
        }

        for (let offset = 0; offset < createCandidates.length; offset += batchSize) {
          const batch = createCandidates.slice(offset, offset + batchSize);
          activeBatchProducts = batch.map((item) => productForItem(item)).filter(Boolean);
          await Promise.all(activeBatchProducts.map((product) => progress({
            id: `editorial:${product.id}:vonHalsky:${String(product.vonHalskyEditorialSyncRunId || product.vonHalskyEditorialSyncPendingAt || Date.now()).slice(0, 64)}`,
            runId: product.vonHalskyEditorialSyncRunId, productId: String(product.id), productName: String(product.nazwa || product.name || '').slice(0, 180),
            channel: 'vonHalsky', action: 'publikacja treści w kanale', phase: 'sending_to_von_halsky', status: 'running',
            target: 'katalog InPost Von Halsky', targetRef: product.externalId || product.sku || String(product.id),
            message: 'Wysyłam dozwoloną kartę produktu do API Von Halsky i czekam na identyfikator polecenia.',
          })));
          const proposals = batch.map((item) => vonHalskyOfferProposal(item));
          let result;
          try {
            result = await api.createOffers(proposals);
          } catch (error) {
            for (const product of activeBatchProducts) await recordProductFailure(product, error, 'offer_create_failed');
            activeBatchProducts = [];
            continue;
          }
          lastRequestId = result.requestId || lastRequestId;
          const receipts = vonHalskyCreateReceipts(result.payload);
          sent += proposals.length;
          const at = new Date().toISOString();
          const confirmedReceipts = new Map();
          for (const [productIndex, product] of activeBatchProducts.entries()) {
            const externalId = vonHalskyOfferProjection(product, state.settings).externalId;
            const receipt = receipts.find((item) => String(item?.externalId || '') === externalId) || receipts[productIndex] || {};
            const receiptId = String(receipt.commandId || receipt.offerId || '');
            if (!receiptId) {
              unconfirmed += 1;
              const error = 'API przyjęło żądanie HTTP, ale nie zwróciło identyfikatora polecenia ani oferty. Produkt nie został oznaczony jako wysłany.';
              rememberProductUpdates(await updateProductPublication([product], 'retry', {
                timestamp: at,
                error,
                nextRetryAt: new Date(Date.now() + 15 * 60_000).toISOString(),
              }));
              await progress({
                id: `editorial:${product.id}:vonHalsky:${String(product.vonHalskyEditorialSyncRunId || product.vonHalskyEditorialSyncPendingAt || Date.now()).slice(0, 64)}`,
                runId: product.vonHalskyEditorialSyncRunId, productId: String(product.id), productName: String(product.nazwa || product.name || '').slice(0, 180),
                channel: 'vonHalsky', action: 'publikacja treści w kanale', phase: 'provider_receipt_missing', status: 'failed',
                target: 'katalog InPost Von Halsky', targetRef: externalId,
                error, nextRetryAt: new Date(Date.now() + 15 * 60_000).toISOString(),
                message: error,
              });
              continue;
            }
            created += 1;
            writtenProductIds.add(String(product.id));
            confirmedReceipts.set(String(product.id), { ...receipt, externalId });
            if (receipt.offerId && typeof saveProductFields === 'function') {
              const linkFields = {
                vonHalskyOfferId: String(receipt.offerId),
                vonHalskyCommandId: String(receipt.commandId || ''),
              };
              const linked = await saveProductFields({
                productId: String(product.id),
                fields: linkFields,
                mutationId: `von-halsky-offer-link:${product.id}:${receipt.offerId}`,
                actor: 'von-halsky-api',
                area: 'von-halsky-offer-link',
              });
              rememberProductUpdates([{
                productId: String(product.id),
                fields: linkFields,
                readbackConfirmed: linked?.publication?.readbackConfirmed === true,
                confirmedAt: at,
              }]);
            }
            const command = commandReceipt(receipt, 'offer-create', String(product.id));
            if (command) pendingCommands.push({
              ...command,
              productId: String(product.id),
              externalId,
              offerId: String(receipt.offerId || ''),
            });
            rememberProductUpdates(await updateProductPublication([product], 'publishing', {
              timestamp: at,
              receiptId,
              targetRef: String(receipt.offerId || externalId),
            }));
          }
          await Promise.all(activeBatchProducts.filter((product) => confirmedReceipts.has(String(product.id))).map((product) => {
            const receipt = confirmedReceipts.get(String(product.id));
            return progress({
              id: `editorial:${product.id}:vonHalsky:${String(product.vonHalskyEditorialSyncRunId || product.vonHalskyEditorialSyncPendingAt || Date.now()).slice(0, 64)}`,
              runId: product.vonHalskyEditorialSyncRunId, productId: String(product.id), productName: String(product.nazwa || product.name || '').slice(0, 180),
              channel: 'vonHalsky', action: 'publikacja treści w kanale', phase: 'accepted_by_von_halsky', status: 'running',
              target: 'katalog InPost Von Halsky', targetRef: receipt.offerId || receipt.externalId,
              receiptId: receipt.commandId || receipt.offerId,
              message: 'API przyjęło polecenie. Oferta pozostaje w weryfikacji do chwili potwierdzenia przez aktualny katalog kanału.',
            });
          }));
          activeBatchProducts = [];
        }
        const readbackPendingProductIds = [];
        if (requestedProductIds.size && (sent || updatedCount || reopened || closed || awaitingPrevious)) {
          remoteResult = await api.listOffers();
          remoteOffers = (Array.isArray(remoteResult.data) ? remoteResult.data : []).map(remoteOfferSummary);
          lastRequestId = remoteResult.requestId || lastRequestId;
        }
        if (requestedProductIds.size) {
          const readbackIndex = preferredVonHalskyOffers(remoteOffers);
          const alreadyFailed = new Set(operationFailures.map((failure) => String(failure?.productId || '')));
          for (const item of eligible.filter((candidate) => requestedProductIds.has(String(productForItem(candidate)?.id || '')))) {
            const product = productForItem(item), productId = String(product?.id || '');
            if (!productId || alreadyFailed.has(productId)) continue;
            const resolution = resolveVonHalskyRemoteOffer({
              externalId: item.externalId,
              sku: item.externalId,
              gtin: item.gtin,
              manufacturerCode: item.manufacturerCode,
              brand: item.brand,
            }, readbackIndex);
            const remote = resolution.offer;
            const status = remote ? vonHalskyEffectiveOfferStatus(remote) : '';
            if (!remote || ['PENDING', 'PROCESSING'].includes(status)) {
              readbackPendingProductIds.push(productId);
              continue;
            }
            if (['VERIFICATION_ERROR', 'REJECTED', 'ERROR'].includes(status)) {
              if (writtenProductIds.has(productId)) {
                readbackPendingProductIds.push(productId);
                continue;
              }
              const message = vonHalskyOfferValidationMessages(remote).join(' • ') || `Kanał zwrócił status ${status}.`;
              const error = Object.assign(new Error(message), { code: `von_halsky_${status.toLowerCase()}`, status: 422 });
              await recordProductFailure(product, error, 'provider_readback_failed');
              alreadyFailed.add(productId);
              continue;
            }
            if (status === 'PUBLISHED') {
              const confirmedAt = new Date().toISOString();
              const confirmedFields = remote.offerId ? { vonHalskyOfferId: String(remote.offerId) } : {};
              if (remote.offerId && typeof saveProductFields === 'function') {
                await saveProductFields({
                  productId,
                  fields: confirmedFields,
                  mutationId: `von-halsky-published-readback:${productId}:${remote.offerId}`,
                  actor: 'von-halsky-api',
                  area: 'von-halsky-publication-readback',
                });
              }
              rememberProductUpdates(await updateProductPublication([product], 'confirmed', {
                timestamp: confirmedAt,
                targetRef: String(remote.offerId || item.externalId),
              }));
            }
          }
        }
        const at = new Date().toISOString();
        const updated = await mutate((current) => {
          current.offers = remoteOffers;
          current.commands = mergeBy(current.commands, pendingCommands, (item) => item?.commandId).slice(0, 500);
          const pendingCommandCount = current.commands.filter((item) => (
            !['SUCCESS', 'FAILURE', 'FAILED', 'CANCELLED', 'NOT_FOUND'].includes(String(item?.status || 'PENDING').toUpperCase())
          )).length;
          const effectiveStatuses = remoteOffers.map((item) => vonHalskyEffectiveOfferStatus(item));
          const truth = {
            total: remoteOffers.length,
            published: effectiveStatuses.filter((status) => status === 'PUBLISHED').length,
            pending: effectiveStatuses.filter((status) => ['PENDING', 'PROCESSING'].includes(status)).length,
            verificationErrors: effectiveStatuses.filter((status) => status === 'VERIFICATION_ERROR').length,
            rejected: effectiveStatuses.filter((status) => ['REJECTED', 'ERROR'].includes(status)).length,
          };
          truth.problems = truth.verificationErrors + truth.rejected;
          current.sync = {
            ...current.sync,
            status: 'connected',
            lastCatalogAt: at,
            lastCatalogVerifiedAt: at,
            lastCatalogCount: truth.total,
            remoteOfferCount: truth.total,
            publishedOfferCount: truth.published,
            pendingOfferCount: truth.pending,
            verificationErrorOfferCount: truth.verificationErrors,
            problemOfferCount: truth.problems,
            pendingCommandCount,
            rejectedOfferCount: truth.rejected,
            lastError: '',
            lastRequestId,
          };
          return current;
        });
        const message = `Potwierdzone przyjęcie ${created}, bez potwierdzenia ${unconfirmed}, oczekujące wcześniejsze ${awaitingPrevious}, aktualizacje ${updatedCount}, błędy odłożone ${operationFailures.length}, zamknięte ${closed}, wznowione ${reopened}; pominięte nowe ${skippedNew}.`;
        await recordDiagnostic({ operation: 'catalog-sync', status: operationFailures.length ? 'warning' : 'ok', message, requestId: lastRequestId });
        return respond({
          ok: true, sent, created, accepted: created, unconfirmed, awaitingPrevious, updated: updatedCount, closed, reopened, skippedNew,
          failed: operationFailures.length,
          failedProducts: operationFailures,
          readbackPendingProductIds,
          publicationConfirmed: requestedProductIds.size > 0 && !operationFailures.length && !readbackPendingProductIds.length,
          publicationStatus: operationFailures.length ? 'readback_failed' : readbackPendingProductIds.length ? 'accepted_pending_readback' : requestedProductIds.size ? 'readback_confirmed' : 'no_write',
          publicationMode: 'manual_selection',
          blocked: deduplicated.items.length - eligible.length,
          duplicates: deduplicated.conflicts.length + Math.max(0, remoteIdentityConflicts.length - resolvedIdentityConflicts),
          remoteIdentityConflicts: Math.max(0, remoteIdentityConflicts.length - resolvedIdentityConflicts),
          offers: updated.offers,
          sync: updated.sync,
          productUpdates: [...productUpdates.values()],
        });
      } catch (error) {
        const safe = safeError(error);
        const retryProducts = activeBatchProducts.filter((product) => product.vonHalskyEditorialSyncPending === true || requestedProductIds.has(String(product.id)));
        const failedAt = new Date().toISOString(), nextRetryAt = new Date(Date.now() + 15 * 60_000).toISOString();
        await updateProductPublication(retryProducts, 'retry', { timestamp: failedAt, error: safe.message, nextRetryAt }).catch(() => {});
        await Promise.all(retryProducts.map((product) => progress({
          id: `editorial:${product.id}:vonHalsky:${String(product.vonHalskyEditorialSyncRunId || product.vonHalskyEditorialSyncPendingAt || Date.now()).slice(0, 64)}`,
          runId: product.vonHalskyEditorialSyncRunId, productId: String(product.id), productName: String(product.nazwa || product.name || '').slice(0, 180),
          channel: 'vonHalsky', action: 'publikacja treści w kanale', phase: 'retry_scheduled', status: 'failed',
          target: 'katalog InPost Von Halsky', targetRef: product.externalId || product.sku || String(product.id),
          error: safe.message, nextRetryAt, message: 'Kanał nie potwierdził zmiany. Niczego nie oznaczono jako opublikowane; zaplanowano ponowienie.',
        })));
        await mutate((current) => {
          current.sync = { ...current.sync, status: 'error', lastError: safe.message };
          return current;
        });
        await recordDiagnostic({
          operation: 'catalog-sync',
          status: 'error',
          message: safe.message,
          requestId: String(safe.details?.requestId || ''),
        });
        return respond({ ok: false, sent, created, accepted: created, unconfirmed, updated: updatedCount, closed, reopened, skippedNew, error: safe.message, code: safe.code, details: safe.details }, safe.status);
      }
    }


    return null;
  };
}
