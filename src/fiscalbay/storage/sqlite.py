"""SQLite storage for bot runtime state."""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from types import TracebackType
from typing import Iterable, Literal

from ..models import (
    CAPABILITY_MANAGE_NOTIFICATIONS,
    EBAY_ACCOUNT_STATUS_DISCONNECTED,
    EBAY_ACCOUNT_STATUS_LINKED,
    OAUTH_SESSION_STATUS_CANCELLED,
    OAUTH_SESSION_STATUS_COMPLETED,
    OAUTH_SESSION_STATUS_EXPIRED,
    OAUTH_SESSION_STATUS_FAILED,
    OAUTH_SESSION_STATUS_PENDING,
    OPERATION_STATUS_CANCELLED,
    OPERATION_STATUS_COMPLETED,
    OPERATION_STATUS_FAILED,
    OPERATION_STATUS_PENDING,
    OPERATION_STATUS_RUNNING,
    TELEGRAM_USER_STATUS_ADMIN,
    TELEGRAM_USER_STATUS_BLOCKED,
    TELEGRAM_USER_STATUS_PENDING,
    AuditLogEntry,
    BotMetrics,
    BotMetricsPayload,
    BotRuntimeState,
    BotRuntimeStatePayload,
    EbayTokenSet,
    LinkedEbayAccount,
    NotificationSubscription,
    NotificationTenantTarget,
    OauthLinkSession,
    OperationQueueEntry,
    RetryQueueEntry,
    RetryQueueItemPayload,
    TelegramChat,
    TelegramUser,
    TenantChatContext,
    as_int,
    has_telegram_user_capability,
    normalize_operation_status,
    normalize_telegram_user_status,
)
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


def _looks_like_sqlite_database(path: str) -> bool:
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        return False
    with open(path, "rb") as handle:
        return handle.read(16) == b"SQLite format 3\x00"


def _load_legacy_json_file(path: str) -> object | None:
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as handle:
        loaded: object = json.load(handle)
        return loaded


def _migrate_legacy_json_state(path: str) -> bool:
    if _looks_like_sqlite_database(path):
        return False

    legacy = _load_legacy_json_file(path)
    if not isinstance(legacy, dict):
        return False

    state: BotRuntimeStatePayload = {
        "notified_order_ids": _unique_preserving_order(legacy.get("notified_order_ids", [])),
        "notified_hashes": _unique_preserving_order(legacy.get("notified_hashes", [])),
        "last_check": str(legacy["last_check"]) if legacy.get("last_check") else None,
        "last_error": str(legacy["last_error"]) if legacy.get("last_error") else None,
        "metrics": _default_metrics_state(),
        "memory": {},
    }
    raw_metrics = legacy.get("metrics")
    if isinstance(raw_metrics, dict):
        state["metrics"] = _parse_metrics_state(json.dumps(raw_metrics))

    os.replace(path, f"{path}.legacy-json.bak")
    save_state(path, state)
    return True


def _migrate_legacy_json_retry_queue(path: str) -> bool:
    if _looks_like_sqlite_database(path):
        return False

    legacy = _load_legacy_json_file(path)
    if not isinstance(legacy, list):
        return False

    queue: list[RetryQueueItemPayload] = []
    for item in legacy:
        if not isinstance(item, dict):
            continue
        if "chat_id" not in item or "text" not in item:
            continue
        queue.append(
            _normalize_retry_item(
                {
                    "chat_id": int(item["chat_id"]),
                    "text": str(item["text"]),
                    "attempts": int(item.get("attempts", 0)),
                }
            )
        )

    os.replace(path, f"{path}.legacy-json.bak")
    save_retry_queue(path, queue)
    return True


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
    _migrate_legacy_json_state(path)
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
    _migrate_legacy_json_retry_queue(path)
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


def upsert_telegram_user(path: str, user: TelegramUser) -> None:
    init_db(path)
    with _connect(path) as conn:
        conn.execute(
            "INSERT INTO telegram_users "
            "(telegram_user_id, username, display_name, status, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(telegram_user_id) DO UPDATE SET "
            "username = excluded.username, "
            "display_name = excluded.display_name, "
            "status = excluded.status, "
            "created_at = COALESCE(telegram_users.created_at, excluded.created_at), "
            "updated_at = excluded.updated_at",
            (
                user.telegram_user_id,
                user.username,
                user.display_name,
                user.status,
                user.created_at,
                user.created_at,
            ),
        )


def load_telegram_users(path: str) -> list[TelegramUser]:
    init_db(path)
    users: list[TelegramUser] = []
    with _connect(path) as conn:
        for row in conn.execute(
            "SELECT u.telegram_user_id, "
            "COALESCE(c.telegram_chat_id, 0) AS telegram_chat_id, "
            "u.username, u.display_name, u.status, u.created_at, u.updated_at "
            "FROM telegram_users AS u "
            "LEFT JOIN telegram_chats AS c "
            "ON c.telegram_user_id = u.telegram_user_id AND c.is_primary = 1 "
            "ORDER BY u.telegram_user_id"
        ):
            users.append(TelegramUser.from_mapping(dict(row)))
    return users


def append_audit_log_entry(path: str, entry: AuditLogEntry) -> AuditLogEntry:
    init_db(path)
    with _connect(path) as conn:
        cursor = conn.execute(
            "INSERT INTO audit_log "
            "("
            "event_type, actor_telegram_user_id, target_telegram_user_id, telegram_chat_id, "
            "ebay_user_id, environment, outcome, details_json, created_at"
            ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                entry.event_type,
                entry.actor_telegram_user_id,
                entry.target_telegram_user_id,
                entry.telegram_chat_id,
                entry.ebay_user_id,
                entry.environment,
                entry.outcome,
                entry.details_json,
                entry.created_at,
            ),
        )
        if cursor.lastrowid is None:
            raise RuntimeError("Inserimento audit log fallito: lastrowid mancante.")
        entry.id = int(cursor.lastrowid)
    return entry


def load_audit_log_entries(path: str, limit: int = 100) -> list[AuditLogEntry]:
    init_db(path)
    entries: list[AuditLogEntry] = []
    safe_limit = max(1, int(limit))
    with _connect(path) as conn:
        rows = conn.execute(
            "SELECT id, event_type, actor_telegram_user_id, target_telegram_user_id, "
            "telegram_chat_id, ebay_user_id, environment, outcome, details_json, created_at "
            "FROM audit_log ORDER BY id DESC LIMIT ?",
            (safe_limit,),
        ).fetchall()
        for row in rows:
            entries.append(AuditLogEntry.from_mapping(dict(row)))
    return entries


def enqueue_operation(path: str, entry: OperationQueueEntry) -> OperationQueueEntry:
    init_db(path)
    with _connect(path) as conn:
        cursor = conn.execute(
            "INSERT INTO operation_queue "
            "("
            "operation_type, status, actor_telegram_user_id, target_telegram_user_id, "
            "available_at, payload_json, result_json, last_error, attempts, created_at, updated_at"
            ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                entry.operation_type,
                normalize_operation_status(entry.status),
                entry.actor_telegram_user_id,
                entry.target_telegram_user_id,
                entry.available_at,
                entry.payload_json,
                entry.result_json,
                entry.last_error,
                entry.attempts,
                entry.created_at,
                entry.updated_at or entry.created_at,
            ),
        )
        if cursor.lastrowid is None:
            raise RuntimeError("Inserimento operation queue fallito: lastrowid mancante.")
        entry.id = int(cursor.lastrowid)
    return entry


