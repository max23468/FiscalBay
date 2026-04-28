#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${APP_DIR}/.env}"

echo "FiscalBay service inventory"
echo "generated_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "app_dir=${APP_DIR}"
echo "hostname=$(hostname 2>/dev/null || echo unknown)"
echo "user=$(id -un 2>/dev/null || echo unknown)"
echo

echo "[git]"
if command -v git >/dev/null 2>&1 && git -C "${APP_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "branch=$(git -C "${APP_DIR}" branch --show-current 2>/dev/null || echo unknown)"
  echo "commit=$(git -C "${APP_DIR}" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  echo "dirty=$(git -C "${APP_DIR}" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
else
  echo "git=unavailable"
fi
echo

echo "[env_keys]"
if [ -f "${ENV_FILE}" ]; then
  grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "${ENV_FILE}" | cut -d= -f1 | sort
else
  echo "env_file=missing"
fi
echo

echo "[systemd]"
if command -v systemctl >/dev/null 2>&1; then
  systemctl list-units 'fiscalbay-*' --all --no-pager --no-legend || true
  echo
  systemctl list-timers 'fiscalbay-*' --all --no-pager --no-legend || true
else
  echo "systemctl=unavailable"
fi
echo

echo "[resources]"
df -h "${APP_DIR}" 2>/dev/null || true
df -ih "${APP_DIR}" 2>/dev/null || true
free -m 2>/dev/null || true
