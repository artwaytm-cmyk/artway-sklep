-- Lekki model sklepu, miesięczna historia mutacji i tabele pomiarowe.
-- Wszystkie elementy działają w trybie shadow/dual-write do czasu uzyskania
-- potwierdzonych porównań po wdrożeniu.

CREATE SCHEMA IF NOT EXISTS artway_archive;

CREATE TABLE IF NOT EXISTS artway_storefront_products (
  namespace TEXT NOT NULL,
  product_id TEXT NOT NULL,
  public_data JSONB NOT NULL,
  list_data JSONB NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  search_text TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  producer TEXT NOT NULL DEFAULT '',
  external_id TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  ean TEXT NOT NULL DEFAULT '',
  record_status TEXT NOT NULL DEFAULT 'active',
  sale_available BOOLEAN NOT NULL DEFAULT TRUE,
  price NUMERIC NULL,
  promotion BOOLEAN NOT NULL DEFAULT FALSE,
  new_product BOOLEAN NOT NULL DEFAULT FALSE,
  rating NUMERIC NULL,
  rating_count INTEGER NOT NULL DEFAULT 0,
  source_hash TEXT NOT NULL,
  source_updated_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', search_text)
  ) STORED,
  PRIMARY KEY(namespace, product_id),
  FOREIGN KEY(namespace, product_id)
    REFERENCES artway_products(namespace, product_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS artway_storefront_products_search_idx
  ON artway_storefront_products USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS artway_storefront_products_category_idx
  ON artway_storefront_products(namespace, category, product_id);
CREATE INDEX IF NOT EXISTS artway_storefront_products_producer_idx
  ON artway_storefront_products(namespace, producer, product_id);
CREATE INDEX IF NOT EXISTS artway_storefront_products_price_idx
  ON artway_storefront_products(namespace, price, product_id)
  WHERE record_status='active' AND sale_available=true;
CREATE INDEX IF NOT EXISTS artway_storefront_products_default_sort_idx
  ON artway_storefront_products(namespace, external_id, sku, product_id)
  WHERE record_status='active' AND sale_available=true;
CREATE INDEX IF NOT EXISTS artway_storefront_products_new_idx
  ON artway_storefront_products(namespace, new_product, rating DESC, product_id)
  WHERE record_status='active' AND sale_available=true;

CREATE OR REPLACE FUNCTION artway_storefront_product_shadow_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    DELETE FROM artway_storefront_products
    WHERE namespace=OLD.namespace AND product_id=OLD.product_id;
    RETURN OLD;
  END IF;
  INSERT INTO artway_storefront_products(
    namespace,product_id,public_data,list_data,name,search_text,category,producer,
    external_id,sku,ean,record_status,sale_available,price,promotion,new_product,
    rating,rating_count,source_hash,source_updated_at,updated_at
  ) VALUES(
    NEW.namespace,NEW.product_id,NEW.public_data,NEW.public_list_data,NEW.name,
    NEW.search_text,NEW.category,NEW.producer,NEW.external_id,NEW.sku,NEW.ean,
    NEW.record_status,NEW.sale_available,NEW.price,NEW.promotion,NEW.new_product,
    NEW.rating,NEW.rating_count,
    md5(NEW.public_data::text || '|' || NEW.public_list_data::text),
    NEW.updated_at,NOW()
  )
  ON CONFLICT(namespace,product_id) DO UPDATE SET
    public_data=EXCLUDED.public_data,
    list_data=EXCLUDED.list_data,
    name=EXCLUDED.name,
    search_text=EXCLUDED.search_text,
    category=EXCLUDED.category,
    producer=EXCLUDED.producer,
    external_id=EXCLUDED.external_id,
    sku=EXCLUDED.sku,
    ean=EXCLUDED.ean,
    record_status=EXCLUDED.record_status,
    sale_available=EXCLUDED.sale_available,
    price=EXCLUDED.price,
    promotion=EXCLUDED.promotion,
    new_product=EXCLUDED.new_product,
    rating=EXCLUDED.rating,
    rating_count=EXCLUDED.rating_count,
    source_hash=EXCLUDED.source_hash,
    source_updated_at=EXCLUDED.source_updated_at,
    updated_at=NOW()
  WHERE artway_storefront_products.source_hash IS DISTINCT FROM EXCLUDED.source_hash
     OR artway_storefront_products.record_status IS DISTINCT FROM EXCLUDED.record_status
     OR artway_storefront_products.sale_available IS DISTINCT FROM EXCLUDED.sale_available;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM artway_record_projection_error(
    COALESCE(NEW.namespace,OLD.namespace),'storefront_products',
    TG_TABLE_NAME,TG_OP,SQLSTATE,SQLERRM
  );
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS artway_storefront_product_shadow_trg ON artway_products;
CREATE TRIGGER artway_storefront_product_shadow_trg
AFTER INSERT OR UPDATE OR DELETE ON artway_products
FOR EACH ROW EXECUTE FUNCTION artway_storefront_product_shadow_trigger();

INSERT INTO artway_storefront_products(
  namespace,product_id,public_data,list_data,name,search_text,category,producer,
  external_id,sku,ean,record_status,sale_available,price,promotion,new_product,
  rating,rating_count,source_hash,source_updated_at,updated_at
)
SELECT namespace,product_id,public_data,public_list_data,name,search_text,category,
  producer,external_id,sku,ean,record_status,sale_available,price,promotion,
  new_product,rating,rating_count,
  md5(public_data::text || '|' || public_list_data::text),updated_at,NOW()
FROM artway_products
ON CONFLICT(namespace,product_id) DO UPDATE SET
  public_data=EXCLUDED.public_data,
  list_data=EXCLUDED.list_data,
  name=EXCLUDED.name,
  search_text=EXCLUDED.search_text,
  category=EXCLUDED.category,
  producer=EXCLUDED.producer,
  external_id=EXCLUDED.external_id,
  sku=EXCLUDED.sku,
  ean=EXCLUDED.ean,
  record_status=EXCLUDED.record_status,
  sale_available=EXCLUDED.sale_available,
  price=EXCLUDED.price,
  promotion=EXCLUDED.promotion,
  new_product=EXCLUDED.new_product,
  rating=EXCLUDED.rating,
  rating_count=EXCLUDED.rating_count,
  source_hash=EXCLUDED.source_hash,
  source_updated_at=EXCLUDED.source_updated_at,
  updated_at=NOW();

CREATE TABLE IF NOT EXISTS artway_mutation_history (
  namespace TEXT NOT NULL,
  mutation_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  area TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT 'system',
  operation TEXT NOT NULL DEFAULT 'update',
  status TEXT NOT NULL DEFAULT 'applied',
  changed_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  removed_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  before_fingerprint TEXT NOT NULL DEFAULT '',
  after_fingerprint TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(namespace, mutation_id, created_at)
) PARTITION BY RANGE(created_at);

DO $$
DECLARE
  month_start DATE;
  next_month DATE;
  partition_name TEXT;
BEGIN
  FOR month_start IN
    SELECT generate_series(
      DATE '2025-01-01', DATE '2028-01-01', INTERVAL '1 month'
    )::date
  LOOP
    next_month := (month_start + INTERVAL '1 month')::date;
    partition_name := 'artway_mutation_history_' || to_char(month_start,'YYYY_MM');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF artway_mutation_history
       FOR VALUES FROM (%L) TO (%L)',
      partition_name, month_start, next_month
    );
  END LOOP;
