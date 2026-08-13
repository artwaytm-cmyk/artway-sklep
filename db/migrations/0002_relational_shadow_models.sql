-- Relacyjne modele cieniujące. Istniejące źródła nadal pozostają aktywne,
-- a triggery prowadzą podwójny zapis pojedynczych rekordów. Przełączenie
-- odczytu może nastąpić dopiero po porównaniu w artway_projection_checks.

CREATE TABLE IF NOT EXISTS artway_projection_checks (
  namespace TEXT NOT NULL,
  projection TEXT NOT NULL,
  source_name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'shadow',
  source_count BIGINT NOT NULL DEFAULT 0,
  projection_count BIGINT NOT NULL DEFAULT 0,
  mismatch_count BIGINT NOT NULL DEFAULT 0,
  source_fingerprint TEXT NOT NULL DEFAULT '',
  projection_fingerprint TEXT NOT NULL DEFAULT '',
  compared_at TIMESTAMPTZ NULL,
  consecutive_matches INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY(namespace, projection)
);
CREATE TABLE IF NOT EXISTS artway_projection_errors (
  error_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  namespace TEXT NOT NULL,
  projection TEXT NOT NULL,
  source_table TEXT NOT NULL DEFAULT '',
  operation TEXT NOT NULL DEFAULT '',
  sqlstate TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS artway_projection_errors_recent_idx
  ON artway_projection_errors(namespace,projection,occurred_at DESC)
  WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS artway_order_headers (
  namespace TEXT NOT NULL,
  channel TEXT NOT NULL,
  order_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '',
  payment_status TEXT NOT NULL DEFAULT '',
  shipment_status TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  buyer_login TEXT NOT NULL DEFAULT '',
  total_amount NUMERIC NULL,
  currency CHAR(3) NOT NULL DEFAULT 'PLN',
  placed_at TIMESTAMPTZ NULL,
  source_table TEXT NOT NULL,
  source_domain TEXT NOT NULL DEFAULT '',
  source_record_id TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  source_updated_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace, channel, order_id)
);
CREATE INDEX IF NOT EXISTS artway_order_headers_status_idx
  ON artway_order_headers(namespace, channel, status, placed_at DESC, order_id);
CREATE INDEX IF NOT EXISTS artway_order_headers_customer_idx
  ON artway_order_headers(namespace, customer_email, placed_at DESC)
  WHERE customer_email <> '';

CREATE TABLE IF NOT EXISTS artway_order_items (
  namespace TEXT NOT NULL,
  channel TEXT NOT NULL,
  order_id TEXT NOT NULL,
  line_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL DEFAULT 0,
  product_id TEXT NOT NULL DEFAULT '',
  offer_id TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  ean TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NULL,
  currency CHAR(3) NOT NULL DEFAULT 'PLN',
  PRIMARY KEY(namespace, channel, order_id, line_id),
  FOREIGN KEY(namespace, channel, order_id)
    REFERENCES artway_order_headers(namespace, channel, order_id)
    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS artway_order_items_product_idx
  ON artway_order_items(namespace, product_id, channel, order_id)
  WHERE product_id <> '';
CREATE INDEX IF NOT EXISTS artway_order_items_ean_idx
  ON artway_order_items(namespace, ean)
  WHERE ean <> '';

CREATE TABLE IF NOT EXISTS artway_channel_offers (
  namespace TEXT NOT NULL,
  channel TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  product_id TEXT NOT NULL DEFAULT '',
  external_id TEXT NOT NULL DEFAULT '',
  ean TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  price NUMERIC NULL,
  currency CHAR(3) NOT NULL DEFAULT 'PLN',
  quantity NUMERIC NULL,
  source_table TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  source_updated_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace, channel, offer_id)
);
CREATE INDEX IF NOT EXISTS artway_channel_offers_product_idx
  ON artway_channel_offers(namespace, channel, product_id)
  WHERE product_id <> '';
CREATE INDEX IF NOT EXISTS artway_channel_offers_status_idx
  ON artway_channel_offers(namespace, channel, status, offer_id);
CREATE INDEX IF NOT EXISTS artway_channel_offers_ean_idx
  ON artway_channel_offers(namespace, channel, ean)
  WHERE ean <> '';

CREATE TABLE IF NOT EXISTS artway_agent_work_items (
  namespace TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  work_id TEXT NOT NULL,
  work_type TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 100,
  attempts INTEGER NOT NULL DEFAULT 0,
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NULL,
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  source_hash TEXT NOT NULL,
  source_updated_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace, source_kind, work_id)
);
CREATE INDEX IF NOT EXISTS artway_agent_work_items_queue_idx
  ON artway_agent_work_items(namespace, status, priority DESC, created_at, work_id);
CREATE INDEX IF NOT EXISTS artway_agent_work_items_entity_idx
  ON artway_agent_work_items(namespace, entity_id, updated_at DESC)
  WHERE entity_id <> '';

