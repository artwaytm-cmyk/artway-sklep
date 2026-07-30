-- Indeksy po kontrakcji payloadów produktu.
-- Stare indeksy expression na artway_products nie mogą już pomagać, ponieważ
-- trigger celowo pozostawia tam pusty JSON. Zastępujemy je indeksami przy
-- rzeczywistym źródle danych i osobnymi indeksami identyfikatorów rdzenia.

CREATE INDEX IF NOT EXISTS artway_product_payloads_import_item_idx
  ON artway_product_payloads(namespace,(data->>'importItemKey'))
  WHERE COALESCE(data->>'importItemKey','')<>'';

CREATE INDEX IF NOT EXISTS artway_product_payloads_source_url_idx
  ON artway_product_payloads(namespace,(data->>'sourceUrl'))
  WHERE COALESCE(data->>'sourceUrl','')<>'';

CREATE INDEX IF NOT EXISTS artway_product_payloads_producer_url_idx
  ON artway_product_payloads(namespace,(data->>'producentUrl'))
  WHERE COALESCE(data->>'producentUrl','')<>'';

CREATE INDEX IF NOT EXISTS artway_product_payloads_manufacturer_code_idx
  ON artway_product_payloads(
    namespace,
    (regexp_replace(
      lower(COALESCE(data->>'kodProducenta',data->>'mpn','')),
      '[^a-z0-9]+','','g'
    ))
  )
  WHERE COALESCE(data->>'kodProducenta',data->>'mpn','')<>'';

CREATE INDEX IF NOT EXISTS artway_products_ean_lookup_idx
  ON artway_products(namespace,ean)
  WHERE ean<>'';

CREATE INDEX IF NOT EXISTS artway_products_sku_lookup_idx
  ON artway_products(namespace,sku)
  WHERE sku<>'';

-- Te dwa indeksy są semantycznie martwe po migracji 0005: indeksowane
-- dokumenty w tabeli rdzenia są zawsze puste. To nie jest heurystyczne
-- usuwanie "nieużywanego" indeksu, tylko część kontrakcji modelu danych.
DROP INDEX IF EXISTS artway_products_source_url_idx;
DROP INDEX IF EXISTS artway_products_import_item_idx;
