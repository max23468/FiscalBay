"""Telegram presentation for common."""

from __future__ import annotations

import html
import re
from datetime import datetime
from typing import cast
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .clients.telegram import InlineKeyboardMarkup
from .models import (
    OrderRecord,
)

_FISCAL_IDENTIFIER_COPY_RE = re.compile(
    r"💳\s*<b>(?P<label>[^<]+)</b>:\s*<code>(?P<value>.*?)</code>"
)

_FISCAL_IDENTIFIER_UNAVAILABLE_VALUES = {"", "non disponibile", "n/d", "none", "null"}


def fiscal_identifier_label(tax_identifier_type: str) -> str:
    normalized = str(tax_identifier_type or "").strip().upper()
    if normalized == "CODICE_FISCALE":
        return "CF"
    if normalized == "VAT_NUMBER":
        return "P.IVA"
    return "ID Fiscale"


def format_remote_revocation_line(status: str, detail: str) -> str:
    safe_detail = detail or "token locale già assente"
    if status == "revoked":
        return "☁️ Revoca remota eBay: <code>completata</code>\n"
    if status == "failed":
        return "☁️ Revoca remota eBay: <code>non confermata</code>\n"
    if status == "manual_required":
        return (
            "☁️ Revoca consenso eBay: <code>manuale</code>\n"
            f"📝 Prossimo passo eBay: <code>{detail}</code>\n"
        )
    if status == "missing_token":
        return (
            "☁️ Revoca consenso eBay: <code>non verificabile</code>\n"
            f"📝 Nota: <code>{safe_detail}</code>\n"
        )
    if status == "token_unavailable":
        return (
            "☁️ Revoca consenso eBay: <code>manuale</code>\n"
            "📝 Nota: <code>token non leggibile localmente; token locale comunque rimosso</code>\n"
        )
    if status == "skipped":
        return (
            "☁️ Revoca remota eBay: <code>saltata</code>\n"
            f"📝 Nota: <code>{detail or 'token locale rimosso'}</code>\n"
        )
    return "☁️ Revoca remota eBay: <code>non tentata</code>\n"


def chunk_message(text: str, limit: int = 3500) -> list[str]:
    if len(text) <= limit:
        return [text]
    chunks: list[str] = []
    current: list[str] = []
    current_length = 0
    for line in text.splitlines():
        extra = len(line) + (1 if current else 0)
        if current and current_length + extra > limit:
            chunks.append("\n".join(current))
            current = [line]
            current_length = len(line)
            continue
        current.append(line)
        current_length += extra
    if current:
        chunks.append("\n".join(current))
    return chunks


def with_fiscal_identifier_copy_markup(
    text: str,
    reply_markup: InlineKeyboardMarkup | None = None,
) -> InlineKeyboardMarkup | None:
    copy_rows = []
    seen_values = set()
    for match in _FISCAL_IDENTIFIER_COPY_RE.finditer(text):
        label = html.unescape(match.group("label")).strip() or "ID Fiscale"
        value = html.unescape(match.group("value")).strip()
        if value.lower() in _FISCAL_IDENTIFIER_UNAVAILABLE_VALUES:
            continue
        if len(value) > 256 or value in seen_values:
            continue
        seen_values.add(value)
        copy_rows.append(
            [
                {
                    "text": f"Copia {label}",
                    "copy_text": {"text": value},
                }
            ]
        )
    if not copy_rows:
        return reply_markup
    existing_rows = list(reply_markup.get("inline_keyboard", [])) if reply_markup else []
    return cast(InlineKeyboardMarkup, {"inline_keyboard": copy_rows + existing_rows})


def record_fingerprint(record: OrderRecord) -> str:
    raw = "|".join(record.fingerprint_parts())
    import hashlib

    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def format_order_date(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return "N/D"
    normalized = raw[:-1] + "+00:00" if raw.endswith("Z") else raw
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return raw
    if parsed.tzinfo is None:
        return parsed.strftime("%d/%m/%Y %H:%M")
    try:
        local_dt = parsed.astimezone(ZoneInfo("Europe/Rome"))
    except ZoneInfoNotFoundError:
        local_dt = parsed
    return local_dt.strftime("%d/%m/%Y %H:%M")


def format_transaction_status(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return "N/D"
    translations = {
        "AUTHORIZED": "Autorizzato",
        "CANCELED": "Annullato",
        "CANCELLED": "Annullato",
        "COMPLETED": "Completato",
        "FAILED": "Fallito",
        "FULLY_REFUNDED": "Rimborsato",
        "IN_PROGRESS": "In corso",
        "NOT_PAID": "Non pagato",
        "PAID": "Pagato",
        "PARTIALLY_PAID": "Parzialmente pagato",
        "PARTIALLY_REFUNDED": "Parzialmente rimborsato",
        "PENDING": "In attesa",
        "REFUNDED": "Rimborsato",
        "VOIDED": "Annullato",
    }
    normalized = raw.upper().replace("-", "_").replace(" ", "_")
    if normalized in translations:
        return translations[normalized]
    return raw.replace("_", " ").lower().capitalize()
