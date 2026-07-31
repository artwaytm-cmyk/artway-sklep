\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='artway_owner') THEN
    CREATE ROLE artway_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='artway_migrator') THEN
    CREATE ROLE artway_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='artway_app') THEN
    CREATE ROLE artway_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END $$;

GRANT artway_owner TO artway_migrator;
REASSIGN OWNED BY artway TO artway_owner;
ALTER DATABASE artway OWNER TO artway_owner;
ALTER SCHEMA public OWNER TO artway_owner;

GRANT CONNECT,TEMPORARY ON DATABASE artway TO artway_migrator;
GRANT CONNECT,TEMPORARY ON DATABASE artway TO artway_app;
GRANT pg_read_all_stats TO artway_app;
GRANT USAGE ON SCHEMA public TO artway_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO artway_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO artway_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO artway_app;
ALTER DEFAULT PRIVILEGES FOR ROLE artway_owner IN SCHEMA public
  GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO artway_app;
ALTER DEFAULT PRIVILEGES FOR ROLE artway_owner IN SCHEMA public
  GRANT USAGE,SELECT ON SEQUENCES TO artway_app;
ALTER DEFAULT PRIVILEGES FOR ROLE artway_owner IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO artway_app;

ALTER ROLE artway_app IN DATABASE artway SET statement_timeout='30s';
ALTER ROLE artway_app IN DATABASE artway SET lock_timeout='3s';
ALTER ROLE artway_app IN DATABASE artway SET idle_in_transaction_session_timeout='30s';
ALTER ROLE artway_app IN DATABASE artway SET application_name='artway-backend';
ALTER ROLE artway_migrator IN DATABASE artway SET statement_timeout='15min';
ALTER ROLE artway_migrator IN DATABASE artway SET lock_timeout='10s';
ALTER ROLE artway_migrator IN DATABASE artway SET idle_in_transaction_session_timeout='5min';
ALTER ROLE artway_migrator IN DATABASE artway SET application_name='artway-migrations';
ALTER ROLE artway NOLOGIN;
