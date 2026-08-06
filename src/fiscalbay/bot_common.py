"""Telegram bot common functions."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Callable, Mapping, Optional

from .application import fetch_environment_records as _fetch_environment_records
from .application import resolve_fetch_context as _resolve_fetch_context
from .bot_authz import is_admin_user as _is_admin_user
from .bot_messaging import send_message as _send_message
from .bot_oauth import (
    is_reusable_oauth_session as _is_reusable_oauth_session,
)
from .clients.telegram import (
    InlineKeyboardMarkup,
    telegram_request,
)
from .config import (
    load_config,
    load_public_service_config,
    load_rate_limit_config,
    load_retention_config,
)
from .models import (
    CAPABILITY_MANAGE_NOTIFICATIONS,
    TELEGRAM_USER_STATUS_ADMIN,
    TELEGRAM_USER_STATUS_APPROVED,
    TELEGRAM_USER_STATUS_NEW,
    AuditLogEntry,
    BotRuntimeState,
    FetchOptions,
    NotificationSubscription,
    OrderRecord,
    RetryQueueEntry,
    TelegramChat,
    TelegramConfig,
    TelegramUser,
    TenantChatContext,
    has_telegram_user_capability,
    normalize_telegram_user_status,
)
from .services.orders import fetch_records
from .storage.notifications import (
    load_notification_subscriptions,
    resolve_tenant_chat_context,
    upsert_notification_subscription,
)
from .storage.oauth import load_latest_oauth_link_session
from .storage.queues import append_audit_log_entry, load_audit_log_entries
from .storage.retention import (
    summarize_multi_tenant_readiness,
)
from .storage.runtime import (
    load_kv_value,
    load_tenant_runtime_state,
    save_kv_value,
)
from .storage.users import (
    load_telegram_user,
    resolve_linked_ebay_account,
    resolve_primary_chat_id,
    summarize_tenant_account_status,
    upsert_telegram_chat,
    upsert_telegram_user,
)
from .telegram_commands import (
    build_help_text,
    build_other_actions_text,
    format_status,
    is_authorized,
)
from .tenant_credentials import load_tenant_config_from_storage

LOGGER = logging.getLogger("fiscalbay.telegram_bot")

SERVICE_MODE_NORMAL = "normal"

SERVICE_MODE_MAINTENANCE = "maintenance"

SERVICE_MODE_DEGRADED = "degraded"

SERVICE_MODES = {
    SERVICE_MODE_NORMAL,
    SERVICE_MODE_MAINTENANCE,
    SERVICE_MODE_DEGRADED,
}


def load_recent_audit_entries(
    telegram_config: TelegramConfig,
    *,
    limit: int = 300,
) -> list[AuditLogEntry]:
    return load_audit_log_entries(telegram_config.state_path, limit=limit)


def handle_common_command(
    command: str,
    *,
    telegram_config: TelegramConfig,
    is_admin_user: bool,
    runtime_context: dict[str, object],
    load_state_fn: Callable[[str], BotRuntimeState],
    load_retry_queue_fn: Callable[[str], list[RetryQueueEntry]],
) -> list[str] | None:
    if command == "/stato":
        state = load_state_fn(telegram_config.state_path)
        retry_queue_size = len(load_retry_queue_fn(telegram_config.retry_queue_path))
        return [format_status(state, retry_queue_size, runtime_context=runtime_context)]
    if command == "/help":
        return [build_help_text(is_admin=is_admin_user)]
    if command == "/altre_azioni":
        return [build_other_actions_text(is_admin=is_admin_user)]
    if command == "/ping":
        return ["pong ✅"]
    return None


def tenant_not_linked_message(title: str) -> list[str]:
    return [
        f"{title}\n━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Questa chat non è ancora associata a un tenant Telegram noto."
    ]


ORDER_COMMAND_COOLDOWN_SECONDS = 10

DATA_REQUEST_COOLDOWN_SECONDS = 3600

ADMIN_MUTATION_COMMANDS = {
    "/approve_user",
    "/reject_user",
    "/suspend_user",
    "/reactivate_user",
}


def _now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _iso_days_ago(now: datetime, days: int) -> str:
    return (now - timedelta(days=days)).isoformat().replace("+00:00", "Z")


def _parse_iso_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _seconds_between(now: datetime, previous: str | None) -> int | None:
    parsed = _parse_iso_timestamp(previous)
    if parsed is None:
        return None
    return max(0, int((now - parsed).total_seconds()))


def _service_state_key() -> str:
    return "service_state"


def _command_rate_limit_key(telegram_user_id: int, command: str) -> str:
    safe_command = command.replace("/", "")
    return f"command_guard:{telegram_user_id}:{safe_command}"


def _command_rate_limit_seconds(command: str) -> int:
    if command == "/ordini":
        return ORDER_COMMAND_COOLDOWN_SECONDS
    if command == "/data_request":
        return DATA_REQUEST_COOLDOWN_SECONDS
    config = load_rate_limit_config()
    if not config.enabled:
        return 0
    if command == "/request_access":
        return config.request_access_seconds
    if command == "/connect":
        return config.connect_seconds
    if command == "/disconnect":
        return config.disconnect_seconds
    if command == "/leave_bot":
        return config.leave_bot_seconds
    if command == "/service_mode":
        return config.service_mode_seconds
    if command in ADMIN_MUTATION_COMMANDS:
        return config.admin_mutation_seconds
    return 0


def _load_service_state(state_path: str) -> dict[str, object]:
    raw = load_kv_value(state_path, _service_state_key())
    if not raw:
        return {"mode": SERVICE_MODE_NORMAL}
    try:
        loaded = json.loads(raw)
    except json.JSONDecodeError:
        return {"mode": SERVICE_MODE_NORMAL}
    if not isinstance(loaded, dict):
        return {"mode": SERVICE_MODE_NORMAL}
    mode = str(loaded.get("mode") or SERVICE_MODE_NORMAL)
    if mode not in SERVICE_MODES:
        mode = SERVICE_MODE_NORMAL
    return {
        "mode": mode,
        "updated_at": str(loaded.get("updated_at") or ""),
        "updated_by": loaded.get("updated_by"),
    }


def _save_service_state(
    state_path: str,
    *,
    mode: str,
    updated_by: int | None,
    updated_at: str,
) -> None:
    save_kv_value(
        state_path,
        _service_state_key(),
        json.dumps(
            {
                "mode": mode if mode in SERVICE_MODES else SERVICE_MODE_NORMAL,
                "updated_at": updated_at,
                "updated_by": updated_by,
            },
            ensure_ascii=False,
            sort_keys=True,
        ),
    )


def _mark_command_usage(
    state_path: str,
    *,
    telegram_user_id: int | None,
    command: str,
    timestamp: str,
) -> None:
    if telegram_user_id is None or _command_rate_limit_seconds(command) <= 0:
        return
    save_kv_value(
        state_path,
        _command_rate_limit_key(telegram_user_id, command),
        timestamp,
    )


def _command_rate_limit_remaining_seconds(
    state_path: str,
    *,
    telegram_user_id: int | None,
    command: str,
    now: datetime,
) -> int:
    if telegram_user_id is None:
        return 0
    limit_seconds = _command_rate_limit_seconds(command)
    if limit_seconds <= 0:
        return 0
    previous = load_kv_value(
        state_path,
        _command_rate_limit_key(telegram_user_id, command),
    )
    elapsed = _seconds_between(now, previous)
    if elapsed is None or elapsed >= limit_seconds:
        return 0
    return limit_seconds - elapsed


def _format_cooldown_message(command: str, remaining_seconds: int) -> str:
    return (
        "⏱️ <b>Richiesta troppo ravvicinata</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Il comando <code>{command}</code> è in cooldown per altri "
        f"<code>{remaining_seconds}</code> secondi.\n"
        "Attendi un attimo e riprova."
    )


def _service_mode_blocks_command(mode: str, command: str) -> str | None:
    if mode == SERVICE_MODE_MAINTENANCE and command == "/connect":
        return (
            "🛠️ <b>Modalità manutenzione</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "I nuovi collegamenti eBay sono temporaneamente sospesi.\n"
            "I comandi informativi restano disponibili."
        )
    if mode == SERVICE_MODE_DEGRADED and command in {
        "/connect",
        "/disconnect",
        "/leave_bot",
        "/notifications",
        "/approve_user",
        "/reject_user",
        "/suspend_user",
        "/reactivate_user",
    }:
        return (
            "🚧 <b>Servizio in modalità degradata</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "La consultazione resta disponibile, ma le azioni operative "
            "sono temporaneamente sospese.\n"
            "Riprova più tardi oppure usa <code>/stato servizio</code>."
        )
    return None


def _build_service_status_payload(state_path: str) -> dict[str, object]:
    service_state = _load_service_state(state_path)
    mode = str(service_state.get("mode") or SERVICE_MODE_NORMAL)
    return {
        "mode": mode,
        "read_available": True,
        "write_available": mode == SERVICE_MODE_NORMAL,
        "connect_available": mode == SERVICE_MODE_NORMAL,
        "admin_model": "single_admin",
    }


def _build_policy_status_payload(state_path: str) -> dict[str, object]:
    service_state = _load_service_state(state_path)
    mode = str(service_state.get("mode") or SERVICE_MODE_NORMAL)
    public_config = load_public_service_config()
    rate_limit_config = load_rate_limit_config()
    retention_config = load_retention_config()
    readiness = summarize_multi_tenant_readiness(state_path)
    return {
        "mode": mode,
        "service_model": public_config.service_model,
        "web_role": public_config.web_role,
        "onboarding_hosting": public_config.onboarding_hosting,
        "approved_users": readiness.get("approved_users", 0),
        "approved_users_limit": public_config.max_approved_users,
        "linked_accounts": readiness.get("linked_accounts", 0),
        "linked_accounts_limit": public_config.max_linked_accounts,
        "active_token_sets": readiness.get("active_token_sets", 0),
        "active_token_sets_limit": public_config.max_active_token_sets,
        "sqlite_db_limit_mb": public_config.sqlite_max_db_bytes // (1024 * 1024),
        "rate_limit_enabled": rate_limit_config.enabled,
        "rate_limit_request_access_seconds": rate_limit_config.request_access_seconds,
        "rate_limit_connect_seconds": rate_limit_config.connect_seconds,
        "rate_limit_admin_mutation_seconds": rate_limit_config.admin_mutation_seconds,
        "audit_retention_days": retention_config.audit_retention_days,
        "oauth_session_retention_days": retention_config.oauth_session_retention_days,
        "operation_queue_retention_days": retention_config.operation_queue_retention_days,
    }


def fetch_environment_records(
    ebay_environment: str,
    options: FetchOptions,
) -> list[OrderRecord]:
    return _fetch_environment_records(
        ebay_environment,
        options,
        load_config_fn=load_config,
        fetch_records_fn=fetch_records,
    )


def _fetch_tenant_records_for_user(
    ebay_environment: str,
    options: FetchOptions,
    *,
    telegram_user_id: int | None,
    state_path: str,
    allow_global_fallback: bool,
) -> list[OrderRecord]:
    resolved = _resolve_fetch_context(
        ebay_environment,
        telegram_user_id=telegram_user_id,
        state_path=state_path,
        allow_global_fallback=allow_global_fallback,
        load_config_fn=load_config,
        resolve_linked_account_fn=resolve_linked_ebay_account,
        load_tenant_config_fn=load_tenant_config_from_storage,
    )
    return fetch_records(resolved.config, options)


def send_message(
    token: str,
    chat_id: int,
    text: str,
    message_thread_id: Optional[int] = None,
    reply_markup: InlineKeyboardMarkup | None = None,
) -> None:
    _send_message(
        token,
        chat_id,
        text,
        message_thread_id=message_thread_id,
        reply_markup=reply_markup,
        request_fn=telegram_request,
    )


def sync_runtime_contact(
    telegram_config: TelegramConfig,
    *,
    telegram_user_id: int | None,
    chat_id: int | None,
    username: str = "",
    display_name: str = "",
    chat_type: str = "private",
) -> None:
    if chat_type != "private":
        return
    if not telegram_user_id or not chat_id:
        return
    if not is_authorized(chat_id, telegram_config):
        return
    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    existing_user = load_telegram_user(telegram_config.state_path, telegram_user_id)
    if telegram_config.admin_user_id is None:
        status = (
            normalize_telegram_user_status(
                existing_user.status,
                default=TELEGRAM_USER_STATUS_APPROVED,
            )
            if existing_user is not None
            else TELEGRAM_USER_STATUS_APPROVED
        )
    else:
        status = (
            normalize_telegram_user_status(existing_user.status)
            if existing_user is not None
            else TELEGRAM_USER_STATUS_NEW
        )
    if _is_admin_user(telegram_user_id, telegram_config):
        status = TELEGRAM_USER_STATUS_ADMIN
    upsert_telegram_user(
        telegram_config.state_path,
        TelegramUser(
            telegram_user_id=telegram_user_id,
            telegram_chat_id=chat_id,
            username=username,
            display_name=display_name,
            created_at=timestamp,
            status=status,
        ),
    )
    upsert_telegram_chat(
        telegram_config.state_path,
        TelegramChat(
            telegram_user_id=telegram_user_id,
            telegram_chat_id=chat_id,
            chat_type=chat_type or "private",
            is_primary=True,
            notifications_enabled=chat_id in telegram_config.notify_chat_ids,
            created_at=timestamp,
            updated_at=timestamp,
        ),
    )
    if chat_id in telegram_config.notify_chat_ids and has_telegram_user_capability(
        status,
        CAPABILITY_MANAGE_NOTIFICATIONS,
    ):
        upsert_notification_subscription(
            telegram_config.state_path,
            NotificationSubscription(
                telegram_user_id=telegram_user_id,
                telegram_chat_id=chat_id,
                enabled=True,
                filters="",
                created_at=timestamp,
                updated_at=timestamp,
            ),
        )


def _build_tenant_ux_context(
    telegram_config: TelegramConfig,
    *,
    telegram_user_id: int,
    chat_id: int,
    environment: str,
) -> dict[str, object]:
    account_status = summarize_tenant_account_status(
        telegram_config.state_path,
        telegram_user_id,
        environment,
    )
    subscriptions = load_notification_subscriptions(telegram_config.state_path)
    notifications_enabled = any(
        subscription.telegram_user_id == telegram_user_id
        and subscription.telegram_chat_id == chat_id
        and subscription.enabled
        for subscription in subscriptions
    )
    runtime_state = load_tenant_runtime_state(
        telegram_config.state_path,
        telegram_user_id,
    )
    latest_session = load_latest_oauth_link_session(
        telegram_config.state_path,
        telegram_user_id,
    )
    now = datetime.now(timezone.utc)
    session_ready = _is_reusable_oauth_session(
        latest_session,
        environment=environment,
        now=now,
    )
    return {
        **account_status,
        "notifications_enabled": notifications_enabled,
        "last_fetch_start": runtime_state.memory.last_fetch_start,
        "last_fetch_end": runtime_state.memory.last_fetch_end,
        "last_seen_order_id": runtime_state.memory.last_seen_order_id,
        "last_seen_order_created_at": runtime_state.memory.last_seen_order_created_at,
        "last_notified_order_id": runtime_state.memory.last_notified_order_id,
        "last_notified_order_created_at": runtime_state.memory.last_notified_order_created_at,
        "latest_session_status": latest_session.status if latest_session is not None else "",
        "latest_session_expires_at": (
            latest_session.expires_at if latest_session is not None else ""
        ),
        "session_ready": session_ready,
    }


def _notification_filter_mode_from_filters(filters: str) -> str:
    raw = str(filters or "").strip()
    if not raw:
        return "all"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return "all"
    tax_identifier_type = str(parsed.get("tax_identifier_type") or "").strip().upper()
    if tax_identifier_type == "CODICE_FISCALE":
        return "cf"
    if tax_identifier_type == "VAT_NUMBER":
        return "vat"
    return "all"


def _notification_filter_payload(mode: str) -> str:
    if mode == "cf":
        return json.dumps({"tax_identifier_type": "CODICE_FISCALE"}, ensure_ascii=True)
    if mode == "vat":
        return json.dumps({"tax_identifier_type": "VAT_NUMBER"}, ensure_ascii=True)
    return ""


def _notification_filter_label(mode: str) -> str:
    return {
        "all": "tutti",
        "cf": "solo_cf",
        "vat": "solo_piva",
    }.get(mode, "tutti")


def _record_matches_notification_filter(mode: str, record: OrderRecord) -> bool:
    normalized = (mode or "all").strip().lower()
    if normalized == "cf":
        return str(record.taxIdentifierType or "").strip().upper() == "CODICE_FISCALE"
    if normalized == "vat":
        return str(record.taxIdentifierType or "").strip().upper() == "VAT_NUMBER"
    return True


def _notify_user_access_status(
    telegram_config: TelegramConfig,
    *,
    telegram_user_id: int,
    text: str,
) -> None:
    target_chat_id = resolve_primary_chat_id(telegram_config.state_path, telegram_user_id)
    if target_chat_id is None:
        return
    send_message(
        telegram_config.token,
        target_chat_id,
        text,
    )


def _append_audit_log(
    telegram_config: TelegramConfig,
    *,
    event_type: str,
    created_at: str,
    actor_telegram_user_id: int | None = None,
    target_telegram_user_id: int | None = None,
    telegram_chat_id: int | None = None,
    ebay_user_id: str = "",
    environment: str = "",
    outcome: str = "",
    details: Mapping[str, object] | None = None,
) -> None:
    append_audit_log_entry(
        telegram_config.state_path,
        AuditLogEntry(
            event_type=event_type,
            created_at=created_at,
            actor_telegram_user_id=actor_telegram_user_id,
            target_telegram_user_id=target_telegram_user_id,
            telegram_chat_id=telegram_chat_id,
            ebay_user_id=ebay_user_id,
            environment=environment,
            outcome=outcome,
            details_json=json.dumps(details or {}, ensure_ascii=False, sort_keys=True),
        ),
    )


def resolve_tenant_command_context(
    telegram_config: TelegramConfig,
    *,
    chat_id: int,
    telegram_user_id: int | None = None,
) -> TenantChatContext | None:
    return resolve_tenant_chat_context(
        telegram_config.state_path,
        telegram_chat_id=chat_id,
        telegram_user_id=telegram_user_id,
    )
