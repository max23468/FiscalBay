"""SQLite storage for bot runtime state."""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from types import TracebackType
from typing import Iterable, Literal, TypedDict

from ..models import (
    CAPABILITY_MANAGE_NOTIFICATIONS,
    EBAY_ACCOUNT_STATUS_DISCONNECTED,
    EBAY_ACCOUNT_STATUS_LINKED,
    OAUTH_SESSION_STATUS_CANCELLED,
    OAUTH_SESSION_STATUS_EXPIRED,
    OAUTH_SESSION_STATUS_PENDING,
    OPERATION_STATUS_FAILED,
    OPERATION_STATUS_PENDING,
    OPERATION_STATUS_RUNNING,
    AuditLogEntry,
    BotMetrics,
    BotRuntimeState,
    EbayTokenSet,
    LinkedEbayAccount,
    NotificationSubscription,
    NotificationTenantTarget,
    OauthLinkSession,
    OperationQueueEntry,
    RetryQueueEntry,
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


class MetricsState(TypedDict):
    orders_read: int
    orders_with_cf: int
    notifications_sent: int
    telegram_retries: int
    consecutive_error_cycles: int
    errors_by_type: dict[str, int]


class BotState(TypedDict):
    notified_order_ids: list[str]
    notified_hashes: list[str]
    last_check: str | None
    last_error: str | None
    metrics: MetricsState


class RetryQueueItem(TypedDict, total=False):
    id: int
    chat_id: int
    text: str
    attempts: int


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

    state: BotState = {
        "notified_order_ids": _unique_preserving_order(legacy.get("notified_order_ids", [])),
        "notified_hashes": _unique_preserving_order(legacy.get("notified_hashes", [])),
        "last_check": str(legacy["last_check"]) if legacy.get("last_check") else None,
        "last_error": str(legacy["last_error"]) if legacy.get("last_error") else None,
        "metrics": _default_metrics_state(),
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

    queue: list[RetryQueueItem] = []
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


def _normalize_retry_item(item: RetryQueueItem) -> RetryQueueItem:
    normalized: RetryQueueItem = {
        "chat_id": int(item["chat_id"]),
        "text": str(item["text"]),
        "attempts": int(item.get("attempts", 0)),
    }
    if item.get("id") is not None:
        normalized["id"] = int(item["id"])
    return normalized


def _sync_retry_queue(conn: sqlite3.Connection, queue: list[RetryQueueItem]) -> None:
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


def _default_metrics_state() -> MetricsState:
    return {
        "orders_read": 0,
        "orders_with_cf": 0,
        "notifications_sent": 0,
        "telegram_retries": 0,
        "consecutive_error_cycles": 0,
        "errors_by_type": {},
    }


def _parse_metrics_state(raw_value: str) -> MetricsState:
    decoded = json.loads(raw_value)
    if not isinstance(decoded, dict):
        return _default_metrics_state()
    errors = decoded.get("errors_by_type", {})
    normalized_errors: dict[str, int] = {}
    if isinstance(errors, dict):
        normalized_errors = {str(key): int(value) for key, value in errors.items()}
    return {
        "orders_read": int(decoded.get("orders_read", 0)),
        "orders_with_cf": int(decoded.get("orders_with_cf", 0)),
        "notifications_sent": int(decoded.get("notifications_sent", 0)),
        "telegram_retries": int(decoded.get("telegram_retries", 0)),
        "consecutive_error_cycles": int(decoded.get("consecutive_error_cycles", 0)),
        "errors_by_type": normalized_errors,
    }


def _state_to_model(state: BotState) -> BotRuntimeState:
    return BotRuntimeState(
        notified_order_ids=list(state["notified_order_ids"]),
        notified_hashes=list(state["notified_hashes"]),
        last_check=state["last_check"],
        last_error=state["last_error"],
        metrics=BotMetrics.from_mapping(state["metrics"]),
    )


def _state_from_model(state: BotRuntimeState) -> BotState:
    return {
        "notified_order_ids": list(state.notified_order_ids),
        "notified_hashes": list(state.notified_hashes),
        "last_check": state.last_check,
        "last_error": state.last_error,
        "metrics": {
            "orders_read": state.metrics.orders_read,
            "orders_with_cf": state.metrics.orders_with_cf,
            "notifications_sent": state.metrics.notifications_sent,
            "telegram_retries": state.metrics.telegram_retries,
            "consecutive_error_cycles": state.metrics.consecutive_error_cycles,
            "errors_by_type": dict(state.metrics.errors_by_type),
        },
    }


def _retry_entry_to_model(item: RetryQueueItem) -> RetryQueueEntry:
    return RetryQueueEntry(
        id=item.get("id"),
        chat_id=item["chat_id"],
        text=item["text"],
        attempts=item["attempts"],
    )


def _retry_entry_from_model(item: RetryQueueEntry) -> RetryQueueItem:
    payload: RetryQueueItem = {
        "chat_id": item.chat_id,
        "text": item.text,
        "attempts": item.attempts,
    }
    if item.id is not None:
        payload["id"] = item.id
    return payload


def load_state(path: str) -> BotState:
    _migrate_legacy_json_state(path)
    init_db(path)
    state: BotState = {
        "notified_order_ids": [],
        "notified_hashes": [],
        "last_check": None,
        "last_error": None,
        "metrics": _default_metrics_state(),
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
    return state


def save_state(path: str, state: BotState) -> None:
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


def load_retry_queue(path: str) -> list[RetryQueueItem]:
    _migrate_legacy_json_retry_queue(path)
    init_db(path)
    queue: list[RetryQueueItem] = []
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


def save_retry_queue(path: str, queue: list[RetryQueueItem]) -> None:
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
            "SELECT last_check, last_error, metrics_json "
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
            "INSERT OR REPLACE INTO tenant_runtime_state "
            "(telegram_user_id, last_check, last_error, metrics_json, updated_at) "
            "VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
            (
                telegram_user_id,
                state.last_check,
                state.last_error,
                json.dumps(state.metrics.as_dict()),
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
    for chat in load_telegram_chats(path):
        if chat.telegram_user_id != telegram_user_id:
            continue
        enabled = notifications_allowed and chat.telegram_chat_id in notify_chat_ids
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
            "linked_at = COALESCE(ebay_accounts.linked_at, excluded.linked_at), "
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


def summarize_tenant_account_status(
    path: str,
    telegram_user_id: int,
    environment: str | None = None,
) -> dict[str, object]:
    init_db(path)
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
    subscriptions = load_notification_subscriptions(path)
    latest_reconnect_outcome = ""
    latest_reconnect_reason = ""
    for entry in load_audit_log_entries(path, limit=200):
        if entry.event_type != "oauth_failure":
            continue
        if entry.target_telegram_user_id not in {None, telegram_user_id}:
            continue
        if environment and entry.environment and entry.environment != environment:
            continue
        latest_reconnect_outcome = entry.outcome
        latest_reconnect_reason = entry.details_json
        break
    enabled_subscription_count = sum(
        1
        for subscription in subscriptions
        if subscription.telegram_user_id == telegram_user_id and subscription.enabled
    )
    chats = load_telegram_chats(path)
    chat_count = sum(1 for chat in chats if chat.telegram_user_id == telegram_user_id)
    return {
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
    created_at: str,
    updated_at: str,
) -> NotificationSubscription:
    subscription = NotificationSubscription(
        telegram_user_id=telegram_user_id,
        telegram_chat_id=telegram_chat_id,
        enabled=enabled,
        filters="",
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
    return {
        "pending": pending,
        "running": running,
        "failed": failed,
    }


def summarize_multi_tenant_readiness(path: str) -> dict[str, int]:
    init_db(path)
    with _connect(path) as conn:
        tenant_users = as_int(conn.execute("SELECT COUNT(*) FROM telegram_users").fetchone()[0])
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
        "tenant_chats": tenant_chats,
        "linked_accounts": linked_accounts,
        "active_token_sets": active_token_sets,
        "notification_subscriptions": notification_subscriptions,
        "tenant_runtime_states": tenant_runtime_states,
    }