def load_operation_queue_entries(
    path: str,
    *,
    limit: int = 100,
    statuses: set[str] | None = None,
) -> list[OperationQueueEntry]:
    init_db(path)
    entries: list[OperationQueueEntry] = []
    safe_limit = max(1, int(limit))
    with _connect(path) as conn:
        if statuses:
            normalized_statuses = [
                normalize_operation_status(status) for status in sorted(statuses)
            ]
            placeholders = ", ".join("?" for _ in normalized_statuses)
            rows = conn.execute(
                "SELECT id, operation_type, status, actor_telegram_user_id, "
                "target_telegram_user_id, available_at, payload_json, result_json, "
                "last_error, attempts, created_at, updated_at "
                f"FROM operation_queue WHERE status IN ({placeholders}) "
                "ORDER BY id ASC LIMIT ?",
                (*normalized_statuses, safe_limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, operation_type, status, actor_telegram_user_id, "
                "target_telegram_user_id, available_at, payload_json, result_json, "
                "last_error, attempts, created_at, updated_at "
                "FROM operation_queue ORDER BY id ASC LIMIT ?",
                (safe_limit,),
            ).fetchall()
        for row in rows:
            entries.append(OperationQueueEntry.from_mapping(dict(row)))
    return entries


def update_operation_queue_entry(
    path: str,
    operation_id: int,
    *,
    status: str | None = None,
    result_json: str | None = None,
    last_error: str | None = None,
    attempts: int | None = None,
    updated_at: str,
) -> OperationQueueEntry | None:
    init_db(path)
    assignments: list[str] = ["updated_at = ?"]
    params: list[object] = [updated_at]
    if status is not None:
        assignments.append("status = ?")
        params.append(normalize_operation_status(status))
    if result_json is not None:
        assignments.append("result_json = ?")
        params.append(result_json)
    if last_error is not None:
        assignments.append("last_error = ?")
        params.append(last_error)
    if attempts is not None:
        assignments.append("attempts = ?")
        params.append(attempts)
    params.append(operation_id)
    with _connect(path) as conn:
        conn.execute(
            f"UPDATE operation_queue SET {', '.join(assignments)} WHERE id = ?",
            tuple(params),
        )
        row = conn.execute(
            "SELECT id, operation_type, status, actor_telegram_user_id, "
            "target_telegram_user_id, available_at, payload_json, result_json, "
            "last_error, attempts, created_at, updated_at "
            "FROM operation_queue WHERE id = ? LIMIT 1",
            (operation_id,),
        ).fetchone()
        if row is None:
            return None
    return OperationQueueEntry.from_mapping(dict(row))


def claim_pending_operation(path: str, *, now_iso: str) -> OperationQueueEntry | None:
    init_db(path)
    with _connect(path) as conn:
        row = conn.execute(
            "SELECT id, operation_type, status, actor_telegram_user_id, "
            "target_telegram_user_id, available_at, payload_json, result_json, "
            "last_error, attempts, created_at, updated_at "
            "FROM operation_queue "
            "WHERE status = ? AND (available_at IS NULL OR available_at <= ?) "
            "ORDER BY id ASC LIMIT 1",
            (OPERATION_STATUS_PENDING, now_iso),
        ).fetchone()
        if row is None:
            return None
        operation = OperationQueueEntry.from_mapping(dict(row))
        next_attempts = operation.attempts + 1
        conn.execute(
            "UPDATE operation_queue "
            "SET status = ?, attempts = ?, updated_at = ? "
            "WHERE id = ? AND status = ?",
            (
                OPERATION_STATUS_RUNNING,
                next_attempts,
                now_iso,
                operation.id,
                OPERATION_STATUS_PENDING,
            ),
        )
        if conn.total_changes == 0:
            return None
        operation.status = OPERATION_STATUS_RUNNING
        operation.attempts = next_attempts
        operation.updated_at = now_iso
    return operation


def load_telegram_user(path: str, telegram_user_id: int) -> TelegramUser | None:
    init_db(path)
    with _connect(path) as conn:
        row = conn.execute(
            "SELECT u.telegram_user_id, "
            "COALESCE(c.telegram_chat_id, 0) AS telegram_chat_id, "
            "u.username, u.display_name, u.status, u.created_at, u.updated_at "
            "FROM telegram_users AS u "
            "LEFT JOIN telegram_chats AS c "
            "ON c.telegram_user_id = u.telegram_user_id AND c.is_primary = 1 "
            "WHERE u.telegram_user_id = ? "
            "LIMIT 1",
            (telegram_user_id,),
        ).fetchone()
        if row is None:
            return None
    return TelegramUser.from_mapping(dict(row))


def update_telegram_user_status(
    path: str,
    telegram_user_id: int,
    status: str,
    *,
    updated_at: str,
) -> TelegramUser | None:
    init_db(path)
    with _connect(path) as conn:
        row = conn.execute(
            "SELECT telegram_user_id FROM telegram_users WHERE telegram_user_id = ? LIMIT 1",
            (telegram_user_id,),
        ).fetchone()
        if row is None:
            return None
        conn.execute(
            "UPDATE telegram_users SET status = ?, updated_at = ? WHERE telegram_user_id = ?",
            (status, updated_at, telegram_user_id),
        )
    return load_telegram_user(path, telegram_user_id)


def apply_telegram_user_access_status(
    path: str,
    telegram_user_id: int,
    status: str,
    *,
    updated_at: str,
    default_notify_chat_ids: set[int] | None = None,
) -> TelegramUser | None:
    normalized_status = normalize_telegram_user_status(status)
    user = update_telegram_user_status(
        path,
        telegram_user_id,
        normalized_status,
        updated_at=updated_at,
    )
    if user is None:
        return None

    notifications_allowed = has_telegram_user_capability(
        normalized_status,
        CAPABILITY_MANAGE_NOTIFICATIONS,
    )
    notify_chat_ids = default_notify_chat_ids or set()
    existing_subscriptions = {
        subscription.telegram_chat_id: subscription
        for subscription in load_notification_subscriptions(path)
        if subscription.telegram_user_id == telegram_user_id
    }
    for chat in load_telegram_chats(path):
        if chat.telegram_user_id != telegram_user_id:
            continue
        existing_subscription = existing_subscriptions.get(chat.telegram_chat_id)
        if not notifications_allowed:
            enabled = False
        elif existing_subscription is not None:
            enabled = existing_subscription.enabled
        elif notify_chat_ids:
            enabled = chat.telegram_chat_id in notify_chat_ids
        else:
            enabled = True
        set_notification_subscription_enabled(
            path,
            telegram_user_id,
            chat.telegram_chat_id,
            enabled,
            created_at=chat.created_at or updated_at,
            updated_at=updated_at,
        )
    return load_telegram_user(path, telegram_user_id)


def upsert_telegram_chat(path: str, chat: TelegramChat) -> None:
    init_db(path)
    with _connect(path) as conn:
        conn.execute(
            "INSERT INTO telegram_chats "
            "("
            "telegram_user_id, telegram_chat_id, chat_type, is_primary, "
            "notifications_enabled, created_at, updated_at"
            ") "
            "VALUES (?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(telegram_user_id, telegram_chat_id) DO UPDATE SET "
            "chat_type = excluded.chat_type, "
            "is_primary = excluded.is_primary, "
            "notifications_enabled = excluded.notifications_enabled, "
            "created_at = COALESCE(telegram_chats.created_at, excluded.created_at), "
            "updated_at = excluded.updated_at",
            (
                chat.telegram_user_id,
                chat.telegram_chat_id,
                chat.chat_type,
                int(chat.is_primary),
                int(chat.notifications_enabled),
                chat.created_at,
                chat.updated_at or chat.created_at,
            ),
        )


def load_telegram_chats(path: str) -> list[TelegramChat]:
    init_db(path)
    chats: list[TelegramChat] = []
    with _connect(path) as conn:
        for row in conn.execute(
            "SELECT id, telegram_user_id, telegram_chat_id, chat_type, is_primary, "
            "notifications_enabled, created_at, updated_at "
            "FROM telegram_chats ORDER BY telegram_user_id, telegram_chat_id"
        ):
            chats.append(TelegramChat.from_mapping(dict(row)))
    return chats


def resolve_primary_chat_id(path: str, telegram_user_id: int) -> int | None:
    init_db(path)
    with _connect(path) as conn:
        row = conn.execute(
            "SELECT telegram_chat_id "
            "FROM telegram_chats "
            "WHERE telegram_user_id = ? "
            "ORDER BY CASE WHEN is_primary = 1 THEN 0 ELSE 1 END, telegram_chat_id "
            "LIMIT 1",
            (telegram_user_id,),
        ).fetchone()
        if row is None:
            return None
    return as_int(row["telegram_chat_id"])


def upsert_linked_ebay_account(path: str, account: LinkedEbayAccount) -> None:
    init_db(path)
    with _connect(path) as conn:
        conn.execute(
            "INSERT INTO ebay_accounts "
            "(telegram_user_id, ebay_user_id, environment, scopes, linked_at, status) "
            "VALUES (?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(telegram_user_id, environment) DO UPDATE SET "
            "ebay_user_id = excluded.ebay_user_id, "
            "scopes = excluded.scopes, "
            "linked_at = excluded.linked_at, "
            "status = excluded.status",
            (
                account.telegram_user_id,
                account.ebay_user_id,
                account.environment,
                account.scopes,
                account.linked_at,
                account.status,
            ),
        )


def load_linked_ebay_accounts(path: str) -> list[LinkedEbayAccount]:
    init_db(path)
    accounts: list[LinkedEbayAccount] = []
    with _connect(path) as conn:
        for row in conn.execute(
            "SELECT id, telegram_user_id, ebay_user_id, environment, scopes, linked_at, status "
            "FROM ebay_accounts ORDER BY telegram_user_id, environment"
        ):
            accounts.append(LinkedEbayAccount.from_mapping(dict(row)))
    return accounts


def resolve_linked_ebay_account(
    path: str,
    telegram_user_id: int,
    environment: str | None = None,
) -> LinkedEbayAccount | None:
    init_db(path)
    with _connect(path) as conn:
        params: list[object] = [telegram_user_id]
        query = (
            "SELECT id, telegram_user_id, ebay_user_id, environment, scopes, linked_at, status "
            "FROM ebay_accounts "
            "WHERE telegram_user_id = ? AND status = 'linked'"
        )
        if environment:
            query += " AND environment = ?"
            params.append(environment)
        query += " ORDER BY environment LIMIT 1"
        row = conn.execute(query, tuple(params)).fetchone()
        if row is None and environment:
            row = conn.execute(
                "SELECT id, telegram_user_id, ebay_user_id, environment, scopes, linked_at, status "
                "FROM ebay_accounts "
                "WHERE telegram_user_id = ? AND status = 'linked' "
                "ORDER BY CASE WHEN environment = ? THEN 0 ELSE 1 END, environment "
                "LIMIT 1",
                (telegram_user_id, environment),
            ).fetchone()
        if row is None:
            return None
    return LinkedEbayAccount.from_mapping(dict(row))


def upsert_ebay_token_set(path: str, token_set: EbayTokenSet) -> None:
    init_db(path)
    with _connect(path) as conn:
        conn.execute(
            "INSERT INTO ebay_tokens "
            "("
            "ebay_account_id, refresh_token_encrypted, access_token, scope_set, "
            "expires_at, updated_at, status"
            ") "
            "VALUES (?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(ebay_account_id) DO UPDATE SET "
            "refresh_token_encrypted = excluded.refresh_token_encrypted, "
            "access_token = excluded.access_token, "
            "scope_set = excluded.scope_set, "
            "expires_at = excluded.expires_at, "
            "updated_at = excluded.updated_at, "
            "status = excluded.status",
            (
                token_set.ebay_account_id,
                token_set.refresh_token_encrypted,
                token_set.access_token,
                token_set.scope_set,
                token_set.expires_at,
                token_set.updated_at,
                token_set.status,
            ),
        )


def load_ebay_token_sets(path: str) -> list[EbayTokenSet]:
    init_db(path)
    token_sets: list[EbayTokenSet] = []
    with _connect(path) as conn:
        for row in conn.execute(
            "SELECT id, ebay_account_id, refresh_token_encrypted, access_token, "
            "scope_set, expires_at, updated_at, status "
            "FROM ebay_tokens ORDER BY ebay_account_id"
        ):
            token_sets.append(EbayTokenSet.from_mapping(dict(row)))
    return token_sets


def resolve_ebay_token_set(
    path: str,
    telegram_user_id: int,
    environment: str | None = None,
) -> EbayTokenSet | None:
    init_db(path)
    with _connect(path) as conn:
        params: list[object] = [telegram_user_id]
        query = (
            "SELECT t.id, t.ebay_account_id, t.refresh_token_encrypted, t.access_token, "
            "t.scope_set, t.expires_at, t.updated_at, t.status "
            "FROM ebay_tokens AS t "
            "JOIN ebay_accounts AS a ON a.id = t.ebay_account_id "
            "WHERE a.telegram_user_id = ? AND a.status = 'linked'"
        )
        if environment:
            query += " AND a.environment = ?"
            params.append(environment)
        query += " ORDER BY a.environment LIMIT 1"
        row = conn.execute(query, tuple(params)).fetchone()
        if row is None:
            return None
    return EbayTokenSet.from_mapping(dict(row))


def load_tenant_account_status_cache(path: str, telegram_user_id: int) -> dict[str, object]:
    init_db(path)
    with _connect(path) as conn:
        row = conn.execute(
            "SELECT account_snapshot_json FROM tenant_runtime_state WHERE telegram_user_id = ?",
            (telegram_user_id,),
        ).fetchone()
        if row is None or row["account_snapshot_json"] is None:
            return {}
    return _parse_operational_memory_state(str(row["account_snapshot_json"]))


def save_tenant_account_status_cache(
    path: str,
    telegram_user_id: int,
    snapshot: dict[str, object],
) -> None:
    init_db(path)
    serialized = _json_dumps(snapshot)
    with _connect(path) as conn:
        existing = conn.execute(
            "SELECT account_snapshot_json FROM tenant_runtime_state WHERE telegram_user_id = ?",
            (telegram_user_id,),
        ).fetchone()
        if existing is not None and str(existing["account_snapshot_json"] or "") == serialized:
            return
        conn.execute(
            "INSERT INTO tenant_runtime_state "
            "(telegram_user_id, metrics_json, memory_json, account_snapshot_json, updated_at) "
            "VALUES (?, '{}', '{}', ?, CURRENT_TIMESTAMP) "
            "ON CONFLICT(telegram_user_id) DO UPDATE SET "
            "account_snapshot_json = excluded.account_snapshot_json, "
            "updated_at = CURRENT_TIMESTAMP",
            (
                telegram_user_id,
                serialized,
            ),
        )


def _account_status_requires_reconnect(
    account_status: str,
    token_status: str,
) -> bool:
    return account_status in {"revoked"} or token_status in {"revoked", "expired", "token_expired"}


def _cached_account_snapshot_is_usable(
    snapshot: dict[str, object],
    environment: str | None,
) -> bool:
    if not snapshot:
        return False
    snapshot_environment = str(snapshot.get("environment") or "")
    if environment and snapshot_environment and snapshot_environment != environment:
        return False
    account_status = str(snapshot.get("account_status") or "unlinked")
    token_status = str(snapshot.get("token_status") or "missing")
    return account_status in {"disconnected", "revoked"} or _account_status_requires_reconnect(
        account_status,
        token_status,
    )


def summarize_tenant_account_status(
    path: str,
    telegram_user_id: int,
    environment: str | None = None,
) -> dict[str, object]:
    init_db(path)
    cached_snapshot = load_tenant_account_status_cache(path, telegram_user_id)
    with _connect(path) as conn:
        enabled_subscription_count = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM notification_subscriptions "
                "WHERE telegram_user_id = ? AND enabled = 1",
                (telegram_user_id,),
            ).fetchone()[0]
        )
        chat_count = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM telegram_chats WHERE telegram_user_id = ?",
                (telegram_user_id,),
            ).fetchone()[0]
        )
    if _cached_account_snapshot_is_usable(cached_snapshot, environment):
        return {
            "telegram_user_id": telegram_user_id,
            "linked": bool(cached_snapshot.get("linked", False)),
            "environment": cached_snapshot.get("environment") or environment,
            "ebay_user_id": str(cached_snapshot.get("ebay_user_id") or ""),
            "account_status": str(cached_snapshot.get("account_status") or "unlinked"),
            "token_status": str(cached_snapshot.get("token_status") or "missing"),
            "token_configured": bool(cached_snapshot.get("token_configured", False)),
            "latest_reconnect_outcome": str(cached_snapshot.get("latest_reconnect_outcome") or ""),
            "latest_reconnect_reason": str(cached_snapshot.get("latest_reconnect_reason") or ""),
            "subscription_count": enabled_subscription_count,
            "chat_count": chat_count,
            "cached": True,
        }
    linked_account = resolve_linked_ebay_account(path, telegram_user_id, environment)
    account_snapshot = linked_account
    token_set = (
        resolve_ebay_token_set(path, telegram_user_id, environment) if linked_account else None
    )
    with _connect(path) as conn:
        if account_snapshot is None:
            base_query = (
                "SELECT id, telegram_user_id, ebay_user_id, environment, scopes, linked_at, status "
                "FROM ebay_accounts "
                "WHERE telegram_user_id = ?"
            )
            row = None
            if environment:
                row = conn.execute(
                    base_query + " AND environment = ? ORDER BY id DESC LIMIT 1",
                    (telegram_user_id, environment),
                ).fetchone()
            if row is None:
                row = conn.execute(
                    base_query + " ORDER BY id DESC LIMIT 1",
                    (telegram_user_id,),
                ).fetchone()
            if row is not None:
                account_snapshot = LinkedEbayAccount.from_mapping(dict(row))
        if account_snapshot is not None and token_set is None and account_snapshot.id is not None:
            token_row = conn.execute(
                "SELECT id, ebay_account_id, refresh_token_encrypted, access_token, "
                "scope_set, expires_at, updated_at, status "
                "FROM ebay_tokens WHERE ebay_account_id = ? LIMIT 1",
                (account_snapshot.id,),
            ).fetchone()
            if token_row is not None:
                token_set = EbayTokenSet.from_mapping(dict(token_row))
        audit_params: list[object] = [telegram_user_id]
        audit_query = (
            "SELECT outcome, details_json FROM audit_log "
            "WHERE event_type = 'oauth_failure' "
            "AND (target_telegram_user_id = ? OR target_telegram_user_id IS NULL)"
        )
        if environment:
            audit_query += " AND (environment = ? OR environment = '')"
            audit_params.append(environment)
        audit_query += " ORDER BY id DESC LIMIT 1"
        latest_failure = conn.execute(audit_query, tuple(audit_params)).fetchone()
    latest_reconnect_outcome = (
        str(latest_failure["outcome"] or "") if latest_failure is not None else ""
    )
    latest_reconnect_reason = (
        str(latest_failure["details_json"] or "") if latest_failure is not None else ""
    )
    summary: dict[str, object] = {
        "telegram_user_id": telegram_user_id,
        "linked": linked_account is not None,
        "environment": account_snapshot.environment
        if account_snapshot is not None
        else environment,
        "ebay_user_id": account_snapshot.ebay_user_id if account_snapshot is not None else "",
        "account_status": account_snapshot.status if account_snapshot is not None else "unlinked",
        "token_status": token_set.status if token_set is not None else "missing",
        "token_configured": token_set is not None,
        "latest_reconnect_outcome": latest_reconnect_outcome,
        "latest_reconnect_reason": latest_reconnect_reason,
        "subscription_count": enabled_subscription_count,
        "chat_count": chat_count,
        "cached": False,
    }
    save_tenant_account_status_cache(
        path,
        telegram_user_id,
        {
            "linked": bool(summary["linked"]),
            "environment": summary["environment"],
            "ebay_user_id": summary["ebay_user_id"],
            "account_status": summary["account_status"],
            "token_status": summary["token_status"],
            "token_configured": bool(summary["token_configured"]),
            "latest_reconnect_outcome": summary["latest_reconnect_outcome"],
            "latest_reconnect_reason": summary["latest_reconnect_reason"],
        },
    )
    return summary


