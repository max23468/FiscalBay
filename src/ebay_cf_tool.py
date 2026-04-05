#!/usr/bin/env python3
"""CLI per estrarre il codice fiscale dagli ordini eBay tramite API ufficiali."""

from __future__ import annotations

import argparse
import base64
import csv
import json
import logging
import os
import random
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional

logger = logging.getLogger(__name__)

DEFAULT_SCOPE = "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly"
DEFAULT_PAGE_SIZE = 50
DEFAULT_REQUEST_RETRIES = 5
DEFAULT_REQUEST_BASE_DELAY = 0.5
DEFAULT_TOKEN_SKEW_SECONDS = 60

_token_cache_lock = threading.Lock()
_token_cache: Dict[str, tuple[str, float]] = {}


class EbayApiError(RuntimeError):
    """Errore leggibile per richieste eBay fallite."""

    def __init__(self, message: str, *, status_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass
class Config:
    client_id: str
    client_secret: str
    refresh_token: str
    environment: str
    scopes: str

    @property
    def api_base(self) -> str:
        if self.environment == "sandbox":
            return "https://api.sandbox.ebay.com"
        return "https://api.ebay.com"


@dataclass
class FetchOptions:
    days: int = 7
    created_after: Optional[str] = None
    created_before: Optional[str] = None
    limit: int = DEFAULT_PAGE_SIZE
    max_results: int = 100
    order_ids: Optional[List[str]] = None
    only_found: bool = False


def clear_access_token_cache() -> None:
    """Svuota la cache token in memoria (utile per test)."""
    with _token_cache_lock:
        _token_cache.clear()


def _token_cache_key(config: Config) -> str:
    return f"{config.client_id}\0{config.environment}\0{config.scopes}"


def _request_retry_settings() -> tuple[int, float]:
    retries = int(os.getenv("EBAY_HTTP_MAX_RETRIES", str(DEFAULT_REQUEST_RETRIES)))
    base = float(os.getenv("EBAY_HTTP_RETRY_BASE_DELAY", str(DEFAULT_REQUEST_BASE_DELAY)))
    return max(1, retries), max(0.05, base)


def _ebay_error_retryable(exc: EbayApiError) -> bool:
    code = exc.status_code
    if code is None:
        return True
    if code == 429:
        return True
    return 500 <= code <= 599


def _make_request_once(
    method: str,
    url: str,
    headers: Optional[Dict[str, str]] = None,
    data: Optional[bytes] = None,
) -> Dict:
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
        raise EbayApiError(
            f"HTTP {exc.code} su {url}: {message}",
            status_code=exc.code,
        ) from exc
    except urllib.error.URLError as exc:
        raise EbayApiError(f"Errore di rete verso {url}: {exc.reason}") from exc

    if not payload:
        return {}
    return json.loads(payload)


def make_request(
    method: str,
    url: str,
    headers: Optional[Dict[str, str]] = None,
    data: Optional[bytes] = None,
) -> Dict:
    max_retries, base_delay = _request_retry_settings()
    last: Optional[BaseException] = None
    for attempt in range(max_retries):
        try:
            return _make_request_once(method, url, headers=headers, data=data)
        except EbayApiError as exc:
            last = exc
            if not _ebay_error_retryable(exc) or attempt == max_retries - 1:
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


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Estrae il codice fiscale dell'acquirente dagli ordini eBay "
            "usando le API ufficiali Sell Fulfillment."
        )
    )
    parser.add_argument(
        "--environment",
        choices=("production", "sandbox"),
        default=os.getenv("EBAY_ENVIRONMENT", "production"),
        help="Ambiente eBay da usare (default: production).",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=7,
        help="Recupera gli ordini creati negli ultimi N giorni (default: 7).",
    )
    parser.add_argument(
        "--created-after",
        help="Data ISO-8601 UTC iniziale, es. 2026-04-01T00:00:00Z.",
    )
    parser.add_argument(
        "--created-before",
        help="Data ISO-8601 UTC finale, es. 2026-04-03T23:59:59Z.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=DEFAULT_PAGE_SIZE,
        help="Dimensione pagina getOrders (max consigliato: 50).",
    )
    parser.add_argument(
        "--max-results",
        type=int,
        default=100,
        help="Numero massimo di ordini da processare (default: 100).",
    )
    parser.add_argument(
        "--order-id",
        action="append",
        dest="order_ids",
        help="ID ordine specifico da leggere. Ripetibile.",
    )
    parser.add_argument(
        "--format",
        choices=("table", "json", "csv"),
        default="table",
        help="Formato output (default: table).",
    )
    parser.add_argument(
        "--output",
        help="File destinazione. Se omesso stampa su stdout.",
    )
    parser.add_argument(
        "--only-found",
        action="store_true",
        help="Mostra solo gli ordini in cui eBay restituisce un tax identifier.",
    )
    return parser.parse_args(argv)


