import crypto from 'node:crypto';

const CHANNELS = new Set(['store', 'allegro', 'von_halsky']);
const PUBLICATION_CHANNELS = new Set(['allegro', 'von_halsky']);
const text = (value, max = 1000) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');

export function createChannelPublicationStateRepository({
  pool = null,
  namespace = 'artway-sklep',
  now = () => new Date(),
} = {}) {
  const ns = text(namespace, 120) || 'artway-sklep';
  const enabled = Boolean(pool && typeof pool.query === 'function');
  const validChannel = (value, publicationOnly = false) => {
    const channel = text(value, 40);
    const allowed = publicationOnly ? PUBLICATION_CHANNELS : CHANNELS;
    if (!allowed.has(channel)) throw new TypeError(`Nieobsługiwany kanał publikacji: ${channel || '(brak)'}`);
    return channel;
  };

  async function getCategorySchema(channelValue, categoryIdValue, { allowExpired = false } = {}) {
    if (!enabled) return null;
    const channel = validChannel(channelValue, true);
    const categoryId = text(categoryIdValue, 160);
    if (!categoryId) return null;
    const result = await pool.query(`
      SELECT schema_version,schema_hash,data,fetched_at,expires_at
      FROM artway_channel_category_schemas
      WHERE namespace=$1 AND channel=$2 AND category_id=$3
    `, [ns, channel, categoryId]);
    if (!result.rowCount) return null;
    const row = result.rows[0];
    const expired = new Date(row.expires_at).getTime() <= now().getTime();
    if (expired && !allowExpired) return null;
    return {
      channel,
      categoryId,
      schemaVersion: row.schema_version,
      schemaHash: row.schema_hash,
      data: object(row.data),
      fetchedAt: row.fetched_at,
      expiresAt: row.expires_at,
      expired,
    };
  }

  async function putCategorySchema(channelValue, categoryIdValue, dataValue, { ttlMs = 24 * 60 * 60_000 } = {}) {
    if (!enabled) return null;
    const channel = validChannel(channelValue, true);
    const categoryId = text(categoryIdValue, 160);
    const data = object(dataValue);
    if (!categoryId) throw new TypeError('Schemat kategorii wymaga identyfikatora.');
    const schemaHash = hash(data);
    const fetchedAt = now();
    const expiresAt = new Date(fetchedAt.getTime() + Math.max(60_000, Number(ttlMs) || 0));
    const schemaVersion = `${fetchedAt.toISOString()}:${schemaHash.slice(0, 16)}`;
    await pool.query(`
      INSERT INTO artway_channel_category_schemas(
        namespace,channel,category_id,schema_version,schema_hash,data,fetched_at,expires_at
      ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
      ON CONFLICT(namespace,channel,category_id) DO UPDATE SET
        schema_version=EXCLUDED.schema_version,
        schema_hash=EXCLUDED.schema_hash,
        data=EXCLUDED.data,
        fetched_at=EXCLUDED.fetched_at,
        expires_at=EXCLUDED.expires_at
    `, [ns, channel, categoryId, schemaVersion, schemaHash, JSON.stringify(data), fetchedAt, expiresAt]);
    return { channel, categoryId, schemaVersion, schemaHash, data, fetchedAt, expiresAt, expired: false };
  }

  async function upsertState(input = {}) {
    if (!enabled) return null;
    const productId = text(input.productId, 160);
    const channel = validChannel(input.channel);
    if (!productId) throw new TypeError('Stan kanału wymaga identyfikatora produktu.');
    const result = await pool.query(`
      INSERT INTO artway_channel_product_state(
        namespace,product_id,channel,preparation_status,publication_status,
        category_id,category_schema_version,target_id,source_fingerprint,draft_fingerprint,
        last_error_code,last_error_text,prepared_at,publication_requested_at,
        provider_confirmed_at,readback_confirmed_at,metadata,updated_at
      ) VALUES(
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,NOW()
      )
      ON CONFLICT(namespace,product_id,channel) DO UPDATE SET
        preparation_status=EXCLUDED.preparation_status,
        publication_status=EXCLUDED.publication_status,
        category_id=CASE WHEN EXCLUDED.category_id<>'' THEN EXCLUDED.category_id ELSE artway_channel_product_state.category_id END,
        category_schema_version=CASE WHEN EXCLUDED.category_schema_version<>'' THEN EXCLUDED.category_schema_version ELSE artway_channel_product_state.category_schema_version END,
        target_id=CASE WHEN EXCLUDED.target_id<>'' THEN EXCLUDED.target_id ELSE artway_channel_product_state.target_id END,
        source_fingerprint=CASE WHEN EXCLUDED.source_fingerprint<>'' THEN EXCLUDED.source_fingerprint ELSE artway_channel_product_state.source_fingerprint END,
        draft_fingerprint=CASE WHEN EXCLUDED.draft_fingerprint<>'' THEN EXCLUDED.draft_fingerprint ELSE artway_channel_product_state.draft_fingerprint END,
        last_error_code=EXCLUDED.last_error_code,
        last_error_text=EXCLUDED.last_error_text,
        prepared_at=COALESCE(EXCLUDED.prepared_at,artway_channel_product_state.prepared_at),
        publication_requested_at=COALESCE(EXCLUDED.publication_requested_at,artway_channel_product_state.publication_requested_at),
        provider_confirmed_at=COALESCE(EXCLUDED.provider_confirmed_at,artway_channel_product_state.provider_confirmed_at),
        readback_confirmed_at=COALESCE(EXCLUDED.readback_confirmed_at,artway_channel_product_state.readback_confirmed_at),
        metadata=artway_channel_product_state.metadata || EXCLUDED.metadata,
        updated_at=NOW()
      RETURNING *
    `, [
      ns, productId, channel,
      text(input.preparationStatus || 'unknown', 80),
      text(input.publicationStatus || 'not_requested', 80),
      text(input.categoryId, 160),
      text(input.categorySchemaVersion, 200),
      text(input.targetId, 200),
      text(input.sourceFingerprint, 128),
      text(input.draftFingerprint || (input.draft ? hash(input.draft) : ''), 128),
      text(input.errorCode, 160),
      text(input.errorText, 2000),
      input.preparedAt || null,
      input.publicationRequestedAt || null,
      input.providerConfirmedAt || null,
      input.readbackConfirmedAt || null,
      JSON.stringify(object(input.metadata)),
    ]);
    return result.rows[0] || null;
  }

  async function recordReceipt(input = {}) {
    if (!enabled) return null;
    const channel = validChannel(input.channel, true);
    const productId = text(input.productId, 160);
    const idempotencyKey = text(input.idempotencyKey, 240);
    if (!productId || !idempotencyKey) throw new TypeError('Potwierdzenie kanału wymaga produktu i klucza idempotencji.');
    const receiptId = text(input.receiptId, 200)
      || crypto.createHash('sha256').update(`${ns}:${channel}:${idempotencyKey}`).digest('hex');
    const status = text(input.status || 'requested', 80);
    const result = await pool.query(`
      INSERT INTO artway_channel_publication_receipts(
        namespace,receipt_id,product_id,channel,operation,idempotency_key,
        request_fingerprint,provider_request_id,target_id,status,error_code,error_text,
        request_summary,response_summary,created_at,updated_at,confirmed_at
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,NOW(),NOW(),$15)
      ON CONFLICT(namespace,channel,idempotency_key) DO UPDATE SET
        provider_request_id=CASE WHEN EXCLUDED.provider_request_id<>'' THEN EXCLUDED.provider_request_id ELSE artway_channel_publication_receipts.provider_request_id END,
        target_id=CASE WHEN EXCLUDED.target_id<>'' THEN EXCLUDED.target_id ELSE artway_channel_publication_receipts.target_id END,
        status=EXCLUDED.status,
        error_code=EXCLUDED.error_code,
        error_text=EXCLUDED.error_text,
        response_summary=artway_channel_publication_receipts.response_summary || EXCLUDED.response_summary,
        updated_at=NOW(),
        confirmed_at=COALESCE(EXCLUDED.confirmed_at,artway_channel_publication_receipts.confirmed_at)
      RETURNING *
    `, [
      ns, receiptId, productId, channel,
      text(input.operation || 'publish', 80), idempotencyKey,
      text(input.requestFingerprint || hash(input.requestSummary), 128),
      text(input.providerRequestId, 240),
      text(input.targetId, 200), status,
      text(input.errorCode, 160), text(input.errorText, 2000),
      JSON.stringify(object(input.requestSummary)),
      JSON.stringify(object(input.responseSummary)),
      input.confirmedAt || (/confirmed|success|published/i.test(status) ? now() : null),
    ]);
    return result.rows[0] || null;
  }

  async function reconcilePendingReceiptsForProduct(input = {}) {
    if (!enabled) return 0;
    const channel = validChannel(input.channel, true);
    const productId = text(input.productId, 160);
    if (!productId) throw new TypeError('Uzgodnienie potwierdzeń wymaga identyfikatora produktu.');
    const status = text(input.status, 80);
    if (!['publishing', 'readback_confirmed', 'failed'].includes(status)) {
      throw new TypeError(`Nieobsługiwany stan uzgodnienia potwierdzeń: ${status || '(brak)'}`);
    }
    const confirmedAt = status === 'readback_confirmed' ? (input.confirmedAt || now()) : null;
    const responseSummary = object(input.responseSummary);
    const result = await pool.query(`
      UPDATE artway_channel_publication_receipts
      SET target_id=CASE WHEN $4<>'' THEN $4 ELSE target_id END,
          status=$5,
          error_code=$6,
          error_text=$7,
          response_summary=response_summary || $8::jsonb,
          updated_at=NOW(),
          confirmed_at=COALESCE($9,confirmed_at)
      WHERE namespace=$1 AND channel=$2 AND product_id=$3
        AND (
          status IN ('requested','queued','publishing','pending','processing')
          OR (
            $5='readback_confirmed'
            AND status='failed'
            AND $4<>''
            AND target_id=$4
            AND error_code='von_halsky_not_found'
          )
        )
    `, [
      ns, channel, productId, text(input.targetId, 200), status,
      text(input.errorCode, 160), text(input.errorText, 2000),
      JSON.stringify(responseSummary), confirmedAt,
    ]);
    return Number(result.rowCount || 0);
  }

  return Object.freeze({
    enabled,
    getCategorySchema,
    putCategorySchema,
    upsertState,
    recordReceipt,
    reconcilePendingReceiptsForProduct,
  });
}

