"""Tenant status read-model coordination."""

from __future__ import annotations

from datetime import datetime, timezone

from ..models import (
    TELEGRAM_USER_STATUS_ADMIN,
    TELEGRAM_USER_STATUS_BLOCKED,
    TELEGRAM_USER_STATUS_PENDING,
    BotRuntimeState,
    TelegramUser,
    normalize_telegram_user_status,
)
from ..storage.connection import _connect, init_db
from ..storage.oauth import load_latest_oauth_link_session
from ..storage.runtime import load_tenant_runtime_state
from ..storage.users import (
    load_telegram_user,
    load_telegram_users,
    save_tenant_status_snapshot,
    summarize_tenant_account_status,
)


def _operational_state(user_status: str, account_status: str, token_status: str) -> str:
    normalized_status = normalize_telegram_user_status(user_status)
    if normalized_status == TELEGRAM_USER_STATUS_PENDING:
        return "pending"
    if normalized_status == TELEGRAM_USER_STATUS_BLOCKED:
        return "blocked"
    if normalized_status == TELEGRAM_USER_STATUS_ADMIN:
        return "admin"
    if account_status == "linked" and token_status == "active":
        return "ready"
    if account_status == "revoked" or token_status in {"revoked", "expired", "token_expired"}:
        return "reconnect_required"
    return "waiting_connect"


def _last_activity_at(user: TelegramUser, runtime_state: BotRuntimeState) -> str:
    return (
        runtime_state.memory.last_notified_order_created_at
        or runtime_state.memory.last_seen_order_created_at
        or runtime_state.memory.last_fetch_end
        or user.created_at
        or ""
    )


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
    operational_state = _operational_state(
        user.status,
        str(account_status.get("account_status") or "unlinked"),
        str(account_status.get("token_status") or "missing"),
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
        "last_activity_at": _last_activity_at(user, runtime_state),
        "created_at": user.created_at or "",
        "last_fetch_end": runtime_state.memory.last_fetch_end,
        "last_seen_order_id": runtime_state.memory.last_seen_order_id,
        "last_seen_order_created_at": runtime_state.memory.last_seen_order_created_at,
        "last_notified_order_id": runtime_state.memory.last_notified_order_id,
        "last_notified_order_created_at": runtime_state.memory.last_notified_order_created_at,
        "latest_session_status": latest_session.status if latest_session is not None else "",
        "latest_session_expires_at": latest_session.expires_at
        if latest_session is not None
        else "",
    }
    return save_tenant_status_snapshot(path, telegram_user_id, snapshot, updated_at=timestamp)


def rebuild_all_tenant_status_snapshots(path: str, *, now_iso: str | None = None) -> dict[str, int]:
    init_db(path)
    users = load_telegram_users(path)
    rebuilt = sum(
        bool(rebuild_tenant_status_snapshot(path, user.telegram_user_id, now_iso=now_iso))
        for user in users
    )
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
