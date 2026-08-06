#!/usr/bin/env bash
set -euo pipefail

RUFF_BIN="ruff"
MYPY_BIN="mypy"
COVERAGE_BIN="coverage"
if [ -x ".venv/bin/ruff" ]; then
  RUFF_BIN=".venv/bin/ruff"
fi
if [ -x ".venv/bin/mypy" ]; then
  MYPY_BIN=".venv/bin/mypy"
fi
if [ -x ".venv/bin/coverage" ]; then
  COVERAGE_BIN=".venv/bin/coverage"
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "uv e' richiesto per verificare requirements.lock." >&2
  exit 1
fi
make lock-check

bash scripts/check_github_workflows.sh
node --test scripts/codex-review-gate.test.mjs
"$RUFF_BIN" format --check src tests
"$RUFF_BIN" check src tests
"$MYPY_BIN"
"$COVERAGE_BIN" erase
"$COVERAGE_BIN" run -m unittest discover -s tests -v
"$COVERAGE_BIN" report
