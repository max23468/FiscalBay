#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/fiscalbay}"
APP_USER="${APP_USER:-fiscalbay}"
APP_GROUP="${APP_GROUP:-${APP_USER}}"
REPO_URL="${FISCALBAY_RELEASE_REPO_URL:-max23468/FiscalBay}"
TARGET_BRANCH="${FISCALBAY_RELEASE_TARGET_BRANCH:-main}"
EXPECTED_HOSTNAME="${FISCALBAY_VPS_HOSTNAME:-fiscalbay-bot}"
LOCK_FILE="${FISCALBAY_DEPLOY_LOCK_FILE:-/run/fiscalbay-deploy.lock}"
STATE_DIR="${FISCALBAY_AUTODEPLOY_STATE_DIR:-/var/lib/fiscalbay-autodeploy}"
DEPLOYED_FILE="${STATE_DIR}/deployed_sha"
DEPLOYED_MARKER="${APP_DIR}/.fiscalbay-deployed-sha"
REF="${1:-${TARGET_BRANCH}}"
GITHUB_AUTH_TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-${FISCALBAY_GITHUB_TOKEN:-}}}"

if [ "$(hostname)" != "${EXPECTED_HOSTNAME}" ]; then
  echo "Errore: host inatteso: $(hostname)." >&2
  exit 1
fi

if [ -z "${FISCALBAY_DEPLOY_LOCK_FD:-}" ]; then
  exec 9>"${LOCK_FILE}"
  FISCALBAY_DEPLOY_LOCK_FD=9
fi
echo "Attendo il lock deploy ${LOCK_FILE}..."
flock "${FISCALBAY_DEPLOY_LOCK_FD}"

# Il repository e' pubblico: il token e' opzionale (serve solo per alzare i
# rate limit o se il repo diventasse privato). L'auto-deploy sul VPS puo' quindi
# girare senza secret. Aggiungiamo l'header Authorization solo se presente.
curl_auth=()
if [ -n "${GITHUB_AUTH_TOKEN}" ]; then
  curl_auth=(-H "Authorization: Bearer ${GITHUB_AUTH_TOKEN}")
fi

deploy_sha="$(curl -fsSL \
  -H "Accept: application/vnd.github.sha" \
  "${curl_auth[@]}" \
  "https://api.github.com/repos/${REPO_URL}/commits/${REF}" || true)"
if ! printf '%s' "${deploy_sha}" | grep -qE '^[0-9a-f]{40}$'; then
  echo "Errore: SHA non recuperato per ${REPO_URL}@${REF}." >&2
  exit 1
fi

archive="$(mktemp "/tmp/fiscalbay-${deploy_sha}.XXXXXX.tar.gz")"
cleanup() {
  rm -f "${archive}"
}
trap cleanup EXIT

echo "Scarico ${REPO_URL}@${REF} (${deploy_sha})..."
curl -fsSL \
  -H "Accept: application/vnd.github+json" \
  "${curl_auth[@]}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/${REPO_URL}/tarball/${deploy_sha}" \
  -o "${archive}"

echo "Estraggo ${deploy_sha} in ${APP_DIR}..."
mkdir -p "${APP_DIR}"
tar --warning=no-unknown-keyword --strip-components=1 -xzf "${archive}" -C "${APP_DIR}"
rm -rf "${APP_DIR}/.github/workflows" "${APP_DIR}/.github/dependabot.yml"
chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}"

export APP_DIR APP_USER APP_GROUP
bash "${APP_DIR}/deploy/install-vps.sh"

mkdir -p "${STATE_DIR}"
printf '%s\n' "${deploy_sha}" > "${DEPLOYED_FILE}.tmp"
mv "${DEPLOYED_FILE}.tmp" "${DEPLOYED_FILE}"
printf '%s\n' "${deploy_sha}" > "${DEPLOYED_MARKER}.tmp"
mv "${DEPLOYED_MARKER}.tmp" "${DEPLOYED_MARKER}"
