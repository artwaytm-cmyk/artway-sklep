const CHANNELS = new Set(['all', 'store', 'allegro', 'von_halsky']);
const STATUSES = new Set(['all', 'working', 'ready', 'needs_data', 'decision', 'not_started']);
const LISTING = new Set(['all', 'ready_to_list', 'needs_update', 'already_listed', 'hidden']);

function text(value = '', limit = 160) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, limit);
}

function integer(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.trunc(parsed))) : fallback;
}

export function agentProductReportOptions(raw = {}) {
  const channel = text(raw.channel, 30).toLowerCase();
  const status = text(raw.status, 30).toLowerCase();
  const listing = text(raw.listing, 30).toLowerCase();
  return Object.freeze({
    channel: CHANNELS.has(channel) ? channel : 'all',
    status: STATUSES.has(status) ? status : 'all',
    listing: LISTING.has(listing) ? listing : 'all',
    query: text(raw.query, 120),
    page: integer(raw.page, 1, 1, 100_000),
    limit: integer(raw.limit, 50, 10, 250),
  });
}

const REPORT_CTE = `
  WITH latest_task AS (
    SELECT DISTINCT ON (product_id)
      product_id,status task_status,operation task_operation,updated_at task_updated_at,result task_result
    FROM artway_allegro_preparation_tasks
    WHERE namespace=$1
    ORDER BY product_id,updated_at DESC,task_id DESC
  ),
  base AS (
    SELECT
      p.product_id,p.name,p.producer,p.ean,p.external_id,p.sale_available,p.has_allegro,
      p.allegro_status,p.updated_at,p.search_text,p.data,
      COALESCE(t.task_status,'') task_status,
      COALESCE(t.task_operation,'') task_operation,
      t.task_updated_at,
      COALESCE(t.task_result,'{}'::jsonb) task_result,
      COALESCE(review.review_status,'') review_status,
      review.confirmed_at review_confirmed_at,
      review.verification_due_at review_verification_due_at,
      COALESCE(review.reason,'') review_reason,
      COALESCE(review.saved_fields,'[]'::jsonb) review_saved_fields,
      review.updated_at review_updated_at,
      COALESCE(p.data->>'contentEditorialPreparedAt','')<>'' store_prepared,
      (
        COALESCE(p.data->>'contentEditorialPreparedAt','')<>''
        AND length(trim(COALESCE(p.data->>'opisKrotki','')))>20
        AND length(trim(COALESCE(p.data->>'opis','')))>80
      ) store_ready,
      (
        COALESCE(p.data->>'allegroAgentPreparedAt','')<>''
        OR COALESCE(p.data->>'allegroAgentPreparationStatus','')<>''
      ) allegro_prepared,
      COALESCE(p.data->>'allegroAgentPreparationStatus','') IN ('ready','published') allegro_ready,
      (
        COALESCE(p.data->>'vonHalskyAgentPreparedAt','')<>''
        OR COALESCE(p.data->>'vonHalskyAgentStatus','')<>''
      ) von_prepared,
      COALESCE(p.data->>'vonHalskyAgentStatus','')='ready' von_ready,
      lower(COALESCE(p.data->>'allegroEditorialSyncPending','false'))='true' needs_update
    FROM artway_product_records p
    LEFT JOIN latest_task t ON t.product_id=p.product_id
    LEFT JOIN artway_product_agent_state review
      ON review.namespace=p.namespace AND review.product_id=p.product_id
    WHERE p.namespace=$1 AND p.record_status='active'
  ),
  classified AS (
    SELECT *,
      CASE
        WHEN task_status IN ('pending','running') OR COALESCE(data->>'agentOnboardingStatus','')='processing' THEN 'working'
        WHEN task_status IN ('decision_required','failed')
          OR COALESCE(data->>'allegroAgentPreparationStatus','') IN ('decision_required','failed')
          OR COALESCE(data->>'vonHalskyAgentStatus','')='error'
          OR review_status='attention' THEN 'decision'
        WHEN review_status='stale' THEN 'needs_data'
        WHEN $2='all' AND review_status='confirmed'
          AND review_verification_due_at>NOW() THEN 'ready'
        WHEN $2='store' AND store_ready THEN 'ready'
        WHEN $2='allegro' AND allegro_ready THEN 'ready'
        WHEN $2='von_halsky' AND von_ready THEN 'ready'
        WHEN $2='all' AND store_ready AND allegro_ready AND von_ready THEN 'ready'
        WHEN $2='store' AND NOT store_prepared THEN 'not_started'
        WHEN $2='allegro' AND NOT allegro_prepared THEN 'not_started'
        WHEN $2='von_halsky' AND NOT von_prepared THEN 'not_started'
        WHEN $2='all' AND NOT store_prepared AND NOT allegro_prepared AND NOT von_prepared THEN 'not_started'
        ELSE 'needs_data'
      END work_status,
      (
        NOT has_allegro AND sale_available AND allegro_ready
        AND task_status NOT IN ('pending','running','decision_required','failed')
      ) ready_to_list
    FROM base
  )
`;

