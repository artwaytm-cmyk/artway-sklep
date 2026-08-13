-- Wynik zakończony później jest jedynym bieżącym wynikiem produktu.
--
-- Dawne wersje kolejki pozostawiały wcześniejsze wpisy attention/failed/
-- decision_required nawet wtedy, gdy kolejna próba zakończyła się poprawnie.
-- Zachowujemy te rekordy w historii, ale nie mogą już zasilać liczników ani
-- ponownie kierować gotowego produktu do pracy Agenta.

WITH latest_completed AS (
  SELECT namespace,product_id,max(updated_at) AS completed_at
  FROM artway_allegro_preparation_tasks
  WHERE status='completed'
  GROUP BY namespace,product_id
)
UPDATE artway_allegro_preparation_tasks task
SET status='superseded',
    completed_at=COALESCE(task.completed_at,NOW()),
    lease_until=NULL,
    worker_id='',
    result=task.result || jsonb_build_object(
      'supersededReason','newer_completed_result',
      'supersededAt',NOW()
    ),
    updated_at=NOW()
FROM latest_completed done
WHERE task.namespace=done.namespace
  AND task.product_id=done.product_id
  AND task.status IN ('attention','waiting_provider','decision_required','failed')
  AND task.updated_at<done.completed_at;