def _tenant_operational_state(user_status: str, account_status: str, token_status: str) -> str:
    normalized_status = normalize_telegram_user_status(user_status)
    if normalized_status == TELEGRAM_USER_STATUS_PENDING:
        return "pending"
    if normalized_status == TELEGRAM_USER_STATUS_BLOCKED:
        return "blocked"
    if normalized_status == TELEGRAM_USER_STATUS_ADMIN:
        return "admin"
    if account_status == "linked" and token_status == "active":
        return "ready"
    if _account_status_requires_reconnect(account_status, token_status):
        return "reconnect_required"
    return "waiting_connect"


def _last_tenant_activity_at(user: TelegramUser, runtime_state: BotRuntimeState) -> str:
    return (
        runtime_state.memory.last_notified_order_created_at
        or runtime_state.memory.last_seen_order_created_at
        or runtime_state.memory.last_fetch_end
        or user.created_at
        or ""
    )


def save_tenant_status_snapshot(
    path: str,
    telegram_user_id: int,
    snapshot: dict[str, object],
    *,
    updated_at: str,
) -> dict[str, object]:
    init_db(path)
    serialized = _json_dumps(snapshot)
    operational_state = str(snapshot.get("operational_state") or "")
    last_activity_at = str(snapshot.get("last_activity_at") or "")
    with _connect(path) as conn:
        existing = conn.execute(
            "SELECT snapshot_json, operational_state, last_activity_at "
            "FROM tenant_status_snapshots WHERE telegram_user_id = ?",
            (telegram_user_id,),
        ).fetchone()
        if (
            existing is not None
            and str(existing["snapshot_json"] or "") == serialized
            and str(existing["operational_state"] or "") == operational_state
            and str(existing["last_activity_at"] or "") == last_activity_at
        ):
            conn.execute(
                "UPDATE tenant_status_snapshots SET updated_at = ? WHERE telegram_user_id = ?",
                (updated_at, telegram_user_id),
            )
            return snapshot
        conn.execute(
            "INSERT INTO tenant_status_snapshots "
            "(telegram_user_id, snapshot_json, operational_state, last_activity_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?) "
            "ON CONFLICT(telegram_user_id) DO UPDATE SET "
            "snapshot_json = excluded.snapshot_json, "
            "operational_state = excluded.operational_state, "
            "last_activity_at = excluded.last_activity_at, "
            "updated_at = excluded.updated_at",
            (
                telegram_user_id,
                serialized,
                operational_state,
                last_activity_at,
                updated_at,
            ),
        )
    return snapshot


