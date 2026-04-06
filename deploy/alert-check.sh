#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
HEALTHCHECK_BIN="${1:-${APP_DIR}/.venv/bin/ebay-cf-healthcheck}"
ENV_FILE="${2:-${APP_DIR}/.env}"
SERVICE_NAME="${SERVICE_NAME:-ebaycf-bot}"
MAX_CONSECUTIVE_ERROR_CYCLES="${MAX_CONSECUTIVE_ERROR_CYCLES:-3}"
MAX_RETRY_QUEUE_SIZE="${MAX_RETRY_QUEUE_SIZE:-20}"

set -a
source "${ENV_FILE}"
set +a

cd "${APP_DIR}"
"${HEALTHCHECK_BIN}" \
  --check-service-active \
  --service-name "${SERVICE_NAME}" \
  --max-consecutive-error-cycles "${MAX_CONSECUTIVE_ERROR_CYCLES}" \
  --max-retry-queue-size "${MAX_RETRY_QUEUE_SIZE}"
