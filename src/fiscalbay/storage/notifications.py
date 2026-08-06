"""SQLite notifications storage functions."""

from __future__ import annotations

from ..models import (
    NotificationSubscription,
    NotificationTenantTarget,
    TenantChatContext,
)
from .connection import _connect, init_db


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
            "JOIN telegram_chats AS c "
            "ON c.telegram_user_id = s.telegram_user_id "
            "AND c.telegram_chat_id = s.telegram_chat_id "
            "JOIN ebay_accounts AS a "
            "ON a.telegram_user_id = s.telegram_user_id "
            "WHERE s.enabled = 1 AND c.chat_type = 'private' AND a.status = 'linked' "
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
