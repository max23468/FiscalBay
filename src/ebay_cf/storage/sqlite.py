"""SQLite storage for bot runtime state."""

from __future__ import annotations

import json
import os
import sqlite3
from typing import Iterable

SCHEMA_VERSION = 2


def ensure_parent_dir(path: str) -> None:
    directory = os.path.dirname(path)
    if directory:
        os.makedirs(directory, exist_ok=True)


def _connect(path: str) -> sqlite3.Connection:
    ensure_parent_dir(path)
    conn = sqlite3.connect(path, timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn


def _table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    ).fetchone()
    return row is not None


def _create_v2_schema(conn: sqlite3.Connection) -> None:
    conn.execute("CREATE TABLE IF NOT EXISTS notified_order_ids (order_id TEXT PRIMARY KEY)")
    conn.execute("CREATE TABLE IF NOT EXISTS notified_hashes (hash TEXT PRIMARY KEY)")
    conn.execute(
        "CREATE TABLE IF NOT EXISTS retry_queue "
        "("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "chat_id INTEGER NOT NULL, "
        "text TEXT NOT NULL, "
        "attempts INTEGER NOT NULL DEFAULT 0"
        ")"
    )
    conn.execute("CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)")


def _migrate_legacy_notified_orders(conn: sqlite3.Connection) -> None:
    if not _table_exists(conn, "notified_orders"):
        return

    rows = conn.execute("SELECT order_id, hash FROM notified_orders").fetchall()
    for row in rows:
        if row["order_id"]:
            conn.execute(
                "INSERT OR IGNORE INTO notified_order_ids (order_id) VALUES (?)",
                (row["order_id"],),
            )
        if row["hash"]:
            conn.execute(
                "INSERT OR IGNORE INTO notified_hashes (hash) VALUES (?)",
                (row["hash"],),
            )
    conn.execute("DROP TABLE notified_orders")


def migrate_db(conn: sqlite3.Connection) -> None:
    version = conn.execute("PRAGMA user_version").fetchone()[0]
    if version >= SCHEMA_VERSION:
        return

    _create_v2_schema(conn)
    _migrate_legacy_notified_orders(conn)
    conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")


def init_db(path: str) -> None:
    with _connect(path) as conn:
        migrate_db(conn)


def _unique_preserving_order(values: Iterable[object]) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()
    for value in values:
        if not value:
            continue
        normalized = str(value)
        if normalized in seen:
            continue
        seen.add(normalized)
        ordered.append(normalized)
    return ordered


def _sync_string_table(
    conn: sqlite3.Connection,
    table: str,
    column: str,
    values: Iterable[object],
) -> None:
    normalized = _unique_preserving_order(values)
    current_rows = conn.execute(f"SELECT {column} FROM {table} ORDER BY rowid").fetchall()
    current = [str(row[column]) for row in current_rows]

    to_delete = set(current) - set(normalized)
    if to_delete:
        placeholders = ", ".join("?" for _ in to_delete)
        conn.execute(
            f"DELETE FROM {table} WHERE {column} IN ({placeholders})",
            tuple(to_delete),
        )

    for value in normalized:
        conn.execute(
            f"INSERT OR IGNORE INTO {table} ({column}) VALUES (?)",
            (value,),
        )


def load_state(path: str) -> dict[str, object]:
    init_db(path)
    state: dict[str, object] = {
        "notified_order_ids": [],
        "notified_hashes": [],
        "last_check": None,
        "last_error": None,
        "metrics": {"orders_read": 0, "notifications_sent": 0, "errors_by_type": {}},
    }
    with _connect(path) as conn:
        for row in conn.execute("SELECT order_id FROM notified_order_ids ORDER BY rowid"):
            state["notified_order_ids"].append(str(row["order_id"]))
        for row in conn.execute("SELECT hash FROM notified_hashes ORDER BY rowid"):
            state["notified_hashes"].append(str(row["hash"]))
        for row in conn.execute("SELECT key, value FROM kv_store"):
            if row["key"] == "last_check":
                state["last_check"] = row["value"]
            elif row["key"] == "last_error":
                state["last_error"] = row["value"]
            elif row["key"] == "metrics":
                state["metrics"] = json.loads(row["value"])
    return state


def save_state(path: str, state: dict[str, object]) -> None:
    init_db(path)
    with _connect(path) as conn:
        _sync_string_table(
            conn,
            "notified_order_ids",
            "order_id",
            state.get("notified_order_ids", []),
        )
        _sync_string_table(
            conn,
            "notified_hashes",
            "hash",
            state.get("notified_hashes", []),
        )

        metrics_json = json.dumps(state.get("metrics", {}))
        conn.execute(
            "INSERT OR REPLACE INTO kv_store (key, value) VALUES ('metrics', ?)",
            (metrics_json,),
        )
        if state.get("last_check"):
            conn.execute(
                "INSERT OR REPLACE INTO kv_store (key, value) VALUES ('last_check', ?)",
                (str(state["last_check"]),),
            )
        else:
            conn.execute("DELETE FROM kv_store WHERE key = 'last_check'")
        if state.get("last_error"):
            conn.execute(
                "INSERT OR REPLACE INTO kv_store (key, value) VALUES ('last_error', ?)",
                (str(state["last_error"]),),
            )
        else:
            conn.execute("DELETE FROM kv_store WHERE key = 'last_error'")


def load_retry_queue(path: str) -> list[dict[str, object]]:
    init_db(path)
    queue: list[dict[str, object]] = []
    with _connect(path) as conn:
        for row in conn.execute("SELECT chat_id, text, attempts FROM retry_queue ORDER BY id"):
            queue.append(
                {
                    "chat_id": int(row["chat_id"]),
                    "text": str(row["text"]),
                    "attempts": int(row["attempts"]),
                }
            )
    return queue


def save_retry_queue(path: str, queue: list[dict[str, object]]) -> None:
    init_db(path)
    with _connect(path) as conn:
        conn.execute("DELETE FROM retry_queue")
        rows = [
            (int(item["chat_id"]), str(item["text"]), int(item.get("attempts", 0)))
            for item in queue
        ]
        conn.executemany(
            "INSERT INTO retry_queue (chat_id, text, attempts) VALUES (?, ?, ?)",
            rows,
        )
