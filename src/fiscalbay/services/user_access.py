"""Telegram user access coordination."""

from __future__ import annotations

from ..models import (
    CAPABILITY_MANAGE_NOTIFICATIONS,
    TelegramUser,
    has_telegram_user_capability,
    normalize_telegram_user_status,
)
from ..storage.notifications import (
    load_notification_subscriptions,
    set_notification_subscription_enabled,
)
from ..storage.users import (
    load_telegram_chats,
    load_telegram_user,
    update_telegram_user_status,
)


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
        enabled = (
            False
            if not notifications_allowed
            else (
                existing_subscription.enabled
                if existing_subscription is not None
                else not notify_chat_ids or chat.telegram_chat_id in notify_chat_ids
            )
        )
        set_notification_subscription_enabled(
            path,
            telegram_user_id,
            chat.telegram_chat_id,
            enabled,
            created_at=chat.created_at or updated_at,
            updated_at=updated_at,
        )
    return load_telegram_user(path, telegram_user_id)
