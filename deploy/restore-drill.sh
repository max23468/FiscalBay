#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-${HOME}/maintenance-backups}"
BACKUP_DIR="${1:-}"

if [ -z "${BACKUP_DIR}" ]; then
  BACKUP_DIR="$(find "${BACKUP_ROOT}" -maxdepth 1 -mindepth 1 -type d -name '*-fiscalbay' 2>/dev/null | sort | tail -n 1)"
fi

if [ -z "${BACKUP_DIR}" ] || [ ! -d "${BACKUP_DIR}" ]; then
  echo "Nessun backup FiscalBay disponibile per il restore drill." >&2
  exit 1
fi

"${APP_DIR}/deploy/restore.sh" "${BACKUP_DIR}"

VERIFY_DIR="${APP_DIR}/data/restore-check/$(basename "${BACKUP_DIR}")"
if [ ! -f "${VERIFY_DIR}/MANIFEST.txt" ]; then
  echo "Restore drill fallito: MANIFEST.txt assente in ${VERIFY_DIR}." >&2
  exit 1
fi
if [ ! -f "${VERIFY_DIR}/runtime/.env" ] && [ ! -f "${VERIFY_DIR}/runtime/state.db" ]; then
  echo "Restore drill fallito: nessun asset runtime ripristinato in ${VERIFY_DIR}." >&2
  exit 1
fi

echo "Restore drill completato da ${BACKUP_DIR} verso ${VERIFY_DIR}"
