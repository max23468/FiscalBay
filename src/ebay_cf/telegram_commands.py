"""Telegram command parsing and response formatting helpers."""

from __future__ import annotations

import html
import json
import urllib.parse
from typing import Callable, Iterable, Mapping

from .errors import UserInputError
from .models import (
    BotRuntimeState,
    FetchOptions,
    OrderRecord,
    RetryQueueEntry,
    TelegramConfig,
)

TELEGRAM_CMD_MAX_DAYS = 365
TELEGRAM_CMD_MIN_DAYS = 1
TELEGRAM_CMD_MAX_RESULTS = 500
TELEGRAM_CMD_MIN_RESULTS = 1

CALLBACK_ULTIMI = "menu:ultimi"
CALLBACK_TUTTI = "menu:tutti"
CALLBACK_STATO = "menu:stato"
CALLBACK_HELP = "menu:help"


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


def record_fingerprint(record: OrderRecord) -> str:
    raw = "|".join(record.fingerprint_parts())
    import hashlib

    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def format_record(record: OrderRecord) -> str:
    cf = record.taxpayerId or "non disponibile"
    tax_type = record.taxIdentifierType or "n/d"
    country = record.issuingCountry or "n/d"
    order_id = html.escape(record.orderId)
    missing_fiscal = ""
    if not record.taxpayerId:
        missing_fiscal = (
            "\n⚠️ <i>Dati fiscali non presenti nella risposta eBay per questo ordine.</i>"
        )

    ebay_url = f"https://www.ebay.it/sh/ord/details?orderid={urllib.parse.quote(record.orderId)}"

    items = html.escape(record.items or "N/D")
    total = html.escape(record.total or "N/D")
    shipping = html.escape(record.shippingAddress or "N/D")
    buyer = html.escape(record.buyerUsername or "n/d")
    created_at = html.escape(record.creationDate)

    return (
        f'🛒 <b>Ordine</b> • <a href="{ebay_url}"><code>{order_id}</code></a>\n'
        f"┌ 📅 <b>Data</b>: <code>{created_at}</code>\n"
        f"├ 👤 <b>Acquirente</b>: <code>{buyer}</code>\n"
        f"├ 📦 <b>Articoli</b>: <i>{items}</i>\n"
        f"├ 💰 <b>Totale</b>: <code>{total}</code>\n"
        f"├ 📍 <b>Spedizione</b>: <code>{shipping}</code>\n"
        "└ 💳 <b>CF</b>: "
        f"<code>{html.escape(cf)}</code> "
        f"<i>({html.escape(tax_type)})</i> • "
        f"<code>{html.escape(country)}</code>"
        f"{missing_fiscal}"
    )