function listingClause(listing) {
  if (listing === 'ready_to_list') return 'ready_to_list=true';
  if (listing === 'needs_update') return 'has_allegro=true AND needs_update=true';
  if (listing === 'already_listed') return 'has_allegro=true';
  if (listing === 'hidden') return 'sale_available=false';
  return 'TRUE';
}

function row(record = {}) {
  const data = record.data && typeof record.data === 'object' ? record.data : {};
  const array = (value) => Array.isArray(value) ? value.map((item) => text(item, 100)).filter(Boolean).slice(0, 30) : [];
  return {
    productId: text(record.product_id, 120),
    name: text(record.name, 240),
    producer: text(record.producer, 180),
    ean: text(record.ean, 80),
    externalId: text(record.external_id, 160),
    image: text(data.zdjecie || data.image, 2000),
    sourceUrl: text(data.sourceUrl || data.producentUrl, 2000),
    saleAvailable: record.sale_available === true,
    hasAllegro: record.has_allegro === true,
    allegroStatus: text(record.allegro_status, 60),
    status: text(record.work_status, 30),
    task: {
      status: text(record.task_status, 40),
      operation: text(record.task_operation, 100),
      updatedAt: record.task_updated_at || null,
      missing: array(record.task_result?.missing || record.task_result?.missingFields),
    },
    store: {
      prepared: record.store_prepared === true,
      ready: record.store_ready === true,
      updatedAt: text(data.contentEditorialPreparedAt, 80),
      savedFields: array(data.contentEditorialSavedFields || data.agentTextSavedFields),
      shortLength: String(data.opisKrotki || '').trim().length,
      longLength: String(data.opis || '').trim().length,
    },
    allegro: {
      prepared: record.allegro_prepared === true,
      ready: record.allegro_ready === true,
      updatedAt: text(data.allegroAgentPreparedAt || data.allegroAgentPreparationConfirmedAt, 80),
      status: text(data.allegroAgentPreparationStatus, 50),
      savedFields: array(data.allegroAgentSavedFields),
      readyToList: record.ready_to_list === true,
      needsUpdate: record.needs_update === true,
    },
    vonHalsky: {
      prepared: record.von_prepared === true,
      ready: record.von_ready === true,
      updatedAt: text(data.vonHalskyAgentPreparedAt || data.vonHalskyAgentConfirmedAt, 80),
      status: text(data.vonHalskyAgentStatus, 50),
      savedFields: array(data.vonHalskyAgentSavedFields),
    },
    fullReview: {
      status: text(record.review_status, 40) || 'not_started',
      confirmedAt: record.review_confirmed_at || null,
      verificationDueAt: record.review_verification_due_at || null,
      reason: text(record.review_reason, 160),
      savedFields: array(record.review_saved_fields),
      current: text(record.review_status, 40) === 'confirmed'
        && Date.parse(record.review_verification_due_at || '') > Date.now(),
    },
    updatedAt: record.updated_at || null,
  };
}

