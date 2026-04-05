"""Low-level eBay API client helpers."""

from __future__ import annotations

import base64
import json
import logging
import os
import random
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Optional

from ..errors import EbayApiError
from ..models import Config

logger = logging.getLogger(__name__)

DEFAULT_PAGE_SIZE = 50
DEFAULT_REQUEST_RETRIES = 5
DEFAULT_REQUEST_BASE_DELAY = 0.5
DEFAULT_TOKEN_SKEW_SECONDS = 60

_token_cache_lock = threading.Lock()
_token_cache: dict[str, tuple[str, float]] = {}


def clear_access_token_cache() -> None:
    with _token_cache_lock:
        _token_cache.clear()


def token_cache_key(config: Config) -> str:
    return f"{config.client_id}\0{config.environment}\0{config.scopes}"


def request_retry_settings() -> tuple[int, float]:
    retries = int(os.getenv("EBAY_HTTP_MAX_RETRIES", str(DEFAULT_REQUEST_RETRIES)))
    base = float(os.getenv("EBAY_HTTP_RETRY_BASE_DELAY", str(DEFAULT_REQUEST_BASE_DELAY)))
    return max(1, retries), max(0.05, base)


def ebay_error_retryable(exc: EbayApiError) -> bool:
    code = exc.status_code
    if code is None:
        return True
    if code == 429:
        return True
    return 500 <= code <= 599


def make_request_once(
    method: str,
    url: str,
    headers: Optional[dict[str, str]] = None,
    data: Optional[bytes] = None,
) -> dict:
    request = urllib.request.Request(url=url, data=data, method=method)
    for key, value in (headers or {}).items():
        request.add_header(key, value)

    try:
        with urllib.request.urlopen(request) as response:
            payload = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body)
            message = parsed.get("message") or parsed.get("error_description") or body
        except json.JSONDecodeError:
            message = body or str(exc)
        raise EbayApiError(f"HTTP {exc.code} su {url}: {message}", status_code=exc.code) from exc
    except urllib.error.URLError as exc:
        raise EbayApiError(f"Errore di rete verso {url}: {exc.reason}") from exc

    if not payload:
        return {}
    return json.loads(payload)


def make_request(
    method: str,
    url: str,
    headers: Optional[dict[str, str]] = None,
    data: Optional[bytes] = None,
) -> dict:
    max_retries, base_delay = request_retry_settings()
    last: Optional[BaseException] = None
    for attempt in range(max_retries):
        try:
            return make_request_once(method, url, headers=headers, data=data)
        except EbayApiError as exc:
            last = exc
            if not ebay_error_retryable(exc) or attempt == max_retries - 1:
                raise
            delay = base_delay * (2**attempt) + random.uniform(0, 0.25)
            logger.warning(
                "Richiesta eBay fallita (tentativo %s/%s), riprovo tra %.2fs: %s",
                attempt + 1,
                max_retries,
                delay,
                exc,
            )
            time.sleep(delay)
    assert last is not None
    raise last


def mint_user_access_token_response(config: Config) -> dict:
    credentials = f"{config.client_id}:{config.client_secret}".encode("utf-8")
    encoded = base64.b64encode(credentials).decode("ascii")
    url = f"{config.api_base}/identity/v1/oauth2/token"
    body = urllib.parse.urlencode(
        {
            "grant_type": "refresh_token",
            "refresh_token": config.refresh_token,
            "scope": config.scopes,
        }
    ).encode("utf-8")
    return make_request(
        "POST",
        url,
        headers={
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data=body,
    )


def get_access_token(config: Config) -> str:
    key = token_cache_key(config)
    skew = int(os.getenv("EBAY_TOKEN_SKEW_SECONDS", str(DEFAULT_TOKEN_SKEW_SECONDS)))
    now = time.time()
    with _token_cache_lock:
        cached = _token_cache.get(key)
        if cached:
            token, expires_at = cached
            if expires_at - skew > now:
                return token

    response = mint_user_access_token_response(config)
    token = response.get("access_token")
    if not token:
        raise EbayApiError("La risposta OAuth non contiene access_token.")
    expires_in = int(response.get("expires_in", 7200))
    expires_at = time.time() + max(30, expires_in)

    with _token_cache_lock:
        cached = _token_cache.get(key)
        if cached:
            old_token, old_exp = cached
            if old_exp - skew > time.time():
                return old_token
        _token_cache[key] = (token, expires_at)
    return token


def get_orders(
    config: Config,
    access_token: str,
    created_after: datetime,
    created_before: datetime,
    page_size: int,
    max_results: int,
) -> list[dict]:
    orders: list[dict] = []
    offset = 0
    safe_page_size = max(1, min(page_size, DEFAULT_PAGE_SIZE))
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    while len(orders) < max_results:
        remaining = max_results - len(orders)
        limit = min(safe_page_size, remaining)
        filter_value = (
            f"creationdate:[{to_ebay_timestamp(created_after)}.."
            f"{to_ebay_timestamp(created_before)}]"
        )
        query = urllib.parse.urlencode(
            {"filter": filter_value, "limit": limit, "offset": offset}
        )
        url = f"{config.api_base}/sell/fulfillment/v1/order?{query}"
        response = make_request("GET", url, headers=headers)
        page_orders = response.get("orders", [])
        if not page_orders:
            break
        orders.extend(page_orders)
        if len(page_orders) < limit:
            break
        offset += len(page_orders)

    return orders


def get_order_detail(config: Config, access_token: str, order_id: str) -> dict:
    encoded_order_id = urllib.parse.quote(order_id, safe="")
    url = f"{config.api_base}/sell/fulfillment/v1/order/{encoded_order_id}"
    return make_request(
        "GET",
        url,
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
    )


def to_ebay_timestamp(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )
