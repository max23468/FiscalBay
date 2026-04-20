"""Messaging helpers for Telegram bot runtime."""

from __future__ import annotations

import logging
from typing import Callable, Mapping, Optional

from .clients.telegram import (
    InlineKeyboardMarkup,
    JsonValue,
)
from .clients.telegram import (
    telegram_request as _telegram_request,
)
from .errors import EbayApiError, TelegramApiError
from .logging_utils import log_event
from .retry import run_with_retry
from .telegram_commands import chunk_message

LOGGER = logging.getLogger("fiscalbay.telegram_bot")


def request_with_backoff(
    fn,
    label: str,
    attempts: int = 4,
    initial_delay: float = 1.0,
) -> object:
    def on_retry(exc: Exception, attempt_no: int, total_attempts: int, delay: float) -> None:
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
    reply_markup: InlineKeyboardMarkup | None = None,
    request_fn: Callable[[str, str, Mapping[str, JsonValue] | None], JsonValue] = _telegram_request,
) -> None:
    chunks = chunk_message(text)
    for idx, chunk in enumerate(chunks):
        params: dict[str, JsonValue] = {
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
            request_fn(token, "sendMessage", params)
        except TelegramApiError as exc:
            if getattr(exc, "status_code", None) != 400 and "HTTP 400" not in str(exc):
                raise
            fallback_params: dict[str, JsonValue] = {
                "chat_id": chat_id,
                "text": chunk,
                "disable_web_page_preview": True,
            }
            if message_thread_id is not None:
                fallback_params["message_thread_id"] = message_thread_id
            if reply_markup is not None and idx == len(chunks) - 1:
                fallback_params["reply_markup"] = reply_markup
            request_fn(token, "sendMessage", fallback_params)
