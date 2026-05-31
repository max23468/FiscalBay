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
PYTHON_BIN="${FISCALBAY_PYTHON_BIN:-${PYTHON_BIN:-}}"
PYTHON_BIN_WAS_REQUESTED=false
if [ -n "${PYTHON_BIN}" ]; then
  PYTHON_BIN_WAS_REQUESTED=true
fi
RECREATE_VENV="${FISCALBAY_RECREATE_VENV:-false}"
VENV_BACKUP_PATH="${FISCALBAY_VENV_BACKUP_PATH:-}"
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
RESTORE_DRILL_SERVICE_NAME="fiscalbay-restore-drill"
RESTORE_DRILL_SERVICE_TEMPLATE="${APP_DIR}/deploy/fiscalbay-restore-drill.service"
RESTORE_DRILL_SERVICE_TARGET="/etc/systemd/system/${RESTORE_DRILL_SERVICE_NAME}.service"
RESTORE_DRILL_TIMER_TEMPLATE="${APP_DIR}/deploy/fiscalbay-restore-drill.timer"
RESTORE_DRILL_TIMER_TARGET="/etc/systemd/system/${RESTORE_DRILL_SERVICE_NAME}.timer"
EXTERNAL_HEALTH_SERVICE_NAME="fiscalbay-external-healthcheck"
EXTERNAL_HEALTH_SERVICE_TEMPLATE="${APP_DIR}/deploy/fiscalbay-external-healthcheck.service"
EXTERNAL_HEALTH_SERVICE_TARGET="/etc/systemd/system/${EXTERNAL_HEALTH_SERVICE_NAME}.service"
EXTERNAL_HEALTH_TIMER_TEMPLATE="${APP_DIR}/deploy/fiscalbay-external-healthcheck.timer"
EXTERNAL_HEALTH_TIMER_TARGET="/etc/systemd/system/${EXTERNAL_HEALTH_SERVICE_NAME}.timer"
LOG_MAINTENANCE_SERVICE_NAME="fiscalbay-log-maintenance"
LOG_MAINTENANCE_SERVICE_TEMPLATE="${APP_DIR}/deploy/fiscalbay-log-maintenance.service"
LOG_MAINTENANCE_SERVICE_TARGET="/etc/systemd/system/${LOG_MAINTENANCE_SERVICE_NAME}.service"
LOG_MAINTENANCE_TIMER_TEMPLATE="${APP_DIR}/deploy/fiscalbay-log-maintenance.timer"
LOG_MAINTENANCE_TIMER_TARGET="/etc/systemd/system/${LOG_MAINTENANCE_SERVICE_NAME}.timer"
OAUTH_SERVICE_NAME="fiscalbay-oauth"
OAUTH_SERVICE_TEMPLATE="${APP_DIR}/deploy/fiscalbay-oauth.service"
OAUTH_SERVICE_TARGET="/etc/systemd/system/${OAUTH_SERVICE_NAME}.service"
DUCKDNS_SERVICE_NAME="fiscalbay-duckdns"
DUCKDNS_SERVICE_TEMPLATE="${APP_DIR}/deploy/fiscalbay-duckdns.service"
DUCKDNS_SERVICE_TARGET="/etc/systemd/system/${DUCKDNS_SERVICE_NAME}.service"
DUCKDNS_TIMER_TEMPLATE="${APP_DIR}/deploy/fiscalbay-duckdns.timer"
DUCKDNS_TIMER_TARGET="/etc/systemd/system/${DUCKDNS_SERVICE_NAME}.timer"
BOT_MEMORY_MAX="${FISCALBAY_BOT_MEMORY_MAX:-512M}"
BOT_CPU_QUOTA="${FISCALBAY_BOT_CPU_QUOTA:-60%}"
BOT_TASKS_MAX="${FISCALBAY_BOT_TASKS_MAX:-128}"
OAUTH_MEMORY_MAX="${FISCALBAY_OAUTH_MEMORY_MAX:-256M}"
OAUTH_CPU_QUOTA="${FISCALBAY_OAUTH_CPU_QUOTA:-40%}"
OAUTH_TASKS_MAX="${FISCALBAY_OAUTH_TASKS_MAX:-64}"
ONESHOT_MEMORY_MAX="${FISCALBAY_ONESHOT_MEMORY_MAX:-256M}"
ONESHOT_CPU_QUOTA="${FISCALBAY_ONESHOT_CPU_QUOTA:-50%}"
ONESHOT_TASKS_MAX="${FISCALBAY_ONESHOT_TASKS_MAX:-64}"

