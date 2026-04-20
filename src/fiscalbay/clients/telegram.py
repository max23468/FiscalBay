"""Low-level Telegram Bot API helpers."""

from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Mapping, TypeAlias, TypedDict, cast

from ..errors import TelegramApiError
from ..logging_utils import log_event
from ..retry import run_with_retry

LOGGER = logging.getLogger("fiscalbay.telegram_bot")
TELEGRAM_API_BASE = "https://api.telegram.org"
DEFAULT_TELEGRAM_RETRIES = 5
DEFAULT_TELEGRAM_BASE_DELAY = 0.5

JsonPrimitive: TypeAlias = None | bool | int | float | str
JsonValue: TypeAlias = JsonPrimitive | list["JsonValue"] | dict[str, "JsonValue"]
JsonObject: TypeAlias = dict[str, JsonValue]


class InlineKeyboardButton(TypedDict):
    text: str
    callback_data: str


class InlineKeyboardMarkup(TypedDict):
    inline_keyboard: list[list[InlineKeyboardButton]]


class TelegramErrorPayload(TypedDict, total=False):
    description: str


def _parse_json_object(payload: str, *, method: str) -> JsonObject:
    parsed = json.loads(payload)
    if not isinstance(parsed, dict):
        raise TelegramApiError(f"Risposta Telegram non valida su {method}: atteso oggetto JSON.")
    return cast(JsonObject, parsed)


def telegram_retry_settings() -> tuple[int, float]:
    retries = int(os.getenv("TELEGRAM_HTTP_MAX_RETRIES", str(DEFAULT_TELEGRAM_RETRIES)))
    base = float(os.getenv("TELEGRAM_HTTP_RETRY_BASE_DELAY", str(DEFAULT_TELEGRAM_BASE_DELAY)))
    return max(1, retries), max(0.05, base)


def telegram_error_retryable(exc: TelegramApiError) -> bool:
    code = exc.status_code
    if code is None:
        return True
    if code == 429:
        return True
    return 500 <= code <= 599


def telegram_api_request_once(
    token: str,
    method: str,
    params: Mapping[str, JsonValue] | None = None,
) -> JsonValue:
    encoded_method = urllib.parse.quote(method, safe="")
    url = f"{TELEGRAM_API_BASE}/bot{token}/{encoded_method}"
    data = None
    headers = {"Accept": "application/json"}

    if params is not None:
        data = json.dumps(params).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url=url, data=data, method="POST" if data else "GET")
    for key, value in headers.items():
        request.add_header(key, value)

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            error_payload = cast(TelegramErrorPayload, _parse_json_object(body, method=method))
            description = error_payload.get("description") or body
        except json.JSONDecodeError:
            description = body or str(exc)
        except TelegramApiError:
            description = body or str(exc)
        raise TelegramApiError(
            f"Errore Telegram su {method}: HTTP {exc.code}: {description}",
            status_code=exc.code,
        ) from exc
    except Exception as exc:
        raise TelegramApiError(f"Errore Telegram su {method}: {exc}") from exc

    parsed = _parse_json_object(payload, method=method)
    if not parsed.get("ok"):
        raise TelegramApiError(f"Telegram API {method}: {parsed}")
    return parsed.get("result")


def telegram_api_request(
    token: str,
    method: str,
    params: Mapping[str, JsonValue] | None = None,
) -> JsonValue:
    max_retries, base_delay = telegram_retry_settings()

    def on_retry(exc: Exception, attempt_no: int, total_attempts: int, delay: float) -> None:
        assert isinstance(exc, TelegramApiError)
        log_event(
            LOGGER,
            logging.WARNING,
            "telegram_api_retry",
            method=method,
            attempt=attempt_no,
            attempts=total_attempts,
            delay_seconds=round(delay, 2),
            status_code=exc.status_code,
            error=exc,
        )

    return run_with_retry(
        lambda: telegram_request_once(token, method, params),
        max_attempts=max_retries,
        should_retry=lambda exc: (
            isinstance(exc, TelegramApiError) and telegram_error_retryable(exc)
        ),
        on_retry=on_retry,
        base_delay=base_delay,
        sleep_fn=time.sleep,
    )


def ensure_long_polling(token: str) -> None:
    telegram_request(token, "deleteWebhook", {"drop_pending_updates": False})


def telegram_request_once(
    token: str,
    method: str,
    params: Mapping[str, JsonValue] | None = None,
) -> JsonValue:
    return telegram_api_request_once(token, method, params)


def telegram_request(
    token: str,
    method: str,
    params: Mapping[str, JsonValue] | None = None,
) -> JsonValue:
    return telegram_api_request(token, method, params)
