"""SQLite storage for bot runtime state."""

from __future__ import annotations

import json
import os
import sqlite3
from typing import Iterable, TypedDict

from ..models import (
    BotMetrics,
    BotRuntimeState,
    EbayTokenSet,
    LinkedEbayAccount,
    NotificationSubscription,
    NotificationTenantTarget,
    RetryQueueEntry,
    TelegramChat,
    TelegramUser,
    TenantChatContext,
    as_int,
)

SCHEMA_VERSION = 3


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
    conn = sqlite3.connect(path, timeout=10.0)
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


def _create_v3_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS telegram_users "
        "("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "telegram_user_id INTEGER NOT NULL UNIQUE, "
        "username TEXT NOT NULL DEFAULT '', "
        "display_name TEXT NOT NULL DEFAULT '', "
        "status TEXT NOT NULL DEFAULT 'active', "
        "created_at TEXT, "
        "updated_at TEXT"
        ")"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS telegram_chats "
        "("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "telegram_user_id INTEGER NOT NULL, "
        "telegram_chat_id INTEGER NOT NULL, "
        "chat_type TEXT NOT NULL DEFAULT 'private', "
        "is_primary INTEGER NOT NULL DEFAULT 1, "
        "notifications_enabled INTEGER NOT NULL DEFAULT 1, "
        "created_at TEXT, "
        "updated_at TEXT, "
        "UNIQUE(telegram_user_id, telegram_chat_id)"
        ")"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ebay_accounts "
        "("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "telegram_user_id INTEGER NOT NULL, "
        "ebay_user_id TEXT NOT NULL, "
        "environment TEXT NOT NULL DEFAULT 'production', "
        "scopes TEXT NOT NULL DEFAULT '', "
        "linked_at TEXT, "
        "status TEXT NOT NULL DEFAULT 'linked', "
        "UNIQUE(telegram_user_id, environment)"
        ")"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ebay_tokens "
        "("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "ebay_account_id INTEGER NOT NULL UNIQUE, "
        "refresh_token_encrypted TEXT NOT NULL, "
        "access_token TEXT NOT NULL DEFAULT '', "
        "scope_set TEXT NOT NULL DEFAULT '', "
        "expires_at TEXT, "
        "updated_at TEXT, "
        "status TEXT NOT NULL DEFAULT 'active'"
        ")"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS notification_subscriptions "
        "("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "telegram_user_id INTEGER NOT NULL, "
        "telegram_chat_id INTEGER NOT NULL, "
        "enabled INTEGER NOT NULL DEFAULT 1, "
        "filters TEXT NOT NULL DEFAULT '', "
        "created_at TEXT, "
        "updated_at TEXT, "
        "UNIQUE(telegram_user_id, telegram_chat_id)"
        ")"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tenant_runtime_state "
        "("
        "telegram_user_id INTEGER PRIMARY KEY, "
        "last_check TEXT, "
        "last_error TEXT, "
        "metrics_json TEXT NOT NULL DEFAULT '{}', "
        "updated_at TEXT"
        ")"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tenant_notified_order_ids "
        "("
        "telegram_user_id INTEGER NOT NULL, "
        "order_id TEXT NOT NULL, "
        "PRIMARY KEY (telegram_user_id, order_id)"
        ")"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tenant_notified_hashes "
        "("
        "telegram_user_id INTEGER NOT NULL, "
        "hash TEXT NOT NULL, "
        "PRIMARY KEY (telegram_user_id, hash)"
        ")"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tenant_retry_queue "
        "("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "telegram_user_id INTEGER NOT NULL, "
        "chat_id INTEGER NOT NULL, "
        "text TEXT NOT NULL, "
        "attempts INTEGER NOT NULL DEFAULT 0"
        ")"
    )


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

    if version < 2:
        _create_v2_schema(conn)
        _migrate_legacy_notified_orders(conn)
        version = 2
    if version < 3:
        _create_v3_schema(conn)
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
