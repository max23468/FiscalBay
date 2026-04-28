#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/fiscalbay}"
APP_USER="${APP_USER:-fiscalbay}"
APP_GROUP="${APP_GROUP:-${APP_USER}}"
SERVICE_NAME="${SERVICE_NAME:-fiscalbay-bot}"
OAUTH_SERVICE_NAME="${OAUTH_SERVICE_NAME:-fiscalbay-oauth}"
BACKUP_TIMER_NAME="${BACKUP_TIMER_NAME:-fiscalbay-backup.timer}"
ALERT_TIMER_NAME="${ALERT_TIMER_NAME:-fiscalbay-alertcheck.timer}"
RECONCILE_TIMER_NAME="${RECONCILE_TIMER_NAME:-fiscalbay-reconcile.timer}"
DUCKDNS_TIMER_NAME="${DUCKDNS_TIMER_NAME:-fiscalbay-duckdns.timer}"

bash "${APP_DIR}/deploy/linux-setup.sh"

sudo systemctl restart "${SERVICE_NAME}"
sudo systemctl is-active "${SERVICE_NAME}"

if sudo systemctl is-enabled --quiet "${OAUTH_SERVICE_NAME}"; then
  sudo systemctl restart "${OAUTH_SERVICE_NAME}"
  sudo systemctl is-active "${OAUTH_SERVICE_NAME}"
fi

sudo systemctl status "${SERVICE_NAME}" --no-pager
sudo systemctl status "${BACKUP_TIMER_NAME}" --no-pager
sudo systemctl status "${ALERT_TIMER_NAME}" --no-pager
sudo systemctl status "${RECONCILE_TIMER_NAME}" --no-pager
if [ -f /etc/fiscalbay/duckdns.env ]; then
  sudo systemctl status "${DUCKDNS_TIMER_NAME}" --no-pager
fi

bash "${APP_DIR}/deploy/smoke-check.sh" "${SERVICE_NAME}" "${APP_DIR}/.venv/bin/fiscalbay-healthcheck" "${APP_DIR}/.env" "${OAUTH_SERVICE_NAME}"