CREATE TABLE IF NOT EXISTS artway_inventory_locations (
  namespace TEXT NOT NULL,
  location_id TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  parent_code TEXT NOT NULL DEFAULT '',
  location_type TEXT NOT NULL DEFAULT '',
  zone TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  unlimited_capacity BOOLEAN NOT NULL DEFAULT TRUE,
  source_hash TEXT NOT NULL,
  source_updated_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace, location_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS artway_inventory_locations_code_idx
  ON artway_inventory_locations(namespace, code)
  WHERE code <> '';
CREATE INDEX IF NOT EXISTS artway_inventory_locations_tree_idx
  ON artway_inventory_locations(namespace, parent_code, code);

CREATE TABLE IF NOT EXISTS artway_inventory_balances (
  namespace TEXT NOT NULL,
  product_id TEXT NOT NULL,
  location_code TEXT NOT NULL DEFAULT '',
  quantity NUMERIC NOT NULL DEFAULT 0,
  source_hash TEXT NOT NULL,
  source_updated_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace, product_id)
);
CREATE INDEX IF NOT EXISTS artway_inventory_balances_location_idx
  ON artway_inventory_balances(namespace, location_code, product_id);

CREATE TABLE IF NOT EXISTS artway_inventory_movements (
  namespace TEXT NOT NULL,
  movement_id TEXT NOT NULL,
  product_id TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  movement_type TEXT NOT NULL DEFAULT '',
  quantity NUMERIC NOT NULL DEFAULT 0,
  stock_before NUMERIC NULL,
  stock_after NUMERIC NULL,
  document_no TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT '',
  occurred_at TIMESTAMPTZ NULL,
  source_hash TEXT NOT NULL,
  source_updated_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace, movement_id)
);
CREATE INDEX IF NOT EXISTS artway_inventory_movements_product_idx
  ON artway_inventory_movements(namespace, product_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS artway_warehouse_documents (
  namespace TEXT NOT NULL,
  document_id TEXT NOT NULL,
  document_no TEXT NOT NULL DEFAULT '',
  document_type TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT '',
  document_at TIMESTAMPTZ NULL,
  source_hash TEXT NOT NULL,
  source_updated_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace, document_id)
);
CREATE INDEX IF NOT EXISTS artway_warehouse_documents_status_idx
  ON artway_warehouse_documents(namespace, document_type, status, document_at DESC);

