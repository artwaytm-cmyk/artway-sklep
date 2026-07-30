-- Kontrakcja centralnego katalogu produktów.
-- Ciężkie dokumenty JSON trafiają do tabeli szczegółów, a artway_products
-- pozostaje lekkim indeksem operacyjnym. Kolumny zgodności pozostają fizycznie
-- obecne, lecz trigger opróżnia je po trwałym zapisaniu payloadu.

-- Magazyn opuszcza wspólną tabelę domen. Nadal zachowuje pełny dokument
-- źródłowy, ale ma własną tabelę, indeksy i relacyjne projekcje operacyjne.
CREATE TABLE IF NOT EXISTS artway_warehouse_records (
  namespace TEXT NOT NULL,
  domain TEXT NOT NULL,
  collection TEXT NOT NULL,
  record_id TEXT NOT NULL,
  ordinal BIGINT NOT NULL DEFAULT 0,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  product_id TEXT GENERATED ALWAYS AS (
    COALESCE(data->>'productId',data->>'id',record_id)
  ) STORED,
  document_status TEXT GENERATED ALWAYS AS (
    COALESCE(data->>'status','')
  ) STORED,
  PRIMARY KEY(namespace,domain,collection,record_id),
  FOREIGN KEY(namespace,domain)
    REFERENCES artway_domain_snapshots(namespace,domain) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS artway_warehouse_records_order_idx
  ON artway_warehouse_records(namespace,domain,collection,ordinal,record_id);
CREATE INDEX IF NOT EXISTS artway_warehouse_records_product_idx
  ON artway_warehouse_records(namespace,product_id)
  WHERE product_id<>'';
CREATE INDEX IF NOT EXISTS artway_warehouse_records_status_idx
  ON artway_warehouse_records(namespace,domain,document_status,ordinal)
  WHERE document_status<>'';

INSERT INTO artway_domain_records_archive_v2(
  migration_id,namespace,domain,collection,record_id,ordinal,data,updated_at
)
SELECT
  'dedicated-domain-tables-v3',namespace,domain,collection,record_id,
  ordinal,data,updated_at
FROM artway_domain_records
WHERE domain IN (
  'settings:artway_stany',
  'settings:artway_magazyn_niedobory_wydan',
  'settings:artway_dostepnosc',
  'settings:artway_ruchy_magazynowe',
  'settings:artway_magazyn_produkty',
  'settings:artway_magazyn_ustawienia',
  'settings:artway_magazyn_lokalizacje',
  'settings:artway_magazyn_lokalizacje_usuniete',
  'settings:artway_dokumenty_magazynowe',
  'settings:artway_dokumenty_magazynowe_usuniete',
  'settings:artway_dokumenty_magazynowe_seq'
)
ON CONFLICT DO NOTHING;

INSERT INTO artway_warehouse_records(
  namespace,domain,collection,record_id,ordinal,data,updated_at
)
SELECT namespace,domain,collection,record_id,ordinal,data,updated_at
FROM artway_domain_records
WHERE domain IN (
  'settings:artway_stany',
  'settings:artway_magazyn_niedobory_wydan',
  'settings:artway_dostepnosc',
  'settings:artway_ruchy_magazynowe',
  'settings:artway_magazyn_produkty',
  'settings:artway_magazyn_ustawienia',
  'settings:artway_magazyn_lokalizacje',
  'settings:artway_magazyn_lokalizacje_usuniete',
  'settings:artway_dokumenty_magazynowe',
  'settings:artway_dokumenty_magazynowe_usuniete',
  'settings:artway_dokumenty_magazynowe_seq'
)
ON CONFLICT(namespace,domain,collection,record_id) DO UPDATE SET
  ordinal=EXCLUDED.ordinal,
  data=EXCLUDED.data,
  updated_at=EXCLUDED.updated_at;

DROP TRIGGER IF EXISTS artway_warehouse_shadow_trg ON artway_domain_records;
DELETE FROM artway_domain_records
WHERE domain IN (
  'settings:artway_stany',
  'settings:artway_magazyn_niedobory_wydan',
  'settings:artway_dostepnosc',
  'settings:artway_ruchy_magazynowe',
  'settings:artway_magazyn_produkty',
  'settings:artway_magazyn_ustawienia',
  'settings:artway_magazyn_lokalizacje',
  'settings:artway_magazyn_lokalizacje_usuniete',
  'settings:artway_dokumenty_magazynowe',
  'settings:artway_dokumenty_magazynowe_usuniete',
  'settings:artway_dokumenty_magazynowe_seq'
);

DO $$
DECLARE
  definition TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'artway_project_warehouse_record(text,text,text,jsonb,timestamptz)'::regprocedure
  ) INTO definition;
  EXECUTE replace(
    definition,
    'artway_domain_records',
    'artway_warehouse_records'
  );

  SELECT pg_get_functiondef(
    'artway_warehouse_shadow_trigger()'::regprocedure
  ) INTO definition;
  EXECUTE replace(
    definition,
    'artway_domain_records',
    'artway_warehouse_records'
  );
