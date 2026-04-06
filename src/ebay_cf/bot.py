"""Telegram bot runtime and command handling."""

from __future__ import annotations

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
from .application import fetch_tenant_records as _fetch_tenant_records
from .clients.telegram import ensure_long_polling, telegram_request
from .config import configure_logging, load_config, load_telegram_config
from .errors import EbayApiError, TelegramApiError
from .logging_utils import log_event
from .models import (
    BotRuntimeState,
    BotRuntimeStateLike,
    FetchOptions,
    NotificationSubscription,
    OauthLinkSession,
    OrderRecord,
    OrderRecordLike,
    RetryQueueEntry,
    TelegramChat,
    TelegramConfig,
    TelegramUser,
    TenantChatContext,
)
from .retry import run_with_retry
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
    create_oauth_link_session,
    disconnect_linked_ebay_account,
    ensure_parent_dir,
    list_notification_tenants,
    load_ebay_token_sets,
    load_latest_oauth_link_session,
    load_notification_subscriptions,
    load_retry_queue_entries,
    load_runtime_state,
    load_tenant_retry_queue_entries,
    load_tenant_runtime_state,
    resolve_tenant_chat_context,
    save_retry_queue_entries,
    save_runtime_state,
    save_tenant_retry_queue_entries,
    save_tenant_runtime_state,
    set_notification_subscription_enabled,
    summarize_tenant_account_status,
    upsert_notification_subscription,
    upsert_telegram_chat,
    upsert_telegram_user,
)
from .telegram_commands import (
    CALLBACK_HELP,
    CALLBACK_SETTINGS,
    CALLBACK_STATO,
    CALLBACK_TUTTI,
    CALLBACK_ULTIMI,
    TELEGRAM_CMD_MAX_DAYS,
    TELEGRAM_CMD_MAX_RESULTS,
    TELEGRAM_CMD_MIN_DAYS,
    TELEGRAM_CMD_MIN_RESULTS,
    build_help_text,
    build_main_menu_markup,
    callback_command_from_data,
    chunk_message,
    format_account_status,
    format_connect_status,
    format_disconnect_status,
    format_notifications_status,
    format_settings_status,
    format_status,
    is_admin_authorized,
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
from .tenant_credentials import decode_refresh_token

LOGGER = logging.getLogger("ebaycf.telegram_bot")


def coerce_runtime_state(state: BotRuntimeStateLike) -> BotRuntimeState:
    if isinstance(state, BotRuntimeState):
        return state
    return BotRuntimeState.from_mapping(state)


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
    records = _fetch_environment_records(
        ebay_environment,
        options,
        load_config_fn=load_config,
        fetch_records_fn=fetch_records,
    )
    return coerce_order_records(records)


def fetch_tenant_records(
    ebay_environment: str,
    options,
    *,
    telegram_user_id: int | None,
    state_path: str,
) -> list[OrderRecord]:
    records = _fetch_tenant_records(
        ebay_environment,
        options,
        telegram_user_id=telegram_user_id,
        state_path=state_path,
        load_config_fn=load_config,
        fetch_records_fn=fetch_records,
    )
    return coerce_order_records(records)


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
    "update_state_with_records",
]


def request_with_backoff(
    fn,
    label: str,
    attempts: int = 4,
    initial_delay: float = 1.0,
) -> object:
    def on_retry(exc: BaseException, attempt_no: int, total_attempts: int, delay: float) -> None:
        log_event(
            LOGGER,
            logging.WARNING,
            "request_retry",
            label=label,
            attempt=attempt_no,
            attempts=total_attempts,
            delay_seconds=round(delay, 2),
            error=exc,
        )

    return run_with_retry(
        fn,
        max_attempts=attempts,
        should_retry=lambda exc: isinstance(exc, (TelegramApiError, EbayApiError)),
        on_retry=on_retry,
        base_delay=initial_delay,
        max_delay=30.0,
    )


