#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-${HOME}/maintenance-backups}"
RETENTION_COUNT="${RETENTION_COUNT:-7}"
TIMESTAMP="$(date '+%Y-%m-%dT%H-%M-%S')"
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}-fiscalbay"
ENV_FILE="${APP_DIR}/.env"
DATA_DIR="${APP_DIR}/data"
STATE_DB="${DATA_DIR}/state.db"
SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"
APP_CONFIG_DIR="${APP_CONFIG_DIR:-/etc/fiscalbay}"
NGINX_CONF_DIR="${NGINX_CONF_DIR:-/etc/nginx/conf.d}"
NGINX_SITES_AVAILABLE_DIR="${NGINX_SITES_AVAILABLE_DIR:-/etc/nginx/sites-available}"
NGINX_SITES_ENABLED_DIR="${NGINX_SITES_ENABLED_DIR:-/etc/nginx/sites-enabled}"

copy_if_present() {
  local source_path="$1"
  local target_dir="$2"
  if [ -e "${source_path}" ]; then
    cp -p "${source_path}" "${target_dir}/"
    chmod 600 "${target_dir}/$(basename "${source_path}")"
  fi
}

copy_glob_if_present() {
  local source_glob="$1"
  local target_dir="$2"
  if compgen -G "${source_glob}" >/dev/null; then
    mkdir -p "${target_dir}"
    chmod 700 "${target_dir}"
    for source_path in ${source_glob}; do
      if [ -f "${source_path}" ] && [ -r "${source_path}" ]; then
        cp -p "${source_path}" "${target_dir}/"
        chmod 600 "${target_dir}/$(basename "${source_path}")"
      fi
    done
  fi
}

mkdir -p "${BACKUP_ROOT}"
chmod 700 "${BACKUP_ROOT}"
mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"
mkdir -p "${BACKUP_DIR}/runtime"
chmod 700 "${BACKUP_DIR}/runtime"

copy_if_present "${ENV_FILE}" "${BACKUP_DIR}"
copy_if_present "${STATE_DB}" "${BACKUP_DIR}"
copy_if_present "${ENV_FILE}" "${BACKUP_DIR}/runtime"
copy_if_present "${STATE_DB}" "${BACKUP_DIR}/runtime"

if compgen -G "${DATA_DIR}/*.legacy-json.bak" >/dev/null; then
  mkdir -p "${BACKUP_DIR}/legacy"
  chmod 700 "${BACKUP_DIR}/legacy"
  cp -p "${DATA_DIR}"/*.legacy-json.bak "${BACKUP_DIR}/legacy/"
  chmod 600 "${BACKUP_DIR}/legacy/"*.legacy-json.bak
fi

copy_glob_if_present "${SYSTEMD_DIR}/fiscalbay-*.service" "${BACKUP_DIR}/systemd"
copy_glob_if_present "${SYSTEMD_DIR}/fiscalbay-*.timer" "${BACKUP_DIR}/systemd"
copy_glob_if_present "${APP_CONFIG_DIR}/*.env" "${BACKUP_DIR}/etc-fiscalbay"
copy_glob_if_present "${NGINX_CONF_DIR}/*fiscalbay*.conf" "${BACKUP_DIR}/nginx"
copy_glob_if_present "${NGINX_SITES_AVAILABLE_DIR}/*fiscalbay*" "${BACKUP_DIR}/nginx"
copy_glob_if_present "${NGINX_SITES_ENABLED_DIR}/*fiscalbay*" "${BACKUP_DIR}/nginx"

if [ -x "${APP_DIR}/deploy/service-inventory.sh" ]; then
  "${APP_DIR}/deploy/service-inventory.sh" > "${BACKUP_DIR}/SERVICE_INVENTORY.txt" || true
  chmod 600 "${BACKUP_DIR}/SERVICE_INVENTORY.txt"
fi

cat > "${BACKUP_DIR}/MANIFEST.txt" <<EOF
created_at=${TIMESTAMP}
app_dir=${APP_DIR}
env_file=$( [ -f "${ENV_FILE}" ] && echo present || echo missing )
state_db=$( [ -f "${STATE_DB}" ] && echo present || echo missing )
systemd_units=$( find "${BACKUP_DIR}/systemd" -type f 2>/dev/null | wc -l | tr -d ' ' )
nginx_configs=$( find "${BACKUP_DIR}/nginx" -type f 2>/dev/null | wc -l | tr -d ' ' )
etc_fiscalbay_env=$( find "${BACKUP_DIR}/etc-fiscalbay" -type f 2>/dev/null | wc -l | tr -d ' ' )
EOF
chmod 600 "${BACKUP_DIR}/MANIFEST.txt"

backups=()
while IFS= read -r backup_path; do
  backups+=("${backup_path}")
done < <(find "${BACKUP_ROOT}" -maxdepth 1 -mindepth 1 -type d -name '*-fiscalbay' | sort)
if [ "${#backups[@]}" -gt "${RETENTION_COUNT}" ]; then
  delete_count=$(( ${#backups[@]} - RETENTION_COUNT ))
  for ((i=0; i<delete_count; i+=1)); do
    rm -rf "${backups[$i]}"
  done
fi

echo "Backup creato in: ${BACKUP_DIR}"
