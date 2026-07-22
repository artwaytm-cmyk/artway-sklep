#!/usr/bin/env bash
set -Eeuo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
umask 077

readonly BACKUP_ROOT="${ARTWAY_BACKUP_ROOT:-/srv/artway/backups}"
readonly REPOSITORY="${ARTWAY_BACKUP_REPOSITORY:-artwaytm-cmyk/artway-backups}"
readonly RELEASE_TAG="${ARTWAY_BACKUP_RELEASE_TAG:-offsite-backups}"
readonly KEY_FILE="${ARTWAY_BACKUP_KEY_FILE:-/srv/artway/ops/secrets/backup-offsite.key}"
readonly RESTORE_URL="${ARTWAY_RESTORE_DATABASE_URL:-postgresql:///artway_restore_test?host=/var/run/postgresql}"
readonly STATUS_FILE="$BACKUP_ROOT/restore-test-status.json"
readonly LOCK_FILE="$BACKUP_ROOT/.restore-test.lock"

for command in gpg gh tar sha256sum jq pg_restore psql flock; do
  command -v "$command" >/dev/null || { echo "Brak wymaganego polecenia: $command" >&2; exit 1; }
done
[[ -r "$KEY_FILE" ]] || { echo "Brak chronionego klucza odzyskiwania." >&2; exit 1; }

mkdir -p "$BACKUP_ROOT/restore-tests" "$BACKUP_ROOT/.gnupg"
chmod 700 "$BACKUP_ROOT/restore-tests" "$BACKUP_ROOT/.gnupg"
export GNUPGHOME="$BACKUP_ROOT/.gnupg"
exec 9>"$LOCK_FILE"
flock -n 9 || { echo "Test odtwarzania jest już uruchomiony." >&2; exit 0; }

write_status() {
  jq -n --arg status "$1" --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg detail "$2" --arg backup "${3:-}" --arg repository "$REPOSITORY" \
    '{status:$status,timestamp:$timestamp,detail:$detail,backup:$backup,repository:$repository}' >"$STATUS_FILE.tmp"
  chmod 600 "$STATUS_FILE.tmp"; mv -f "$STATUS_FILE.tmp" "$STATUS_FILE"
}

tmp_dir="$(mktemp -d "$BACKUP_ROOT/restore-tests/.drill-XXXXXX")"
database_prepared=false
cleanup() {
  local exit_code=$?
  if [[ "$database_prepared" == true ]]; then
    psql --dbname="$RESTORE_URL" -v ON_ERROR_STOP=1 -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;' >/dev/null 2>&1 || true
  fi
  rm -rf -- "$tmp_dir"
  if (( exit_code != 0 )); then write_status failed restore-drill-failed; fi
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

echo "[1/5] Pobranie najnowszej kopii z GitHuba, nie z dysku VPS"
release_json="$(gh api "repos/$REPOSITORY/releases/tags/$RELEASE_TAG")"
encrypted_name="$(jq -r '[.assets[] | select(.name|test("^artway-.*\\.tar\\.gpg$"))] | sort_by(.created_at) | last | .name // empty' <<<"$release_json")"
[[ -n "$encrypted_name" ]] || { echo "Brak zewnętrznego archiwum do testu." >&2; exit 1; }
checksum_name="$encrypted_name.sha256"
gh release download "$RELEASE_TAG" --repo "$REPOSITORY" --pattern "$encrypted_name" --pattern "$checksum_name" --dir "$tmp_dir"
(
  cd "$tmp_dir"
  sha256sum --check --strict "$checksum_name"
)

echo "[2/5] Odszyfrowanie i integralność wewnętrznej kopii"
gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$KEY_FILE" --decrypt "$tmp_dir/$encrypted_name" >"$tmp_dir/backup.tar"
mkdir "$tmp_dir/extracted"
tar -xf "$tmp_dir/backup.tar" -C "$tmp_dir/extracted"
backup_dir="$(find "$tmp_dir/extracted" -mindepth 1 -maxdepth 1 -type d -print -quit)"
[[ -n "$backup_dir" ]] || { echo "Zewnętrzne archiwum nie zawiera katalogu kopii." >&2; exit 1; }
(
  cd "$backup_dir"
  sha256sum --check --strict SHA256SUMS
  pg_restore --list database.dump >/dev/null
  tar --zstd --list --file=application.tar.zst >/dev/null
  tar --zstd --list --file=deployed-release.tar.zst >/dev/null
  jq -e '.commit | type == "string" and length > 0' deployed-release.json >/dev/null
  tar --zstd --list --file=server-config.tar.zst >/dev/null
)

echo "[3/5] Twarda blokada docelowej bazy testowej"
database_name="$(psql --dbname="$RESTORE_URL" -Atqc 'select current_database()')"
[[ "$database_name" == "artway_restore_test" ]] || { echo "Odmowa: restore można wykonać wyłącznie do artway_restore_test." >&2; exit 1; }
psql --dbname="$RESTORE_URL" -v ON_ERROR_STOP=1 -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;' >/dev/null
database_prepared=true

echo "[4/5] Pełne odtworzenie PostgreSQL do izolowanej bazy"
pg_restore --exit-on-error --no-owner --no-privileges --dbname="$RESTORE_URL" "$backup_dir/database.dump"
table_count="$(psql --dbname="$RESTORE_URL" -Atqc "select count(*) from information_schema.tables where table_schema='public'")"
[[ "$table_count" =~ ^[0-9]+$ ]] && (( table_count > 0 )) || { echo "Odtworzona baza nie zawiera tabel." >&2; exit 1; }

echo "[5/5] Usunięcie danych testowych i zapis wyniku"
psql --dbname="$RESTORE_URL" -v ON_ERROR_STOP=1 -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' >/dev/null
database_prepared=false
backup_id="$(basename "$backup_dir")"
write_status ok full-restore-verified "$backup_id"
trap - EXIT INT TERM
rm -rf -- "$tmp_dir"
echo "Pełny test odtworzenia zakończony: $backup_id, tabele: $table_count"
