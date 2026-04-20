#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

APP_USER="${APP_USER:-fiscalbay}"
APP_GROUP="${APP_GROUP:-${APP_USER}}"
APP_DIR="${APP_DIR:-${REPO_DIR}}"
VENV_DIR="${APP_DIR}/.venv"
DATA_DIR="${APP_DIR}/data"
ENV_FILE="${APP_DIR}/.env"
SERVICE_NAME="fiscalbay-bot"
SERVICE_TEMPLATE="${APP_DIR}/deploy/fiscalbay-bot.service"
SERVICE_TARGET="/etc/systemd/system/${SERVICE_NAME}.service"
BACKUP_SERVICE_NAME="fiscalbay-backup"
BACKUP_SERVICE_TEMPLATE="${APP_DIR}/deploy/fiscalbay-backup.service"
BACKUP_SERVICE_TARGET="/etc/systemd/system/${BACKUP_SERVICE_NAME}.service"
BACKUP_TIMER_TEMPLATE="${APP_DIR}/deploy/fiscalbay-backup.timer"
BACKUP_TIMER_TARGET="/etc/systemd/system/${BACKUP_SERVICE_NAME}.timer"
ALERT_SERVICE_NAME="fiscalbay-alertcheck"
ALERT_SERVICE_TEMPLATE="${APP_DIR}/deploy/fiscalbay-alertcheck.service"
ALERT_SERVICE_TARGET="/etc/systemd/system/${ALERT_SERVICE_NAME}.service"
ALERT_TIMER_TEMPLATE="${APP_DIR}/deploy/fiscalbay-alertcheck.timer"
ALERT_TIMER_TARGET="/etc/systemd/system/${ALERT_SERVICE_NAME}.timer"
RECONCILE_SERVICE_NAME="fiscalbay-reconcile"
RECONCILE_SERVICE_TEMPLATE="${APP_DIR}/deploy/fiscalbay-reconcile.service"
RECONCILE_SERVICE_TARGET="/etc/systemd/system/${RECONCILE_SERVICE_NAME}.service"
RECONCILE_TIMER_TEMPLATE="${APP_DIR}/deploy/fiscalbay-reconcile.timer"
RECONCILE_TIMER_TARGET="/etc/systemd/system/${RECONCILE_SERVICE_NAME}.timer"
OAUTH_SERVICE_NAME="fiscalbay-oauth"
OAUTH_SERVICE_TEMPLATE="${APP_DIR}/deploy/fiscalbay-oauth.service"
OAUTH_SERVICE_TARGET="/etc/systemd/system/${OAUTH_SERVICE_NAME}.service"

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

ensure_group() {
  if getent group "${APP_GROUP}" >/dev/null 2>&1; then
    return
  fi
  sudo groupadd --system "${APP_GROUP}"
}

ensure_user() {
  if id -u "${APP_USER}" >/dev/null 2>&1; then
    return
  fi
  sudo useradd \
    --system \
    --gid "${APP_GROUP}" \
    --create-home \
    --home-dir "/home/${APP_USER}" \
    --shell /usr/sbin/nologin \
    "${APP_USER}"
}

install_service_file() {
  local source_template="$1"
  local destination_path="$2"
  local tmp_service
  tmp_service="$(mktemp)"
  sed \
    -e "s|__APP_USER__|${APP_USER}|g" \
    -e "s|__APP_GROUP__|${APP_GROUP}|g" \
    -e "s|__APP_DIR__|${APP_DIR}|g" \
    -e "s|__VENV_DIR__|${VENV_DIR}|g" \
    -e "s|__ENV_FILE__|${ENV_FILE}|g" \
    "${source_template}" > "${tmp_service}"
  sudo cp "${tmp_service}" "${destination_path}"
  rm -f "${tmp_service}"
}

install_packages
ensure_group
ensure_user

sudo mkdir -p "${DATA_DIR}"
sudo chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}"
sudo chmod 750 "${APP_DIR}"
sudo chmod 750 "${DATA_DIR}"

if [ ! -d "${VENV_DIR}" ]; then
  sudo -u "${APP_USER}" python3 -m venv "${VENV_DIR}"
fi

sudo -u "${APP_USER}" "${VENV_DIR}/bin/pip" install --upgrade pip
sudo -u "${APP_USER}" "${VENV_DIR}/bin/pip" install -e "${APP_DIR}"

if [ ! -f "${ENV_FILE}" ]; then
  sudo cp "${APP_DIR}/.env.example" "${ENV_FILE}"
  echo "Creato ${ENV_FILE}. Compila il file prima di avviare il servizio."
fi
sudo chown "${APP_USER}:${APP_GROUP}" "${ENV_FILE}"
sudo chmod 600 "${ENV_FILE}"

install_service_file "${SERVICE_TEMPLATE}" "${SERVICE_TARGET}"
install_service_file "${OAUTH_SERVICE_TEMPLATE}" "${OAUTH_SERVICE_TARGET}"
install_service_file "${BACKUP_SERVICE_TEMPLATE}" "${BACKUP_SERVICE_TARGET}"
install_service_file "${ALERT_SERVICE_TEMPLATE}" "${ALERT_SERVICE_TARGET}"
install_service_file "${RECONCILE_SERVICE_TEMPLATE}" "${RECONCILE_SERVICE_TARGET}"
sudo cp "${BACKUP_TIMER_TEMPLATE}" "${BACKUP_TIMER_TARGET}"
sudo cp "${ALERT_TIMER_TEMPLATE}" "${ALERT_TIMER_TARGET}"
sudo cp "${RECONCILE_TIMER_TEMPLATE}" "${RECONCILE_TIMER_TARGET}"
sudo systemctl daemon-reload
sudo systemctl enable --now "${BACKUP_SERVICE_NAME}.timer"
sudo systemctl enable --now "${ALERT_SERVICE_NAME}.timer"
sudo systemctl enable --now "${RECONCILE_SERVICE_NAME}.timer"

echo "Installazione completata."
echo "Prossimi passi:"
echo "1. Modifica ${ENV_FILE}"
echo "2. Esegui: sudo systemctl enable --now ${SERVICE_NAME}"
echo "3. Esegui: sudo systemctl enable --now ${OAUTH_SERVICE_NAME} (se hai un callback pubblico)"
echo "4. Controlla: sudo systemctl status ${SERVICE_NAME}"
echo "5. Log bot: sudo journalctl -u ${SERVICE_NAME} -f"
echo "6. Log OAuth: sudo journalctl -u ${OAUTH_SERVICE_NAME} -f"
echo "7. Verifica timer backup: sudo systemctl status ${BACKUP_SERVICE_NAME}.timer"
echo "8. Verifica timer alert: sudo systemctl status ${ALERT_SERVICE_NAME}.timer"
echo "9. Verifica timer reconcile: sudo systemctl status ${RECONCILE_SERVICE_NAME}.timer"
echo
echo "Configurazione applicata:"
echo "- APP_USER=${APP_USER}"
echo "- APP_GROUP=${APP_GROUP}"
echo "- APP_DIR=${APP_DIR}"
