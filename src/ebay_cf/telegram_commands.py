"""Telegram command parsing and response formatting helpers."""

from __future__ import annotations

import html
import json
import urllib.parse
from typing import Callable, Iterable, Mapping

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

CALLBACK_ULTIMI = "menu:ultimi"
CALLBACK_TUTTI = "menu:tutti"
CALLBACK_STATO = "menu:stato"
CALLBACK_HELP = "menu:help"
CALLBACK_ACCOUNT = "menu:account"
CALLBACK_CONNECT = "menu:connect"
CALLBACK_DISCONNECT = "menu:disconnect"
CALLBACK_SETTINGS = "menu:settings"
CALLBACK_REQUEST_ACCESS = "access:request"
CALLBACK_APPROVE_PREFIX = "access:approve:"
CALLBACK_REJECT_PREFIX = "access:reject:"


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
        "• 👤 <code>/account</code> → stato collegamento account eBay\n"
        "• 🔁 <code>/reconnect_status</code> → stato reconnect e prossima azione\n"
        "• 🔗 <code>/connect</code> → prepara il collegamento account eBay\n"
        "• ❌ <code>/disconnect</code> → scollega account eBay dal bot\n"
        "• 🔔 <code>/notifications on</code> → attiva notifiche per questa chat\n"
        "• 🔕 <code>/notifications off</code> → disattiva notifiche per questa chat\n"
        "• ⚙️ <code>/settings</code> → riepilogo preferenze di chat e tenant\n"
        "• 🧭 <code>/why_not_notified [order_id]</code> → spiega se un ordine e' notificabile\n"
        "• 🙋 <code>/request_access</code> → richiede accesso all'admin del bot\n"
        "• 👥 <code>/users</code> → elenco utenti registrati e stato accessi (admin)\n"
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
            "👑 <b>Benvenuto in eBay CF Bot</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Il tuo account Telegram e' riconosciuto come admin globale.\n"
            "Puoi approvare utenti con <code>/users</code>, <code>/approve_user</code> "
            "e <code>/reject_user</code>.\n"
            "Per il tuo uso operativo puoi controllare <code>/account</code>, "
            "<code>/connect</code> e gli ordini recenti."
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
            "👋 <b>Benvenuto in eBay CF Bot</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Il tuo ultimo account eBay risulta in stato "
            f"<code>{html.escape(raw_account_status)}</code>.\n"
            "Ultimo utente noto: "
            f"<code>{ebay_user_id}</code> • ambiente: <code>{environment}</code>\n"
            "Prossimo passo: usa <code>/connect</code> per collegare di nuovo l'account."
            f"{private_only_note}"
        )

    if raw_token_status in {"revoked", "expired", "token_expired"}:
        return (
            "👋 <b>Benvenuto in eBay CF Bot</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Il tuo account eBay risulta collegato, ma il token non e' piu' utilizzabile.\n"
            f"Utente eBay: <code>{ebay_user_id}</code> • ambiente: <code>{environment}</code>\n"
            "Prossimo passo: usa <code>/connect</code> per completare il reconnect."
            f"{private_only_note}"
        )

    if raw_account_status != "linked":
        return (
            "👋 <b>Benvenuto in eBay CF Bot</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Il tuo accesso e' approvato, ma non hai ancora collegato un account eBay.\n"
            "Prossimo passo: usa <code>/connect</code>.\n"
            "Poi potrai verificare lo stato con <code>/account</code> "
            "e attivare il flusso operativo."
            f"{private_only_note}"
        )

    return (
        "✅ <b>Benvenuto in eBay CF Bot</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Il tuo accesso e' attivo e l'account eBay risulta collegato.\n"
        f"Utente eBay: <code>{ebay_user_id}</code> • ambiente: <code>{environment}</code>\n"
        "Comandi utili: <code>/ultimi</code>, <code>/tutti</code>, <code>/ordine</code>, "
        "<code>/account</code>, <code>/notifications on</code>, <code>/settings</code>."
        f"{private_only_note}"
    )


def build_main_menu_markup() -> InlineKeyboardMarkup:
    return {
        "inline_keyboard": [
            [
                {"text": "Ultimi CF", "callback_data": CALLBACK_ULTIMI},
                {"text": "Tutti", "callback_data": CALLBACK_TUTTI},
            ],
            [
                {"text": "Stato", "callback_data": CALLBACK_STATO},
                {"text": "Account", "callback_data": CALLBACK_ACCOUNT},
            ],
            [
                {"text": "Collega eBay", "callback_data": CALLBACK_CONNECT},
                {"text": "Scollega", "callback_data": CALLBACK_DISCONNECT},
            ],
            [
                {"text": "Settings", "callback_data": CALLBACK_SETTINGS},
                {"text": "Help", "callback_data": CALLBACK_HELP},
            ],
        ]
    }


