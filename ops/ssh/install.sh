#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="/var/backups/artway-ssh/${STAMP}"

if [[ ${EUID} -ne 0 ]]; then
  echo "Uruchom przez sudo: sudo $0" >&2
  exit 1
fi

install -d -m 0700 "${BACKUP_DIR}"
cp -a /etc/ssh/sshd_config "${BACKUP_DIR}/sshd_config"
cp -a /etc/ssh/sshd_config.d "${BACKUP_DIR}/sshd_config.d"
if [[ -d /etc/cloud/cloud.cfg.d ]]; then
  cp -a /etc/cloud/cloud.cfg.d "${BACKUP_DIR}/cloud.cfg.d"
fi

install -d -m 0755 /etc/ssh/sshd_config.d
install -m 0644 "${ROOT_DIR}/00-artway-access.conf" /etc/ssh/sshd_config.d/00-artway-access.conf
install -m 0644 "${ROOT_DIR}/50-cloud-init.conf" /etc/ssh/sshd_config.d/50-cloud-init.conf
rm -f /etc/ssh/sshd_config.d/99-artway-hardening.conf

install -d -m 0755 /etc/cloud/cloud.cfg.d
install -m 0644 "${ROOT_DIR}/99-artway-security.cfg" /etc/cloud/cloud.cfg.d/99-artway-security.cfg

/usr/sbin/sshd -t
"${ROOT_DIR}/verify.sh" --before-reload
systemctl reload ssh.service
sleep 1
"${ROOT_DIR}/verify.sh"

echo "SSH uporządkowane. Kopia poprzedniej konfiguracji: ${BACKUP_DIR}"
