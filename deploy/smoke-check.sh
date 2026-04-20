#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SERVICE_NAME="${1:-fiscalbay-bot}"
HEALTHCHECK_BIN="${2:-${APP_DIR}/.venv/bin/fiscalbay-healthcheck}"
ENV_FILE="${3:-${APP_DIR}/.env}"
OAUTH_SERVICE_NAME="${4:-fiscalbay-oauth}"

sudo systemctl is-active --quiet "${SERVICE_NAME}"
set -a
source "${ENV_FILE}"
set +a
cd "${APP_DIR}"
healthcheck_args=(
  --check-service-active
  --service-name "${SERVICE_NAME}"
)
max_attempts="${SMOKE_CHECK_ATTEMPTS:-12}"
sleep_seconds="${SMOKE_CHECK_SLEEP_SECONDS:-5}"

for attempt in $(seq 1 "${max_attempts}"); do
  if "${HEALTHCHECK_BIN}" "${healthcheck_args[@]}"; then
    break
  fi
  if [ "${attempt}" -eq "${max_attempts}" ]; then
    exit 1
  fi
  echo "Healthcheck non ancora stabile (${attempt}/${max_attempts}), nuovo tentativo tra ${sleep_seconds}s..."
  sleep "${sleep_seconds}"
done
if sudo systemctl is-enabled --quiet "${OAUTH_SERVICE_NAME}"; then
  sudo systemctl is-active --quiet "${OAUTH_SERVICE_NAME}"
fi
