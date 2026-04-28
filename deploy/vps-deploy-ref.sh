#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/fiscalbay}"
APP_USER="${APP_USER:-fiscalbay}"
APP_GROUP="${APP_GROUP:-${APP_USER}}"
REPO_URL="${FISCALBAY_RELEASE_REPO_URL:-max23468/FiscalBay}"
TARGET_BRANCH="${FISCALBAY_RELEASE_TARGET_BRANCH:-main}"
EXPECTED_HOSTNAME="${FISCALBAY_VPS_HOSTNAME:-fiscalbay-bot}"
REF="${1:-${TARGET_BRANCH}}"
GITHUB_AUTH_TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-${FISCALBAY_GITHUB_TOKEN:-}}}"

if [ "$(hostname)" != "${EXPECTED_HOSTNAME}" ]; then
  echo "Errore: host inatteso: $(hostname)." >&2
  exit 1
fi

if [ -z "${GITHUB_AUTH_TOKEN}" ]; then
  echo "Errore: token GitHub mancante." >&2
  exit 1
fi

archive="$(mktemp "/tmp/fiscalbay-${REF//\//-}.XXXXXX.tar.gz")"
cleanup() {
  rm -f "${archive}"
}
trap cleanup EXIT

echo "Scarico ${REPO_URL}@${REF}..."
curl -fsSL \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GITHUB_AUTH_TOKEN}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/${REPO_URL}/tarball/${REF}" \
  -o "${archive}"

echo "Estraggo ${REF} in ${APP_DIR}..."
mkdir -p "${APP_DIR}"
tar --warning=no-unknown-keyword --strip-components=1 -xzf "${archive}" -C "${APP_DIR}"
rm -rf "${APP_DIR}/.github/workflows" "${APP_DIR}/.github/dependabot.yml"
chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}"

APP_DIR="${APP_DIR}" APP_USER="${APP_USER}" APP_GROUP="${APP_GROUP}" bash "${APP_DIR}/deploy/install-vps.sh"