select_python_bin() {
  if [ -n "${PYTHON_BIN}" ] && command -v "${PYTHON_BIN}" >/dev/null 2>&1; then
    echo "${PYTHON_BIN}"
    return
  fi
  if [ -n "${PYTHON_BIN}" ]; then
    echo "Python runtime richiesto non trovato: ${PYTHON_BIN}" >&2
    exit 1
  fi

  for candidate in python3.13 python3; do
    if command -v "${candidate}" >/dev/null 2>&1; then
      echo "${candidate}"
      return
    fi
  done

  echo "python3"
}

is_truthy() {
  case "$1" in
    1|true|TRUE|yes|YES|y|Y)
      return 0
      ;;
    ""|0|false|FALSE|no|NO|n|N)
      return 1
      ;;
    *)
      echo "Valore booleano non valido: $1" >&2
      exit 1
      ;;
  esac
}

python_minor_version() {
  "$1" - <<'PY'
import sys

print(f"{sys.version_info.major}.{sys.version_info.minor}")
PY
}

ensure_supported_python() {
  local python_bin="$1"
  if ! "${python_bin}" - <<'PY'
import sys

raise SystemExit(0 if sys.version_info >= (3, 13) else 1)
PY
  then
    echo "Python runtime non supportato: $("${python_bin}" --version 2>&1). Serve Python >= 3.13." >&2
    exit 1
  fi
}

maybe_recreate_venv() {
  if ! is_truthy "${RECREATE_VENV}"; then
    return
  fi
  if [ ! -d "${VENV_DIR}" ]; then
    return
  fi

  local backup_path="${VENV_BACKUP_PATH}"
  if [ -z "${backup_path}" ]; then
    backup_path="${VENV_DIR}.backup.$(date +%Y%m%d%H%M%S)"
  fi
  if [ -e "${backup_path}" ]; then
    echo "Backup venv gia' presente: ${backup_path}" >&2
    exit 1
  fi

  echo "Ricreo virtualenv: sposto ${VENV_DIR} in ${backup_path}"
  sudo mv "${VENV_DIR}" "${backup_path}"
}

ensure_existing_venv_matches_requested_python() {
  if [ ! -x "${VENV_DIR}/bin/python" ]; then
    return
  fi
  if [ "${PYTHON_BIN_WAS_REQUESTED}" != true ]; then
    return
  fi
  if is_truthy "${RECREATE_VENV}"; then
    return
  fi

  local requested_minor
  local current_minor
  requested_minor="$(python_minor_version "${PYTHON_BIN}")"
  current_minor="$(python_minor_version "${VENV_DIR}/bin/python")"
  if [ "${requested_minor}" != "${current_minor}" ]; then
    echo "Il venv esistente usa Python ${current_minor}, ma e' stato richiesto Python ${requested_minor}." >&2
    echo "Usa FISCALBAY_RECREATE_VENV=1 per ricrearlo in modo esplicito." >&2
    exit 1
  fi
}

PYTHON_BIN="$(select_python_bin)"

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
    -e "s|__BOT_MEMORY_MAX__|${BOT_MEMORY_MAX}|g" \
    -e "s|__BOT_CPU_QUOTA__|${BOT_CPU_QUOTA}|g" \
    -e "s|__BOT_TASKS_MAX__|${BOT_TASKS_MAX}|g" \
    -e "s|__OAUTH_MEMORY_MAX__|${OAUTH_MEMORY_MAX}|g" \
    -e "s|__OAUTH_CPU_QUOTA__|${OAUTH_CPU_QUOTA}|g" \
    -e "s|__OAUTH_TASKS_MAX__|${OAUTH_TASKS_MAX}|g" \
    -e "s|__ONESHOT_MEMORY_MAX__|${ONESHOT_MEMORY_MAX}|g" \
    -e "s|__ONESHOT_CPU_QUOTA__|${ONESHOT_CPU_QUOTA}|g" \
    -e "s|__ONESHOT_TASKS_MAX__|${ONESHOT_TASKS_MAX}|g" \
    "${source_template}" > "${tmp_service}"
  sudo cp "${tmp_service}" "${destination_path}"
  rm -f "${tmp_service}"
}

install_packages
ensure_supported_python "${PYTHON_BIN}"
ensure_group
ensure_user

