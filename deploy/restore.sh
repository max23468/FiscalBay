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

first_present_file() {
  for source_path in "$@"; do
    if [ -f "${source_path}" ]; then
      echo "${source_path}"
      return 0
    fi
  done
  return 1
}

restore_file() {
  local source_path="$1"
  local target_path="$2"
  if [ -f "${source_path}" ]; then
    mkdir -p "$(dirname "${target_path}")"
    cp -p "${source_path}" "${target_path}"
    chmod 600 "${target_path}"
  fi
}

restore_dir_for_drill() {
  local source_dir="$1"
  local target_dir="$2"
  if [ -d "${source_dir}" ]; then
    mkdir -p "${target_dir}"
    cp -pR "${source_dir}/." "${target_dir}/"
    find "${target_dir}" -type f -exec chmod 600 {} \;
  fi
}

ENV_SOURCE="$(first_present_file "${BACKUP_DIR}/runtime/.env" "${BACKUP_DIR}/.env" || true)"
STATE_SOURCE="$(first_present_file "${BACKUP_DIR}/runtime/state.db" "${BACKUP_DIR}/state.db" || true)"

if [ "${MODE}" = "--in-place" ]; then
  restore_file "${ENV_SOURCE}" "${ENV_FILE}"
  restore_file "${STATE_SOURCE}" "${STATE_DB}"
  echo "Restore in-place completato in ${APP_DIR}"
  if [ -d "${BACKUP_DIR}/systemd" ] || [ -d "${BACKUP_DIR}/nginx" ]; then
    echo "Nota: systemd/nginx sono nel backup ma non vengono ripristinati automaticamente."
  fi
  exit 0
fi

if [ -n "${MODE}" ]; then
  usage
  exit 1
fi

VERIFY_DIR="${APP_DIR}/data/restore-check/$(basename "${BACKUP_DIR}")"
restore_file "${ENV_SOURCE}" "${VERIFY_DIR}/runtime/.env"
restore_file "${STATE_SOURCE}" "${VERIFY_DIR}/runtime/state.db"
restore_dir_for_drill "${BACKUP_DIR}/legacy" "${VERIFY_DIR}/legacy"
restore_dir_for_drill "${BACKUP_DIR}/systemd" "${VERIFY_DIR}/systemd"
restore_dir_for_drill "${BACKUP_DIR}/nginx" "${VERIFY_DIR}/nginx"
restore_dir_for_drill "${BACKUP_DIR}/etc-fiscalbay" "${VERIFY_DIR}/etc-fiscalbay"
restore_file "${BACKUP_DIR}/MANIFEST.txt" "${VERIFY_DIR}/MANIFEST.txt"
restore_file "${BACKUP_DIR}/SERVICE_INVENTORY.txt" "${VERIFY_DIR}/SERVICE_INVENTORY.txt"
echo "Restore di prova completato in ${VERIFY_DIR}"
