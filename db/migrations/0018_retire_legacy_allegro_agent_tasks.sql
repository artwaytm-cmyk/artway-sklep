-- Jedna kolejka przygotowania ofert Allegro.
--
-- Dawna domena ustawień była równoległą kopią pracy Agenta i pozostawiała
-- w panelu wykonane już produkty. Zachowujemy jej pełny audyt, po czym
-- wyłączamy aktywną kopię. Bieżący stan pochodzi wyłącznie z
-- artway_allegro_preparation_tasks oraz centralnej kartoteki produktu.

INSERT INTO artway_domain_records_archive_v2(
  migration_id,namespace,domain,collection,record_id,ordinal,data,updated_at)
SELECT
  'retire-legacy-allegro-agent-tasks-v1',namespace,domain,collection,record_id,ordinal,data,updated_at
FROM artway_agent_records
WHERE domain='settings:artway_agent_ai_allegro_zadania'
ON CONFLICT DO NOTHING;

DELETE FROM artway_agent_records
WHERE domain='settings:artway_agent_ai_allegro_zadania';

DELETE FROM artway_domain_snapshots
WHERE domain='settings:artway_agent_ai_allegro_zadania';
