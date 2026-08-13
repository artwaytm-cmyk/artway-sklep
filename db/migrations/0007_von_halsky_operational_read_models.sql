-- Lekkie indeksy kolejki Von Halsky i dokładna projekcja zamówień kanału.
-- Źródłem prawdy pozostają centralne kartoteki oraz rekordy API.

UPDATE artway_product_payloads
SET admin_list_data=jsonb_set(
  COALESCE(admin_list_data,'{}'::jsonb),
  '{vonHalskyPresentationDescriptionLength}',
  to_jsonb(length(COALESCE(
    NULLIF(data->>'vonHalskyDescription',''),
    NULLIF(data->>'opis',''),
    NULLIF(data->>'dlugiOpis',''),
    NULLIF(data->>'description',''),
    ''
  ))),
  true
)
WHERE admin_list_data->>'vonHalskyPresentationDescriptionLength' IS DISTINCT FROM
  length(COALESCE(
    NULLIF(data->>'vonHalskyDescription',''),
    NULLIF(data->>'opis',''),
    NULLIF(data->>'dlugiOpis',''),
    NULLIF(data->>'description',''),
    ''
  ))::text;

CREATE INDEX IF NOT EXISTS artway_product_payloads_vh_status_idx
  ON artway_product_payloads(
    namespace,
    upper(COALESCE(admin_list_data->>'vonHalskyRemoteStatus',''))
  );

CREATE INDEX IF NOT EXISTS artway_product_payloads_vh_agent_idx
  ON artway_product_payloads(
    namespace,
    lower(COALESCE(admin_list_data->>'vonHalskyAgentStatus',''))
  );

CREATE INDEX IF NOT EXISTS artway_product_payloads_vh_offer_idx
  ON artway_product_payloads(
    namespace,
    COALESCE(admin_list_data->>'vonHalskyOfferId','')
  )
  WHERE COALESCE(admin_list_data->>'vonHalskyOfferId','') <> '';

CREATE INDEX IF NOT EXISTS artway_product_payloads_vh_queue_gin_idx
  ON artway_product_payloads USING GIN(admin_list_data jsonb_path_ops);

CREATE OR REPLACE FUNCTION artway_project_von_halsky_order_details()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_order_id TEXT;
  v_currency TEXT;
  v_items JSONB;
  v_entry RECORD;
  v_item JSONB;
  v_line_id TEXT;
