"""Telegram bot account functions."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from .bot_common import (
    _append_audit_log,
    _build_tenant_ux_context,
    _command_rate_limit_remaining_seconds,
    _format_cooldown_message,
    _mark_command_usage,
    _parse_iso_timestamp,
    load_recent_audit_entries,
    tenant_not_linked_message,
)
from .bot_oauth import (
    build_connect_entrypoint_url,
    create_or_reuse_oauth_link_session,
)
from .bot_oauth import (
    is_reusable_oauth_session as _is_reusable_oauth_session,
)
from .models import (
    TELEGRAM_USER_STATUS_ADMIN,
    TELEGRAM_USER_STATUS_APPROVED,
    TELEGRAM_USER_STATUS_NEW,
    TelegramConfig,
)
from .services.account import disconnect_account_with_remote_revocation
from .storage.oauth import load_latest_oauth_link_session
from .storage.users import (
    summarize_tenant_account_status,
)
from .support_snapshot import build_support_snapshot
from .telegram_account import (
    format_account_status,
    format_connect_status,
    format_disconnect_status,
    format_onboarding_guide,
    format_reconnect_status,
)
from .telegram_admin import format_support_snapshot
from .telegram_commands import build_start_text

LOGGER = logging.getLogger("fiscalbay.telegram_bot")


def _connect_cooldown_remaining_seconds(
    telegram_config: TelegramConfig,
    *,
    telegram_user_id: int,
    environment: str,
    now: datetime,
) -> int:
    entries = load_recent_audit_entries(telegram_config, limit=300)
    connect_attempts = 0
    recent_failure_times: list[datetime] = []
    latest_failure: datetime | None = None
    for entry in entries:
        if entry.target_telegram_user_id != telegram_user_id:
            continue
        if entry.environment != environment:
            continue
        created_at = _parse_iso_timestamp(entry.created_at)
        if created_at is None:
            continue
        age_seconds = int((now - created_at).total_seconds())
        if age_seconds < 0:
            continue
        if entry.event_type == "connect" and age_seconds <= 600:
            connect_attempts += 1
        if entry.event_type == "oauth_failure" and age_seconds <= 900:
            recent_failure_times.append(created_at)
            if latest_failure is None or created_at > latest_failure:
                latest_failure = created_at
    if len(recent_failure_times) >= 3 and latest_failure is not None:
        remaining = 900 - int((now - latest_failure).total_seconds())
        if remaining > 0:
            return remaining
    if connect_attempts >= 5:
        most_recent_connect = next(
            (
                _parse_iso_timestamp(entry.created_at)
                for entry in entries
                if entry.event_type == "connect"
                and entry.target_telegram_user_id == telegram_user_id
                and entry.environment == environment
                and _parse_iso_timestamp(entry.created_at) is not None
            ),
            None,
        )
        if most_recent_connect is not None:
            remaining = 300 - int((now - most_recent_connect).total_seconds())
            if remaining > 0:
                return remaining
    return 0


def _load_tenant_ux_context_for_command(
    telegram_config: TelegramConfig,
    *,
    telegram_user_id: int | None,
    chat_id: int,
    environment: str,
    title: str,
) -> tuple[dict[str, object] | None, list[str] | None]:
    if telegram_user_id is None:
        return None, tenant_not_linked_message(title)
    return (
        _build_tenant_ux_context(
            telegram_config,
            telegram_user_id=telegram_user_id,
            chat_id=chat_id,
            environment=environment,
        ),
        None,
    )


def handle_account_command(
    command: str,
    args: list[str],
    *,
    telegram_config: TelegramConfig,
    chat_id: int,
    resolved_environment: str,
    resolved_telegram_user_id: int | None,
    now: datetime,
    now_iso: str,
    is_admin_user: bool,
    user_status: str | None,
) -> list[str] | None:
    if command in {"", "/start"}:
        if is_admin_user:
            return [build_start_text(user_status=TELEGRAM_USER_STATUS_ADMIN, is_admin=True)]
        account_status: dict[str, object] | None = None
        if telegram_user_id := resolved_telegram_user_id:
            account_status = summarize_tenant_account_status(
                telegram_config.state_path,
                telegram_user_id,
                resolved_environment,
            )
        return [
            build_start_text(
                user_status=(
                    user_status
                    or (
                        TELEGRAM_USER_STATUS_NEW
                        if telegram_config.admin_user_id is not None
                        else TELEGRAM_USER_STATUS_APPROVED
                    )
                ),
                account_status=account_status,
            )
        ]

    if command == "/onboarding":
        account_status = None
        if resolved_telegram_user_id is not None:
            account_status = summarize_tenant_account_status(
                telegram_config.state_path,
                resolved_telegram_user_id,
                resolved_environment,
            )
        return [
            format_onboarding_guide(
                user_status=user_status or TELEGRAM_USER_STATUS_NEW,
                account_status=account_status,
                is_admin=is_admin_user,
            )
        ]

    if command == "/support":
        if resolved_telegram_user_id is None:
            return ["Non riesco a identificare l'utente Telegram per lo snapshot supporto."]
        return [
            format_support_snapshot(
                build_support_snapshot(
                    telegram_config.state_path,
                    resolved_telegram_user_id,
                    environment=resolved_environment,
                )
            )
        ]

    if command == "/account":
        account_status, missing_response = _load_tenant_ux_context_for_command(
            telegram_config,
            telegram_user_id=resolved_telegram_user_id,
            chat_id=chat_id,
            environment=resolved_environment,
            title="👤 <b>Account eBay</b>",
        )
        if missing_response is not None:
            return missing_response
        if account_status is None:
            return tenant_not_linked_message("👤 <b>Account eBay</b>")
        return [format_account_status(account_status)]

    if command == "/reconnect_status":
        account_status, missing_response = _load_tenant_ux_context_for_command(
            telegram_config,
            telegram_user_id=resolved_telegram_user_id,
            chat_id=chat_id,
            environment=resolved_environment,
            title="🔁 <b>Reconnect status</b>",
        )
        if missing_response is not None:
            return missing_response
        if account_status is None:
            return tenant_not_linked_message("🔁 <b>Reconnect status</b>")
        return [format_reconnect_status(account_status)]

    if command == "/connect":
        if resolved_telegram_user_id is None:
            return tenant_not_linked_message("🔗 <b>Collegamento account eBay</b>")
        connect_account_status, missing_response = _load_tenant_ux_context_for_command(
            telegram_config,
            telegram_user_id=resolved_telegram_user_id,
            chat_id=chat_id,
            environment=resolved_environment,
            title="🔗 <b>Collegamento account eBay</b>",
        )
        if missing_response is not None:
            return missing_response
        if connect_account_status is None:
            return tenant_not_linked_message("🔗 <b>Collegamento account eBay</b>")
        latest_session = load_latest_oauth_link_session(
            telegram_config.state_path,
            resolved_telegram_user_id,
        )
        remaining = _command_rate_limit_remaining_seconds(
            telegram_config.state_path,
            telegram_user_id=resolved_telegram_user_id,
            command=command,
            now=now,
        )
        if remaining > 0 and not _is_reusable_oauth_session(
            latest_session,
            environment=resolved_environment,
            now=now,
        ):
            return [_format_cooldown_message(command, remaining)]
        oauth_cooldown_remaining = _connect_cooldown_remaining_seconds(
            telegram_config,
            telegram_user_id=resolved_telegram_user_id,
            environment=resolved_environment,
            now=now,
        )
        if oauth_cooldown_remaining > 0 and not _is_reusable_oauth_session(
            latest_session,
            environment=resolved_environment,
            now=now,
        ):
            return [
                "⏱️ <b>Collegamento temporaneamente raffreddato</b>\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Sono stati rilevati troppi tentativi ravvicinati o failure OAuth recenti.\n"
                f"Riprova tra <code>{oauth_cooldown_remaining}</code> secondi."
            ]
        active_session, created_session = create_or_reuse_oauth_link_session(
            telegram_config.state_path,
            telegram_user_id=resolved_telegram_user_id,
            telegram_chat_id=chat_id,
            environment=resolved_environment,
            now=now,
        )
        _mark_command_usage(
            telegram_config.state_path,
            telegram_user_id=resolved_telegram_user_id,
            command=command,
            timestamp=now_iso,
        )
        _append_audit_log(
            telegram_config,
            event_type="connect",
            created_at=now_iso,
            actor_telegram_user_id=resolved_telegram_user_id,
            target_telegram_user_id=resolved_telegram_user_id,
            telegram_chat_id=chat_id,
            environment=resolved_environment,
            outcome="session_created" if created_session else "session_reused",
            details={
                "oauth_state": active_session.oauth_state,
                "session_reused": not created_session,
            },
        )
        return [
            format_connect_status(
                {
                    "oauth_state": active_session.oauth_state,
                    "expires_at": active_session.expires_at,
                    "connect_url": build_connect_entrypoint_url(active_session.oauth_state),
                    "session_reused": not created_session,
                    "account_status": connect_account_status.get("account_status"),
                    "ebay_user_id": connect_account_status.get("ebay_user_id"),
                    "reconnect": connect_account_status.get("account_status")
                    in {"linked", "revoked"},
                    "notifications_enabled": connect_account_status.get("notifications_enabled"),
                    "last_seen_order_id": connect_account_status.get("last_seen_order_id"),
                    "last_seen_order_created_at": connect_account_status.get(
                        "last_seen_order_created_at"
                    ),
                    "last_notified_order_id": connect_account_status.get("last_notified_order_id"),
                    "last_notified_order_created_at": connect_account_status.get(
                        "last_notified_order_created_at"
                    ),
                    "latest_session_status": active_session.status,
                    "latest_session_expires_at": active_session.expires_at,
                    "session_ready": True,
                }
            )
        ]

    if command == "/disconnect":
        if resolved_telegram_user_id is None:
            return tenant_not_linked_message("❌ <b>Scollega account eBay</b>")
        remaining = _command_rate_limit_remaining_seconds(
            telegram_config.state_path,
            telegram_user_id=resolved_telegram_user_id,
            command=command,
            now=now,
        )
        if remaining > 0:
            return [_format_cooldown_message(command, remaining)]
        (
            disconnected_account,
            remote_revocation_status,
            remote_revocation_detail,
        ) = disconnect_account_with_remote_revocation(
            telegram_config=telegram_config,
            telegram_user_id=resolved_telegram_user_id,
            environment=resolved_environment,
        )
        _append_audit_log(
            telegram_config,
            event_type="disconnect",
            created_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            actor_telegram_user_id=resolved_telegram_user_id,
            target_telegram_user_id=resolved_telegram_user_id,
            telegram_chat_id=chat_id,
            ebay_user_id=(
                disconnected_account.ebay_user_id if disconnected_account is not None else ""
            ),
            environment=resolved_environment,
            outcome=(
                "disconnected_remote_revoked"
                if disconnected_account is not None and remote_revocation_status == "revoked"
                else (
                    "disconnected_remote_failed"
                    if disconnected_account is not None and remote_revocation_status == "failed"
                    else ("disconnected" if disconnected_account is not None else "noop")
                )
            ),
            details={
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
            timestamp=now_iso,
        )
        return [
            format_disconnect_status(
                {
                    "disconnected": disconnected_account is not None,
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

    return None
