-- Kanoniczny stan pełnej kontroli produktu przez Agenta.
-- Rekord jest niezależny od ceny, magazynu i ustawień sprzedaży, dlatego
-- zwykła operacja handlowa nie kieruje ponownie poprawionego produktu do
-- kosztownej redakcji. Ponowne otwarcie następuje po zmianie treści lub
-- identyfikacji, po jawnym błędzie albo po upływie terminu weryfikacji.

CREATE TABLE IF NOT EXISTS artway_product_agent_state (
  namespace TEXT NOT NULL,
  product_id TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (review_status IN ('not_started','in_progress','confirmed','attention','stale')),
  review_version INTEGER NOT NULL DEFAULT 1,
  input_fingerprint TEXT NOT NULL DEFAULT '',
  confirmed_at TIMESTAMPTZ,
  verification_due_at TIMESTAMPTZ,
  last_run_id TEXT NOT NULL DEFAULT '',
  saved_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  channel_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace,product_id)
);

CREATE INDEX IF NOT EXISTS artway_product_agent_state_work_idx
  ON artway_product_agent_state(namespace,review_status,verification_due_at,updated_at DESC);

CREATE OR REPLACE FUNCTION artway_product_review_fingerprint(document JSONB)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT md5(jsonb_build_object(
    'name',COALESCE(document->'nazwa',document->'name','null'::jsonb),
    'short',COALESCE(document->'opisKrotki',document->'krotkiOpis','null'::jsonb),
    'long',COALESCE(document->'opis',document->'description','null'::jsonb),
    'producer',COALESCE(document->'producent',document->'marka',document->'brand','null'::jsonb),
    'gtin',COALESCE(document->'gtin',document->'ean','null'::jsonb),
    'producerCode',COALESCE(document->'kodProducenta',document->'mpn',document->'externalId',document->'sku','null'::jsonb),
    'category',COALESCE(document->'kategoria',document->'category','null'::jsonb),
    'sources',jsonb_build_array(document->'sourceUrl',document->'producentUrl',document->'urlProducenta',document->'auxiliarySources'),
    'images',jsonb_build_array(document->'zdjecie',document->'zdjecia'),
    'parameters',COALESCE(document->'parametry',document->'parameters','null'::jsonb),
    'allegro',jsonb_build_object(
      'title',document->'allegroTitle','description',document->'allegroDescription',
      'category',document->'allegroCategoryId','parameters',document->'allegroParameters',
      'gpsr',document->'allegroResponsibleProducer','safety',document->'allegroSafetyInformation'
    ),
    'vonHalsky',jsonb_build_object(
      'title',document->'vonHalskyTitle','short',document->'vonHalskyShortDescription',
      'description',document->'vonHalskyDescription','category',document->'vonHalskyCategoryId',
      'attributes',document->'vonHalskyAttributes','gpsr',document->'vonHalskyResponsibleProducer'
    )
  )::TEXT)
$$;

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
  )
$$;

CREATE OR REPLACE FUNCTION artway_safe_timestamptz(value TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
BEGIN
  IF COALESCE(btrim(value),'')='' THEN RETURN NULL; END IF;
  RETURN value::TIMESTAMPTZ;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION artway_sync_product_agent_state()
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
    NOW()
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

DROP TRIGGER IF EXISTS artway_products_agent_state_sync ON artway_products;
CREATE TRIGGER artway_products_agent_state_sync
AFTER INSERT OR UPDATE OF data ON artway_products
FOR EACH ROW EXECUTE FUNCTION artway_sync_product_agent_state();

-- Jednorazowe oznaczenie wszystkich wcześniej poprawionych produktów. Tylko
-- pełne, odczytane potwierdzenia są uznawane; same dawne próby i komunikaty
-- „sukces” bez pełnej gotowości nie przechodzą tego warunku.
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
    updated_at
  ) AS confirmed_at,
  COALESCE(
    artway_safe_timestamptz(data->>'agentQualityConfirmedAt'),
    artway_safe_timestamptz(data->>'vonHalskyAgentConfirmedAt'),
    artway_safe_timestamptz(data->>'allegroAgentPreparationConfirmedAt'),
    updated_at
  ) + INTERVAL '30 days',
  COALESCE(data->>'agentQualityRunId',''),
  COALESCE(data->'agentQualitySavedFields','[]'::jsonb),
  COALESCE(data#>'{contentEditorial,channelStates}','{}'::jsonb),
  'backfilled_confirmed_full_review',NOW()
FROM artway_products
WHERE artway_product_review_complete(data)
ON CONFLICT(namespace,product_id) DO UPDATE SET
  review_status='confirmed',
  input_fingerprint=EXCLUDED.input_fingerprint,
  confirmed_at=EXCLUDED.confirmed_at,
  verification_due_at=EXCLUDED.verification_due_at,
  last_run_id=EXCLUDED.last_run_id,
  saved_fields=EXCLUDED.saved_fields,
  channel_summary=EXCLUDED.channel_summary,
  reason=EXCLUDED.reason,
  updated_at=NOW()
WHERE artway_product_agent_state.review_status<>'confirmed';

COMMENT ON TABLE artway_product_agent_state IS
  'Jeden kanoniczny stan pełnej kontroli Agenta dla produktu, niezależny od cen i magazynu.';
