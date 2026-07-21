#!/usr/bin/env bash
# Configura l'aggiornamento automatico completo dell'OS via dnf-automatic (RHEL/OL9).
# Idempotente: puo' essere rieseguito a ogni deploy senza effetti collaterali.
#
# - installa dnf-automatic se assente;
# - installa la config FiscalBay (tutti gli update, auto-reboot when-needed, best=0);
# - imposta la finestra notturna sul timer dnf-automatic;
# - abilita il timer dnf-automatic.
#
# L'auto-update NON gestisce il deploy dell'app FiscalBay: aggiorna solo l'OS.
# Lo shim libsqlite3 (deploy/linux-setup.sh) e preserve_hostname:true proteggono
# i servizi da un eventuale upgrade di Python o da un reboot automatico.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF_SRC="${SCRIPT_DIR}/fiscalbay-dnf-automatic.conf"
CONF_DST="/etc/dnf/automatic.conf"
TIMER_UNIT="dnf-automatic.timer"
TIMER_DROPIN_DIR="/etc/systemd/system/${TIMER_UNIT}.d"
# Finestra notturna a basso traffico per l'applicazione + eventuale reboot.
REBOOT_WINDOW="${FISCALBAY_AUTOUPDATE_TIME:-03:30}"

if [ "$(id -u)" -ne 0 ]; then
  echo "install-auto-updates.sh richiede root (usa sudo)." >&2
  exit 1
fi

if [ ! -f "${CONF_SRC}" ]; then
  echo "Config sorgente mancante: ${CONF_SRC}" >&2
  exit 1
fi

if ! rpm -q dnf-automatic >/dev/null 2>&1; then
  echo "[auto-updates] installo dnf-automatic"
  dnf install -y dnf-automatic
fi

echo "[auto-updates] installo ${CONF_DST}"
install -m 0644 "${CONF_SRC}" "${CONF_DST}"

echo "[auto-updates] imposto finestra notturna ${REBOOT_WINDOW} sul ${TIMER_UNIT}"
mkdir -p "${TIMER_DROPIN_DIR}"
cat > "${TIMER_DROPIN_DIR}/10-fiscalbay-window.conf" <<EOF
[Timer]
OnCalendar=
OnCalendar=*-*-* ${REBOOT_WINDOW}:00
RandomizedDelaySec=1200
Persistent=true
EOF

systemctl daemon-reload
systemctl enable --now "${TIMER_UNIT}"

echo "[auto-updates] configurato. Prossimo run:"
systemctl list-timers "${TIMER_UNIT}" --all --no-pager | grep dnf-automatic || true
