#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${1:-ebaycf-bot}"
HEALTHCHECK_BIN="${2:-/home/opc/eBay CF/.venv/bin/ebay-cf-healthcheck}"

sudo systemctl is-active --quiet "${SERVICE_NAME}"
"${HEALTHCHECK_BIN}"
