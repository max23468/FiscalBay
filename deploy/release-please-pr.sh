#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"

REPO_URL="${FISCALBAY_RELEASE_REPO_URL:-max23468/FiscalBay}"
TARGET_BRANCH="${FISCALBAY_RELEASE_TARGET_BRANCH:-main}"
CONFIG_FILE="${FISCALBAY_RELEASE_CONFIG_FILE:-release-please-config.json}"
MANIFEST_FILE="${FISCALBAY_RELEASE_MANIFEST_FILE:-.release-please-manifest.json}"
RELEASE_PLEASE_PACKAGE="${FISCALBAY_RELEASE_PLEASE_PACKAGE:-release-please@17.6.0}"
DRY_RUN="${FISCALBAY_RELEASE_DRY_RUN:-false}"
SKIP_LABELING="${FISCALBAY_RELEASE_SKIP_LABELING:-false}"
DEBUG="${FISCALBAY_RELEASE_DEBUG:-false}"
AUTO_MERGE="${FISCALBAY_RELEASE_AUTO_MERGE:-true}"
AUTO_GITHUB_RELEASE="${FISCALBAY_RELEASE_AUTO_GITHUB_RELEASE:-true}"
AUTO_DEPLOY="${FISCALBAY_RELEASE_AUTO_DEPLOY:-true}"

GITHUB_AUTH_TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-${FISCALBAY_GITHUB_TOKEN:-}}}"

if [ -z "${GITHUB_AUTH_TOKEN}" ]; then
  cat >&2 <<'EOF'
Errore: token GitHub mancante.
Configura GITHUB_TOKEN, GH_TOKEN o FISCALBAY_GITHUB_TOKEN nell'EnvironmentFile
del servizio systemd, ad esempio /etc/fiscalbay/release-please.env.
EOF
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "Errore: npx non trovato. Installa nodejs/npm sulla VPS." >&2
  exit 1
fi

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)"
if [ "${NODE_MAJOR}" -lt 20 ]; then
  echo "Errore: release-please richiede Node.js >=20; versione corrente: $(node --version 2>/dev/null || echo n/d)." >&2
  exit 1
fi

cd "${APP_DIR}"

if [ ! -f "${CONFIG_FILE}" ]; then
  echo "Errore: ${CONFIG_FILE} non trovato in ${APP_DIR}." >&2
  exit 1
fi

if [ ! -f "${MANIFEST_FILE}" ]; then
  echo "Errore: ${MANIFEST_FILE} non trovato in ${APP_DIR}." >&2
  exit 1
fi

if [ -d ".github/workflows" ] && find ".github/workflows" -type f | grep -q .; then
  echo "Errore: workflow GitHub Actions versionati rilevati; policy repository violata." >&2
  exit 1
fi

args=(
  --yes
  "${RELEASE_PLEASE_PACKAGE}"
  release-pr
  --repo-url="${REPO_URL}"
  --target-branch="${TARGET_BRANCH}"
  --config-file="${CONFIG_FILE}"
  --manifest-file="${MANIFEST_FILE}"
)

if [ "${DRY_RUN}" = "true" ]; then
  args+=(--dry-run)
fi

if [ "${SKIP_LABELING}" = "true" ]; then
  args+=(--skip-labeling)
fi

if [ "${DEBUG}" = "true" ]; then
  args+=(--debug)
fi

echo "Eseguo release-please release-pr su ${REPO_URL}:${TARGET_BRANCH}..."
npx "${args[@]}" --token="${GITHUB_AUTH_TOKEN}"

if [ "${AUTO_MERGE}" != "true" ]; then
  echo "Merge automatico disabilitato."
  exit 0
fi

echo "Valido e mergeo eventuale Release PR..."
merge_result="$("${APP_DIR}/deploy/github-release-pr.py")"
echo "${merge_result}"

if ! printf '%s\n' "${merge_result}" | grep -q '"status": "merged"'; then
  echo "Nessuna Release PR mergiata: salto pubblicazione e deploy."
  exit 0
fi

if [ "${DRY_RUN}" = "true" ]; then
  echo "Dry run: salto github-release e deploy."
  exit 0
fi

if [ "${AUTO_GITHUB_RELEASE}" = "true" ]; then
  echo "Creo tag e GitHub Release con release-please..."
  npx \
    --yes \
    "${RELEASE_PLEASE_PACKAGE}" \
    github-release \
    --repo-url="${REPO_URL}" \
    --target-branch="${TARGET_BRANCH}" \
    --config-file="${CONFIG_FILE}" \
    --manifest-file="${MANIFEST_FILE}" \
    --token="${GITHUB_AUTH_TOKEN}"
else
  echo "Creazione tag/GitHub Release disabilitata."
fi

if [ "${AUTO_DEPLOY}" = "true" ]; then
  echo "Deploy automatico del main aggiornato sulla VPS..."
  "${APP_DIR}/deploy/vps-deploy-ref.sh" "${TARGET_BRANCH}"
else
  echo "Deploy automatico disabilitato."
fi
