#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
HEALTHCHECK_BIN="${1:-${APP_DIR}/.venv/bin/fiscalbay-healthcheck}"
ENV_FILE="${2:-${APP_DIR}/.env}"
SERVICE_NAME="${SERVICE_NAME:-fiscalbay-bot}"
MAX_CONSECUTIVE_ERROR_CYCLES="${MAX_CONSECUTIVE_ERROR_CYCLES:-3}"
MAX_RETRY_QUEUE_SIZE="${MAX_RETRY_QUEUE_SIZE:-20}"
MAX_DISK_USED_PERCENT="${MAX_DISK_USED_PERCENT:-85}"
MAX_INODE_USED_PERCENT="${MAX_INODE_USED_PERCENT:-85}"
MIN_MEMORY_AVAILABLE_MB="${MIN_MEMORY_AVAILABLE_MB:-128}"
RESOURCE_PATH="${RESOURCE_PATH:-${APP_DIR}}"

set -a
source "${ENV_FILE}"
set +a

cd "${APP_DIR}"
"${HEALTHCHECK_BIN}" \
  --check-service-active \
  --service-name "${SERVICE_NAME}" \
  --max-consecutive-error-cycles "${MAX_CONSECUTIVE_ERROR_CYCLES}" \
  --max-retry-queue-size "${MAX_RETRY_QUEUE_SIZE}" \
  --max-disk-used-percent "${MAX_DISK_USED_PERCENT}" \
  --max-inode-used-percent "${MAX_INODE_USED_PERCENT}" \
  --min-memory-available-mb "${MIN_MEMORY_AVAILABLE_MB}" \
  --resource-path "${RESOURCE_PATH}"
