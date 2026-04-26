#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="python3"
RUFF_BIN="ruff"
MYPY_BIN="mypy"
COVERAGE_BIN="coverage"
if [ -x ".venv/bin/python" ]; then
  PYTHON_BIN=".venv/bin/python"
fi
if [ -x ".venv/bin/ruff" ]; then
  RUFF_BIN=".venv/bin/ruff"
fi
if [ -x ".venv/bin/mypy" ]; then
  MYPY_BIN=".venv/bin/mypy"
fi
if [ -x ".venv/bin/coverage" ]; then
  COVERAGE_BIN=".venv/bin/coverage"
fi

"$RUFF_BIN" format --check src tests
"$RUFF_BIN" check src tests
"$MYPY_BIN"
"$COVERAGE_BIN" erase
"$COVERAGE_BIN" run -m unittest discover -s tests -v
"$COVERAGE_BIN" report
