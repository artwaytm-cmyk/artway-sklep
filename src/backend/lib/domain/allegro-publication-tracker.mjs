import { createChannelPublicationStateRepository } from './channel-publication-state-repository.mjs';

const asError = (error) => ({
  code: error?.code || 'allegro_publication_failed',
  text: error?.message || String(error || 'Nieznany błąd publikacji Allegro'),
});

export function createAllegroPublicationTracker({
  repository,
  call,
  text,
  log = console.error,
} = {}) {
  const settle = (label, operations) => Promise.all(operations).catch((error) => {
    log(`allegro_channel_state_${label}`, error);
    return [];
  });

  async function loadCategoryParameters(req, categoryId = '') {
    const id = text(categoryId, 80).trim();
    if (!id) return { parameters: [], errors: [] };
    const cached = await repository.getCategorySchema('allegro', id).catch(() => null);
    if (cached?.data) return {
      parameters: Array.isArray(cached.data.parameters) ? cached.data.parameters : [],
      errors: [],
      schemaVersion: cached.schemaVersion,
      cached: true,
    };
    try {
      const raw = await call(req, `/sale/categories/${encodeURIComponent(id)}/parameters`);
      const data = { parameters: Array.isArray(raw.parameters) ? raw.parameters : [] };
      const stored = await repository.putCategorySchema('allegro', id, data).catch(() => null);
      return { ...data, errors: [], schemaVersion: stored?.schemaVersion || '', cached: false };
    } catch (error) {
      const stale = await repository.getCategorySchema('allegro', id, { allowExpired: true }).catch(() => null);
      if (stale?.data) return {
        parameters: Array.isArray(stale.data.parameters) ? stale.data.parameters : [],
        errors: [{
          key: 'categoryParameters',
          status: error.status || 0,
          code: error.code || '',
          message: `Użyto ostatniego potwierdzonego schematu kategorii; odświeżenie API nie powiodło się: ${error.message || String(error)}`,
          stale: true,
        }],
        schemaVersion: stale.schemaVersion,
        cached: true,
        stale: true,
      };
      return {
        parameters: [],
        errors: [{
          key: 'categoryParameters',
          status: error.status || 0,
          code: error.code || '',
          message: error.message || String(error),
        }],
      };
    }
  }

  const prepared = ({ productId, prepared: result, product }) => settle('prepare', [
    repository.upsertState({
      productId,
      channel: 'allegro',
      preparationStatus: result.missing.length ? 'needs_data' : 'ready',
      publicationStatus: 'not_requested',
      categoryId: result.payload?.category?.id || product.allegroCategoryId || '',
      categorySchemaVersion: result.categorySchemaVersion || '',
      draft: result.payload,
      preparedAt: new Date(),
      metadata: {
        missing: result.missing.slice(0, 50),
        catalogProductId: result.catalogMatch?.selected?.id || '',
      },
    }),
  ]);

  const requested = ({ productId, prepared: result, draft, existing, idempotencyKey }) => settle('request', [
    repository.upsertState({
      productId,
      channel: 'allegro',
      preparationStatus: 'ready',
      publicationStatus: 'requested',
      categoryId: draft?.category?.id || '',
      categorySchemaVersion: result.categorySchemaVersion || '',
      draft,
      publicationRequestedAt: new Date(),
    }),
    repository.recordReceipt({
      productId,
      channel: 'allegro',
      operation: existing ? 'update' : 'create',
      idempotencyKey,
      status: 'requested',
      requestSummary: {
        categoryId: draft?.category?.id || '',
        catalogProductId: draft?.productSet?.[0]?.product?.id || '',
        existingOfferId: existing?.offer?.id || '',
      },
    }),
  ]);

  const failed = ({ productId, prepared: result, draft, existing, idempotencyKey, error }) => {
    const failure = asError(error);
    return settle('failure', [
      repository.upsertState({
        productId,
        channel: 'allegro',
        preparationStatus: result?.missing?.length ? 'needs_data' : 'ready',
        publicationStatus: 'failed',
        categoryId: draft?.category?.id || '',
        categorySchemaVersion: result?.categorySchemaVersion || '',
        errorCode: failure.code,
        errorText: failure.text,
        metadata: { missing: result?.missing || [] },
      }),
      repository.recordReceipt({
        productId,
        channel: 'allegro',
        operation: existing ? 'update' : 'create',
        idempotencyKey,
        status: 'failed',
        errorCode: failure.code,
        errorText: failure.text,
        responseSummary: {
          status: Number(error?.status) || 500,
          allegroErrors: Array.isArray(error?.allegro?.errors) ? error.allegro.errors.slice(0, 20) : [],
        },
      }),
    ]);
  };

  const unconfirmed = ({ productId, prepared: result, draft, existing, idempotencyKey, responseMeta, error }) => settle('unconfirmed', [
    repository.upsertState({
      productId,
      channel: 'allegro',
      preparationStatus: 'ready',
      publicationStatus: 'provider_unconfirmed',
      categoryId: draft?.category?.id || '',
      categorySchemaVersion: result?.categorySchemaVersion || '',
      errorCode: error.code,
      errorText: error.message,
    }),
    repository.recordReceipt({
      productId,
      channel: 'allegro',
      operation: existing ? 'update' : 'create',
      idempotencyKey,
      providerRequestId: responseMeta?.location || '',
      status: 'provider_unconfirmed',
      errorCode: error.code,
      errorText: error.message,
    }),
  ]);

  const confirmed = ({
    productId, prepared: result, draft, existing, idempotencyKey,
    responseMeta, offerId, verifiedOffer, publicationWait,
  }) => {
    const confirmedAt = new Date();
    return settle('success', [
      repository.upsertState({
        productId,
        channel: 'allegro',
        preparationStatus: 'ready',
        publicationStatus: 'confirmed',
        categoryId: draft?.category?.id || '',
        categorySchemaVersion: result.categorySchemaVersion || '',
        targetId: offerId,
        draft,
        providerConfirmedAt: confirmedAt,
        readbackConfirmedAt: verifiedOffer?.id ? confirmedAt : null,
        metadata: {
          mode: existing ? 'updated' : 'created',
          catalogProductId: draft?.productSet?.[0]?.product?.id || '',
        },
      }),
      repository.recordReceipt({
        productId,
        channel: 'allegro',
        operation: existing ? 'update' : 'create',
        idempotencyKey,
        providerRequestId: responseMeta?.location || '',
        targetId: offerId,
        status: verifiedOffer?.id ? 'readback_confirmed' : 'provider_confirmed',
        responseSummary: {
          offerId,
          httpStatus: responseMeta?.status || (existing ? 200 : 201),
          publicationConfirmed: publicationWait?.completed !== false,
        },
        confirmedAt,
      }),
    ]);
  };

  return { loadCategoryParameters, prepared, requested, failed, unconfirmed, confirmed };
}

export function createAllegroPublicationInfrastructure({ pool, namespace, call, text } = {}) {
  const channelPublicationState = createChannelPublicationStateRepository({ pool, namespace });
  return {
    channelPublicationState,
    allegroPublicationTracker: createAllegroPublicationTracker({
      repository: channelPublicationState,
      call,
      text,
    }),
  };
}