CREATE TABLE IF NOT EXISTS artway_warehouse_document_items (
  namespace TEXT NOT NULL,
  document_id TEXT NOT NULL,
  line_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL DEFAULT 0,
  product_id TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  ean TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  quantity NUMERIC NOT NULL DEFAULT 0,
  location_code TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(namespace, document_id, line_id),
  FOREIGN KEY(namespace, document_id)
    REFERENCES artway_warehouse_documents(namespace, document_id)
    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS artway_warehouse_document_items_product_idx
  ON artway_warehouse_document_items(namespace, product_id, document_id);

CREATE OR REPLACE FUNCTION artway_safe_numeric(value TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN RETURN NULL; END IF;
  RETURN replace(value, ',', '.')::numeric;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION artway_safe_timestamptz(value TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN RETURN NULL; END IF;
  RETURN value::timestamptz;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION artway_safe_boolean(value TEXT, fallback BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN RETURN fallback; END IF;
  IF lower(btrim(value)) IN ('true','t','1','yes','y','tak') THEN RETURN TRUE; END IF;
  IF lower(btrim(value)) IN ('false','f','0','no','n','nie') THEN RETURN FALSE; END IF;
  RETURN fallback;
END $$;

CREATE OR REPLACE FUNCTION artway_record_projection_error(
  p_namespace TEXT,
  p_projection TEXT,
  p_source_table TEXT,
  p_operation TEXT,
  p_sqlstate TEXT,
  p_message TEXT
) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO artway_projection_errors(
    namespace,projection,source_table,operation,sqlstate,message
  ) VALUES(
    COALESCE(p_namespace,'artway-sklep'),p_projection,p_source_table,
    p_operation,p_sqlstate,left(COALESCE(p_message,''),2000)
  );
  UPDATE artway_projection_checks
  SET mismatch_count=GREATEST(mismatch_count,1),
      consecutive_matches=0,
      details=details||jsonb_build_object(
        'lastError',left(COALESCE(p_message,''),500),
        'lastErrorAt',NOW(),
        'sourceTable',p_source_table,
        'operation',p_operation
      )
  WHERE namespace=COALESCE(p_namespace,'artway-sklep')
    AND projection=p_projection;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Nie udało się zapisać błędu projekcji %: %',p_projection,p_message;
END $$;

CREATE OR REPLACE FUNCTION artway_project_order(
  p_namespace TEXT,
  p_channel TEXT,
  p_source_table TEXT,
  p_source_domain TEXT,
  p_record_id TEXT,
  p_data JSONB,
  p_updated_at TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_order_id TEXT;
  v_status TEXT;
  v_items JSONB;
  v_entry RECORD;
  v_item JSONB;
  v_line_id TEXT;
  v_currency TEXT;
BEGIN
  v_order_id := COALESCE(
    NULLIF(p_data->>'id', ''),
    NULLIF(p_data->>'checkoutFormId', ''),
    NULLIF(p_data->>'nr', ''),
    p_record_id
  );
  v_status := upper(COALESCE(
    NULLIF(p_data->>'status', ''),
    NULLIF(p_data->>'fulfillmentStatus', ''),
    NULLIF(p_data->>'allegroStatus', ''),
    CASE WHEN p_source_domain LIKE '%deleted_orders' THEN 'ARCHIVED' ELSE '' END
  ));
  v_currency := upper(left(COALESCE(
    NULLIF(p_data#>>'{total,currency}', ''),
    NULLIF(p_data->>'currency', ''),
    'PLN'
  ), 3));
  INSERT INTO artway_order_headers(
    namespace, channel, order_id, status, payment_status, shipment_status,
    customer_email, buyer_login, total_amount, currency, placed_at,
    source_table, source_domain, source_record_id, source_hash,
    source_updated_at, updated_at
  ) VALUES(
    p_namespace, p_channel, v_order_id, v_status,
    upper(COALESCE(p_data->>'paymentStatus', p_data#>>'{payment,status}', '')),
    upper(COALESCE(p_data->>'shipmentStatus', p_data->>'deliveryStatus', '')),
    lower(COALESCE(p_data->>'email', p_data->>'customerEmail', '')),
    COALESCE(p_data->>'buyerLogin', ''),
    artway_safe_numeric(COALESCE(p_data#>>'{total,amount}', p_data->>'total', p_data->>'kwota')),
    CASE WHEN length(v_currency) = 3 THEN v_currency ELSE 'PLN' END,
    artway_safe_timestamptz(COALESCE(
      p_data->>'createdAt', p_data->>'placedAt', p_data->>'data'
    )),
    p_source_table, p_source_domain, p_record_id,
    md5(p_data::text), p_updated_at, NOW()
  )
  ON CONFLICT(namespace, channel, order_id) DO UPDATE SET
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
     OR artway_order_headers.source_record_id IS DISTINCT FROM EXCLUDED.source_record_id;

  v_items := CASE
    WHEN jsonb_typeof(p_data->'lineItems')='array' THEN p_data->'lineItems'
    WHEN jsonb_typeof(p_data->'items')='array' THEN p_data->'items'
    WHEN jsonb_typeof(p_data->'produkty')='array' THEN p_data->'produkty'
    WHEN jsonb_typeof(p_data->'pozycje')='array' THEN p_data->'pozycje'
    ELSE '[]'::jsonb
  END;
  DELETE FROM artway_order_items
  WHERE namespace=p_namespace AND channel=p_channel AND order_id=v_order_id;
  FOR v_entry IN
    SELECT value AS item, ordinality::integer AS ordinal
    FROM jsonb_array_elements(v_items) WITH ORDINALITY
  LOOP
    v_item := v_entry.item;
    v_line_id := COALESCE(
      NULLIF(v_item->>'id', ''),
      NULLIF(v_item->>'lineId', ''),
      NULLIF(v_item->>'offerId', ''),
      NULLIF(v_item#>>'{offer,id}', ''),
      NULLIF(v_item->>'productId', ''),
      NULLIF(v_item#>>'{product,id}', ''),
      md5(v_item::text || ':' || v_entry.ordinal::text)
    );
    INSERT INTO artway_order_items(
      namespace, channel, order_id, line_id, ordinal, product_id, offer_id,
      sku, ean, name, quantity, unit_price, currency
    ) VALUES(
      p_namespace, p_channel, v_order_id, v_line_id, v_entry.ordinal - 1,
      COALESCE(v_item->>'productId', v_item#>>'{product,id}', ''),
      COALESCE(v_item->>'offerId', v_item#>>'{offer,id}', ''),
      COALESCE(v_item->>'sku', v_item#>>'{product,sku}', ''),
      regexp_replace(COALESCE(
        v_item->>'ean', v_item->>'gtin', v_item#>>'{product,ean}', ''
      ), '\s', '', 'g'),
      COALESCE(v_item->>'name', v_item->>'nazwa', v_item#>>'{offer,name}', ''),
      COALESCE(artway_safe_numeric(COALESCE(
        v_item->>'quantity', v_item->>'ilosc', v_item->>'qty'
      )), 0),
      artway_safe_numeric(COALESCE(
        v_item#>>'{price,amount}', v_item->>'unitPrice', v_item->>'cena'
      )),
      CASE
        WHEN length(upper(COALESCE(v_item#>>'{price,currency}', v_currency)))=3
        THEN upper(COALESCE(v_item#>>'{price,currency}', v_currency))
        ELSE 'PLN'
      END
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION artway_project_offer(
  p_namespace TEXT,
  p_channel TEXT,
  p_source_table TEXT,
  p_record_id TEXT,
  p_data JSONB,
  p_updated_at TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_offer_id TEXT;
  v_currency TEXT;
BEGIN
  v_offer_id := COALESCE(
    NULLIF(p_data->>'offerId', ''),
    NULLIF(p_data->>'id', ''),
    NULLIF(p_data#>>'{offer,id}', ''),
    p_record_id
  );
  v_currency := upper(left(COALESCE(
    NULLIF(p_data#>>'{price,currency}', ''),
    NULLIF(p_data->>'currency', ''),
    'PLN'
  ), 3));
  INSERT INTO artway_channel_offers(
    namespace, channel, offer_id, product_id, external_id, ean, name, status,
    price, currency, quantity, source_table, source_record_id, source_hash,
    source_updated_at, updated_at
  ) VALUES(
    p_namespace, p_channel, v_offer_id,
    COALESCE(p_data->>'productId', p_data#>>'{product,id}', ''),
    COALESCE(p_data->>'externalId', p_data#>>'{external,id}', ''),
    regexp_replace(COALESCE(
      p_data->>'ean', p_data->>'gtin', p_data#>>'{product,ean}', ''
    ), '\s', '', 'g'),
    COALESCE(p_data->>'name', p_data#>>'{offer,name}', ''),
    upper(COALESCE(p_data->>'status', p_data#>>'{publication,status}', '')),
    artway_safe_numeric(COALESCE(
      p_data#>>'{price,amount}', p_data->>'price', p_data->>'priceText'
    )),
    CASE WHEN length(v_currency)=3 THEN v_currency ELSE 'PLN' END,
    artway_safe_numeric(COALESCE(
      p_data#>>'{stock,available}', p_data->>'stockAvailable', p_data->>'quantity'
    )),
    p_source_table, p_record_id, md5(p_data::text), p_updated_at, NOW()
  )
  ON CONFLICT(namespace, channel, offer_id) DO UPDATE SET
    product_id=EXCLUDED.product_id,
    external_id=EXCLUDED.external_id,
    ean=EXCLUDED.ean,
    name=EXCLUDED.name,
    status=EXCLUDED.status,
    price=EXCLUDED.price,
    currency=EXCLUDED.currency,
    quantity=EXCLUDED.quantity,
    source_table=EXCLUDED.source_table,
    source_record_id=EXCLUDED.source_record_id,
    source_hash=EXCLUDED.source_hash,
    source_updated_at=EXCLUDED.source_updated_at,
    updated_at=NOW()
  WHERE artway_channel_offers.source_hash IS DISTINCT FROM EXCLUDED.source_hash;
END $$;

CREATE OR REPLACE FUNCTION artway_orders_shadow_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_channel TEXT;
  v_old_id TEXT;
BEGIN
  v_channel := CASE
    WHEN TG_TABLE_NAME='artway_allegro_orders' THEN 'allegro'
    ELSE 'store'
  END;
  IF TG_OP='DELETE' THEN
    v_old_id := COALESCE(
      NULLIF(OLD.data->>'id',''),
      NULLIF(OLD.data->>'checkoutFormId',''),
      NULLIF(OLD.data->>'nr',''),
      OLD.record_id
    );
    DELETE FROM artway_order_headers
    WHERE namespace=OLD.namespace AND channel=v_channel AND order_id=v_old_id
      AND source_table=TG_TABLE_NAME;
    RETURN OLD;
  END IF;
  PERFORM artway_project_order(
    NEW.namespace, v_channel, TG_TABLE_NAME, NEW.domain, NEW.record_id,
    NEW.data, NEW.updated_at
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM artway_record_projection_error(
    COALESCE(NEW.namespace,OLD.namespace),'orders',TG_TABLE_NAME,TG_OP,
    SQLSTATE,SQLERRM
  );
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS artway_store_orders_shadow_trg ON artway_store_orders;
CREATE TRIGGER artway_store_orders_shadow_trg
AFTER INSERT OR UPDATE OR DELETE ON artway_store_orders
FOR EACH ROW EXECUTE FUNCTION artway_orders_shadow_trigger();
DROP TRIGGER IF EXISTS artway_allegro_orders_shadow_trg ON artway_allegro_orders;
CREATE TRIGGER artway_allegro_orders_shadow_trg
AFTER INSERT OR UPDATE OR DELETE ON artway_allegro_orders
FOR EACH ROW EXECUTE FUNCTION artway_orders_shadow_trigger();

CREATE OR REPLACE FUNCTION artway_allegro_offers_shadow_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_old_id TEXT;
BEGIN
  IF TG_OP='DELETE' THEN
    v_old_id := COALESCE(
      NULLIF(OLD.data->>'id',''), NULLIF(OLD.data->>'offerId',''), OLD.record_id
    );
    DELETE FROM artway_channel_offers
    WHERE namespace=OLD.namespace AND channel='allegro' AND offer_id=v_old_id;
    RETURN OLD;
  END IF;
  PERFORM artway_project_offer(
    NEW.namespace, 'allegro', TG_TABLE_NAME, NEW.record_id, NEW.data, NEW.updated_at
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM artway_record_projection_error(
    COALESCE(NEW.namespace,OLD.namespace),'offers',TG_TABLE_NAME,TG_OP,
    SQLSTATE,SQLERRM
  );
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS artway_allegro_offers_shadow_trg ON artway_allegro_offers;
CREATE TRIGGER artway_allegro_offers_shadow_trg
AFTER INSERT OR UPDATE OR DELETE ON artway_allegro_offers
FOR EACH ROW EXECUTE FUNCTION artway_allegro_offers_shadow_trigger();

CREATE OR REPLACE FUNCTION artway_von_halsky_shadow_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_old_id TEXT;
BEGIN
  IF OLD.kind NOT IN ('offers','orders') AND
     (TG_OP='DELETE' OR NEW.kind NOT IN ('offers','orders')) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP='DELETE' THEN
    IF OLD.kind='offers' THEN
      v_old_id := COALESCE(NULLIF(OLD.data->>'offerId',''), OLD.record_id);
      DELETE FROM artway_channel_offers
      WHERE namespace=OLD.namespace AND channel='von_halsky' AND offer_id=v_old_id;
    ELSIF OLD.kind='orders' THEN
      v_old_id := COALESCE(NULLIF(OLD.data->>'id',''), OLD.record_id);
      DELETE FROM artway_order_headers
      WHERE namespace=OLD.namespace AND channel='von_halsky' AND order_id=v_old_id;
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.kind='offers' THEN
    PERFORM artway_project_offer(
      NEW.namespace, 'von_halsky', TG_TABLE_NAME, NEW.record_id,
      NEW.data, NEW.updated_at
    );
  ELSIF NEW.kind='orders' THEN
    PERFORM artway_project_order(
      NEW.namespace, 'von_halsky', TG_TABLE_NAME, 'von_halsky:orders',
      NEW.record_id, NEW.data, NEW.updated_at
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM artway_record_projection_error(
    COALESCE(NEW.namespace,OLD.namespace),
    CASE WHEN COALESCE(NEW.kind,OLD.kind)='orders' THEN 'orders' ELSE 'offers' END,
    TG_TABLE_NAME,TG_OP,SQLSTATE,SQLERRM
  );
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS artway_von_halsky_shadow_trg ON artway_von_halsky_records;
CREATE TRIGGER artway_von_halsky_shadow_trg
AFTER INSERT OR UPDATE OR DELETE ON artway_von_halsky_records
FOR EACH ROW EXECUTE FUNCTION artway_von_halsky_shadow_trigger();

CREATE OR REPLACE FUNCTION artway_agent_records_shadow_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    DELETE FROM artway_agent_work_items
    WHERE namespace=OLD.namespace
      AND source_kind='record:' || OLD.domain || ':' || OLD.collection
      AND work_id=OLD.record_id;
    RETURN OLD;
  END IF;
  INSERT INTO artway_agent_work_items(
    namespace, source_kind, work_id, work_type, area, entity_id, status,
    priority, attempts, requires_approval, created_at, started_at, completed_at,
    source_hash, source_updated_at, updated_at
  ) VALUES(
    NEW.namespace, 'record:' || NEW.domain || ':' || NEW.collection,
    NEW.record_id,
    COALESCE(NEW.data->>'kind', NEW.data->>'type', NEW.domain),
    COALESCE(NEW.data->>'area', ''),
    COALESCE(
      NEW.data->>'productId', NEW.data->>'entityId',
      NEW.data#>>'{target,id}', NEW.data->>'subjectKey', ''
    ),
    lower(COALESCE(NEW.data->>'status', NEW.data->>'state', '')),
    COALESCE((artway_safe_numeric(NEW.data->>'priority'))::integer, 100),
    COALESCE((artway_safe_numeric(COALESCE(
      NEW.data->>'attempts', NEW.data->>'attemptCount'
    )))::integer, 0),
    artway_safe_boolean(NEW.data->>'requiresApproval', FALSE),
    artway_safe_timestamptz(COALESCE(NEW.data->>'createdAt', NEW.data->>'at')),
    artway_safe_timestamptz(NEW.data->>'startedAt'),
    artway_safe_timestamptz(NEW.data->>'completedAt'),
    md5(NEW.data::text), NEW.updated_at, NOW()
  )
  ON CONFLICT(namespace, source_kind, work_id) DO UPDATE SET
    work_type=EXCLUDED.work_type,
    area=EXCLUDED.area,
    entity_id=EXCLUDED.entity_id,
    status=EXCLUDED.status,
    priority=EXCLUDED.priority,
    attempts=EXCLUDED.attempts,
    requires_approval=EXCLUDED.requires_approval,
    created_at=EXCLUDED.created_at,
    started_at=EXCLUDED.started_at,
    completed_at=EXCLUDED.completed_at,
    source_hash=EXCLUDED.source_hash,
    source_updated_at=EXCLUDED.source_updated_at,
    updated_at=NOW()
  WHERE artway_agent_work_items.source_hash IS DISTINCT FROM EXCLUDED.source_hash;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM artway_record_projection_error(
    COALESCE(NEW.namespace,OLD.namespace),'agent_work',TG_TABLE_NAME,TG_OP,
    SQLSTATE,SQLERRM
  );
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS artway_agent_records_shadow_trg ON artway_agent_records;
CREATE TRIGGER artway_agent_records_shadow_trg
AFTER INSERT OR UPDATE OR DELETE ON artway_agent_records
FOR EACH ROW EXECUTE FUNCTION artway_agent_records_shadow_trigger();

CREATE OR REPLACE FUNCTION artway_agent_events_shadow_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    DELETE FROM artway_agent_work_items
    WHERE namespace=OLD.namespace AND source_kind='event' AND work_id=OLD.event_id;
    RETURN OLD;
  END IF;
  INSERT INTO artway_agent_work_items(
    namespace, source_kind, work_id, work_type, area, entity_id, status,
    priority, attempts, requires_approval, created_at, started_at, completed_at,
    source_hash, source_updated_at, updated_at
  ) VALUES(
    NEW.namespace, 'event', NEW.event_id, NEW.event_type, NEW.area,
    NEW.entity_id, NEW.status, NEW.priority, NEW.attempts,
    NEW.status='decision_required', NEW.created_at, NEW.started_at,
    NEW.completed_at,
    md5(concat_ws('|', NEW.event_type, NEW.status, NEW.attempts, NEW.payload::text,
      NEW.result::text, NEW.last_error)),
    NEW.updated_at, NOW()
  )
  ON CONFLICT(namespace, source_kind, work_id) DO UPDATE SET
    work_type=EXCLUDED.work_type,
    area=EXCLUDED.area,
    entity_id=EXCLUDED.entity_id,
    status=EXCLUDED.status,
    priority=EXCLUDED.priority,
    attempts=EXCLUDED.attempts,
    requires_approval=EXCLUDED.requires_approval,
    created_at=EXCLUDED.created_at,
    started_at=EXCLUDED.started_at,
    completed_at=EXCLUDED.completed_at,
    source_hash=EXCLUDED.source_hash,
    source_updated_at=EXCLUDED.source_updated_at,
    updated_at=NOW()
  WHERE artway_agent_work_items.source_hash IS DISTINCT FROM EXCLUDED.source_hash;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM artway_record_projection_error(
    COALESCE(NEW.namespace,OLD.namespace),'agent_work',TG_TABLE_NAME,TG_OP,
    SQLSTATE,SQLERRM
  );
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS artway_agent_events_shadow_trg ON artway_agent_events;
CREATE TRIGGER artway_agent_events_shadow_trg
AFTER INSERT OR UPDATE OR DELETE ON artway_agent_events
FOR EACH ROW EXECUTE FUNCTION artway_agent_events_shadow_trigger();

CREATE OR REPLACE FUNCTION artway_project_warehouse_record(
  p_namespace TEXT,
  p_domain TEXT,
  p_record_id TEXT,
  p_data JSONB,
  p_updated_at TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_lines JSONB;
  v_entry RECORD;
  v_item JSONB;
  v_line_id TEXT;
  v_location TEXT;
  v_stock JSONB;
BEGIN
  IF p_domain='settings:artway_magazyn_lokalizacje' THEN
    INSERT INTO artway_inventory_locations(
      namespace, location_id, code, parent_code, location_type, zone, name,
      active, unlimited_capacity, source_hash, source_updated_at, updated_at
    ) VALUES(
      p_namespace, p_record_id, COALESCE(p_data->>'kod',''),
      COALESCE(p_data->>'parentKod',''), COALESCE(p_data->>'typ',''),
      COALESCE(p_data->>'strefa',''), COALESCE(p_data->>'nazwa',''),
      artway_safe_boolean(p_data->>'aktywna', TRUE),
      artway_safe_boolean(p_data->>'bezLimitu', TRUE),
      md5(p_data::text), p_updated_at, NOW()
    )
    ON CONFLICT(namespace, location_id) DO UPDATE SET
      code=EXCLUDED.code, parent_code=EXCLUDED.parent_code,
      location_type=EXCLUDED.location_type, zone=EXCLUDED.zone,
      name=EXCLUDED.name, active=EXCLUDED.active,
      unlimited_capacity=EXCLUDED.unlimited_capacity,
      source_hash=EXCLUDED.source_hash,
      source_updated_at=EXCLUDED.source_updated_at, updated_at=NOW()
    WHERE artway_inventory_locations.source_hash IS DISTINCT FROM EXCLUDED.source_hash;
  ELSIF p_domain='settings:artway_stany' THEN
    SELECT data INTO v_stock FROM artway_domain_records
    WHERE namespace=p_namespace
      AND domain='settings:artway_magazyn_produkty'
      AND record_id=p_record_id
    LIMIT 1;
    v_location := COALESCE(v_stock->>'lokalizacja','');
    INSERT INTO artway_inventory_balances(
      namespace, product_id, location_code, quantity, source_hash,
      source_updated_at, updated_at
    ) VALUES(
      p_namespace, p_record_id, v_location,
      COALESCE(artway_safe_numeric(p_data#>>'{}'), 0),
      md5(p_data::text || '|' || v_location), p_updated_at, NOW()
    )
    ON CONFLICT(namespace, product_id) DO UPDATE SET
      location_code=EXCLUDED.location_code, quantity=EXCLUDED.quantity,
      source_hash=EXCLUDED.source_hash,
      source_updated_at=EXCLUDED.source_updated_at, updated_at=NOW()
    WHERE artway_inventory_balances.source_hash IS DISTINCT FROM EXCLUDED.source_hash;
  ELSIF p_domain='settings:artway_magazyn_produkty' THEN
    SELECT data INTO v_stock FROM artway_domain_records
    WHERE namespace=p_namespace AND domain='settings:artway_stany'
      AND record_id=p_record_id
    LIMIT 1;
    v_location := COALESCE(p_data->>'lokalizacja','');
    INSERT INTO artway_inventory_balances(
      namespace, product_id, location_code, quantity, source_hash,
      source_updated_at, updated_at
    ) VALUES(
      p_namespace, p_record_id, v_location,
      COALESCE(artway_safe_numeric(v_stock#>>'{}'), 0),
      md5(COALESCE(v_stock,'0'::jsonb)::text || '|' || v_location),
      p_updated_at, NOW()
    )
    ON CONFLICT(namespace, product_id) DO UPDATE SET
      location_code=EXCLUDED.location_code, quantity=EXCLUDED.quantity,
      source_hash=EXCLUDED.source_hash,
      source_updated_at=EXCLUDED.source_updated_at, updated_at=NOW()
    WHERE artway_inventory_balances.source_hash IS DISTINCT FROM EXCLUDED.source_hash;
  ELSIF p_domain='settings:artway_ruchy_magazynowe' THEN
    INSERT INTO artway_inventory_movements(
      namespace, movement_id, product_id, sku, movement_type, quantity,
      stock_before, stock_after, document_no, reason, actor, occurred_at,
      source_hash, source_updated_at, updated_at
    ) VALUES(
      p_namespace, p_record_id, COALESCE(p_data->>'produktId',''),
      COALESCE(p_data->>'sku',''), COALESCE(p_data->>'typ',''),
      COALESCE(artway_safe_numeric(COALESCE(p_data->>'ilosc',p_data->>'delta')),0),
      artway_safe_numeric(p_data->>'stanPrzed'),
      artway_safe_numeric(p_data->>'stanPo'),
      COALESCE(p_data->>'dokument',''), COALESCE(p_data->>'powod',''),
      COALESCE(p_data->>'operator',''),
      artway_safe_timestamptz(COALESCE(p_data->>'data',p_data->>'createdAt')),
      md5(p_data::text), p_updated_at, NOW()
    )
    ON CONFLICT(namespace, movement_id) DO UPDATE SET
      product_id=EXCLUDED.product_id, sku=EXCLUDED.sku,
      movement_type=EXCLUDED.movement_type, quantity=EXCLUDED.quantity,
      stock_before=EXCLUDED.stock_before, stock_after=EXCLUDED.stock_after,
      document_no=EXCLUDED.document_no, reason=EXCLUDED.reason,
      actor=EXCLUDED.actor, occurred_at=EXCLUDED.occurred_at,
      source_hash=EXCLUDED.source_hash,
      source_updated_at=EXCLUDED.source_updated_at, updated_at=NOW()
    WHERE artway_inventory_movements.source_hash IS DISTINCT FROM EXCLUDED.source_hash;
  ELSIF p_domain='settings:artway_dokumenty_magazynowe' THEN
    INSERT INTO artway_warehouse_documents(
      namespace, document_id, document_no, document_type, status, note,
      actor, document_at, source_hash, source_updated_at, updated_at
    ) VALUES(
      p_namespace, p_record_id, COALESCE(p_data->>'number',p_data->>'numer',''),
      upper(COALESCE(p_data->>'type',p_data->>'typ','')),
      lower(COALESCE(p_data->>'status','draft')),
      COALESCE(p_data->>'note',p_data->>'uwagi',''),
      COALESCE(p_data->>'createdBy',p_data->>'operator',''),
      artway_safe_timestamptz(COALESCE(
        p_data->>'createdAt',p_data->>'data',p_data->>'updatedAt'
      )),
      md5(p_data::text), p_updated_at, NOW()
    )
    ON CONFLICT(namespace, document_id) DO UPDATE SET
      document_no=EXCLUDED.document_no, document_type=EXCLUDED.document_type,
      status=EXCLUDED.status, note=EXCLUDED.note, actor=EXCLUDED.actor,
      document_at=EXCLUDED.document_at, source_hash=EXCLUDED.source_hash,
      source_updated_at=EXCLUDED.source_updated_at, updated_at=NOW()
    WHERE artway_warehouse_documents.source_hash IS DISTINCT FROM EXCLUDED.source_hash;
    DELETE FROM artway_warehouse_document_items
    WHERE namespace=p_namespace AND document_id=p_record_id;
    v_lines := CASE
      WHEN jsonb_typeof(p_data->'lines')='array' THEN p_data->'lines'
      WHEN jsonb_typeof(p_data->'pozycje')='array' THEN p_data->'pozycje'
      ELSE '[]'::jsonb
    END;
    FOR v_entry IN
      SELECT value AS item, ordinality::integer AS ordinal
      FROM jsonb_array_elements(v_lines) WITH ORDINALITY
    LOOP
      v_item := v_entry.item;
      v_line_id := COALESCE(
        NULLIF(v_item->>'lineId',''), NULLIF(v_item->>'id',''),
        md5(v_item::text || ':' || v_entry.ordinal::text)
      );
      INSERT INTO artway_warehouse_document_items(
        namespace, document_id, line_id, ordinal, product_id, sku, ean,
        name, quantity, location_code
      ) VALUES(
        p_namespace, p_record_id, v_line_id, v_entry.ordinal - 1,
        COALESCE(v_item->>'productId',v_item->>'produktId',''),
        COALESCE(v_item->>'sku',''),
        regexp_replace(COALESCE(v_item->>'ean',v_item->>'gtin',''),'\s','','g'),
        COALESCE(v_item->>'name',v_item->>'nazwa',''),
        COALESCE(artway_safe_numeric(COALESCE(
          v_item->>'quantity',v_item->>'ilosc',v_item->>'delta'
        )),0),
        COALESCE(v_item->>'location',v_item->>'lokalizacja','')
      );
    END LOOP;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION artway_warehouse_shadow_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.domain='settings:artway_magazyn_lokalizacje' THEN
      DELETE FROM artway_inventory_locations
      WHERE namespace=OLD.namespace AND location_id=OLD.record_id;
    ELSIF OLD.domain IN ('settings:artway_stany','settings:artway_magazyn_produkty') THEN
      IF NOT EXISTS(
        SELECT 1 FROM artway_domain_records
        WHERE namespace=OLD.namespace
          AND domain IN ('settings:artway_stany','settings:artway_magazyn_produkty')
          AND record_id=OLD.record_id
          AND NOT (domain=OLD.domain AND collection=OLD.collection)
      ) THEN
        DELETE FROM artway_inventory_balances
        WHERE namespace=OLD.namespace AND product_id=OLD.record_id;
      END IF;
    ELSIF OLD.domain='settings:artway_ruchy_magazynowe' THEN
      DELETE FROM artway_inventory_movements
      WHERE namespace=OLD.namespace AND movement_id=OLD.record_id;
    ELSIF OLD.domain='settings:artway_dokumenty_magazynowe' THEN
      DELETE FROM artway_warehouse_documents
      WHERE namespace=OLD.namespace AND document_id=OLD.record_id;
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.domain IN (
    'settings:artway_magazyn_lokalizacje',
    'settings:artway_stany',
    'settings:artway_magazyn_produkty',
    'settings:artway_ruchy_magazynowe',
    'settings:artway_dokumenty_magazynowe'
  ) THEN
    PERFORM artway_project_warehouse_record(
      NEW.namespace, NEW.domain, NEW.record_id, NEW.data, NEW.updated_at
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM artway_record_projection_error(
    COALESCE(NEW.namespace,OLD.namespace),'warehouse',TG_TABLE_NAME,TG_OP,
    SQLSTATE,SQLERRM
  );
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS artway_warehouse_shadow_trg ON artway_domain_records;
CREATE TRIGGER artway_warehouse_shadow_trg
AFTER INSERT OR UPDATE OR DELETE ON artway_domain_records
FOR EACH ROW EXECUTE FUNCTION artway_warehouse_shadow_trigger();

-- Pierwsze wypełnienie cieni. Od tej chwili kolejne zmiany utrzymują triggery.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM artway_store_orders LOOP
    PERFORM artway_project_order(
      r.namespace,'store','artway_store_orders',r.domain,r.record_id,r.data,r.updated_at
    );
  END LOOP;
  FOR r IN SELECT * FROM artway_allegro_orders LOOP
    PERFORM artway_project_order(
      r.namespace,'allegro','artway_allegro_orders',r.domain,r.record_id,r.data,r.updated_at
    );
  END LOOP;
  FOR r IN SELECT * FROM artway_allegro_offers LOOP
    PERFORM artway_project_offer(
      r.namespace,'allegro','artway_allegro_offers',r.record_id,r.data,r.updated_at
    );
  END LOOP;
  FOR r IN SELECT * FROM artway_von_halsky_records WHERE kind='offers' LOOP
    PERFORM artway_project_offer(
      r.namespace,'von_halsky','artway_von_halsky_records',r.record_id,r.data,r.updated_at
    );
  END LOOP;
  FOR r IN SELECT * FROM artway_von_halsky_records WHERE kind='orders' LOOP
    PERFORM artway_project_order(
      r.namespace,'von_halsky','artway_von_halsky_records','von_halsky:orders',
      r.record_id,r.data,r.updated_at
    );
  END LOOP;
  FOR r IN SELECT * FROM artway_agent_records LOOP
    INSERT INTO artway_agent_work_items(
      namespace,source_kind,work_id,work_type,area,entity_id,status,priority,
      attempts,requires_approval,created_at,started_at,completed_at,source_hash,
      source_updated_at,updated_at
    ) VALUES(
      r.namespace,'record:'||r.domain||':'||r.collection,r.record_id,
      COALESCE(r.data->>'kind',r.data->>'type',r.domain),
      COALESCE(r.data->>'area',''),
      COALESCE(r.data->>'productId',r.data->>'entityId',r.data#>>'{target,id}',
        r.data->>'subjectKey',''),
      lower(COALESCE(r.data->>'status',r.data->>'state','')),
      COALESCE((artway_safe_numeric(r.data->>'priority'))::integer,100),
      COALESCE((artway_safe_numeric(COALESCE(
        r.data->>'attempts',r.data->>'attemptCount'
      )))::integer,0),
      COALESCE((r.data->>'requiresApproval')::boolean,FALSE),
      artway_safe_timestamptz(COALESCE(r.data->>'createdAt',r.data->>'at')),
      artway_safe_timestamptz(r.data->>'startedAt'),
      artway_safe_timestamptz(r.data->>'completedAt'),
      md5(r.data::text),r.updated_at,NOW()
    ) ON CONFLICT(namespace,source_kind,work_id) DO NOTHING;
  END LOOP;
  FOR r IN SELECT * FROM artway_agent_events LOOP
    INSERT INTO artway_agent_work_items(
      namespace,source_kind,work_id,work_type,area,entity_id,status,priority,
      attempts,requires_approval,created_at,started_at,completed_at,source_hash,
      source_updated_at,updated_at
    ) VALUES(
      r.namespace,'event',r.event_id,r.event_type,r.area,r.entity_id,r.status,
      r.priority,r.attempts,r.status='decision_required',r.created_at,r.started_at,
      r.completed_at,md5(concat_ws('|',r.event_type,r.status,r.attempts,
        r.payload::text,r.result::text,r.last_error)),r.updated_at,NOW()
    ) ON CONFLICT(namespace,source_kind,work_id) DO NOTHING;
  END LOOP;
  FOR r IN
    SELECT * FROM artway_domain_records WHERE domain IN (
      'settings:artway_magazyn_lokalizacje',
      'settings:artway_stany',
      'settings:artway_magazyn_produkty',
      'settings:artway_ruchy_magazynowe',
      'settings:artway_dokumenty_magazynowe'
    ) ORDER BY CASE domain
      WHEN 'settings:artway_magazyn_lokalizacje' THEN 1
      WHEN 'settings:artway_magazyn_produkty' THEN 2
      WHEN 'settings:artway_stany' THEN 3
      WHEN 'settings:artway_ruchy_magazynowe' THEN 4
      ELSE 5 END, ordinal
  LOOP
    PERFORM artway_project_warehouse_record(
      r.namespace,r.domain,r.record_id,r.data,r.updated_at
    );
  END LOOP;
END $$;
