-- Zachowaj spójność skrótów po migracjach, które wzbogacają lekkie
-- reprezentacje produktu bez przechodzenia przez trigger tabeli źródłowej.

UPDATE artway_product_payloads
SET payload_hash=md5(
  data::text || '|' ||
  public_data::text || '|' ||
  admin_list_data::text || '|' ||
  public_list_data::text || '|' ||
  authoritative_fields::text
)
WHERE payload_hash IS DISTINCT FROM md5(
  data::text || '|' ||
  public_data::text || '|' ||
  admin_list_data::text || '|' ||
  public_list_data::text || '|' ||
  authoritative_fields::text
);
