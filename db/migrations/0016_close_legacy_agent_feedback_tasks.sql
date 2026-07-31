-- Close preparation work produced by the former feedback loop.
--
-- These tasks were enqueued from technical channel reconciliation/SEO writes,
-- not from a new editorial fact.  Keep every row for audit, but do not execute
-- it.  The event-driven bootstrap reselects real gaps with an input fingerprint.

UPDATE artway_allegro_preparation_tasks
SET status='superseded',completed_at=NOW(),lease_until=NULL,worker_id='',
    result=result || jsonb_build_object(
      'reason','legacy_operational_feedback_loop_closed',
      'replacedBy','fingerprinted_event_runtime'
    ),
    updated_at=NOW()
WHERE status='pending'
  AND input_fingerprint=''
  AND requested_by IN ('von-halsky-reconciliation','seo');
