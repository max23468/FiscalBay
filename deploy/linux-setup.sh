#!/usr/bin/env bash
set -euo pipefail

APP_USER="opc"
APP_GROUP="opc"
APP_DIR="/home/opc/eBay CF"
VENV_DIR="${APP_DIR}/.venv"
DATA_DIR="${APP_DIR}/data"
ENV_FILE="${APP_DIR}/.env"
SERVICE_NAME="ebaycf-bot"

install_packages() {
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y python3 python3-venv python3-pip git
    return
  fi
  if command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y python3 python3-pip git
    return
  fi
  if command -v yum >/dev/null 2>&1; then
    sudo yum install -y python3 python3-pip git
    return
  fi
  if command -v apk >/dev/null 2>&1; then
    sudo apk add --no-cache python3 py3-pip git
    return
  fi
  echo "Package manager non supportato automaticamente. Installa manualmente python3, pip e git." >&2
  exit 1
}

install_packages

sudo mkdir -p "${DATA_DIR}"
sudo chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}"

if [ ! -d "${VENV_DIR}" ]; then
  sudo -u "${APP_USER}" python3 -m venv "${VENV_DIR}"
fi

sudo -u "${APP_USER}" "${VENV_DIR}/bin/pip" install --upgrade pip
sudo -u "${APP_USER}" "${VENV_DIR}/bin/pip" install -e "${APP_DIR}"

if [ ! -f "${ENV_FILE}" ]; then
  cp "${APP_DIR}/.env.example" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  echo "Creato ${ENV_FILE}. Compila il file prima di avviare il servizio."
fi

sudo cp "${APP_DIR}/deploy/ebaycf-bot.service" "/etc/systemd/system/${SERVICE_NAME}.service"
sudo systemctl daemon-reload

echo "Installazione completata."
echo "Prossimi passi:"
echo "1. Modifica ${ENV_FILE}"
echo "2. Esegui: sudo systemctl enable --now ${SERVICE_NAME}"
echo "3. Controlla: sudo systemctl status ${SERVICE_NAME}"
echo "4. Log: sudo journalctl -u ${SERVICE_NAME} -f"
