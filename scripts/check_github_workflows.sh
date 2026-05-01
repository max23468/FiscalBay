#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"

ALLOWED_WORKFLOWS=(
  ".github/workflows/actionlint.yml"
  ".github/workflows/ci.yml"
  ".github/workflows/dependency-review.yml"
  ".github/workflows/package-build.yml"
  ".github/workflows/pr-title.yml"
)

if [ -f ".github/dependabot.yaml" ]; then
  echo "Errore: usa solo .github/dependabot.yml per la configurazione Dependabot." >&2
  exit 1
fi

if [ ! -d ".github/workflows" ]; then
  exit 0
fi

unexpected_workflows=()
while IFS= read -r workflow_file; do
  allowed=false
  for allowed_workflow in "${ALLOWED_WORKFLOWS[@]}"; do
    if [ "${workflow_file}" = "${allowed_workflow}" ]; then
      allowed=true
      break
    fi
  done
  if [ "${allowed}" != true ]; then
    unexpected_workflows+=("${workflow_file}")
  fi
done < <(find .github/workflows -type f | sort)

if [ "${#unexpected_workflows[@]}" -gt 0 ]; then
  echo "Errore: il repository contiene workflow GitHub Actions non autorizzati." >&2
  printf 'Workflow consentiti:\n' >&2
  printf '  - %s\n' "${ALLOWED_WORKFLOWS[@]}" >&2
  printf 'Workflow non consentiti:\n' >&2
  printf '  - %s\n' "${unexpected_workflows[@]}" >&2
  exit 1
fi