def load_tenant_status_snapshot(path: str, telegram_user_id: int) -> dict[str, object]:
    init_db(path)
    with _connect(path) as conn:
        row = conn.execute(
            "SELECT snapshot_json FROM tenant_status_snapshots WHERE telegram_user_id = ?",
            (telegram_user_id,),
        ).fetchone()
    if row is None:
        return {}
    return _parse_operational_memory_state(str(row["snapshot_json"]))


def load_tenant_status_snapshots(path: str) -> list[dict[str, object]]:
    init_db(path)
    with _connect(path) as conn:
        rows = conn.execute(
            "SELECT snapshot_json FROM tenant_status_snapshots ORDER BY telegram_user_id"
        ).fetchall()
    return [_parse_operational_memory_state(str(row["snapshot_json"])) for row in rows]


def rebuild_tenant_status_snapshot(
    path: str,
    telegram_user_id: int,
    *,
    now_iso: str | None = None,
) -> dict[str, object]:
    user = load_telegram_user(path, telegram_user_id)
    if user is None:
        return {}
    timestamp = now_iso or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    account_status = summarize_tenant_account_status(path, telegram_user_id, "")
    runtime_state = load_tenant_runtime_state(path, telegram_user_id)
    latest_session = load_latest_oauth_link_session(path, telegram_user_id)
    raw_account_status = str(account_status.get("account_status") or "unlinked")
    raw_token_status = str(account_status.get("token_status") or "missing")
    operational_state = _tenant_operational_state(
        user.status,
        raw_account_status,
        raw_token_status,
    )
    last_issue = str(account_status.get("latest_reconnect_outcome") or "")
    if not last_issue and operational_state != "ready":
        last_issue = operational_state
    snapshot: dict[str, object] = {
        "telegram_user_id": user.telegram_user_id,
        "telegram_chat_id": user.telegram_chat_id,
        "username": user.username,
        "display_name": user.display_name,
        "status": user.status,
        "operational_state": operational_state,
        "account_status": account_status.get("account_status"),
        "token_status": account_status.get("token_status"),
        "environment": account_status.get("environment"),
        "ebay_user_id": account_status.get("ebay_user_id"),
        "subscription_count": account_status.get("subscription_count", 0),
        "chat_count": account_status.get("chat_count", 0),
        "last_issue": last_issue or "none",
        "last_activity_at": _last_tenant_activity_at(user, runtime_state),
        "created_at": user.created_at or "",
        "last_fetch_end": runtime_state.memory.last_fetch_end,
        "last_seen_order_id": runtime_state.memory.last_seen_order_id,
        "last_seen_order_created_at": runtime_state.memory.last_seen_order_created_at,
        "last_notified_order_id": runtime_state.memory.last_notified_order_id,
        "last_notified_order_created_at": runtime_state.memory.last_notified_order_created_at,
        "latest_session_status": latest_session.status if latest_session is not None else "",
        "latest_session_expires_at": (
            latest_session.expires_at if latest_session is not None else ""
        ),
    }
    return save_tenant_status_snapshot(path, telegram_user_id, snapshot, updated_at=timestamp)


