-- Sama zmiana wyniku kontroli zgodności nie zmienia opisu i dlatego nie musi
-- zmienić odcisku treści. Osobna bramka cofa w takim przypadku zielone
-- potwierdzenie, aby sprzeczny rekord nigdy nie pozostał jako zakończony.

CREATE OR REPLACE FUNCTION artway_enforce_product_review_compliance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT artway_product_review_complete(NEW.data) THEN
    UPDATE artway_product_agent_state
    SET review_status='stale',verification_due_at=NULL,
        reason='review_evidence_no_longer_complete',updated_at=NOW()
    WHERE namespace=NEW.namespace AND product_id=NEW.product_id
      AND review_status='confirmed';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS artway_product_payload_agent_state_validity ON artway_product_payloads;
CREATE TRIGGER artway_product_payload_agent_state_validity
AFTER INSERT OR UPDATE OF data ON artway_product_payloads
FOR EACH ROW EXECUTE FUNCTION artway_enforce_product_review_compliance();
