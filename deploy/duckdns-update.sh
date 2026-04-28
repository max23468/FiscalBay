#!/usr/bin/env bash
set -euo pipefail

DUCKDNS_DOMAIN="${DUCKDNS_DOMAIN:-}"
DUCKDNS_TOKEN="${DUCKDNS_TOKEN:-}"
DUCKDNS_IP="${DUCKDNS_IP:-}"

if [ -z "${DUCKDNS_DOMAIN}" ]; then
  echo "Variabile ambiente mancante: DUCKDNS_DOMAIN" >&2
  exit 1
fi

if [ -z "${DUCKDNS_TOKEN}" ]; then
  echo "Variabile ambiente mancante: DUCKDNS_TOKEN" >&2
  exit 1
fi

curl_args=(
  -fsS
  --get
  --data-urlencode "domains=${DUCKDNS_DOMAIN}"
  --data-urlencode "token=${DUCKDNS_TOKEN}"
)

if [ -n "${DUCKDNS_IP}" ]; then
  curl_args+=(--data-urlencode "ip=${DUCKDNS_IP}")
fi

response="$(curl "${curl_args[@]}" https://www.duckdns.org/update)"

if [ "${response}" != "OK" ]; then
  echo "Duck DNS update fallito: ${response}" >&2
  exit 1
fi

echo "Duck DNS aggiornato per ${DUCKDNS_DOMAIN}"