def rebuild_all_tenant_status_snapshots(path: str, *, now_iso: str | None = None) -> dict[str, int]:
    init_db(path)
    users = load_telegram_users(path)
    rebuilt = 0
    for user in users:
        if rebuild_tenant_status_snapshot(path, user.telegram_user_id, now_iso=now_iso):
            rebuilt += 1
    with _connect(path) as conn:
        cursor = conn.execute(
            "DELETE FROM tenant_status_snapshots "
            "WHERE telegram_user_id NOT IN (SELECT telegram_user_id FROM telegram_users)"
        )
    return {
        "users_scanned": len(users),
        "snapshots_rebuilt": rebuilt,
        "snapshots_deleted": int(cursor.rowcount if cursor.rowcount is not None else 0),
    }


def summarize_tenant_status_snapshots(
    path: str,
    *,
    stale_before_iso: str | None = None,
) -> dict[str, int]:
    init_db(path)
    with _connect(path) as conn:
        total = as_int(conn.execute("SELECT COUNT(*) FROM tenant_status_snapshots").fetchone()[0])
        ready = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM tenant_status_snapshots WHERE operational_state = 'ready'"
            ).fetchone()[0]
        )
        reconnect_required = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM tenant_status_snapshots "
                "WHERE operational_state = 'reconnect_required'"
            ).fetchone()[0]
        )
        waiting_connect = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM tenant_status_snapshots "
                "WHERE operational_state = 'waiting_connect'"
            ).fetchone()[0]
        )
        stale = 0
        if stale_before_iso:
            stale = as_int(
                conn.execute(
                    "SELECT COUNT(*) FROM tenant_status_snapshots WHERE updated_at < ?",
                    (stale_before_iso,),
                ).fetchone()[0]
            )
    return {
        "total": total,
        "ready": ready,
        "reconnect_required": reconnect_required,
        "waiting_connect": waiting_connect,
        "stale": stale,
    }


def create_oauth_link_session(path: str, session: OauthLinkSession) -> OauthLinkSession:
    init_db(path)
    with _connect(path) as conn:
        cursor = conn.execute(
            "INSERT INTO oauth_link_sessions "
            "("
            "telegram_user_id, telegram_chat_id, provider, environment, oauth_state, "
            "code_verifier, "
            "redirect_uri, status, expires_at, created_at"
            ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                session.telegram_user_id,
                session.telegram_chat_id,
                session.provider,
                session.environment,
                session.oauth_state,
                session.code_verifier,
                session.redirect_uri,
                session.status,
                session.expires_at,
                session.created_at,
            ),
        )
        if cursor.lastrowid is None:
            raise RuntimeError("Inserimento sessione OAuth fallito: lastrowid mancante.")
        session.id = int(cursor.lastrowid)
    return session


def load_latest_oauth_link_session(
    path: str,
    telegram_user_id: int,
    provider: str = "ebay",
) -> OauthLinkSession | None:
    init_db(path)
    with _connect(path) as conn:
        row = conn.execute(
            "SELECT id, telegram_user_id, telegram_chat_id, provider, environment, oauth_state, "
            "code_verifier, redirect_uri, status, expires_at, created_at "
            "FROM oauth_link_sessions "
            "WHERE telegram_user_id = ? AND provider = ? "
            "ORDER BY id DESC LIMIT 1",
            (telegram_user_id, provider),
        ).fetchone()
        if row is None:
            return None
    return OauthLinkSession.from_mapping(dict(row))


def load_oauth_link_session_by_state(
    path: str,
    oauth_state: str,
    provider: str = "ebay",
) -> OauthLinkSession | None:
    init_db(path)
    with _connect(path) as conn:
        row = conn.execute(
            "SELECT id, telegram_user_id, telegram_chat_id, provider, environment, oauth_state, "
            "code_verifier, redirect_uri, status, expires_at, created_at "
            "FROM oauth_link_sessions "
            "WHERE oauth_state = ? AND provider = ? "
            "LIMIT 1",
            (oauth_state, provider),
        ).fetchone()
        if row is None:
            return None
    return OauthLinkSession.from_mapping(dict(row))


def update_oauth_link_session(
    path: str,
    oauth_state: str,
    *,
    status: str | None = None,
    redirect_uri: str | None = None,
) -> None:
    init_db(path)
    assignments: list[str] = []
    params: list[object] = []
    if status is not None:
        assignments.append("status = ?")
        params.append(status)
    if redirect_uri is not None:
        assignments.append("redirect_uri = ?")
        params.append(redirect_uri)
    if not assignments:
        return
    params.append(oauth_state)
    with _connect(path) as conn:
        conn.execute(
            f"UPDATE oauth_link_sessions SET {', '.join(assignments)} WHERE oauth_state = ?",
            tuple(params),
        )


def disconnect_linked_ebay_account(
    path: str,
    telegram_user_id: int,
    environment: str | None = None,
) -> LinkedEbayAccount | None:
    account = resolve_linked_ebay_account(path, telegram_user_id, environment)
    if account is None or account.id is None:
        return None

    init_db(path)
    with _connect(path) as conn:
        conn.execute(
            "UPDATE ebay_accounts SET status = ? WHERE id = ?",
            (EBAY_ACCOUNT_STATUS_DISCONNECTED, account.id),
        )
        conn.execute(
            "UPDATE ebay_tokens "
            "SET refresh_token_encrypted = '', access_token = '', status = 'revoked', "
            "updated_at = CURRENT_TIMESTAMP "
            "WHERE ebay_account_id = ?",
            (account.id,),
        )
        conn.execute(
            "UPDATE oauth_link_sessions SET status = ? "
            "WHERE telegram_user_id = ? AND provider = 'ebay' AND status = ?",
            (OAUTH_SESSION_STATUS_CANCELLED, telegram_user_id, OAUTH_SESSION_STATUS_PENDING),
        )

    account.status = EBAY_ACCOUNT_STATUS_DISCONNECTED
    return account


