"""Low-level eBay Trading API helpers."""

from __future__ import annotations

import logging
import os
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from xml.sax.saxutils import escape

from defusedxml.common import DefusedXmlException
from defusedxml.ElementTree import fromstring as safe_fromstring

from ..errors import EbayApiError
from ..logging_utils import log_event
from ..models import Config, JsonValue
from ..retry import run_with_retry

LOGGER = logging.getLogger(__name__)

TRADING_API_VERSION = "1455"
DEFAULT_TRADING_SITE_ID = "101"
DEFAULT_TRADING_BATCH_SIZE = 20
TRADING_NAMESPACE = "urn:ebay:apis:eBLBaseComponents"
NS = {"e": TRADING_NAMESPACE}


def trading_api_base(environment: str) -> str:
    if environment == "sandbox":
        return "https://api.sandbox.ebay.com/ws/api.dll"
    return "https://api.ebay.com/ws/api.dll"


def trading_site_id() -> str:
    configured = os.getenv("EBAY_TRADING_SITE_ID", DEFAULT_TRADING_SITE_ID).strip()
    return configured or DEFAULT_TRADING_SITE_ID


def _format_trading_timestamp(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _normalize_trading_tax_type(raw: str) -> str:
    normalized = raw.strip().replace("-", "_").replace(" ", "_").upper()
    compact = normalized.replace("_", "")
    if compact == "CODICEFISCALE":
        return "CODICE_FISCALE"
    if compact in {"VAT", "VATIN", "VATNUMBER"}:
        return "VAT_NUMBER"
    return normalized


def _build_get_orders_by_id_payload(order_ids: list[str]) -> bytes:
    order_id_xml = "".join(f"<OrderID>{escape(order_id)}</OrderID>" for order_id in order_ids)
    payload = (
        f'<?xml version="1.0" encoding="utf-8"?>'
        f'<GetOrdersRequest xmlns="{TRADING_NAMESPACE}">'
        f"<Version>{TRADING_API_VERSION}</Version>"
        "<DetailLevel>ReturnAll</DetailLevel>"
        "<OrderRole>Seller</OrderRole>"
        "<OrderStatus>All</OrderStatus>"
        f"<OrderIDArray>{order_id_xml}</OrderIDArray>"
        "</GetOrdersRequest>"
    )
    return payload.encode("utf-8")


def _build_get_orders_by_date_payload(
    created_after: datetime,
    created_before: datetime,
    *,
    page_size: int,
    page_number: int,
) -> bytes:
    payload = (
        f'<?xml version="1.0" encoding="utf-8"?>'
        f'<GetOrdersRequest xmlns="{TRADING_NAMESPACE}">'
        f"<Version>{TRADING_API_VERSION}</Version>"
        "<DetailLevel>ReturnAll</DetailLevel>"
        "<OrderRole>Seller</OrderRole>"
        "<OrderStatus>All</OrderStatus>"
        f"<CreateTimeFrom>{_format_trading_timestamp(created_after)}</CreateTimeFrom>"
        f"<CreateTimeTo>{_format_trading_timestamp(created_before)}</CreateTimeTo>"
        "<Pagination>"
        f"<EntriesPerPage>{max(1, min(page_size, DEFAULT_TRADING_BATCH_SIZE))}</EntriesPerPage>"
        f"<PageNumber>{max(1, page_number)}</PageNumber>"
        "</Pagination>"
        "</GetOrdersRequest>"
    )
    return payload.encode("utf-8")


def request_trading_xml_once(config: Config, access_token: str, payload: bytes) -> ET.Element:
    request = urllib.request.Request(
        trading_api_base(config.environment),
        data=payload,
        method="POST",
    )
    for key, value in {
        "Content-Type": "text/xml;charset=UTF-8",
        "X-EBAY-API-CALL-NAME": "GetOrders",
        "X-EBAY-API-SITEID": trading_site_id(),
        "X-EBAY-API-COMPATIBILITY-LEVEL": TRADING_API_VERSION,
        "X-EBAY-API-IAF-TOKEN": access_token,
    }.items():
        request.add_header(key, value)

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = response.read()
    except urllib.error.HTTPError as exc:
        with exc:  # chiude il socket sottostante: senza, l'errore lascia un ResourceWarning
            body = exc.read().decode("utf-8", errors="replace")
        raise EbayApiError(
            f"HTTP {exc.code} su Trading API GetOrders: {body or str(exc)}",
            status_code=exc.code,
        ) from exc
    except urllib.error.URLError as exc:
        raise EbayApiError(f"Errore di rete verso Trading API GetOrders: {exc.reason}") from exc

    try:
        root = safe_fromstring(body)
    except (ET.ParseError, DefusedXmlException) as exc:
        raise EbayApiError("Risposta XML non valida da Trading API GetOrders.") from exc

    ack = root.findtext("e:Ack", default="", namespaces=NS)
    if ack not in {"Success", "Warning"}:
        errors = root.findall(".//e:Errors", NS)
        message = "Trading API GetOrders non riuscita."
        if errors:
            first = errors[0]
            short = first.findtext("e:ShortMessage", default="", namespaces=NS)
            long = first.findtext("e:LongMessage", default="", namespaces=NS)
            code = first.findtext("e:ErrorCode", default="", namespaces=NS)
            message = f"Trading API GetOrders error {code}: {short or long or message}"
        raise EbayApiError(message)

    return root


def request_trading_xml(config: Config, access_token: str, payload: bytes) -> ET.Element:
    def on_retry(exc: Exception, attempt_no: int, total_attempts: int, delay: float) -> None:
        if not isinstance(exc, EbayApiError):
            return
        log_event(
            LOGGER,
            logging.WARNING,
            "trading_api_retry",
            method="GetOrders",
            attempt=attempt_no,
            attempts=total_attempts,
            delay_seconds=round(delay, 2),
            status_code=exc.status_code,
            error=exc,
        )

    return run_with_retry(
        lambda: request_trading_xml_once(config, access_token, payload),
        max_attempts=3,
        should_retry=lambda exc: (
            isinstance(exc, EbayApiError)
            and (exc.status_code is None or exc.status_code == 429 or exc.status_code >= 500)
        ),
        on_retry=on_retry,
        base_delay=0.5,
    )


def _tax_identifier_from_order(order: ET.Element) -> dict[str, JsonValue] | None:
    tax_identifier = order.find("e:BuyerTaxIdentifier", NS)
    if tax_identifier is None:
        return None

    taxpayer_id = (tax_identifier.findtext("e:ID", default="", namespaces=NS) or "").strip()
    tax_type = (tax_identifier.findtext("e:Type", default="", namespaces=NS) or "").strip()
    issuing_country = ""
    for attribute in tax_identifier.findall("e:Attribute", NS):
        if attribute.attrib.get("name") == "IssuingCountry":
            issuing_country = (attribute.text or "").strip()
            break

    if not taxpayer_id:
        return None
    return {
        "taxpayerId": taxpayer_id,
        "taxIdentifierType": _normalize_trading_tax_type(tax_type),
        "issuingCountry": issuing_country,
    }


def _extract_tax_identifiers(root: ET.Element) -> dict[str, dict[str, JsonValue]]:
    identifiers: dict[str, dict[str, JsonValue]] = {}
    for order in root.findall(".//e:OrderArray/e:Order", NS):
        tax_identifier = _tax_identifier_from_order(order)
        if tax_identifier is None:
            continue
        order_ids = {
            (order.findtext("e:OrderID", default="", namespaces=NS) or "").strip(),
            (order.findtext("e:ExtendedOrderID", default="", namespaces=NS) or "").strip(),
        }
        for order_id in order_ids:
            if order_id:
                identifiers[order_id] = tax_identifier
    return identifiers


def get_order_tax_identifiers(
    config: Config,
    access_token: str,
    order_ids: list[str],
) -> dict[str, dict[str, JsonValue]]:
    identifiers: dict[str, dict[str, JsonValue]] = {}
    cleaned = [order_id for order_id in dict.fromkeys(order_ids) if order_id]
    for index in range(0, len(cleaned), DEFAULT_TRADING_BATCH_SIZE):
        batch = cleaned[index : index + DEFAULT_TRADING_BATCH_SIZE]
        root = request_trading_xml(config, access_token, _build_get_orders_by_id_payload(batch))
        identifiers.update(_extract_tax_identifiers(root))
    return identifiers


def get_order_tax_identifiers_by_date(
    config: Config,
    access_token: str,
    created_after: datetime,
    created_before: datetime,
    *,
    page_size: int,
    max_results: int,
) -> dict[str, dict[str, JsonValue]]:
    identifiers: dict[str, dict[str, JsonValue]] = {}
    page_number = 1
    fetched = 0
    safe_page_size = max(1, min(page_size, DEFAULT_TRADING_BATCH_SIZE))
    while fetched < max_results:
        root = request_trading_xml(
            config,
            access_token,
            _build_get_orders_by_date_payload(
                created_after,
                created_before,
                page_size=safe_page_size,
                page_number=page_number,
            ),
        )
        orders = root.findall(".//e:OrderArray/e:Order", NS)
        if not orders:
            break
        identifiers.update(_extract_tax_identifiers(root))
        fetched += len(orders)
        if len(orders) < safe_page_size:
            break
        page_number += 1
    return identifiers