def load_config(environment: str) -> Config:
    missing = [
        name
        for name in ("EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET", "EBAY_REFRESH_TOKEN")
        if not os.getenv(name)
    ]
    if missing:
        raise EbayApiError(
            "Variabili ambiente mancanti: " + ", ".join(missing)
        )
    return Config(
        client_id=os.environ["EBAY_CLIENT_ID"],
        client_secret=os.environ["EBAY_CLIENT_SECRET"],
        refresh_token=os.environ["EBAY_REFRESH_TOKEN"],
        environment=environment,
        scopes=os.getenv("EBAY_SCOPES", DEFAULT_SCOPE),
    )


def get_csv_fieldnames(records: List[Dict[str, str]]) -> List[str]:
    if records:
        return list(records[0].keys())
    return [
        "orderId",
        "creationDate",
        "buyerUsername",
        "buyerName",
        "taxpayerId",
        "taxIdentifierType",
        "issuingCountry",
        "found",
        "items",
        "total",
        "shippingAddress",
    ]


def parse_iso8601(value: str) -> datetime:
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    dt = datetime.fromisoformat(normalized)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def to_ebay_timestamp(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )


def mint_user_access_token_response(config: Config) -> Dict:
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


def mint_user_access_token(config: Config) -> str:
    """Ottiene un access token utente (con cache e scadenza)."""
    return get_access_token(config)


def get_access_token(config: Config) -> str:
    key = _token_cache_key(config)
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
) -> List[Dict]:
    orders: List[Dict] = []
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
            {
                "filter": filter_value,
                "limit": limit,
                "offset": offset,
            }
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


def get_order_detail(config: Config, access_token: str, order_id: str) -> Dict:
    encoded_order_id = urllib.parse.quote(order_id, safe="")
    url = f"{config.api_base}/sell/fulfillment/v1/order/{encoded_order_id}"
    return make_request(
        "GET",
        url,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        },
    )


def _order_detail_delay_seconds() -> float:
    raw = os.getenv("EBAY_ORDER_DETAIL_DELAY_SECONDS", "0").strip()
    if not raw:
        return 0.0
    return max(0.0, float(raw))


def choose_tax_identifier(order: Dict) -> Optional[Dict]:
    buyer = order.get("buyer") or {}
    tax_identifier = buyer.get("taxIdentifier")
    if tax_identifier:
        return tax_identifier
    return None


def extract_record(order: Dict) -> Dict[str, str]:
    buyer = order.get("buyer") or {}
    tax_identifier = choose_tax_identifier(order) or {}
    taxpayer_id = tax_identifier.get("taxpayerId") or ""
    tax_type = tax_identifier.get("taxIdentifierType") or ""
    
    line_items = order.get("lineItems") or []
    items_desc = []
    for item in line_items:
        qty = item.get("quantity", 1)
        title = item.get("title", "")
        items_desc.append(f"{qty}x {title}")
    items_str = ", ".join(items_desc) if items_desc else "N/D"

    pricing = order.get("pricingSummary") or {}
    total = pricing.get("total") or {}
    total_str = f"{total.get('value', '0.00')} {total.get('currency', 'EUR')}"

    shipping_addr_str = "N/D"
    fsi = order.get("fulfillmentStartInstructions") or []
    if fsi and isinstance(fsi, list):
        ship_to = fsi[0].get("shippingStep", {}).get("shipTo", {})
        contact = ship_to.get("contactAddress") or {}
        name = ship_to.get("fullName") or ""
        lines = [contact.get("addressLine1"), contact.get("addressLine2"), contact.get("city"), contact.get("postalCode"), contact.get("stateOrProvince")]
        addr = ", ".join([str(l) for l in lines if l])
        if name and addr:
            shipping_addr_str = f"{name}, {addr}"
        elif addr:
            shipping_addr_str = addr

    return {
        "orderId": order.get("orderId", ""),
        "creationDate": order.get("creationDate", ""),
        "buyerUsername": buyer.get("username", ""),
        "buyerName": buyer.get("taxAddress", {}).get("fullName", "")
        or buyer.get("fullName", ""),
        "taxpayerId": taxpayer_id,
        "taxIdentifierType": tax_type,
        "issuingCountry": tax_identifier.get("issuingCountry", ""),
        "found": "yes" if taxpayer_id else "no",
        "items": items_str,
        "total": total_str,
        "shippingAddress": shipping_addr_str,
    }


