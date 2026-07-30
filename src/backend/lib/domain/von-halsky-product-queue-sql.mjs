export const VON_HALSKY_PRODUCT_QUEUE_SQL = `
  WITH source AS (
    SELECT
      p.product_id,p.name,p.search_vector,p.category,p.producer,p.external_id,p.sku,p.ean,
      p.record_status,p.sale_available,p.price,p.allegro_price,p.stock,p.updated_at,
      p.admin_list_data product,
      upper(COALESCE(p.admin_list_data->>'vonHalskyRemoteStatus','')) remote_status,
      lower(COALESCE(p.admin_list_data->>'vonHalskyAgentStatus','')) agent_status,
      COALESCE(NULLIF(p.admin_list_data->>'vonHalskyCategoryId',''),'') category_id,
      COALESCE(NULLIF(p.admin_list_data->>'vonHalskyOfferId',''),'') offer_id,
      COALESCE(NULLIF(p.admin_list_data->>'vonHalskyTitle',''),NULLIF(p.name,''),'') channel_name,
      COALESCE(NULLIF(p.admin_list_data->>'vonHalskyShortDescription',''),NULLIF(p.admin_list_data->>'opisKrotki',''),'') channel_short,
      CASE
        WHEN COALESCE(p.admin_list_data->>'vonHalskyPresentationDescriptionLength','') ~ '^[0-9]+$'
          THEN (p.admin_list_data->>'vonHalskyPresentationDescriptionLength')::integer
        ELSE 0
      END channel_description_length,
      COALESCE(NULLIF(p.admin_list_data->>'kodProducenta',''),NULLIF(p.admin_list_data->>'mpn',''),NULLIF(p.external_id,''),NULLIF(p.sku,''),'') producer_code,
      COALESCE(NULLIF(p.admin_list_data->>'marka',''),NULLIF(p.producer,''),'') brand,
      COALESCE(NULLIF(p.admin_list_data->>'zdjecie',''),NULLIF(p.admin_list_data->>'ikona',''),'') image,
      CASE
        WHEN COALESCE(p.admin_list_data->>'cenaVonHalsky','') ~ '^[0-9]+([.,][0-9]+)?$'
          THEN replace(p.admin_list_data->>'cenaVonHalsky',',','.')::numeric
        ELSE COALESCE(p.allegro_price,p.price,0)
      END channel_price,
      lower(COALESCE(p.admin_list_data->>'vonHalskyGpsrRequired','false')) IN ('true','1','yes','tak') gpsr_required,
      COALESCE(p.admin_list_data->>'vonHalskyResponsibleProducerStatus','') gpsr_status,
      CASE
        WHEN jsonb_typeof(p.admin_list_data->'vonHalskyResponsibleProducerMissing')='array'
          THEN jsonb_array_length(p.admin_list_data->'vonHalskyResponsibleProducerMissing')
        ELSE 0
      END gpsr_missing,
      CASE
        WHEN jsonb_typeof(p.admin_list_data->'vonHalskyAgentIssues')='array'
          THEN jsonb_array_length(p.admin_list_data->'vonHalskyAgentIssues')
        ELSE 0
      END agent_issues,
      CASE
        WHEN COALESCE(p.admin_list_data->>'vonHalskyAgentScore','') ~ '^[0-9]+([.,][0-9]+)?$'
          THEN replace(p.admin_list_data->>'vonHalskyAgentScore',',','.')::numeric
        ELSE 0
      END agent_score
    FROM artway_product_records p
    WHERE p.namespace=$1 AND p.record_status='active'
  ),
  classified AS (
    SELECT source.*,
      (
        length(channel_name) BETWEEN 7 AND 150
        AND channel_description_length >= 100
        AND (
          ean <> ''
          OR (producer_code <> '' AND brand <> '')
        )
        AND image <> ''
        AND channel_price > 0
        AND category_id <> ''
        AND (NOT gpsr_required OR (gpsr_missing=0 AND lower(gpsr_status) IN ('ready','complete','confirmed','source_confirmed')))
        AND sale_available
        AND agent_issues=0
      ) ready,
      CASE
        WHEN NOT sale_available OR remote_status IN ('CLOSED','SOLDOUT','INACTIVE') THEN 'wstrzymane'
        WHEN remote_status IN ('PENDING','PROCESSING','VERIFYING') THEN 'publikowanie'
        WHEN remote_status IN ('REJECTED','ERROR') THEN 'aktualizacja'
        WHEN remote_status='PUBLISHED' AND (
          lower(COALESCE(product->>'vonHalskyEditorialSyncPending','false')) IN ('true','1','yes','tak')
          OR agent_issues>0
        ) THEN 'aktualizacja'
        WHEN remote_status='PUBLISHED' THEN 'sprzedaz'
        WHEN (
          length(channel_name) BETWEEN 7 AND 150
          AND channel_description_length >= 100
          AND (ean<>'' OR (producer_code<>'' AND brand<>''))
          AND image<>'' AND channel_price>0 AND category_id<>''
          AND (NOT gpsr_required OR (gpsr_missing=0 AND lower(gpsr_status) IN ('ready','complete','confirmed','source_confirmed')))
          AND sale_available AND agent_issues=0
        ) THEN 'wystawienie'
        ELSE 'przygotowanie'
      END stage
    FROM source
  )
`;