export function createAgentProductReport({ pool, namespace = 'artway-sklep' } = {}) {
  const ns = text(namespace, 120) || 'artway-sklep';

  async function query(raw = {}) {
    const options = agentProductReportOptions(raw);
    if (!pool || typeof pool.query !== 'function') {
      return { available: false, options, summary: {}, items: [], total: 0, revision: '' };
    }
    const search = options.query ? `%${options.query.replace(/[%_\\]/g, '\\$&')}%` : '';
    const filters = [
      "($3::text='all' OR work_status=$3::text)",
      listingClause(options.listing),
      "($4::text='' OR search_text ILIKE $4::text ESCAPE '\\' OR product_id ILIKE $4::text ESCAPE '\\')",
    ].join(' AND ');
    const offset = (options.page - 1) * options.limit;
    const values = [ns, options.channel, options.status, search, options.limit, offset];
    const summaryValues = [ns, options.channel];
    const [summaryResult, itemsResult] = await Promise.all([
      pool.query(`${REPORT_CTE}
        SELECT
          COUNT(*)::bigint total,
          COUNT(*) FILTER(WHERE work_status='working')::bigint working,
          COUNT(*) FILTER(WHERE work_status='ready')::bigint ready,
          COUNT(*) FILTER(WHERE work_status='decision')::bigint decision,
          COUNT(*) FILTER(WHERE work_status='needs_data')::bigint needs_data,
          COUNT(*) FILTER(WHERE work_status='not_started')::bigint not_started,
          COUNT(*) FILTER(WHERE store_prepared)::bigint store_prepared,
          COUNT(*) FILTER(WHERE store_ready)::bigint store_ready,
          COUNT(*) FILTER(WHERE allegro_prepared)::bigint allegro_prepared,
          COUNT(*) FILTER(WHERE allegro_ready)::bigint allegro_ready,
          COUNT(*) FILTER(WHERE von_prepared)::bigint von_prepared,
          COUNT(*) FILTER(WHERE von_ready)::bigint von_ready,
          COUNT(*) FILTER(WHERE ready_to_list)::bigint ready_to_list,
          COUNT(*) FILTER(WHERE has_allegro AND needs_update)::bigint needs_update,
          COUNT(*) FILTER(WHERE review_status='confirmed' AND review_verification_due_at>NOW())::bigint full_review_confirmed,
          COUNT(*) FILTER(WHERE review_status='stale')::bigint full_review_stale,
          MAX(GREATEST(updated_at,COALESCE(task_updated_at,'epoch'::timestamptz),COALESCE(review_updated_at,'epoch'::timestamptz))) revision
        FROM classified`, summaryValues),
      pool.query(`${REPORT_CTE}
        SELECT *,COUNT(*) OVER() filtered_total
        FROM classified
        WHERE ${filters}
        ORDER BY
          CASE work_status WHEN 'working' THEN 0 WHEN 'decision' THEN 1 WHEN 'needs_data' THEN 2 WHEN 'ready' THEN 3 ELSE 4 END,
          GREATEST(updated_at,COALESCE(task_updated_at,'epoch'::timestamptz),COALESCE(review_updated_at,'epoch'::timestamptz)) DESC,
          product_id
        LIMIT $5 OFFSET $6`, values),
    ]);
    const summaryRow = summaryResult.rows[0] || {};
    const summary = Object.fromEntries(Object.entries(summaryRow)
      .filter(([key]) => key !== 'revision')
      .map(([key, value]) => [key, Number(value) || 0]));
    const total = Number(itemsResult.rows[0]?.filtered_total) || 0;
    return {
      available: true,
      options,
      summary,
      items: itemsResult.rows.map(row),
      total,
      page: options.page,
      limit: options.limit,
      pages: Math.max(1, Math.ceil(total / options.limit)),
      revision: summaryRow.revision ? new Date(summaryRow.revision).toISOString() : '',
    };
  }

  return Object.freeze({ query });
}