def upsert_notification_subscription(path: str, subscription: NotificationSubscription) -> None:
    init_db(path)
    with _connect(path) as conn:
        conn.execute(
            "INSERT INTO notification_subscriptions "
            "(telegram_user_id, telegram_chat_id, enabled, filters, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(telegram_user_id, telegram_chat_id) DO UPDATE SET "
            "enabled = excluded.enabled, "
            "filters = excluded.filters, "
            "created_at = COALESCE(notification_subscriptions.created_at, excluded.created_at), "
            "updated_at = excluded.updated_at",
            (
                subscription.telegram_user_id,
                subscription.telegram_chat_id,
                int(subscription.enabled),
                subscription.filters,
                subscription.created_at,
                subscription.updated_at or subscription.created_at,
            ),
        )


def load_notification_subscriptions(path: str) -> list[NotificationSubscription]:
    init_db(path)
    subscriptions: list[NotificationSubscription] = []
    with _connect(path) as conn:
        for row in conn.execute(
            "SELECT id, telegram_user_id, telegram_chat_id, enabled, filters, "
            "created_at, updated_at "
            "FROM notification_subscriptions ORDER BY telegram_user_id, telegram_chat_id"
        ):
            subscriptions.append(NotificationSubscription.from_mapping(dict(row)))
    return subscriptions


def set_notification_subscription_enabled(
    path: str,
    telegram_user_id: int,
    telegram_chat_id: int,
    enabled: bool,
    *,
    filters: str | None = None,
    created_at: str,
    updated_at: str,
) -> NotificationSubscription:
    preserved_filters = filters
    if preserved_filters is None:
        init_db(path)
        with _connect(path) as conn:
            existing_row = conn.execute(
                "SELECT filters FROM notification_subscriptions "
                "WHERE telegram_user_id = ? AND telegram_chat_id = ? "
                "LIMIT 1",
                (telegram_user_id, telegram_chat_id),
            ).fetchone()
            if existing_row is not None:
                preserved_filters = str(existing_row["filters"] or "")
    if preserved_filters is None:
        preserved_filters = ""
    subscription = NotificationSubscription(
        telegram_user_id=telegram_user_id,
        telegram_chat_id=telegram_chat_id,
        enabled=enabled,
        filters=preserved_filters,
        created_at=created_at,
        updated_at=updated_at,
    )
    upsert_notification_subscription(path, subscription)
    init_db(path)
    with _connect(path) as conn:
        conn.execute(
            "UPDATE telegram_chats "
            "SET notifications_enabled = ?, updated_at = ? "
            "WHERE telegram_user_id = ? AND telegram_chat_id = ?",
            (int(enabled), updated_at, telegram_user_id, telegram_chat_id),
        )
    return subscription


def resolve_tenant_chat_context(
    path: str,
    telegram_chat_id: int,
    telegram_user_id: int | None = None,
) -> TenantChatContext | None:
    init_db(path)
    with _connect(path) as conn:
        params: list[object] = [telegram_chat_id]
        query = (
            "SELECT c.telegram_user_id, c.telegram_chat_id, c.notifications_enabled, "
            "a.environment "
            "FROM telegram_chats AS c "
            "LEFT JOIN ebay_accounts AS a "
            "ON a.telegram_user_id = c.telegram_user_id AND a.status = 'linked' "
            "WHERE c.telegram_chat_id = ?"
        )
        if telegram_user_id is not None:
            query += " AND c.telegram_user_id = ?"
            params.append(telegram_user_id)
        query += (
            " ORDER BY "
            "CASE WHEN a.environment IS NULL THEN 1 ELSE 0 END, "
            "CASE WHEN c.is_primary = 1 THEN 0 ELSE 1 END, "
            "c.telegram_user_id, a.environment "
            "LIMIT 1"
        )
        row = conn.execute(query, tuple(params)).fetchone()
        if row is None:
            return None
    return TenantChatContext.from_mapping(dict(row))


def list_notification_tenants(path: str) -> list[NotificationTenantTarget]:
    init_db(path)
    grouped: dict[tuple[int, str], set[int]] = {}
    with _connect(path) as conn:
        rows = conn.execute(
            "SELECT s.telegram_user_id, s.telegram_chat_id, a.environment "
            "FROM notification_subscriptions AS s "
            "JOIN ebay_accounts AS a "
            "ON a.telegram_user_id = s.telegram_user_id "
            "WHERE s.enabled = 1 AND a.status = 'linked' "
            "ORDER BY s.telegram_user_id, a.environment, s.telegram_chat_id"
        ).fetchall()
        for row in rows:
            key = (int(row["telegram_user_id"]), str(row["environment"]))
            grouped.setdefault(key, set()).add(int(row["telegram_chat_id"]))
    return [
        NotificationTenantTarget(
            telegram_user_id=telegram_user_id,
            environment=environment,
            notify_chat_ids=chat_ids,
        )
        for (telegram_user_id, environment), chat_ids in grouped.items()
    ]


def expire_stale_oauth_link_sessions(path: str, *, now_iso: str) -> int:
    init_db(path)
    with _connect(path) as conn:
        conn.execute(
            "UPDATE oauth_link_sessions "
            "SET status = ? "
            "WHERE status = ? AND expires_at IS NOT NULL AND expires_at <= ?",
            (OAUTH_SESSION_STATUS_EXPIRED, OAUTH_SESSION_STATUS_PENDING, now_iso),
        )
        return conn.total_changes


def prune_audit_log_entries(path: str, *, cutoff_iso: str) -> int:
    init_db(path)
    with _connect(path) as conn:
        cursor = conn.execute(
            "DELETE FROM audit_log WHERE created_at < ?",
            (cutoff_iso,),
        )
        return int(cursor.rowcount if cursor.rowcount is not None else 0)


def prune_oauth_link_sessions(
    path: str,
    *,
    terminal_cutoff_iso: str,
    pending_cutoff_iso: str,
) -> dict[str, int]:
    init_db(path)
    terminal_statuses = (
        OAUTH_SESSION_STATUS_COMPLETED,
        OAUTH_SESSION_STATUS_FAILED,
        OAUTH_SESSION_STATUS_EXPIRED,
        OAUTH_SESSION_STATUS_CANCELLED,
    )
    with _connect(path) as conn:
        placeholders = ", ".join("?" for _ in terminal_statuses)
        terminal_cursor = conn.execute(
            f"DELETE FROM oauth_link_sessions WHERE status IN ({placeholders}) AND created_at < ?",
            (*terminal_statuses, terminal_cutoff_iso),
        )
        pending_cursor = conn.execute(
            "DELETE FROM oauth_link_sessions WHERE status = ? AND created_at < ?",
            (OAUTH_SESSION_STATUS_PENDING, pending_cutoff_iso),
        )
    terminal_deleted = int(terminal_cursor.rowcount) if terminal_cursor.rowcount is not None else 0
    pending_deleted = int(pending_cursor.rowcount) if pending_cursor.rowcount is not None else 0
    return {
        "terminal_deleted": terminal_deleted,
        "pending_deleted": pending_deleted,
        "deleted": terminal_deleted + pending_deleted,
    }


def prune_operation_queue_entries(path: str, *, cutoff_iso: str) -> int:
    init_db(path)
    terminal_statuses = (OPERATION_STATUS_COMPLETED, OPERATION_STATUS_CANCELLED)
    with _connect(path) as conn:
        placeholders = ", ".join("?" for _ in terminal_statuses)
        cursor = conn.execute(
            f"DELETE FROM operation_queue WHERE status IN ({placeholders}) AND created_at < ?",
            (*terminal_statuses, cutoff_iso),
        )
        return int(cursor.rowcount if cursor.rowcount is not None else 0)


