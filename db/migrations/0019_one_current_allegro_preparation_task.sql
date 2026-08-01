-- Dokładnie jedna bieżąca próba przygotowania na produkt.
--
-- Starsze wyniki pozostają w tabeli jako audyt, ale nie mogą być jednocześnie
-- prezentowane ani liczone jako aktualna praca. Najnowszy rekord produktu
-- pozostaje bieżący; pozostałe są bezpiecznie oznaczane jako zastąpione.

WITH ranked AS (
  SELECT namespace,task_id,
    row_number() OVER (
      PARTITION BY namespace,product_id
      ORDER BY
        CASE status WHEN 'running' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
        updated_at DESC,requested_at DESC,task_id DESC
    ) AS position
  FROM artway_allegro_preparation_tasks
  WHERE status IN ('pending','running','attention','waiting_provider','decision_required','failed')
)
UPDATE artway_allegro_preparation_tasks task
SET status='superseded',completed_at=COALESCE(task.completed_at,NOW()),lease_until=NULL,worker_id='',
    result=task.result || jsonb_build_object(
      'supersededReason','duplicate_current_task_cleanup',
      'supersededAt',NOW()
    ),
    updated_at=NOW()
FROM ranked
WHERE task.namespace=ranked.namespace
  AND task.task_id=ranked.task_id
  AND ranked.position>1;

DROP INDEX IF EXISTS artway_allegro_preparation_active_product_idx;

CREATE UNIQUE INDEX IF NOT EXISTS artway_allegro_preparation_current_product_idx
  ON artway_allegro_preparation_tasks(namespace,product_id)
  WHERE status IN ('pending','running','attention','waiting_provider','decision_required','failed');
