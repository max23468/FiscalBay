#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${APP_DIR}/.env}"
TLS_MIN_DAYS_VALID="${TLS_MIN_DAYS_VALID:-14}"
CURL_TIMEOUT_SECONDS="${CURL_TIMEOUT_SECONDS:-10}"
ALLOW_HTTP_HEALTHCHECK="${ALLOW_HTTP_HEALTHCHECK:-0}"

if [ -f "${ENV_FILE}" ]; then
  set -a
  source "${ENV_FILE}"
  set +a
fi

HEALTH_URL="${FISCALBAY_PUBLIC_HEALTH_URL:-${FISCALBAY_EXTERNAL_HEALTH_URL:-}}"
if [ -z "${HEALTH_URL}" ] && [ -n "${EBAY_OAUTH_CALLBACK_URL:-}" ]; then
  CALLBACK_ORIGIN="$(printf '%s\n' "${EBAY_OAUTH_CALLBACK_URL}" | sed -E 's#^(https?://[^/]+).*#\1#')"
  HEALTH_URL="${CALLBACK_ORIGIN%/}/healthz"
fi

if [ -z "${HEALTH_URL}" ]; then
  echo "External healthcheck saltato: configura FISCALBAY_PUBLIC_HEALTH_URL o EBAY_OAUTH_CALLBACK_URL."
  exit 0
fi

if [[ "${HEALTH_URL}" != https://* ]]; then
  if [ "${ALLOW_HTTP_HEALTHCHECK}" != "1" ]; then
    echo "External healthcheck richiede HTTPS: ${HEALTH_URL}" >&2
    exit 1
  fi
else
  if ! command -v openssl >/dev/null 2>&1; then
    echo "openssl non disponibile per il controllo TLS." >&2
    exit 1
  fi
  TLS_HOST="$(printf '%s\n' "${HEALTH_URL}" | sed -E 's#^https://([^/:]+).*#\1#')"
  TLS_PORT="$(printf '%s\n' "${HEALTH_URL}" | sed -nE 's#^https://[^/:]+:([0-9]+).*#\1#p')"
  TLS_PORT="${TLS_PORT:-443}"
  if ! openssl s_client -connect "${TLS_HOST}:${TLS_PORT}" -servername "${TLS_HOST}" </dev/null 2>/dev/null \
    | openssl x509 -checkend "$((TLS_MIN_DAYS_VALID * 86400))" -noout >/dev/null; then
    echo "Certificato TLS non valido o in scadenza entro ${TLS_MIN_DAYS_VALID} giorni per ${TLS_HOST}." >&2
    exit 1
  fi
fi

curl --fail --silent --show-error --max-time "${CURL_TIMEOUT_SECONDS}" "${HEALTH_URL}" >/dev/null
echo "External healthcheck OK: ${HEALTH_URL}"
