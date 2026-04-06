#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SERVICE_NAME="${1:-ebaycf-bot}"
HEALTHCHECK_BIN="${2:-${APP_DIR}/.venv/bin/ebay-cf-healthcheck}"
ENV_FILE="${3:-${APP_DIR}/.env}"
OAUTH_SERVICE_NAME="${4:-ebaycf-oauth}"

sudo systemctl is-active --quiet "${SERVICE_NAME}"
set -a
source "${ENV_FILE}"
set +a
cd "${APP_DIR}"
"${HEALTHCHECK_BIN}"
if sudo systemctl is-enabled --quiet "${OAUTH_SERVICE_NAME}"; then
  sudo systemctl is-active --quiet "${OAUTH_SERVICE_NAME}"
fi
