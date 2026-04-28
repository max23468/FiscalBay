"""Low-level eBay API client helpers."""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Mapping, Optional, TypeAlias, TypedDict, cast

from ..errors import EbayApiError
from ..logging_utils import log_event
from ..models import Config
from ..retry import run_with_retry

logger = logging.getLogger(__name__)

DEFAULT_PAGE_SIZE = 50
DEFAULT_REQUEST_RETRIES = 5
DEFAULT_REQUEST_BASE_DELAY = 0.5
DEFAULT_TOKEN_SKEW_SECONDS = 60
DEFAULT_IDENTITY_SCOPE = "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly"

_token_cache_lock = threading.Lock()
_token_cache: dict[str, tuple[str, float]] = {}

JsonPrimitive: TypeAlias = None | bool | int | float | str
JsonValue: TypeAlias = JsonPrimitive | list["JsonValue"] | dict[str, "JsonValue"]
JsonObject: TypeAlias = dict[str, JsonValue]


class EbayErrorPayload(TypedDict, total=False):
    message: str
    error_description: str


class OAuthTokenResponse(TypedDict, total=False):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int
    refresh_token_expires_in: int
    scope: str


class TokenRevocationResult(TypedDict):
    status: str
    detail: str
    user_action: str
    remote_attempted: bool


class OrderTaxIdentifier(TypedDict, total=False):
    taxpayerId: str
    taxIdentifierType: str
    issuingCountry: str


class OrderTaxAddress(TypedDict, total=False):
    fullName: str


class OrderRegistrationAddress(TypedDict, total=False):
    fullName: str
    email: str


class OrderBuyer(TypedDict, total=False):
    username: str
    fullName: str
    email: str
    emailAddress: str
    buyerRegistrationAddress: OrderRegistrationAddress
    taxAddress: OrderTaxAddress
    taxIdentifier: OrderTaxIdentifier


class OrderLineItem(TypedDict, total=False):
    quantity: int | str
    title: str
    sku: str


class MoneyAmount(TypedDict, total=False):
    value: str
    currency: str


class PricingSummary(TypedDict, total=False):
    total: MoneyAmount


class ContactAddress(TypedDict, total=False):
    addressLine1: str
    addressLine2: str
    city: str
    postalCode: str
    stateOrProvince: str


class ShipTo(TypedDict, total=False):
    fullName: str
    email: str
    contactAddress: ContactAddress


class ShippingStep(TypedDict, total=False):
    shipTo: ShipTo


class FulfillmentInstruction(TypedDict, total=False):
    shippingStep: ShippingStep


class Payment(TypedDict, total=False):
    paymentStatus: str
    status: str


class PaymentSummary(TypedDict, total=False):
    payments: list[Payment]


class EbayOrderPayload(TypedDict, total=False):
    orderId: str
    creationDate: str
    orderPaymentStatus: str
    orderFulfillmentStatus: str
    buyer: OrderBuyer
    lineItems: list[OrderLineItem]
    pricingSummary: PricingSummary
    paymentSummary: PaymentSummary
    fulfillmentStartInstructions: list[FulfillmentInstruction]


class OrdersResponse(TypedDict, total=False):
    orders: list[EbayOrderPayload]


def _parse_json_object(payload: str, *, url: str) -> JsonObject:
    parsed = json.loads(payload)
    if not isinstance(parsed, dict):
        raise EbayApiError(f"Risposta JSON non valida da {url}: atteso oggetto JSON.")
    return cast(JsonObject, parsed)


def _coerce_oauth_token_response(payload: Mapping[str, JsonValue]) -> OAuthTokenResponse:
    return cast(OAuthTokenResponse, dict(payload))


def _coerce_order_payload(payload: Mapping[str, JsonValue]) -> EbayOrderPayload:
    return cast(EbayOrderPayload, dict(payload))


def _coerce_order_list(value: JsonValue) -> list[EbayOrderPayload]:
    if not isinstance(value, list):
        return []
    orders: list[EbayOrderPayload] = []
    for item in value:
        if isinstance(item, dict):
            orders.append(_coerce_order_payload(item))
    return orders


def oauth_authorize_base(environment: str) -> str:
    if environment == "sandbox":
        return "https://auth.sandbox.ebay.com/oauth2/authorize"
    return "https://auth.ebay.com/oauth2/authorize"


def identity_api_base(environment: str) -> str:
    if environment == "sandbox":
        return "https://apiz.sandbox.ebay.com"
    return "https://apiz.ebay.com"


def merge_scopes(*scope_sets: str) -> str:
    merged: list[str] = []
    seen: set[str] = set()
    for scope_set in scope_sets:
        for scope in scope_set.split():
            normalized = scope.strip()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            merged.append(normalized)
    return " ".join(merged)


def clear_access_token_cache() -> None:
    with _token_cache_lock:
        _token_cache.clear()


def token_cache_key(config: Config) -> str:
    refresh_token_hash = hashlib.sha256(config.refresh_token.encode("utf-8")).hexdigest()
    return f"{config.client_id}\0{config.environment}\0{config.scopes}\0{refresh_token_hash}"


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


