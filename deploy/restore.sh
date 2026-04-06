#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Uso:
  ./deploy/restore.sh /percorso/backup
  ./deploy/restore.sh /percorso/backup --in-place

Senza --in-place esegue un restore di prova in una directory separata.
EOF
}

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  usage
  exit 1
fi

BACKUP_DIR="$1"
MODE="${2:-}"

if [ ! -d "${BACKUP_DIR}" ]; then
  echo "Backup non trovato: ${BACKUP_DIR}" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${APP_DIR}/.env"
DATA_DIR="${APP_DIR}/data"
STATE_DB="${DATA_DIR}/state.db"

restore_file() {
  local source_path="$1"
  local target_path="$2"
  if [ -f "${source_path}" ]; then
    mkdir -p "$(dirname "${target_path}")"
    cp -p "${source_path}" "${target_path}"
    chmod 600 "${target_path}"
  fi
}

if [ "${MODE}" = "--in-place" ]; then
  restore_file "${BACKUP_DIR}/.env" "${ENV_FILE}"
  restore_file "${BACKUP_DIR}/state.db" "${STATE_DB}"
  echo "Restore in-place completato in ${APP_DIR}"
  exit 0
fi

if [ -n "${MODE}" ]; then
  usage
  exit 1
fi

VERIFY_DIR="${APP_DIR}/data/restore-check/$(basename "${BACKUP_DIR}")"
restore_file "${BACKUP_DIR}/.env" "${VERIFY_DIR}/.env"
restore_file "${BACKUP_DIR}/state.db" "${VERIFY_DIR}/state.db"
echo "Restore di prova completato in ${VERIFY_DIR}"
