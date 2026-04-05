#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="python3"
if [ -x ".venv/bin/python" ]; then
  PYTHON_BIN=".venv/bin/python"
fi

"$PYTHON_BIN" -m ruff format src tests
"$PYTHON_BIN" -m ruff check src tests
"$PYTHON_BIN" -m mypy
"$PYTHON_BIN" -m coverage erase
"$PYTHON_BIN" -m coverage run -m unittest discover -s tests -v
"$PYTHON_BIN" -m coverage report
