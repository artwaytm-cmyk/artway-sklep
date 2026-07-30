CREATE TABLE IF NOT EXISTS artway_pitr_restore_verification (
  probe_id TEXT PRIMARY KEY,
  phase TEXT NOT NULL CHECK(phase IN ('before_target','after_target')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
