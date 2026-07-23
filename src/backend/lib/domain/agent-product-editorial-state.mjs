import { buildSharedProductDescriptionSections } from './product-content-layout.mjs';

const clean = (value = '', limit = 30_000) => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, limit);

export function editorialChannelForSpecialist(specialist = '') {
  if (['allegro_offer', 'allegro_compliance'].includes(specialist)) return 'allegro';
  if (['von_halsky_offer', 'von_halsky_compliance'].includes(specialist)) return 'vonHalsky';
  return 'store';
}

function aggregateStatus(states = {}, target = {}) {
  const names = ['store', 'vonHalsky', ...(target.allegro === true ? ['allegro'] : [])];
  const statuses = names.map((name) => states[name]?.status || 'queued');
  if (statuses.every((status) => status === 'ready')) return 'ready';
  if (statuses.some((status) => status === 'ready')) return 'partial_ready';
  if (statuses.some((status) => status === 'retry_pending')) return 'retry_pending';
  return 'queued';
}

function sourceMaterial(effective = {}, timestamp = '') {
  return {
    sourceUrl: clean(effective.sourceUrl || effective.producentUrl, 1000), fetchedAt: timestamp,
    title: clean(effective.nazwa || effective.name, 300), shortDescription: clean(effective.opisKrotki || effective.krotkiOpis, 4000),
    longDescription: clean(effective.opis, 20_000), producer: clean(effective.producent || effective.marka, 160),
    brand: clean(effective.marka || effective.producent, 160), category: clean(effective.kategoria, 180),
    ean: clean(effective.gtin || effective.ean, 80), producerCode: clean(effective.kodProducenta || effective.mpn, 160),
    parameters: effective.parametryProducenta || effective.parametryZrodla || effective.parametry || effective.parameters || {},
  };
}

export function buildEditorialPersistencePatch({
  effective = {}, patch = {}, run = {}, channel = editorialChannelForSpecialist(run.specialist),
  target = {}, fingerprint = '', promptVersion = '', timestamp = '', automatic = false,
  channelCompliance = {}, autoUpdateLinkedAllegroContent = true,
} = {}) {
  const merged = { ...effective, ...patch }, previousEditorial = effective.contentEditorial || {};
  const channelStates = { ...(previousEditorial.channelStates || {}) };
  channelStates[channel] = {
    status: 'ready', promptVersion, inputFingerprint: fingerprint, preparedAt: timestamp,
    runId: clean(run.id, 160), model: clean(run.model, 100), preparedBy: automatic ? 'autonomous-agent' : 'administrator-approved-agent',
    compliance: channelCompliance[channel] || { status: 'passed', violations: [] }, error: '',
  };
  const result = {
    ...patch,
    agentTextModel: run.model, agentTextReviewedAt: timestamp, agentTextRunId: run.id,
    agentTextMode: automatic ? 'autonomous-editorial' : 'approved',
    contentEditorial: {
      ...previousEditorial, status: aggregateStatus(channelStates, target), sourceRole: effective.sourceMaterial ? 'facts_only' : 'catalog_facts',
      channels: target.channels, targets: { store: true, vonHalsky: true, allegro: target.allegro === true },
      layoutPolicy: 'independent_channel_versions', promptVersion, inputFingerprint: fingerprint,
      preparedAt: timestamp, channelStates, warnings: [],
    },
    contentEditorialPreparedAt: timestamp,
    contentEditorialSource: automatic ? 'autonomous-agent-independent-channels' : 'approved-agent-independent-channels',
  };
  if (channel === 'store' && !effective.sourceMaterial) result.sourceMaterial = sourceMaterial(effective, timestamp);
  if (channel === 'allegro') {
    result.allegroDescriptionSections = buildSharedProductDescriptionSections({
      ...merged, nazwa: clean(merged.allegroTitle || merged.nazwa, 300), opis: clean(merged.allegroDescription, 30_000),
      allegroDescription: clean(merged.allegroDescription, 30_000),
    });
    if (target.allegro === true && autoUpdateLinkedAllegroContent) Object.assign(result, {
      allegroEditorialSyncPending: true, allegroEditorialSyncPendingAt: timestamp,
      allegroEditorialSyncRunId: run.id, allegroEditorialSyncState: 'queued', allegroEditorialSyncError: '',
    });
  }
  if (channel === 'vonHalsky') Object.assign(result, {
    vonHalskyContentMode: 'custom', vonHalskyContentUpdatedAt: timestamp,
    vonHalskyContentSource: 'agent-independent-von-halsky-content',
    vonHalskyEditorialSyncPending: true, vonHalskyEditorialSyncPendingAt: timestamp,
    vonHalskyEditorialSyncRunId: run.id, vonHalskyEditorialSyncState: 'queued', vonHalskyEditorialSyncError: '',
  });
  return result;
}

export function buildEditorialRetryPatch({
  product = {}, channel = 'store', target = {}, fingerprint = '', promptVersion = '',
  timestamp = '', retryAt = '', draft = null, error = '',
} = {}) {
  const previous = product.contentEditorial || {}, channelStates = { ...(previous.channelStates || {}) };
  channelStates[channel] = {
    ...(channelStates[channel] || {}), status: 'retry_pending', promptVersion, inputFingerprint: fingerprint,
    attemptedAt: timestamp, retryAt, retryCount: Math.min(100, Math.max(0, Number(channelStates[channel]?.retryCount) || 0) + 1),
    runId: clean(draft?.id, 160), model: clean(draft?.model, 100),
    warnings: [...(draft?.result?.warnings || []), ...(draft?.result?.missingFacts || []), error].map((item) => clean(item, 500)).filter(Boolean).slice(0, 20),
  };
  return {
    contentEditorial: {
      ...previous, status: aggregateStatus(channelStates, target), sourceRole: product.sourceMaterial ? 'facts_only' : 'catalog_facts',
      channels: target.channels, targets: { store: true, vonHalsky: true, allegro: target.allegro === true },
      layoutPolicy: 'independent_channel_versions', promptVersion, inputFingerprint: fingerprint, channelStates,
    },
    contentEditorialSource: 'autonomous-agent-independent-retry',
  };
}

