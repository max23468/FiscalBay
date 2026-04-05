"""Order fetching and normalization services."""

from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

from ..clients.ebay import get_access_token, get_order_detail, get_orders
from ..errors import EbayApiError
from ..models import Config, FetchOptions, OrderRecord

DEFAULT_PAGE_SIZE = 50

logger = logging.getLogger(__name__)


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
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


def get_csv_fieldnames(records: list[dict[str, str]]) -> list[str]:
    if records:
        return list(records[0].keys())
    return list(OrderRecord().as_dict().keys())


def parse_iso8601(value: str) -> datetime:
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    dt = datetime.fromisoformat(normalized)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def order_detail_delay_seconds() -> float:
    raw = os.getenv("EBAY_ORDER_DETAIL_DELAY_SECONDS", "0").strip()
    if not raw:
        return 0.0
    return max(0.0, float(raw))


def choose_tax_identifier(order: dict) -> Optional[dict]:
    buyer = order.get("buyer") or {}
    tax_identifier = buyer.get("taxIdentifier")
    if tax_identifier:
        return tax_identifier
    return None


def extract_record(order: dict) -> dict[str, str]:
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
        lines = [
            contact.get("addressLine1"),
            contact.get("addressLine2"),
            contact.get("city"),
            contact.get("postalCode"),
            contact.get("stateOrProvince"),
        ]
        addr = ", ".join([str(line) for line in lines if line])
        if name and addr:
            shipping_addr_str = f"{name}, {addr}"
        elif addr:
            shipping_addr_str = addr

    return OrderRecord(
        orderId=order.get("orderId", ""),
        creationDate=order.get("creationDate", ""),
        buyerUsername=buyer.get("username", ""),
        buyerName=buyer.get("taxAddress", {}).get("fullName", "") or buyer.get("fullName", ""),
        taxpayerId=taxpayer_id,
        taxIdentifierType=tax_type,
        issuingCountry=tax_identifier.get("issuingCountry", ""),
        found="yes" if taxpayer_id else "no",
        items=items_str,
        total=total_str,
        shippingAddress=shipping_addr_str,
    ).as_dict()


def render_table(records: Iterable[dict[str, str]]) -> str:
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

    def format_row(row: dict[str, str]) -> str:
        return " | ".join(str(row.get(column, "")).ljust(widths[column]) for column in columns)

    header = format_row({column: column for column in columns})
    separator = "-+-".join("-" * widths[column] for column in columns)
    body = [format_row(row) for row in rows]
    return "\n".join([header, separator] + body) if body else header + "\n" + separator


def write_output(records: list[dict[str, str]], fmt: str, output_path: Optional[str]) -> None:
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


def fetch_records(config: Config, options: FetchOptions) -> list[dict[str, str]]:
    access_token = get_access_token(config)
    details: list[dict] = []
    order_ids = options.order_ids or []
    delay = order_detail_delay_seconds()

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
