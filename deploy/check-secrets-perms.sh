#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${APP_DIR}/.env"
STATE_DB="${APP_DIR}/data/state.db"
APP_USER="${APP_USER:-fiscalbay}"
APP_GROUP="${APP_GROUP:-${APP_USER}}"

check_file_security() {
  local file_path="$1"
  local expected_mode="$2"
  local expected_owner="$3"

  if [ ! -e "${file_path}" ]; then
    echo "MISSING ${file_path}"
    return 1
  fi

  local actual_mode
  local actual_owner
  actual_mode="$(stat -c '%a' "${file_path}")"
  actual_owner="$(stat -c '%U:%G' "${file_path}")"
  if [ "${actual_mode}" != "${expected_mode}" ]; then
    echo "BADMODE ${file_path} expected=${expected_mode} actual=${actual_mode}"
    return 1
  fi
  if [ "${actual_owner}" != "${expected_owner}" ]; then
    echo "BADOWNER ${file_path} expected=${expected_owner} actual=${actual_owner}"
    return 1
  fi

  echo "OK ${file_path} mode=${actual_mode} owner=${actual_owner}"
}

status=0
check_file_security "${ENV_FILE}" "640" "root:${APP_GROUP}" || status=1

if [ -e "${STATE_DB}" ]; then
  db_mode="$(stat -c '%a' "${STATE_DB}")"
  db_owner="$(stat -c '%U:%G' "${STATE_DB}")"
  case "${db_mode}" in
    600|660)
      ;;
    *)
      echo "BADMODE ${STATE_DB} expected=600_or_660 actual=${db_mode}"
      status=1
      ;;
  esac
  if [ "${db_owner}" != "${APP_USER}:${APP_GROUP}" ]; then
    echo "BADOWNER ${STATE_DB} expected=${APP_USER}:${APP_GROUP} actual=${db_owner}"
    status=1
  elif [ "${db_mode}" = "600" ] || [ "${db_mode}" = "660" ]; then
    echo "OK ${STATE_DB} mode=${db_mode} owner=${db_owner}"
  fi
else
  echo "SKIP ${STATE_DB} missing"
fi

exit "${status}"
