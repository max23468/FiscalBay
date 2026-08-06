"""SQLite users storage functions."""

from __future__ import annotations

from datetime import datetime, timezone

from ..models import (
    CAPABILITY_MANAGE_NOTIFICATIONS,
    TELEGRAM_USER_STATUS_ADMIN,
    TELEGRAM_USER_STATUS_BLOCKED,
    TELEGRAM_USER_STATUS_PENDING,
    BotRuntimeState,
    EbayTokenSet,
    LinkedEbayAccount,
    TelegramChat,
    TelegramUser,
    as_int,
    has_telegram_user_capability,
    normalize_telegram_user_status,
)
from .connection import _connect, init_db
from .notifications import load_notification_subscriptions, set_notification_subscription_enabled
from .runtime import _json_dumps, _parse_operational_memory_state, load_tenant_runtime_state


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
            "WHERE telegram_user_id = ? AND chat_type = 'private' "
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
            "AND target_telegram_user_id = ?"
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
    from .oauth import load_latest_oauth_link_session

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
