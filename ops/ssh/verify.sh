#!/usr/bin/env bash
set -Eeuo pipefail

phase="${1:-}"
effective="$(/usr/sbin/sshd -T -C user=artway,host=localhost,addr=127.0.0.1)"

expect_value() {
  local key="$1"
  local expected="$2"
  local actual
  actual="$(awk -v wanted="${key}" '$1 == wanted { $1=""; sub(/^ /, ""); print; exit }' <<<"${effective}")"
  if [[ "${actual}" != "${expected}" ]]; then
    echo "BŁĄD SSH: ${key}=${actual:-BRAK}, oczekiwano ${expected}" >&2
    exit 1
  fi
}

expect_value permitrootlogin no
expect_value passwordauthentication no
expect_value kbdinteractiveauthentication no
expect_value pubkeyauthentication yes
expect_value authenticationmethods publickey
expect_value allowusers artway
expect_value allowtcpforwarding local
expect_value x11forwarding no

if [[ "${phase}" != "--before-reload" ]]; then
  systemctl is-active --quiet ssh.service
  ssh-keyscan -T 5 localhost >/dev/null 2>&1

  offered="$(ssh -vv \
    -o BatchMode=yes \
    -o ConnectTimeout=5 \
    -o PreferredAuthentications=password,keyboard-interactive \
    -o PubkeyAuthentication=no \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    artway@localhost true 2>&1 || true)"
  if ! grep -q "Authentications that can continue: publickey" <<<"${offered}"; then
    echo "BŁĄD SSH: serwer nie ograniczył uwierzytelniania do klucza publicznego" >&2
    exit 1
  fi
fi

echo "SSH OK: tylko artway + klucz publiczny; root i hasła wyłączone."