def callback_command_from_data(data: str) -> str | None:
    normalized = data.strip()
    mapping = {
        CALLBACK_ULTIMI: "/ultimi 7 20",
        CALLBACK_TUTTI: "/tutti 7 20",
        CALLBACK_STATO: "/stato",
        CALLBACK_ACCOUNT: "/account",
        CALLBACK_CONNECT: "/connect",
        CALLBACK_DISCONNECT: "/disconnect",
        CALLBACK_SETTINGS: "/settings",
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
        "/ping",
        "/stato",
        "/account",
        "/reconnect_status",
        "/connect",
        "/disconnect",
        "/settings",
    )


def build_access_request_markup() -> InlineKeyboardMarkup:
    return {
        "inline_keyboard": [
            [
                {
                    "text": "Richiedi accesso",
                    "callback_data": CALLBACK_REQUEST_ACCESS,
                }
            ]
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
            "Quando verrai approvato potrai usare <code>/connect</code> e gli altri comandi."
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
        "Usa <code>/request_access</code> per inviare la tua richiesta."
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


def format_admin_user_list(users: Iterable[Mapping[str, object] | TelegramUser]) -> str:
    rows = list(users)
    if not rows:
        return (
            "👥 <b>Utenti bot</b>\n━━━━━━━━━━━━━━━━━━━━━━━━\nNessun utente registrato nel database."
        )
    rendered: list[str] = []
    for raw_user in rows:
        user = (
            raw_user if isinstance(raw_user, TelegramUser) else TelegramUser.from_mapping(raw_user)
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
    return "👥 <b>Utenti bot</b>\n━━━━━━━━━━━━━━━━━━━━━━━━\n" + "\n".join(rendered)


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

    if raw_account_state == "revoked":
        return (
            "👤 <b>Account eBay</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🔗 Stato: <code>{account_state}</code>\n"
            f"🪪 Ultimo utente eBay: <code>{ebay_user_id}</code>\n"
            f"🌍 Ambiente: <code>{environment}</code>\n"
            f"🔐 Token: <code>{token_status}</code>\n"
            "Il collegamento risulta revocato e va autorizzato di nuovo con "
            "<code>/connect</code>."
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
            "L'account e' stato scollegato dal bot. Usa <code>/connect</code> "
            "per ricollegarlo."
            f"{reconnect_hint}"
        )

    if not linked:
        return (
            "👤 <b>Account eBay</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Stato: <code>non collegato</code>\n"
            "Usa <code>/connect</code> per collegare il tuo account eBay."
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
            "Usa <code>/connect</code> per riconnettere l'account."
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
    )


def format_reconnect_status(account_status: Mapping[str, object]) -> str:
    linked = bool(account_status.get("linked"))
    raw_account_status = str(account_status.get("account_status") or "unlinked")
    raw_token_status = str(account_status.get("token_status") or "missing")
    reconnect_hint = format_reconnect_reason_hint(account_status)
    environment = html.escape(str(account_status.get("environment") or "n/d"))
    ebay_user_id = html.escape(str(account_status.get("ebay_user_id") or "n/d"))

    if raw_account_status in {"revoked", "disconnected"}:
        return (
            "🔁 <b>Reconnect status</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"📌 Stato attuale: <code>{html.escape(raw_account_status)}</code>\n"
            f"🪪 Ultimo utente eBay: <code>{ebay_user_id}</code>\n"
            f"🌍 Ambiente: <code>{environment}</code>\n"
            "Prossima azione: usa <code>/connect</code> per collegare di nuovo l'account."
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
            "Prossima azione: usa <code>/connect</code> per completare il reconnect."
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
        )

    return (
        "🔁 <b>Reconnect status</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "📌 Stato attuale: <code>unlinked</code>\n"
        "Nessun account eBay collegato in questo momento.\n"
        "Prossima azione: usa <code>/connect</code> per avviare il collegamento."
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
    if raw_status == "order_not_found":
        blocking_reason = "L'ordine non e' recuperabile con il contesto attuale."
        next_action = "Controlla orderId, ambiente e account collegato, poi riprova."
    elif raw_status == "missing_order_id":
        blocking_reason = "Manca un identificativo ordine stabile."
        next_action = "Verifica il payload sorgente: senza orderId il bot non puo' tracciarlo."
    elif raw_status == "not_eligible":
        blocking_reason = "L'ordine non passa i criteri di eleggibilita' correnti."
        next_action = "Controlla che il CODICE_FISCALE sia presente e valorizzato."
    elif raw_status == "already_notified_order_id":
        blocking_reason = "L'ordine e' gia' stato tracciato per orderId."
        next_action = "Non serve intervenire, a meno che tu non voglia forzare un nuovo ciclo."
    elif raw_status == "already_notified_fingerprint":
        blocking_reason = "L'ordine collide con una fingerprint gia' vista."
        next_action = "Controlla i dati ordine se ti aspettavi una nuova notifica distinta."
    elif raw_delivery_status == "chat_not_registered":
        blocking_reason = "La chat corrente non e' registrata come destinazione notifiche."
        next_action = "Invia un comando da questa chat e poi verifica /settings o /notifications."
    elif raw_delivery_status in {
        "chat_notifications_disabled",
        "chat_subscription_disabled",
        "chat_not_subscribed",
    }:
        blocking_reason = "La chat corrente non e' pronta a ricevere notifiche automatiche."
        next_action = "Riattiva il recapito con <code>/notifications on</code>."

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
        next_action = "Controlla che il CODICE_FISCALE sia presente e valorizzato."
    elif raw_status == "already_notified_order_id":
        blocking_reason = "L'ordine e' gia' stato tracciato per orderId."
        next_action = "Non serve intervenire, a meno che tu non voglia forzare un nuovo ciclo."
    elif raw_status == "already_notified_fingerprint":
        blocking_reason = "L'ordine collide con una fingerprint gia' vista."
        next_action = "Controlla i dati ordine se ti aspettavi una nuova notifica distinta."
    elif raw_delivery_status == "chat_not_registered":
        blocking_reason = "La chat corrente non e' registrata come destinazione notifiche."
        next_action = "Invia un comando da questa chat e poi verifica /settings o /notifications."
    elif raw_delivery_status in {
        "chat_notifications_disabled",
        "chat_subscription_disabled",
        "chat_not_subscribed",
    }:
        blocking_reason = "La chat corrente non e' pronta a ricevere notifiche automatiche."
        next_action = "Riattiva il recapito con <code>/notifications on</code>."

    status = html.escape(raw_status)
    delivery_status = html.escape(raw_delivery_status)
    return (
        "🧭 <b>Notificabilita'</b>\n"
        f"📌 Esito ordine: <code>{status}</code>\n"
        f"📨 Esito recapito: <code>{delivery_status}</code>\n"
        f"🚫 Blocco attuale: {blocking_reason}\n"
        f"➡️ Prossima azione: {next_action}"
    )


def format_connect_status(connect_status: Mapping[str, object]) -> str:
    connect_url = str(connect_status.get("connect_url", "") or "")
    oauth_state = html.escape(str(connect_status.get("oauth_state", "")))
    expires_at = html.escape(str(connect_status.get("expires_at", "")))
    session_reused = bool(connect_status.get("session_reused", False))
    reconnect = bool(connect_status.get("reconnect", False))
    account_status = html.escape(str(connect_status.get("account_status") or "unlinked"))
    ebay_user_id = html.escape(str(connect_status.get("ebay_user_id") or "n/d"))
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
    )
    if connect_url:
        escaped_url = html.escape(connect_url, quote=True)
        return (
            base
            + f'🌐 Apri questo link: <a href="{escaped_url}">{escaped_url}</a>\n'
            + "Dopo il consenso eBay il bot confermera' il risultato in questa chat."
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
            "Se devi collegarne uno usa <code>/connect</code>."
        )

    ebay_user_id = html.escape(str(disconnect_status.get("ebay_user_id", "n/d")))
    environment = html.escape(str(disconnect_status.get("environment", "n/d")))
    return (
        "❌ <b>Scollega account eBay</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🪪 Utente eBay scollegato: <code>{ebay_user_id}</code>\n"
        f"🌍 Ambiente: <code>{environment}</code>\n"
        "🔐 Token locale rimosso dal runtime del bot.\n"
        "ℹ️ La revoca remota eBay non e' ancora inclusa in questo comando.\n"
        "Puoi usare <code>/connect</code> per collegare di nuovo l'account."
    )


def format_notifications_status(notification_status: Mapping[str, object]) -> str:
    enabled = bool(notification_status.get("enabled", False))
    tenant_scope = html.escape(str(notification_status.get("tenant_scope", "global")))
    chat_id = html.escape(str(notification_status.get("chat_id", "n/d")))
    environment = html.escape(str(notification_status.get("environment", "n/d")))
    status_text = "attive" if enabled else "disattivate"
    command_hint = "/notifications off" if enabled else "/notifications on"
    return (
        "🔔 <b>Notifiche chat</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"💬 Chat: <code>{chat_id}</code>\n"
        f"🏷️ Scope: <code>{tenant_scope}</code>\n"
        f"🌍 Ambiente: <code>{environment}</code>\n"
        f"📣 Stato: <code>{status_text}</code>\n"
        f"Usa <code>{command_hint}</code> per cambiare questa preferenza."
    )


def format_settings_status(settings_status: Mapping[str, object]) -> str:
    tenant_scope = html.escape(str(settings_status.get("tenant_scope", "global")))
    environment = html.escape(str(settings_status.get("environment", "n/d")))
    notifications_enabled = bool(settings_status.get("notifications_enabled", False))
    notifications_text = "attive" if notifications_enabled else "disattivate"
    linked = bool(settings_status.get("account_linked", False))
    linked_text = "collegato" if linked else "non collegato"
    return (
        "⚙️ <b>Impostazioni</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🏷️ Scope runtime: <code>{tenant_scope}</code>\n"
        f"🌍 Ambiente: <code>{environment}</code>\n"
        f"🔔 Notifiche chat: <code>{notifications_text}</code>\n"
        f"👤 Account eBay: <code>{linked_text}</code>\n"
        "Comandi utili: <code>/account</code>, <code>/connect</code>, "
        "<code>/disconnect</code>, <code>/notifications on</code>, "
        "<code>/notifications off</code>."
    )


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
        return True
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
