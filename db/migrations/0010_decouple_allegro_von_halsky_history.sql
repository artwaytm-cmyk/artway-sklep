-- Stare wykonanie traktowało brak gotowości Von Halsky jako błąd Allegro.
-- Zachowujemy pełną historię, ale fałszywe decyzje oznaczamy jako zastąpione.
-- Najnowszy produkt bez aktywnego zadania wraca raz do niezależnej kolejki
-- Allegro, aby potwierdzić własny stan już według poprawionych reguł.

WITH affected AS MATERIALIZED (
  SELECT
    task.namespace,
    task.task_id,
    task.product_id,
    row_number() OVER (
      PARTITION BY task.namespace,task.product_id
      ORDER BY task.completed_at DESC NULLS LAST,task.updated_at DESC,task.task_id DESC
    ) AS product_rank,
    EXISTS (
      SELECT 1
      FROM artway_allegro_preparation_tasks active
      WHERE active.namespace=task.namespace
        AND active.product_id=task.product_id
        AND active.task_id<>task.task_id
        AND active.status IN ('pending','running')
    ) AS already_active
  FROM artway_allegro_preparation_tasks task
  WHERE task.status IN ('decision_required','failed','attention')
    AND COALESCE(task.result->>'error','') ILIKE '%Von Halsky%'
)
UPDATE artway_allegro_preparation_tasks task
SET
  status=CASE
    WHEN affected.product_rank=1 AND NOT affected.already_active THEN 'pending'
    ELSE 'superseded'
  END,
  attempt=CASE
    WHEN affected.product_rank=1 AND NOT affected.already_active THEN 0
    ELSE task.attempt
  END,
  priority=CASE
    WHEN affected.product_rank=1 AND NOT affected.already_active THEN GREATEST(task.priority,900)
    ELSE task.priority
  END,
  priority_reason=CASE
    WHEN affected.product_rank=1 AND NOT affected.already_active
    THEN 'ponowienie po rozdzieleniu przygotowania Allegro i Von Halsky'
    ELSE task.priority_reason
  END,
  result=CASE
    WHEN affected.product_rank=1 AND NOT affected.already_active THEN
      jsonb_build_object(
        'id',task.task_id,
        'batchId',task.batch_id,
        'productId',task.product_id,
        'operation',task.operation,
        'status','pending',
        'ready',false,
        'error','',
        'missing',jsonb_build_array(),
        'migration','allegro-von-halsky-decoupling-v1'
      )
    ELSE task.result || jsonb_build_object(
      'supersededReason','Błąd należał do niezależnego kanału Von Halsky.',
      'supersededAt',NOW()
    )
  END,
  started_at=NULL,
  completed_at=CASE
    WHEN affected.product_rank=1 AND NOT affected.already_active THEN NULL
    ELSE task.completed_at
  END,
  updated_at=NOW()
FROM affected
WHERE task.namespace=affected.namespace
  AND task.task_id=affected.task_id;

UPDATE artway_allegro_preparation_state
SET blocked_until=NULL,blocked_reason='',updated_at=NOW()
WHERE blocked_until IS NOT NULL OR blocked_reason<>'';
