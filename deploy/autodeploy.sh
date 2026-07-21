#!/usr/bin/env bash
# Auto-deploy FiscalBay: confronta il SHA di main con quello attualmente
# deployato e, se e' cambiato, deploya via deploy/vps-deploy-ref.sh (che include
# lo smoke-check). Se il deploy del nuovo commit fallisce, esegue il ROLLBACK al
# commit precedente noto-buono. Pensato per essere eseguito da un timer systemd.
#
# Il repository e' pubblico: il polling del SHA e il download avvengono senza
# token. Se /etc/fiscalbay/deploy.env definisce un token viene comunque usato.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/fiscalbay}"
APP_USER="${APP_USER:-fiscalbay}"
APP_GROUP="${APP_GROUP:-${APP_USER}}"
REPO="${FISCALBAY_RELEASE_REPO_URL:-max23468/FiscalBay}"
BRANCH="${FISCALBAY_RELEASE_TARGET_BRANCH:-main}"
DEPLOY_ENV_FILE="${FISCALBAY_DEPLOY_ENV_FILE:-/etc/fiscalbay/deploy.env}"
STATE_DIR="${FISCALBAY_AUTODEPLOY_STATE_DIR:-/var/lib/fiscalbay-autodeploy}"
DEPLOYED_FILE="${STATE_DIR}/deployed_sha"
LOCK_FILE="/run/fiscalbay-autodeploy.lock"

log() { echo "[autodeploy] $*"; }

# Un solo deploy alla volta (il timer non deve accavallarsi a un deploy manuale
# lungo). Se il lock e' occupato, esce senza errore.
exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  log "deploy gia' in corso, salto questo giro"
  exit 0
fi

mkdir -p "${STATE_DIR}"

latest_sha="$(curl -fsSL -H "Accept: application/vnd.github.sha" \
  "https://api.github.com/repos/${REPO}/commits/${BRANCH}" || true)"
if ! printf '%s' "${latest_sha}" | grep -qE '^[0-9a-f]{40}$'; then
  log "SHA di ${BRANCH} non recuperato ('${latest_sha}'); riprovo al prossimo giro"
  exit 1
fi

deployed_sha="$(cat "${DEPLOYED_FILE}" 2>/dev/null || true)"

# Primo avvio senza stato: registra il commit corrente senza deployare (la box
# e' appena stata deployata a mano). Evita un redeploy inutile all'attivazione.
if [ -z "${deployed_sha}" ] && [ ! -f "${DEPLOYED_FILE}" ]; then
  log "primo avvio: registro ${latest_sha} come baseline senza deploy"
  printf '%s\n' "${latest_sha}" > "${DEPLOYED_FILE}"
  exit 0
fi

if [ "${latest_sha}" = "${deployed_sha}" ]; then
  log "gia' aggiornato (${latest_sha})"
  exit 0
fi

deploy_ref() {
  local ref="$1"
  (
    set -a
    # shellcheck disable=SC1090
    [ -f "${DEPLOY_ENV_FILE}" ] && . "${DEPLOY_ENV_FILE}"
    set +a
    export APP_DIR APP_USER APP_GROUP
    bash "${APP_DIR}/deploy/vps-deploy-ref.sh" "${ref}"
  )
}

log "nuovo commit ${latest_sha} (deployato: ${deployed_sha:-nessuno}); deploy..."
if deploy_ref "${latest_sha}"; then
  printf '%s\n' "${latest_sha}" > "${DEPLOYED_FILE}"
  log "deploy OK -> ${latest_sha}"
  exit 0
fi

log "DEPLOY FALLITO per ${latest_sha}" >&2
if [ -n "${deployed_sha}" ]; then
  log "rollback al commit precedente ${deployed_sha}..." >&2
  if deploy_ref "${deployed_sha}"; then
    log "rollback OK -> ${deployed_sha} (nuovo commit ${latest_sha} NON applicato)" >&2
  else
    log "ROLLBACK FALLITO: intervento manuale richiesto" >&2
  fi
fi
# Uscita non-zero: l'unita' systemd risultera' 'failed' e sara' visibile in
# `systemctl --failed` e nel journal.
exit 1
