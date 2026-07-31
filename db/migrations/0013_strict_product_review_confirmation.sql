-- Starszy channelStates.status='ready' mógł współistnieć z
-- complianceStatus='needs_review'. Pełne potwierdzenie nie może opierać się
-- na takim sprzecznym rekordzie. Odczyt jakości z readbackiem nadal jest
-- nadrzędnym, końcowym dowodem.

CREATE OR REPLACE FUNCTION artway_product_review_complete(document JSONB)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT (
    lower(COALESCE(document->>'agentQualityReviewStatus',''))='confirmed'
    AND lower(COALESCE(document->>'agentQualityReadbackConfirmed','false'))='true'
  ) OR (
    lower(COALESCE(document#>>'{contentEditorial,channelStates,store,status}',''))='ready'
    AND lower(COALESCE(document#>>'{contentEditorial,channelStates,allegro,status}',''))='ready'
    AND (
      lower(COALESCE(document#>>'{contentEditorial,channelStates,vonHalsky,status}',''))='ready'
      OR lower(COALESCE(document->>'vonHalskyAgentStatus',''))='ready'
    )
    AND lower(COALESCE(document#>>'{contentEditorial,channelStates,store,complianceStatus}','passed'))
      NOT IN ('needs_review','failed','error','blocked')
    AND lower(COALESCE(document#>>'{contentEditorial,channelStates,allegro,complianceStatus}','passed'))
      NOT IN ('needs_review','failed','error','blocked')
    AND lower(COALESCE(
      document#>>'{contentEditorial,channelStates,vonHalsky,complianceStatus}',
      document#>>'{contentEditorial,channelStates,vonHalsky,compliance,status}',
      'passed'
    )) NOT IN ('needs_review','failed','error','blocked')
  )
$$;

UPDATE artway_product_agent_state state
SET
  review_status='stale',
  verification_due_at=NULL,
  reason='legacy_review_requires_compliance',
  updated_at=NOW()
FROM artway_product_payloads payload
WHERE payload.namespace=state.namespace
  AND payload.product_id=state.product_id
  AND state.review_status='confirmed'
  AND NOT artway_product_review_complete(payload.data);

UPDATE artway_product_agent_state state
SET
  review_status='confirmed',
  input_fingerprint=artway_product_review_fingerprint(payload.data),
  confirmed_at=COALESCE(
    artway_safe_timestamptz(payload.data->>'agentQualityConfirmedAt'),
    artway_safe_timestamptz(payload.data->>'vonHalskyAgentConfirmedAt'),
    artway_safe_timestamptz(payload.data->>'allegroAgentPreparationConfirmedAt'),
    artway_safe_timestamptz(payload.data#>>'{contentEditorial,preparedAt}'),
    payload.updated_at
  ),
  verification_due_at=COALESCE(
    artway_safe_timestamptz(payload.data->>'agentQualityConfirmedAt'),
    artway_safe_timestamptz(payload.data->>'vonHalskyAgentConfirmedAt'),
    artway_safe_timestamptz(payload.data->>'allegroAgentPreparationConfirmedAt'),
    artway_safe_timestamptz(payload.data#>>'{contentEditorial,preparedAt}'),
    payload.updated_at
  ) + INTERVAL '30 days',
  channel_summary=COALESCE(payload.data#>'{contentEditorial,channelStates}','{}'::jsonb),
  reason=CASE
    WHEN lower(COALESCE(payload.data->>'agentQualityReviewStatus',''))='confirmed'
      THEN 'backfilled_quality_readback'
    ELSE 'backfilled_compliance_ready_channels'
  END,
  updated_at=NOW()
FROM artway_product_payloads payload
WHERE payload.namespace=state.namespace
  AND payload.product_id=state.product_id
  AND artway_product_review_complete(payload.data);