END $$;

DROP TRIGGER IF EXISTS artway_warehouse_shadow_trg ON artway_warehouse_records;
CREATE TRIGGER artway_warehouse_shadow_trg
AFTER INSERT OR UPDATE OR DELETE ON artway_warehouse_records
FOR EACH ROW EXECUTE FUNCTION artway_warehouse_shadow_trigger();

INSERT INTO artway_domain_migrations(namespace,migration_id,details)
SELECT DISTINCT namespace,'dedicated-domain-tables-v3',
  '{"table":"artway_warehouse_records","source":"artway_domain_records"}'::jsonb
FROM artway_warehouse_records
ON CONFLICT(namespace,migration_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS artway_product_payloads (
  namespace TEXT NOT NULL,
  product_id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  public_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_list_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  public_list_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  authoritative_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload_hash TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(namespace, product_id)
);
CREATE INDEX IF NOT EXISTS artway_product_payloads_updated_idx
  ON artway_product_payloads(namespace, updated_at DESC, product_id);

INSERT INTO artway_product_payloads(
  namespace,product_id,data,public_data,admin_list_data,public_list_data,
  authoritative_fields,payload_hash,updated_at
)
SELECT
  namespace,product_id,data,public_data,admin_list_data,public_list_data,
  authoritative_fields,
  md5(data::text || '|' || public_data::text || '|' ||
      admin_list_data::text || '|' || public_list_data::text || '|' ||
      authoritative_fields::text),
  updated_at
FROM artway_products
ON CONFLICT(namespace,product_id) DO UPDATE SET
  data=EXCLUDED.data,
  public_data=EXCLUDED.public_data,
  admin_list_data=EXCLUDED.admin_list_data,
  public_list_data=EXCLUDED.public_list_data,
  authoritative_fields=EXCLUDED.authoritative_fields,
  payload_hash=EXCLUDED.payload_hash,
  updated_at=EXCLUDED.updated_at;

-- Najpierw bezpieczna kopia powyżej, następnie zwolnienie ciężkiego payloadu
-- z tabeli indeksowej. Fizyczne odzyskanie miejsca wykonuje kontrolowany
-- VACUUM FULL po wdrożeniu, poza transakcją migracji.
UPDATE artway_products SET
  data='{}'::jsonb,
  public_data='{}'::jsonb,
  admin_list_data='{}'::jsonb,
  public_list_data='{}'::jsonb,
  authoritative_fields='[]'::jsonb
WHERE data<>'{}'::jsonb
   OR public_data<>'{}'::jsonb
   OR admin_list_data<>'{}'::jsonb
   OR public_list_data<>'{}'::jsonb
   OR authoritative_fields<>'[]'::jsonb;

CREATE OR REPLACE FUNCTION artway_offload_product_payload()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO artway_product_payloads(
      namespace,product_id,data,public_data,admin_list_data,public_list_data,
      authoritative_fields,payload_hash,updated_at
    ) VALUES(
      NEW.namespace,NEW.product_id,NEW.data,NEW.public_data,
      NEW.admin_list_data,NEW.public_list_data,NEW.authoritative_fields,
      md5(NEW.data::text || '|' || NEW.public_data::text || '|' ||
          NEW.admin_list_data::text || '|' || NEW.public_list_data::text ||
          '|' || NEW.authoritative_fields::text),
      COALESCE(NEW.updated_at,NOW())
    )
    ON CONFLICT(namespace,product_id) DO UPDATE SET
      data=EXCLUDED.data,
      public_data=EXCLUDED.public_data,
      admin_list_data=EXCLUDED.admin_list_data,
      public_list_data=EXCLUDED.public_list_data,
      authoritative_fields=CASE
        WHEN EXCLUDED.authoritative_fields='[]'::jsonb
          THEN artway_product_payloads.authoritative_fields
        ELSE COALESCE((
          SELECT jsonb_agg(DISTINCT field)
          FROM jsonb_array_elements(
            artway_product_payloads.authoritative_fields ||
            EXCLUDED.authoritative_fields
          ) field
        ),'[]'::jsonb)
      END,
      payload_hash=EXCLUDED.payload_hash,
      updated_at=EXCLUDED.updated_at;
    UPDATE artway_product_payloads SET
      payload_hash=md5(data::text || '|' || public_data::text || '|' ||
        admin_list_data::text || '|' || public_list_data::text || '|' ||
        authoritative_fields::text)
    WHERE namespace=NEW.namespace AND product_id=NEW.product_id;
  ELSE
    INSERT INTO artway_product_payloads(namespace,product_id)
    VALUES(NEW.namespace,NEW.product_id)
    ON CONFLICT(namespace,product_id) DO NOTHING;

    IF NEW.data IS DISTINCT FROM OLD.data THEN
      UPDATE artway_product_payloads SET data=NEW.data,updated_at=NOW()
      WHERE namespace=NEW.namespace AND product_id=NEW.product_id;
    END IF;
    IF NEW.public_data IS DISTINCT FROM OLD.public_data THEN
      UPDATE artway_product_payloads SET public_data=NEW.public_data,updated_at=NOW()
      WHERE namespace=NEW.namespace AND product_id=NEW.product_id;
    END IF;
    IF NEW.admin_list_data IS DISTINCT FROM OLD.admin_list_data THEN
      UPDATE artway_product_payloads SET admin_list_data=NEW.admin_list_data,updated_at=NOW()
      WHERE namespace=NEW.namespace AND product_id=NEW.product_id;
    END IF;
    IF NEW.public_list_data IS DISTINCT FROM OLD.public_list_data THEN
      UPDATE artway_product_payloads SET public_list_data=NEW.public_list_data,updated_at=NOW()
      WHERE namespace=NEW.namespace AND product_id=NEW.product_id;
    END IF;
    IF NEW.authoritative_fields IS DISTINCT FROM OLD.authoritative_fields THEN
      UPDATE artway_product_payloads
      SET authoritative_fields=NEW.authoritative_fields,updated_at=NOW()
      WHERE namespace=NEW.namespace AND product_id=NEW.product_id;
    END IF;
    UPDATE artway_product_payloads SET
      payload_hash=md5(data::text || '|' || public_data::text || '|' ||
        admin_list_data::text || '|' || public_list_data::text || '|' ||
        authoritative_fields::text)
    WHERE namespace=NEW.namespace AND product_id=NEW.product_id;
  END IF;

  NEW.data := '{}'::jsonb;
  NEW.public_data := '{}'::jsonb;
  NEW.admin_list_data := '{}'::jsonb;
  NEW.public_list_data := '{}'::jsonb;
  NEW.authoritative_fields := '[]'::jsonb;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS artway_product_payload_offload_trg ON artway_products;
CREATE TRIGGER artway_product_payload_offload_trg
BEFORE INSERT OR UPDATE OF
  data,public_data,admin_list_data,public_list_data,authoritative_fields
ON artway_products
FOR EACH ROW EXECUTE FUNCTION artway_offload_product_payload();

CREATE OR REPLACE FUNCTION artway_delete_product_payload()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM artway_product_payloads
  WHERE namespace=OLD.namespace AND product_id=OLD.product_id;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS artway_product_payload_delete_trg ON artway_products;
CREATE TRIGGER artway_product_payload_delete_trg
AFTER DELETE ON artway_products
FOR EACH ROW EXECUTE FUNCTION artway_delete_product_payload();

CREATE OR REPLACE VIEW artway_product_records AS
SELECT
  p.namespace,
  p.product_id,
  x.data,
  x.public_data,
  p.name,
  p.search_text,
  p.category,
  p.producer,
  p.external_id,
  p.sku,
  p.ean,
  p.source,
  p.record_status,
  p.stock,
  p.sale_available,
  p.has_source,
  p.has_allegro,
  p.allegro_status,
  p.missing_fields,
  p.missing_count,
  p.price,
  p.allegro_price,
  p.promotion,
  p.duplicate_store,
  p.duplicate_allegro,
  p.fingerprint,
  p.updated_at,
  p.search_vector,
  x.admin_list_data,
  x.public_list_data,
  p.new_product,
  p.rating,
  p.rating_count,
  x.authoritative_fields
FROM artway_products p
JOIN artway_product_payloads x
  ON x.namespace=p.namespace AND x.product_id=p.product_id;

-- Projekcja publiczna po kontrakcji pobiera dokumenty z tabeli payloadów.
CREATE OR REPLACE FUNCTION artway_storefront_product_shadow_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_public_data JSONB;
  v_public_list_data JSONB;
BEGIN
  IF TG_OP='DELETE' THEN
    DELETE FROM artway_storefront_products
    WHERE namespace=OLD.namespace AND product_id=OLD.product_id;
    RETURN OLD;
  END IF;
  SELECT public_data,public_list_data
  INTO v_public_data,v_public_list_data
  FROM artway_product_payloads
  WHERE namespace=NEW.namespace AND product_id=NEW.product_id;

  v_public_data := COALESCE(v_public_data,'{}'::jsonb);
  v_public_list_data := COALESCE(v_public_list_data,'{}'::jsonb);
  INSERT INTO artway_storefront_products(
    namespace,product_id,public_data,list_data,name,search_text,category,producer,
    external_id,sku,ean,record_status,sale_available,price,promotion,new_product,
    rating,rating_count,source_hash,source_updated_at,updated_at
  ) VALUES(
    NEW.namespace,NEW.product_id,v_public_data,v_public_list_data,NEW.name,
    NEW.search_text,NEW.category,NEW.producer,NEW.external_id,NEW.sku,NEW.ean,
    NEW.record_status,NEW.sale_available,NEW.price,NEW.promotion,NEW.new_product,
    NEW.rating,NEW.rating_count,
    md5(v_public_data::text || '|' || v_public_list_data::text),
    NEW.updated_at,NOW()
  )
  ON CONFLICT(namespace,product_id) DO UPDATE SET
    public_data=EXCLUDED.public_data,
    list_data=EXCLUDED.list_data,
    name=EXCLUDED.name,
    search_text=EXCLUDED.search_text,
    category=EXCLUDED.category,
    producer=EXCLUDED.producer,
    external_id=EXCLUDED.external_id,
    sku=EXCLUDED.sku,
    ean=EXCLUDED.ean,
    record_status=EXCLUDED.record_status,
    sale_available=EXCLUDED.sale_available,
    price=EXCLUDED.price,
    promotion=EXCLUDED.promotion,
    new_product=EXCLUDED.new_product,
    rating=EXCLUDED.rating,
    rating_count=EXCLUDED.rating_count,
    source_hash=EXCLUDED.source_hash,
    source_updated_at=EXCLUDED.source_updated_at,
    updated_at=NOW()
  WHERE artway_storefront_products.source_hash IS DISTINCT FROM EXCLUDED.source_hash
     OR artway_storefront_products.record_status IS DISTINCT FROM EXCLUDED.record_status
     OR artway_storefront_products.sale_available IS DISTINCT FROM EXCLUDED.sale_available;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM artway_record_projection_error(
    COALESCE(NEW.namespace,OLD.namespace),'storefront_products',
    TG_TABLE_NAME,TG_OP,SQLSTATE,SQLERRM
  );
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

-- Odświeżenie projekcji po przeniesieniu payloadów.
INSERT INTO artway_storefront_products(
  namespace,product_id,public_data,list_data,name,search_text,category,producer,
  external_id,sku,ean,record_status,sale_available,price,promotion,new_product,
  rating,rating_count,source_hash,source_updated_at,updated_at
)
SELECT namespace,product_id,public_data,public_list_data,name,search_text,category,
  producer,external_id,sku,ean,record_status,sale_available,price,promotion,
  new_product,rating,rating_count,
  md5(public_data::text || '|' || public_list_data::text),updated_at,NOW()
FROM artway_product_records
ON CONFLICT(namespace,product_id) DO UPDATE SET
  public_data=EXCLUDED.public_data,
  list_data=EXCLUDED.list_data,
  name=EXCLUDED.name,
  search_text=EXCLUDED.search_text,
  category=EXCLUDED.category,
  producer=EXCLUDED.producer,
  external_id=EXCLUDED.external_id,
  sku=EXCLUDED.sku,
  ean=EXCLUDED.ean,
  record_status=EXCLUDED.record_status,
  sale_available=EXCLUDED.sale_available,
  price=EXCLUDED.price,
  promotion=EXCLUDED.promotion,
  new_product=EXCLUDED.new_product,
  rating=EXCLUDED.rating,
  rating_count=EXCLUDED.rating_count,
  source_hash=EXCLUDED.source_hash,
  source_updated_at=EXCLUDED.source_updated_at,
  updated_at=NOW();

ALTER TABLE artway_projection_checks
  ADD COLUMN IF NOT EXISTS first_matched_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS eligible_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS cutover_at TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS artway_index_decisions (
  schema_name TEXT NOT NULL,
  index_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  first_sample_at TIMESTAMPTZ NULL,
  last_sample_at TIMESTAMPTZ NULL,
  sample_count INTEGER NOT NULL DEFAULT 0,
  total_scans BIGINT NOT NULL DEFAULT 0,
  decision TEXT NOT NULL DEFAULT 'observe',
  reason TEXT NOT NULL DEFAULT '',
  decided_at TIMESTAMPTZ NULL,
  executed_at TIMESTAMPTZ NULL,
  PRIMARY KEY(schema_name,index_name)
);

INSERT INTO artway_projection_checks(
  namespace,projection,source_name,mode,details
) VALUES(
  'artway-sklep','product_payloads','artway_product_records payload projection',
  'primary','{"contracted":true}'::jsonb
)
ON CONFLICT(namespace,projection) DO UPDATE SET
  source_name=EXCLUDED.source_name,
  mode='primary',
  details=artway_projection_checks.details || EXCLUDED.details,
  cutover_at=COALESCE(artway_projection_checks.cutover_at,NOW());
