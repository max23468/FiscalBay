"""Telegram runtime loop and update handling."""

from __future__ import annotations

import html
import logging
import signal
import threading
import time
from typing import Callable

from ..clients.telegram import ensure_long_polling, telegram_request
from ..errors import AppError, TelegramApiError
from ..logging_utils import log_event
from ..models import TelegramConfig
from ..telegram_commands import (
    build_main_menu_markup,
    callback_command_from_data,
    is_authorized,
    parse_command,
    should_attach_main_menu,
)

LOGGER = logging.getLogger("ebaycf.telegram_runtime")
_ACTIVE_SHUTDOWN_EVENT: threading.Event | None = None


def extract_message_context(update: dict) -> tuple[int | None, str, int | None]:
    message = update.get("message") or update.get("edited_message") or {}
    chat = message.get("chat") or {}
    text = message.get("text") or ""
    thread_id = message.get("message_thread_id")
    if isinstance(thread_id, int):
        return chat.get("id"), text, thread_id
    return chat.get("id"), text, None


def extract_callback_context(
    update: dict,
) -> tuple[str | None, int | None, str | None, int | None]:
    callback = update.get("callback_query") or {}
    callback_id = callback.get("id")
    data = callback.get("data")
    message = callback.get("message") or {}
    chat = message.get("chat") or {}
    thread_id = message.get("message_thread_id")
    normalized_thread = thread_id if isinstance(thread_id, int) else None
    if not isinstance(callback_id, str):
        return None, None, None, normalized_thread
    if not isinstance(data, str):
        return callback_id, chat.get("id"), None, normalized_thread
    return callback_id, chat.get("id"), data, normalized_thread


def request_shutdown(
    signum: int,
    frame: object | None,
) -> None:
    del frame
    log_event(LOGGER, logging.INFO, "shutdown_requested", signal=signum)
    if _ACTIVE_SHUTDOWN_EVENT is not None:
        _ACTIVE_SHUTDOWN_EVENT.set()


def auto_notify_loop(
    telegram_config: TelegramConfig,
    ebay_environment: str,
    *,
    shutdown_event: threading.Event,
    maybe_send_new_order_notifications_fn: Callable[[TelegramConfig, str], None],
) -> None:
    log_event(
        LOGGER,
        logging.INFO,
        "auto_notify_loop_started",
        poll_interval_seconds=telegram_config.ebay_poll_interval_seconds,
    )
    while not shutdown_event.is_set():
        try:
            maybe_send_new_order_notifications_fn(telegram_config, ebay_environment)
        except Exception as exc:  # pragma: no cover - loop resiliente
            LOGGER.exception("Errore auto notify: %s", exc)
        if shutdown_event.wait(timeout=telegram_config.ebay_poll_interval_seconds):
            break