def send_message(
    token: str,
    chat_id: int,
    text: str,
    message_thread_id: Optional[int] = None,
    reply_markup: Optional[dict[str, object]] = None,
) -> None:
    chunks = chunk_message(text)
    for idx, chunk in enumerate(chunks):
        params: dict[str, object] = {
            "chat_id": chat_id,
            "text": chunk,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
        if message_thread_id is not None:
            params["message_thread_id"] = message_thread_id
        if reply_markup is not None and idx == len(chunks) - 1:
            params["reply_markup"] = reply_markup
        try:
            telegram_request(token, "sendMessage", params)
        except TelegramApiError as exc:
            if getattr(exc, "status_code", None) != 400 and "HTTP 400" not in str(exc):
                raise
            fallback_params: dict[str, object] = {
                "chat_id": chat_id,
                "text": chunk,
                "disable_web_page_preview": True,
            }
            if message_thread_id is not None:
                fallback_params["message_thread_id"] = message_thread_id
            if reply_markup is not None and idx == len(chunks) - 1:
                fallback_params["reply_markup"] = reply_markup
            telegram_request(token, "sendMessage", fallback_params)


def sync_runtime_contact(
    telegram_config: TelegramConfig,
    *,
    telegram_user_id: int | None,
    chat_id: int | None,
    username: str = "",
    display_name: str = "",
    chat_type: str = "private",
) -> None:
    if not is_admin_authorized(chat_id, telegram_user_id, telegram_config):
        return
    if not telegram_user_id or not chat_id:
        return
    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    upsert_telegram_user(
        telegram_config.state_path,
        TelegramUser(
            telegram_user_id=telegram_user_id,
            telegram_chat_id=chat_id,
            username=username,
            display_name=display_name,
            created_at=timestamp,
            status="active",
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
    if chat_id in telegram_config.notify_chat_ids:
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
) -> dict[str, object]:
    updated_state = _update_state_with_records(
        coerce_runtime_state(state),
        coerce_order_records(records),
        checked_at=checked_at,
        max_tracked_orders=max_tracked_orders,
    )
    return updated_state.as_dict()


def maybe_send_new_order_notifications(
    telegram_config: TelegramConfig,
    ebay_environment: str,
) -> None:
    tenant_targets = list_notification_tenants(telegram_config.state_path)
    if not tenant_targets:
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
        return

    for target in tenant_targets:
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
            fetch_records_for_environment_fn=(
                lambda env, options, user_id=target.telegram_user_id: fetch_tenant_records(
                    env,
                    options,
                    telegram_user_id=user_id,
                    state_path=telegram_config.state_path,
                )
            ),
            send_message_fn=send_message,
            request_with_backoff_fn=request_with_backoff,
        )


def process_message(
    text: str,
    chat_id: int,
    telegram_config: TelegramConfig,
    ebay_environment: str,
    telegram_user_id: int | None = None,
) -> list[str]:
    if not is_admin_authorized(chat_id, telegram_user_id, telegram_config):
        if not is_authorized(chat_id, telegram_config):
            return ["Chat non autorizzata per questo bot."]
        return ["Utente non autorizzato per questo bot."]

    tenant_context = resolve_tenant_command_context(
        telegram_config,
        chat_id=chat_id,
        telegram_user_id=telegram_user_id,
    )
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
            return fetch_tenant_records(
                env,
                options,
                telegram_user_id=tenant_user_id,
                state_path=telegram_config.state_path,
            )

    command_context: dict[str, object] = {
        "tenant_scope": "tenant" if tenant_context is not None else "global",
        "environment": resolved_environment,
        "config_source": "global_env",
    }
    if command_context["tenant_scope"] == "tenant":
        command_context["fallback_reason"] = "tenant_credentials_unavailable"
        tenant_tokens = load_ebay_token_sets(telegram_config.state_path)
        tenant_token_ready = any(
            token.status == "active" and bool(decode_refresh_token(token.refresh_token_encrypted))
            for token in tenant_tokens
        )
        if tenant_token_ready:
            command_context["config_source"] = "tenant_store"
            command_context.pop("fallback_reason", None)

    command = parse_command(text)[0]

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

    if command == "/connect":
        if resolved_telegram_user_id is None:
            return [
                "🔗 <b>Collegamento account eBay</b>\n━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Questa chat non e' ancora associata a un tenant Telegram noto."
            ]
        now = datetime.now(timezone.utc)
        session = create_oauth_link_session(
            telegram_config.state_path,
            OauthLinkSession(
                telegram_user_id=resolved_telegram_user_id,
                telegram_chat_id=chat_id,
                provider="ebay",
                environment=resolved_environment,
                oauth_state=secrets.token_urlsafe(18),
                status="pending",
                expires_at=(now + timedelta(minutes=15)).isoformat().replace("+00:00", "Z"),
                created_at=now.isoformat().replace("+00:00", "Z"),
            ),
        )
        latest_session = load_latest_oauth_link_session(
            telegram_config.state_path,
            resolved_telegram_user_id,
        )
        active_session = latest_session or session
        return [
            format_connect_status(
                {
                    "oauth_state": active_session.oauth_state,
                    "expires_at": active_session.expires_at,
                    "connect_url": build_connect_entrypoint_url(active_session.oauth_state),
                }
            )
        ]

    if command == "/disconnect":
        if resolved_telegram_user_id is None:
            return [
                "❌ <b>Scollega account eBay</b>\n━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Questa chat non e' ancora associata a un tenant Telegram noto."
            ]
        disconnected_account = disconnect_linked_ebay_account(
            telegram_config.state_path,
            resolved_telegram_user_id,
            resolved_environment,
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
        if resolved_telegram_user_id is not None:
            subscriptions = load_notification_subscriptions(telegram_config.state_path)
            notifications_enabled = any(
                subscription.telegram_user_id == resolved_telegram_user_id
                and subscription.telegram_chat_id == chat_id
                and subscription.enabled
                for subscription in subscriptions
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
                }
            )
        ]

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
