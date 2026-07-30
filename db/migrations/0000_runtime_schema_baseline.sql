-- Pełny schemat bazowy musi powstać przed migracjami domenowymi.
-- Wszystkie polecenia są idempotentne, ponieważ istniejąca produkcja miała
-- wcześniej część DDL wykonywaną przy starcie modułów aplikacji.

CREATE TABLE IF NOT EXISTS artway_kv_store (
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  version BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace, key)
);

CREATE TABLE IF NOT EXISTS artway_domain_snapshots (
  namespace TEXT NOT NULL,
  domain TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash TEXT NOT NULL DEFAULT '',
  version BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace, domain)
);
ALTER TABLE artway_domain_snapshots
  ADD COLUMN IF NOT EXISTS content_hash TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS artway_domain_records (
  namespace TEXT NOT NULL,
  domain TEXT NOT NULL,
  collection TEXT NOT NULL,
  record_id TEXT NOT NULL,
  ordinal BIGINT NOT NULL DEFAULT 0,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace, domain, collection, record_id)
);
DO $$
BEGIN
  ALTER TABLE artway_domain_records
    ADD CONSTRAINT artway_domain_records_snapshot_fk
    FOREIGN KEY(namespace, domain)
    REFERENCES artway_domain_snapshots(namespace, domain)
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS artway_domain_records_order_idx
  ON artway_domain_records(namespace, domain, collection, ordinal);
CREATE INDEX IF NOT EXISTS artway_domain_records_data_idx
  ON artway_domain_records USING GIN(data jsonb_path_ops);

CREATE TABLE IF NOT EXISTS artway_domain_migrations (
  namespace TEXT NOT NULL,
  migration_id TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace, migration_id)
);
CREATE TABLE IF NOT EXISTS artway_domain_legacy_backup (
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  migration_id TEXT NOT NULL,
  value JSONB NOT NULL,
  version BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace, key, migration_id)
);

