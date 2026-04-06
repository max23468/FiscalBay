#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RECONCILE_BIN="${1:-${APP_DIR}/.venv/bin/ebay-cf-reconcile}"

cd "${APP_DIR}"
exec "${RECONCILE_BIN}"
