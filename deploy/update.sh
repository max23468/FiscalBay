#!/usr/bin/env bash
set -euo pipefail

APP_USER="opc"
APP_DIR="/home/opc/eBay CF"
VENV_DIR="/home/opc/eBay CF/.venv"
SERVICE_NAME="ebaycf-bot"

sudo -u "${APP_USER}" git -C "${APP_DIR}" pull --ff-only
sudo -u "${APP_USER}" "${VENV_DIR}/bin/pip" install -e "${APP_DIR}"
sudo systemctl restart "${SERVICE_NAME}"
sudo systemctl is-active "${SERVICE_NAME}"
