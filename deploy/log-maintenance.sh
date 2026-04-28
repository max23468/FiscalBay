#!/usr/bin/env bash
set -euo pipefail

JOURNAL_VACUUM_TIME="${JOURNAL_VACUUM_TIME:-14d}"
JOURNAL_VACUUM_SIZE="${JOURNAL_VACUUM_SIZE:-200M}"
NGINX_LOG_DIR="${NGINX_LOG_DIR:-/var/log/nginx}"
NGINX_LOG_RETENTION_DAYS="${NGINX_LOG_RETENTION_DAYS:-30}"

if command -v journalctl >/dev/null 2>&1; then
  journalctl --vacuum-time="${JOURNAL_VACUUM_TIME}" --vacuum-size="${JOURNAL_VACUUM_SIZE}"
fi

if [ -d "${NGINX_LOG_DIR}" ]; then
  find "${NGINX_LOG_DIR}" -type f -name '*fiscalbay*.log.*' -mtime "+${NGINX_LOG_RETENTION_DAYS}" -delete
fi

echo "Manutenzione log completata."
