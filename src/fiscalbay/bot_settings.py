"""Telegram bot settings functions."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from . import bot_common
from .bot_common import (
    _append_audit_log,
    _build_policy_status_payload,
    _build_service_status_payload,
    _build_tenant_ux_context,
    _command_rate_limit_remaining_seconds,
    _format_cooldown_message,
    _mark_command_usage,
    _notification_filter_label,
    _notification_filter_mode_from_filters,
    _notification_filter_payload,
    tenant_not_linked_message,
)
from .models import (
    TELEGRAM_USER_STATUS_ADMIN,
    TELEGRAM_USER_STATUS_NEW,
    NotificationSubscription,
    TelegramConfig,
    TenantChatContext,
    normalize_telegram_user_status,
)
from .services.account import disconnect_account_with_remote_revocation
from .services.user_access import apply_telegram_user_access_status
from .storage.notifications import (
    load_notification_subscriptions,
    set_notification_subscription_enabled,
    upsert_notification_subscription,
)
from .storage.runtime import (
    load_runtime_state,
    load_tenant_runtime_state,
)
from .storage.users import (
    load_telegram_user,
    resolve_primary_chat_id,
    summarize_tenant_account_status,
)
from .telegram_admin import format_admin_data_request
from .telegram_settings import (
    format_data_request_help,
    format_data_request_status,
    format_leave_status,
    format_notifications_status,
    format_policy_status,
    format_service_status,
    format_settings_status,
)

LOGGER = logging.getLogger("fiscalbay.telegram_bot")


def handle_public_settings_command(
    command: str,
    args: list[str],
    *,
    telegram_config: TelegramConfig,
    chat_id: int,
    environment: str,
    telegram_user_id: int | None,
    is_admin_user: bool,
    can_use_bot: bool,
    now: datetime,
    now_iso: str,
) -> list[str] | None:
    if command == "/service_status":
        return [format_service_status(_build_service_status_payload(telegram_config.state_path))]
    if command == "/policy":
        return [format_policy_status(_build_policy_status_payload(telegram_config.state_path))]
    if command != "/data_request" or not (is_admin_user or can_use_bot):
        return None
    if telegram_user_id is None:
        return [
            "🗂️ <b>Dati e privacy</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Non riesco a identificare l'utente Telegram da questa richiesta."
        ]
    request_arg = str(args[0]).strip().lower() if args else ""
    if request_arg in {"", "help"}:
        return [format_data_request_help(_build_policy_status_payload(telegram_config.state_path))]
    if request_arg == "export":
        request_type = "export"
    elif request_arg == "cancellazione":
        request_type = "delete"
    else:
        return [
            "Uso corretto: <code>/settings dati export</code> oppure "
            "<code>/settings dati cancellazione</code>"
        ]
    remaining = _command_rate_limit_remaining_seconds(
        telegram_config.state_path,
        telegram_user_id=telegram_user_id,
        command=command,
        now=now,
    )
    if remaining > 0:
        return [_format_cooldown_message(command, remaining)]
    current_user = load_telegram_user(telegram_config.state_path, telegram_user_id)
    account_status = summarize_tenant_account_status(
        telegram_config.state_path,
        telegram_user_id,
        environment,
    )
    admin_notified = False
    admin_chat_id = (
        resolve_primary_chat_id(telegram_config.state_path, telegram_config.admin_user_id)
        if telegram_config.admin_user_id is not None
        else None
    )
    if admin_chat_id is not None and current_user is not None:
        bot_common.send_message(
            telegram_config.token,
            admin_chat_id,
            format_admin_data_request(
                telegram_user_id=telegram_user_id,
                username=current_user.username,
                display_name=current_user.display_name,
                chat_id=chat_id,
                request_type=request_type,
                account_status=account_status,
            ),
        )
        admin_notified = True
    _append_audit_log(
        telegram_config,
        event_type="data_request",
        created_at=now_iso,
        actor_telegram_user_id=telegram_user_id,
        target_telegram_user_id=telegram_user_id,
        telegram_chat_id=chat_id,
        environment=environment,
        outcome=f"{request_type}_requested",
        details={
            "admin_notified": admin_notified,
            "account_status": str(account_status.get("account_status") or ""),
            "token_status": str(account_status.get("token_status") or ""),
        },
    )
    _mark_command_usage(
        telegram_config.state_path,
        telegram_user_id=telegram_user_id,
        command=command,
        timestamp=now_iso,
    )
    return [
        format_data_request_status(
            request_type=request_type,
            admin_notified=admin_notified,
            account_status=account_status,
        )
    ]


def handle_settings_command(
    command: str,
    args: list[str],
    *,
    telegram_config: TelegramConfig,
    chat_id: int,
    resolved_environment: str,
    resolved_telegram_user_id: int | None,
    tenant_context: TenantChatContext | None,
    user_status: str | None,
    now: datetime,
) -> list[str] | None:
    if command == "/leave_bot":
        if resolved_telegram_user_id is None:
            return tenant_not_linked_message("🚪 <b>Disattiva uso bot</b>")
        remaining = _command_rate_limit_remaining_seconds(
            telegram_config.state_path,
            telegram_user_id=resolved_telegram_user_id,
            command=command,
            now=now,
        )
        if remaining > 0:
            return [_format_cooldown_message(command, remaining)]
        current_user = load_telegram_user(
            telegram_config.state_path,
            resolved_telegram_user_id,
        )
        current_status = normalize_telegram_user_status(
            current_user.status if current_user is not None else TELEGRAM_USER_STATUS_NEW
        )
        if current_status == TELEGRAM_USER_STATUS_ADMIN:
            return [
                "🚪 <b>Disattiva uso bot</b>\n━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Per un account admin questo comando non è disponibile.\n"
                "Usa <code>/account scollega</code> se vuoi scollegare solo eBay."
            ]
        timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        (
            disconnected_account,
            remote_revocation_status,
            remote_revocation_detail,
        ) = disconnect_account_with_remote_revocation(
            telegram_config=telegram_config,
            telegram_user_id=resolved_telegram_user_id,
            environment=resolved_environment,
        )
        applied_user = apply_telegram_user_access_status(
            telegram_config.state_path,
            resolved_telegram_user_id,
            TELEGRAM_USER_STATUS_NEW,
            updated_at=timestamp,
        )
        _append_audit_log(
            telegram_config,
            event_type="leave_bot",
            created_at=timestamp,
            actor_telegram_user_id=resolved_telegram_user_id,
            target_telegram_user_id=resolved_telegram_user_id,
            telegram_chat_id=chat_id,
            ebay_user_id=(
                disconnected_account.ebay_user_id if disconnected_account is not None else ""
            ),
            environment=resolved_environment,
            outcome=(
                "left_bot_remote_revoked"
                if remote_revocation_status == "revoked"
                else (
                    "left_bot_remote_failed" if remote_revocation_status == "failed" else "left_bot"
                )
            ),
            details={
                "previous_status": current_status,
                "new_status": applied_user.status if applied_user is not None else "new",
                "remote_revocation_status": remote_revocation_status,
                "remote_revocation_detail": remote_revocation_detail,
            },
        )
        summarize_tenant_account_status(
            telegram_config.state_path,
            resolved_telegram_user_id,
            resolved_environment,
        )
        _mark_command_usage(
            telegram_config.state_path,
            telegram_user_id=resolved_telegram_user_id,
            command=command,
            timestamp=timestamp,
        )
        return [
            format_leave_status(
                {
                    "account_was_linked": disconnected_account is not None,
                    "ebay_user_id": (
                        disconnected_account.ebay_user_id if disconnected_account else ""
                    ),
                    "environment": (
                        disconnected_account.environment
                        if disconnected_account
                        else resolved_environment
                    ),
                    "remote_revocation_status": remote_revocation_status,
                    "remote_revocation_detail": remote_revocation_detail,
                }
            )
        ]

    if command == "/notifications":
        if resolved_telegram_user_id is None:
            return tenant_not_linked_message("🔔 <b>Notifiche chat</b>")
        command_args = args
        subscriptions = load_notification_subscriptions(telegram_config.state_path)
        current_subscription = next(
            (
                subscription
                for subscription in subscriptions
                if subscription.telegram_user_id == resolved_telegram_user_id
                and subscription.telegram_chat_id == chat_id
            ),
            None,
        )
        current_enabled = (
            bool(current_subscription.enabled) if current_subscription is not None else False
        )
        filter_mode = (
            _notification_filter_mode_from_filters(current_subscription.filters)
            if current_subscription is not None
            else "all"
        )
        enabled = current_enabled
        if command_args:
            if command_args[0] == "filter":
                if len(command_args) < 2 or command_args[1] not in {"all", "cf", "vat"}:
                    return [
                        "Uso corretto: <code>/settings filtro all</code>, "
                        "<code>/settings filtro cf</code> oppure "
                        "<code>/settings filtro vat</code>."
                    ]
                filter_mode = command_args[1]
                timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
                upsert_notification_subscription(
                    telegram_config.state_path,
                    NotificationSubscription(
                        telegram_user_id=resolved_telegram_user_id,
                        telegram_chat_id=chat_id,
                        enabled=enabled,
                        filters=_notification_filter_payload(filter_mode),
                        created_at=(
                            current_subscription.created_at
                            if current_subscription is not None
                            else timestamp
                        ),
                        updated_at=timestamp,
                    ),
                )
            elif command_args[0] not in {"on", "off"}:
                return [
                    (
                        "Uso corretto: <code>/settings notifiche</code>, "
                        "<code>/settings notifiche on</code> "
                        "<code>/settings notifiche off</code> o "
                        "<code>/settings filtro all|cf|vat</code>."
                    )
                ]
            else:
                enabled = command_args[0] == "on"
                timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
                set_notification_subscription_enabled(
                    telegram_config.state_path,
                    resolved_telegram_user_id,
                    chat_id,
                    enabled,
                    created_at=timestamp,
                    updated_at=timestamp,
                )
        account_status_summary = summarize_tenant_account_status(
            telegram_config.state_path,
            resolved_telegram_user_id,
            resolved_environment,
        )
        return [
            format_notifications_status(
                {
                    "enabled": enabled,
                    "tenant_scope": "tenant" if tenant_context is not None else "global",
                    "chat_id": chat_id,
                    "environment": resolved_environment,
                    "account_linked": account_status_summary.get("linked") is True,
                    "filter_label": _notification_filter_label(filter_mode),
                }
            )
        ]

    if command == "/settings":
        notifications_enabled = False
        settings_state = load_runtime_state(telegram_config.state_path)
        account_linked = False
        ux_context: dict[str, object] = {}
        if resolved_telegram_user_id is not None:
            ux_context = _build_tenant_ux_context(
                telegram_config,
                telegram_user_id=resolved_telegram_user_id,
                chat_id=chat_id,
                environment=resolved_environment,
            )
            notifications_enabled = bool(ux_context.get("notifications_enabled", False))
            settings_state = load_tenant_runtime_state(
                telegram_config.state_path,
                resolved_telegram_user_id,
            )
            account_linked = ux_context.get("linked") is True
        return [
            format_settings_status(
                {
                    "tenant_scope": "tenant" if tenant_context is not None else "global",
                    "environment": resolved_environment,
                    "notifications_enabled": notifications_enabled,
                    "account_linked": account_linked,
                    "user_status": user_status or TELEGRAM_USER_STATUS_NEW,
                    "last_fetch_start": settings_state.memory.last_fetch_start,
                    "last_fetch_end": settings_state.memory.last_fetch_end,
                    "last_seen_order_id": settings_state.memory.last_seen_order_id,
                    "last_seen_order_created_at": settings_state.memory.last_seen_order_created_at,
                    "last_notified_order_id": settings_state.memory.last_notified_order_id,
                    "last_notified_order_created_at": (
                        settings_state.memory.last_notified_order_created_at
                    ),
                    "latest_session_status": ux_context.get("latest_session_status", ""),
                    "latest_session_expires_at": ux_context.get("latest_session_expires_at", ""),
                    "session_ready": bool(ux_context.get("session_ready", False)),
                }
            )
        ]

    return None
