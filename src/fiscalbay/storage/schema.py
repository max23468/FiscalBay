"""SQLite schema creation and migration helpers."""

from __future__ import annotations

import json
import sqlite3

SCHEMA_VERSION = 10


def _table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    ).fetchone()
    return row is not None


def _column_exists(conn: sqlite3.Connection, table: str, column: str) -> bool:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return any(str(row["name"]) == column for row in rows)


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


def _create_v4_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS oauth_link_sessions "
        "("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "telegram_user_id INTEGER NOT NULL, "
        "telegram_chat_id INTEGER NOT NULL, "
        "provider TEXT NOT NULL DEFAULT 'ebay', "
        "environment TEXT NOT NULL DEFAULT 'production', "
        "oauth_state TEXT NOT NULL UNIQUE, "
        "code_verifier TEXT NOT NULL DEFAULT '', "
        "redirect_uri TEXT NOT NULL DEFAULT '', "
        "status TEXT NOT NULL DEFAULT 'pending', "
        "expires_at TEXT, "
        "created_at TEXT"
        ")"
    )


def _create_v5_schema(conn: sqlite3.Connection) -> None:
    if not _column_exists(conn, "oauth_link_sessions", "environment"):
        conn.execute(
            "ALTER TABLE oauth_link_sessions "
            "ADD COLUMN environment TEXT NOT NULL DEFAULT 'production'"
        )


def _create_v6_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS audit_log "
        "("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "event_type TEXT NOT NULL, "
        "actor_telegram_user_id INTEGER, "
        "target_telegram_user_id INTEGER, "
        "telegram_chat_id INTEGER, "
        "ebay_user_id TEXT NOT NULL DEFAULT '', "
        "environment TEXT NOT NULL DEFAULT '', "
        "outcome TEXT NOT NULL DEFAULT '', "
        "details_json TEXT NOT NULL DEFAULT '', "
        "created_at TEXT NOT NULL"
        ")"
    )


def _create_v7_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS operation_queue "
        "("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "operation_type TEXT NOT NULL, "
        "status TEXT NOT NULL DEFAULT 'pending', "
        "actor_telegram_user_id INTEGER, "
        "target_telegram_user_id INTEGER, "
        "available_at TEXT, "
        "payload_json TEXT NOT NULL DEFAULT '', "
        "result_json TEXT NOT NULL DEFAULT '', "
        "last_error TEXT NOT NULL DEFAULT '', "
        "attempts INTEGER NOT NULL DEFAULT 0, "
        "created_at TEXT NOT NULL, "
        "updated_at TEXT"
        ")"
    )


def _create_v8_schema(conn: sqlite3.Connection) -> None:
    if not _column_exists(conn, "tenant_runtime_state", "memory_json"):
        conn.execute(
            "ALTER TABLE tenant_runtime_state ADD COLUMN memory_json TEXT NOT NULL DEFAULT '{}'"
        )
    if not _column_exists(conn, "tenant_runtime_state", "account_snapshot_json"):
        conn.execute(
            "ALTER TABLE tenant_runtime_state "
            "ADD COLUMN account_snapshot_json TEXT NOT NULL DEFAULT '{}'"
        )


def _rename_metrics_payload_key(raw_value: str | None) -> str | None:
    if not raw_value:
        return raw_value
    try:
        decoded = json.loads(raw_value)
    except json.JSONDecodeError:
        return raw_value
    if not isinstance(decoded, dict):
        return raw_value
    if "orders_with_cf" not in decoded:
        return raw_value
    decoded["orders_with_fiscal_identifier"] = decoded.pop("orders_with_cf")
    return json.dumps(decoded, separators=(",", ":"))


def _create_v9_schema(conn: sqlite3.Connection) -> None:
    kv_row = conn.execute("SELECT value FROM kv_store WHERE key = 'metrics'").fetchone()
    if kv_row is not None:
        updated_value = _rename_metrics_payload_key(str(kv_row["value"]))
        if updated_value is not None and updated_value != kv_row["value"]:
            conn.execute("UPDATE kv_store SET value = ? WHERE key = 'metrics'", (updated_value,))

    if _table_exists(conn, "tenant_runtime_state"):
        rows = conn.execute(
            "SELECT telegram_user_id, metrics_json FROM tenant_runtime_state"
        ).fetchall()
        for row in rows:
            updated_metrics = _rename_metrics_payload_key(str(row["metrics_json"]))
            if updated_metrics is None or updated_metrics == row["metrics_json"]:
                continue
            conn.execute(
                "UPDATE tenant_runtime_state SET metrics_json = ? WHERE telegram_user_id = ?",
                (updated_metrics, row["telegram_user_id"]),
            )


def _create_v10_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tenant_status_snapshots "
        "("
        "telegram_user_id INTEGER PRIMARY KEY, "
        "snapshot_json TEXT NOT NULL DEFAULT '{}', "
        "operational_state TEXT NOT NULL DEFAULT '', "
        "last_activity_at TEXT NOT NULL DEFAULT '', "
        "updated_at TEXT NOT NULL"
        ")"
    )
    if _table_exists(conn, "telegram_users"):
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_telegram_users_status_updated "
            "ON telegram_users(status, updated_at)"
        )
    if _table_exists(conn, "telegram_chats"):
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_telegram_chats_user_primary "
            "ON telegram_chats(telegram_user_id, is_primary)"
        )
    if _table_exists(conn, "ebay_accounts"):
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_ebay_accounts_user_env_status "
            "ON ebay_accounts(telegram_user_id, environment, status)"
        )
    if _table_exists(conn, "ebay_tokens"):
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_ebay_tokens_account_status "
            "ON ebay_tokens(ebay_account_id, status)"
        )
    if _table_exists(conn, "notification_subscriptions"):
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_user_enabled "
            "ON notification_subscriptions(telegram_user_id, enabled)"
        )
    if _table_exists(conn, "oauth_link_sessions"):
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_oauth_sessions_user_status_created "
            "ON oauth_link_sessions(telegram_user_id, status, created_at)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_oauth_sessions_status_created "
            "ON oauth_link_sessions(status, created_at)"
        )
    if _table_exists(conn, "audit_log"):
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_log_target_created "
            "ON audit_log(target_telegram_user_id, created_at)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_log_event_created "
            "ON audit_log(event_type, created_at)"
        )
    if _table_exists(conn, "operation_queue"):
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_operation_queue_status_available "
            "ON operation_queue(status, available_at, id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_operation_queue_target_status "
            "ON operation_queue(target_telegram_user_id, status)"
        )
    if _table_exists(conn, "tenant_runtime_state"):
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tenant_runtime_updated "
            "ON tenant_runtime_state(updated_at)"
        )
    if _table_exists(conn, "tenant_retry_queue"):
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tenant_retry_queue_user_id "
            "ON tenant_retry_queue(telegram_user_id, id)"
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
        version = 3
    if version < 4:
        _create_v4_schema(conn)
        version = 4
    if version < 5:
        _create_v5_schema(conn)
        version = 5
    if version < 6:
        _create_v6_schema(conn)
        version = 6
    if version < 7:
        _create_v7_schema(conn)
    if version < 8:
        _create_v8_schema(conn)
        version = 8
    if version < 9:
        _create_v9_schema(conn)
        version = 9
    if version < 10:
        _create_v10_schema(conn)
    conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
