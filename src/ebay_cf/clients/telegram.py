"""Low-level Telegram Bot API helpers."""

from __future__ import annotations

import json
import logging
import os
import random
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional

from ..errors import TelegramApiError

LOGGER = logging.getLogger("ebaycf.telegram_bot")
TELEGRAM_API_BASE = "https://api.telegram.org"
DEFAULT_TELEGRAM_RETRIES = 5
DEFAULT_TELEGRAM_BASE_DELAY = 0.5


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


def telegram_request_once(
    token: str,
    method: str,
    params: Optional[dict[str, object]] = None,
) -> dict:
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
            error_payload = json.loads(body)
            description = error_payload.get("description") or body
        except json.JSONDecodeError:
            description = body or str(exc)
        raise TelegramApiError(
            f"Errore Telegram su {method}: HTTP {exc.code}: {description}",
            status_code=exc.code,
        ) from exc
    except Exception as exc:
        raise TelegramApiError(f"Errore Telegram su {method}: {exc}") from exc

    parsed = json.loads(payload)
    if not parsed.get("ok"):
        raise TelegramApiError(f"Telegram API {method}: {parsed}")
    return parsed["result"]


def telegram_request(
    token: str,
    method: str,
    params: Optional[dict[str, object]] = None,
) -> dict:
    max_retries, base_delay = telegram_retry_settings()
    last: Optional[BaseException] = None
    for attempt in range(max_retries):
        try:
            return telegram_request_once(token, method, params)
        except TelegramApiError as exc:
            last = exc
            if not telegram_error_retryable(exc) or attempt == max_retries - 1:
                raise
            delay = base_delay * (2**attempt) + random.uniform(0, 0.25)
            LOGGER.warning(
                "Richiesta Telegram fallita (tentativo %s/%s), riprovo tra %.2fs: %s",
                attempt + 1,
                max_retries,
                delay,
                exc,
            )
            time.sleep(delay)
    assert last is not None
    raise last


def ensure_long_polling(token: str) -> None:
    telegram_request(token, "deleteWebhook", {"drop_pending_updates": False})
