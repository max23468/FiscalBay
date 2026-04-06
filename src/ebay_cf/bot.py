"""Telegram bot runtime and command handling."""

from __future__ import annotations

import html
import logging
import os
from contextlib import suppress
from datetime import datetime, timezone
from typing import Optional

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows
    fcntl = None

from .clients.telegram import ensure_long_polling, telegram_request
from .config import configure_logging, load_config, load_telegram_config
from .errors import EbayApiError, TelegramApiError
from .logging_utils import log_event
from .models import TelegramConfig
from .retry import run_with_retry
from .services.orders import fetch_records
from .services.notifications import (
    fetch_new_order_records as _fetch_new_order_records,
    increment_error_metric as _increment_error_metric,
    increment_metric as _increment_metric,
    maybe_send_new_order_notifications as _maybe_send_new_order_notifications,
    process_retry_queue as _process_retry_queue,
    update_state_with_records as _update_state_with_records,
)
from .services.telegram_runtime import (
    auto_notify_loop as _auto_notify_loop,
    extract_callback_context,
    extract_message_context,
    request_shutdown as _request_shutdown,
    run_bot as _run_bot,
)
from .storage.sqlite import (
    ensure_parent_dir,
    load_retry_queue,
    load_retry_queue_entries,
    load_runtime_state,
    load_state,
    save_retry_queue,
    save_retry_queue_entries,
    save_runtime_state,
    save_state,
)
from .telegram_commands import (
    CALLBACK_HELP,
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
    format_auto_notification,
    format_records,
    format_record,
    format_status,
    has_codice_fiscale,
    is_authorized,
    options_for_command,
    parse_command,
    process_message as _process_message,
    record_fingerprint,
    should_attach_main_menu,
)

LOGGER = logging.getLogger("ebaycf.telegram_bot")


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


def acquire_process_lock(lock_path: str):
    if fcntl is None:
        LOGGER.warning(
            "fcntl non disponibile: lock esclusivo non attivo su %s. "
            "Non avviare due istanze con lo stesso token.",
            lock_path,
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


def increment_metric(state: dict[str, object], metric: str, amount: int = 1) -> None:
    _increment_metric(state, metric, amount)


def increment_error_metric(state: dict[str, object], error_type: str) -> None:
    _increment_error_metric(state, error_type)


def process_retry_queue(telegram_config: TelegramConfig, state: dict[str, object]) -> None:
    _process_retry_queue(
        telegram_config,
        state,
        load_retry_queue_fn=load_retry_queue_entries,
        save_retry_queue_fn=save_retry_queue_entries,
        send_message_fn=send_message,
    )


def fetch_new_order_records(
    ebay_environment: str,
    state: dict[str, object],
    lookback_minutes: int = 180,
) -> list[dict[str, str]]:
    return _fetch_new_order_records(
        ebay_environment,
        state,
        load_config_fn=load_config,
        fetch_records_fn=fetch_records,
        request_with_backoff_fn=request_with_backoff,
        lookback_minutes=lookback_minutes,
    )


def update_state_with_records(
    state: dict[str, object],
    records: list[dict[str, str]],
    checked_at: Optional[str] = None,
    max_tracked_orders: int = 1000,
) -> dict[str, object]:
    return _update_state_with_records(
        state,
        records,
        checked_at=checked_at,
        max_tracked_orders=max_tracked_orders,
    )


def maybe_send_new_order_notifications(
    telegram_config: TelegramConfig,
    ebay_environment: str,
) -> None:
    _maybe_send_new_order_notifications(
        telegram_config,
        ebay_environment,
        load_state_fn=load_runtime_state,
        save_state_fn=save_runtime_state,
        load_retry_queue_fn=load_retry_queue_entries,
        save_retry_queue_fn=save_retry_queue_entries,
        load_config_fn=load_config,
        fetch_records_fn=fetch_records,
        send_message_fn=send_message,
        request_with_backoff_fn=request_with_backoff,
    )


def process_message(
    text: str,
    chat_id: int,
    telegram_config: TelegramConfig,
    ebay_environment: str,
) -> list[str]:
    return _process_message(
        text=text,
        chat_id=chat_id,
        telegram_config=telegram_config,
        ebay_environment=ebay_environment,
        load_state_fn=load_runtime_state,
        load_retry_queue_fn=load_retry_queue,
        load_config_fn=load_config,
        fetch_records_fn=fetch_records,
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
        send_message_fn=send_message,
        maybe_send_new_order_notifications_fn=maybe_send_new_order_notifications,
        request_with_backoff_fn=request_with_backoff,
    )
