#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-${HOME}/maintenance-backups}"
RETENTION_COUNT="${RETENTION_COUNT:-7}"
TIMESTAMP="$(date '+%Y-%m-%dT%H-%M-%S')"
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}-ebaycf"
ENV_FILE="${APP_DIR}/.env"
DATA_DIR="${APP_DIR}/data"
STATE_DB="${DATA_DIR}/state.db"

copy_if_present() {
  local source_path="$1"
  local target_dir="$2"
  if [ -e "${source_path}" ]; then
    cp -p "${source_path}" "${target_dir}/"
    chmod 600 "${target_dir}/$(basename "${source_path}")"
  fi
}

mkdir -p "${BACKUP_ROOT}"
chmod 700 "${BACKUP_ROOT}"
mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

copy_if_present "${ENV_FILE}" "${BACKUP_DIR}"
copy_if_present "${STATE_DB}" "${BACKUP_DIR}"

if compgen -G "${DATA_DIR}/*.legacy-json.bak" >/dev/null; then
  mkdir -p "${BACKUP_DIR}/legacy"
  chmod 700 "${BACKUP_DIR}/legacy"
  cp -p "${DATA_DIR}"/*.legacy-json.bak "${BACKUP_DIR}/legacy/"
  chmod 600 "${BACKUP_DIR}/legacy/"*.legacy-json.bak
fi

cat > "${BACKUP_DIR}/MANIFEST.txt" <<EOF
created_at=${TIMESTAMP}
app_dir=${APP_DIR}
env_file=$( [ -f "${ENV_FILE}" ] && echo present || echo missing )
state_db=$( [ -f "${STATE_DB}" ] && echo present || echo missing )
EOF
chmod 600 "${BACKUP_DIR}/MANIFEST.txt"

mapfile -t backups < <(find "${BACKUP_ROOT}" -maxdepth 1 -mindepth 1 -type d -name '*-ebaycf' | sort)
if [ "${#backups[@]}" -gt "${RETENTION_COUNT}" ]; then
  delete_count=$(( ${#backups[@]} - RETENTION_COUNT ))
  for ((i=0; i<delete_count; i+=1)); do
    rm -rf "${backups[$i]}"
  done
fi

echo "Backup creato in: ${BACKUP_DIR}"
