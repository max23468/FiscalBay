"""Telegram bot runtime and command handling."""

from __future__ import annotations

import json
import logging
import os
import secrets
from contextlib import suppress
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows
    fcntl = None

from .application import fetch_environment_records as _fetch_environment_records
from .application import resolve_fetch_context as _resolve_fetch_context
from .bot_messaging import request_with_backoff
from .bot_messaging import send_message as _send_message
from .clients.ebay import revoke_user_refresh_token
from .clients.telegram import InlineKeyboardMarkup, ensure_long_polling, telegram_request
from .config import configure_logging, load_config, load_telegram_config
from .errors import ConfigurationError, TelegramApiError
from .logging_utils import log_event
from .models import (
    CAPABILITY_CONNECT_ACCOUNT,
    CAPABILITY_MANAGE_NOTIFICATIONS,
    CAPABILITY_MANAGE_SETTINGS,
    CAPABILITY_REQUEST_ACCESS,
    CAPABILITY_REVIEW_ACCESS,
    CAPABILITY_USE_BOT,
    CAPABILITY_VIEW_ACCOUNT,
    CAPABILITY_VIEW_ORDERS,
    OAUTH_SESSION_STATUS_PENDING,
    TELEGRAM_USER_STATUS_ADMIN,
    TELEGRAM_USER_STATUS_APPROVED,
    TELEGRAM_USER_STATUS_BLOCKED,
    TELEGRAM_USER_STATUS_NEW,
    TELEGRAM_USER_STATUS_PENDING,
    AuditLogEntry,
    BotRuntimeState,
    BotRuntimeStateLike,
    FetchOptions,
    JsonObject,
    LinkedEbayAccount,
    NotificationSubscription,
    OauthLinkSession,
    OrderRecord,
    OrderRecordLike,
    RetryQueueEntry,
    TelegramChat,
    TelegramConfig,
    TelegramUser,
    TenantChatContext,
    has_telegram_user_capability,
    is_blocked_telegram_user_status,
    is_pending_telegram_user_status,
    normalize_telegram_user_status,
)
from .reconcile import enqueue_apply_user_access_operation, process_pending_operations
from .services.notifications import (
    fetch_new_order_records as _fetch_new_order_records,
)
from .services.notifications import (
    increment_error_metric as _increment_error_metric,
)
from .services.notifications import (
    increment_metric as _increment_metric,
)
from .services.notifications import (
    maybe_send_new_order_notifications as _maybe_send_new_order_notifications,
)
from .services.notifications import (
    now_utc as _now_utc,
)
from .services.notifications import (
    process_retry_queue as _process_retry_queue,
)
from .services.notifications import (
    update_state_with_records as _update_state_with_records,
)
from .services.orders import fetch_records
from .services.telegram_runtime import (
    auto_notify_loop as _auto_notify_loop,
)
from .services.telegram_runtime import (
    extract_callback_context,
    extract_message_context,
)
from .services.telegram_runtime import (
    request_shutdown as _request_shutdown,
)
from .services.telegram_runtime import (
    run_bot as _run_bot,
)
from .storage.sqlite import (
    append_audit_log_entry,
    apply_telegram_user_access_status,
    create_oauth_link_session,
    disconnect_linked_ebay_account,
    ensure_parent_dir,
    list_notification_tenants,
    load_audit_log_entries,
    load_kv_value,
    load_latest_oauth_link_session,
    load_notification_subscriptions,
    load_retry_queue_entries,
    load_runtime_state,
    load_telegram_chats,
    load_telegram_user,
    load_telegram_users,
    load_tenant_account_status_cache,
    load_tenant_retry_queue_entries,
    load_tenant_runtime_state,
    resolve_ebay_token_set,
    resolve_linked_ebay_account,
    resolve_primary_chat_id,
    resolve_tenant_chat_context,
    save_kv_value,
    save_retry_queue_entries,
    save_runtime_state,
    save_tenant_retry_queue_entries,
    save_tenant_runtime_state,
    set_notification_subscription_enabled,
    summarize_operation_queue,
    summarize_tenant_account_status,
    update_telegram_user_status,
    upsert_notification_subscription,
    upsert_telegram_chat,
    upsert_telegram_user,
)
from .telegram_commands import (
    CALLBACK_HELP,
    CALLBACK_REQUEST_ACCESS,
    CALLBACK_SETTINGS,
    CALLBACK_STATO,
    CALLBACK_TUTTI,
    CALLBACK_ULTIMI,
    TELEGRAM_CMD_MAX_DAYS,
    TELEGRAM_CMD_MAX_RESULTS,
    TELEGRAM_CMD_MIN_DAYS,
    TELEGRAM_CMD_MIN_RESULTS,
    build_admin_approval_markup,
    build_help_text,
    build_main_menu_markup,
    build_start_text,
    callback_command_from_data,
    chunk_message,
    format_access_request_status,
    format_access_required_status,
    format_account_status,
    format_admin_access_request,
    format_admin_dashboard,
    format_admin_status_update,
    format_admin_user_list,
    format_connect_status,
    format_disconnect_status,
    format_leave_status,
    format_notifications_status,
    format_order_notification_summary,
    format_policy_status,
    format_reconnect_status,
    format_service_status,
    format_settings_status,
    format_status,
    format_tenant_health,
    format_why_not_notified_status,
    is_authorized,
    options_for_command,
    parse_command,
    should_attach_main_menu,
)
from .telegram_commands import (
    format_auto_notification as _format_auto_notification,
)
from .telegram_commands import (
    format_record as _format_record,
)
from .telegram_commands import (
    format_records as _format_records,
)
from .telegram_commands import (
    has_codice_fiscale as _has_codice_fiscale,
)
from .telegram_commands import (
    process_message as _process_message,
)
from .telegram_commands import (
    record_fingerprint as _record_fingerprint,
)
from .tenant_credentials import decode_refresh_token, load_tenant_config_from_storage

LOGGER = logging.getLogger("ebaycf.telegram_bot")
COMMAND_CAPABILITIES: dict[str, str] = {
    "/ping": CAPABILITY_USE_BOT,
    "/stato": CAPABILITY_USE_BOT,
    "/account": CAPABILITY_VIEW_ACCOUNT,
    "/reconnect_status": CAPABILITY_VIEW_ACCOUNT,
    "/connect": CAPABILITY_CONNECT_ACCOUNT,
    "/disconnect": CAPABILITY_CONNECT_ACCOUNT,
    "/leave_bot": CAPABILITY_MANAGE_SETTINGS,
    "/notifications": CAPABILITY_MANAGE_NOTIFICATIONS,
    "/settings": CAPABILITY_MANAGE_SETTINGS,
    "/why_not_notified": CAPABILITY_VIEW_ORDERS,
    "/ultimi": CAPABILITY_VIEW_ORDERS,
    "/tutti": CAPABILITY_VIEW_ORDERS,
    "/ordine": CAPABILITY_VIEW_ORDERS,
    "/users": CAPABILITY_REVIEW_ACCESS,
    "/pending_users": CAPABILITY_REVIEW_ACCESS,
    "/unlinked_users": CAPABILITY_REVIEW_ACCESS,
    "/tenant_health": CAPABILITY_REVIEW_ACCESS,
    "/admin_dashboard": CAPABILITY_REVIEW_ACCESS,
    "/approve_user": CAPABILITY_REVIEW_ACCESS,
    "/reject_user": CAPABILITY_REVIEW_ACCESS,
    "/suspend_user": CAPABILITY_REVIEW_ACCESS,
    "/reactivate_user": CAPABILITY_REVIEW_ACCESS,
    "/service_mode": CAPABILITY_REVIEW_ACCESS,
    "/request_access": CAPABILITY_REQUEST_ACCESS,
}

