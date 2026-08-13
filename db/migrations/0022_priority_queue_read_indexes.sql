-- Odczyty panelu Agenta są wykonywane co kilka sekund podczas aktywnej pracy.
-- Indeksy odpowiadają dokładnie sortowaniu używanemu przez status kolejki i
-- nawodnienie dużych, znormalizowanych domen. Zapobiega to sortowaniu pełnych
-- rekordów JSONB pod obciążeniem i przekroczeniu statement_timeout.

CREATE INDEX IF NOT EXISTS artway_allegro_preparation_results_recent_idx
  ON artway_allegro_preparation_tasks(
    namespace,
    completed_at DESC NULLS LAST,
    updated_at DESC
  )
  WHERE status IN (
    'completed','attention','waiting_provider','decision_required','failed','cancelled'
  );

CREATE INDEX IF NOT EXISTS artway_allegro_offers_read_order_idx
  ON artway_allegro_offers(namespace,domain,collection,ordinal,record_id);

CREATE INDEX IF NOT EXISTS artway_allegro_mappings_read_order_idx
  ON artway_allegro_mappings(namespace,domain,collection,ordinal,record_id);

CREATE INDEX IF NOT EXISTS artway_agent_records_read_order_idx
  ON artway_agent_records(namespace,domain,collection,ordinal,record_id);
