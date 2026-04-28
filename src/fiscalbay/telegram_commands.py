"""Telegram command parsing and response formatting helpers."""

from __future__ import annotations

import html
import json
import urllib.parse
from datetime import datetime
from typing import Callable, Iterable, Mapping
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .clients.telegram import InlineKeyboardMarkup
from .errors import UserInputError
from .models import (
    BotRuntimeState,
    FetchOptions,
    OrderRecord,
    RetryQueueEntry,
    TelegramConfig,
    TelegramUser,
    is_blocked_telegram_user_status,
    is_pending_telegram_user_status,
    normalize_telegram_user_status,
)

TELEGRAM_CMD_MAX_DAYS = 365
TELEGRAM_CMD_MIN_DAYS = 1
TELEGRAM_CMD_MAX_RESULTS = 500
TELEGRAM_CMD_MIN_RESULTS = 1

CALLBACK_ORDINI = "menu:ordini"
CALLBACK_ORDINI_FISCALI = "menu:ordini:fiscali"
CALLBACK_ORDINI_TUTTI = "menu:ordini:tutti"
CALLBACK_ULTIMI = CALLBACK_ORDINI_FISCALI
CALLBACK_TUTTI = CALLBACK_ORDINI_TUTTI
CALLBACK_STATO = "menu:stato"
CALLBACK_HELP = "menu:help"
CALLBACK_OTHER_ACTIONS = "menu:other_actions"
CALLBACK_ACCOUNT = "menu:account"
CALLBACK_CONNECT = "menu:connect"
CALLBACK_DISCONNECT = "menu:disconnect"
CALLBACK_SETTINGS = "menu:settings"
CALLBACK_NOTIFICATIONS_ON = "menu:notifications_on"
CALLBACK_NOTIFICATIONS_OFF = "menu:notifications_off"
CALLBACK_ORDINI_REVIEW = "menu:ordini:review"
CALLBACK_ORDINI_REPORT = "menu:ordini:report"
CALLBACK_ORDINI_PRIORITY = "menu:ordini:priority"
CALLBACK_ADMIN_DASHBOARD = "menu:admin:dashboard"
CALLBACK_ADMIN_USERS_PENDING = "menu:admin_users:pending"
CALLBACK_ADMIN_USERS_RECONNECT = "menu:admin_users:reconnect"
CALLBACK_ADMIN_MAINTENANCE = "menu:admin:maintenance"
CALLBACK_REQUEST_ACCESS = "access:request"
CALLBACK_APPROVE_PREFIX = "access:approve:"
CALLBACK_REJECT_PREFIX = "access:reject:"

BOT_DISPLAY_NAME = "FiscalBay"
BOT_TAGLINE = "Assistente fiscale ordini per venditori eBay"
BOT_LONG_DESCRIPTION = (
    "Controlla identificativi fiscali, stato account e ordini eBay da un'unica chat."
)


def fiscal_identifier_label(tax_identifier_type: str) -> str:
    normalized = str(tax_identifier_type or "").strip().upper()
    if normalized == "CODICE_FISCALE":
        return "CF"
    if normalized == "VAT_NUMBER":
        return "P.IVA"
    return "ID Fiscale"


def fiscal_identifier_type_label(tax_identifier_type: str) -> str:
    normalized = str(tax_identifier_type or "").strip().upper()
    if normalized == "CODICE_FISCALE":
        return "Codice fiscale"
    if normalized == "VAT_NUMBER":
        return "Partita IVA"
    if normalized:
        return normalized.replace("_", " ").lower().capitalize()
    return ""


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


