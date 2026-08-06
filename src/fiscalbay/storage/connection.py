"""SQLite connection storage functions."""

from __future__ import annotations

import os
import sqlite3
from types import TracebackType
from typing import Literal

from .schema import SCHEMA_VERSION as _SCHEMA_VERSION
from .schema import migrate_db

SCHEMA_VERSION = _SCHEMA_VERSION


class _ClosingConnection(sqlite3.Connection):
    """sqlite3 context manager variant that also closes the connection on exit."""

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> Literal[False]:
        try:
            return super().__exit__(exc_type, exc_value, traceback)
        finally:
            self.close()


def ensure_parent_dir(path: str) -> None:
    directory = os.path.dirname(path)
    if directory:
        os.makedirs(directory, exist_ok=True)


def _connect(path: str) -> sqlite3.Connection:
    ensure_parent_dir(path)
    conn = sqlite3.connect(path, timeout=10.0, factory=_ClosingConnection)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(path: str) -> None:
    with _connect(path) as conn:
        migrate_db(conn)
