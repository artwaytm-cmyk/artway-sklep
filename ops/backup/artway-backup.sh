#!/usr/bin/env bash
set -Eeuo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
umask 077

readonly BACKUP_ROOT="${ARTWAY_BACKUP_ROOT:-/srv/artway/backups}"
readonly DAILY_ROOT="$BACKUP_ROOT/daily"
readonly MONTHLY_ROOT="$BACKUP_ROOT/monthly"
readonly RETENTION_DAYS="${ARTWAY_BACKUP_RETENTION_DAYS:-30}"
readonly RETENTION_MONTHS_DAYS="${ARTWAY_BACKUP_MONTHLY_RETENTION_DAYS:-370}"
readonly MIN_FREE_KIB="${ARTWAY_BACKUP_MIN_FREE_KIB:-2097152}"
readonly TIMESTAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
readonly FINAL_DIR="$DAILY_ROOT/$TIMESTAMP"
readonly TMP_DIR="$BACKUP_ROOT/.incomplete-$TIMESTAMP-$$"
readonly LOCK_FILE="$BACKUP_ROOT/.backup.lock"
readonly STATUS_FILE="$BACKUP_ROOT/status.json"
readonly ACTIVE_RELEASE_LINK="/srv/artway/releases/current"

mkdir -p "$BACKUP_ROOT" "$DAILY_ROOT" "$MONTHLY_ROOT"
chmod 700 "$BACKUP_ROOT" "$DAILY_ROOT" "$MONTHLY_ROOT"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Kopia Artway jest już wykonywana; pomijam równoległe uruchomienie." >&2
  exit 0
fi

write_status() {
  local state="$1"
  local detail="$2"
  local finished_at
  finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '{"status":"%s","timestamp":"%s","detail":"%s","backup":"%s"}\n' \
    "$state" "$finished_at" "$detail" "$FINAL_DIR" >"$STATUS_FILE.tmp"
  chmod 600 "$STATUS_FILE.tmp"
  mv -f "$STATUS_FILE.tmp" "$STATUS_FILE"
}