export async function recordVonHalskyPublicationState({
  repository, productId, product = {}, status, details = {}, timestamp,
} = {}) {
  if (!repository?.upsertState) return;
  const publicationStatus = status === 'confirmed' ? 'confirmed' : status === 'retry' ? 'failed' : status;
  await repository.upsertState({
    productId,
    channel: 'von_halsky',
    preparationStatus: 'ready',
    publicationStatus,
    categoryId: product.vonHalskyCategoryId || '',
    targetId: details.targetRef || product.vonHalskyOfferId || '',
    errorCode: details.error ? 'von_halsky_publication_failed' : '',
    errorText: details.error || '',
    publicationRequestedAt: status === 'publishing' ? timestamp : null,
    providerConfirmedAt: status === 'confirmed' ? timestamp : null,
    readbackConfirmedAt: status === 'confirmed' ? timestamp : null,
    metadata: { receiptId: details.receiptId || '', nextRetryAt: details.nextRetryAt || '' },
  });
  if (!details.receiptId || !repository?.recordReceipt) return;
  await repository.recordReceipt({
    productId,
    channel: 'von_halsky',
    operation: 'publish',
    idempotencyKey: details.receiptId,
    providerRequestId: details.receiptId,
    targetId: details.targetRef || product.vonHalskyOfferId || '',
    status: status === 'confirmed' ? 'readback_confirmed' : status,
    errorCode: details.error ? 'von_halsky_publication_failed' : '',
    errorText: details.error || '',
    responseSummary: { readbackConfirmed: status === 'confirmed' },
    confirmedAt: status === 'confirmed' ? timestamp : null,
  });
}