SERVICE_MODE_NORMAL = "normal"
SERVICE_MODE_MAINTENANCE = "maintenance"
SERVICE_MODE_DEGRADED = "degraded"
SERVICE_MODES = {
    SERVICE_MODE_NORMAL,
    SERVICE_MODE_MAINTENANCE,
    SERVICE_MODE_DEGRADED,
}
DEFAULT_ADMIN_SUMMARY_INTERVAL_SECONDS = 6 * 60 * 60
PENDING_STALE_HOURS = 48
UNLINKED_STALE_HOURS = 72
REVOKED_STALE_HOURS = 72
COMMAND_RATE_LIMIT_SECONDS: dict[str, int] = {
    "/request_access": 60,
    "/connect": 10,
    "/disconnect": 5,
    "/leave_bot": 5,
    "/service_mode": 2,
}


def coerce_runtime_state(state: BotRuntimeStateLike) -> BotRuntimeState:
    if isinstance(state, BotRuntimeState):
        return state
    return BotRuntimeState.from_mapping(state)


def _now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


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


def _admin_summary_key() -> str:
    return "admin_summary:last_sent_at"


def _admin_summary_hash_key() -> str:
    return "admin_summary:last_payload_hash"


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
    if telegram_user_id is None or command not in COMMAND_RATE_LIMIT_SECONDS:
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
    limit_seconds = COMMAND_RATE_LIMIT_SECONDS.get(command, 0)
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
        f"Il comando <code>{command}</code> e' in cooldown per altri "
        f"<code>{remaining_seconds}</code> secondi.\n"
        "Attendi un attimo e riprova."
    )


def _load_recent_audit_entries(
    telegram_config: TelegramConfig,
    *,
    limit: int = 300,
) -> list[AuditLogEntry]:
    return load_audit_log_entries(telegram_config.state_path, limit=limit)


def _connect_cooldown_remaining_seconds(
    telegram_config: TelegramConfig,
    *,
    telegram_user_id: int,
    environment: str,
    now: datetime,
) -> int:
    entries = _load_recent_audit_entries(telegram_config, limit=300)
    connect_attempts = 0
    recent_failure_times: list[datetime] = []
    latest_failure: datetime | None = None
    for entry in entries:
        if entry.target_telegram_user_id not in {telegram_user_id, None}:
            continue
        if entry.environment and entry.environment != environment:
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
                and entry.target_telegram_user_id in {telegram_user_id, None}
                and (not entry.environment or entry.environment == environment)
                and _parse_iso_timestamp(entry.created_at) is not None
            ),
            None,
        )
        if most_recent_connect is not None:
            remaining = 300 - int((now - most_recent_connect).total_seconds())
            if remaining > 0:
                return remaining
    return 0