sudo mkdir -p "${DATA_DIR}"
sudo chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}"
sudo chmod 750 "${APP_DIR}"
sudo chmod 750 "${DATA_DIR}"

ensure_existing_venv_matches_requested_python
maybe_recreate_venv

if [ ! -d "${VENV_DIR}" ]; then
  sudo -u "${APP_USER}" "${PYTHON_BIN}" -m venv "${VENV_DIR}"
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
install_service_file "${RESTORE_DRILL_SERVICE_TEMPLATE}" "${RESTORE_DRILL_SERVICE_TARGET}"
install_service_file "${EXTERNAL_HEALTH_SERVICE_TEMPLATE}" "${EXTERNAL_HEALTH_SERVICE_TARGET}"
install_service_file "${LOG_MAINTENANCE_SERVICE_TEMPLATE}" "${LOG_MAINTENANCE_SERVICE_TARGET}"
sudo cp "${DUCKDNS_SERVICE_TEMPLATE}" "${DUCKDNS_SERVICE_TARGET}"
sudo cp "${BACKUP_TIMER_TEMPLATE}" "${BACKUP_TIMER_TARGET}"
sudo cp "${ALERT_TIMER_TEMPLATE}" "${ALERT_TIMER_TARGET}"
sudo cp "${RECONCILE_TIMER_TEMPLATE}" "${RECONCILE_TIMER_TARGET}"
sudo cp "${RESTORE_DRILL_TIMER_TEMPLATE}" "${RESTORE_DRILL_TIMER_TARGET}"
sudo cp "${EXTERNAL_HEALTH_TIMER_TEMPLATE}" "${EXTERNAL_HEALTH_TIMER_TARGET}"
sudo cp "${LOG_MAINTENANCE_TIMER_TEMPLATE}" "${LOG_MAINTENANCE_TIMER_TARGET}"
sudo cp "${DUCKDNS_TIMER_TEMPLATE}" "${DUCKDNS_TIMER_TARGET}"
sudo systemctl disable --now fiscalbay-release-please.timer >/dev/null 2>&1 || true
sudo rm -f \
  /etc/systemd/system/fiscalbay-release-please.service \
  /etc/systemd/system/fiscalbay-release-please.timer
sudo systemctl daemon-reload
sudo systemctl enable --now "${BACKUP_SERVICE_NAME}.timer"
sudo systemctl enable --now "${ALERT_SERVICE_NAME}.timer"
sudo systemctl enable --now "${RECONCILE_SERVICE_NAME}.timer"
sudo systemctl enable --now "${RESTORE_DRILL_SERVICE_NAME}.timer"
sudo systemctl enable --now "${EXTERNAL_HEALTH_SERVICE_NAME}.timer"
sudo systemctl enable --now "${LOG_MAINTENANCE_SERVICE_NAME}.timer"
if [ -f /etc/fiscalbay/duckdns.env ]; then
  sudo systemctl enable --now "${DUCKDNS_SERVICE_NAME}.timer"
else
  sudo systemctl disable --now "${DUCKDNS_SERVICE_NAME}.timer" >/dev/null 2>&1 || true
fi

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
echo "10. Verifica timer restore drill: sudo systemctl status ${RESTORE_DRILL_SERVICE_NAME}.timer"
echo "11. Verifica timer healthcheck esterno: sudo systemctl status ${EXTERNAL_HEALTH_SERVICE_NAME}.timer"
echo "12. Verifica timer log maintenance: sudo systemctl status ${LOG_MAINTENANCE_SERVICE_NAME}.timer"
echo "13. Verifica timer DuckDNS, se configurato: sudo systemctl status ${DUCKDNS_SERVICE_NAME}.timer"
echo "14. Release esplicita da Mac locale: scripts/release_now.sh"
echo
echo "Configurazione applicata:"
echo "- APP_USER=${APP_USER}"
echo "- APP_GROUP=${APP_GROUP}"
echo "- APP_DIR=${APP_DIR}"
echo "- PYTHON_BIN=${PYTHON_BIN}"
echo "- VENV_DIR=${VENV_DIR}"
echo "- BOT_MEMORY_MAX=${BOT_MEMORY_MAX}"
echo "- BOT_CPU_QUOTA=${BOT_CPU_QUOTA}"
echo "- OAUTH_MEMORY_MAX=${OAUTH_MEMORY_MAX}"
echo "- OAUTH_CPU_QUOTA=${OAUTH_CPU_QUOTA}"
