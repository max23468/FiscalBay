"""Telegram presentation for orders."""

from __future__ import annotations

import html
import re
import urllib.parse
from typing import Iterable, Mapping

from .errors import UserInputError
from .fiscal_export import FiscalExportReport, render_fiscal_export_csv
from .models import (
    FetchOptions,
    OrderRecord,
)
from .telegram_commands import (
    TELEGRAM_CMD_MAX_DAYS,
    TELEGRAM_CMD_MAX_RESULTS,
    TELEGRAM_CMD_MIN_DAYS,
    TELEGRAM_CMD_MIN_RESULTS,
)
from .telegram_common import fiscal_identifier_label, format_order_date, format_transaction_status


def format_record(record: OrderRecord) -> str:
    raw_fiscal_value = str(record.taxpayerId or "").strip()
    fiscal_value = raw_fiscal_value.upper() if raw_fiscal_value else "non disponibile"
    fiscal_label = fiscal_identifier_label(record.taxIdentifierType)
    country = str(record.issuingCountry or "").strip().upper()
    order_id = html.escape(record.orderId)
    missing_fiscal = ""
    if not record.taxpayerId:
        missing_fiscal = (
            "\n⚠️ <i>Dati fiscali non presenti nella risposta eBay per questo ordine.</i>"
        )

    ebay_url = f"https://www.ebay.it/sh/ord/details?orderid={urllib.parse.quote(record.orderId)}"

    product_description = html.escape(record.productDescription or record.items or "N/D")
    order_quantity = html.escape(record.orderQuantity or "0")
    total = html.escape(record.total or "N/D")
    buyer = html.escape(record.buyerUsername or "n/d")
    raw_buyer_name = record.buyerName or ""
    buyer_name = html.escape(raw_buyer_name or "N/D")
    buyer_email = html.escape(record.buyerEmail or "N/D")
    transaction_status = html.escape(format_transaction_status(record.transactionStatus))
    raw_shipping = record.shippingAddress or "N/D"
    if raw_buyer_name and raw_shipping.startswith(f"{raw_buyer_name}, "):
        raw_shipping = raw_shipping[len(raw_buyer_name) + 2 :]
    shipping = html.escape(raw_shipping)
    created_at = html.escape(format_order_date(record.creationDate))
    fiscal_meta_parts = []
    if country:
        fiscal_meta_parts.append(f"<b>Paese</b>: <code>{html.escape(country)}</code>")
    fiscal_meta = " · ".join(fiscal_meta_parts)
    fiscal_meta_suffix = f"\n{fiscal_meta}" if fiscal_meta else ""

    return (
        f"🛒 <b>Ordine eBay</b>\n"
        f'🆔 <b>ID ordine</b>: <a href="{ebay_url}"><code>{order_id}</code></a>\n'
        f"📅 <b>Data</b>: <code>{created_at}</code>\n"
        f"💰 <b>Totale</b>: <code>{total}</code>\n"
        f"🔄 <b>Stato transazione</b>: <code>{transaction_status}</code>\n\n"
        f"👤 <b>Acquirente</b>: <code>{buyer}</code>\n"
        f"🧾 <b>Nome</b>: <code>{buyer_name}</code>\n"
        f"✉️ <b>Email</b>: <code>{buyer_email}</code>\n\n"
        f"📦 <b>Descrizione prodotto</b>: <code>{product_description}</code>\n"
        f"🔢 <b>Quantità ordine</b>: <code>{order_quantity}</code>\n"
        f"📍 <b>Spedizione</b>: <code>{shipping}</code>\n\n"
        f"💳 <b>{html.escape(fiscal_label)}</b>: <code>{html.escape(fiscal_value)}</code>"
        f"{fiscal_meta_suffix}"
        f"{missing_fiscal}"
    )


