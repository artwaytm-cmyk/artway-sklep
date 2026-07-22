#!/usr/bin/env bash
set -Eeuo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
umask 077

readonly BACKUP_ROOT="${ARTWAY_BACKUP_ROOT:-/srv/artway/backups}"
readonly REPOSITORY="${ARTWAY_BACKUP_REPOSITORY:-artwaytm-cmyk/artway-backups}"
readonly RELEASE_TAG="${ARTWAY_BACKUP_RELEASE_TAG:-offsite-backups}"
readonly KEY_FILE="${ARTWAY_BACKUP_KEY_FILE:-/srv/artway/ops/secrets/backup-offsite.key}"
readonly LOCAL_RETENTION_DAYS="${ARTWAY_OFFSITE_LOCAL_RETENTION_DAYS:-7}"
readonly REMOTE_RETENTION_DAYS="${ARTWAY_OFFSITE_REMOTE_RETENTION_DAYS:-35}"
readonly OFFSITE_ROOT="$BACKUP_ROOT/offsite"
readonly STATUS_FILE="$BACKUP_ROOT/offsite-status.json"
readonly LOCK_FILE="$BACKUP_ROOT/.offsite-backup.lock"

for command in gpg gh tar sha256sum jq flock; do
  command -v "$command" >/dev/null || { echo "Brak wymaganego polecenia: $command" >&2; exit 1; }
done
[[ -r "$KEY_FILE" ]] || { echo "Brak chronionego klucza kopii zewnętrznej." >&2; exit 1; }

mkdir -p "$OFFSITE_ROOT" "$BACKUP_ROOT/.gnupg"
chmod 700 "$OFFSITE_ROOT" "$BACKUP_ROOT/.gnupg"
export GNUPGHOME="$BACKUP_ROOT/.gnupg"

exec 9>"$LOCK_FILE"
flock -n 9 || { echo "Wysyłka kopii zewnętrznej jest już uruchomiona." >&2; exit 0; }

write_status() {
  local state="$1" detail="$2" backup_id="${3:-}"
  jq -n --arg status "$state" --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg detail "$detail" --arg backup "$backup_id" --arg repository "$REPOSITORY" \
    '{status:$status,timestamp:$timestamp,detail:$detail,backup:$backup,repository:$repository}' >"$STATUS_FILE.tmp"
  chmod 600 "$STATUS_FILE.tmp"
  mv -f "$STATUS_FILE.tmp" "$STATUS_FILE"
}

tmp_dir=""
cleanup() {
  local exit_code=$?
  [[ -z "$tmp_dir" ]] || rm -rf -- "$tmp_dir"
  if (( exit_code != 0 )); then write_status failed offsite-backup-failed; fi
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

latest="$(readlink -f "$BACKUP_ROOT/latest" 2>/dev/null || true)"
case "$latest" in "$BACKUP_ROOT"/daily/*) ;; *) echo "Brak prawidłowej lokalnej kopii latest." >&2; exit 1;; esac
[[ -d "$latest" && -f "$latest/SHA256SUMS" ]] || { echo "Lokalna kopia jest niekompletna." >&2; exit 1; }
backup_id="$(basename "$latest")"
(
  cd "$latest"
  sha256sum --check --strict SHA256SUMS
  pg_restore --list database.dump >/dev/null
  tar --zstd --list --file=application.tar.zst >/dev/null
  tar --zstd --list --file=deployed-release.tar.zst >/dev/null
  jq -e '.commit | type == "string" and length > 0' deployed-release.json >/dev/null
  tar --zstd --list --file=server-config.tar.zst >/dev/null
)

tmp_dir="$(mktemp -d "$OFFSITE_ROOT/.incomplete-${backup_id}-XXXXXX")"
encrypted_name="artway-${backup_id}.tar.gpg"
encrypted_file="$tmp_dir/$encrypted_name"
checksum_file="$encrypted_file.sha256"

echo "[1/4] Szyfrowanie zweryfikowanej kopii $backup_id"
tar -C "$(dirname "$latest")" -cf - "$backup_id" | \
  gpg --batch --yes --pinentry-mode loopback --passphrase-file "$KEY_FILE" \
    --symmetric --cipher-algo AES256 --s2k-digest-algo SHA512 --compress-algo none \
    --output "$encrypted_file"
(
  cd "$tmp_dir"
  sha256sum "$encrypted_name" >"$(basename "$checksum_file")"
  sha256sum --check --strict "$(basename "$checksum_file")"
)

echo "[2/4] Próba odszyfrowania przed wysyłką"
gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$KEY_FILE" \
  --decrypt "$encrypted_file" | tar -tf - >/dev/null

echo "[3/4] Wysyłka zaszyfrowanych danych poza OVH"
gh auth status --hostname github.com >/dev/null
if ! gh release view "$RELEASE_TAG" --repo "$REPOSITORY" >/dev/null 2>&1; then
  gh release create "$RELEASE_TAG" --repo "$REPOSITORY" --title "Zaszyfrowane kopie Artway-TM" \
    --notes "Automatyczne kopie zaszyfrowane przed opuszczeniem VPS. Archiwa nie zawierają jawnych danych klientów." --latest=false
fi
gh release upload "$RELEASE_TAG" "$encrypted_file" "$checksum_file" --repo "$REPOSITORY" --clobber

remote_assets="$(gh api "repos/$REPOSITORY/releases/tags/$RELEASE_TAG")"
remote_size="$(jq -r --arg name "$encrypted_name" '.assets[] | select(.name==$name) | .size' <<<"$remote_assets")"
local_size="$(stat -c %s "$encrypted_file")"
[[ "$remote_size" == "$local_size" ]] || { echo "Rozmiar pliku na GitHubie nie zgadza się z kopią lokalną." >&2; exit 1; }
jq -e --arg name "$(basename "$checksum_file")" '.assets[] | select(.name==$name)' <<<"$remote_assets" >/dev/null

echo "[4/4] Retencja wyłącznie własnych zaszyfrowanych archiwów"
cutoff="$(date -u -d "-$REMOTE_RETENTION_DAYS days" +%s)"
while IFS=$'\t' read -r asset_id asset_name created_at; do
  [[ "$asset_name" =~ ^artway-.*\.tar\.gpg(\.sha256)?$ ]] || continue
  created_epoch="$(date -u -d "$created_at" +%s)"
  if (( created_epoch < cutoff )); then gh api --method DELETE "repos/$REPOSITORY/releases/assets/$asset_id" >/dev/null; fi
done < <(jq -r '.assets[] | [.id,.name,.created_at] | @tsv' <<<"$remote_assets")
find "$OFFSITE_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime "+$LOCAL_RETENTION_DAYS" -exec rm -rf -- {} +

final_dir="$OFFSITE_ROOT/$backup_id"
rm -rf -- "$final_dir"
mv "$tmp_dir" "$final_dir"
tmp_dir=""
ln -sfn "$backup_id" "$OFFSITE_ROOT/.latest.new"
mv -Tf "$OFFSITE_ROOT/.latest.new" "$OFFSITE_ROOT/latest"
write_status ok encrypted-upload-verified "$backup_id"
trap - EXIT INT TERM
echo "Zewnętrzna kopia zaszyfrowana i potwierdzona: $REPOSITORY / $encrypted_name"
