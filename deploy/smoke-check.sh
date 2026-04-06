#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${1:-ebay-cf}"
HEALTHCHECK_BIN="${2:-/opt/ebay-cf/venv/bin/ebay-cf-healthcheck}"

sudo systemctl is-active --quiet "${SERVICE_NAME}"
"${HEALTHCHECK_BIN}"