def save_retention_prune_status(
    path: str,
    *,
    now_iso: str,
    audit_retention_days: int,
    oauth_session_retention_days: int,
    operation_queue_retention_days: int,
    audit_deleted: int,
    oauth_deleted: int,
    oauth_pending_deleted: int,
    oauth_terminal_deleted: int,
    operation_queue_deleted: int,
) -> dict[str, object]:
    status: dict[str, object] = {
        "last_pruned_at": now_iso,
        "audit_retention_days": audit_retention_days,
        "oauth_session_retention_days": oauth_session_retention_days,
        "operation_queue_retention_days": operation_queue_retention_days,
        "audit_deleted": audit_deleted,
        "oauth_deleted": oauth_deleted,
        "oauth_pending_deleted": oauth_pending_deleted,
        "oauth_terminal_deleted": oauth_terminal_deleted,
        "operation_queue_deleted": operation_queue_deleted,
    }
    save_kv_value(
        path,
        "retention_pruning:last_status",
        json.dumps(status, ensure_ascii=False, sort_keys=True),
    )
    save_kv_value(path, "retention_pruning:last_pruned_at", now_iso)
    return status


def load_retention_prune_status(path: str) -> dict[str, object]:
    raw_status = load_kv_value(path, "retention_pruning:last_status")
    if not raw_status:
        raw_timestamp = load_kv_value(path, "retention_pruning:last_pruned_at")
        return {"last_pruned_at": raw_timestamp or ""}
    try:
        decoded = json.loads(raw_status)
    except json.JSONDecodeError:
        return {"last_pruned_at": ""}
    return decoded if isinstance(decoded, dict) else {"last_pruned_at": ""}


def summarize_retention_backlog(
    path: str,
    *,
    audit_cutoff_iso: str,
    oauth_terminal_cutoff_iso: str,
    oauth_pending_cutoff_iso: str,
    operation_queue_cutoff_iso: str | None = None,
) -> dict[str, object]:
    init_db(path)
    terminal_statuses = (
        OAUTH_SESSION_STATUS_COMPLETED,
        OAUTH_SESSION_STATUS_FAILED,
        OAUTH_SESSION_STATUS_EXPIRED,
        OAUTH_SESSION_STATUS_CANCELLED,
    )
    with _connect(path) as conn:
        audit_overdue = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM audit_log WHERE created_at < ?",
                (audit_cutoff_iso,),
            ).fetchone()[0]
        )
        placeholders = ", ".join("?" for _ in terminal_statuses)
        oauth_terminal_overdue = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM oauth_link_sessions "
                f"WHERE status IN ({placeholders}) AND created_at < ?",
                (*terminal_statuses, oauth_terminal_cutoff_iso),
            ).fetchone()[0]
        )
        oauth_pending_overdue = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM oauth_link_sessions WHERE status = ? AND created_at < ?",
                (OAUTH_SESSION_STATUS_PENDING, oauth_pending_cutoff_iso),
            ).fetchone()[0]
        )
        operation_queue_overdue = 0
        if operation_queue_cutoff_iso:
            operation_queue_overdue = as_int(
                conn.execute(
                    "SELECT COUNT(*) FROM operation_queue "
                    "WHERE status IN (?, ?) AND created_at < ?",
                    (
                        OPERATION_STATUS_COMPLETED,
                        OPERATION_STATUS_CANCELLED,
                        operation_queue_cutoff_iso,
                    ),
                ).fetchone()[0]
            )
        oldest_audit = conn.execute(
            "SELECT created_at FROM audit_log ORDER BY created_at ASC LIMIT 1"
        ).fetchone()
        oldest_oauth = conn.execute(
            "SELECT created_at FROM oauth_link_sessions ORDER BY created_at ASC LIMIT 1"
        ).fetchone()
    last_status = load_retention_prune_status(path)
    return {
        "last_pruned_at": str(last_status.get("last_pruned_at") or ""),
        "last_audit_deleted": as_int(last_status.get("audit_deleted", 0)),
        "last_oauth_deleted": as_int(last_status.get("oauth_deleted", 0)),
        "last_operation_queue_deleted": as_int(last_status.get("operation_queue_deleted", 0)),
        "audit_overdue": audit_overdue,
        "oauth_terminal_overdue": oauth_terminal_overdue,
        "oauth_pending_overdue": oauth_pending_overdue,
        "operation_queue_overdue": operation_queue_overdue,
        "oldest_audit_created_at": str(oldest_audit["created_at"] or "")
        if oldest_audit is not None
        else "",
        "oldest_oauth_created_at": str(oldest_oauth["created_at"] or "")
        if oldest_oauth is not None
        else "",
    }


def summarize_oauth_link_sessions(path: str, *, now_iso: str) -> dict[str, object]:
    init_db(path)
    summary: dict[str, object] = {
        "pending_active": 0,
        "pending_expired": 0,
        "expired": 0,
        "failed": 0,
        "completed": 0,
        "oldest_pending_user_id": None,
        "oldest_pending_created_at": "",
        "oldest_pending_expires_at": "",
        "oldest_pending_state": "",
    }
    with _connect(path) as conn:
        summary["pending_active"] = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM oauth_link_sessions "
                "WHERE status = ? AND (expires_at IS NULL OR expires_at > ?)",
                (OAUTH_SESSION_STATUS_PENDING, now_iso),
            ).fetchone()[0]
        )
        summary["pending_expired"] = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM oauth_link_sessions "
                "WHERE status = ? AND expires_at IS NOT NULL AND expires_at <= ?",
                (OAUTH_SESSION_STATUS_PENDING, now_iso),
            ).fetchone()[0]
        )
        summary["expired"] = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM oauth_link_sessions WHERE status = ?",
                (OAUTH_SESSION_STATUS_EXPIRED,),
            ).fetchone()[0]
        )
        summary["failed"] = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM oauth_link_sessions WHERE status = ?",
                (OAUTH_SESSION_STATUS_FAILED,),
            ).fetchone()[0]
        )
        summary["completed"] = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM oauth_link_sessions WHERE status = ?",
                (OAUTH_SESSION_STATUS_COMPLETED,),
            ).fetchone()[0]
        )
        oldest_pending = conn.execute(
            "SELECT telegram_user_id, created_at, expires_at, oauth_state "
            "FROM oauth_link_sessions "
            "WHERE status = ? "
            "ORDER BY created_at ASC, id ASC LIMIT 1",
            (OAUTH_SESSION_STATUS_PENDING,),
        ).fetchone()
        if oldest_pending is not None:
            summary["oldest_pending_user_id"] = as_int(oldest_pending["telegram_user_id"])
            summary["oldest_pending_created_at"] = str(oldest_pending["created_at"] or "")
            summary["oldest_pending_expires_at"] = str(oldest_pending["expires_at"] or "")
            summary["oldest_pending_state"] = str(oldest_pending["oauth_state"] or "")
    return summary


def reconcile_account_token_consistency(path: str) -> int:
    init_db(path)
    with _connect(path) as conn:
        conn.execute(
            "UPDATE ebay_tokens "
            "SET refresh_token_encrypted = '', access_token = '', status = 'revoked', "
            "updated_at = CURRENT_TIMESTAMP "
            "WHERE status = 'active' AND ebay_account_id IN ("
            "SELECT id FROM ebay_accounts WHERE status != ?"
            ")",
            (EBAY_ACCOUNT_STATUS_LINKED,),
        )
        return conn.total_changes


