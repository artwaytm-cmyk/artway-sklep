-- Naprawa kartoteki po nieudanej publikacji nie jest ani publikacją, ani
-- anulowaniem. Osobny stan zachowuje prawdziwą historię: szkic został
-- naprawiony i sprawdzony, ale nadal czeka na nowe, jawne zatwierdzenie
-- administratora przed jakimkolwiek wywołaniem Allegro API.

ALTER TABLE artway_allegro_publication_tasks
  DROP CONSTRAINT IF EXISTS artway_allegro_publication_tasks_status_check;

ALTER TABLE artway_allegro_publication_tasks
  ADD CONSTRAINT artway_allegro_publication_tasks_status_check
  CHECK(status IN ('queued','running','completed','decision_required','failed','cancelled','repaired'));