CREATE TABLE IF NOT EXISTS artway_store_orders (
  namespace TEXT NOT NULL,
  domain TEXT NOT NULL,
  collection TEXT NOT NULL,
  record_id TEXT NOT NULL,
  ordinal BIGINT NOT NULL DEFAULT 0,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT GENERATED ALWAYS AS (COALESCE(data->>'status', '')) STORED,
  customer_email TEXT GENERATED ALWAYS AS (
    lower(COALESCE(data->>'email', data->>'customerEmail', ''))
  ) STORED,
  PRIMARY KEY(namespace, domain, collection, record_id),
  FOREIGN KEY(namespace, domain)
    REFERENCES artway_domain_snapshots(namespace, domain) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS artway_store_orders_status_idx
  ON artway_store_orders(namespace, domain, status, ordinal);
CREATE INDEX IF NOT EXISTS artway_store_orders_email_idx
  ON artway_store_orders(namespace, customer_email)
  WHERE customer_email <> '';

CREATE TABLE IF NOT EXISTS artway_allegro_orders (
  namespace TEXT NOT NULL,
  domain TEXT NOT NULL,
  collection TEXT NOT NULL,
  record_id TEXT NOT NULL,
  ordinal BIGINT NOT NULL DEFAULT 0,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT GENERATED ALWAYS AS (
    COALESCE(data->>'status', data->>'fulfillmentStatus', '')
  ) STORED,
  checkout_form_id TEXT GENERATED ALWAYS AS (
    COALESCE(data->>'checkoutFormId', data->>'checkout_form_id', '')
  ) STORED,
  PRIMARY KEY(namespace, domain, collection, record_id),
  FOREIGN KEY(namespace, domain)
    REFERENCES artway_domain_snapshots(namespace, domain) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS artway_allegro_orders_status_idx
  ON artway_allegro_orders(namespace, status, ordinal);
CREATE INDEX IF NOT EXISTS artway_allegro_orders_checkout_idx
  ON artway_allegro_orders(namespace, checkout_form_id)
  WHERE checkout_form_id <> '';

CREATE TABLE IF NOT EXISTS artway_allegro_offers (
  namespace TEXT NOT NULL,
  domain TEXT NOT NULL,
  collection TEXT NOT NULL,
  record_id TEXT NOT NULL,
  ordinal BIGINT NOT NULL DEFAULT 0,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT GENERATED ALWAYS AS (
    COALESCE(data->>'status', data#>>'{publication,status}', '')
  ) STORED,
  product_id TEXT GENERATED ALWAYS AS (
    COALESCE(data->>'productId', data#>>'{product,id}', '')
  ) STORED,
  PRIMARY KEY(namespace, domain, collection, record_id),
  FOREIGN KEY(namespace, domain)
    REFERENCES artway_domain_snapshots(namespace, domain) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS artway_allegro_offers_status_idx
  ON artway_allegro_offers(namespace, status, ordinal);
CREATE INDEX IF NOT EXISTS artway_allegro_offers_product_idx
  ON artway_allegro_offers(namespace, product_id)
  WHERE product_id <> '';
CREATE INDEX IF NOT EXISTS artway_allegro_offers_data_idx
  ON artway_allegro_offers USING GIN(data jsonb_path_ops);

CREATE TABLE IF NOT EXISTS artway_allegro_mappings (
  namespace TEXT NOT NULL,
  domain TEXT NOT NULL,
  collection TEXT NOT NULL,
  record_id TEXT NOT NULL,
  ordinal BIGINT NOT NULL DEFAULT 0,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  product_id TEXT GENERATED ALWAYS AS (COALESCE(data->>'productId', '')) STORED,
  mapping_state TEXT GENERATED ALWAYS AS (
    COALESCE(data->>'mappingRole', data->>'lifecycle', data->>'status', '')
  ) STORED,
  PRIMARY KEY(namespace, domain, collection, record_id),
  FOREIGN KEY(namespace, domain)
    REFERENCES artway_domain_snapshots(namespace, domain) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS artway_allegro_mappings_product_idx
  ON artway_allegro_mappings(namespace, product_id)
  WHERE product_id <> '';
CREATE INDEX IF NOT EXISTS artway_allegro_mappings_state_idx
  ON artway_allegro_mappings(namespace, mapping_state);

CREATE TABLE IF NOT EXISTS artway_allegro_communications (
  namespace TEXT NOT NULL,
  domain TEXT NOT NULL,
  collection TEXT NOT NULL,
  record_id TEXT NOT NULL,
  ordinal BIGINT NOT NULL DEFAULT 0,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT GENERATED ALWAYS AS (
    COALESCE(data->>'status', data->>'state', '')
  ) STORED,
  buyer_login TEXT GENERATED ALWAYS AS (
    lower(COALESCE(data->>'buyerLogin', data#>>'{interlocutor,login}', ''))
  ) STORED,
  PRIMARY KEY(namespace, domain, collection, record_id),
  FOREIGN KEY(namespace, domain)
    REFERENCES artway_domain_snapshots(namespace, domain) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS artway_allegro_communications_status_idx
  ON artway_allegro_communications(namespace, domain, collection, status, ordinal);
CREATE INDEX IF NOT EXISTS artway_allegro_communications_buyer_idx
  ON artway_allegro_communications(namespace, buyer_login)
  WHERE buyer_login <> '';
CREATE INDEX IF NOT EXISTS artway_allegro_communications_data_idx
  ON artway_allegro_communications USING GIN(data jsonb_path_ops);

CREATE TABLE IF NOT EXISTS artway_agent_records (
  namespace TEXT NOT NULL,
  domain TEXT NOT NULL,
  collection TEXT NOT NULL,
  record_id TEXT NOT NULL,
  ordinal BIGINT NOT NULL DEFAULT 0,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  state TEXT GENERATED ALWAYS AS (
    COALESCE(data->>'state', data->>'status', '')
  ) STORED,
  event_at TEXT GENERATED ALWAYS AS (
    COALESCE(data->>'at', data->>'createdAt', data->>'updatedAt', '')
  ) STORED,
  PRIMARY KEY(namespace, domain, collection, record_id),
  FOREIGN KEY(namespace, domain)
    REFERENCES artway_domain_snapshots(namespace, domain) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS artway_agent_records_state_idx
  ON artway_agent_records(namespace, domain, collection, state, ordinal);
CREATE INDEX IF NOT EXISTS artway_agent_records_time_idx
  ON artway_agent_records(namespace, event_at DESC)
  WHERE event_at <> '';
CREATE INDEX IF NOT EXISTS artway_agent_records_data_idx
  ON artway_agent_records USING GIN(data jsonb_path_ops);

CREATE TABLE IF NOT EXISTS artway_domain_records_archive_v2 (
  migration_id TEXT NOT NULL,
  namespace TEXT NOT NULL,
  domain TEXT NOT NULL,
  collection TEXT NOT NULL,
  record_id TEXT NOT NULL,
  ordinal BIGINT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(migration_id, namespace, domain, collection, record_id)
);

CREATE TABLE IF NOT EXISTS artway_products (
  namespace TEXT NOT NULL,
  product_id TEXT NOT NULL,
  data JSONB NOT NULL,
  public_data JSONB NOT NULL,
  admin_list_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  public_list_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  name TEXT NOT NULL DEFAULT '',
  search_text TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  producer TEXT NOT NULL DEFAULT '',
  external_id TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  ean TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'bazowy',
  record_status TEXT NOT NULL DEFAULT 'active',
  stock NUMERIC NULL,
  sale_available BOOLEAN NOT NULL DEFAULT TRUE,
  has_source BOOLEAN NOT NULL DEFAULT FALSE,
  has_allegro BOOLEAN NOT NULL DEFAULT FALSE,
  allegro_status TEXT NOT NULL DEFAULT '',
  missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_count INTEGER NOT NULL DEFAULT 0,
  price NUMERIC NULL,
  allegro_price NUMERIC NULL,
  promotion BOOLEAN NOT NULL DEFAULT FALSE,
  new_product BOOLEAN NOT NULL DEFAULT FALSE,
  rating NUMERIC NULL,
  rating_count INTEGER NOT NULL DEFAULT 0,
  duplicate_store BOOLEAN NOT NULL DEFAULT FALSE,
  duplicate_allegro BOOLEAN NOT NULL DEFAULT FALSE,
  fingerprint TEXT NOT NULL DEFAULT '',
  authoritative_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace, product_id)
);
ALTER TABLE artway_products
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
  GENERATED ALWAYS AS (to_tsvector('simple', search_text)) STORED;
CREATE INDEX IF NOT EXISTS artway_products_search_idx
  ON artway_products(namespace, search_text text_pattern_ops);
CREATE INDEX IF NOT EXISTS artway_products_category_idx
  ON artway_products(namespace, category);
CREATE INDEX IF NOT EXISTS artway_products_producer_idx
  ON artway_products(namespace, producer);
CREATE INDEX IF NOT EXISTS artway_products_status_idx
  ON artway_products(namespace, record_status, sale_available);
CREATE INDEX IF NOT EXISTS artway_products_external_idx
  ON artway_products(namespace, external_id, sku, ean);
CREATE INDEX IF NOT EXISTS artway_products_price_idx
  ON artway_products(namespace, price) WHERE record_status='active';
CREATE INDEX IF NOT EXISTS artway_products_allegro_price_idx
  ON artway_products(namespace, allegro_price) WHERE record_status='active';
CREATE INDEX IF NOT EXISTS artway_products_stock_idx
  ON artway_products(namespace, stock) WHERE record_status='active';
CREATE INDEX IF NOT EXISTS artway_products_missing_idx
  ON artway_products(namespace, missing_count) WHERE record_status='active';
CREATE INDEX IF NOT EXISTS artway_products_updated_idx
  ON artway_products(namespace, updated_at DESC) WHERE record_status='active';
CREATE INDEX IF NOT EXISTS artway_products_channel_idx
  ON artway_products(namespace, has_allegro, allegro_status)
  WHERE record_status='active';
CREATE INDEX IF NOT EXISTS artway_products_public_sort_idx
  ON artway_products(namespace, new_product, rating DESC)
  WHERE record_status='active' AND sale_available=true;
CREATE INDEX IF NOT EXISTS artway_products_search_vector_idx
  ON artway_products USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS artway_products_import_item_idx
  ON artway_products(namespace, (data->>'importItemKey')) WHERE source='import';
CREATE INDEX IF NOT EXISTS artway_products_source_url_idx
  ON artway_products(namespace, (data->>'sourceUrl')) WHERE source='import';

CREATE TABLE IF NOT EXISTS artway_product_catalog_meta (
  namespace TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL DEFAULT 1,
  source_revision TEXT NOT NULL DEFAULT '',
  product_count INTEGER NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS artway_product_mutations (
  namespace TEXT NOT NULL,
  mutation_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  area TEXT NOT NULL DEFAULT 'product',
  actor TEXT NOT NULL DEFAULT 'system',
  fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  remove_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  before_fingerprint TEXT NOT NULL DEFAULT '',
  after_fingerprint TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'applied',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace, mutation_id)
);
CREATE INDEX IF NOT EXISTS artway_product_mutations_product_idx
  ON artway_product_mutations(namespace, product_id, created_at DESC);
CREATE TABLE IF NOT EXISTS artway_product_sequences (
  namespace TEXT NOT NULL,
  sequence_name TEXT NOT NULL,
  next_value BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace, sequence_name)
);

CREATE TABLE IF NOT EXISTS artway_allegro_preparation_tasks (
  namespace TEXT NOT NULL,
  task_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  operation TEXT NOT NULL DEFAULT 'allegro',
  requested_by TEXT NOT NULL DEFAULT 'administrator',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  priority INTEGER NOT NULL DEFAULT 0,
  priority_reason TEXT NOT NULL DEFAULT '',
  attempt INTEGER NOT NULL DEFAULT 0,
  skip_editorial BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace, task_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS artway_allegro_preparation_active_product_idx
  ON artway_allegro_preparation_tasks(namespace, product_id)
  WHERE status IN ('pending', 'running');
CREATE INDEX IF NOT EXISTS artway_allegro_preparation_status_idx
  ON artway_allegro_preparation_tasks(
    namespace, status, priority DESC, requested_at, task_id
  );
CREATE INDEX IF NOT EXISTS artway_allegro_preparation_priority_idx
  ON artway_allegro_preparation_tasks(
    namespace, status, priority DESC, requested_at, task_id
  );
CREATE TABLE IF NOT EXISTS artway_allegro_preparation_batches (
  namespace TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  operation TEXT NOT NULL DEFAULT 'allegro',
  requested_by TEXT NOT NULL DEFAULT 'administrator',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requested_product_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  tracked_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  enqueued INTEGER NOT NULL DEFAULT 0,
  duplicates_skipped INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(namespace, batch_id)
);
CREATE INDEX IF NOT EXISTS artway_allegro_preparation_batches_requested_idx
  ON artway_allegro_preparation_batches(namespace, requested_at DESC);
CREATE TABLE IF NOT EXISTS artway_allegro_preparation_state (
  namespace TEXT PRIMARY KEY,
  blocked_until TIMESTAMPTZ NULL,
  blocked_reason TEXT NOT NULL DEFAULT '',
  legacy_migrated BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artway_agent_events (
  namespace TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  area TEXT NOT NULL DEFAULT 'system',
  entity_id TEXT NOT NULL DEFAULT '',
  dedupe_key TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'server',
  priority INTEGER NOT NULL DEFAULT 100,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace, event_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS artway_agent_events_active_dedupe_idx
  ON artway_agent_events(namespace, dedupe_key)
  WHERE status IN ('queued', 'running');
CREATE INDEX IF NOT EXISTS artway_agent_events_claim_idx
  ON artway_agent_events(namespace, status, priority DESC, created_at, event_id);
CREATE INDEX IF NOT EXISTS artway_agent_events_recent_idx
  ON artway_agent_events(namespace, updated_at DESC);
