#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  exec sudo -n /bin/bash "$0" "$@"
fi

os_user=artway_benchmark
database=artway_benchmark

if ! id -u "$os_user" >/dev/null 2>&1; then
  /usr/sbin/useradd --system --no-create-home --home-dir /nonexistent \
    --shell /usr/sbin/nologin --user-group "$os_user"
fi

if ! runuser -u postgres -- psql -Atqc "SELECT 1 FROM pg_roles WHERE rolname='$os_user'" | grep -qx 1; then
  runuser -u postgres -- createuser --login --no-superuser --no-createdb \
    --no-createrole --no-inherit --connection-limit=2 "$os_user"
fi

if ! runuser -u postgres -- psql -Atqc "SELECT 1 FROM pg_database WHERE datname='$database'" | grep -qx 1; then
  runuser -u postgres -- createdb --owner="$os_user" --encoding=UTF8 --template=template0 "$database"
fi

runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d postgres <<'SQL'
ALTER ROLE artway_benchmark NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT CONNECTION LIMIT 2;
ALTER ROLE artway_benchmark SET statement_timeout='5min';
ALTER ROLE artway_benchmark SET lock_timeout='5s';
ALTER ROLE artway_benchmark SET idle_in_transaction_session_timeout='30s';
REVOKE CONNECT, TEMPORARY ON DATABASE artway FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE artway TO artway, postgres;
REVOKE CONNECT, TEMPORARY ON DATABASE artway_benchmark FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE artway_benchmark TO artway_benchmark, postgres;
SQL

runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$database" <<'SQL'
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO artway_benchmark;
SQL

echo "Izolowana baza benchmarku jest gotowa. Produkcyjna baza nie przyjmuje roli testowej."