def format_record(record: OrderRecord) -> str:
    fiscal_value = record.taxpayerId or "non disponibile"
    fiscal_label = fiscal_identifier_label(record.taxIdentifierType)
    tax_type = fiscal_identifier_type_label(record.taxIdentifierType)
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
    if tax_type:
        fiscal_meta_parts.append(f"🏷️ <b>Tipo</b>: {html.escape(tax_type)}")
    if country:
        fiscal_meta_parts.append(f"<b>Paese</b>: <code>{html.escape(country)}</code>")
    fiscal_meta = " · ".join(fiscal_meta_parts)
    fiscal_meta_suffix = f"\n{fiscal_meta}" if fiscal_meta else ""

    return (
        f'🛒 <b>Ordine</b> <a href="{ebay_url}"><code>{order_id}</code></a>\n'
        f"📅 <b>Data</b>: <code>{created_at}</code> · "
        f"💰 <b>Totale</b>: <code>{total}</code>\n"
        f"🔄 <b>Stato transazione</b>: <code>{transaction_status}</code>\n\n"
        f"👤 <b>Acquirente</b>: <code>{buyer}</code>\n"
        f"🧾 <b>Nome completo</b>: <code>{buyer_name}</code>\n"
        f"✉️ <b>Email</b>: <code>{buyer_email}</code>\n\n"
        f"📦 <b>Descrizione prodotto</b>: <i>{product_description}</i>\n"
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


def parse_command(text: str) -> tuple[str, list[str]]:
    parts = text.strip().split()
    if not parts:
        return "", []
    command = parts[0].split("@", 1)[0].lower()
    return command, parts[1:]


def build_help_text(*, is_admin: bool = False) -> str:
    admin_lines = ""
    if is_admin:
        admin_lines = (
            "\n<b>Area admin</b>\n"
            "• 🧭 <code>/admin</code> → cruscotto operativo\n"
            "• 👥 <code>/admin_users</code> → utenti e richieste accesso\n"
            "• 🩺 <code>/tenant_health [user_id]</code> → salute tenant\n"
            "• 🟢 <code>/ping</code> → diagnostica rapida bot\n"
            "Dettagli admin: <code>/admin help</code>\n"
        )
    return (
        f"🤖 <b>Benvenuto in {BOT_DISPLAY_NAME}</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"<i>{BOT_TAGLINE}</i>\n\n"
        "Esperienza consigliata: usa i pulsanti rapidi del bot per muoverti tra "
        "collegamento account, stato e notifiche senza ricordare ogni comando.\n\n"
        "Comandi principali:\n"
        "• 📊 <code>/stato</code> → stato bot e servizio\n"
        "• 👤 <code>/account</code> → stato account eBay e azioni collegamento\n"
        "• 📦 <code>/ordini</code> → centro ordini e riepilogo azioni disponibili\n"
        "• 🧩 <code>/altre_azioni</code> → guida, preferenze e accesso\n"
        f"{admin_lines}\n"
        "<b>Guide dettagliate</b>\n"
        "• <code>/ordini</code> → tutte le azioni su ordini, report e notificabilita'\n"
        "• <code>/settings</code> → preferenze chat e notifiche\n"
        "• <code>/request_access</code> → richiede accesso all'admin del bot\n"
        + ("• <code>/admin help</code> → comandi admin e gestione accessi\n" if is_admin else "")
        + "\n<b>Esempi rapidi</b>\n"
        "• <code>/account collega</code>\n"
        "• <code>/ordini fiscali 7 20</code>\n"
        "• <code>/settings notifiche on</code>\n\n"
        f"<i>Limiti input: giorni {TELEGRAM_CMD_MIN_DAYS}-{TELEGRAM_CMD_MAX_DAYS}, "
        f"max ordini {TELEGRAM_CMD_MIN_RESULTS}-{TELEGRAM_CMD_MAX_RESULTS}.</i>"
    )


def build_other_actions_text(*, is_admin: bool = False) -> str:
    admin_lines = ""
    if is_admin:
        admin_lines = (
            "\n<b>Admin</b>\n"
            "• <code>/admin</code> → dashboard operativa\n"
            "• <code>/admin_users</code> → utenti e richieste accesso\n"
            "• <code>/tenant_health [user_id]</code> → salute tenant\n"
        )
    return (
        "🧩 <b>Altre azioni</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Qui trovi le azioni lasciate fuori dal menu comandi principale.\n\n"
        "<b>Guida e accesso</b>\n"
        "• <code>/help</code> → guida rapida\n"
        "• <code>/request_access</code> → richiede accesso all'admin del bot\n\n"
        "<b>Preferenze</b>\n"
        "• <code>/settings</code> → preferenze chat e tenant\n"
        "• <code>/settings notifiche on</code> → attiva notifiche\n"
        "• <code>/settings notifiche off</code> → disattiva notifiche\n"
        "• <code>/settings filtro all|cf|vat</code> → filtro notifiche\n"
        f"{admin_lines}"
    )


def build_telegram_branding_profile() -> dict[str, object]:
    return {
        "name": BOT_DISPLAY_NAME,
        "short_description": BOT_TAGLINE,
        "description": BOT_LONG_DESCRIPTION,
        "commands": [
            {"command": "stato", "description": "Stato bot e servizio"},
            {"command": "account", "description": "Controlla stato account eBay"},
            {"command": "ordini", "description": "Consulta ordini e riepiloghi fiscali"},
            {"command": "altre_azioni", "description": "Guida, preferenze e accesso"},
        ],
    }


def build_start_text(
    *,
    user_status: str,
    is_admin: bool = False,
    account_status: Mapping[str, object] | None = None,
) -> str:
    private_only_note = (
        "\n\n<i>Uso supportato: solo chat privata con il bot, non gruppi o supergruppi.</i>"
    )
    if is_admin:
        return (
            f"👑 <b>Benvenuto in {BOT_DISPLAY_NAME}</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "<i>Console admin per accessi, account e flusso ordini eBay</i>\n"
            "Il tuo account Telegram e' riconosciuto come admin globale.\n"
            "Puoi approvare utenti con <code>/admin_users pending</code>, "
            "<code>/approve_user</code> "
            "e <code>/reject_user</code>.\n"
            "Per la vista prodotto usa <code>/admin</code>; "
            "per backlog e cleanup usa <code>/admin manutenzione</code>; "
            "per i tenant da seguire usa <code>/admin_users reconnect</code>.\n"
            "Per il tuo uso operativo puoi controllare <code>/account</code>, "
            "<code>/account collega</code> e gli ordini recenti con <code>/ordini</code>.\n"
            "Usa i pulsanti qui sotto per passare rapidamente tra stato, account e impostazioni."
            f"{private_only_note}"
        )

    canonical_status = normalize_telegram_user_status(user_status)
    if canonical_status in {"new", "pending", "blocked"}:
        return format_access_required_status(canonical_status) + private_only_note

    summary = account_status or {}
    raw_account_status = str(summary.get("account_status") or "unlinked")
    raw_token_status = str(summary.get("token_status") or "missing")
    ebay_user_id = html.escape(str(summary.get("ebay_user_id") or "n/d"))
    environment = html.escape(str(summary.get("environment") or "n/d"))

    if raw_account_status in {"disconnected", "revoked"}:
        return (
            f"👋 <b>Benvenuto in {BOT_DISPLAY_NAME}</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "<i>Controlla identificativi fiscali, account e ordini eBay</i>\n"
            "Il tuo ultimo account eBay risulta in stato "
            f"<code>{html.escape(raw_account_status)}</code>.\n"
            "Ultimo utente noto: "
            f"<code>{ebay_user_id}</code> • ambiente: <code>{environment}</code>\n"
            "Prossimo passo: usa <code>/account collega</code> per collegare di nuovo l'account.\n"
            "Dopo il reconnect potrai tornare subito a <code>/account</code> o "
            "<code>/ordini fiscali</code>."
            f"{private_only_note}"
        )

    if raw_token_status in {"revoked", "expired", "token_expired"}:
        return (
            f"👋 <b>Benvenuto in {BOT_DISPLAY_NAME}</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "<i>Controlla identificativi fiscali, account e ordini eBay</i>\n"
            "Il tuo account eBay risulta collegato, ma il token non e' piu' utilizzabile.\n"
            f"Utente eBay: <code>{ebay_user_id}</code> • ambiente: <code>{environment}</code>\n"
            "Prossimo passo: usa <code>/account collega</code> per completare il reconnect.\n"
            "Se vuoi capire meglio il problema puoi controllare anche "
            "<code>/account reconnect</code>."
            f"{private_only_note}"
        )

    if raw_account_status != "linked":
        return (
            f"👋 <b>Benvenuto in {BOT_DISPLAY_NAME}</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "<i>Controlla identificativi fiscali, account e ordini eBay</i>\n"
            "Il tuo accesso e' approvato, ma non hai ancora collegato un account eBay.\n"
            "Percorso consigliato:\n"
            "1. usa <code>/account collega</code>\n"
            "2. controlla <code>/account</code>\n"
            "3. prova <code>/ordini fiscali</code> per i primi risultati"
            f"{private_only_note}"
        )

    return (
        f"✅ <b>Benvenuto in {BOT_DISPLAY_NAME}</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"<i>{BOT_TAGLINE}</i>\n"
        "Il tuo accesso e' attivo e l'account eBay risulta collegato.\n"
        f"Utente eBay: <code>{ebay_user_id}</code> • ambiente: <code>{environment}</code>\n"
        "Prossimi passi consigliati: controlla <code>/ordini fiscali</code>, verifica "
        "<code>/account</code> e gestisci recapito con <code>/settings notifiche on</code>."
        f"{private_only_note}"
    )


def build_main_menu_markup(
    *,
    account_linked: bool = True,
    reconnect_required: bool = False,
    notifications_enabled: bool = True,
) -> InlineKeyboardMarkup:
    connect_label = "Ricollega eBay" if reconnect_required else "Collega eBay"
    account_row = [
        {"text": connect_label, "callback_data": CALLBACK_CONNECT},
        {"text": "Account", "callback_data": CALLBACK_ACCOUNT},
    ]
    orders_row = [
        {"text": "Ordini fiscali", "callback_data": CALLBACK_ULTIMI},
        {"text": "Tutti ordini", "callback_data": CALLBACK_TUTTI},
    ]
    status_row = [
        {"text": "Stato", "callback_data": CALLBACK_STATO},
        {"text": "Altre azioni", "callback_data": CALLBACK_OTHER_ACTIONS},
    ]

    return {
        "inline_keyboard": [
            account_row,
            orders_row,
            status_row,
        ]
    }


def build_contextual_menu_markup(
    command: str,
    *,
    account_linked: bool = True,
    reconnect_required: bool = False,
    notifications_enabled: bool = True,
    is_admin: bool = False,
) -> InlineKeyboardMarkup:
    command_name, _ = parse_command(command)
    connect_label = "Ricollega eBay" if reconnect_required else "Collega eBay"
    notification_label = "Disattiva notifiche" if notifications_enabled else "Attiva notifiche"
    notification_callback = (
        CALLBACK_NOTIFICATIONS_OFF if notifications_enabled else CALLBACK_NOTIFICATIONS_ON
    )

    if is_admin and command_name in {
        "/admin",
        "/admin_users",
        "/tenant_health",
        "/approve_user",
        "/reject_user",
        "/suspend_user",
        "/reactivate_user",
        "/service_mode",
    }:
        return {
            "inline_keyboard": [
                [
                    {"text": "Dashboard", "callback_data": CALLBACK_ADMIN_DASHBOARD},
                    {"text": "Pending", "callback_data": CALLBACK_ADMIN_USERS_PENDING},
                ],
                [
                    {"text": "Reconnect", "callback_data": CALLBACK_ADMIN_USERS_RECONNECT},
                    {"text": "Manutenzione", "callback_data": CALLBACK_ADMIN_MAINTENANCE},
                ],
                [
                    {"text": "Stato", "callback_data": CALLBACK_STATO},
                    {"text": "Guida", "callback_data": CALLBACK_HELP},
                ],
            ]
        }

    if command_name in {"/ordini", "/ultimi", "/tutti", "/ordine", "/why_not_notified"}:
        return {
            "inline_keyboard": [
                [
                    {"text": "Ordini fiscali", "callback_data": CALLBACK_ULTIMI},
                    {"text": "Tutti ordini", "callback_data": CALLBACK_TUTTI},
                ],
                [
                    {"text": "Da controllare", "callback_data": CALLBACK_ORDINI_REVIEW},
                    {"text": "Report", "callback_data": CALLBACK_ORDINI_REPORT},
                ],
                [
                    {"text": "Priorita'", "callback_data": CALLBACK_ORDINI_PRIORITY},
                    {"text": "Account", "callback_data": CALLBACK_ACCOUNT},
                ],
                [{"text": "Guida", "callback_data": CALLBACK_HELP}],
            ]
        }

    if command_name in {"/account", "/connect", "/disconnect", "/reconnect_status"}:
        notification_row = [
            {"text": notification_label, "callback_data": notification_callback},
            {"text": "Preferenze", "callback_data": CALLBACK_SETTINGS},
        ]
        account_actions = [
            {"text": connect_label, "callback_data": CALLBACK_CONNECT},
            {"text": "Account", "callback_data": CALLBACK_ACCOUNT},
        ]
        if account_linked:
            account_actions = [
                {"text": connect_label, "callback_data": CALLBACK_CONNECT},
                {"text": "Scollega", "callback_data": CALLBACK_DISCONNECT},
            ]
        return {
            "inline_keyboard": [
                account_actions,
                [
                    {"text": "Ordini fiscali", "callback_data": CALLBACK_ULTIMI},
                    {"text": "Stato", "callback_data": CALLBACK_STATO},
                ],
                notification_row,
                [{"text": "Guida", "callback_data": CALLBACK_HELP}],
            ]
        }

    if command_name in {"/settings", "/notifications", "/policy", "/leave_bot"}:
        return {
            "inline_keyboard": [
                [
                    {"text": notification_label, "callback_data": notification_callback},
                    {"text": "Stato", "callback_data": CALLBACK_STATO},
                ],
                [
                    {"text": "Account", "callback_data": CALLBACK_ACCOUNT},
                    {"text": "Ordini fiscali", "callback_data": CALLBACK_ULTIMI},
                ],
                [{"text": "Guida", "callback_data": CALLBACK_HELP}],
            ]
        }

    if command_name == "/altre_azioni":
        keyboard = [
            [
                {"text": "Preferenze", "callback_data": CALLBACK_SETTINGS},
                {"text": "Guida", "callback_data": CALLBACK_HELP},
            ],
            [
                {"text": notification_label, "callback_data": notification_callback},
                {"text": "Richiedi accesso", "callback_data": CALLBACK_REQUEST_ACCESS},
            ],
            [
                {"text": "Stato", "callback_data": CALLBACK_STATO},
                {"text": "Account", "callback_data": CALLBACK_ACCOUNT},
            ],
        ]
        if account_linked:
            keyboard.append([{"text": "Scollega", "callback_data": CALLBACK_DISCONNECT}])
        return {"inline_keyboard": keyboard}

    if command_name in {"/stato", "/service_status", "/ping"}:
        return {
            "inline_keyboard": [
                [
                    {"text": "Account", "callback_data": CALLBACK_ACCOUNT},
                    {"text": "Ordini fiscali", "callback_data": CALLBACK_ULTIMI},
                ],
                [
                    {"text": "Preferenze", "callback_data": CALLBACK_SETTINGS},
                    {"text": "Guida", "callback_data": CALLBACK_HELP},
                ],
            ]
        }

    return build_main_menu_markup(
        account_linked=account_linked,
        reconnect_required=reconnect_required,
        notifications_enabled=notifications_enabled,
    )


def callback_command_from_data(data: str) -> str | None:
    normalized = data.strip()
    mapping = {
        CALLBACK_ORDINI: "/ordini",
        CALLBACK_ULTIMI: "/ordini fiscali 7 20",
        CALLBACK_TUTTI: "/ordini tutti 7 20",
        CALLBACK_ORDINI_REVIEW: "/ordini controlla 7 20",
        CALLBACK_ORDINI_REPORT: "/ordini report 7 20",
        CALLBACK_ORDINI_PRIORITY: "/ordini priorita 7 20",
        CALLBACK_STATO: "/stato",
        CALLBACK_OTHER_ACTIONS: "/altre_azioni",
        CALLBACK_ACCOUNT: "/account",
        CALLBACK_CONNECT: "/account collega",
        CALLBACK_DISCONNECT: "/account scollega",
        CALLBACK_SETTINGS: "/settings",
        CALLBACK_NOTIFICATIONS_ON: "/settings notifiche on",
        CALLBACK_NOTIFICATIONS_OFF: "/settings notifiche off",
        CALLBACK_ADMIN_DASHBOARD: "/admin",
        CALLBACK_ADMIN_USERS_PENDING: "/admin_users pending",
        CALLBACK_ADMIN_USERS_RECONNECT: "/admin_users reconnect",
        CALLBACK_ADMIN_MAINTENANCE: "/admin manutenzione",
        CALLBACK_REQUEST_ACCESS: "/request_access",
        CALLBACK_HELP: "/help",
    }
    if normalized.startswith(CALLBACK_APPROVE_PREFIX):
        telegram_user_id = normalized.removeprefix(CALLBACK_APPROVE_PREFIX)
        if telegram_user_id:
            return f"/approve_user {telegram_user_id}"
    if normalized.startswith(CALLBACK_REJECT_PREFIX):
        telegram_user_id = normalized.removeprefix(CALLBACK_REJECT_PREFIX)
        if telegram_user_id:
            return f"/reject_user {telegram_user_id}"
    return mapping.get(normalized)


def should_attach_main_menu(command: str) -> bool:
    return command in (
        "",
        "/start",
        "/help",
        "/altre_azioni",
        "/ping",
        "/stato",
        "/account",
        "/connect",
        "/disconnect",
        "/ordini",
        "/notifications",
        "/settings",
        "/admin",
        "/admin_users",
        "/tenant_health",
        "/approve_user",
        "/reject_user",
        "/suspend_user",
        "/reactivate_user",
        "/service_mode",
    )


def build_access_request_markup() -> InlineKeyboardMarkup:
    return {
        "inline_keyboard": [
            [
                {
                    "text": "Richiedi accesso",
                    "callback_data": CALLBACK_REQUEST_ACCESS,
                },
                {"text": "Guida", "callback_data": CALLBACK_HELP},
            ],
        ]
    }


def build_admin_approval_markup(telegram_user_id: int) -> InlineKeyboardMarkup:
    return {
        "inline_keyboard": [
            [
                {
                    "text": "Approva",
                    "callback_data": f"{CALLBACK_APPROVE_PREFIX}{telegram_user_id}",
                },
                {
                    "text": "Rifiuta",
                    "callback_data": f"{CALLBACK_REJECT_PREFIX}{telegram_user_id}",
                },
            ]
        ]
    }


def format_access_required_status(user_status: str, *, is_admin: bool = False) -> str:
    canonical_status = normalize_telegram_user_status(user_status)
    if is_admin:
        return (
            "👑 <b>Admin del bot</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Il tuo account Telegram e' riconosciuto come admin globale."
        )
    if is_pending_telegram_user_status(canonical_status):
        return (
            "⏳ <b>Accesso in attesa</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "La tua richiesta e' gia' in attesa di approvazione da parte dell'admin.\n"
            "Quando verrai approvato potrai usare <code>/account collega</code> "
            "e gli altri comandi."
        )
    if is_blocked_telegram_user_status(canonical_status):
        return (
            "⛔ <b>Accesso non approvato</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Il tuo accesso al bot e' stato rifiutato o bloccato.\n"
            "Contatta l'admin se ritieni che sia un errore."
        )
    return (
        "🙋 <b>Accesso richiesto</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Questo bot usa un accesso approvato dall'admin.\n"
        "Usa <code>/request_access</code> per inviare la tua richiesta.\n"
        "Dopo l'approvazione potrai collegare eBay direttamente da Telegram."
    )


def format_access_request_status(
    *,
    already_pending: bool = False,
    admin_notified: bool = False,
    blocked: bool = False,
) -> str:
    if blocked:
        return (
            "⛔ <b>Richiesta accesso</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Il tuo account risulta bloccato o rifiutato.\n"
            "Contatta l'admin per una nuova valutazione."
        )
    if already_pending:
        return (
            "⏳ <b>Richiesta accesso</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "La tua richiesta e' gia' in attesa di approvazione."
        )
    if admin_notified:
        return (
            "✅ <b>Richiesta inviata</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "L'admin e' stato notificato. Ti scrivera' il bot appena l'accesso verra' approvato."
        )
    return (
        "✅ <b>Richiesta registrata</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "La tua richiesta e' stata salvata, ma l'admin non e' ancora "
        "raggiungibile da questa istanza."
    )


def format_admin_access_request(
    *,
    telegram_user_id: int,
    username: str,
    display_name: str,
    chat_id: int,
) -> str:
    safe_username = html.escape(username or "n/d")
    safe_display_name = html.escape(display_name or "n/d")
    return (
        "🙋 <b>Nuova richiesta accesso</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🆔 Telegram user: <code>{telegram_user_id}</code>\n"
        f"👤 Username: <code>{safe_username}</code>\n"
        f"🏷️ Nome: <code>{safe_display_name}</code>\n"
        f"💬 Chat iniziale: <code>{chat_id}</code>\n"
        "Usa i pulsanti qui sotto per approvare o rifiutare l'accesso."
    )


def format_admin_user_list(
    users: Iterable[Mapping[str, object] | TelegramUser],
    *,
    title: str = "👥 <b>Utenti bot</b>",
    empty_message: str = "Nessun utente registrato nel database.",
) -> str:
    rows = list(users)
    if not rows:
        return f"{title}\n━━━━━━━━━━━━━━━━━━━━━━━━\n{empty_message}"
    if all(isinstance(row, TelegramUser) for row in rows):
        rendered: list[str] = []
        for raw_user in rows:
            user = (
                raw_user
                if isinstance(raw_user, TelegramUser)
                else TelegramUser.from_mapping(raw_user)
            )
            username = html.escape(user.username or "n/d")
            display_name = html.escape(user.display_name or "n/d")
            rendered.append(
                f"• <code>{user.telegram_user_id}</code> "
                f"status=<code>{html.escape(user.status)}</code> "
                f"chat=<code>{user.telegram_chat_id}</code> "
                f"user=<code>{username}</code> "
                f"name=<code>{display_name}</code>"
            )
        return title + "\n━━━━━━━━━━━━━━━━━━━━━━━━\n" + "\n".join(rendered)

    def render_user_line(user_row: Mapping[str, object]) -> str:
        telegram_user_id = html.escape(str(user_row.get("telegram_user_id") or "n/d"))
        username = html.escape(str(user_row.get("username") or "n/d"))
        display_name = html.escape(str(user_row.get("display_name") or "n/d"))
        account_status = html.escape(str(user_row.get("account_status") or "unlinked"))
        token_status = html.escape(str(user_row.get("token_status") or "missing"))
        environment = html.escape(str(user_row.get("environment") or "n/d"))
        ebay_user_id = html.escape(str(user_row.get("ebay_user_id") or "n/d"))
        return (
            f"• <code>{telegram_user_id}</code> "
            f"user=<code>{username}</code> "
            f"name=<code>{display_name}</code> "
            f"account=<code>{account_status}</code> "
            f"token=<code>{token_status}</code> "
            f"env=<code>{environment}</code> "
            f"ebay=<code>{ebay_user_id}</code>"
        )

    pending_rows: list[str] = []
    waiting_connect_rows: list[str] = []
    reconnect_rows: list[str] = []
    ready_rows: list[str] = []
    blocked_rows: list[str] = []
    admin_rows: list[str] = []

    for user_row in rows:
        status = str(user_row.get("status") or "")
        operational_state = str(user_row.get("operational_state") or "")
        rendered_row = render_user_line(user_row)
        if status == "pending":
            pending_rows.append(rendered_row)
            continue
        if status == "blocked":
            blocked_rows.append(rendered_row)
            continue
        if status == "admin":
            admin_rows.append(rendered_row)
            continue
        if operational_state == "reconnect_required":
            reconnect_rows.append(rendered_row)
            continue
        if operational_state == "ready":
            ready_rows.append(rendered_row)
            continue
        waiting_connect_rows.append(rendered_row)

    summary = (
        f"📊 Pending: <code>{len(pending_rows)}</code> • "
        f"Da collegare: <code>{len(waiting_connect_rows)}</code> • "
        f"Reconnect: <code>{len(reconnect_rows)}</code> • "
        f"Operativi: <code>{len(ready_rows)}</code>"
    )
    sections = [
        title,
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        summary,
    ]
    if pending_rows:
        sections.append("\n🕓 <b>Richieste pending</b>")
        sections.extend(pending_rows)
    if waiting_connect_rows:
        sections.append("\n🔗 <b>Approvati ma non ancora operativi</b>")
        sections.extend(waiting_connect_rows)
    if reconnect_rows:
        sections.append("\n🔁 <b>Reconnect richiesto</b>")
        sections.extend(reconnect_rows)
    if ready_rows:
        sections.append("\n✅ <b>Utenti operativi</b>")
        sections.extend(ready_rows)
    if blocked_rows:
        sections.append("\n⛔ <b>Utenti bloccati</b>")
        sections.extend(blocked_rows)
    if admin_rows:
        sections.append("\n👑 <b>Admin</b>")
        sections.extend(admin_rows)
    return "\n".join(sections)


def format_admin_watchlist(
    rows: Iterable[Mapping[str, object]],
    *,
    title: str,
    empty_message: str,
) -> str:
    rendered_rows = list(rows)
    if not rendered_rows:
        return f"{title}\n━━━━━━━━━━━━━━━━━━━━━━━━\n{empty_message}"
    lines = [
        title,
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        f"📦 Totale: <code>{len(rendered_rows)}</code>",
    ]
    for row in rendered_rows:
        lines.append(
            "• "
            f"<code>{html.escape(str(row.get('telegram_user_id') or 'n/d'))}</code> "
            f"user=<code>{html.escape(str(row.get('username') or 'n/d'))}</code> "
            f"state=<code>{html.escape(str(row.get('operational_state') or 'n/d'))}</code> "
            f"last=<code>{html.escape(str(row.get('last_issue') or 'none'))}</code> "
            f"activity=<code>{html.escape(str(row.get('last_activity_at') or 'n/d'))}</code>"
        )
    return "\n".join(lines)


def format_admin_status_update(
    *,
    telegram_user_id: int,
    status: str,
    updated: bool,
) -> str:
    if not updated:
        return (
            "👥 <b>Gestione accessi</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"Nessun utente trovato per <code>{telegram_user_id}</code>."
        )
    return (
        "👥 <b>Gestione accessi</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Utente <code>{telegram_user_id}</code> aggiornato a "
        f"<code>{html.escape(status)}</code>."
    )


def format_admin_dashboard(dashboard: Mapping[str, object]) -> str:
    metrics = dashboard.get("metrics") or {}
    queue = dashboard.get("queue") or {}
    alerts = dashboard.get("alerts") or []
    mode = html.escape(str(dashboard.get("service_mode") or "normal"))
    oauth_failures_recent = html.escape(str(metrics.get("oauth_failures_recent", 0)))
    pending = html.escape(str(metrics.get("pending_users", 0)))
    approved = html.escape(str(metrics.get("approved_users", 0)))
    linked = html.escape(str(metrics.get("linked_users", 0)))
    approved_unlinked = html.escape(str(metrics.get("approved_without_link", 0)))
    pending_stale = html.escape(str(metrics.get("pending_stale", 0)))
    revoked_stale = html.escape(str(metrics.get("revoked_stale", 0)))
    oauth_pending_expired = html.escape(str(metrics.get("oauth_pending_expired", 0)))
    queue_pending = html.escape(str(queue.get("pending", 0)))
    queue_failed = html.escape(str(queue.get("failed", 0)))
    sections = [
        "🧭 <b>Admin Dashboard</b>",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        f"🛠️ Modalita' servizio: <code>{mode}</code>",
        f"🕓 Pending: <code>{pending}</code> • ✅ Approved: <code>{approved}</code>",
        f"🔗 Tenant linked: <code>{linked}</code> • "
        f"⌛ Approved non operativi: <code>{approved_unlinked}</code>",
        f"🚨 OAuth failure recenti: <code>{oauth_failures_recent}</code>",
        f"🪪 Sessioni OAuth pending ma scadute: <code>{oauth_pending_expired}</code>",
        f"📦 Queue pending: <code>{queue_pending}</code> • failed: <code>{queue_failed}</code>",
        f"⚠️ Pending fermi: <code>{pending_stale}</code> • "
        f"token revocati/rotti persistenti: <code>{revoked_stale}</code>",
    ]
    if alerts:
        sections.append("\n🚨 <b>Alert prodotto</b>")
        sections.extend(
            f"• <code>{html.escape(str(alert.get('code') or 'unknown'))}</code> "
            f"{html.escape(str(alert.get('message') or ''))}"
            for alert in alerts
        )
    return "\n".join(sections)


def format_admin_maintenance_overview(payload: Mapping[str, object]) -> str:
    dashboard = payload.get("dashboard") or {}
    metrics = dashboard.get("metrics") or {}
    queue = payload.get("queue") or {}
    oauth = payload.get("oauth_sessions") or {}
    queue_samples = list(payload.get("queue_samples") or [])
    mode = html.escape(str(payload.get("service_mode") or "normal"))
    retry_backlog = html.escape(str(payload.get("retry_backlog", 0)))
    lines = [
        "🧹 <b>Maintenance Overview</b>",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        f"🛠️ Modalita' servizio: <code>{mode}</code>",
        (
            f"🪪 OAuth pending attive: "
            f"<code>{html.escape(str(oauth.get('pending_active', 0)))}</code>"
        ),
        (
            f"⏰ OAuth pending scadute: "
            f"<code>{html.escape(str(oauth.get('pending_expired', 0)))}</code> • "
            f"expired: <code>{html.escape(str(oauth.get('expired', 0)))}</code> • "
            f"failed: <code>{html.escape(str(oauth.get('failed', 0)))}</code>"
        ),
        f"📦 Queue pending: <code>{html.escape(str(queue.get('pending', 0)))}</code> • "
        f"running: <code>{html.escape(str(queue.get('running', 0)))}</code> • "
        f"failed: <code>{html.escape(str(queue.get('failed', 0)))}</code> • "
        f"retry backlog: <code>{retry_backlog}</code>",
        (
            f"🕓 Pending fermi: "
            f"<code>{html.escape(str(metrics.get('pending_stale', 0)))}</code> • "
            f"🔁 Reconnect persistenti: "
            f"<code>{html.escape(str(metrics.get('revoked_stale', 0)))}</code>"
        ),
    ]
    oldest_pending_user_id = oauth.get("oldest_pending_user_id")
    if oldest_pending_user_id not in {None, 0, "0"}:
        lines.append(
            "• "
            f"pending_session user=<code>{html.escape(str(oldest_pending_user_id))}</code> "
            "created="
            f"<code>{html.escape(str(oauth.get('oldest_pending_created_at') or 'n/d'))}</code> "
            "expires="
            f"<code>{html.escape(str(oauth.get('oldest_pending_expires_at') or 'n/d'))}</code>"
        )
    for sample in queue_samples:
        lines.append(
            "• "
            f"queue op=<code>{html.escape(str(sample.get('operation_type') or 'n/d'))}</code> "
            f"status=<code>{html.escape(str(sample.get('status') or 'n/d'))}</code> "
            "target="
            f"<code>{html.escape(str(sample.get('target_telegram_user_id') or 'n/d'))}</code> "
            f"attempts=<code>{html.escape(str(sample.get('attempts') or 0))}</code>"
        )
    quick_actions: list[str] = []
    if int(oauth.get("pending_expired", 0)) > 0:
        quick_actions.append(
            "sessioni OAuth scadute: rivedi <code>/admin_users reconnect</code> "
            "e poi riallinea il backend"
        )
    if int(queue.get("failed", 0)) > 0:
        quick_actions.append(
            "coda con errori: controlla <code>/tenant_health</code> sui tenant coinvolti"
        )
    if int(retry_backlog) > 0:
        quick_actions.append(
            "retry backlog presente: monitora <code>/stato servizio</code> e verifica il polling"
        )
    if int(metrics.get("pending_stale", 0)) > 0:
        quick_actions.append("richieste accesso ferme: passa da <code>/admin_users pending</code>")
    if quick_actions:
        lines.append("\n🎯 <b>Priorita' consigliate</b>")
        lines.extend(f"• {action}" for action in quick_actions)
    lines.append(
        "Usa <code>/admin</code>, <code>/tenant_health</code> e "
        "<code>/admin_users reconnect</code> per approfondire."
    )
    return "\n".join(lines)


def format_tenant_health(rows: Iterable[Mapping[str, object]]) -> str:
    rendered_rows = list(rows)
    if not rendered_rows:
        return (
            "🩺 <b>Tenant Health</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Nessun tenant registrato da mostrare."
        )
    lines = [
        "🩺 <b>Tenant Health</b>",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
    ]
    for row in rendered_rows:
        lines.append(
            "• "
            f"<code>{html.escape(str(row.get('telegram_user_id') or 'n/d'))}</code> "
            f"access=<code>{html.escape(str(row.get('status') or 'n/d'))}</code> "
            f"account=<code>{html.escape(str(row.get('account_status') or 'unlinked'))}</code> "
            f"token=<code>{html.escape(str(row.get('token_status') or 'missing'))}</code> "
            f"notif=<code>{html.escape(str(row.get('subscription_count') or 0))}</code> "
            f"last=<code>{html.escape(str(row.get('last_issue') or 'none'))}</code>"
        )
    return "\n".join(lines)


def format_service_status(service_status: Mapping[str, object]) -> str:
    mode = html.escape(str(service_status.get("mode") or "normal"))
    read_available = "si" if bool(service_status.get("read_available", True)) else "no"
    write_available = "si" if bool(service_status.get("write_available", True)) else "no"
    connect_available = "si" if bool(service_status.get("connect_available", True)) else "no"
    admin_model = html.escape(str(service_status.get("admin_model") or "single_admin"))
    return (
        "📣 <b>Service Status</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Questo bot usa accesso approvato dall'admin.\n"
        f"👑 Modello admin: <code>{admin_model}</code>\n"
        f"🛠️ Modalita' servizio: <code>{mode}</code>\n"
        f"📖 Consultazione disponibile: <code>{read_available}</code>\n"
        f"✍️ Azioni operative disponibili: <code>{write_available}</code>\n"
        f"🔗 Nuovi collegamenti eBay disponibili: <code>{connect_available}</code>\n"
        "Se non sei ancora approvato usa <code>/request_access</code>. "
        "Per la governance sintetica usa <code>/settings policy</code>."
    )


def format_policy_status(policy_status: Mapping[str, object]) -> str:
    mode = html.escape(str(policy_status.get("mode") or "normal"))
    return (
        "📜 <b>Policy Servizio</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Servizio pubblico piccolo e curato, solo chat private Telegram.\n"
        "Accesso operativo soggetto ad approvazione di un solo admin globale.\n"
        "Notifiche attive di default per utenti approvati, "
        "salvo scelta utente o intervento admin.\n"
        "Il bot mostra solo dati fiscali realmente restituiti da eBay.\n"
        f"Modalita' servizio corrente: <code>{mode}</code>\n"
        "Riferimento operativo: <code>docs/SERVICE_GOVERNANCE.md</code> nel repository."
    )


def _format_personal_snapshot(account_status: Mapping[str, object]) -> str:
    notifications_known = "notifications_enabled" in account_status
    notifications_enabled = bool(account_status.get("notifications_enabled", False))
    session_ready = bool(account_status.get("session_ready", False))
    session_status = str(account_status.get("latest_session_status") or "").strip()
    session_expires_at = html.escape(str(account_status.get("latest_session_expires_at") or ""))
    last_seen_order_id = html.escape(str(account_status.get("last_seen_order_id") or ""))
    last_seen_order_created_at = html.escape(
        str(account_status.get("last_seen_order_created_at") or "")
    )
    last_notified_order_id = html.escape(str(account_status.get("last_notified_order_id") or ""))
    last_notified_order_created_at = html.escape(
        str(account_status.get("last_notified_order_created_at") or "")
    )

    lines: list[str] = []
    if notifications_known:
        lines.append(
            "🔔 Chat corrente: <code>"
            + ("attive" if notifications_enabled else "disattivate")
            + "</code>"
        )
    if session_ready and session_expires_at:
        lines.append(f"🪄 Sessione connect pronta fino a: <code>{session_expires_at}</code>")
    elif session_status:
        lines.append(f"🧷 Ultima sessione connect: <code>{html.escape(session_status)}</code>")
    if last_seen_order_id:
        lines.append(
            f"👀 Ultimo ordine visto: <code>{last_seen_order_id}</code> • "
            f"<code>{last_seen_order_created_at or 'n/d'}</code>"
        )
    if last_notified_order_id:
        lines.append(
            f"📨 Ultimo ordine notificato: <code>{last_notified_order_id}</code> • "
            f"<code>{last_notified_order_created_at or 'n/d'}</code>"
        )
    if not lines:
        return ""
    return "\n" + "\n".join(lines)


def format_account_status(account_status: Mapping[str, object]) -> str:
    linked = bool(account_status.get("linked"))
    environment = html.escape(str(account_status.get("environment") or "n/d"))
    ebay_user_id = html.escape(str(account_status.get("ebay_user_id") or "non collegato"))
    account_state = html.escape(str(account_status.get("account_status") or "unlinked"))
    token_status = html.escape(str(account_status.get("token_status") or "missing"))
    raw_account_state = str(account_status.get("account_status") or "unlinked")
    raw_token_status = str(account_status.get("token_status") or "missing")
    reconnect_hint = format_reconnect_reason_hint(account_status)
    subscription_count = int(account_status.get("subscription_count", 0))
    chat_count = int(account_status.get("chat_count", 0))
    personal_snapshot = _format_personal_snapshot(account_status)

    if raw_account_state == "revoked":
        return (
            "👤 <b>Account eBay</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🔗 Stato: <code>{account_state}</code>\n"
            f"🪪 Ultimo utente eBay: <code>{ebay_user_id}</code>\n"
            f"🌍 Ambiente: <code>{environment}</code>\n"
            f"🔐 Token: <code>{token_status}</code>\n"
            "Il collegamento risulta revocato e va autorizzato di nuovo con "
            "<code>/account collega</code>."
            f"{personal_snapshot}"
            f"{reconnect_hint}"
        )

    if raw_account_state == "disconnected":
        return (
            "👤 <b>Account eBay</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🔗 Stato: <code>{account_state}</code>\n"
            f"🪪 Ultimo utente eBay: <code>{ebay_user_id}</code>\n"
            f"🌍 Ambiente: <code>{environment}</code>\n"
            f"🔐 Token: <code>{token_status}</code>\n"
            "L'account e' stato scollegato dal bot. Usa <code>/account collega</code> "
            "per ricollegarlo."
            f"{personal_snapshot}"
            f"{reconnect_hint}"
        )

    if not linked:
        return (
            "👤 <b>Account eBay</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Stato: <code>non collegato</code>\n"
            "Usa <code>/account collega</code> per collegare il tuo account eBay."
            f"{personal_snapshot}"
        )

    if raw_token_status in {"revoked", "expired", "token_expired"}:
        return (
            "👤 <b>Account eBay</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "🔗 Stato: <code>reconnect_required</code>\n"
            f"🪪 Utente eBay: <code>{ebay_user_id}</code>\n"
            f"🌍 Ambiente: <code>{environment}</code>\n"
            f"🔐 Token: <code>{token_status}</code>\n"
            "Il collegamento esiste ancora, ma il token non e' piu' utilizzabile. "
            "Usa <code>/account collega</code> per riconnettere l'account."
            f"{personal_snapshot}"
            f"{reconnect_hint}"
        )

    return (
        "👤 <b>Account eBay</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🔗 Stato: <code>{account_state}</code>\n"
        f"🪪 Utente eBay: <code>{ebay_user_id}</code>\n"
        f"🌍 Ambiente: <code>{environment}</code>\n"
        f"🔐 Token: <code>{token_status}</code>\n"
        f"💬 Chat abilitate: <code>{chat_count}</code>\n"
        f"🔔 Subscription attive: <code>{subscription_count}</code>"
        f"{personal_snapshot}\n"
        "➡️ Prossimi passi: usa <code>/ordini fiscali</code> per il controllo veloce, "
        "<code>/ordini cerca &lt;order_id&gt;</code> per il dettaglio e <code>/settings</code> "
        "per il recapito chat."
    )


def format_reconnect_status(account_status: Mapping[str, object]) -> str:
    linked = bool(account_status.get("linked"))
    raw_account_status = str(account_status.get("account_status") or "unlinked")
    raw_token_status = str(account_status.get("token_status") or "missing")
    reconnect_hint = format_reconnect_reason_hint(account_status)
    environment = html.escape(str(account_status.get("environment") or "n/d"))
    ebay_user_id = html.escape(str(account_status.get("ebay_user_id") or "n/d"))
    personal_snapshot = _format_personal_snapshot(account_status)

    if raw_account_status in {"revoked", "disconnected"}:
        return (
            "🔁 <b>Reconnect status</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"📌 Stato attuale: <code>{html.escape(raw_account_status)}</code>\n"
            f"🪪 Ultimo utente eBay: <code>{ebay_user_id}</code>\n"
            f"🌍 Ambiente: <code>{environment}</code>\n"
            "Prossima azione: usa <code>/account collega</code> per collegare di nuovo l'account."
            f"{personal_snapshot}"
            f"{reconnect_hint}"
        )

    if linked and raw_token_status in {"revoked", "expired", "token_expired"}:
        return (
            "🔁 <b>Reconnect status</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "📌 Stato attuale: <code>reconnect_required</code>\n"
            f"🪪 Utente eBay: <code>{ebay_user_id}</code>\n"
            f"🌍 Ambiente: <code>{environment}</code>\n"
            f"🔐 Stato token: <code>{html.escape(raw_token_status)}</code>\n"
            "Prossima azione: usa <code>/account collega</code> per completare il reconnect."
            f"{personal_snapshot}"
            f"{reconnect_hint}"
        )

    if linked:
        return (
            "🔁 <b>Reconnect status</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "📌 Stato attuale: <code>linked</code>\n"
            f"🪪 Utente eBay: <code>{ebay_user_id}</code>\n"
            f"🌍 Ambiente: <code>{environment}</code>\n"
            "Nessuna azione richiesta: il collegamento risulta utilizzabile."
            f"{personal_snapshot}"
        )

    return (
        "🔁 <b>Reconnect status</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "📌 Stato attuale: <code>unlinked</code>\n"
        "Nessun account eBay collegato in questo momento.\n"
        "Prossima azione: usa <code>/account collega</code> per avviare il collegamento."
        f"{personal_snapshot}"
    )


def format_reconnect_reason_hint(account_status: Mapping[str, object]) -> str:
    outcome = str(account_status.get("latest_reconnect_outcome") or "").strip()
    reason = str(account_status.get("latest_reconnect_reason") or "").strip()
    if not outcome and not reason:
        return ""

    if outcome == "session_expired":
        label = "Sessione OAuth scaduta"
    elif outcome == "session_unavailable":
        label = "Link di collegamento non piu' valido"
    elif outcome == "user_cancelled":
        label = "Autorizzazione annullata dall'utente"
    elif outcome == "provider_configuration_error":
        label = "Configurazione OAuth del servizio non accettata da eBay"
    elif outcome == "service_configuration_error":
        label = "Problema di configurazione o salvataggio lato servizio"
    elif outcome == "provider_runtime_error":
        label = "Errore temporaneo restituito da eBay"
    elif outcome:
        label = outcome.replace("_", " ")
    else:
        label = "Ultimo problema noto"

    safe_label = html.escape(label)
    safe_reason = html.escape(reason) if reason else ""
    if safe_reason:
        return (
            "\n"
            f"⚠️ Ultimo problema noto: <code>{safe_label}</code>\n"
            f"📝 Dettaglio: <code>{safe_reason}</code>"
        )
    return f"\n⚠️ Ultimo problema noto: <code>{safe_label}</code>"


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
        blocking_reason = "L'ordine non e' recuperabile con il contesto attuale."
        next_action = "Controlla orderId, ambiente e account collegato, poi riprova."
        quick_command = "<code>/account</code>"
    elif raw_status == "missing_order_id":
        blocking_reason = "Manca un identificativo ordine stabile."
        next_action = "Verifica il payload sorgente: senza orderId il bot non puo' tracciarlo."
    elif raw_status == "not_eligible":
        blocking_reason = "L'ordine non passa i criteri di eleggibilita' correnti."
        next_action = "Controlla che l'identificativo fiscale sia presente e valorizzato."
        quick_command = "<code>/ordini cerca " + order_id + "</code>"
    elif raw_status == "already_notified_order_id":
        blocking_reason = "L'ordine e' gia' stato tracciato per orderId."
        next_action = "Non serve intervenire, a meno che tu non voglia forzare un nuovo ciclo."
        quick_command = "<code>/ordini cerca " + order_id + "</code>"
    elif raw_status == "already_notified_fingerprint":
        blocking_reason = "L'ordine collide con una fingerprint gia' vista."
        next_action = "Controlla i dati ordine se ti aspettavi una nuova notifica distinta."
        quick_command = "<code>/ordini cerca " + order_id + "</code>"
    elif raw_delivery_status == "chat_not_registered":
        blocking_reason = "La chat corrente non e' registrata come destinazione notifiche."
        next_action = "Invia un comando da questa chat e poi verifica /settings."
        quick_command = "<code>/settings</code>"
    elif raw_delivery_status in {
        "chat_notifications_disabled",
        "chat_subscription_disabled",
        "chat_not_subscribed",
    }:
        blocking_reason = "La chat corrente non e' pronta a ricevere notifiche automatiche."
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
        blocking_reason = "L'ordine non e' recuperabile con il contesto attuale."
        next_action = "Controlla orderId, ambiente e account collegato, poi riprova."
    elif raw_status == "missing_order_id":
        blocking_reason = "Manca un identificativo ordine stabile."
        next_action = "Verifica il payload sorgente: senza orderId il bot non puo' tracciarlo."
    elif raw_status == "not_eligible":
        blocking_reason = "L'ordine non passa i criteri di eleggibilita' correnti."
        next_action = "Controlla che l'identificativo fiscale sia presente e valorizzato."
    elif raw_status == "already_notified_order_id":
        blocking_reason = "L'ordine e' gia' stato tracciato per orderId."
        next_action = "Non serve intervenire, a meno che tu non voglia forzare un nuovo ciclo."
    elif raw_status == "already_notified_fingerprint":
        blocking_reason = "L'ordine collide con una fingerprint gia' vista."
        next_action = "Controlla i dati ordine se ti aspettavi una nuova notifica distinta."
    elif raw_delivery_status == "chat_not_registered":
        blocking_reason = "La chat corrente non e' registrata come destinazione notifiche."
        next_action = "Invia un comando da questa chat e poi verifica /settings."
    elif raw_delivery_status in {
        "chat_notifications_disabled",
        "chat_subscription_disabled",
        "chat_not_subscribed",
    }:
        blocking_reason = "La chat corrente non e' pronta a ricevere notifiche automatiche."
        next_action = "Riattiva il recapito con <code>/settings notifiche on</code>."

    status = html.escape(raw_status)
    delivery_status = html.escape(raw_delivery_status)
    return (
        "🧭 <b>Notificabilita'</b>\n"
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
        "• <code>/ordini controlla [giorni] [max]</code> → ordini senza dato fiscale\n"
        "• <code>/ordini report [giorni] [max]</code> → riepilogo fiscale compatto\n"
        "• <code>/ordini priorita [giorni] [max]</code> → casi ordinati per priorita'\n"
        "• <code>/ordini spiega &lt;order_id&gt;</code> → spiega la notificabilita'\n"
        "Esempio: <code>/ordini fiscali 7 20</code>."
    )


def format_admin_command_help() -> str:
    return (
        "🧭 <b>Admin</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Usa <code>/admin</code> come cruscotto operativo.\n"
        "• <code>/admin</code> → dashboard e alert prodotto\n"
        "• <code>/admin manutenzione</code> → backlog operativo e cleanup\n"
        "• <code>/admin service normal|maintenance|degraded</code> → modalita' servizio\n"
        "• <code>/admin_users all|pending|unlinked|reconnect|inactive</code> → liste utenti\n"
        "• <code>/tenant_health [user_id]</code> → salute tenant compatta\n"
        "• <code>/approve_user &lt;id&gt;</code> / <code>/reject_user &lt;id&gt;</code> → accessi"
    )


def format_connect_status(connect_status: Mapping[str, object]) -> str:
    connect_url = str(connect_status.get("connect_url", "") or "")
    oauth_state = html.escape(str(connect_status.get("oauth_state", "")))
    expires_at = html.escape(str(connect_status.get("expires_at", "")))
    session_reused = bool(connect_status.get("session_reused", False))
    reconnect = bool(connect_status.get("reconnect", False))
    account_status = html.escape(str(connect_status.get("account_status") or "unlinked"))
    ebay_user_id = html.escape(str(connect_status.get("ebay_user_id") or "n/d"))
    personal_snapshot = _format_personal_snapshot(connect_status)
    intro = (
        "🔁 <b>Ricollega account eBay</b>" if reconnect else "🔗 <b>Collegamento account eBay</b>"
    )
    session_line = (
        "♻️ Sessione gia' pronta: puoi riaprire il link qui sotto.\n"
        if session_reused
        else "🆕 Sessione OAuth preparata correttamente.\n"
    )
    base = (
        f"{intro}\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"📌 Stato account attuale: <code>{account_status}</code>\n"
        f"🪪 Utente eBay noto: <code>{ebay_user_id}</code>\n"
        f"{session_line}"
        f"🪪 Sessione OAuth: <code>{oauth_state}</code>\n"
        f"⏳ Scadenza: <code>{expires_at}</code>\n"
        f"{personal_snapshot}\n"
    )
    if connect_url:
        escaped_url = html.escape(connect_url, quote=True)
        return (
            base
            + f'🌐 Apri questo link: <a href="{escaped_url}">{escaped_url}</a>\n'
            + "1. apri il link\n"
            + "2. completa il consenso eBay\n"
            + "3. torna in chat: il bot confermera' il risultato qui.\n"
            + "Se vuoi ricontrollare prima lo stato usa <code>/account reconnect</code>."
        )
    return (
        base
        + "⚠️ Il callback OAuth non e' ancora configurato sul server.\n"
        + "La sessione e' stata preparata, ma il servizio non puo' ancora "
        "aprire il flusso pubblico.\n"
        + "Questa e' una limitazione di configurazione del server, non un errore del tuo account."
    )


def format_disconnect_status(disconnect_status: Mapping[str, object]) -> str:
    if not disconnect_status.get("disconnected", False):
        return (
            "❌ <b>Scollega account eBay</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Nessun account eBay collegato da scollegare in questo contesto.\n"
            "Se devi collegarne uno usa <code>/account collega</code>."
        )

    ebay_user_id = html.escape(str(disconnect_status.get("ebay_user_id", "n/d")))
    environment = html.escape(str(disconnect_status.get("environment", "n/d")))
    remote_revocation_status = html.escape(
        str(disconnect_status.get("remote_revocation_status", "not_attempted"))
    )
    remote_revocation_detail = html.escape(
        str(disconnect_status.get("remote_revocation_detail", ""))
    )
    remote_line = _format_remote_revocation_line(
        remote_revocation_status,
        remote_revocation_detail,
    )
    return (
        "❌ <b>Scollega account eBay</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🪪 Utente eBay scollegato: <code>{ebay_user_id}</code>\n"
        f"🌍 Ambiente: <code>{environment}</code>\n"
        "🔐 Token locale rimosso dal runtime del bot.\n"
        f"{remote_line}"
        "ℹ️ Questo comando scollega solo l'account eBay: l'accesso al bot resta approvato.\n"
        "Puoi usare <code>/account collega</code> per collegare di nuovo l'account."
    )


def format_leave_status(leave_status: Mapping[str, object]) -> str:
    ebay_user_id = html.escape(str(leave_status.get("ebay_user_id", "n/d")))
    environment = html.escape(str(leave_status.get("environment", "n/d")))
    account_was_linked = bool(leave_status.get("account_was_linked", False))
    remote_revocation_status = html.escape(
        str(leave_status.get("remote_revocation_status", "not_attempted"))
    )
    remote_revocation_detail = html.escape(str(leave_status.get("remote_revocation_detail", "")))
    remote_line = _format_remote_revocation_line(
        remote_revocation_status,
        remote_revocation_detail,
    )
    account_line = (
        f"🪪 Ultimo account eBay: <code>{ebay_user_id}</code>\n"
        f"🌍 Ambiente: <code>{environment}</code>\n"
        "🔐 Collegamento e token locali rimossi dal runtime del bot.\n"
        f"{remote_line}"
        if account_was_linked
        else "🪪 Nessun account eBay collegato da scollegare in questo momento.\n"
    )
    return (
        "🚪 <b>Disattiva uso bot</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"{account_line}"
        "🔕 Notifiche chat: <code>disattivate</code>\n"
        "🙅 Accesso operativo al bot: <code>disattivato</code>\n"
        "Per tornare operativo dovrai usare <code>/request_access</code> "
        "e attendere una nuova approvazione."
    )


def format_notifications_status(notification_status: Mapping[str, object]) -> str:
    enabled = bool(notification_status.get("enabled", False))
    tenant_scope = html.escape(str(notification_status.get("tenant_scope", "global")))
    chat_id = html.escape(str(notification_status.get("chat_id", "n/d")))
    environment = html.escape(str(notification_status.get("environment", "n/d")))
    account_linked = bool(notification_status.get("account_linked", False))
    filter_label = html.escape(str(notification_status.get("filter_label") or "tutti"))
    status_text = "attive" if enabled else "disattivate"
    command_hint = "/settings notifiche off" if enabled else "/settings notifiche on"
    next_action = (
        "Le notifiche sono pronte: puoi controllare anche "
        "<code>/ordini spiega &lt;order_id&gt;</code>."
        if enabled
        else "Riattiva il recapito con <code>/settings notifiche on</code> "
        "quando vuoi tornare a ricevere avvisi."
    )
    if not account_linked:
        next_action = (
            "Prima di aspettarti notifiche operative collega "
            "un account eBay con <code>/account collega</code>."
        )
    return (
        "🔔 <b>Notifiche chat</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"💬 Chat: <code>{chat_id}</code>\n"
        f"🏷️ Scope: <code>{tenant_scope}</code>\n"
        f"🌍 Ambiente: <code>{environment}</code>\n"
        f"📣 Stato: <code>{status_text}</code>\n"
        f"🧪 Filtro attivo: <code>{filter_label}</code>\n"
        f"Usa <code>{command_hint}</code> per cambiare questa preferenza.\n"
        f"➡️ Prossima azione: {next_action}"
    )


def format_review_records(records: Iterable[OrderRecord], page_size: int = 8) -> list[str]:
    rows = list(records)
    if not rows:
        return [
            "🗂️ <b>Ordini Da Controllare</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Nessun ordine recente da controllare manualmente: "
            "quelli trovati hanno gia' un dato fiscale."
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
        "Apri <code>/ordini priorita</code> per vedere i casi piu' rilevanti."
        if rows
        else "Nessun dato disponibile: riprova piu' tardi o amplia la finestra."
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


def format_settings_status(settings_status: Mapping[str, object]) -> str:
    tenant_scope = html.escape(str(settings_status.get("tenant_scope", "global")))
    environment = html.escape(str(settings_status.get("environment", "n/d")))
    notifications_enabled = bool(settings_status.get("notifications_enabled", False))
    notifications_text = "attive" if notifications_enabled else "disattivate"
    linked = bool(settings_status.get("account_linked", False))
    linked_text = "collegato" if linked else "non collegato"
    user_status = normalize_telegram_user_status(str(settings_status.get("user_status") or "new"))
    if user_status == "admin":
        user_status_text = "admin"
    elif user_status == "approved":
        user_status_text = "approvato"
    elif user_status == "pending":
        user_status_text = "pending"
    elif user_status == "blocked":
        user_status_text = "bloccato"
    else:
        user_status_text = "non approvato"
    last_fetch_start = html.escape(str(settings_status.get("last_fetch_start") or ""))
    last_fetch_end = html.escape(str(settings_status.get("last_fetch_end") or ""))
    last_seen_order_id = html.escape(str(settings_status.get("last_seen_order_id") or ""))
    last_seen_order_created_at = html.escape(
        str(settings_status.get("last_seen_order_created_at") or "")
    )
    last_notified_order_id = html.escape(str(settings_status.get("last_notified_order_id") or ""))
    last_notified_order_created_at = html.escape(
        str(settings_status.get("last_notified_order_created_at") or "")
    )
    latest_session_status = html.escape(str(settings_status.get("latest_session_status") or ""))
    latest_session_expires_at = html.escape(
        str(settings_status.get("latest_session_expires_at") or "")
    )
    session_ready = bool(settings_status.get("session_ready", False))
    memory_lines = ""
    if last_fetch_start and last_fetch_end:
        memory_lines += (
            f"🧭 Ultima finestra polling: <code>{last_fetch_start}</code> → "
            f"<code>{last_fetch_end}</code>\n"
        )
    if last_seen_order_id:
        memory_lines += (
            f"👀 Ultimo ordine visto: <code>{last_seen_order_id}</code> • "
            f"<code>{last_seen_order_created_at or 'n/d'}</code>\n"
        )
    if last_notified_order_id:
        memory_lines += (
            f"📨 Ultimo ordine notificato: <code>{last_notified_order_id}</code> • "
            f"<code>{last_notified_order_created_at or 'n/d'}</code>\n"
        )
    if session_ready and latest_session_expires_at:
        memory_lines += f"🪄 Sessione connect pronta: <code>{latest_session_expires_at}</code>\n"
    elif latest_session_status:
        memory_lines += f"🧷 Ultima sessione connect: <code>{latest_session_status}</code>\n"
    next_actions: list[str] = []
    if not linked:
        next_actions.append("collega eBay con <code>/account collega</code>")
    if not notifications_enabled:
        next_actions.append("riattiva la chat con <code>/settings notifiche on</code>")
    if linked and notifications_enabled:
        next_actions.append(
            "controlla ordini e notificabilita' con <code>/ordini fiscali</code> "
            "o <code>/ordini spiega &lt;order_id&gt;</code>"
        )
    if not next_actions:
        next_actions.append(
            "verifica account e recapito con <code>/account</code> e <code>/settings</code>"
        )
    return (
        "⚙️ <b>Impostazioni</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🏷️ Scope runtime: <code>{tenant_scope}</code>\n"
        f"🌍 Ambiente: <code>{environment}</code>\n"
        f"🔔 Notifiche chat: <code>{notifications_text}</code>\n"
        f"🛂 Accesso bot: <code>{user_status_text}</code>\n"
        f"👤 Account eBay: <code>{linked_text}</code>\n"
        f"{memory_lines}"
        "➡️ Prossimi passi: " + " • ".join(next_actions) + "\n"
        "Comandi utili: <code>/account</code>, <code>/account collega</code>, "
        "<code>/account reconnect</code>, <code>/account scollega</code>, "
        "<code>/settings lascia</code>, <code>/settings notifiche on</code>, "
        "<code>/settings notifiche off</code>."
    )


def _format_remote_revocation_line(status: str, detail: str) -> str:
    if status == "revoked":
        return "☁️ Revoca remota eBay: <code>completata</code>\n"
    if status == "failed":
        return "☁️ Revoca remota eBay: <code>non confermata</code>\n"
    if status == "skipped":
        return (
            "☁️ Revoca remota eBay: <code>saltata</code>\n"
            f"📝 Nota: <code>{detail or 'token locale rimosso'}</code>\n"
        )
    return "☁️ Revoca remota eBay: <code>non tentata</code>\n"


def options_for_command(command: str, args: list[str]) -> FetchOptions:
    if command == "/ordine":
        if not args:
            raise UserInputError("Uso corretto: /ordine <order_id>")
        return FetchOptions(
            order_ids=[args[0]],
            only_found=False,
            max_results=1,
            include_details=True,
        )

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


def is_authorized(chat_id: int, config: TelegramConfig) -> bool:
    if config.allowed_chat_ids is None:
        return True
    if not config.allowed_chat_ids:
        return False
    return chat_id in config.allowed_chat_ids


def is_admin_authorized(
    chat_id: int,
    telegram_user_id: int | None,
    config: TelegramConfig,
) -> bool:
    if not is_authorized(chat_id, config):
        return False
    if config.admin_user_id is None:
        return False
    return telegram_user_id == config.admin_user_id


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
        f"🧾 Ordini con dato fiscale: <code>{metrics.orders_with_fiscal_identifier}</code>\n"
        f"📩 Notifiche inviate: <code>{metrics.notifications_sent}</code>\n"
        f"🔁 Retry Telegram: <code>{metrics.telegram_retries}</code>\n"
        f"🚨 Errori consecutivi: <code>{metrics.consecutive_error_cycles}</code>\n"
        f"⏳ Coda retry: <code>{retry_queue_size}</code>\n"
        f"⚠️ Ultimo errore: <code>{html.escape(last_error_str)}</code>\n"
        f"📉 Errori per tipo: <code>{errors_text}</code>"
    )


def has_fiscal_identifier(record: OrderRecord) -> bool:
    return record.has_fiscal_identifier()


def format_auto_notification(record: OrderRecord) -> str:
    prefix = "🚨 <b>Nuovo ordine eBay</b>\n\n"
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
