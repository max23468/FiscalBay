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
from ..logging_utils import generate_operation_id, log_event
from ..models import TelegramConfig
from ..telegram_commands import (
    build_main_menu_markup,
    callback_command_from_data,
    is_admin_authorized,
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


def _display_name_from_user(user: dict) -> str:
    first_name = str(user.get("first_name") or "").strip()
    last_name = str(user.get("last_name") or "").strip()
    full_name = " ".join(part for part in (first_name, last_name) if part).strip()
    if full_name:
        return full_name
    return str(user.get("username") or "").strip()


def extract_message_actor(
    update: dict,
) -> tuple[int | None, int | None, str, str, str]:
    message = update.get("message") or update.get("edited_message") or {}
    chat = message.get("chat") or {}
    user = message.get("from") or {}
    return (
        user.get("id"),
        chat.get("id"),
        str(user.get("username") or ""),
        _display_name_from_user(user),
        str(chat.get("type") or "private"),
    )


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


def extract_callback_actor(
    update: dict,
) -> tuple[int | None, int | None, str, str, str]:
    callback = update.get("callback_query") or {}
    user = callback.get("from") or {}
    message = callback.get("message") or {}
    chat = message.get("chat") or {}
    return (
        user.get("id"),
        chat.get("id"),
        str(user.get("username") or ""),
        _display_name_from_user(user),
        str(chat.get("type") or "private"),
    )


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
            log_event(
                LOGGER,
                logging.ERROR,
                "auto_notify_failed",
                environment=ebay_environment,
                error=exc,
            )
            LOGGER.exception("Errore auto notify: %s", exc)
        if shutdown_event.wait(timeout=telegram_config.ebay_poll_interval_seconds):
            break


def run_bot(
    *,
    configure_logging_fn: Callable[[], None],
    load_telegram_config_fn: Callable[[], TelegramConfig],
    acquire_process_lock_fn: Callable[[str], object],
    release_process_lock_fn: Callable[[object, str], None],
    process_message_fn: Callable[[str, int, TelegramConfig, str, int | None], list[str]],
    register_runtime_contact_fn: Callable[..., None],
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
            allowed_chat_mode=(
                "admin_only"
                if telegram_config.admin_user_id is not None
                else ("all" if telegram_config.allowed_chat_ids is None else "restricted")
            ),
        )
    except AppError as exc:
        log_event(
            LOGGER,
            logging.ERROR,
            "bot_configuration_failed",
            error=exc,
        )
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
        poll_cycle_id = generate_operation_id("poll")
        try:
            poll_timeout = telegram_config.poll_timeout_seconds
            if shutdown_event.is_set():
                poll_timeout = min(poll_timeout, 2)
            log_event(
                LOGGER,
                logging.INFO,
                "poll_cycle_started",
                cycle_id=poll_cycle_id,
                offset=offset,
                timeout_seconds=poll_timeout,
            )
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
            log_event(
                LOGGER,
                logging.INFO,
                "poll_cycle_fetched",
                cycle_id=poll_cycle_id,
                updates=len(updates),
            )
            updates_backoff_seconds = 1.0
            for update in updates:
                update_id = int(update["update_id"])
                offset = max(offset, update_id + 1)
                callback_id, callback_chat_id, callback_data, callback_thread_id = (
                    extract_callback_context(update)
                )
                if callback_id and callback_chat_id and callback_data:
                    (
                        callback_user_id,
                        _,
                        callback_username,
                        callback_display_name,
                        callback_chat_type,
                    ) = extract_callback_actor(update)
                    register_runtime_contact_fn(
                        telegram_config,
                        telegram_user_id=callback_user_id,
                        chat_id=callback_chat_id,
                        username=callback_username,
                        display_name=callback_display_name,
                        chat_type=callback_chat_type,
                    )
                    log_event(
                        LOGGER,
                        logging.INFO,
                        "callback_received",
                        cycle_id=poll_cycle_id,
                        update_id=update_id,
                        callback_id=callback_id,
                        chat_id=callback_chat_id,
                        action=callback_data,
                    )
                    callback_text = callback_command_from_data(callback_data)
                    if callback_text:
                        try:
                            replies = process_message_fn(
                                text=callback_text,
                                chat_id=callback_chat_id,
                                telegram_config=telegram_config,
                                ebay_environment=ebay_environment,
                                telegram_user_id=callback_user_id,
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
                                log_event(
                                    LOGGER,
                                    logging.ERROR,
                                    "callback_reply_failed",
                                    cycle_id=poll_cycle_id,
                                    update_id=update_id,
                                    callback_id=callback_id,
                                    chat_id=callback_chat_id,
                                    error=exc,
                                )
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
                            log_event(
                                LOGGER,
                                logging.WARNING,
                                "callback_ack_failed",
                                cycle_id=poll_cycle_id,
                                update_id=update_id,
                                callback_id=callback_id,
                                error=exc,
                            )
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
                            log_event(
                                LOGGER,
                                logging.WARNING,
                                "callback_unknown_ack_failed",
                                cycle_id=poll_cycle_id,
                                update_id=update_id,
                                callback_id=callback_id,
                                error=exc,
                            )
                    continue

                cid, msg_text, thread_id = extract_message_context(update)
                if not cid or not msg_text.strip():
                    continue
                message_user_id, _, message_username, message_display_name, message_chat_type = (
                    extract_message_actor(update)
                )
                register_runtime_contact_fn(
                    telegram_config,
                    telegram_user_id=message_user_id,
                    chat_id=cid,
                    username=message_username,
                    display_name=message_display_name,
                    chat_type=message_chat_type,
                )
                command, _ = parse_command(msg_text)
                log_event(
                    LOGGER,
                    logging.INFO,
                    "message_received",
                    cycle_id=poll_cycle_id,
                    update_id=update_id,
                    chat_id=cid,
                    command=command or "none",
                )
                show_menu = is_admin_authorized(
                    cid,
                    message_user_id,
                    telegram_config,
                ) and should_attach_main_menu(command)
                try:
                    replies = process_message_fn(
                        text=msg_text,
                        chat_id=cid,
                        telegram_config=telegram_config,
                        ebay_environment=ebay_environment,
                        telegram_user_id=message_user_id,
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
                        log_event(
                            LOGGER,
                            logging.ERROR,
                            "message_reply_failed",
                            cycle_id=poll_cycle_id,
                            update_id=update_id,
                            chat_id=cid,
                            command=command or "none",
                            error=exc,
                        )
            if shutdown_event.is_set():
                break
        except KeyboardInterrupt:
            shutdown_event.set()
            break
        except Exception as exc:  # pragma: no cover - loop resiliente
            log_event(
                LOGGER,
                logging.ERROR,
                "poll_cycle_failed",
                cycle_id=poll_cycle_id,
                backoff_seconds=round(updates_backoff_seconds, 2),
                error=exc,
            )
            LOGGER.exception("Errore runtime bot: %s", exc)
            time.sleep(updates_backoff_seconds)
            updates_backoff_seconds = min(updates_backoff_seconds * 2, 30.0)
            if shutdown_event.is_set():
                break

    if lock_handle is not None and telegram_config is not None:
        release_process_lock_fn(lock_handle, telegram_config.lock_path)
    _ACTIVE_SHUTDOWN_EVENT = None
    log_event(
        LOGGER,
        logging.INFO,
        "bot_stopped",
        final_offset=offset,
    )
    return 0