def run_bot(
    *,
    configure_logging_fn: Callable[[], None],
    load_telegram_config_fn: Callable[[], TelegramConfig],
    acquire_process_lock_fn: Callable[[str], object],
    release_process_lock_fn: Callable[[object, str], None],
    process_message_fn: Callable[[str, int, TelegramConfig, str], list[str]],
    send_message_fn: Callable[..., None],
    maybe_send_new_order_notifications_fn: Callable[[TelegramConfig, str], None],
    request_with_backoff_fn: Callable[..., object],
) -> int:
    shutdown_event = threading.Event()
    global _ACTIVE_SHUTDOWN_EVENT
    _ACTIVE_SHUTDOWN_EVENT = shutdown_event
    configure_logging_fn()
    shutdown_event.clear()
    lock_handle = None
    telegram_config = None
    try:
        telegram_config = load_telegram_config_fn()
        ebay_environment = "production"
        import os

        ebay_environment = os.getenv("EBAY_ENVIRONMENT", "production")
        lock_handle = acquire_process_lock_fn(telegram_config.lock_path)
        ensure_long_polling(telegram_config.token)
        log_event(
            LOGGER,
            logging.INFO,
            "bot_started",
            environment=ebay_environment,
            notify_chat_count=len(telegram_config.notify_chat_ids),
            allowed_chat_mode="all" if telegram_config.allowed_chat_ids is None else "restricted",
        )
    except AppError as exc:
        LOGGER.error("Errore configurazione: %s", exc)
        import sys

        print(f"Errore configurazione: {exc}", file=sys.stderr)
        if lock_handle is not None and telegram_config is not None:
            release_process_lock_fn(lock_handle, telegram_config.lock_path)
        return 1

    signal.signal(
        signal.SIGTERM,
        lambda signum, frame: request_shutdown(signum, frame),
    )
    signal.signal(
        signal.SIGINT,
        lambda signum, frame: request_shutdown(signum, frame),
    )

    notifier_thread = threading.Thread(
        target=auto_notify_loop,
        kwargs={
            "telegram_config": telegram_config,
            "ebay_environment": ebay_environment,
            "shutdown_event": shutdown_event,
            "maybe_send_new_order_notifications_fn": maybe_send_new_order_notifications_fn,
        },
        daemon=True,
    )
    notifier_thread.start()

    offset = 0
    updates_backoff_seconds = 1.0
    while not shutdown_event.is_set():
        try:
            poll_timeout = telegram_config.poll_timeout_seconds
            if shutdown_event.is_set():
                poll_timeout = min(poll_timeout, 2)
            updates = request_with_backoff_fn(
                lambda: telegram_request(
                    telegram_config.token,
                    "getUpdates",
                    {
                        "offset": offset,
                        "timeout": poll_timeout,
                        "allowed_updates": ["message", "edited_message", "callback_query"],
                    },
                ),
                label="getUpdates",
            )
            assert isinstance(updates, list)
            updates_backoff_seconds = 1.0
            for update in updates:
                offset = max(offset, int(update["update_id"]) + 1)
                callback_id, callback_chat_id, callback_data, callback_thread_id = (
                    extract_callback_context(update)
                )
                if callback_id and callback_chat_id and callback_data:
                    callback_text = callback_command_from_data(callback_data)
                    if callback_text:
                        try:
                            replies = process_message_fn(
                                text=callback_text,
                                chat_id=callback_chat_id,
                                telegram_config=telegram_config,
                                ebay_environment=ebay_environment,
                            )
                        except AppError as exc:
                            replies = [f"Errore: {html.escape(str(exc))}"]
                        for index, reply in enumerate(replies):
                            try:
                                send_message_fn(
                                    telegram_config.token,
                                    callback_chat_id,
                                    reply,
                                    message_thread_id=callback_thread_id,
                                    reply_markup=(
                                        build_main_menu_markup()
                                        if index == len(replies) - 1
                                        else None
                                    ),
                                )
                            except TelegramApiError as exc:
                                LOGGER.error("Invio risposta callback fallito: %s", exc)
                        try:
                            telegram_request(
                                telegram_config.token,
                                "answerCallbackQuery",
                                {
                                    "callback_query_id": callback_id,
                                    "text": "Comando eseguito",
                                },
                            )
                        except TelegramApiError as exc:
                            LOGGER.warning("answerCallbackQuery fallita: %s", exc)
                    else:
                        try:
                            telegram_request(
                                telegram_config.token,
                                "answerCallbackQuery",
                                {
                                    "callback_query_id": callback_id,
                                    "text": "Azione non riconosciuta",
                                },
                            )
                        except TelegramApiError as exc:
                            LOGGER.warning("answerCallbackQuery fallita: %s", exc)
                    continue

                cid, msg_text, thread_id = extract_message_context(update)
                if not cid or not msg_text.strip():
                    continue
                command, _ = parse_command(msg_text)
                show_menu = is_authorized(cid, telegram_config) and should_attach_main_menu(command)
                try:
                    replies = process_message_fn(
                        text=msg_text,
                        chat_id=cid,
                        telegram_config=telegram_config,
                        ebay_environment=ebay_environment,
                    )
                except AppError as exc:
                    replies = [f"Errore: {html.escape(str(exc))}"]
                for index, reply in enumerate(replies):
                    try:
                        send_message_fn(
                            telegram_config.token,
                            cid,
                            reply,
                            message_thread_id=thread_id,
                            reply_markup=(
                                build_main_menu_markup()
                                if show_menu and index == len(replies) - 1
                                else None
                            ),
                        )
                    except TelegramApiError as exc:
                        LOGGER.error("Invio risposta fallito: %s", exc)
            if shutdown_event.is_set():
                break
        except KeyboardInterrupt:
            shutdown_event.set()
            break
        except Exception as exc:  # pragma: no cover - loop resiliente
            LOGGER.exception("Errore runtime bot: %s", exc)
            time.sleep(updates_backoff_seconds)
            updates_backoff_seconds = min(updates_backoff_seconds * 2, 30.0)
            if shutdown_event.is_set():
                break

    if lock_handle is not None and telegram_config is not None:
        release_process_lock_fn(lock_handle, telegram_config.lock_path)
    _ACTIVE_SHUTDOWN_EVENT = None
    log_event(LOGGER, logging.INFO, "bot_stopped")
    return 0
