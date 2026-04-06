#!/usr/bin/env bash
set -euo pipefail

APP_USER="ebaycf"
APP_GROUP="ebaycf"
APP_ROOT="/opt/ebay-cf"
APP_DIR="${APP_ROOT}/app"
VENV_DIR="${APP_ROOT}/venv"
DATA_DIR="${APP_ROOT}/data/runtime"
ENV_DIR="/etc/ebay-cf"
SERVICE_NAME="ebay-cf"
REPO_URL="${REPO_URL:-https://github.com/max23468/eBayCF.git}"

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

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  sudo useradd --system --create-home --home /var/lib/ebay-cf --shell /usr/sbin/nologin "${APP_USER}"
fi

sudo mkdir -p "${APP_ROOT}" "${ENV_DIR}" "${DATA_DIR}"
sudo chown -R "${APP_USER}:${APP_GROUP}" "${APP_ROOT}"

if [ ! -d "${APP_DIR}/.git" ]; then
  sudo -u "${APP_USER}" git clone "${REPO_URL}" "${APP_DIR}"
else
  sudo -u "${APP_USER}" git -C "${APP_DIR}" pull --ff-only
fi

if [ ! -d "${VENV_DIR}" ]; then
  sudo -u "${APP_USER}" python3 -m venv "${VENV_DIR}"
fi

sudo -u "${APP_USER}" "${VENV_DIR}/bin/pip" install --upgrade pip
sudo -u "${APP_USER}" "${VENV_DIR}/bin/pip" install -e "${APP_DIR}"

if [ ! -f "${ENV_DIR}/ebay-cf.env" ]; then
  sudo cp "${APP_DIR}/.env.example" "${ENV_DIR}/ebay-cf.env"
  sudo chown root:root "${ENV_DIR}/ebay-cf.env"
  sudo chmod 600 "${ENV_DIR}/ebay-cf.env"
  echo "Creato ${ENV_DIR}/ebay-cf.env. Compila il file prima di avviare il servizio."
fi

sudo cp "${APP_DIR}/deploy/ebay-cf.service" "/etc/systemd/system/${SERVICE_NAME}.service"
sudo systemctl daemon-reload

echo "Installazione completata."
echo "Prossimi passi:"
echo "1. Modifica ${ENV_DIR}/ebay-cf.env"
echo "2. Esegui: sudo systemctl enable --now ${SERVICE_NAME}"
echo "3. Controlla: sudo systemctl status ${SERVICE_NAME}"
echo "4. Log: sudo journalctl -u ${SERVICE_NAME} -f"
