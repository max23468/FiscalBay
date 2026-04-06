#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
APP_USER="${APP_USER:-$(stat -c '%U' "${APP_DIR}")}"
VENV_DIR="${APP_DIR}/.venv"
SERVICE_NAME="ebaycf-bot"
OAUTH_SERVICE_NAME="ebaycf-oauth"

sudo -u "${APP_USER}" git -C "${APP_DIR}" pull --ff-only
sudo -u "${APP_USER}" "${VENV_DIR}/bin/pip" install -e "${APP_DIR}"
sudo systemctl restart "${SERVICE_NAME}"
sudo systemctl is-active "${SERVICE_NAME}"
if sudo systemctl is-enabled --quiet "${OAUTH_SERVICE_NAME}"; then
  sudo systemctl restart "${OAUTH_SERVICE_NAME}"
  sudo systemctl is-active "${OAUTH_SERVICE_NAME}"
fi
