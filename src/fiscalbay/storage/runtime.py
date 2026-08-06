"""SQLite runtime storage functions."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from typing import Iterable

from ..models import (
    BotMetrics,
    BotMetricsPayload,
    BotRuntimeState,
    BotRuntimeStatePayload,
    RetryQueueEntry,
    RetryQueueItemPayload,
    as_int,
)
from .connection import _connect, init_db


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


def _normalize_retry_item(item: RetryQueueItemPayload) -> RetryQueueItemPayload:
    normalized: RetryQueueItemPayload = {
        "chat_id": int(item["chat_id"]),
        "text": str(item["text"]),
        "attempts": int(item.get("attempts", 0)),
    }
    if item.get("id") is not None:
        normalized["id"] = int(item["id"])
    return normalized


def _sync_retry_queue(conn: sqlite3.Connection, queue: list[RetryQueueItemPayload]) -> None:
    normalized = [_normalize_retry_item(item) for item in queue]
    existing_rows = conn.execute("SELECT id FROM retry_queue ORDER BY id").fetchall()
    existing_ids = {int(row["id"]) for row in existing_rows}
    desired_ids = {int(item["id"]) for item in normalized if item.get("id") is not None}

    to_delete = existing_ids - desired_ids
    if to_delete:
        placeholders = ", ".join("?" for _ in to_delete)
        conn.execute(
            f"DELETE FROM retry_queue WHERE id IN ({placeholders})",
            tuple(sorted(to_delete)),
        )

    for item in normalized:
        if item.get("id") is not None:
            conn.execute(
                "UPDATE retry_queue SET chat_id = ?, text = ?, attempts = ? WHERE id = ?",
                (
                    item["chat_id"],
                    item["text"],
                    item["attempts"],
                    item["id"],
                ),
            )
        else:
            conn.execute(
                "INSERT INTO retry_queue (chat_id, text, attempts) VALUES (?, ?, ?)",
                (
                    item["chat_id"],
                    item["text"],
                    item["attempts"],
                ),
            )


def _sync_tenant_string_table(
    conn: sqlite3.Connection,
    table: str,
    column: str,
    telegram_user_id: int,
    values: Iterable[object],
) -> None:
    normalized = _unique_preserving_order(values)
    current_rows = conn.execute(
        f"SELECT {column} FROM {table} WHERE telegram_user_id = ? ORDER BY rowid",
        (telegram_user_id,),
    ).fetchall()
    current = [str(row[column]) for row in current_rows]

    to_delete = set(current) - set(normalized)
    if to_delete:
        placeholders = ", ".join("?" for _ in to_delete)
        conn.execute(
            f"DELETE FROM {table} WHERE telegram_user_id = ? AND {column} IN ({placeholders})",
            (telegram_user_id, *tuple(to_delete)),
        )

    for value in normalized:
        conn.execute(
            f"INSERT OR IGNORE INTO {table} (telegram_user_id, {column}) VALUES (?, ?)",
            (telegram_user_id, value),
        )


def _default_metrics_state() -> BotMetricsPayload:
    return {
        "orders_read": 0,
        "orders_with_fiscal_identifier": 0,
        "notifications_sent": 0,
        "telegram_retries": 0,
        "consecutive_error_cycles": 0,
        "errors_by_type": {},
    }


def _parse_metrics_state(raw_value: str) -> BotMetricsPayload:
    decoded = json.loads(raw_value)
    if not isinstance(decoded, dict):
        return _default_metrics_state()
    errors = decoded.get("errors_by_type", {})
    normalized_errors: dict[str, int] = {}
    if isinstance(errors, dict):
        normalized_errors = {str(key): int(value) for key, value in errors.items()}
    return {
        "orders_read": int(decoded.get("orders_read", 0)),
        "orders_with_fiscal_identifier": int(decoded.get("orders_with_fiscal_identifier", 0)),
        "notifications_sent": int(decoded.get("notifications_sent", 0)),
        "telegram_retries": int(decoded.get("telegram_retries", 0)),
        "consecutive_error_cycles": int(decoded.get("consecutive_error_cycles", 0)),
        "errors_by_type": normalized_errors,
    }


def _parse_operational_memory_state(raw_value: str) -> dict[str, object]:
    try:
        decoded = json.loads(raw_value)
    except json.JSONDecodeError:
        return {}
    return decoded if isinstance(decoded, dict) else {}


def _json_dumps(payload: dict[str, object]) -> str:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _state_to_model(state: BotRuntimeStatePayload) -> BotRuntimeState:
    return BotRuntimeState(
        notified_order_ids=list(state["notified_order_ids"]),
        notified_hashes=list(state["notified_hashes"]),
        last_check=state["last_check"],
        last_error=state["last_error"],
        metrics=BotMetrics.from_mapping(state["metrics"]),
        memory=BotRuntimeState.from_mapping({"memory": state.get("memory", {})}).memory,
    )


def _state_from_model(state: BotRuntimeState) -> BotRuntimeStatePayload:
    return {
        "notified_order_ids": list(state.notified_order_ids),
        "notified_hashes": list(state.notified_hashes),
        "last_check": state.last_check,
        "last_error": state.last_error,
        "metrics": {
            "orders_read": state.metrics.orders_read,
            "orders_with_fiscal_identifier": state.metrics.orders_with_fiscal_identifier,
            "notifications_sent": state.metrics.notifications_sent,
            "telegram_retries": state.metrics.telegram_retries,
            "consecutive_error_cycles": state.metrics.consecutive_error_cycles,
            "errors_by_type": dict(state.metrics.errors_by_type),
        },
        "memory": state.memory.as_dict(),
    }


def _retry_entry_to_model(item: RetryQueueItemPayload) -> RetryQueueEntry:
    return RetryQueueEntry(
        id=item.get("id"),
        chat_id=item["chat_id"],
        text=item["text"],
        attempts=item["attempts"],
    )


def _retry_entry_from_model(item: RetryQueueEntry) -> RetryQueueItemPayload:
    payload: RetryQueueItemPayload = {
        "chat_id": item.chat_id,
        "text": item.text,
        "attempts": item.attempts,
    }
    if item.id is not None:
        payload["id"] = item.id
    return payload


def load_state(path: str) -> BotRuntimeStatePayload:
    init_db(path)
    state: BotRuntimeStatePayload = {
        "notified_order_ids": [],
        "notified_hashes": [],
        "last_check": None,
        "last_error": None,
        "metrics": _default_metrics_state(),
        "memory": {},
    }
    with _connect(path) as conn:
        for row in conn.execute("SELECT order_id FROM notified_order_ids ORDER BY rowid"):
            state["notified_order_ids"].append(str(row["order_id"]))
        for row in conn.execute("SELECT hash FROM notified_hashes ORDER BY rowid"):
            state["notified_hashes"].append(str(row["hash"]))
        for row in conn.execute("SELECT key, value FROM kv_store"):
            if row["key"] == "last_check":
                state["last_check"] = str(row["value"])
            elif row["key"] == "last_error":
                state["last_error"] = str(row["value"])
            elif row["key"] == "metrics":
                state["metrics"] = _parse_metrics_state(str(row["value"]))
            elif row["key"] == "operational_memory":
                state["memory"] = _parse_operational_memory_state(str(row["value"]))
    return state


def load_kv_value(path: str, key: str) -> str | None:
    init_db(path)
    with _connect(path) as conn:
        row = conn.execute(
            "SELECT value FROM kv_store WHERE key = ? LIMIT 1",
            (key,),
        ).fetchone()
        if row is None:
            return None
    return str(row["value"])


def save_kv_value(path: str, key: str, value: str) -> None:
    init_db(path)
    with _connect(path) as conn:
        conn.execute(
            "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)",
            (key, value),
        )


def delete_kv_value(path: str, key: str) -> None:
    init_db(path)
    with _connect(path) as conn:
        conn.execute("DELETE FROM kv_store WHERE key = ?", (key,))


def save_state(path: str, state: BotRuntimeStatePayload) -> None:
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

        metrics_json = json.dumps(state["metrics"])
        memory_json = json.dumps(state.get("memory", {}))
        conn.execute(
            "INSERT OR REPLACE INTO kv_store (key, value) VALUES ('metrics', ?)",
            (metrics_json,),
        )
        conn.execute(
            "INSERT OR REPLACE INTO kv_store (key, value) VALUES ('operational_memory', ?)",
            (memory_json,),
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


def load_runtime_state(path: str) -> BotRuntimeState:
    return _state_to_model(load_state(path))


def save_runtime_state(path: str, state: BotRuntimeState) -> None:
    save_state(path, _state_from_model(state))


def _parse_runtime_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def load_effective_runtime_state(path: str) -> BotRuntimeState:
    init_db(path)
    global_state = load_runtime_state(path)
    global_timestamp = _parse_runtime_timestamp(global_state.last_check)
    freshest_state = global_state
    freshest_timestamp = global_timestamp
    with _connect(path) as conn:
        tenant_rows = conn.execute(
            "SELECT telegram_user_id "
            "FROM tenant_runtime_state "
            "ORDER BY updated_at DESC, telegram_user_id ASC"
        ).fetchall()
    for row in tenant_rows:
        tenant_state = load_tenant_runtime_state(path, int(row["telegram_user_id"]))
        tenant_timestamp = _parse_runtime_timestamp(tenant_state.last_check)
        if tenant_timestamp is None:
            continue
        if freshest_timestamp is None or tenant_timestamp > freshest_timestamp:
            freshest_state = tenant_state
            freshest_timestamp = tenant_timestamp
    return freshest_state


def load_retry_queue(path: str) -> list[RetryQueueItemPayload]:
    init_db(path)
    queue: list[RetryQueueItemPayload] = []
    with _connect(path) as conn:
        for row in conn.execute("SELECT id, chat_id, text, attempts FROM retry_queue ORDER BY id"):
            queue.append(
                {
                    "id": int(row["id"]),
                    "chat_id": int(row["chat_id"]),
                    "text": str(row["text"]),
                    "attempts": int(row["attempts"]),
                }
            )
    return queue


def save_retry_queue(path: str, queue: list[RetryQueueItemPayload]) -> None:
    init_db(path)
    with _connect(path) as conn:
        _sync_retry_queue(conn, queue)


def load_retry_queue_entries(path: str) -> list[RetryQueueEntry]:
    return [_retry_entry_to_model(item) for item in load_retry_queue(path)]


def save_retry_queue_entries(path: str, queue: list[RetryQueueEntry]) -> None:
    save_retry_queue(path, [_retry_entry_from_model(item) for item in queue])


def load_tenant_runtime_state(path: str, telegram_user_id: int) -> BotRuntimeState:
    init_db(path)
    state = BotRuntimeState()
    with _connect(path) as conn:
        for row in conn.execute(
            "SELECT order_id "
            "FROM tenant_notified_order_ids "
            "WHERE telegram_user_id = ? ORDER BY rowid",
            (telegram_user_id,),
        ):
            state.notified_order_ids.append(str(row["order_id"]))
        for row in conn.execute(
            "SELECT hash FROM tenant_notified_hashes WHERE telegram_user_id = ? ORDER BY rowid",
            (telegram_user_id,),
        ):
            state.notified_hashes.append(str(row["hash"]))
        runtime_row = conn.execute(
            "SELECT last_check, last_error, metrics_json, memory_json "
            "FROM tenant_runtime_state WHERE telegram_user_id = ?",
            (telegram_user_id,),
        ).fetchone()
        if runtime_row is not None:
            state.last_check = (
                str(runtime_row["last_check"]) if runtime_row["last_check"] is not None else None
            )
            state.last_error = (
                str(runtime_row["last_error"]) if runtime_row["last_error"] is not None else None
            )
            state.metrics = BotMetrics.from_mapping(
                _parse_metrics_state(str(runtime_row["metrics_json"]))
            )
            state.memory = BotRuntimeState.from_mapping(
                {"memory": _parse_operational_memory_state(str(runtime_row["memory_json"]))}
            ).memory
    return state


def save_tenant_runtime_state(path: str, telegram_user_id: int, state: BotRuntimeState) -> None:
    init_db(path)
    with _connect(path) as conn:
        _sync_tenant_string_table(
            conn,
            "tenant_notified_order_ids",
            "order_id",
            telegram_user_id,
            state.notified_order_ids,
        )
        _sync_tenant_string_table(
            conn,
            "tenant_notified_hashes",
            "hash",
            telegram_user_id,
            state.notified_hashes,
        )
        conn.execute(
            "INSERT INTO tenant_runtime_state "
            "(telegram_user_id, last_check, last_error, metrics_json, memory_json, updated_at) "
            "VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) "
            "ON CONFLICT(telegram_user_id) DO UPDATE SET "
            "last_check = excluded.last_check, "
            "last_error = excluded.last_error, "
            "metrics_json = excluded.metrics_json, "
            "memory_json = excluded.memory_json, "
            "updated_at = CURRENT_TIMESTAMP",
            (
                telegram_user_id,
                state.last_check,
                state.last_error,
                json.dumps(state.metrics.as_dict()),
                json.dumps(state.memory.as_dict()),
            ),
        )


def load_tenant_retry_queue_entries(path: str, telegram_user_id: int) -> list[RetryQueueEntry]:
    init_db(path)
    queue: list[RetryQueueEntry] = []
    with _connect(path) as conn:
        for row in conn.execute(
            "SELECT id, chat_id, text, attempts "
            "FROM tenant_retry_queue WHERE telegram_user_id = ? ORDER BY id",
            (telegram_user_id,),
        ):
            queue.append(
                RetryQueueEntry(
                    id=int(row["id"]),
                    chat_id=int(row["chat_id"]),
                    text=str(row["text"]),
                    attempts=int(row["attempts"]),
                )
            )
    return queue


def save_tenant_retry_queue_entries(
    path: str,
    telegram_user_id: int,
    queue: list[RetryQueueEntry],
) -> None:
    init_db(path)
    with _connect(path) as conn:
        conn.execute(
            "DELETE FROM tenant_retry_queue WHERE telegram_user_id = ?", (telegram_user_id,)
        )
        for item in queue:
            conn.execute(
                "INSERT INTO tenant_retry_queue (telegram_user_id, chat_id, text, attempts) "
                "VALUES (?, ?, ?, ?)",
                (
                    telegram_user_id,
                    item.chat_id,
                    item.text,
                    item.attempts,
                ),
            )


def summarize_retry_queue_backlog(path: str) -> dict[str, int]:
    init_db(path)
    with _connect(path) as conn:
        global_count = as_int(conn.execute("SELECT COUNT(*) FROM retry_queue").fetchone()[0])
        tenant_count = as_int(conn.execute("SELECT COUNT(*) FROM tenant_retry_queue").fetchone()[0])
    return {
        "global": global_count,
        "tenant": tenant_count,
        "total": global_count + tenant_count,
    }