def _service_mode_blocks_command(mode: str, command: str) -> str | None:
    if mode == SERVICE_MODE_MAINTENANCE and command == "/connect":
        return (
            "🛠️ <b>Modalita' manutenzione</b>\n"
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
            "🚧 <b>Servizio in modalita' degradata</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "La consultazione resta disponibile, ma le azioni operative "
            "sono temporaneamente sospese.\n"
            "Riprova piu' tardi oppure usa <code>/service_status</code>."
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


def _build_user_row(
    telegram_config: TelegramConfig,
    *,
    user: TelegramUser,
) -> dict[str, object]:
    account_status = summarize_tenant_account_status(
        telegram_config.state_path,
        user.telegram_user_id,
        "",
    )
    operational_state = "waiting_connect"
    if user.status == TELEGRAM_USER_STATUS_PENDING:
        operational_state = "pending"
    elif user.status == TELEGRAM_USER_STATUS_BLOCKED:
        operational_state = "blocked"
    elif user.status == TELEGRAM_USER_STATUS_ADMIN:
        operational_state = "admin"
    else:
        raw_account_status = str(account_status.get("account_status") or "unlinked")
        raw_token_status = str(account_status.get("token_status") or "missing")
        if raw_account_status == "linked" and raw_token_status == "active":
            operational_state = "ready"
        elif raw_account_status in {"revoked"} or raw_token_status in {
            "revoked",
            "expired",
            "token_expired",
        }:
            operational_state = "reconnect_required"
    last_issue = str(account_status.get("latest_reconnect_outcome") or "")
    if not last_issue and operational_state != "ready":
        last_issue = operational_state
    return {
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
        "created_at": user.created_at or "",
    }


def _build_user_rows(telegram_config: TelegramConfig) -> list[dict[str, object]]:
    return [
        _build_user_row(telegram_config, user=user)
        for user in load_telegram_users(telegram_config.state_path)
    ]


def _build_admin_dashboard_payload(telegram_config: TelegramConfig) -> dict[str, object]:
    rows = _build_user_rows(telegram_config)
    now = datetime.now(timezone.utc)
    audit_entries = _load_recent_audit_entries(telegram_config, limit=400)
    oauth_failures_recent = 0
    for entry in audit_entries:
        if entry.event_type != "oauth_failure":
            continue
        created_at = _parse_iso_timestamp(entry.created_at)
        if created_at is None:
            continue
        if int((now - created_at).total_seconds()) <= 24 * 60 * 60:
            oauth_failures_recent += 1
    pending_stale = 0
    unlinked_stale = 0
    revoked_stale = 0
    alerts: list[dict[str, str]] = []
    for row in rows:
        created_at = _parse_iso_timestamp(str(row.get("created_at") or ""))
        age_hours = int((now - created_at).total_seconds() // 3600) if created_at else 0
        status = str(row.get("status") or "")
        account_status = str(row.get("account_status") or "unlinked")
        token_status = str(row.get("token_status") or "missing")
        if status == TELEGRAM_USER_STATUS_PENDING and age_hours >= PENDING_STALE_HOURS:
            pending_stale += 1
        if (
            status == TELEGRAM_USER_STATUS_APPROVED
            and account_status != "linked"
            and age_hours >= UNLINKED_STALE_HOURS
        ):
            unlinked_stale += 1
        if (
            status == TELEGRAM_USER_STATUS_APPROVED
            and token_status in {"revoked", "expired", "token_expired"}
            and age_hours >= REVOKED_STALE_HOURS
        ):
            revoked_stale += 1
    if pending_stale:
        alerts.append(
            {
                "code": "pending_stale",
                "message": f"{pending_stale} richieste pending ferme oltre soglia",
            }
        )
    if unlinked_stale:
        alerts.append(
            {
                "code": "approved_unlinked_stale",
                "message": f"{unlinked_stale} utenti approvati non hanno ancora collegato eBay",
            }
        )
    if revoked_stale:
        alerts.append(
            {
                "code": "token_revoked_stale",
                "message": f"{revoked_stale} tenant restano con token revocato o scaduto",
            }
        )
    queue_summary = summarize_operation_queue(telegram_config.state_path)
    if queue_summary.get("pending", 0) > 0:
        alerts.append(
            {
                "code": "operation_queue_pending",
                "message": f"{queue_summary.get('pending', 0)} operazioni ancora pending",
            }
        )
    if queue_summary.get("failed", 0) > 0:
        alerts.append(
            {
                "code": "operation_queue_failed",
                "message": f"{queue_summary.get('failed', 0)} operazioni fallite da rivedere",
            }
        )
    approved_users = sum(
        1
        for row in rows
        if str(row.get("status"))
        in {TELEGRAM_USER_STATUS_APPROVED, TELEGRAM_USER_STATUS_ADMIN}
    )
    service_mode = _load_service_state(telegram_config.state_path).get(
        "mode",
        SERVICE_MODE_NORMAL,
    )
    pending_users = sum(
        1
        for row in rows
        if str(row.get("status")) == TELEGRAM_USER_STATUS_PENDING
    )
    linked_users = sum(
        1
        for row in rows
        if str(row.get("account_status")) == "linked"
        and str(row.get("token_status")) == "active"
    )
    return {
        "service_mode": service_mode,
        "metrics": {
            "pending_users": pending_users,
            "approved_users": approved_users,
            "linked_users": linked_users,
            "approved_without_link": sum(
                1
                for row in rows
                if str(row.get("status")) == TELEGRAM_USER_STATUS_APPROVED
                and str(row.get("account_status")) != "linked"
            ),
            "oauth_failures_recent": oauth_failures_recent,
            "pending_stale": pending_stale,
            "revoked_stale": revoked_stale,
        },
        "queue": queue_summary,
        "alerts": alerts,
    }


def _maybe_send_admin_summary(telegram_config: TelegramConfig) -> None:
    if telegram_config.admin_user_id is None:
        return
    admin_chat_id = resolve_primary_chat_id(
        telegram_config.state_path,
        telegram_config.admin_user_id,
    )
    if admin_chat_id is None:
        return
    now_iso = _now_utc_iso()
    last_sent_at = load_kv_value(telegram_config.state_path, _admin_summary_key())
    elapsed = _seconds_between(datetime.now(timezone.utc), last_sent_at)
    dashboard = _build_admin_dashboard_payload(telegram_config)
    pending_users = int((dashboard.get("metrics") or {}).get("pending_users", 0))
    if not dashboard.get("alerts") and pending_users == 0:
        return
    payload_hash = json.dumps(dashboard, ensure_ascii=False, sort_keys=True)
    last_payload_hash = load_kv_value(telegram_config.state_path, _admin_summary_hash_key())
    if last_payload_hash == payload_hash and elapsed is not None and elapsed < 24 * 60 * 60:
        return
    if last_payload_hash != payload_hash or elapsed is None:
        pass
    elif elapsed < DEFAULT_ADMIN_SUMMARY_INTERVAL_SECONDS:
        return
    send_message(
        telegram_config.token,
        admin_chat_id,
        format_admin_dashboard(dashboard),
    )
    save_kv_value(telegram_config.state_path, _admin_summary_key(), now_iso)
    save_kv_value(telegram_config.state_path, _admin_summary_hash_key(), payload_hash)


def _disconnect_account_with_remote_revocation(
    *,
    telegram_config: TelegramConfig,
    telegram_user_id: int,
    environment: str,
) -> tuple[LinkedEbayAccount | None, str, str]:
    linked_account = resolve_linked_ebay_account(
        telegram_config.state_path,
        telegram_user_id,
        environment,
    )
    remote_revocation_status = "not_attempted"
    remote_revocation_detail = ""
    if linked_account is not None:
        tenant_config = load_tenant_config_from_storage(
            linked_account,
            environment,
            telegram_config.state_path,
        )
        if tenant_config is None:
            remote_revocation_status = "skipped"
            remote_revocation_detail = "refresh token tenant non disponibile"
        else:
            try:
                revoke_user_refresh_token(tenant_config)
            except Exception as exc:
                remote_revocation_status = "failed"
                remote_revocation_detail = str(exc)
            else:
                remote_revocation_status = "revoked"
    disconnected_account = disconnect_linked_ebay_account(
        telegram_config.state_path,
        telegram_user_id,
        environment,
    )
    return disconnected_account, remote_revocation_status, remote_revocation_detail


def coerce_order_records(records: list[OrderRecordLike]) -> list[OrderRecord]:
    normalized: list[OrderRecord] = []
    for record in records:
        if isinstance(record, OrderRecord):
            normalized.append(record)
        else:
            normalized.append(OrderRecord.from_mapping(record))
    return normalized


def coerce_order_record(record: OrderRecordLike) -> OrderRecord:
    if isinstance(record, OrderRecord):
        return record
    return OrderRecord.from_mapping(record)


def fetch_environment_records(ebay_environment: str, options) -> list[OrderRecord]:
    return coerce_order_records(
        _fetch_environment_records(
            ebay_environment,
            options,
            load_config_fn=load_config,
            fetch_records_fn=fetch_records,
        )
    )


def fetch_tenant_records(
    ebay_environment: str,
    options,
    *,
    telegram_user_id: int | None,
    state_path: str,
) -> list[OrderRecord]:
    records = _fetch_tenant_records_for_user(
        ebay_environment,
        options,
        telegram_user_id=telegram_user_id,
        state_path=state_path,
        allow_global_fallback=False,
    )
    return coerce_order_records(records)


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


def record_fingerprint(record: OrderRecordLike) -> str:
    return _record_fingerprint(coerce_order_record(record))


def format_record(record: OrderRecordLike) -> str:
    return _format_record(coerce_order_record(record))


def format_records(
    records: list[OrderRecordLike], only_found: bool, page_size: int = 5
) -> list[str]:
    return _format_records(
        coerce_order_records(records),
        only_found=only_found,
        page_size=page_size,
    )


def has_codice_fiscale(record: OrderRecordLike) -> bool:
    return _has_codice_fiscale(coerce_order_record(record))


def format_auto_notification(record: OrderRecordLike) -> str:
    return _format_auto_notification(coerce_order_record(record))


def now_utc():
    return _now_utc()


__all__ = [
    "CALLBACK_HELP",
    "CALLBACK_REQUEST_ACCESS",
    "CALLBACK_SETTINGS",
    "CALLBACK_STATO",
    "CALLBACK_TUTTI",
    "CALLBACK_ULTIMI",
    "TELEGRAM_CMD_MAX_DAYS",
    "TELEGRAM_CMD_MAX_RESULTS",
    "TELEGRAM_CMD_MIN_DAYS",
    "TELEGRAM_CMD_MIN_RESULTS",
    "TelegramApiError",
    "TelegramConfig",
    "acquire_process_lock",
    "auto_notify_loop",
    "build_help_text",
    "build_main_menu_markup",
    "callback_command_from_data",
    "chunk_message",
    "ensure_long_polling",
    "extract_callback_context",
    "extract_message_context",
    "fetch_new_order_records",
    "format_auto_notification",
    "format_record",
    "format_records",
    "format_status",
    "has_codice_fiscale",
    "increment_error_metric",
    "increment_metric",
    "is_authorized",
    "maybe_send_new_order_notifications",
    "now_utc",
    "options_for_command",
    "parse_command",
    "process_message",
    "process_retry_queue",
    "record_fingerprint",
    "release_process_lock",
    "request_shutdown",
    "request_with_backoff",
    "run_bot",
    "send_message",
    "should_attach_main_menu",
    "sync_runtime_contact",
    "telegram_request",
    "update_state_with_records",
]


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
    if not is_authorized(chat_id, telegram_config):
        return
    if not telegram_user_id or not chat_id:
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


def _is_admin_user(telegram_user_id: int | None, telegram_config: TelegramConfig) -> bool:
    return (
        telegram_user_id is not None
        and telegram_config.admin_user_id is not None
        and telegram_user_id == telegram_config.admin_user_id
    )


def _load_user_status(
    telegram_config: TelegramConfig,
    telegram_user_id: int | None,
) -> str | None:
    if telegram_user_id is None:
        return None
    if _is_admin_user(telegram_user_id, telegram_config):
        return TELEGRAM_USER_STATUS_ADMIN
    user = load_telegram_user(telegram_config.state_path, telegram_user_id)
    if user is None:
        return None
    return normalize_telegram_user_status(user.status)


def _is_user_approved(
    telegram_config: TelegramConfig,
    telegram_user_id: int | None,
) -> bool:
    if telegram_config.admin_user_id is None:
        return True
    status = _load_user_status(telegram_config, telegram_user_id)
    return has_telegram_user_capability(status, CAPABILITY_USE_BOT)


def _has_command_capability(
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
    return has_telegram_user_capability(
        _load_user_status(telegram_config, telegram_user_id),
        required_capability,
    )


def _is_reusable_oauth_session(
    session: OauthLinkSession | None,
    *,
    environment: str,
    now: datetime,
) -> bool:
    if session is None:
        return False
    if session.environment != environment:
        return False
    if session.status != OAUTH_SESSION_STATUS_PENDING:
        return False
    if not session.expires_at:
        return True
    try:
        expires_at = datetime.fromisoformat(session.expires_at.replace("Z", "+00:00"))
    except ValueError:
        return False
    return expires_at > now


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
    details: JsonObject | None = None,
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


def build_connect_entrypoint_url(oauth_state: str) -> str:
    base_url = os.getenv("EBAY_OAUTH_CONNECT_BASE_URL", "").strip()
    if not base_url:
        return ""
    separator = "&" if "?" in base_url else "?"
    return f"{base_url}{separator}state={oauth_state}"


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


def acquire_process_lock(lock_path: str):
    if fcntl is None:
        log_event(
            LOGGER,
            logging.WARNING,
            "process_lock_unavailable",
            lock_path=lock_path,
            reason="fcntl_unavailable",
        )
        return None
    ensure_parent_dir(lock_path)
    handle = open(lock_path, "a+", encoding="utf-8")
    try:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        handle.seek(0)
        holder = handle.read().strip()
        handle.close()
        holder_details = f" ({holder})" if holder else ""
        raise TelegramApiError(
            "Un'altra istanza del bot e' gia' in esecuzione (lock su "
            f"{lock_path}{holder_details}). Chiudi l'altra copia o imposta "
            "TELEGRAM_BOT_LOCK_PATH."
        ) from None
    try:
        os.chmod(lock_path, 0o600)
    except OSError:
        pass
    handle.seek(0)
    handle.truncate()
    handle.write(f"pid={os.getpid()}\nstarted_at={datetime.now(timezone.utc).isoformat()}\n")
    handle.flush()
    return handle


def release_process_lock(lock_handle, lock_path: str) -> None:
    try:
        if fcntl is not None:
            fcntl.flock(lock_handle.fileno(), fcntl.LOCK_UN)
    except OSError:
        pass
    with suppress(OSError):
        lock_handle.close()
    with suppress(FileNotFoundError, OSError):
        os.remove(lock_path)


def increment_metric(state: BotRuntimeStateLike, metric: str, amount: int = 1) -> None:
    _increment_metric(coerce_runtime_state(state), metric, amount)


def increment_error_metric(state: BotRuntimeStateLike, error_type: str) -> None:
    _increment_error_metric(coerce_runtime_state(state), error_type)


def process_retry_queue(telegram_config: TelegramConfig, state: BotRuntimeStateLike) -> None:
    _process_retry_queue(
        telegram_config,
        coerce_runtime_state(state),
        load_retry_queue_fn=load_retry_queue_entries,
        save_retry_queue_fn=save_retry_queue_entries,
        send_message_fn=send_message,
    )


def fetch_new_order_records(
    ebay_environment: str,
    state: BotRuntimeStateLike,
    lookback_minutes: int = 180,
) -> list[OrderRecord]:
    return _fetch_new_order_records(
        ebay_environment,
        coerce_runtime_state(state),
        fetch_records_for_environment_fn=fetch_environment_records,
        request_with_backoff_fn=request_with_backoff,
        lookback_minutes=lookback_minutes,
    )


def update_state_with_records(
    state: BotRuntimeStateLike,
    records: list[OrderRecordLike],
    checked_at: Optional[str] = None,
    max_tracked_orders: int = 1000,
) -> JsonObject:
    updated_state = _update_state_with_records(
        coerce_runtime_state(state),
        coerce_order_records(records),
        checked_at=checked_at,
        max_tracked_orders=max_tracked_orders,
    )
    return updated_state.as_dict()


def explain_why_order_not_notified(
    order: OrderRecord,
    state: BotRuntimeState,
    *,
    environment: str,
    state_path: str,
    telegram_user_id: int | None,
    chat_id: int | None,
) -> dict[str, str]:
    order_id = order.orderId
    fingerprint = record_fingerprint(order)
    delivery_status = "delivery_unknown"
    delivery_headline = "Il contesto di recapito di questa chat non e' disponibile."
    delivery_detail = (
        "Il comando non riesce a verificare preferenze notifiche senza chat o utente Telegram."
    )
    if telegram_user_id is not None and chat_id is not None:
        chats = load_telegram_chats(state_path)
        subscriptions = load_notification_subscriptions(state_path)
        chat = next(
            (
                item
                for item in chats
                if item.telegram_user_id == telegram_user_id and item.telegram_chat_id == chat_id
            ),
            None,
        )
        subscription = next(
            (
                item
                for item in subscriptions
                if item.telegram_user_id == telegram_user_id and item.telegram_chat_id == chat_id
            ),
            None,
        )
        if chat is None:
            delivery_status = "chat_not_registered"
            delivery_headline = "Questa chat non e' ancora registrata come target notifiche."
            delivery_detail = (
                "Invia un comando al bot da questa chat e verifica poi /settings o /notifications."
            )
        elif not chat.notifications_enabled:
            delivery_status = "chat_notifications_disabled"
            delivery_headline = "Le notifiche risultano disabilitate per questa chat."
            delivery_detail = (
                "Riattiva la chat con /notifications on prima di aspettarti nuovi avvisi."
            )
        elif subscription is None:
            delivery_status = "chat_not_subscribed"
            delivery_headline = "Questa chat non ha una subscription notifiche attiva."
            delivery_detail = (
                "Serve una subscription tenant per ricevere auto-notifiche in questa chat."
            )
        elif not subscription.enabled:
            delivery_status = "chat_subscription_disabled"
            delivery_headline = "La subscription notifiche di questa chat e' disattivata."
            delivery_detail = (
                "Riattiva la subscription con /notifications on per ricevere nuovi ordini."
            )
        else:
            delivery_status = "delivery_ready"
            delivery_headline = "Questa chat risulta abilitata a ricevere notifiche."
            delivery_detail = (
                "Se l'ordine e' eleggibile e non gia' deduplicato, il recapito qui e' pronto."
            )
    if not order_id:
        return {
            "order_id": "n/d",
            "environment": environment,
            "status": "missing_order_id",
            "headline": "L'ordine non ha un identificativo stabile utilizzabile.",
            "detail": "Il runtime non notificherebbe un record senza orderId.",
            "delivery_status": delivery_status,
            "delivery_headline": delivery_headline,
            "delivery_detail": delivery_detail,
        }
    if not has_codice_fiscale(order):
        return {
            "order_id": order_id,
            "environment": environment,
            "status": "not_eligible",
            "headline": "L'ordine non rientra nei criteri di notifica correnti.",
            "detail": "Il bot notifica solo ordini con CODICE_FISCALE presente e valorizzato.",
            "delivery_status": delivery_status,
            "delivery_headline": delivery_headline,
            "delivery_detail": delivery_detail,
        }
    if order_id in set(state.notified_order_ids):
        return {
            "order_id": order_id,
            "environment": environment,
            "status": "already_notified_order_id",
            "headline": "L'ordine risulta gia' notificato o tracciato come visto.",
            "detail": "La deduplica per orderId evita una seconda notifica.",
            "delivery_status": delivery_status,
            "delivery_headline": delivery_headline,
            "delivery_detail": delivery_detail,
        }
    if fingerprint in set(state.notified_hashes):
        return {
            "order_id": order_id,
            "environment": environment,
            "status": "already_notified_fingerprint",
            "headline": "L'ordine collide con una fingerprint gia' notificata.",
            "detail": "La deduplica per fingerprint evita duplicati anche oltre il solo orderId.",
            "delivery_status": delivery_status,
            "delivery_headline": delivery_headline,
            "delivery_detail": delivery_detail,
        }
    return {
        "order_id": order_id,
        "environment": environment,
        "status": "would_notify",
        "headline": "Con i criteri attuali questo ordine risulta notificabile.",
        "detail": (
            "Se entra in una finestra nuova del polling e la chat ha notifiche attive, "
            "il bot lo notifichera'."
        ),
        "delivery_status": delivery_status,
        "delivery_headline": delivery_headline,
        "delivery_detail": delivery_detail,
    }


def maybe_send_new_order_notifications(
    telegram_config: TelegramConfig,
    ebay_environment: str,
) -> None:
    tenant_targets = list_notification_tenants(telegram_config.state_path)
    strict_tenant_credentials = telegram_config.admin_user_id is not None
    if not tenant_targets:
        if not strict_tenant_credentials:
            _maybe_send_new_order_notifications(
                telegram_config,
                ebay_environment,
                load_state_fn=load_runtime_state,
                save_state_fn=save_runtime_state,
                load_retry_queue_fn=load_retry_queue_entries,
                save_retry_queue_fn=save_retry_queue_entries,
                fetch_records_for_environment_fn=fetch_environment_records,
                send_message_fn=send_message,
                request_with_backoff_fn=request_with_backoff,
            )
            _maybe_send_admin_summary(telegram_config)
            return
        log_event(
            LOGGER,
            logging.INFO,
            "notify_skipped",
            reason="no_tenant_targets",
        )
        _maybe_send_admin_summary(telegram_config)
        return

    for target in tenant_targets:
        cached_account_status = load_tenant_account_status_cache(
            telegram_config.state_path,
            target.telegram_user_id,
        )
        cached_status = str(cached_account_status.get("account_status") or "unlinked")
        cached_token_status = str(cached_account_status.get("token_status") or "missing")
        if cached_status in {"disconnected", "revoked"} or cached_token_status in {
            "revoked",
            "expired",
            "token_expired",
        }:
            log_event(
                LOGGER,
                logging.INFO,
                "notify_tenant_skipped",
                telegram_user_id=target.telegram_user_id,
                environment=target.environment,
                reason="tenant_reconnect_cached",
            )
            continue
        token_set = resolve_ebay_token_set(
            telegram_config.state_path,
            target.telegram_user_id,
            target.environment,
        )
        if (
            token_set is None
            or token_set.status != "active"
            or not decode_refresh_token(token_set.refresh_token_encrypted)
        ):
            log_event(
                LOGGER,
                logging.WARNING,
                "notify_tenant_skipped",
                telegram_user_id=target.telegram_user_id,
                environment=target.environment,
                reason="tenant_credentials_unavailable",
            )
            continue
        tenant_config = TelegramConfig(
            token=telegram_config.token,
            allowed_chat_ids=telegram_config.allowed_chat_ids,
            notify_chat_ids=set(target.notify_chat_ids),
            poll_timeout_seconds=telegram_config.poll_timeout_seconds,
            ebay_poll_interval_seconds=telegram_config.ebay_poll_interval_seconds,
            state_path=telegram_config.state_path,
            retry_queue_path=telegram_config.retry_queue_path,
            lock_path=telegram_config.lock_path,
        )
        _maybe_send_new_order_notifications(
            tenant_config,
            target.environment or ebay_environment,
            load_state_fn=lambda _path, user_id=target.telegram_user_id: load_tenant_runtime_state(
                telegram_config.state_path, user_id
            ),
            save_state_fn=lambda _path, state, user_id=target.telegram_user_id: (
                save_tenant_runtime_state(telegram_config.state_path, user_id, state)
            ),
            load_retry_queue_fn=lambda _path, user_id=target.telegram_user_id: (
                load_tenant_retry_queue_entries(telegram_config.retry_queue_path, user_id)
            ),
            save_retry_queue_fn=lambda _path, queue, user_id=target.telegram_user_id: (
                save_tenant_retry_queue_entries(telegram_config.retry_queue_path, user_id, queue)
            ),
            fetch_records_for_environment_fn=lambda env, options, user_id=target.telegram_user_id: (
                coerce_order_records(
                    _fetch_tenant_records_for_user(
                        env,
                        options,
                        telegram_user_id=user_id,
                        state_path=telegram_config.state_path,
                        allow_global_fallback=not strict_tenant_credentials,
                    )
                )
            ),
            send_message_fn=send_message,
            request_with_backoff_fn=request_with_backoff,
        )
    _maybe_send_admin_summary(telegram_config)


def process_message(
    text: str,
    chat_id: int,
    telegram_config: TelegramConfig,
    ebay_environment: str,
    telegram_user_id: int | None = None,
) -> list[str]:
    if not is_authorized(chat_id, telegram_config):
        return ["Chat non autorizzata per questo bot."]

    command, args = parse_command(text)
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat().replace("+00:00", "Z")
    is_admin_user = _is_admin_user(telegram_user_id, telegram_config)
    user_status = _load_user_status(telegram_config, telegram_user_id)
    can_use_bot = _is_user_approved(telegram_config, telegram_user_id)
    service_state = _load_service_state(telegram_config.state_path)
    service_mode = str(service_state.get("mode") or SERVICE_MODE_NORMAL)
    has_command_capability = _has_command_capability(
        telegram_config,
        telegram_user_id=telegram_user_id,
        command=command,
    )

    if command == "/service_status":
        return [format_service_status(_build_service_status_payload(telegram_config.state_path))]

    if command == "/policy":
        return [format_policy_status({"mode": service_mode})]

    if command == "/service_mode":
        if not has_command_capability:
            return ["Solo l'admin puo' usare questo comando."]
        if not args:
            return [
                "Uso corretto: <code>/service_mode normal|maintenance|degraded</code>\n"
                f"Modalita' corrente: <code>{service_mode}</code>."
            ]
        requested_mode = str(args[0]).strip().lower()
        if requested_mode not in SERVICE_MODES:
            return [
                "Uso corretto: <code>/service_mode normal|maintenance|degraded</code>"
            ]
        remaining = _command_rate_limit_remaining_seconds(
            telegram_config.state_path,
            telegram_user_id=telegram_user_id,
            command=command,
            now=now,
        )
        if remaining > 0:
            return [_format_cooldown_message(command, remaining)]
        _save_service_state(
            telegram_config.state_path,
            mode=requested_mode,
            updated_by=telegram_user_id,
            updated_at=now_iso,
        )
        _mark_command_usage(
            telegram_config.state_path,
            telegram_user_id=telegram_user_id,
            command=command,
            timestamp=now_iso,
        )
        _append_audit_log(
            telegram_config,
            event_type="service_mode",
            created_at=now_iso,
            actor_telegram_user_id=telegram_user_id,
            target_telegram_user_id=telegram_user_id,
            telegram_chat_id=chat_id,
            outcome=requested_mode,
            details={"previous_mode": service_mode},
        )
        return [
            "🛠️ <b>Modalita' servizio aggiornata</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"Nuova modalita': <code>{requested_mode}</code>."
        ]

    if command == "/request_access":
        if telegram_config.admin_user_id is None:
            return [
                "✅ <b>Accesso libero</b>\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Questa istanza del bot non richiede approvazione admin."
            ]
        if telegram_user_id is None:
            return [format_access_request_status(admin_notified=False)]
        if is_admin_user:
            return [format_access_required_status(TELEGRAM_USER_STATUS_ADMIN, is_admin=True)]
        if has_telegram_user_capability(user_status, CAPABILITY_USE_BOT):
            return [
                "✅ <b>Accesso gia' approvato</b>\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Il tuo account e' gia' abilitato all'uso del bot."
            ]
        if is_blocked_telegram_user_status(user_status):
            return [format_access_request_status(blocked=True)]
        remaining = _command_rate_limit_remaining_seconds(
            telegram_config.state_path,
            telegram_user_id=telegram_user_id,
            command=command,
            now=now,
        )
        if remaining > 0:
            return [_format_cooldown_message(command, remaining)]

        timestamp = now_iso
        existing_user = load_telegram_user(telegram_config.state_path, telegram_user_id)
        if existing_user is None:
            upsert_telegram_user(
                telegram_config.state_path,
                TelegramUser(
                    telegram_user_id=telegram_user_id,
                    telegram_chat_id=chat_id,
                    username="",
                    display_name="",
                    created_at=timestamp,
                    status=TELEGRAM_USER_STATUS_PENDING,
                ),
            )
            existing_user = load_telegram_user(telegram_config.state_path, telegram_user_id)
        elif is_pending_telegram_user_status(existing_user.status):
            _append_audit_log(
                telegram_config,
                event_type="request_access",
                created_at=timestamp,
                actor_telegram_user_id=telegram_user_id,
                target_telegram_user_id=telegram_user_id,
                telegram_chat_id=chat_id,
                outcome="already_pending",
                details={"user_status": existing_user.status},
            )
            return [format_access_request_status(already_pending=True)]
        else:
            update_telegram_user_status(
                telegram_config.state_path,
                telegram_user_id,
                TELEGRAM_USER_STATUS_PENDING,
                updated_at=timestamp,
            )
            existing_user = load_telegram_user(telegram_config.state_path, telegram_user_id)

        admin_notified = False
        admin_chat_id = (
            resolve_primary_chat_id(telegram_config.state_path, telegram_config.admin_user_id)
            if telegram_config.admin_user_id is not None
            else None
        )
        if admin_chat_id is not None and existing_user is not None:
            send_message(
                telegram_config.token,
                admin_chat_id,
                format_admin_access_request(
                    telegram_user_id=telegram_user_id,
                    username=existing_user.username,
                    display_name=existing_user.display_name,
                    chat_id=chat_id,
                ),
                reply_markup=build_admin_approval_markup(telegram_user_id),
            )
            admin_notified = True
        _append_audit_log(
            telegram_config,
            event_type="request_access",
            created_at=timestamp,
            actor_telegram_user_id=telegram_user_id,
            target_telegram_user_id=telegram_user_id,
            telegram_chat_id=chat_id,
            outcome="pending",
            details={"admin_notified": admin_notified},
        )
        _mark_command_usage(
            telegram_config.state_path,
            telegram_user_id=telegram_user_id,
            command=command,
            timestamp=timestamp,
        )
        return [format_access_request_status(admin_notified=admin_notified)]

    if command in {
        "/approve_user",
        "/reject_user",
        "/suspend_user",
        "/reactivate_user",
        "/users",
        "/pending_users",
        "/unlinked_users",
        "/tenant_health",
        "/admin_dashboard",
    } and not has_command_capability:
        return ["Solo l'admin puo' usare questo comando."]

    if command == "/users":
        return [format_admin_user_list(_build_user_rows(telegram_config))]

    if command == "/pending_users":
        pending_rows = [
            row for row in _build_user_rows(telegram_config) if str(row.get("status")) == "pending"
        ]
        return [format_admin_user_list(pending_rows)]

    if command == "/unlinked_users":
        unlinked_rows = [
            row
            for row in _build_user_rows(telegram_config)
            if str(row.get("status")) == TELEGRAM_USER_STATUS_APPROVED
            and str(row.get("account_status") or "unlinked") != "linked"
        ]
        return [format_admin_user_list(unlinked_rows)]

    if command == "/admin_dashboard":
        return [format_admin_dashboard(_build_admin_dashboard_payload(telegram_config))]

    if command == "/tenant_health":
        rows = _build_user_rows(telegram_config)
        if args:
            try:
                target_user_id = int(args[0])
            except ValueError:
                return ["Uso corretto: <code>/tenant_health [telegram_user_id]</code>"]
            rows = [
                row for row in rows if int(row.get("telegram_user_id") or 0) == target_user_id
            ]
        else:
            rows = [
                row
                for row in rows
                if str(row.get("status") or "") != TELEGRAM_USER_STATUS_NEW
            ]
        return [format_tenant_health(rows)]

    if command in {"/approve_user", "/reject_user", "/suspend_user", "/reactivate_user"}:
        if not args:
            action_map = {
                "/approve_user": "approve_user",
                "/reject_user": "reject_user",
                "/suspend_user": "suspend_user",
                "/reactivate_user": "reactivate_user",
            }
            action = action_map[command]
            return [f"Uso corretto: <code>/{action} &lt;telegram_user_id&gt;</code>"]
        try:
            target_user_id = int(args[0])
        except ValueError:
            action_map = {
                "/approve_user": "approve_user",
                "/reject_user": "reject_user",
                "/suspend_user": "suspend_user",
                "/reactivate_user": "reactivate_user",
            }
            action = action_map[command]
            return [f"Uso corretto: <code>/{action} &lt;telegram_user_id&gt;</code>"]
        remaining = _command_rate_limit_remaining_seconds(
            telegram_config.state_path,
            telegram_user_id=telegram_user_id,
            command=command,
            now=now,
        )
        if remaining > 0:
            return [_format_cooldown_message(command, remaining)]
        timestamp = now_iso
        next_status_map = {
            "/approve_user": TELEGRAM_USER_STATUS_APPROVED,
            "/reject_user": TELEGRAM_USER_STATUS_BLOCKED,
            "/suspend_user": TELEGRAM_USER_STATUS_BLOCKED,
            "/reactivate_user": TELEGRAM_USER_STATUS_APPROVED,
        }
        next_status = next_status_map[command]
        current_user = load_telegram_user(telegram_config.state_path, target_user_id)
        status_changed = (
            current_user is None
            or normalize_telegram_user_status(current_user.status) != next_status
        )
        updated_user = update_telegram_user_status(
            telegram_config.state_path,
            target_user_id,
            next_status,
            updated_at=timestamp,
        )
        if updated_user is not None:
            enqueue_apply_user_access_operation(
                telegram_config.state_path,
                actor_telegram_user_id=telegram_user_id,
                target_telegram_user_id=target_user_id,
                requested_status=next_status,
            )
            operation_summary = process_pending_operations(
                state_path=telegram_config.state_path,
                default_notify_chat_ids=telegram_config.notify_chat_ids,
                max_operations=10,
            )
        else:
            operation_summary = {"processed": 0, "completed": 0, "failed": 0, "applied": 0}
        _append_audit_log(
            telegram_config,
            event_type=(
                "approve"
                if command == "/approve_user"
                else (
                    "reject"
                    if command == "/reject_user"
                    else ("suspend" if command == "/suspend_user" else "reactivate")
                )
            ),
            created_at=timestamp,
            actor_telegram_user_id=telegram_user_id,
            target_telegram_user_id=target_user_id,
            telegram_chat_id=chat_id,
            outcome=(
                "applied"
                if updated_user is not None and status_changed
                else ("already_applied" if updated_user is not None else "missing_user")
            ),
            details={
                "status": next_status,
                "status_changed": status_changed,
                "operations_processed": operation_summary["processed"],
                "operations_failed": operation_summary["failed"],
            },
        )
        _mark_command_usage(
            telegram_config.state_path,
            telegram_user_id=telegram_user_id,
            command=command,
            timestamp=timestamp,
        )
        if updated_user is not None and status_changed and operation_summary["failed"] == 0:
            if next_status == TELEGRAM_USER_STATUS_APPROVED:
                _notify_user_access_status(
                    telegram_config,
                    telegram_user_id=target_user_id,
                    text=(
                        "✅ <b>Accesso approvato</b>\n"
                        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                        "L'admin ha approvato il tuo accesso. "
                        "Ora puoi usare <code>/connect</code>, "
                        "<code>/account</code> e gli altri comandi."
                    ),
                )
            else:
                _notify_user_access_status(
                    telegram_config,
                    telegram_user_id=target_user_id,
                    text=(
                        "⛔ <b>Accesso non approvato</b>\n"
                        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                        "L'admin ha sospeso, rifiutato o bloccato il tuo accesso al bot."
                    ),
                )
        return [
            format_admin_status_update(
                telegram_user_id=target_user_id,
                status=next_status,
                updated=updated_user is not None,
            )
        ]

    if command in ("", "/start"):
        if is_admin_user:
            return [build_start_text(user_status=TELEGRAM_USER_STATUS_ADMIN, is_admin=True)]
        if telegram_config.admin_user_id is not None and not can_use_bot:
            return [build_start_text(user_status=user_status or TELEGRAM_USER_STATUS_NEW)]

        start_account_status: dict[str, object] | None = None
        if telegram_user_id is not None:
            start_account_status = summarize_tenant_account_status(
                telegram_config.state_path,
                telegram_user_id,
                ebay_environment,
            )
        return [
            build_start_text(
                user_status=user_status or TELEGRAM_USER_STATUS_APPROVED,
                account_status=start_account_status,
            )
        ]

    service_block_message = _service_mode_blocks_command(service_mode, command)
    if service_block_message is not None:
        return [service_block_message]

    if not has_command_capability:
        if command == "/help":
            return [format_access_required_status(user_status or TELEGRAM_USER_STATUS_NEW)]
        if command == "/request_access":
            return [
                format_access_request_status(blocked=is_blocked_telegram_user_status(user_status))
            ]
        return [
            "Utente non ancora approvato per questo bot. "
            "Usa <code>/request_access</code> per inviare la richiesta all'admin."
        ]

    if not can_use_bot and command not in ("", "/start", "/help", "/request_access"):
        return [
            "Utente non ancora approvato per questo bot. "
            "Usa <code>/request_access</code> per inviare la richiesta all'admin."
        ]

    tenant_context = resolve_tenant_command_context(
        telegram_config,
        chat_id=chat_id,
        telegram_user_id=telegram_user_id,
    )
    strict_tenant_credentials = telegram_config.admin_user_id is not None
    resolved_environment = ebay_environment
    load_state_fn: Callable[[str], BotRuntimeState] = load_runtime_state
    load_retry_queue_fn: Callable[[str], list[RetryQueueEntry]] = load_retry_queue_entries
    fetch_records_for_environment_fn: Callable[[str, FetchOptions], list[OrderRecord]] = (
        fetch_environment_records
    )
    resolved_telegram_user_id = telegram_user_id
    if tenant_context is not None:
        resolved_telegram_user_id = tenant_context.telegram_user_id
        resolved_environment = tenant_context.environment or ebay_environment
        tenant_user_id = tenant_context.telegram_user_id

        def load_state_fn(_path: str) -> BotRuntimeState:
            return load_tenant_runtime_state(telegram_config.state_path, tenant_user_id)

        def load_retry_queue_fn(_path: str) -> list[RetryQueueEntry]:
            return load_tenant_retry_queue_entries(telegram_config.retry_queue_path, tenant_user_id)

    if resolved_telegram_user_id:
        tenant_user_id = resolved_telegram_user_id

        def fetch_records_for_environment_fn(
            env: str,
            options: FetchOptions,
        ) -> list[OrderRecord]:
            return coerce_order_records(
                _fetch_tenant_records_for_user(
                    env,
                    options,
                    telegram_user_id=tenant_user_id,
                    state_path=telegram_config.state_path,
                    allow_global_fallback=not strict_tenant_credentials,
                )
            )

    command_context: dict[str, object] = {
        "tenant_scope": "tenant" if tenant_context is not None else "global",
        "environment": resolved_environment,
        "config_source": (
            "tenant_required"
            if tenant_context is not None and strict_tenant_credentials
            else "global_env"
        ),
    }
    if command_context["tenant_scope"] == "tenant" and resolved_telegram_user_id is not None:
        account_status = summarize_tenant_account_status(
            telegram_config.state_path,
            resolved_telegram_user_id,
            resolved_environment,
        )
        token_set = resolve_ebay_token_set(
            telegram_config.state_path,
            resolved_telegram_user_id,
            resolved_environment,
        )
        token_ready = (
            bool(account_status.get("linked"))
            and token_set is not None
            and token_set.status == "active"
            and bool(decode_refresh_token(token_set.refresh_token_encrypted))
        )
        if token_ready:
            command_context["config_source"] = "tenant_store"
        else:
            command_context["fallback_reason"] = (
                "tenant_credentials_unavailable"
                if account_status.get("linked")
                else "tenant_account_unlinked"
            )

    if command == "/stato":
        state = load_state_fn(telegram_config.state_path)
        retry_queue_size = len(load_retry_queue_fn(telegram_config.retry_queue_path))
        return [format_status(state, retry_queue_size, runtime_context=command_context)]

    if command == "/account":
        if resolved_telegram_user_id is None:
            return [
                "👤 <b>Account eBay</b>\n━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Questa chat non e' ancora associata a un tenant Telegram noto."
            ]
        account_status = summarize_tenant_account_status(
            telegram_config.state_path,
            resolved_telegram_user_id,
            resolved_environment,
        )
        return [format_account_status(account_status)]

    if command == "/reconnect_status":
        if resolved_telegram_user_id is None:
            return [
                "🔁 <b>Reconnect status</b>\n━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Questa chat non e' ancora associata a un tenant Telegram noto."
            ]
        account_status = summarize_tenant_account_status(
            telegram_config.state_path,
            resolved_telegram_user_id,
            resolved_environment,
        )
        return [format_reconnect_status(account_status)]

    if command == "/why_not_notified":
        if not args:
            return ["Uso corretto: <code>/why_not_notified &lt;order_id&gt;</code>"]
        order_id = args[0]
        options = FetchOptions(order_ids=[order_id], only_found=False, max_results=1)
        try:
            records = request_with_backoff(
                lambda: fetch_records_for_environment_fn(resolved_environment, options),
                label="fetch_records_why_not_notified",
            )
        except ConfigurationError as exc:
            return [f"⚠️ {exc}"]
        assert isinstance(records, list)
        if not records:
            return [
                format_why_not_notified_status(
                    {
                        "order_id": order_id,
                        "environment": resolved_environment,
                        "status": "order_not_found",
                        "headline": "L'ordine non e' stato trovato con le credenziali correnti.",
                        "detail": (
                            "Verifica orderId, ambiente e collegamento account prima di riprovare."
                        ),
                    }
                )
            ]
        state = load_state_fn(telegram_config.state_path)
        explanation = explain_why_order_not_notified(
            coerce_order_record(records[0]),
            state,
            environment=resolved_environment,
            state_path=telegram_config.state_path,
            telegram_user_id=resolved_telegram_user_id,
            chat_id=chat_id,
        )
        return [format_why_not_notified_status(explanation)]

    if command == "/ordine":
        if not args:
            return ["Uso corretto: <code>/ordine &lt;order_id&gt;</code>"]
        order_id = args[0]
        options = FetchOptions(order_ids=[order_id], only_found=False, max_results=1)
        try:
            records = request_with_backoff(
                lambda: fetch_records_for_environment_fn(resolved_environment, options),
                label="fetch_records_order_detail",
            )
        except ConfigurationError as exc:
            return [f"⚠️ {exc}"]
        assert isinstance(records, list)
        if not records:
            return ["🔎 Nessun ordine trovato nella selezione richiesta."]
        order_record = coerce_order_record(records[0])
        state = load_state_fn(telegram_config.state_path)
        explanation = explain_why_order_not_notified(
            order_record,
            state,
            environment=resolved_environment,
            state_path=telegram_config.state_path,
            telegram_user_id=resolved_telegram_user_id,
            chat_id=chat_id,
        )
        return [
            _format_record(order_record) + "\n\n" + format_order_notification_summary(explanation)
        ]

    if command == "/connect":
        if resolved_telegram_user_id is None:
            return [
                "🔗 <b>Collegamento account eBay</b>\n━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Questa chat non e' ancora associata a un tenant Telegram noto."
            ]
        connect_account_status = summarize_tenant_account_status(
            telegram_config.state_path,
            resolved_telegram_user_id,
            resolved_environment,
        )
        now = datetime.now(timezone.utc)
        latest_session = load_latest_oauth_link_session(
            telegram_config.state_path,
            resolved_telegram_user_id,
        )
        active_session = latest_session
        created_session = False
        remaining = _command_rate_limit_remaining_seconds(
            telegram_config.state_path,
            telegram_user_id=resolved_telegram_user_id,
            command=command,
            now=now,
        )
        if remaining > 0 and not _is_reusable_oauth_session(
            active_session,
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
            active_session,
            environment=resolved_environment,
            now=now,
        ):
            return [
                "⏱️ <b>Collegamento temporaneamente raffreddato</b>\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Sono stati rilevati troppi tentativi ravvicinati o failure OAuth recenti.\n"
                f"Riprova tra <code>{oauth_cooldown_remaining}</code> secondi."
            ]
        if not _is_reusable_oauth_session(
            active_session,
            environment=resolved_environment,
            now=now,
        ):
            active_session = create_oauth_link_session(
                telegram_config.state_path,
                OauthLinkSession(
                    telegram_user_id=resolved_telegram_user_id,
                    telegram_chat_id=chat_id,
                    provider="ebay",
                    environment=resolved_environment,
                    oauth_state=secrets.token_urlsafe(18),
                    status=OAUTH_SESSION_STATUS_PENDING,
                    expires_at=(now + timedelta(minutes=15)).isoformat().replace("+00:00", "Z"),
                    created_at=now.isoformat().replace("+00:00", "Z"),
                ),
            )
            created_session = True
        assert active_session is not None
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
                    in {"linked", "disconnected", "revoked"},
                }
            )
        ]

    if command == "/disconnect":
        if resolved_telegram_user_id is None:
            return [
                "❌ <b>Scollega account eBay</b>\n━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Questa chat non e' ancora associata a un tenant Telegram noto."
            ]
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
        ) = _disconnect_account_with_remote_revocation(
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

    if command == "/leave_bot":
        if resolved_telegram_user_id is None:
            return [
                "🚪 <b>Disattiva uso bot</b>\n━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Questa chat non e' ancora associata a un tenant Telegram noto."
            ]
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
                "Per un account admin questo comando non e' disponibile.\n"
                "Usa <code>/disconnect</code> se vuoi scollegare solo eBay."
            ]
        timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        (
            disconnected_account,
            remote_revocation_status,
            remote_revocation_detail,
        ) = _disconnect_account_with_remote_revocation(
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
            return [
                "🔔 <b>Notifiche chat</b>\n━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Questa chat non e' ancora associata a un tenant Telegram noto."
            ]
        command_args = parse_command(text)[1]
        if not command_args or command_args[0] not in {"on", "off"}:
            return [
                "Uso corretto: <code>/notifications on</code> oppure "
                "<code>/notifications off</code>."
            ]
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
        return [
            format_notifications_status(
                {
                    "enabled": enabled,
                    "tenant_scope": "tenant" if tenant_context is not None else "global",
                    "chat_id": chat_id,
                    "environment": resolved_environment,
                }
            )
        ]

    if command == "/settings":
        notifications_enabled = False
        settings_state = load_runtime_state(telegram_config.state_path)
        if resolved_telegram_user_id is not None:
            subscriptions = load_notification_subscriptions(telegram_config.state_path)
            notifications_enabled = any(
                subscription.telegram_user_id == resolved_telegram_user_id
                and subscription.telegram_chat_id == chat_id
                and subscription.enabled
                for subscription in subscriptions
            )
            settings_state = load_tenant_runtime_state(
                telegram_config.state_path,
                resolved_telegram_user_id,
            )
        account_linked = False
        if resolved_telegram_user_id is not None:
            account_linked = (
                summarize_tenant_account_status(
                    telegram_config.state_path,
                    resolved_telegram_user_id,
                    resolved_environment,
                ).get("linked")
                is True
            )
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
                }
            )
        ]

    try:
        return _process_message(
            text=text,
            chat_id=chat_id,
            telegram_config=telegram_config,
            ebay_environment=resolved_environment,
            load_state_fn=load_state_fn,
            load_retry_queue_fn=load_retry_queue_fn,
            fetch_records_for_environment_fn=fetch_records_for_environment_fn,
            request_with_backoff_fn=request_with_backoff,
        )
    except ConfigurationError as exc:
        return [f"⚠️ {exc}"]


def auto_notify_loop(telegram_config: TelegramConfig, ebay_environment: str) -> None:
    import threading

    _auto_notify_loop(
        telegram_config,
        ebay_environment,
        shutdown_event=threading.Event(),
        maybe_send_new_order_notifications_fn=maybe_send_new_order_notifications,
    )


def request_shutdown(signum: int, frame: Optional[object]) -> None:
    _request_shutdown(signum, frame)


def run_bot() -> int:
    return _run_bot(
        configure_logging_fn=configure_logging,
        load_telegram_config_fn=load_telegram_config,
        acquire_process_lock_fn=acquire_process_lock,
        release_process_lock_fn=release_process_lock,
        process_message_fn=process_message,
        register_runtime_contact_fn=sync_runtime_contact,
        send_message_fn=send_message,
        maybe_send_new_order_notifications_fn=maybe_send_new_order_notifications,
        request_with_backoff_fn=request_with_backoff,
    )


if __name__ == "__main__":
    raise SystemExit(run_bot())
