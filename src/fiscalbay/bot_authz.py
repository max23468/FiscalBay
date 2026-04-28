"""Authorization helpers for the Telegram runtime."""

from __future__ import annotations

from .models import (
    CAPABILITY_CONNECT_ACCOUNT,
    CAPABILITY_MANAGE_NOTIFICATIONS,
    CAPABILITY_MANAGE_SETTINGS,
    CAPABILITY_REQUEST_ACCESS,
    CAPABILITY_REVIEW_ACCESS,
    CAPABILITY_USE_BOT,
    CAPABILITY_VIEW_ACCOUNT,
    CAPABILITY_VIEW_ORDERS,
    TELEGRAM_USER_STATUS_ADMIN,
    TELEGRAM_USER_STATUS_APPROVED,
    TELEGRAM_USER_STATUS_NEW,
    TelegramConfig,
    has_telegram_user_capability,
    normalize_telegram_user_status,
)
from .storage.sqlite import load_telegram_user

COMMAND_CAPABILITIES: dict[str, str] = {
    "/ping": CAPABILITY_REVIEW_ACCESS,
    "/stato": CAPABILITY_USE_BOT,
    "/altre_azioni": CAPABILITY_REQUEST_ACCESS,
    "/account": CAPABILITY_VIEW_ACCOUNT,
    "/reconnect_status": CAPABILITY_VIEW_ACCOUNT,
    "/connect": CAPABILITY_CONNECT_ACCOUNT,
    "/disconnect": CAPABILITY_CONNECT_ACCOUNT,
    "/leave_bot": CAPABILITY_MANAGE_SETTINGS,
    "/data_request": CAPABILITY_MANAGE_SETTINGS,
    "/notifications": CAPABILITY_MANAGE_NOTIFICATIONS,
    "/settings": CAPABILITY_MANAGE_SETTINGS,
    "/ordini": CAPABILITY_VIEW_ORDERS,
    "/ultimi": CAPABILITY_VIEW_ORDERS,
    "/tutti": CAPABILITY_VIEW_ORDERS,
    "/ordine": CAPABILITY_VIEW_ORDERS,
    "/admin": CAPABILITY_REVIEW_ACCESS,
    "/admin_users": CAPABILITY_REVIEW_ACCESS,
    "/admin_history": CAPABILITY_REVIEW_ACCESS,
    "/tenant_health": CAPABILITY_REVIEW_ACCESS,
    "/approve_user": CAPABILITY_REVIEW_ACCESS,
    "/reject_user": CAPABILITY_REVIEW_ACCESS,
    "/suspend_user": CAPABILITY_REVIEW_ACCESS,
    "/reactivate_user": CAPABILITY_REVIEW_ACCESS,
    "/service_mode": CAPABILITY_REVIEW_ACCESS,
    "/request_access": CAPABILITY_REQUEST_ACCESS,
}

ADMIN_ONLY_COMMANDS = frozenset(
    {
        "/admin",
        "/admin_users",
        "/admin_history",
        "/approve_user",
        "/reject_user",
        "/suspend_user",
        "/reactivate_user",
        "/tenant_health",
        "/service_mode",
    }
)


def is_admin_user(telegram_user_id: int | None, telegram_config: TelegramConfig) -> bool:
    return (
        telegram_user_id is not None
        and telegram_config.admin_user_id is not None
        and telegram_user_id == telegram_config.admin_user_id
    )


def load_user_status(
    telegram_config: TelegramConfig,
    telegram_user_id: int | None,
) -> str | None:
    if telegram_user_id is None:
        return None
    if is_admin_user(telegram_user_id, telegram_config):
        return TELEGRAM_USER_STATUS_ADMIN
    user = load_telegram_user(telegram_config.state_path, telegram_user_id)
    if user is None:
        return None
    normalized = normalize_telegram_user_status(user.status, default=TELEGRAM_USER_STATUS_NEW)
    if normalized == TELEGRAM_USER_STATUS_ADMIN:
        return TELEGRAM_USER_STATUS_APPROVED
    return normalized


def is_user_approved(
    telegram_config: TelegramConfig,
    telegram_user_id: int | None,
) -> bool:
    if telegram_config.admin_user_id is None:
        return True
    return has_telegram_user_capability(
        load_user_status(telegram_config, telegram_user_id),
        CAPABILITY_USE_BOT,
    )


def has_command_capability(
    telegram_config: TelegramConfig,
    *,
    telegram_user_id: int | None,
    command: str,
) -> bool:
    if telegram_config.admin_user_id is None:
        return True
    required_capability = COMMAND_CAPABILITIES.get(command)
    if required_capability is None:
        return True
    if required_capability == CAPABILITY_REVIEW_ACCESS:
        return is_admin_user(telegram_user_id, telegram_config)
    return has_telegram_user_capability(
        load_user_status(telegram_config, telegram_user_id),
        required_capability,
    )
