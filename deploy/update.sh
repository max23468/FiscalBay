#!/usr/bin/env bash
set -euo pipefail

APP_USER="ebaycf"
APP_DIR="/opt/ebay-cf/app"
VENV_DIR="/opt/ebay-cf/venv"
SERVICE_NAME="ebay-cf"

sudo -u "${APP_USER}" git -C "${APP_DIR}" pull --ff-only
sudo -u "${APP_USER}" "${VENV_DIR}/bin/pip" install -e "${APP_DIR}"
sudo systemctl restart "${SERVICE_NAME}"
sudo systemctl is-active "${SERVICE_NAME}"
