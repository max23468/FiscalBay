#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-ebaycf-bot}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_PATH="${VENV_PATH:-$PROJECT_DIR/.venv}"

cd "$PROJECT_DIR"

echo "[1/4] Pull ultimi aggiornamenti..."
git pull --ff-only

echo "[2/4] Attivo virtualenv..."
source "$VENV_PATH/bin/activate"

echo "[3/4] Eseguo test..."
python3 -m unittest discover -s tests

echo "[4/4] Riavvio servizio ${SERVICE_NAME}..."
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl status "$SERVICE_NAME" --no-pager

echo "Deploy completato."