cleanup() {
  local exit_code=$?
  if (( exit_code != 0 )); then
    write_status "failed" "backup-command-failed"
  fi
  if [[ -d "$TMP_DIR" ]]; then
    find "$TMP_DIR" -depth -mindepth 1 -delete 2>/dev/null || true
    rmdir "$TMP_DIR" 2>/dev/null || true
  fi
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

for command in df flock git jq node pg_dump pg_restore psql sha256sum tar; do
  command -v "$command" >/dev/null || {
    echo "Brak wymaganego polecenia: $command" >&2
    exit 1
  }
done

free_kib="$(df -Pk "$BACKUP_ROOT" | awk 'NR == 2 {print $4}')"
if [[ ! "$free_kib" =~ ^[0-9]+$ ]] || (( free_kib < MIN_FREE_KIB )); then
  echo "Za mało wolnego miejsca na bezpieczną kopię Artway." >&2
  exit 1
fi

database_url="${DATABASE_URL:-}"
if [[ -z "$database_url" && -r /etc/systemd/system/artway-backend.service ]]; then
  database_url="$(sed -n 's/^Environment=DATABASE_URL=//p' /etc/systemd/system/artway-backend.service | tail -n 1)"
  database_url="${database_url#\"}"
  database_url="${database_url%\"}"
fi
if [[ -z "$database_url" ]]; then
  echo "Brak DATABASE_URL — kopia bazy nie może zostać wykonana." >&2
  exit 1
fi

active_release="$(readlink -f "$ACTIVE_RELEASE_LINK" 2>/dev/null || true)"
if [[ ! "$active_release" =~ ^/srv/artway/releases/[^/]+$ ]] || [[ ! -f "$active_release/release.json" ]]; then
  echo "Aktywne wydanie Nginx nie jest poprawnym wydaniem atomowym." >&2
  exit 1
fi
active_release_commit="$(jq -er '.gitCommit | select(type == "string" and length > 0)' "$active_release/release.json")"

mkdir "$TMP_DIR"
chmod 700 "$TMP_DIR"

echo "[1/6] Kopia PostgreSQL"
PGCONNECT_TIMEOUT=10 pg_dump \
  --dbname="$database_url" \
  --format=custom \
  --compress=zstd:9 \
  --no-owner \
  --no-privileges \
  --file="$TMP_DIR/database.dump"
chmod 600 "$TMP_DIR/database.dump"
pg_restore --list "$TMP_DIR/database.dump" >"$TMP_DIR/database.contents"

echo "[2/6] Kopia kodu aplikacji, Agenta i operacji"
tar --zstd --create --file="$TMP_DIR/application.tar.zst" \
  --numeric-owner \
  --exclude='srv/artway/backups' \
  --exclude='srv/artway/shop/.git' \
  --exclude='srv/artway/shop/node_modules' \
  --exclude='srv/artway/agent/node_modules' \
  -C / \
  srv/artway/shop \
  srv/artway/agent \
  srv/artway/ops
chmod 600 "$TMP_DIR/application.tar.zst"
tar --zstd --list --file="$TMP_DIR/application.tar.zst" >/dev/null

echo "[3/6] Kopia dokładnie aktywnego wydania strony"
tar --zstd --dereference --create --file="$TMP_DIR/deployed-release.tar.zst" \
  --numeric-owner \
  -C / \
  srv/artway/releases/current
cp "$active_release/release.json" "$TMP_DIR/deployed-release.json"
chmod 600 "$TMP_DIR/deployed-release.tar.zst" "$TMP_DIR/deployed-release.json"
tar --zstd --list --file="$TMP_DIR/deployed-release.tar.zst" >/dev/null
jq -e --arg commit "$active_release_commit" '.gitCommit == $commit' "$TMP_DIR/deployed-release.json" >/dev/null

echo "[4/6] Kopia czytelnej konfiguracji serwera"
config_paths=()
for path in \
  /etc/nginx/nginx.conf \
  /etc/nginx/sites-available \
  /etc/nginx/sites-enabled \
  /etc/ssh/sshd_config \
  /etc/ssh/sshd_config.d \
  /etc/systemd/system/artway-backend.service \
  /etc/systemd/system/artway-agent.service \
  /etc/systemd/system/artway-vnc.service \
  /etc/systemd/system/artway-novnc.service \
  /etc/systemd/system/artway-backup.service \
  /etc/systemd/system/artway-backup.timer \
  /etc/systemd/system/artway-offsite-backup.service \
  /etc/systemd/system/artway-offsite-backup.timer \
  /etc/systemd/system/artway-restore-drill.service \
  /etc/systemd/system/artway-restore-drill.timer \
  /home/artway/.ssh/authorized_keys \
  /home/artway/.config/systemd/user; do
  if [[ -f "$path" || -L "$path" ]]; then
    [[ -r "$path" ]] && config_paths+=("${path#/}")
  elif [[ -d "$path" ]]; then
    while IFS= read -r -d '' candidate; do
      [[ -r "$candidate" ]] && config_paths+=("${candidate#/}")
    done < <(find "$path" -xdev \( -type f -o -type l \) -print0 2>/dev/null)
  fi
done
printf '%s\0' "${config_paths[@]}" >"$TMP_DIR/server-config.files"
tar --zstd --create --file="$TMP_DIR/server-config.tar.zst" \
  --numeric-owner \
  -C / \
  --null \
  --files-from="$TMP_DIR/server-config.files"
chmod 600 "$TMP_DIR/server-config.tar.zst"
tar --zstd --list --file="$TMP_DIR/server-config.tar.zst" >/dev/null

echo "[5/6] Metadane i kontrola integralności"
{
  printf 'created_at_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'hostname=%s\n' "$(hostname -f 2>/dev/null || hostname)"
  printf 'shop_git_commit=%s\n' "$(git -C /srv/artway/shop rev-parse HEAD 2>/dev/null || printf unknown)"
  printf 'shop_git_branch=%s\n' "$(git -C /srv/artway/shop branch --show-current 2>/dev/null || printf unknown)"
  printf 'shop_worktree_dirty_files=%s\n' "$(git -C /srv/artway/shop status --porcelain 2>/dev/null | wc -l)"
  printf 'active_release=%s\n' "$active_release"
  printf 'active_release_commit=%s\n' "$active_release_commit"
  printf 'node_version=%s\n' "$(node --version)"
  printf 'postgres_client=%s\n' "$(pg_dump --version)"
  printf 'database_size=%s\n' "$(psql --dbname="$database_url" -Atqc 'select pg_database_size(current_database())' 2>/dev/null || printf unknown)"
} >"$TMP_DIR/metadata.env"
chmod 600 "$TMP_DIR/metadata.env"

(
  cd "$TMP_DIR"
  sha256sum \
    database.dump \
    database.contents \
    application.tar.zst \
    deployed-release.tar.zst \
    deployed-release.json \
    server-config.tar.zst \
    metadata.env >SHA256SUMS
  sha256sum --check --strict SHA256SUMS
)

echo "[6/6] Publikacja atomowa i retencja"
mv "$TMP_DIR" "$FINAL_DIR"
ln -sfn "daily/$TIMESTAMP" "$BACKUP_ROOT/.latest.new"
mv -Tf "$BACKUP_ROOT/.latest.new" "$BACKUP_ROOT/latest"

if [[ "$(date +%d)" == "01" ]]; then
  monthly_dir="$MONTHLY_ROOT/$(date +%Y-%m)"
  if [[ ! -e "$monthly_dir" ]]; then
    cp -al "$FINAL_DIR" "$monthly_dir"
  fi
fi

find "$DAILY_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" -print -exec rm -rf -- {} +
find "$MONTHLY_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime "+$RETENTION_MONTHS_DAYS" -print -exec rm -rf -- {} +

write_status "ok" "backup-verified"
trap - EXIT INT TERM
echo "Kopia Artway ukończona i zweryfikowana: $FINAL_DIR"
