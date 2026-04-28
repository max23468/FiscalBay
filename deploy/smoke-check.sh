#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SERVICE_NAME="${1:-fiscalbay-bot}"
HEALTHCHECK_BIN="${2:-${APP_DIR}/.venv/bin/fiscalbay-healthcheck}"
ENV_FILE="${3:-${APP_DIR}/.env}"
OAUTH_SERVICE_NAME="${4:-fiscalbay-oauth}"
ALERT_SERVICE_NAME="${5:-fiscalbay-alertcheck}"
RECONCILE_SERVICE_NAME="${6:-fiscalbay-reconcile}"
EXTERNAL_HEALTH_SERVICE_NAME="${EXTERNAL_HEALTH_SERVICE_NAME:-fiscalbay-external-healthcheck}"

sudo systemctl is-active --quiet "${SERVICE_NAME}"
set -a
source "${ENV_FILE}"
set +a
cd "${APP_DIR}"
healthcheck_args=(
  --check-service-active
  --service-name "${SERVICE_NAME}"
  --ignore-reason last_check_missing
  --ignore-reason last_check_stale
)
max_attempts="${SMOKE_CHECK_ATTEMPTS:-12}"
sleep_seconds="${SMOKE_CHECK_SLEEP_SECONDS:-5}"
if ! [[ "${max_attempts}" =~ ^[0-9]+$ ]] || [ "${max_attempts}" -lt 1 ]; then
  echo "SMOKE_CHECK_ATTEMPTS deve essere un intero >= 1." >&2
  exit 1
fi
if ! [[ "${sleep_seconds}" =~ ^[0-9]+$ ]]; then
  echo "SMOKE_CHECK_SLEEP_SECONDS deve essere un intero >= 0." >&2
  exit 1
fi

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
for service in "${ALERT_SERVICE_NAME}" "${RECONCILE_SERVICE_NAME}"; do
  if sudo systemctl is-enabled --quiet "${service}.timer"; then
    sudo systemctl is-active --quiet "${service}.timer"
    sudo systemctl start "${service}.service"
  fi
done
if sudo systemctl is-enabled --quiet "${EXTERNAL_HEALTH_SERVICE_NAME}.timer"; then
  sudo systemctl is-active --quiet "${EXTERNAL_HEALTH_SERVICE_NAME}.timer"
  sudo systemctl start "${EXTERNAL_HEALTH_SERVICE_NAME}.service"
fi
if [ -f /etc/fiscalbay/duckdns.env ]; then
  sudo systemctl is-enabled --quiet fiscalbay-duckdns.timer
  sudo systemctl is-active --quiet fiscalbay-duckdns.timer
fi
if sudo systemctl list-units --failed --no-legend 'fiscalbay-*' | grep -q .; then
  sudo systemctl list-units --failed 'fiscalbay-*' --no-pager
  exit 1
fi
