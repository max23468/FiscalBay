#!/usr/bin/env python3
"""Compatibility wrapper for the Telegram bot module."""

from ebay_cf.bot import (
    CALLBACK_HELP,
    CALLBACK_STATO,
    CALLBACK_TUTTI,
    CALLBACK_ULTIMI,
    TELEGRAM_CMD_MAX_DAYS,
    TelegramConfig,
    acquire_process_lock,
    auto_notify_loop,
    build_help_text,
    build_main_menu_markup,
    callback_command_from_data,
    chunk_message,
    extract_callback_context,
    extract_message_context,
    fetch_new_order_records,
    format_auto_notification,
    format_record,
    format_records,
    format_status,
    has_codice_fiscale,
    increment_error_metric,
    increment_metric,
    is_authorized,
    load_config,
    load_telegram_config,
    maybe_send_new_order_notifications,
    now_utc,
    options_for_command,
    parse_command,
    process_message,
    process_retry_queue,
    record_fingerprint,
    request_shutdown as _request_shutdown,
    request_with_backoff,
    run_bot,
    send_message,
    should_attach_main_menu,
    update_state_with_records,
)
from ebay_cf.clients.telegram import ensure_long_polling, telegram_request
from ebay_cf.errors import EbayApiError, TelegramApiError
from ebay_cf.models import FetchOptions
from ebay_cf.services.orders import fetch_records
from ebay_cf.storage.sqlite import load_retry_queue, load_state, save_retry_queue, save_state


if __name__ == "__main__":
    raise SystemExit(run_bot())