def format_records(
    records: Iterable[OrderRecord], only_found: bool, page_size: int = 5
) -> list[str]:
    rows = list(records)
    if not rows:
        if only_found:
            return [
                (
                    "🔎 Nessun ordine con identificativo fiscale restituito "
                    "da eBay nella selezione richiesta."
                )
            ]
        return ["🔎 Nessun ordine trovato nella selezione richiesta."]
    pages: list[str] = []
    for start in range(0, len(rows), page_size):
        page_rows = rows[start : start + page_size]
        page_no = (start // page_size) + 1
        total_pages = (len(rows) + page_size - 1) // page_size
        header = (
            "📋 <b>Ordini eBay</b>\n"
            f"<code>{len(rows)}</code> risultati · pagina <code>{page_no}/{total_pages}</code>"
        )
        body = "\n\n———\n\n".join(format_record(row) for row in page_rows)
        pages.append(header + "\n\n" + body)
    return pages


def _normalize_search_text(value: str) -> str:
    return str(value or "").strip().lower()


def order_record_matches_search(record: OrderRecord, query: str) -> bool:
    needle = _normalize_search_text(query)
    if not needle:
        return False
    fields = (
        record.orderId,
        record.buyerUsername,
        record.buyerName,
        record.buyerEmail,
        record.taxpayerId,
    )
    return any(needle in _normalize_search_text(field) for field in fields)


def looks_like_order_id(value: str) -> bool:
    raw = str(value or "").strip()
    if not raw:
        return False
    return bool(re.fullmatch(r"\d+(?:-\d+){2,}", raw))


def format_search_records(
    records: Iterable[OrderRecord],
    *,
    query: str,
    days: int,
    max_results: int,
    page_size: int = 8,
) -> list[str]:
    rows = list(records)
    escaped_query = html.escape(query)
    if not rows:
        return [
            "🔎 <b>Ricerca Ordini</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"Nessun ordine trovato per <code>{escaped_query}</code> "
            f"negli ultimi <code>{days}</code> giorni."
        ]
    pages: list[str] = []
    for start in range(0, len(rows), page_size):
        page_rows = rows[start : start + page_size]
        page_no = (start // page_size) + 1
        total_pages = (len(rows) + page_size - 1) // page_size
        lines = [
            "🔎 <b>Ricerca Ordini</b>",
            "━━━━━━━━━━━━━━━━━━━━━━━━",
            (
                f"Query: <code>{escaped_query}</code> • finestra: <code>{days}</code> giorni "
                f"• limite: <code>{max_results}</code>"
            ),
            (f"Risultati: <code>{len(rows)}</code> • pagina: <code>{page_no}/{total_pages}</code>"),
            "Usa <code>/ordini cerca &lt;order_id&gt;</code> per aprire il dettaglio.",
            "",
        ]
        for record in page_rows:
            fiscal_label = fiscal_identifier_label(record.taxIdentifierType)
            fiscal_value = record.taxpayerId.upper() if record.taxpayerId else "non disponibile"
            lines.append(
                f"• <code>{html.escape(record.orderId or 'n/d')}</code> • "
                f"<code>{html.escape(format_order_date(record.creationDate))}</code> • "
                f"buyer=<code>{html.escape(record.buyerUsername or 'n/d')}</code> • "
                f"{html.escape(fiscal_label)}=<code>{html.escape(fiscal_value)}</code>"
            )
        pages.append("\n".join(lines))
    return pages


def format_why_not_notified_status(explain: Mapping[str, object]) -> str:
    order_id = html.escape(str(explain.get("order_id") or "n/d"))
    status = html.escape(str(explain.get("status") or "unknown"))
    headline = html.escape(str(explain.get("headline") or "Stato non determinato"))
    detail = html.escape(str(explain.get("detail") or ""))
    environment = html.escape(str(explain.get("environment") or "n/d"))
    delivery_status = html.escape(str(explain.get("delivery_status") or "unknown"))
    delivery_headline = html.escape(str(explain.get("delivery_headline") or ""))
    delivery_detail = html.escape(str(explain.get("delivery_detail") or ""))
    raw_status = str(explain.get("status") or "unknown")
    raw_delivery_status = str(explain.get("delivery_status") or "unknown")

    blocking_reason = "Nessun blocco rilevato al momento."
    next_action = "Nessuna azione richiesta: l'ordine e la chat risultano pronti."
    quick_command = "<code>/settings</code>"
    if raw_status == "order_not_found":
        blocking_reason = "L'ordine non è recuperabile con il contesto attuale."
        next_action = "Controlla orderId, ambiente e account collegato, poi riprova."
        quick_command = "<code>/account</code>"
    elif raw_status == "missing_order_id":
        blocking_reason = "Manca un identificativo ordine stabile."
        next_action = "Verifica il payload sorgente: senza orderId il bot non può tracciarlo."
    elif raw_status == "not_eligible":
        blocking_reason = "L'ordine non passa i criteri di eleggibilità correnti."
        next_action = "Controlla che l'identificativo fiscale sia presente e valorizzato."
        quick_command = "<code>/ordini cerca " + order_id + "</code>"
    elif raw_status == "already_notified_order_id":
        blocking_reason = "L'ordine è già stato tracciato per orderId."
        next_action = "Non serve intervenire, a meno che tu non voglia forzare un nuovo ciclo."
        quick_command = "<code>/ordini cerca " + order_id + "</code>"
    elif raw_status == "already_notified_fingerprint":
        blocking_reason = "L'ordine collide con una fingerprint già vista."
        next_action = "Controlla i dati ordine se ti aspettavi una nuova notifica distinta."
        quick_command = "<code>/ordini cerca " + order_id + "</code>"
    elif raw_delivery_status == "chat_not_registered":
        blocking_reason = "La chat corrente non è registrata come destinazione notifiche."
        next_action = "Invia un comando da questa chat e poi verifica /settings."
        quick_command = "<code>/settings</code>"
    elif raw_delivery_status in {
        "chat_notifications_disabled",
        "chat_subscription_disabled",
        "chat_not_subscribed",
    }:
        blocking_reason = "La chat corrente non è pronta a ricevere notifiche automatiche."
        next_action = "Riattiva il recapito con <code>/settings notifiche on</code>."
        quick_command = "<code>/settings notifiche on</code>"
    elif raw_delivery_status == "delivery_ready":
        quick_command = "<code>/ordini cerca " + order_id + "</code>"

    rendered = [
        "🧭 <b>Why Not Notified</b>",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        f"🪪 Ordine: <code>{order_id}</code>",
        f"🌍 Ambiente: <code>{environment}</code>",
        f"📌 Esito ordine: <code>{status}</code>",
        f"ℹ️ {headline}",
    ]
    if detail:
        rendered.append(f"📝 Dettaglio: <code>{detail}</code>")
    rendered.append(f"📨 Esito recapito chat: <code>{delivery_status}</code>")
    if delivery_headline:
        rendered.append(f"ℹ️ {delivery_headline}")
    if delivery_detail:
        rendered.append(f"📝 Recapito: <code>{delivery_detail}</code>")
    rendered.append(f"🚫 Blocco attuale: {blocking_reason}")
    rendered.append(f"➡️ Prossima azione: {next_action}")
    rendered.append(f"⚡ Comando rapido: {quick_command}")
    return "\n".join(rendered)


def format_order_notification_summary(explain: Mapping[str, object]) -> str:
    raw_status = str(explain.get("status") or "unknown")
    raw_delivery_status = str(explain.get("delivery_status") or "unknown")
    blocking_reason = "Nessun blocco rilevato al momento."
    next_action = "Nessuna azione richiesta: l'ordine e la chat risultano pronti."

    if raw_status == "order_not_found":
        blocking_reason = "L'ordine non è recuperabile con il contesto attuale."
        next_action = "Controlla orderId, ambiente e account collegato, poi riprova."
    elif raw_status == "missing_order_id":
        blocking_reason = "Manca un identificativo ordine stabile."
        next_action = "Verifica il payload sorgente: senza orderId il bot non può tracciarlo."
    elif raw_status == "not_eligible":
        blocking_reason = "L'ordine non passa i criteri di eleggibilità correnti."
        next_action = "Controlla che l'identificativo fiscale sia presente e valorizzato."
    elif raw_status == "already_notified_order_id":
        blocking_reason = "L'ordine è già stato tracciato per orderId."
        next_action = "Non serve intervenire, a meno che tu non voglia forzare un nuovo ciclo."
    elif raw_status == "already_notified_fingerprint":
        blocking_reason = "L'ordine collide con una fingerprint già vista."
        next_action = "Controlla i dati ordine se ti aspettavi una nuova notifica distinta."
    elif raw_delivery_status == "chat_not_registered":
        blocking_reason = "La chat corrente non è registrata come destinazione notifiche."
        next_action = "Invia un comando da questa chat e poi verifica /settings."
    elif raw_delivery_status in {
        "chat_notifications_disabled",
        "chat_subscription_disabled",
        "chat_not_subscribed",
    }:
        blocking_reason = "La chat corrente non è pronta a ricevere notifiche automatiche."
        next_action = "Riattiva il recapito con <code>/settings notifiche on</code>."

    status = html.escape(raw_status)
    delivery_status = html.escape(raw_delivery_status)
    return (
        "🧭 <b>Notificabilità</b>\n"
        f"📌 Esito ordine: <code>{status}</code>\n"
        f"📨 Esito recapito: <code>{delivery_status}</code>\n"
        f"🚫 Blocco attuale: {blocking_reason}\n"
        f"➡️ Prossima azione: {next_action}"
    )


def format_orders_command_help() -> str:
    return (
        "📦 <b>Ordini</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Usa <code>/ordini</code> come centro unico per consultare e spiegare gli ordini.\n"
        "• <code>/ordini fiscali [giorni] [max]</code> → ordini con identificativo fiscale\n"
        "• <code>/ordini tutti [giorni] [max]</code> → tutti gli ordini recenti\n"
        "• <code>/ordini cerca &lt;order_id&gt;</code> → dettaglio ordine\n"
        "• <code>/ordini cerca &lt;testo&gt; [giorni] [max]</code> "
        "→ cerca buyer, email, CF o P.IVA\n"
        "• <code>/ordini controlla [giorni] [max]</code> → ordini senza dato fiscale\n"
        "• <code>/ordini report [giorni] [max]</code> → riepilogo fiscale compatto\n"
        "• <code>/ordini priorita [giorni] [max]</code> → casi ordinati per priorità\n"
        "• <code>/ordini export [giorni] [max]</code> → export CSV fiscale\n"
        "• <code>/ordini spiega &lt;order_id&gt;</code> → spiega la notificabilità\n"
        "Esempio: <code>/ordini fiscali 7 20</code>."
    )


def _split_csv_for_telegram(csv_content: str, *, max_chars: int = 2800) -> list[str]:
    lines = csv_content.splitlines() or [""]
    header = lines[0]
    chunks: list[str] = []
    current = [header]
    for line in lines[1:]:
        candidate = "\n".join([*current, line])
        if len(candidate) > max_chars and len(current) > 1:
            chunks.append("\n".join(current))
            current = [header, line]
        else:
            current.append(line)
    chunks.append("\n".join(current))
    return chunks


def format_fiscal_export_messages(report: FiscalExportReport) -> list[str]:
    summary = (
        "📄 <b>Export Fiscale Venditore</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Periodo: <code>{html.escape(report.period_start or 'N/D')}</code> → "
        f"<code>{html.escape(report.period_end or 'N/D')}</code>\n"
        f"Ordini esportati: <code>{report.total_orders}</code>\n"
        f"Con dato fiscale: <code>{report.with_fiscal_identifier}</code>\n"
        f"Senza dato fiscale: <code>{report.missing_fiscal_identifier}</code>\n"
        f"Generato: <code>{html.escape(report.generated_at)}</code>"
    )
    csv_chunks = _split_csv_for_telegram(render_fiscal_export_csv(report))
    messages: list[str] = [summary]
    total_chunks = len(csv_chunks)
    for index, chunk in enumerate(csv_chunks, start=1):
        messages.append(
            "📎 <b>CSV export</b> "
            f"parte <code>{index}</code>/<code>{total_chunks}</code>\n"
            f"<pre>{html.escape(chunk)}</pre>"
        )
    return messages


def format_review_records(records: Iterable[OrderRecord], page_size: int = 8) -> list[str]:
    rows = list(records)
    if not rows:
        return [
            "🗂️ <b>Ordini Da Controllare</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Nessun ordine recente da controllare manualmente: "
            "quelli trovati hanno già un dato fiscale."
        ]
    pages: list[str] = []
    for start in range(0, len(rows), page_size):
        page_rows = rows[start : start + page_size]
        page_no = (start // page_size) + 1
        total_pages = (len(rows) + page_size - 1) // page_size
        lines = [
            "🗂️ <b>Ordini Da Controllare</b>",
            "━━━━━━━━━━━━━━━━━━━━━━━━",
            (
                f"📦 Totale da rivedere: <code>{len(rows)}</code> • "
                f"📄 Pagina: <code>{page_no}/{total_pages}</code>"
            ),
            "Usa <code>/ordini cerca &lt;order_id&gt;</code> per aprire il dettaglio di un caso.",
            "",
        ]
        for record in page_rows:
            order_id = html.escape(record.orderId or "n/d")
            buyer = html.escape(record.buyerUsername or "n/d")
            created_at = html.escape(record.creationDate or "n/d")
            lines.append(
                f"• <code>{order_id}</code> • <code>{created_at}</code> • "
                f"buyer=<code>{buyer}</code> • motivo=<code>dato_fiscale_mancante</code>"
            )
        pages.append("\n".join(lines))
    return pages


def format_report_summary(records: Iterable[OrderRecord], *, days: int, max_results: int) -> str:
    rows = list(records)
    vat_count = 0
    cf_count = 0
    missing_count = 0
    foreign_count = 0
    for record in rows:
        identifier_type = str(record.taxIdentifierType or "").strip().upper()
        if not record.has_fiscal_identifier():
            missing_count += 1
        elif identifier_type == "VAT_NUMBER":
            vat_count += 1
        elif identifier_type == "CODICE_FISCALE":
            cf_count += 1
        else:
            cf_count += 1
        if str(record.issuingCountry or "").strip().upper() not in {"", "IT"}:
            foreign_count += 1
    action_hint = (
        "Apri <code>/ordini priorita</code> per vedere i casi più rilevanti."
        if rows
        else "Nessun dato disponibile: riprova più tardi o amplia la finestra."
    )
    return (
        "📈 <b>Mini Report Fiscale</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🗓️ Finestra: <code>{days}</code> giorni • limite: <code>{max_results}</code>\n"
        f"📦 Ordini analizzati: <code>{len(rows)}</code>\n"
        f"🧾 Con P.IVA: <code>{vat_count}</code>\n"
        f"🪪 Con CF: <code>{cf_count}</code>\n"
        f"🕳️ Senza dato fiscale: <code>{missing_count}</code>\n"
        f"🌍 Paese emissione non IT: <code>{foreign_count}</code>\n"
        f"➡️ Prossima azione: {action_hint}"
    )


def format_priority_records(records: Iterable[OrderRecord], page_size: int = 8) -> list[str]:
    rows = list(records)
    if not rows:
        return [
            "🚦 <b>Ordini Prioritari</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Nessun ordine disponibile nella selezione richiesta."
        ]

    def priority_key(record: OrderRecord) -> tuple[int, str]:
        identifier_type = str(record.taxIdentifierType or "").strip().upper()
        if not record.has_fiscal_identifier():
            return (0, record.creationDate or "")
        if identifier_type == "VAT_NUMBER":
            return (1, record.creationDate or "")
        if identifier_type == "CODICE_FISCALE":
            return (2, record.creationDate or "")
        return (3, record.creationDate or "")

    ordered = sorted(rows, key=priority_key)
    pages: list[str] = []
    for start in range(0, len(ordered), page_size):
        page_rows = ordered[start : start + page_size]
        page_no = (start // page_size) + 1
        total_pages = (len(ordered) + page_size - 1) // page_size
        lines = [
            "🚦 <b>Ordini Prioritari</b>",
            "━━━━━━━━━━━━━━━━━━━━━━━━",
            (
                f"📦 Totale: <code>{len(ordered)}</code> • "
                f"📄 Pagina: <code>{page_no}/{total_pages}</code>"
            ),
            (
                "Legenda: <code>review</code> dato mancante • "
                "<code>high</code> P.IVA • <code>medium</code> CF"
            ),
            "",
        ]
        for record in page_rows:
            identifier_type = str(record.taxIdentifierType or "").strip().upper()
            if not record.has_fiscal_identifier():
                level = "review"
                reason = "dato_fiscale_mancante"
            elif identifier_type == "VAT_NUMBER":
                level = "high"
                reason = "piva_presente"
            elif identifier_type == "CODICE_FISCALE":
                level = "medium"
                reason = "cf_presente"
            else:
                level = "medium"
                reason = "id_fiscale_presente"
            lines.append(
                f"• <code>{html.escape(record.orderId or 'n/d')}</code> • "
                f"prio=<code>{level}</code> • motivo=<code>{reason}</code> • "
                f"buyer=<code>{html.escape(record.buyerUsername or 'n/d')}</code>"
            )
        pages.append("\n".join(lines))
    return pages


def options_for_command(command: str, args: list[str]) -> FetchOptions:
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
    return FetchOptions(
        days=days,
        max_results=max_results,
        only_found=only_found,
        include_details=only_found,
    )


def has_fiscal_identifier(record: OrderRecord) -> bool:
    return record.has_fiscal_identifier()


def format_auto_notification(record: OrderRecord) -> str:
    prefix = "🚨 <b>Nuovo ordine eBay</b>\n\n"
    return prefix + format_record(record)


def format_missing_tax_spike_alert(
    records: Iterable[OrderRecord],
    *,
    threshold_missing: int,
    threshold_percent: int,
) -> str:
    rows = list(records)
    missing = [record for record in rows if not record.has_fiscal_identifier()]
    total = len(rows)
    percent = round((len(missing) / total) * 100) if total else 0
    examples = missing[:5]
    example_lines = []
    for record in examples:
        example_lines.append(
            f"• <code>{html.escape(record.orderId or 'n/d')}</code> • "
            f"<code>{html.escape(format_order_date(record.creationDate))}</code> • "
            f"buyer=<code>{html.escape(record.buyerUsername or 'n/d')}</code>"
        )
    examples_text = "\n".join(example_lines) if example_lines else "Nessun esempio disponibile."
    return (
        "⚠️ <b>Spike ordini senza dato fiscale</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"📦 Ordini letti nella finestra: <code>{total}</code>\n"
        f"🕳️ Senza dato fiscale: <code>{len(missing)}</code> "
        f"(<code>{percent}%</code>)\n"
        f"🎚️ Soglia alert: almeno <code>{threshold_missing}</code> ordini e "
        f"<code>{threshold_percent}%</code> della finestra.\n"
        "ℹ️ FiscalBay non deduce dati assenti: segnala solo che eBay non li ha "
        "restituiti in questa finestra.\n\n"
        f"{examples_text}\n\n"
        "➡️ Prossima azione: usa <code>/ordini controlla 7 50</code> "
        "o <code>/ordini report 7 50</code>."
    )