def format_records(
    records: Iterable[OrderRecord], only_found: bool, page_size: int = 5
) -> list[str]:
    rows = list(records)
    if not rows:
        if only_found:
            return [
                "🔎 Nessun ordine con codice fiscale restituito da eBay nella selezione richiesta."
            ]
        return ["🔎 Nessun ordine trovato nella selezione richiesta."]
    pages: list[str] = []
    for start in range(0, len(rows), page_size):
        page_rows = rows[start : start + page_size]
        page_no = (start // page_size) + 1
        total_pages = (len(rows) + page_size - 1) // page_size
        header = (
            "📋 <b>Riepilogo ordini</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"📦 Totale: <code>{len(rows)}</code> • 📄 Pagina: <code>{page_no}/{total_pages}</code>"
        )
        body = "\n\n".join(format_record(row) for row in page_rows)
        pages.append(header + "\n\n" + body)
    return pages


def parse_command(text: str) -> tuple[str, list[str]]:
    parts = text.strip().split()
    if not parts:
        return "", []
    command = parts[0].split("@", 1)[0].lower()
    return command, parts[1:]


def build_help_text() -> str:
    return (
        "🤖 <b>Benvenuto in eBay CF Bot</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Comandi disponibili:\n"
        "• 🟢 <code>/ping</code> → verifica rapida\n"
        "• 📊 <code>/stato</code> → stato e metriche bot\n"
        "• 📦 <code>/ultimi [giorni] [max]</code> → ordini con CF trovato\n"
        "• 📋 <code>/tutti [giorni] [max]</code> → tutti gli ordini\n"
        "• 🔍 <code>/ordine [id]</code> → dettaglio ordine singolo\n"
        "• ℹ️ <code>/help</code> → questa guida\n\n"
        "<b>Esempi rapidi</b>\n"
        "• <code>/ultimi 7 20</code>\n"
        "• <code>/tutti 3 50</code>\n"
        "• <code>/ordine 12-34567-89012</code>\n\n"
        f"<i>Limiti input: giorni {TELEGRAM_CMD_MIN_DAYS}-{TELEGRAM_CMD_MAX_DAYS}, "
        f"max ordini {TELEGRAM_CMD_MIN_RESULTS}-{TELEGRAM_CMD_MAX_RESULTS}.</i>"
    )


def build_main_menu_markup() -> dict[str, object]:
    return {
        "inline_keyboard": [
            [
                {"text": "Ultimi CF", "callback_data": CALLBACK_ULTIMI},
                {"text": "Tutti", "callback_data": CALLBACK_TUTTI},
            ],
            [
                {"text": "Stato", "callback_data": CALLBACK_STATO},
                {"text": "Help", "callback_data": CALLBACK_HELP},
            ],
        ]
    }


def callback_command_from_data(data: str) -> str | None:
    mapping = {
        CALLBACK_ULTIMI: "/ultimi 7 20",
        CALLBACK_TUTTI: "/tutti 7 20",
        CALLBACK_STATO: "/stato",
        CALLBACK_HELP: "/help",
    }
    return mapping.get(data.strip())


def should_attach_main_menu(command: str) -> bool:
    return command in ("", "/start", "/help", "/ping", "/stato")


def options_for_command(command: str, args: list[str]) -> FetchOptions:
    if command == "/ordine":
        if not args:
            raise UserInputError("Uso corretto: /ordine <order_id>")
        return FetchOptions(order_ids=[args[0]], only_found=False, max_results=1)

    try:
        days = int(args[0]) if len(args) >= 1 else 7
    except ValueError as exc:
        raise UserInputError("Il numero di giorni deve essere un intero.") from exc
    try:
        max_results = int(args[1]) if len(args) >= 2 else 20
    except ValueError as exc:
        raise UserInputError("Il numero massimo ordini deve essere un intero.") from exc

    if not TELEGRAM_CMD_MIN_DAYS <= days <= TELEGRAM_CMD_MAX_DAYS:
        raise UserInputError(
            "Giorni fuori intervallo: usa un valore tra "
            f"{TELEGRAM_CMD_MIN_DAYS} e {TELEGRAM_CMD_MAX_DAYS}."
        )
    if not TELEGRAM_CMD_MIN_RESULTS <= max_results <= TELEGRAM_CMD_MAX_RESULTS:
        raise UserInputError(
            "Max ordini fuori intervallo: usa un valore tra "
            f"{TELEGRAM_CMD_MIN_RESULTS} e {TELEGRAM_CMD_MAX_RESULTS}."
        )

    only_found = command != "/tutti"
    return FetchOptions(days=days, max_results=max_results, only_found=only_found)


def is_authorized(chat_id: int, config: TelegramConfig) -> bool:
    if config.allowed_chat_ids is None:
        return True
    return chat_id in config.allowed_chat_ids


def format_status(
    state: BotRuntimeState,
    retry_queue_size: int,
    runtime_context: Mapping[str, object] | None = None,
) -> str:
    metrics = state.metrics
    errors = metrics.errors_by_type
    errors_text = html.escape(json.dumps(errors, ensure_ascii=False)) if errors else "nessuno"
    last_check_str = state.last_check or "mai"
    last_error_str = state.last_error or "nessuno"
    context = runtime_context or {}
    tenant_scope = html.escape(str(context.get("tenant_scope", "global")))
    environment = html.escape(str(context.get("environment", "production")))
    config_source = html.escape(str(context.get("config_source", "global_env")))
    fallback_reason = context.get("fallback_reason")
    fallback_text = (
        f"\n🪂 Fallback credenziali: <code>{html.escape(str(fallback_reason))}</code>"
        if fallback_reason
        else ""
    )

    return (
        "📊 <b>Stato del Bot</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🏷️ Scope runtime: <code>{tenant_scope}</code>\n"
        f"🌍 Ambiente eBay: <code>{environment}</code>\n"
        f"🔐 Sorgente credenziali: <code>{config_source}</code>"
        f"{fallback_text}\n"
        f"⏱️ Ultimo check eBay: <code>{html.escape(last_check_str)}</code>\n"
        f"📦 Ordini analizzati: <code>{metrics.orders_read}</code>\n"
        f"🧾 Ordini con CF: <code>{metrics.orders_with_cf}</code>\n"
        f"📩 Notifiche inviate: <code>{metrics.notifications_sent}</code>\n"
        f"🔁 Retry Telegram: <code>{metrics.telegram_retries}</code>\n"
        f"🚨 Errori consecutivi: <code>{metrics.consecutive_error_cycles}</code>\n"
        f"⏳ Coda retry: <code>{retry_queue_size}</code>\n"
        f"⚠️ Ultimo errore: <code>{html.escape(last_error_str)}</code>\n"
        f"📉 Errori per tipo: <code>{errors_text}</code>"
    )


def has_codice_fiscale(record: OrderRecord) -> bool:
    return record.has_codice_fiscale()


def format_auto_notification(record: OrderRecord) -> str:
    prefix = "🚨 <b>NUOVO ORDINE EBAY RICEVUTO!</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
    return prefix + format_record(record)


def process_message(
    text: str,
    chat_id: int,
    telegram_config: TelegramConfig,
    ebay_environment: str,
    *,
    load_state_fn: Callable[[str], BotRuntimeState],
    load_retry_queue_fn: Callable[[str], list[RetryQueueEntry]],
    fetch_records_for_environment_fn: Callable[[str, FetchOptions], list[OrderRecord]],
    request_with_backoff_fn: Callable[..., object],
) -> list[str]:
    if not is_authorized(chat_id, telegram_config):
        return ["Chat non autorizzata per questo bot."]

    command, args = parse_command(text)
    if command in ("", "/start", "/help"):
        return [build_help_text()]

    if command == "/ping":
        return ["pong ✅"]

    if command == "/stato":
        state = load_state_fn(telegram_config.state_path)
        retry_queue_size = len(load_retry_queue_fn(telegram_config.retry_queue_path))
        return [format_status(state, retry_queue_size)]

    if command not in ("/ultimi", "/ordine", "/tutti"):
        return ["Comando non riconosciuto. Usa /help per vedere i comandi disponibili."]

    options = options_for_command(command, args)
    records = request_with_backoff_fn(
        lambda: fetch_records_for_environment_fn(ebay_environment, options),
        label=f"fetch_records_{command}",
    )
    assert isinstance(records, list)
    return format_records(records, only_found=options.only_found)