def render_table(records: Iterable[Dict[str, str]]) -> str:
    rows = list(records)
    columns = [
        "orderId",
        "creationDate",
        "buyerUsername",
        "taxpayerId",
        "taxIdentifierType",
        "issuingCountry",
        "found",
    ]
    widths = {column: len(column) for column in columns}
    for row in rows:
        for column in columns:
            widths[column] = max(widths[column], len(str(row.get(column, ""))))

    def format_row(row: Dict[str, str]) -> str:
        return " | ".join(
            str(row.get(column, "")).ljust(widths[column]) for column in columns
        )

    header = format_row({column: column for column in columns})
    separator = "-+-".join("-" * widths[column] for column in columns)
    body = [format_row(row) for row in rows]
    return "\n".join([header, separator] + body) if body else header + "\n" + separator


def write_output(records: List[Dict[str, str]], fmt: str, output_path: Optional[str]) -> None:
    if fmt == "json":
        content = json.dumps(records, indent=2, ensure_ascii=False)
    elif fmt == "csv":
        if output_path:
            with open(output_path, "w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=get_csv_fieldnames(records))
                writer.writeheader()
                writer.writerows(records)
            return
        from io import StringIO

        string_io = StringIO()
        writer = csv.DictWriter(string_io, fieldnames=get_csv_fieldnames(records))
        writer.writeheader()
        writer.writerows(records)
        content = string_io.getvalue().rstrip("\n")
    else:
        content = render_table(records)

    if output_path:
        with open(output_path, "w", encoding="utf-8") as handle:
            handle.write(content + ("\n" if not content.endswith("\n") else ""))
    else:
        print(content)


def resolve_date_window_from_options(options: FetchOptions) -> tuple[datetime, datetime]:
    if options.created_after:
        created_after = parse_iso8601(options.created_after)
    else:
        created_after = datetime.now(timezone.utc) - timedelta(days=options.days)

    if options.created_before:
        created_before = parse_iso8601(options.created_before)
    else:
        created_before = datetime.now(timezone.utc)

    if created_after >= created_before:
        raise EbayApiError("--created-after deve essere precedente a --created-before.")
    return created_after, created_before


def fetch_records(config: Config, options: FetchOptions) -> List[Dict[str, str]]:
    access_token = get_access_token(config)
    details: List[Dict] = []
    order_ids = options.order_ids or []
    delay = _order_detail_delay_seconds()

    if order_ids:
        for index, order_id in enumerate(order_ids):
            if index and delay:
                time.sleep(delay)
            details.append(get_order_detail(config, access_token, order_id))
    else:
        created_after, created_before = resolve_date_window_from_options(options)
        summaries = get_orders(
            config=config,
            access_token=access_token,
            created_after=created_after,
            created_before=created_before,
            page_size=options.limit,
            max_results=options.max_results,
        )
        detail_calls = 0
        for summary in summaries:
            order_id = summary.get("orderId")
            if not order_id:
                continue
            if detail_calls and delay:
                time.sleep(delay)
            details.append(get_order_detail(config, access_token, order_id))
            detail_calls += 1

    records = [extract_record(order) for order in details]
    if options.only_found:
        records = [record for record in records if record["found"] == "yes"]
    return records


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)
    log_level = os.getenv("LOG_LEVEL", "WARNING").upper()
    logging.basicConfig(
        level=getattr(logging, log_level, logging.WARNING),
        format="%(levelname)s %(name)s: %(message)s",
    )
    try:
        config = load_config(args.environment)
        options = FetchOptions(
            days=args.days,
            created_after=args.created_after,
            created_before=args.created_before,
            limit=args.limit,
            max_results=args.max_results,
            order_ids=args.order_ids,
            only_found=args.only_found,
        )
        records = fetch_records(config, options)
        write_output(records, args.format, args.output)
    except EbayApiError as exc:
        logger.error("%s", exc)
        print(f"Errore: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