BEGIN
  IF NEW.kind <> 'orders' THEN RETURN NEW; END IF;
  v_order_id := COALESCE(NULLIF(NEW.data->>'id',''),NEW.record_id);
  v_currency := upper(left(COALESCE(
    NULLIF(NEW.data#>>'{finalPrice,currency}',''),
    NULLIF(NEW.data#>>'{total,currency}',''),
    'PLN'
  ),3));

  INSERT INTO artway_order_headers(
    namespace,channel,order_id,status,payment_status,shipment_status,
    customer_email,buyer_login,total_amount,currency,placed_at,
    source_table,source_domain,source_record_id,source_hash,
    source_updated_at,updated_at
  ) VALUES(
    NEW.namespace,'von_halsky',v_order_id,
    upper(COALESCE(NEW.data->>'status','')),
    upper(COALESCE(
      NEW.data#>>'{paymentDetails,status}',
      NEW.data#>>'{payment,status}',
      ''
    )),
    upper(COALESCE(
      NEW.data#>>'{delivery,status}',
      NEW.data->>'shipmentStatus',
      ''
    )),
    lower(COALESCE(
      NEW.data#>>'{customer,email}',
      NEW.data->>'customerEmail',
      ''
    )),
    COALESCE(NEW.data#>>'{customer,login}',''),
    artway_safe_numeric(COALESCE(
      NEW.data#>>'{finalPrice,amount}',
      NEW.data#>>'{total,amount}',
      NEW.data->>'total'
    )),
    CASE WHEN length(v_currency)=3 THEN v_currency ELSE 'PLN' END,
    artway_safe_timestamptz(COALESCE(
      NEW.data->>'createdAt',
      NEW.data->>'placedAt',
      NEW.data->>'updatedAt'
    )),
    TG_TABLE_NAME,'von_halsky:orders',NEW.record_id,md5(NEW.data::text),
    NEW.updated_at,NOW()
  )
  ON CONFLICT(namespace,channel,order_id) DO UPDATE SET
    status=EXCLUDED.status,
    payment_status=EXCLUDED.payment_status,
    shipment_status=EXCLUDED.shipment_status,
    customer_email=EXCLUDED.customer_email,
    buyer_login=EXCLUDED.buyer_login,
    total_amount=EXCLUDED.total_amount,
    currency=EXCLUDED.currency,
    placed_at=EXCLUDED.placed_at,
    source_table=EXCLUDED.source_table,
    source_domain=EXCLUDED.source_domain,
    source_record_id=EXCLUDED.source_record_id,
    source_hash=EXCLUDED.source_hash,
    source_updated_at=EXCLUDED.source_updated_at,
    updated_at=NOW()
  WHERE artway_order_headers.source_hash IS DISTINCT FROM EXCLUDED.source_hash
     OR artway_order_headers.total_amount IS DISTINCT FROM EXCLUDED.total_amount
     OR artway_order_headers.payment_status IS DISTINCT FROM EXCLUDED.payment_status;

  v_items := CASE
    WHEN jsonb_typeof(NEW.data->'orderLines')='array' THEN NEW.data->'orderLines'
    WHEN jsonb_typeof(NEW.data->'lineItems')='array' THEN NEW.data->'lineItems'
    WHEN jsonb_typeof(NEW.data->'items')='array' THEN NEW.data->'items'
    ELSE '[]'::jsonb
  END;
  DELETE FROM artway_order_items
  WHERE namespace=NEW.namespace AND channel='von_halsky' AND order_id=v_order_id;
  FOR v_entry IN
    SELECT value AS item,ordinality::integer ordinal
    FROM jsonb_array_elements(v_items) WITH ORDINALITY
  LOOP
    v_item := v_entry.item;
    v_line_id := COALESCE(
      NULLIF(v_item->>'id',''),
      NULLIF(v_item->>'lineId',''),
      NULLIF(v_item#>>'{offer,id}',''),
      NULLIF(v_item#>>'{offer,product,id}',''),
      md5(v_item::text || ':' || v_entry.ordinal::text)
    );
    INSERT INTO artway_order_items(
      namespace,channel,order_id,line_id,ordinal,product_id,offer_id,
      sku,ean,name,quantity,unit_price,currency
    ) VALUES(
      NEW.namespace,'von_halsky',v_order_id,v_line_id,v_entry.ordinal-1,
      COALESCE(v_item#>>'{offer,product,id}',v_item->>'productId',''),
      COALESCE(v_item#>>'{offer,id}',v_item->>'offerId',''),
      COALESCE(
        v_item#>>'{offer,product,externalId}',
        v_item#>>'{offer,product,sku}',
        v_item->>'sku',
        ''
      ),
      regexp_replace(COALESCE(
        v_item#>>'{offer,product,ean}',
        v_item#>>'{offer,product,gtin}',
        v_item->>'ean',
        ''
      ),'\s','','g'),
      COALESCE(v_item#>>'{offer,product,name}',v_item->>'name',''),
      COALESCE(artway_safe_numeric(v_item->>'quantity'),0),
      artway_safe_numeric(COALESCE(
        v_item#>>'{price,amount}',
        v_item#>>'{offer,price,amount}',
        v_item->>'unitPrice'
      )),
      CASE
        WHEN length(upper(COALESCE(v_item#>>'{price,currency}',v_currency)))=3
        THEN upper(COALESCE(v_item#>>'{price,currency}',v_currency))
        ELSE 'PLN'
      END
    );
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM artway_record_projection_error(
    COALESCE(NEW.namespace,'artway-sklep'),'orders',TG_TABLE_NAME,TG_OP,
    SQLSTATE,SQLERRM
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS zz_artway_von_halsky_order_details_trg
  ON artway_von_halsky_records;
CREATE TRIGGER zz_artway_von_halsky_order_details_trg
AFTER INSERT OR UPDATE ON artway_von_halsky_records
FOR EACH ROW EXECUTE FUNCTION artway_project_von_halsky_order_details();

-- Odtworzenie projekcji istniejących zamówień po dołożeniu dokładnego mapowania.
UPDATE artway_von_halsky_records
SET updated_at=updated_at
WHERE kind='orders';
