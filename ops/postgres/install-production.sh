#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PG_VERSION="${PG_VERSION:-17}"
PG_ETC="/etc/postgresql/${PG_VERSION}/main"

test "$(id -u)" -eq 0 || {
  echo "Uruchom jako root: sudo $0" >&2
  exit 1
}

id artway-migrator >/dev/null 2>&1 \
  || useradd --system --home-dir /srv/artway --no-create-home --shell /usr/sbin/nologin artway-migrator

install -o postgres -g postgres -m 0644 \
  "$ROOT/ops/postgres/20-artway-observability.conf" \
  "$PG_ETC/conf.d/20-artway-observability.conf"
install -o postgres -g postgres -m 0644 \
  "$ROOT/ops/postgres/30-artway-pitr.conf" \
  "$PG_ETC/conf.d/30-artway-pitr.conf"

command -v pgbackrest >/dev/null 2>&1 || {
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y pgbackrest
}
install -d -o postgres -g postgres -m 0750 \
  /srv/artway/backups/pgbackrest /var/spool/pgbackrest /var/log/pgbackrest
setfacl -m u:postgres:--x,m::x /srv/artway/backups
install -o postgres -g postgres -m 0640 \
  "$ROOT/ops/postgres/pgbackrest.conf" \
  /etc/pgbackrest.conf
install -o root -g root -m 0644 \
  "$ROOT/ops/postgres/postgresql-common.logrotate" \
  /etc/logrotate.d/postgresql-common
install -d -o root -g root -m 0755 /etc/systemd/journald.conf.d
install -o root -g root -m 0644 \
  "$ROOT/ops/systemd/20-artway-journal-retention.conf" \
  /etc/systemd/journald.conf.d/20-artway-journal-retention.conf

if ! grep -q '^artway_roles[[:space:]]' "$PG_ETC/pg_ident.conf"; then
  sed -i '1i artway_roles artway-migrator artway_migrator\nartway_roles artway artway_app' "$PG_ETC/pg_ident.conf"
fi
if ! grep -q '^local[[:space:]]\\+artway[[:space:]]\\+artway_app' "$PG_ETC/pg_hba.conf"; then
  sed -i '1i local artway artway_migrator peer map=artway_roles\nlocal artway artway_app peer map=artway_roles' "$PG_ETC/pg_hba.conf"
fi

BACKEND_WAS_ACTIVE=0
if systemctl is-active --quiet artway-backend.service; then
  BACKEND_WAS_ACTIVE=1
  systemctl stop artway-backend.service
fi
runuser -u postgres -- psql -d artway -X -f "$ROOT/ops/postgres/roles.sql"
systemctl restart postgresql
runuser -u postgres -- psql -d artway -X -v ON_ERROR_STOP=1 \
  -c 'CREATE EXTENSION IF NOT EXISTS pg_stat_statements'

install -d -o artway -g artway -m 0750 /srv/artway/ops/status
install -o root -g root -m 0644 \
  "$ROOT/ops/systemd/artway-backend.service" \
  /etc/systemd/system/artway-backend.service
install -o root -g root -m 0644 \
  "$ROOT/ops/systemd/artway-postgres-migrate.service" \
  /etc/systemd/system/artway-postgres-migrate.service
install -o root -g root -m 0644 \
  "$ROOT/ops/systemd/artway-postgres-observe.service" \
  /etc/systemd/system/artway-postgres-observe.service
install -o root -g root -m 0644 \
  "$ROOT/ops/systemd/artway-postgres-observe.timer" \
  /etc/systemd/system/artway-postgres-observe.timer
install -o root -g root -m 0644 \
  "$ROOT/ops/systemd/artway-postgres-maintain.service" \
  /etc/systemd/system/artway-postgres-maintain.service
install -o root -g root -m 0644 \
  "$ROOT/ops/systemd/artway-postgres-maintain.timer" \
  /etc/systemd/system/artway-postgres-maintain.timer
install -o root -g root -m 0644 \
  "$ROOT/ops/systemd/artway-postgres-logrotate.service" \
  /etc/systemd/system/artway-postgres-logrotate.service
install -o root -g root -m 0644 \
  "$ROOT/ops/systemd/artway-postgres-logrotate.timer" \
  /etc/systemd/system/artway-postgres-logrotate.timer
for unit in \
  artway-pgbackrest-full.service artway-pgbackrest-full.timer \
  artway-pgbackrest-diff.service artway-pgbackrest-diff.timer \
  artway-pgbackrest-incr.service artway-pgbackrest-incr.timer
do
  install -o root -g root -m 0644 "$ROOT/ops/systemd/$unit" "/etc/systemd/system/$unit"
done

systemctl daemon-reload
systemctl start artway-postgres-migrate.service
if [ "$BACKEND_WAS_ACTIVE" -eq 1 ]; then
  systemctl restart artway-backend.service
fi
runuser -u postgres -- pgbackrest --stanza=artway stanza-create
runuser -u postgres -- pgbackrest --stanza=artway check
runuser -u postgres -- pgbackrest --stanza=artway --type=full backup
systemctl enable --now \
  artway-postgres-observe.timer artway-postgres-maintain.timer \
  artway-postgres-logrotate.timer \
  artway-pgbackrest-full.timer artway-pgbackrest-diff.timer \
  artway-pgbackrest-incr.timer
