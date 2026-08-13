-- Trwała kolejka publikacji Allegro uruchamiana świadomą decyzją administratora.
-- Przygotowanie produktu i publikacja są osobnymi procesami: ta tabela przechowuje
-- wyłącznie zatwierdzone operacje zewnętrzne, ich dzierżawy i wynik końcowy.

CREATE TABLE IF NOT EXISTS artway_allegro_publication_batches (
  namespace TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('activate','draft','update')),
  requested_by TEXT NOT NULL DEFAULT 'administrator',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  product_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  total INTEGER NOT NULL DEFAULT 0,
  enqueued INTEGER NOT NULL DEFAULT 0,
  duplicates_skipped INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(namespace,batch_id)
);

CREATE INDEX IF NOT EXISTS artway_allegro_publication_batches_requested_idx
  ON artway_allegro_publication_batches(namespace,requested_at DESC);

CREATE TABLE IF NOT EXISTS artway_allegro_publication_tasks (
  namespace TEXT NOT NULL,
  task_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('activate','draft','update')),
  stock INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK(status IN ('queued','running','completed','decision_required','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requested_by TEXT NOT NULL DEFAULT 'administrator',
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  lease_until TIMESTAMPTZ,
  worker_id TEXT NOT NULL DEFAULT '',
  claim_token TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  error_code TEXT NOT NULL DEFAULT '',
  error_text TEXT NOT NULL DEFAULT '',
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace,task_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS artway_allegro_publication_one_active_product_idx
  ON artway_allegro_publication_tasks(namespace,product_id)
  WHERE status IN ('queued','running');

CREATE INDEX IF NOT EXISTS artway_allegro_publication_ready_idx
  ON artway_allegro_publication_tasks(namespace,status,available_at,created_at,task_id)
  WHERE status='queued';

CREATE INDEX IF NOT EXISTS artway_allegro_publication_recent_idx
  ON artway_allegro_publication_tasks(namespace,updated_at DESC);

CREATE TABLE IF NOT EXISTS artway_allegro_publication_queue_state (
  namespace TEXT PRIMARY KEY,
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  paused_by TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION artway_notify_allegro_publication_work()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status='queued' THEN
    -- Proces panelowego Agenta czeka na tym kanale. Powiadomienie przerywa
    -- długie oczekiwanie i powoduje natychmiastowe przejęcie publikacji.
    PERFORM pg_notify('artway_agent_panel',NEW.namespace);
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS artway_allegro_publication_notify_trg ON artway_allegro_publication_tasks;
CREATE TRIGGER artway_allegro_publication_notify_trg
AFTER INSERT OR UPDATE OF status,available_at ON artway_allegro_publication_tasks
FOR EACH ROW EXECUTE FUNCTION artway_notify_allegro_publication_work();

-- Wdrożenie może nastąpić po restarcie procesu w środku pojedynczej operacji.
-- Idempotency key zadania powoduje, że ponowienie aktualizuje tę samą ofertę.
UPDATE artway_allegro_publication_tasks
SET status=CASE WHEN attempts>=3 THEN 'decision_required' ELSE 'queued' END,
    available_at=NOW(),started_at=NULL,lease_until=NULL,worker_id='',claim_token='',
    completed_at=CASE WHEN attempts>=3 THEN NOW() ELSE NULL END,
    error_code=CASE WHEN attempts>=3 THEN 'stale_worker_lease' ELSE error_code END,
    error_text=CASE WHEN attempts>=3 THEN 'Publikacja trzykrotnie utraciła proces wykonawczy. Wymaga decyzji administratora.' ELSE error_text END,
    updated_at=NOW()
WHERE status='running' AND (lease_until IS NULL OR lease_until<NOW());

COMMENT ON TABLE artway_allegro_publication_tasks IS
  'Zatwierdzone operacje publikacji Allegro wykonywane trwale przez serwerowego Agenta.';
