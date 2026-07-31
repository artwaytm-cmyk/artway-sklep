-- Po kontrakcji 0005 pełna kartoteka mieszka w artway_product_payloads, a
-- tabela artway_products przechowuje wyłącznie lekki indeks. Przenosimy więc
-- synchronizację stanu kontroli na prawdziwe źródło dokumentu produktu.

DROP TRIGGER IF EXISTS artway_products_agent_state_sync ON artway_products;

CREATE OR REPLACE FUNCTION artway_sync_product_payload_agent_state()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  fingerprint TEXT := artway_product_review_fingerprint(NEW.data);
  complete BOOLEAN := artway_product_review_complete(NEW.data);
  fresh_confirmation BOOLEAN := TG_OP='INSERT';
  confirmation_time TIMESTAMPTZ;
  current_state artway_product_agent_state%ROWTYPE;
  channels JSONB := COALESCE(NEW.data#>'{contentEditorial,channelStates}','{}'::jsonb);
BEGIN
  IF TG_OP='UPDATE' THEN
    fresh_confirmation :=
      NEW.data->>'agentQualityConfirmedAt' IS DISTINCT FROM OLD.data->>'agentQualityConfirmedAt'
      OR NEW.data->>'agentQualityRunId' IS DISTINCT FROM OLD.data->>'agentQualityRunId'
      OR NEW.data->>'vonHalskyAgentConfirmedAt' IS DISTINCT FROM OLD.data->>'vonHalskyAgentConfirmedAt'
      OR NEW.data->>'allegroAgentPreparationConfirmedAt' IS DISTINCT FROM OLD.data->>'allegroAgentPreparationConfirmedAt';
  END IF;

  SELECT * INTO current_state
  FROM artway_product_agent_state
  WHERE namespace=NEW.namespace AND product_id=NEW.product_id;

  confirmation_time := COALESCE(
    artway_safe_timestamptz(NEW.data->>'agentQualityConfirmedAt'),
    artway_safe_timestamptz(NEW.data->>'vonHalskyAgentConfirmedAt'),
    artway_safe_timestamptz(NEW.data->>'allegroAgentPreparationConfirmedAt'),
    NEW.updated_at,NOW()
  );

  IF NOT FOUND THEN
    INSERT INTO artway_product_agent_state(
      namespace,product_id,review_status,input_fingerprint,confirmed_at,
      verification_due_at,last_run_id,saved_fields,channel_summary,reason,updated_at
    ) VALUES (
      NEW.namespace,NEW.product_id,CASE WHEN complete THEN 'confirmed' ELSE 'not_started' END,
      fingerprint,CASE WHEN complete THEN confirmation_time ELSE NULL END,
      CASE WHEN complete THEN confirmation_time + INTERVAL '30 days' ELSE NULL END,
      COALESCE(NEW.data->>'agentQualityRunId',''),
      COALESCE(NEW.data->'agentQualitySavedFields','[]'::jsonb),channels,
      CASE WHEN complete THEN 'full_review_saved_and_read_back' ELSE 'awaiting_full_review' END,NOW()
    );
  ELSIF current_state.input_fingerprint<>fingerprint THEN
    UPDATE artway_product_agent_state SET
      review_status=CASE WHEN complete AND fresh_confirmation THEN 'confirmed' ELSE 'stale' END,
      input_fingerprint=fingerprint,
      confirmed_at=CASE WHEN complete AND fresh_confirmation THEN confirmation_time ELSE confirmed_at END,
      verification_due_at=CASE WHEN complete AND fresh_confirmation THEN confirmation_time + INTERVAL '30 days' ELSE NULL END,
      last_run_id=CASE WHEN complete AND fresh_confirmation THEN COALESCE(NEW.data->>'agentQualityRunId','') ELSE last_run_id END,
      saved_fields=CASE WHEN complete AND fresh_confirmation THEN COALESCE(NEW.data->'agentQualitySavedFields','[]'::jsonb) ELSE saved_fields END,
      channel_summary=channels,
      reason=CASE WHEN complete AND fresh_confirmation THEN 'full_review_saved_and_read_back' ELSE 'product_editorial_data_changed' END,
      updated_at=NOW()
    WHERE namespace=NEW.namespace AND product_id=NEW.product_id;
  ELSIF complete AND fresh_confirmation THEN
    UPDATE artway_product_agent_state SET
      review_status='confirmed',confirmed_at=confirmation_time,
      verification_due_at=confirmation_time + INTERVAL '30 days',
      last_run_id=COALESCE(NEW.data->>'agentQualityRunId',''),
      saved_fields=COALESCE(NEW.data->'agentQualitySavedFields','[]'::jsonb),
      channel_summary=channels,reason='full_review_saved_and_read_back',updated_at=NOW()
    WHERE namespace=NEW.namespace AND product_id=NEW.product_id;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS artway_product_payload_agent_state_sync ON artway_product_payloads;
CREATE TRIGGER artway_product_payload_agent_state_sync
AFTER INSERT OR UPDATE OF data ON artway_product_payloads
FOR EACH ROW EXECUTE FUNCTION artway_sync_product_payload_agent_state();

-- Uzupełniamy stan ze wszystkich faktycznie zapisanych kartotek. Starsze
-- wersje nie miały relacyjnego pokwitowania, ale miały komplet trzech
-- potwierdzonych kanałów; to wystarczający, istniejący dowód wykonania.
INSERT INTO artway_product_agent_state(
  namespace,product_id,review_status,input_fingerprint,confirmed_at,
  verification_due_at,last_run_id,saved_fields,channel_summary,reason,updated_at
)
SELECT
  namespace,product_id,'confirmed',artway_product_review_fingerprint(data),
  COALESCE(
    artway_safe_timestamptz(data->>'agentQualityConfirmedAt'),
    artway_safe_timestamptz(data->>'vonHalskyAgentConfirmedAt'),
    artway_safe_timestamptz(data->>'allegroAgentPreparationConfirmedAt'),
    artway_safe_timestamptz(data#>>'{contentEditorial,preparedAt}'),
    updated_at
  ) AS confirmed_at,
  COALESCE(
    artway_safe_timestamptz(data->>'agentQualityConfirmedAt'),
    artway_safe_timestamptz(data->>'vonHalskyAgentConfirmedAt'),
    artway_safe_timestamptz(data->>'allegroAgentPreparationConfirmedAt'),
    artway_safe_timestamptz(data#>>'{contentEditorial,preparedAt}'),
    updated_at
  ) + INTERVAL '30 days',
  COALESCE(data->>'agentQualityRunId',data->>'vonHalskyAgentPreparationRunId',''),
  COALESCE(data->'agentQualitySavedFields',data->'vonHalskyAgentSavedFields','[]'::jsonb),
  COALESCE(data#>'{contentEditorial,channelStates}','{}'::jsonb),
  CASE
    WHEN lower(COALESCE(data->>'agentQualityReviewStatus',''))='confirmed'
      THEN 'backfilled_quality_readback'
    ELSE 'backfilled_three_ready_channels'
  END,
  NOW()
FROM artway_product_payloads
WHERE artway_product_review_complete(data)
ON CONFLICT(namespace,product_id) DO UPDATE SET
  review_status='confirmed',review_version=1,
  input_fingerprint=EXCLUDED.input_fingerprint,
  confirmed_at=EXCLUDED.confirmed_at,
  verification_due_at=EXCLUDED.verification_due_at,
  last_run_id=EXCLUDED.last_run_id,
  saved_fields=EXCLUDED.saved_fields,
  channel_summary=EXCLUDED.channel_summary,
  reason=EXCLUDED.reason,
  updated_at=NOW();