def export_tenant_data(path: str, telegram_user_id: int) -> dict[str, object]:
    init_db(path)
    runtime_state = load_tenant_runtime_state(path, telegram_user_id)
    retry_entries = load_tenant_retry_queue_entries(path, telegram_user_id)
    with _connect(path) as conn:
        user_row = conn.execute(
            "SELECT telegram_user_id, username, display_name, status, created_at, updated_at "
            "FROM telegram_users WHERE telegram_user_id = ? LIMIT 1",
            (telegram_user_id,),
        ).fetchone()
        chat_rows = conn.execute(
            "SELECT telegram_user_id, telegram_chat_id, chat_type, is_primary, "
            "notifications_enabled, created_at, updated_at "
            "FROM telegram_chats WHERE telegram_user_id = ? ORDER BY telegram_chat_id",
            (telegram_user_id,),
        ).fetchall()
        account_rows = conn.execute(
            "SELECT id, telegram_user_id, ebay_user_id, environment, scopes, linked_at, status "
            "FROM ebay_accounts WHERE telegram_user_id = ? ORDER BY environment",
            (telegram_user_id,),
        ).fetchall()
        token_rows = conn.execute(
            "SELECT t.id, t.ebay_account_id, a.environment, t.refresh_token_encrypted, "
            "t.access_token, t.scope_set, t.expires_at, t.updated_at, t.status "
            "FROM ebay_tokens AS t "
            "JOIN ebay_accounts AS a ON a.id = t.ebay_account_id "
            "WHERE a.telegram_user_id = ? ORDER BY a.environment",
            (telegram_user_id,),
        ).fetchall()
        subscription_rows = conn.execute(
            "SELECT telegram_user_id, telegram_chat_id, enabled, filters, created_at, updated_at "
            "FROM notification_subscriptions "
            "WHERE telegram_user_id = ? ORDER BY telegram_chat_id",
            (telegram_user_id,),
        ).fetchall()
        oauth_rows = conn.execute(
            "SELECT telegram_user_id, telegram_chat_id, provider, environment, oauth_state, "
            "redirect_uri, status, expires_at, created_at "
            "FROM oauth_link_sessions WHERE telegram_user_id = ? ORDER BY id DESC",
            (telegram_user_id,),
        ).fetchall()
        audit_rows = conn.execute(
            "SELECT id, event_type, actor_telegram_user_id, target_telegram_user_id, "
            "telegram_chat_id, ebay_user_id, environment, outcome, details_json, created_at "
            "FROM audit_log WHERE target_telegram_user_id = ? "
            "ORDER BY id DESC LIMIT 100",
            (telegram_user_id,),
        ).fetchall()

    linked_account = next((row for row in account_rows if row["status"] == "linked"), None)
    account_snapshot = linked_account or (account_rows[0] if account_rows else None)
    token_snapshot = next(
        (
            row
            for row in token_rows
            if account_snapshot is not None and row["ebay_account_id"] == account_snapshot["id"]
        ),
        None,
    )
    account_status = {
        "telegram_user_id": telegram_user_id,
        "linked": linked_account is not None,
        "environment": account_snapshot["environment"] if account_snapshot is not None else "",
        "ebay_user_id": account_snapshot["ebay_user_id"] if account_snapshot is not None else "",
        "account_status": account_snapshot["status"]
        if account_snapshot is not None
        else "unlinked",
        "token_status": token_snapshot["status"] if token_snapshot is not None else "missing",
        "token_configured": token_snapshot is not None,
        "subscription_count": sum(1 for row in subscription_rows if row["enabled"]),
        "chat_count": len(chat_rows),
        "cached": False,
    }

    return {
        "telegram_user_id": telegram_user_id,
        "user": dict(user_row) if user_row is not None else None,
        "chats": [dict(row) for row in chat_rows],
        "ebay_accounts": [dict(row) for row in account_rows],
        "ebay_tokens": [
            {
                "id": row["id"],
                "ebay_account_id": row["ebay_account_id"],
                "environment": row["environment"],
                "refresh_token_configured": bool(row["refresh_token_encrypted"]),
                "access_token_configured": bool(row["access_token"]),
                "scope_set": row["scope_set"],
                "expires_at": row["expires_at"],
                "updated_at": row["updated_at"],
                "status": row["status"],
            }
            for row in token_rows
        ],
        "notification_subscriptions": [dict(row) for row in subscription_rows],
        "oauth_link_sessions": [dict(row) for row in oauth_rows],
        "runtime_state": runtime_state.as_dict(),
        "tenant_retry_queue": [entry.as_dict() for entry in retry_entries],
        "account_status": account_status,
        "recent_audit_log": [dict(row) for row in audit_rows],
    }


def delete_tenant_data(path: str, telegram_user_id: int) -> dict[str, int]:
    init_db(path)
    deleted: dict[str, int] = {}

    def store_count(name: str, cursor: sqlite3.Cursor) -> None:
        deleted[name] = int(cursor.rowcount if cursor.rowcount is not None else 0)

    with _connect(path) as conn:
        store_count(
            "ebay_tokens",
            conn.execute(
                "DELETE FROM ebay_tokens WHERE ebay_account_id IN ("
                "SELECT id FROM ebay_accounts WHERE telegram_user_id = ?"
                ")",
                (telegram_user_id,),
            ),
        )
        for table in (
            "ebay_accounts",
            "notification_subscriptions",
            "telegram_chats",
            "tenant_runtime_state",
            "tenant_status_snapshots",
            "tenant_notified_order_ids",
            "tenant_notified_hashes",
            "tenant_retry_queue",
            "oauth_link_sessions",
        ):
            store_count(
                table,
                conn.execute(
                    f"DELETE FROM {table} WHERE telegram_user_id = ?",
                    (telegram_user_id,),
                ),
            )
        store_count(
            "operation_queue",
            conn.execute(
                "DELETE FROM operation_queue WHERE target_telegram_user_id = ?",
                (telegram_user_id,),
            ),
        )
        store_count(
            "telegram_users",
            conn.execute(
                "DELETE FROM telegram_users WHERE telegram_user_id = ?",
                (telegram_user_id,),
            ),
        )
    deleted["total"] = sum(deleted.values())
    return deleted


def summarize_operation_queue(path: str) -> dict[str, int]:
    init_db(path)
    with _connect(path) as conn:
        pending = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM operation_queue WHERE status = ?",
                (OPERATION_STATUS_PENDING,),
            ).fetchone()[0]
        )
        running = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM operation_queue WHERE status = ?",
                (OPERATION_STATUS_RUNNING,),
            ).fetchone()[0]
        )
        failed = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM operation_queue WHERE status = ?",
                (OPERATION_STATUS_FAILED,),
            ).fetchone()[0]
        )
        completed = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM operation_queue WHERE status = ?",
                (OPERATION_STATUS_COMPLETED,),
            ).fetchone()[0]
        )
        cancelled = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM operation_queue WHERE status = ?",
                (OPERATION_STATUS_CANCELLED,),
            ).fetchone()[0]
        )
    return {
        "pending": pending,
        "running": running,
        "failed": failed,
        "completed": completed,
        "cancelled": cancelled,
    }


def summarize_multi_tenant_readiness(path: str) -> dict[str, int]:
    init_db(path)
    with _connect(path) as conn:
        tenant_users = as_int(conn.execute("SELECT COUNT(*) FROM telegram_users").fetchone()[0])
        approved_users = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM telegram_users "
                "WHERE status IN ('approved', 'admin', 'active')"
            ).fetchone()[0]
        )
        pending_users = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM telegram_users WHERE status IN ('pending', 'new')"
            ).fetchone()[0]
        )
        blocked_users = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM telegram_users WHERE status IN ('blocked', 'rejected')"
            ).fetchone()[0]
        )
        tenant_chats = as_int(conn.execute("SELECT COUNT(*) FROM telegram_chats").fetchone()[0])
        linked_accounts = as_int(
            conn.execute("SELECT COUNT(*) FROM ebay_accounts WHERE status = 'linked'").fetchone()[0]
        )
        active_token_sets = as_int(
            conn.execute(
                "SELECT COUNT(*) "
                "FROM ebay_tokens AS t "
                "JOIN ebay_accounts AS a ON a.id = t.ebay_account_id "
                "WHERE t.status = 'active' AND a.status = 'linked'"
            ).fetchone()[0]
        )
        notification_subscriptions = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM notification_subscriptions WHERE enabled = 1"
            ).fetchone()[0]
        )
        tenant_runtime_states = as_int(
            conn.execute("SELECT COUNT(*) FROM tenant_runtime_state").fetchone()[0]
        )
    return {
        "tenant_users": tenant_users,
        "approved_users": approved_users,
        "pending_users": pending_users,
        "blocked_users": blocked_users,
        "tenant_chats": tenant_chats,
        "linked_accounts": linked_accounts,
        "active_token_sets": active_token_sets,
        "notification_subscriptions": notification_subscriptions,
        "tenant_runtime_states": tenant_runtime_states,
    }
