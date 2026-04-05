"""SQLite storage for bot runtime state."""

from __future__ import annotations

import json
import os
import sqlite3


def ensure_parent_dir(path: str) -> None:
    directory = os.path.dirname(path)
    if directory:
        os.makedirs(directory, exist_ok=True)


def init_db(path: str) -> None:
    ensure_parent_dir(path)
    with sqlite3.connect(path, timeout=10.0) as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS notified_orders (order_id TEXT, hash TEXT)")
        conn.execute(
            "CREATE TABLE IF NOT EXISTS retry_queue "
            "(id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER, text TEXT, attempts INTEGER)"
        )
        conn.execute("CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT)")


def load_state(path: str) -> dict[str, object]:
    init_db(path)
    state: dict[str, object] = {
        "notified_order_ids": [],
        "notified_hashes": [],
        "last_check": None,
        "last_error": None,
        "metrics": {"orders_read": 0, "notifications_sent": 0, "errors_by_type": {}},
    }
    with sqlite3.connect(path, timeout=10.0) as conn:
        for row in conn.execute("SELECT order_id, hash FROM notified_orders"):
            if row[0]:
                state["notified_order_ids"].append(row[0])
            if row[1]:
                state["notified_hashes"].append(row[1])
        for row in conn.execute("SELECT key, value FROM kv_store"):
            if row[0] == "last_check":
                state["last_check"] = row[1]
            elif row[0] == "last_error":
                state["last_error"] = row[1]
            elif row[0] == "metrics":
                state["metrics"] = json.loads(row[1])
    return state


def save_state(path: str, state: dict[str, object]) -> None:
    init_db(path)
    with sqlite3.connect(path, timeout=10.0) as conn:
        conn.execute("DELETE FROM notified_orders")
        ids = state.get("notified_order_ids", [])
        hashes = state.get("notified_hashes", [])
        rows = []
        max_len = max(len(ids), len(hashes))
        for index in range(max_len):
            rows.append(
                (
                    ids[index] if index < len(ids) else None,
                    hashes[index] if index < len(hashes) else None,
                )
            )
        conn.executemany("INSERT INTO notified_orders (order_id, hash) VALUES (?, ?)", rows)
        metrics_json = json.dumps(state.get("metrics", {}))
        conn.execute(
            "INSERT OR REPLACE INTO kv_store (key, value) VALUES ('metrics', ?)",
            (metrics_json,),
        )
        if state.get("last_check"):
            conn.execute(
                "INSERT OR REPLACE INTO kv_store (key, value) VALUES ('last_check', ?)",
                (state["last_check"],),
            )
        if state.get("last_error"):
            conn.execute(
                "INSERT OR REPLACE INTO kv_store (key, value) VALUES ('last_error', ?)",
                (state["last_error"],),
            )


def load_retry_queue(path: str) -> list[dict[str, object]]:
    init_db(path)
    queue: list[dict[str, object]] = []
    with sqlite3.connect(path, timeout=10.0) as conn:
        for row in conn.execute("SELECT chat_id, text, attempts FROM retry_queue ORDER BY id"):
            queue.append({"chat_id": row[0], "text": row[1], "attempts": row[2]})
    return queue


def save_retry_queue(path: str, queue: list[dict[str, object]]) -> None:
    init_db(path)
    with sqlite3.connect(path, timeout=10.0) as conn:
        conn.execute("DELETE FROM retry_queue")
        rows = [(item["chat_id"], item["text"], item.get("attempts", 0)) for item in queue]
        conn.executemany("INSERT INTO retry_queue (chat_id, text, attempts) VALUES (?, ?, ?)", rows)
