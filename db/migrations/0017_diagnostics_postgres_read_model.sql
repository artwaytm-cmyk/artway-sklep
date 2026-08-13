-- Centralna diagnostyka: osobna relacja i indeksowany model odczytowy.
-- Migracja zachowuje kopię wycofania oraz przenosi istniejące grupy 1:1.

CREATE TABLE IF NOT EXISTS artway_diagnostic_issues (
  namespace TEXT NOT NULL,
  domain TEXT NOT NULL,
  collection TEXT NOT NULL,
  record_id TEXT NOT NULL,
  ordinal BIGINT NOT NULL DEFAULT 0,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT GENERATED ALWAYS AS (COALESCE(data->>'status', 'open')) STORED,
  level TEXT GENERATED ALWAYS AS (COALESCE(data->>'level', 'blad')) STORED,
  last_seen_at TEXT GENERATED ALWAYS AS (COALESCE(data->>'lastSeenAt', '')) STORED,
  PRIMARY KEY(namespace, domain, collection, record_id),
  FOREIGN KEY(namespace, domain)
    REFERENCES artway_domain_snapshots(namespace, domain) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS artway_diagnostic_issues_open_idx
  ON artway_diagnostic_issues(namespace, domain, status, level, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS artway_diagnostic_issues_recent_idx
  ON artway_diagnostic_issues(namespace, domain, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS artway_diagnostic_issues_data_idx
  ON artway_diagnostic_issues USING GIN(data jsonb_path_ops);

INSERT INTO artway_domain_records_archive_v2(
  migration_id,namespace,domain,collection,record_id,ordinal,data,updated_at)
SELECT 'diagnostic-issues-dedicated-v1',namespace,domain,collection,record_id,ordinal,data,updated_at
FROM artway_domain_records
WHERE domain='kv:system_diagnostics'
ON CONFLICT DO NOTHING;

INSERT INTO artway_diagnostic_issues(namespace,domain,collection,record_id,ordinal,data,updated_at)
SELECT namespace,domain,collection,record_id,ordinal,data,updated_at
FROM artway_domain_records
WHERE domain='kv:system_diagnostics'
ON CONFLICT(namespace,domain,collection,record_id) DO UPDATE
SET ordinal=EXCLUDED.ordinal,data=EXCLUDED.data,updated_at=EXCLUDED.updated_at;

DELETE FROM artway_domain_records WHERE domain='kv:system_diagnostics';
