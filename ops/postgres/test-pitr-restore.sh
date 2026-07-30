#!/usr/bin/env bash
set -euo pipefail

STANZA="${STANZA:-artway}"
RESTORE_ROOT="${RESTORE_ROOT:-/srv/artway/backups/pitr-restore-test}"
RESTORE_DATA="$RESTORE_ROOT/data"
RESTORE_SOCKET="$RESTORE_ROOT/socket"
PORT="${PORT:-55433}"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/17/bin}"
PG_CONFIG="${PG_CONFIG:-/etc/postgresql/17/main/postgresql.conf}"
PROBE="pitr-$(date -u +%Y%m%dT%H%M%SZ)-$RANDOM"

test "$(id -u)" -eq 0 || {
  echo "Uruchom jako root." >&2
  exit 1
}

runuser -u postgres -- psql -d artway -X -v ON_ERROR_STOP=1 \
  -c "INSERT INTO artway_pitr_restore_verification(probe_id,phase) VALUES('$PROBE-before','before_target')"
runuser -u postgres -- psql -d artway -X -c 'SELECT pg_switch_wal()' >/dev/null
sleep 2
TARGET="$(date -u '+%Y-%m-%d %H:%M:%S+00')"
sleep 2
runuser -u postgres -- psql -d artway -X -v ON_ERROR_STOP=1 \
  -c "INSERT INTO artway_pitr_restore_verification(probe_id,phase) VALUES('$PROBE-after','after_target')"
WAL_SEGMENT="$(runuser -u postgres -- psql -d artway -X -Atqc "
  SELECT pg_walfile_name(pg_switch_wal())
")"

for _ in $(seq 1 60); do
  LAST_ARCHIVED="$(runuser -u postgres -- psql -d artway -X -Atqc "
    SELECT COALESCE(last_archived_wal,'') FROM pg_stat_archiver
  ")"
  if [ -n "$LAST_ARCHIVED" ] && [[ "$LAST_ARCHIVED" > "$WAL_SEGMENT" || "$LAST_ARCHIVED" = "$WAL_SEGMENT" ]]; then
    break
  fi
  sleep 2
done

rm -rf "$RESTORE_ROOT"
install -d -o postgres -g postgres -m 0700 "$RESTORE_DATA" "$RESTORE_SOCKET"
runuser -u postgres -- pgbackrest \
  --stanza="$STANZA" \
  --pg1-path="$RESTORE_DATA" \
  --type=time \
  --target="$TARGET" \
  --target-action=promote \
  restore

runuser -u postgres -- "$PG_BIN/pg_ctl" -D "$RESTORE_DATA" \
  -o "-c config_file=$PG_CONFIG -c data_directory=$RESTORE_DATA -c port=$PORT -c unix_socket_directories=$RESTORE_SOCKET -c archive_mode=off -c listen_addresses=''" \
  -w start
cleanup() {
  runuser -u postgres -- "$PG_BIN/pg_ctl" -D "$RESTORE_DATA" -m fast -w stop >/dev/null 2>&1 || true
  rm -rf "$RESTORE_ROOT"
}
trap cleanup EXIT

for _ in $(seq 1 60); do
  RECOVERY="$(runuser -u postgres -- psql -h "$RESTORE_SOCKET" -p "$PORT" -d artway -X -Atqc "
    SELECT pg_is_in_recovery()
  " 2>/dev/null || true)"
  [ "$RECOVERY" = "f" ] && break
  sleep 1
done
test "${RECOVERY:-}" = "f" || {
  echo "Odtworzona baza nie osiągnęła wybranego punktu w czasie." >&2
  exit 1
}
RESULT="$(runuser -u postgres -- psql -h "$RESTORE_SOCKET" -p "$PORT" -d artway -X -Atqc "
  SELECT
    EXISTS(SELECT 1 FROM artway_pitr_restore_verification WHERE probe_id='$PROBE-before')
    AND NOT EXISTS(SELECT 1 FROM artway_pitr_restore_verification WHERE probe_id='$PROBE-after')
")"
test "$RESULT" = "t" || {
  echo "Test PITR nie potwierdził granicy czasu $TARGET." >&2
  exit 1
}
echo "{\"ok\":true,\"target\":\"$TARGET\",\"probe\":\"$PROBE\"}"
