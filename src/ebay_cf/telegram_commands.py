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
    TelegramUser,
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
        "• 🔗 <code>/connect</code> → prepara il collegamento account eBay\n"
        "• ❌ <code>/disconnect</code> → scollega account eBay dal bot\n"
        "• 🔔 <code>/notifications on</code> → attiva notifiche per questa chat\n"
        "• 🔕 <code>/notifications off</code> → disattiva notifiche per questa chat\n"
        "• ⚙️ <code>/settings</code> → riepilogo preferenze di chat e tenant\n"
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


def build_main_menu_markup() -> dict[str, object]:
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
        "/connect",
        "/disconnect",
        "/settings",
    )


def build_access_request_markup() -> dict[str, object]:
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


def build_admin_approval_markup(telegram_user_id: int) -> dict[str, object]:
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
    if is_admin:
        return (
            "👑 <b>Admin del bot</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Il tuo account Telegram e' riconosciuto come admin globale."
        )
    if user_status == "pending":
        return (
            "⏳ <b>Accesso in attesa</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "La tua richiesta e' gia' in attesa di approvazione da parte dell'admin.\n"
            "Quando verrai approvato potrai usare <code>/connect</code> e gli altri comandi."
        )
    if user_status == "blocked":
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
    subscription_count = int(account_status.get("subscription_count", 0))
    chat_count = int(account_status.get("chat_count", 0))

    if not linked:
        return (
            "👤 <b>Account eBay</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Stato: <code>non collegato</code>\n"
            "Usa <code>/connect</code> quando il flusso OAuth sara' disponibile."
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


def format_connect_status(connect_status: Mapping[str, object]) -> str:
    connect_url = str(connect_status.get("connect_url", "") or "")
    oauth_state = html.escape(str(connect_status.get("oauth_state", "")))
    expires_at = html.escape(str(connect_status.get("expires_at", "")))
    base = (
        "🔗 <b>Collegamento account eBay</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🪪 Sessione OAuth: <code>{oauth_state}</code>\n"
        f"⏳ Scadenza: <code>{expires_at}</code>\n"
    )
    if connect_url:
        escaped_url = html.escape(connect_url, quote=True)
        return base + f'🌐 Apri questo link: <a href="{escaped_url}">{escaped_url}</a>'
    return (
        base
        + "⚠️ Il callback OAuth non e' ancora configurato sul server.\n"
        + "La sessione e' stata preparata, ma serve impostare l'URL pubblico di collegamento."
    )


def format_disconnect_status(disconnect_status: Mapping[str, object]) -> str:
    if not disconnect_status.get("disconnected", False):
        return (
            "❌ <b>Scollega account eBay</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Nessun account eBay collegato da scollegare in questo contesto."
        )

    ebay_user_id = html.escape(str(disconnect_status.get("ebay_user_id", "n/d")))
    environment = html.escape(str(disconnect_status.get("environment", "n/d")))
    return (
        "❌ <b>Scollega account eBay</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🪪 Utente eBay scollegato: <code>{ebay_user_id}</code>\n"
        f"🌍 Ambiente: <code>{environment}</code>\n"
        "🔐 Token locale rimosso dal runtime del bot.\n"
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
    if config.allowed_chat_ids is None:
        return True
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
