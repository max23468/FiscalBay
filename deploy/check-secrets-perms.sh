#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${APP_DIR}/.env"
STATE_DB="${APP_DIR}/data/state.db"

check_file_mode() {
  local file_path="$1"
  local expected_mode="$2"

  if [ ! -e "${file_path}" ]; then
    echo "MISSING ${file_path}"
    return 1
  fi

  local actual_mode
  actual_mode="$(stat -c '%a' "${file_path}")"
  if [ "${actual_mode}" != "${expected_mode}" ]; then
    echo "BADMODE ${file_path} expected=${expected_mode} actual=${actual_mode}"
    return 1
  fi

  echo "OK ${file_path} mode=${actual_mode}"
}

status=0
check_file_mode "${ENV_FILE}" "600" || status=1

if [ -e "${STATE_DB}" ]; then
  db_mode="$(stat -c '%a' "${STATE_DB}")"
  case "${db_mode}" in
    600|660)
      echo "OK ${STATE_DB} mode=${db_mode}"
      ;;
    *)
      echo "BADMODE ${STATE_DB} expected=600_or_660 actual=${db_mode}"
      status=1
      ;;
  esac
else
  echo "SKIP ${STATE_DB} missing"
fi

exit "${status}"