END $$;
CREATE TABLE IF NOT EXISTS artway_mutation_history_default
  PARTITION OF artway_mutation_history DEFAULT;
CREATE INDEX IF NOT EXISTS artway_mutation_history_entity_idx
  ON artway_mutation_history(namespace,entity_type,entity_id,created_at DESC);
CREATE INDEX IF NOT EXISTS artway_mutation_history_area_idx
  ON artway_mutation_history(namespace,area,created_at DESC);

CREATE OR REPLACE FUNCTION artway_product_mutation_history_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO artway_mutation_history(
    namespace,mutation_id,entity_type,entity_id,area,actor,operation,status,
    changed_fields,removed_fields,before_fingerprint,after_fingerprint,created_at
  ) VALUES(
    NEW.namespace,NEW.mutation_id,'product',NEW.product_id,NEW.area,NEW.actor,
    CASE
      WHEN NEW.area LIKE '%purge%' THEN 'delete'
      WHEN NEW.area LIKE '%upsert%' THEN 'upsert'
      ELSE 'update'
    END,
    NEW.status,NEW.fields,NEW.remove_fields,NEW.before_fingerprint,
    NEW.after_fingerprint,NEW.created_at
  ) ON CONFLICT(namespace,mutation_id,created_at) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM artway_record_projection_error(
    NEW.namespace,'mutation_history',TG_TABLE_NAME,TG_OP,SQLSTATE,SQLERRM
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS artway_product_mutation_history_trg
  ON artway_product_mutations;
CREATE TRIGGER artway_product_mutation_history_trg
AFTER INSERT ON artway_product_mutations
FOR EACH ROW EXECUTE FUNCTION artway_product_mutation_history_trigger();

INSERT INTO artway_mutation_history(
  namespace,mutation_id,entity_type,entity_id,area,actor,operation,status,
  changed_fields,removed_fields,before_fingerprint,after_fingerprint,created_at
)
SELECT namespace,mutation_id,'product',product_id,area,actor,
  CASE
    WHEN area LIKE '%purge%' THEN 'delete'
    WHEN area LIKE '%upsert%' THEN 'upsert'
    ELSE 'update'
  END,
  status,fields,remove_fields,before_fingerprint,after_fingerprint,created_at
FROM artway_product_mutations
ON CONFLICT(namespace,mutation_id,created_at) DO NOTHING;

CREATE TABLE IF NOT EXISTS artway_retention_policies (
  data_class TEXT PRIMARY KEY,
  operational_days INTEGER NOT NULL CHECK(operational_days BETWEEN 1 AND 3650),
  archive_days INTEGER NOT NULL CHECK(archive_days BETWEEN operational_days AND 36500),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO artway_retention_policies(data_class,operational_days,archive_days)
VALUES
  ('mutation_history',180,730),
  ('agent_completed',30,180),
  ('channel_events',90,365),
  ('projection_checks',90,365)
ON CONFLICT(data_class) DO UPDATE SET
  operational_days=EXCLUDED.operational_days,
  archive_days=EXCLUDED.archive_days,
  updated_at=NOW();

CREATE TABLE IF NOT EXISTS artway_db_health_samples (
  sampled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  database_name TEXT NOT NULL,
  database_size_bytes BIGINT NOT NULL DEFAULT 0,
  active_connections INTEGER NOT NULL DEFAULT 0,
  waiting_connections INTEGER NOT NULL DEFAULT 0,
  transactions_per_second NUMERIC NOT NULL DEFAULT 0,
  cache_hit_ratio NUMERIC NULL,
  dead_tuples BIGINT NOT NULL DEFAULT 0,
  oldest_transaction_seconds BIGINT NOT NULL DEFAULT 0,
  wal_bytes BIGINT NOT NULL DEFAULT 0,
  slow_query_count BIGINT NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY(sampled_at, database_name)
);
CREATE INDEX IF NOT EXISTS artway_db_health_samples_recent_idx
  ON artway_db_health_samples(database_name,sampled_at DESC);

CREATE TABLE IF NOT EXISTS artway_index_usage_samples (
  sampled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  schema_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  index_name TEXT NOT NULL,
  index_bytes BIGINT NOT NULL DEFAULT 0,
  scans BIGINT NOT NULL DEFAULT 0,
  tuples_read BIGINT NOT NULL DEFAULT 0,
  tuples_fetched BIGINT NOT NULL DEFAULT 0,
  statistics_reset_at TIMESTAMPTZ NULL,
  PRIMARY KEY(sampled_at,schema_name,index_name)
);
CREATE INDEX IF NOT EXISTS artway_index_usage_samples_lookup_idx
  ON artway_index_usage_samples(schema_name,index_name,sampled_at DESC);

INSERT INTO artway_projection_checks(
  namespace,projection,source_name,mode,details
) VALUES
  ('artway-sklep','orders','artway_store_orders + artway_allegro_orders + von_halsky','shadow','{}'),
  ('artway-sklep','offers','artway_allegro_offers + von_halsky','shadow','{}'),
  ('artway-sklep','agent_work','artway_agent_records + artway_agent_events','shadow','{}'),
  ('artway-sklep','warehouse','artway_domain_records warehouse domains','shadow','{}'),
  ('artway-sklep','storefront_products','artway_products public projection','shadow','{}'),
  ('artway-sklep','mutation_history','artway_product_mutations','shadow','{}')
ON CONFLICT(namespace,projection) DO NOTHING;
