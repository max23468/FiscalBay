#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

RUN_BUILD=false
RUN_PUSH=false
RUN_DEPLOY=false
REF="HEAD"

usage() {
  cat <<'EOF'
Usage: scripts/local_automate.sh [--build] [--push] [--deploy] [--all] [--ref REF]

Legacy local automation pipeline that keeps deploy/release outside GitHub Actions:
  1. verifies only allowlisted GitHub Actions workflows are present
  2. runs local CI checks
  3. optionally builds package artifacts
  4. optionally pushes the current branch
  5. optionally deploys to the FiscalBay VPS via SSH

Preferred commands:
  scripts/deploy_now.sh      daily deploy of an already committed ref
  scripts/release_now.sh     explicit versioned release, tag, GitHub Release and deploy

Common commands:
  scripts/local_automate.sh
  scripts/local_automate.sh --build
  scripts/local_automate.sh --build --push
  scripts/local_automate.sh --all

Push and deploy require a clean working tree so that automation publishes exactly
the committed code being reviewed.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --build)
      RUN_BUILD=true
      shift
      ;;
    --push)
      RUN_PUSH=true
      shift
      ;;
    --deploy)
      RUN_DEPLOY=true
      shift
      ;;
    --all)
      RUN_BUILD=true
      RUN_PUSH=true
      RUN_DEPLOY=true
      shift
      ;;
    --ref)
      REF="${2:?Missing value for --ref}"
      shift 2
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

if [ "${RUN_PUSH}" = true ] || [ "${RUN_DEPLOY}" = true ]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Errore: working tree non pulito. Commit/stash prima di push/deploy." >&2
    exit 1
  fi
fi

echo "Eseguo CI locale..."
bash scripts/ci_verify.sh

if [ "${RUN_BUILD}" = true ]; then
  python_bin="python3"
  if [ -x ".venv/bin/python" ]; then
    python_bin=".venv/bin/python"
  fi
  echo "Build package locale..."
  "${python_bin}" -m build
fi

if [ "${RUN_PUSH}" = true ]; then
  branch="$(git branch --show-current)"
  if [ -z "${branch}" ]; then
    echo "Errore: HEAD detached, impossibile fare push automatico del branch." >&2
    exit 1
  fi
  echo "Push origin/${branch}..."
  git push origin "${branch}"
fi

if [ "${RUN_DEPLOY}" = true ]; then
  echo "Deploy VPS FiscalBay con percorso legacy local_deploy_vps.sh..."
  bash scripts/local_deploy_vps.sh --ref "${REF}"
fi
