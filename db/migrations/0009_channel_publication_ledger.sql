-- Trwały, relacyjny rejestr przygotowania i publikacji kanałów sprzedaży.
-- Nie zastępuje centralnej kartoteki produktu: utrwala stan procesu, dowód API
-- oraz wersję schematu kategorii bez przepisywania całych domen JSON.

CREATE TABLE IF NOT EXISTS artway_channel_product_state (
  namespace TEXT NOT NULL,
  product_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('store','allegro','von_halsky')),
  preparation_status TEXT NOT NULL DEFAULT 'unknown',
  publication_status TEXT NOT NULL DEFAULT 'not_requested',
  category_id TEXT NOT NULL DEFAULT '',
  category_schema_version TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  source_fingerprint TEXT NOT NULL DEFAULT '',
  draft_fingerprint TEXT NOT NULL DEFAULT '',
  last_error_code TEXT NOT NULL DEFAULT '',
  last_error_text TEXT NOT NULL DEFAULT '',
  prepared_at TIMESTAMPTZ,
  publication_requested_at TIMESTAMPTZ,
  provider_confirmed_at TIMESTAMPTZ,
  readback_confirmed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace,product_id,channel)
);

CREATE INDEX IF NOT EXISTS artway_channel_product_state_work_idx
  ON artway_channel_product_state(namespace,channel,preparation_status,publication_status,updated_at DESC);

CREATE INDEX IF NOT EXISTS artway_channel_product_state_target_idx
  ON artway_channel_product_state(namespace,channel,target_id)
  WHERE target_id <> '';

CREATE TABLE IF NOT EXISTS artway_channel_publication_receipts (
  namespace TEXT NOT NULL,
  receipt_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('allegro','von_halsky')),
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL DEFAULT '',
  provider_request_id TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  error_code TEXT NOT NULL DEFAULT '',
  error_text TEXT NOT NULL DEFAULT '',
  request_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  PRIMARY KEY(namespace,receipt_id),
  UNIQUE(namespace,channel,idempotency_key)
);

CREATE INDEX IF NOT EXISTS artway_channel_publication_receipts_product_idx
  ON artway_channel_publication_receipts(namespace,channel,product_id,created_at DESC);

CREATE INDEX IF NOT EXISTS artway_channel_publication_receipts_status_idx
  ON artway_channel_publication_receipts(namespace,channel,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS artway_channel_category_schemas (
  namespace TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('allegro','von_halsky')),
  category_id TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  schema_hash TEXT NOT NULL,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(namespace,channel,category_id)
);

CREATE INDEX IF NOT EXISTS artway_channel_category_schemas_expiry_idx
  ON artway_channel_category_schemas(namespace,channel,expires_at);

COMMENT ON TABLE artway_channel_product_state IS
  'Bieżący stan przygotowania i publikacji produktu osobno dla każdego kanału.';
COMMENT ON TABLE artway_channel_publication_receipts IS
  'Idempotentne potwierdzenia operacji kanałowych wraz z odczytem zwrotnym API.';
COMMENT ON TABLE artway_channel_category_schemas IS
  'Wersjonowana pamięć wymaganych parametrów kategorii pobranych z API kanału.';
