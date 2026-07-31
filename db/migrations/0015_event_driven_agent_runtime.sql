-- Event-driven Agent runtime.
--
-- Every unit of work has a durable idempotency key and a lease.  PostgreSQL
-- wakes workers with NOTIFY; the tables remain the source of truth when a
-- process is restarted or a notification is lost.

ALTER TABLE artway_agent_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS worker_id TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='artway_agent_events_status_chk') THEN
    ALTER TABLE artway_agent_events ADD CONSTRAINT artway_agent_events_status_chk
      CHECK(status IN ('queued','running','completed','failed','decision_required','superseded','cancelled')) NOT VALID;
  END IF;
END
$$;
ALTER TABLE artway_agent_events VALIDATE CONSTRAINT artway_agent_events_status_chk;

-- Historical events were allowed to repeat after completion.  Preserve every
-- old row, but identify it independently; new work uses a stable fingerprint.
UPDATE artway_agent_events
SET idempotency_key='legacy:' || event_id
WHERE idempotency_key='';

CREATE UNIQUE INDEX IF NOT EXISTS artway_agent_events_idempotency_idx
  ON artway_agent_events(namespace,idempotency_key)
  WHERE idempotency_key<>'';

CREATE INDEX IF NOT EXISTS artway_agent_events_ready_idx
  ON artway_agent_events(namespace,status,available_at,priority DESC,created_at,event_id)
  WHERE status='queued';

ALTER TABLE artway_allegro_preparation_tasks
  ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS worker_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS input_fingerprint TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='artway_allegro_preparation_status_chk') THEN
    ALTER TABLE artway_allegro_preparation_tasks ADD CONSTRAINT artway_allegro_preparation_status_chk
      CHECK(status IN ('pending','running','completed','decision_required','waiting_provider','failed','superseded','cancelled','attention')) NOT VALID;
  END IF;
END
$$;
ALTER TABLE artway_allegro_preparation_tasks VALIDATE CONSTRAINT artway_allegro_preparation_status_chk;

CREATE INDEX IF NOT EXISTS artway_allegro_preparation_ready_idx
  ON artway_allegro_preparation_tasks(namespace,status,priority DESC,requested_at,task_id)
  WHERE status='pending';

CREATE TABLE IF NOT EXISTS artway_agent_panel_jobs (
  namespace TEXT NOT NULL,
  job_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  user_email TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',
  context TEXT NOT NULL DEFAULT '',
  response TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK(status IN ('queued','running','completed','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  lease_until TIMESTAMPTZ,
  worker_id TEXT NOT NULL DEFAULT '',
  claim_token TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace,job_id),
  UNIQUE(namespace,request_id)
);

CREATE INDEX IF NOT EXISTS artway_agent_panel_jobs_ready_idx
  ON artway_agent_panel_jobs(namespace,status,available_at,created_at,job_id)
  WHERE status='queued';

CREATE INDEX IF NOT EXISTS artway_agent_panel_jobs_recent_idx
  ON artway_agent_panel_jobs(namespace,updated_at DESC);

CREATE TABLE IF NOT EXISTS artway_agent_workers (
  namespace TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  worker_type TEXT NOT NULL DEFAULT 'panel',
  current_job_id TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace,worker_id)
);

CREATE INDEX IF NOT EXISTS artway_agent_workers_seen_idx
  ON artway_agent_workers(namespace,worker_type,last_seen_at DESC);

CREATE OR REPLACE FUNCTION artway_notify_agent_work()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME='artway_agent_events' AND NEW.status='queued' THEN
    PERFORM pg_notify('artway_agent_events',NEW.namespace);
  ELSIF TG_TABLE_NAME='artway_allegro_preparation_tasks' AND NEW.status='pending' THEN
    PERFORM pg_notify('artway_agent_preparation',NEW.namespace);
  ELSIF TG_TABLE_NAME='artway_agent_panel_jobs' AND NEW.status='queued' THEN
    PERFORM pg_notify('artway_agent_panel',NEW.namespace);
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS artway_agent_events_notify_trg ON artway_agent_events;
CREATE TRIGGER artway_agent_events_notify_trg
AFTER INSERT OR UPDATE OF status,available_at ON artway_agent_events
FOR EACH ROW EXECUTE FUNCTION artway_notify_agent_work();

DROP TRIGGER IF EXISTS artway_agent_preparation_notify_trg ON artway_allegro_preparation_tasks;
CREATE TRIGGER artway_agent_preparation_notify_trg
AFTER INSERT OR UPDATE OF status ON artway_allegro_preparation_tasks
FOR EACH ROW EXECUTE FUNCTION artway_notify_agent_work();

DROP TRIGGER IF EXISTS artway_agent_panel_notify_trg ON artway_agent_panel_jobs;
CREATE TRIGGER artway_agent_panel_notify_trg
AFTER INSERT OR UPDATE OF status,available_at ON artway_agent_panel_jobs
FOR EACH ROW EXECUTE FUNCTION artway_notify_agent_work();

-- Old product-review signals only copied work into the already durable
-- preparation queue.  They are safely closed, never deleted.  The backlog and
-- every new product edit continue through the fingerprinted event flow.
UPDATE artway_agent_events
SET status='superseded',completed_at=NOW(),updated_at=NOW(),
    result=jsonb_build_object('reason','replaced_by_fingerprinted_event_runtime')
WHERE status='queued' AND event_type='product.review'
  AND created_at < NOW() - INTERVAL '5 minutes';

-- Recover abandoned leases from processes that no longer exist.  A live
-- deployment applies this migration while the application is stopped.
UPDATE artway_agent_events
SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END,
    available_at=NOW(),started_at=NULL,lease_until=NULL,worker_id='',
    completed_at=CASE WHEN attempts>=3 THEN NOW() ELSE NULL END,
    last_error=CASE WHEN attempts>=3
      THEN COALESCE(NULLIF(last_error,''),'Wygasła dzierżawa starego procesu.')
      ELSE last_error END,
    updated_at=NOW()
WHERE status='running' AND (lease_until IS NULL OR lease_until<NOW());

UPDATE artway_allegro_preparation_tasks
SET status=CASE WHEN attempt>=3 THEN 'decision_required' ELSE 'pending' END,
    started_at=NULL,lease_until=NULL,worker_id='',
    completed_at=CASE WHEN attempt>=3 THEN NOW() ELSE NULL END,
    result=CASE WHEN attempt>=3
      THEN result || jsonb_build_object('reason','stale_worker_lease_closed')
      ELSE result END,
    updated_at=NOW()
WHERE status='running' AND (lease_until IS NULL OR lease_until<NOW());

COMMENT ON TABLE artway_agent_panel_jobs IS
  'Durable, leased and event-driven queue of commands entered in the administrator panel.';
COMMENT ON COLUMN artway_agent_events.idempotency_key IS
  'Stable event plus input-revision identity; prevents reprocessing the same facts.';
