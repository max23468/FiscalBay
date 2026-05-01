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
DEPLOY_ENV_FILE="${FISCALBAY_DEPLOY_ENV_FILE:-/etc/fiscalbay/deploy.env}"

REF=""
RUN_CI=true
RUN_PUSH=true
DRY_RUN=false

usage() {
  cat <<'EOF'
Usage: scripts/deploy_now.sh [--ref REF] [--skip-ci] [--skip-push] [--dry-run]

Deploys an already committed FiscalBay ref to the production VPS.

Default behavior:
  1. verifies only the allowlisted lightweight CI workflow is present
  2. requires a clean working tree
  3. runs local CI checks
  4. pushes the current branch
  5. verifies the VPS hostname
  6. runs deploy/vps-deploy-ref.sh on the VPS and waits for its smoke check

The production VPS defaults to opc@79.72.45.89 and must answer fiscalbay-bot.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --ref)
      REF="${2:?Missing value for --ref}"
      shift 2
      ;;
    --skip-ci)
      RUN_CI=false
      shift
      ;;
    --skip-push)
      RUN_PUSH=false
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      RUN_CI=false
      RUN_PUSH=false
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

cd "${REPO_ROOT}"

bash scripts/check_github_workflows.sh

branch="$(git branch --show-current)"
if [ -z "${REF}" ]; then
  if [ -n "${branch}" ]; then
    REF="${branch}"
  else
    REF="$(git rev-parse HEAD)"
  fi
fi

if [ "${DRY_RUN}" != true ] && [ -n "$(git status --porcelain)" ]; then
  echo "Errore: working tree non pulito. Commit/stash prima del deploy." >&2
  exit 1
fi

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

echo "Verifico VPS FiscalBay (${VPS_USER}@${VPS_HOST})..."
remote_cmd "test \"\$(hostname)\" = '${EXPECTED_HOSTNAME}' && printf 'hostname=%s\n' \"\$(hostname)\""

if [ "${DRY_RUN}" = true ]; then
  echo "Dry run: deploy remoto non eseguito."
  echo "Ref che verrebbe deployata: ${REF}"
  exit 0
fi

if [ "${RUN_CI}" = true ]; then
  echo "Eseguo CI locale..."
  bash scripts/ci_verify.sh
fi

if [ "${RUN_PUSH}" = true ]; then
  if [ -z "${branch}" ]; then
    echo "Errore: HEAD detached. Usa --skip-push e --ref con una ref già pubblicata." >&2
    exit 1
  fi
  echo "Push origin/${branch}..."
  git push origin "${branch}"
fi

remote_ref="$(quote_for_remote "${REF}")"
remote_app_dir="$(quote_for_remote "${APP_DIR}")"
remote_app_user="$(quote_for_remote "${APP_USER}")"
remote_app_group="$(quote_for_remote "${APP_GROUP}")"
remote_env_file="$(quote_for_remote "${DEPLOY_ENV_FILE}")"

echo "Deploy VPS FiscalBay da ref ${REF}..."
remote_cmd "sudo bash -lc 'set -euo pipefail; if [ -f ${remote_env_file} ]; then set -a; . ${remote_env_file}; set +a; fi; APP_DIR=${remote_app_dir} APP_USER=${remote_app_user} APP_GROUP=${remote_app_group} bash ${remote_app_dir}/deploy/vps-deploy-ref.sh ${remote_ref}'"

echo "Deploy completato e smoke check passato."
