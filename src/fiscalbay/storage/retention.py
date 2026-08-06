"""SQLite retention storage functions."""

from __future__ import annotations

import json
import sqlite3

from ..models import (
    EBAY_ACCOUNT_STATUS_LINKED,
    OAUTH_SESSION_STATUS_CANCELLED,
    OAUTH_SESSION_STATUS_COMPLETED,
    OAUTH_SESSION_STATUS_EXPIRED,
    OAUTH_SESSION_STATUS_FAILED,
    OAUTH_SESSION_STATUS_PENDING,
    OPERATION_STATUS_CANCELLED,
    OPERATION_STATUS_COMPLETED,
    as_int,
)
from .connection import _connect, init_db
from .runtime import (
    load_kv_value,
    load_tenant_retry_queue_entries,
    load_tenant_runtime_state,
    save_kv_value,
)


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
