#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

VPS_HOST="${FISCALBAY_VPS_HOST:-79.72.45.89}"
VPS_USER="${FISCALBAY_VPS_USER:-opc}"
VPS_PORT="${FISCALBAY_VPS_PORT:-22}"
EXPECTED_HOSTNAME="${FISCALBAY_VPS_HOSTNAME:-fiscalbay-bot}"
APP_DIR="${FISCALBAY_APP_DIR:-/opt/fiscalbay}"
APP_USER="${FISCALBAY_APP_USER:-fiscalbay}"
APP_GROUP="${FISCALBAY_APP_GROUP:-${APP_USER}}"
REF="HEAD"
SKIP_INSTALL=false
CHUNK_SIZE="${FISCALBAY_UPLOAD_CHUNK_SIZE:-20000}"

usage() {
  cat <<'EOF'
Usage: scripts/local_deploy_vps.sh [--ref REF] [--skip-install]

Deploys a local git archive to the FiscalBay VPS without GitHub Actions.
Only files committed in the selected git ref are deployed.

Environment overrides:
  FISCALBAY_VPS_HOST       default: 79.72.45.89
  FISCALBAY_VPS_USER       default: opc
  FISCALBAY_VPS_PORT       default: 22
  FISCALBAY_VPS_HOSTNAME   default: fiscalbay-bot
  FISCALBAY_APP_DIR        default: /opt/fiscalbay
  FISCALBAY_PYTHON_BIN     optional Python runtime for install-vps.sh
  FISCALBAY_RECREATE_VENV  set to 1 to recreate the remote .venv explicitly
  FISCALBAY_VENV_BACKUP_PATH optional backup path for the previous .venv
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --ref)
      REF="${2:?Missing value for --ref}"
      shift 2
      ;;
    --skip-install)
      SKIP_INSTALL=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

ssh_args=(
  -tt
  -o BatchMode=yes
  -o ConnectTimeout=10
  -o ServerAliveInterval=10
  -o ServerAliveCountMax=3
  -p "${VPS_PORT}"
  "${VPS_USER}@${VPS_HOST}"
)

remote_cmd() {
  ssh "${ssh_args[@]}" "$1"
}

quote_for_remote() {
  printf "%q" "$1"
}

remote_env_overrides=()
append_remote_env_if_set() {
  local name="$1"
  local value="${!name:-}"
  if [ -n "${value}" ]; then
    remote_env_overrides+=("${name}=$(quote_for_remote "${value}")")
  fi
}

append_remote_env_if_set FISCALBAY_PYTHON_BIN
append_remote_env_if_set FISCALBAY_RECREATE_VENV
append_remote_env_if_set FISCALBAY_VENV_BACKUP_PATH

remote_install_env_prefix=""
if [ "${#remote_env_overrides[@]}" -gt 0 ]; then
  remote_install_env_prefix="${remote_env_overrides[*]} "
fi

short_ref="$(git -C "${REPO_ROOT}" rev-parse --short "${REF}")"
tmpdir="$(mktemp -d)"
archive="${tmpdir}/fiscalbay-${short_ref}.tar.gz"
remote_archive="/tmp/fiscalbay-${short_ref}.tar.gz"
remote_b64="${remote_archive}.b64"
cleanup() {
  rm -rf "${tmpdir}"
}
trap cleanup EXIT

echo "Verifico VPS FiscalBay (${VPS_USER}@${VPS_HOST})..."
remote_cmd "test \"\$(hostname)\" = '${EXPECTED_HOSTNAME}' && printf 'hostname=%s\n' \"\$(hostname)\""

echo "Creo archivio git da ${REF} (${short_ref})..."
git -C "${REPO_ROOT}" archive --format=tar.gz -o "${archive}" "${REF}"

upload_with_chunks() {
  local b64_file="${tmpdir}/archive.b64"
  base64 < "${archive}" | tr -d '\n' > "${b64_file}"
  split -b "${CHUNK_SIZE}" -a 4 "${b64_file}" "${tmpdir}/chunk-"
  remote_cmd "rm -f '${remote_archive}' '${remote_b64}'; printf 'chunk-upload-ready\n'"
  for chunk_file in "${tmpdir}"/chunk-*; do
    chunk="$(cat "${chunk_file}")"
    remote_cmd "printf %s '${chunk}' >> '${remote_b64}'" >/dev/null
  done
  remote_cmd "base64 -d '${remote_b64}' > '${remote_archive}' && rm -f '${remote_b64}' && ls -lh '${remote_archive}'"
}

echo "Carico archivio sulla VPS..."
if ! scp \
  -o BatchMode=yes \
  -o ConnectTimeout=10 \
  -o ServerAliveInterval=10 \
  -o ServerAliveCountMax=3 \
  -P "${VPS_PORT}" \
  "${archive}" "${VPS_USER}@${VPS_HOST}:${remote_archive}"; then
  echo "Upload via scp non riuscito, uso fallback a chunk base64..."
  upload_with_chunks
fi

echo "Estraggo in ${APP_DIR}..."
remote_cmd "sudo mkdir -p '${APP_DIR}' && sudo tar --warning=no-unknown-keyword -xzf '${remote_archive}' -C '${APP_DIR}' && sudo chown -R '${APP_USER}:${APP_GROUP}' '${APP_DIR}'"
remote_cmd "sudo rm -rf '${APP_DIR}/.github/workflows' '${APP_DIR}/.github/dependabot.yml'"

if [ "${SKIP_INSTALL}" = true ]; then
  echo "Install/restart saltato (--skip-install)."
  exit 0
fi

echo "Installo, riavvio servizi e lancio smoke check sulla VPS..."
remote_cmd "sudo ${remote_install_env_prefix}APP_DIR=$(quote_for_remote "${APP_DIR}") APP_USER=$(quote_for_remote "${APP_USER}") APP_GROUP=$(quote_for_remote "${APP_GROUP}") bash $(quote_for_remote "${APP_DIR}/deploy/install-vps.sh")"
