CREATE TABLE IF NOT EXISTS artway_von_halsky_state (
  namespace TEXT PRIMARY KEY,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  sync JSONB NOT NULL DEFAULT '{}'::jsonb,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artway_von_halsky_records (
  namespace TEXT NOT NULL REFERENCES artway_von_halsky_state(namespace) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'diagnostics', 'offers', 'orders', 'returns', 'claims',
    'events', 'commands', 'categories'
  )),
  record_id TEXT NOT NULL,
  ordinal BIGINT NOT NULL DEFAULT 0 CHECK (ordinal >= 0),
  data JSONB NOT NULL,
  status TEXT GENERATED ALWAYS AS (
    upper(COALESCE(data->>'status', data->>'state', data#>>'{offer,status}', ''))
  ) STORED,
  external_id TEXT GENERATED ALWAYS AS (
    COALESCE(data->>'externalId', data#>>'{offer,externalId}', '')
  ) STORED,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (namespace, kind, record_id)
);

CREATE INDEX IF NOT EXISTS artway_von_halsky_records_order_idx
  ON artway_von_halsky_records(namespace, kind, ordinal);

CREATE INDEX IF NOT EXISTS artway_von_halsky_records_status_idx
  ON artway_von_halsky_records(namespace, kind, status)
  WHERE status <> '';

CREATE INDEX IF NOT EXISTS artway_von_halsky_records_external_idx
  ON artway_von_halsky_records(namespace, external_id)
  WHERE kind = 'offers' AND external_id <> '';

INSERT INTO artway_von_halsky_state(namespace, settings, sync, version, updated_at)
SELECT
  namespace,
  COALESCE(value->'settings', '{}'::jsonb),
  COALESCE(value->'sync', '{}'::jsonb),
  GREATEST(1, version),
  updated_at
FROM artway_kv_store
WHERE key = 'inpost_von_halsky_channel'
ON CONFLICT (namespace) DO NOTHING;

WITH legacy AS (
  SELECT namespace, value
  FROM artway_kv_store
  WHERE key = 'inpost_von_halsky_channel'
),
collections(kind) AS (
  VALUES
    ('diagnostics'), ('offers'), ('orders'), ('returns'),
    ('claims'), ('events'), ('commands'), ('categories')
),
expanded AS (
  SELECT
    legacy.namespace,
    collections.kind,
    entry.data,
    entry.ordinality - 1 AS ordinal
  FROM legacy
  CROSS JOIN collections
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(legacy.value->collections.kind) = 'array'
        THEN legacy.value->collections.kind
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS entry(data, ordinality)
)
INSERT INTO artway_von_halsky_records(namespace, kind, record_id, ordinal, data, updated_at)
SELECT
  namespace,
  kind,
  COALESCE(
    NULLIF(data->>'offerId', ''),
    NULLIF(data->>'commandId', ''),
    NULLIF(data->>'claimId', ''),
    NULLIF(data->>'eventId', ''),
    NULLIF(data->>'id', ''),
    NULLIF(data#>>'{offer,id}', ''),
    md5(data::text || ':' || ordinal::text)
  ),
  ordinal,
  data,
  NOW()
FROM expanded
ON CONFLICT (namespace, kind, record_id) DO NOTHING;