def request_json_once(
    method: str,
    url: str,
    headers: Optional[dict[str, str]] = None,
    data: Optional[bytes] = None,
) -> JsonObject:
    request = urllib.request.Request(url=url, data=data, method=method)
    for key, value in (headers or {}).items():
        request.add_header(key, value)

    try:
        with urllib.request.urlopen(request) as response:
            payload = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = cast(EbayErrorPayload, _parse_json_object(body, url=url))
            message = parsed.get("message") or parsed.get("error_description") or body
        except json.JSONDecodeError:
            message = body or str(exc)
        except EbayApiError:
            message = body or str(exc)
        raise EbayApiError(f"HTTP {exc.code} su {url}: {message}", status_code=exc.code) from exc
    except urllib.error.URLError as exc:
        raise EbayApiError(f"Errore di rete verso {url}: {exc.reason}") from exc

    if not payload:
        return {}
    return _parse_json_object(payload, url=url)


def request_json(
    method: str,
    url: str,
    headers: Optional[dict[str, str]] = None,
    data: Optional[bytes] = None,
) -> JsonObject:
    max_retries, base_delay = request_retry_settings()

    def on_retry(exc: Exception, attempt_no: int, total_attempts: int, delay: float) -> None:
        assert isinstance(exc, EbayApiError)
        endpoint = urllib.parse.urlparse(url).path or url
        log_event(
            logger,
            logging.WARNING,
            "ebay_api_retry",
            method=method,
            endpoint=endpoint,
            attempt=attempt_no,
            attempts=total_attempts,
            delay_seconds=round(delay, 2),
            status_code=exc.status_code,
            error=exc,
        )

    return run_with_retry(
        lambda: request_json_once(method, url, headers=headers, data=data),
        max_attempts=max_retries,
        should_retry=lambda exc: isinstance(exc, EbayApiError) and ebay_error_retryable(exc),
        on_retry=on_retry,
        base_delay=base_delay,
        sleep_fn=time.sleep,
    )


def request_user_access_token_response(config: Config) -> OAuthTokenResponse:
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
    response = request_json(
        "POST",
        url,
        headers={
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data=body,
    )
    return _coerce_oauth_token_response(response)


def request_authorization_code_token_response(
    config: Config,
    code: str,
    redirect_uri: str,
) -> OAuthTokenResponse:
    credentials = f"{config.client_id}:{config.client_secret}".encode("utf-8")
    encoded = base64.b64encode(credentials).decode("ascii")
    url = f"{config.api_base}/identity/v1/oauth2/token"
    body = urllib.parse.urlencode(
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
        }
    ).encode("utf-8")
    response = request_json(
        "POST",
        url,
        headers={
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data=body,
    )
    return _coerce_oauth_token_response(response)


def revoke_user_refresh_token(
    config: Config,
    refresh_token: str | None = None,
) -> TokenRevocationResult:
    token = (refresh_token or config.refresh_token).strip()
    if not token:
        return {
            "status": "missing_token",
            "detail": "token locale già assente: nessuna revoca remota tentabile",
            "user_action": "controlla su eBay se FiscalBay risulta ancora tra le app autorizzate",
            "remote_attempted": False,
        }
    return {
        "status": "manual_required",
        "detail": (
            "eBay documenta la revoca OAuth utente dalle impostazioni account; "
            "la RevokeToken API disponibile riguarda i token Trading legacy Auth'n'Auth"
        ),
        "user_action": (
            "su eBay apri Account settings > Sign in and security > "
            "Third-party app access e rimuovi FiscalBay se vuoi revocare anche il consenso"
        ),
        "remote_attempted": False,
    }


def build_user_consent_url(config: Config, *, redirect_uri: str, state: str) -> str:
    query = urllib.parse.urlencode(
        {
            "client_id": config.client_id,
            "prompt": "login",
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": config.scopes,
            "state": state,
        }
    )
    return f"{oauth_authorize_base(config.environment)}?{query}"


def get_authenticated_user_profile(config: Config, access_token: str) -> JsonObject:
    url = f"{identity_api_base(config.environment)}/commerce/identity/v1/user/"
    return request_json(
        "GET",
        url,
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
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

    response = request_user_access_token_response(config)
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
) -> list[EbayOrderPayload]:
    orders: list[EbayOrderPayload] = []
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
        query = urllib.parse.urlencode({"filter": filter_value, "limit": limit, "offset": offset})
        url = f"{config.api_base}/sell/fulfillment/v1/order?{query}"
        response = request_json("GET", url, headers=headers)
        page_orders = _coerce_order_list(cast(OrdersResponse, response).get("orders", []))
        if not page_orders:
            break
        orders.extend(page_orders)
        if len(page_orders) < limit:
            break
        offset += len(page_orders)

    return orders


def get_order_detail(config: Config, access_token: str, order_id: str) -> EbayOrderPayload:
    encoded_order_id = urllib.parse.quote(order_id, safe="")
    url = f"{config.api_base}/sell/fulfillment/v1/order/{encoded_order_id}"
    return _coerce_order_payload(
        request_json(
            "GET",
            url,
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        )
    )


def to_ebay_timestamp(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
