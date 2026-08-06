"""Telegram presentation for commands."""

from __future__ import annotations

import html
import json
from typing import Mapping

from .clients.telegram import InlineKeyboardButton, InlineKeyboardMarkup
from .models import (
    BotRuntimeState,
    TelegramConfig,
    is_blocked_telegram_user_status,
    is_pending_telegram_user_status,
    normalize_telegram_user_status,
)

TELEGRAM_CMD_MAX_DAYS = 365
TELEGRAM_CMD_MIN_DAYS = 1

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

CALLBACK_ORDINI_EXPORT = "menu:ordini:export"

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
        "• 🧭 <code>/onboarding</code> → percorso guidato accesso e collegamento\n"
        "• 📊 <code>/stato</code> → stato bot e servizio\n"
        "• 👤 <code>/account</code> → stato account eBay e azioni collegamento\n"
        "• 🧾 <code>/support</code> → snapshot supporto del tuo tenant\n"
        "• 📦 <code>/ordini</code> → centro ordini e riepilogo azioni disponibili\n"
        "• 🧩 <code>/altre_azioni</code> → guida, preferenze e accesso\n"
        f"{admin_lines}\n"
        "<b>Guide dettagliate</b>\n"
        "• <code>/ordini</code> → tutte le azioni su ordini, report e notificabilità\n"
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
        "• <code>/onboarding</code> → percorso guidato accesso e collegamento\n"
        "• <code>/help</code> → guida rapida\n"
        "• <code>/request_access</code> → richiede accesso all'admin del bot\n\n"
        "<b>Preferenze</b>\n"
        "• <code>/support</code> → snapshot supporto del tuo tenant\n"
        "• <code>/settings</code> → preferenze chat e tenant\n"
        "• <code>/settings notifiche on</code> → attiva notifiche\n"
        "• <code>/settings notifiche off</code> → disattiva notifiche\n"
        "• <code>/settings filtro all|cf|vat</code> → filtro notifiche\n"
        "• <code>/settings dati</code> → privacy, export e cancellazione assistita\n"
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
            "Il tuo account Telegram è riconosciuto come admin globale.\n"
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
            "Il tuo account eBay risulta collegato, ma il token non è più utilizzabile.\n"
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
            "Il tuo accesso è approvato, ma non hai ancora collegato un account eBay.\n"
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
        "Il tuo accesso è attivo e l'account eBay risulta collegato.\n"
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
    account_row: list[InlineKeyboardButton] = [
        {"text": connect_label, "callback_data": CALLBACK_CONNECT},
        {"text": "Account", "callback_data": CALLBACK_ACCOUNT},
    ]
    orders_row: list[InlineKeyboardButton] = [
        {"text": "Ordini fiscali", "callback_data": CALLBACK_ULTIMI},
        {"text": "Tutti ordini", "callback_data": CALLBACK_TUTTI},
    ]
    status_row: list[InlineKeyboardButton] = [
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

    if command_name == "/ordini":
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
                    {"text": "Priorità", "callback_data": CALLBACK_ORDINI_PRIORITY},
                    {"text": "Export", "callback_data": CALLBACK_ORDINI_EXPORT},
                ],
                [{"text": "Account", "callback_data": CALLBACK_ACCOUNT}],
                [{"text": "Guida", "callback_data": CALLBACK_HELP}],
            ]
        }

    if command_name == "/account":
        notification_row: list[InlineKeyboardButton] = [
            {"text": notification_label, "callback_data": notification_callback},
            {"text": "Preferenze", "callback_data": CALLBACK_SETTINGS},
        ]
        account_actions: list[InlineKeyboardButton] = [
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

    if command_name == "/settings":
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
        keyboard: list[list[InlineKeyboardButton]] = [
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

    if command_name in {"/stato", "/ping"}:
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
        CALLBACK_ORDINI_EXPORT: "/ordini export 7 50",
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
        "/onboarding",
        "/stato",
        "/support",
        "/account",
        "/ordini",
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
            "Il tuo account Telegram è riconosciuto come admin globale."
        )
    if is_pending_telegram_user_status(canonical_status):
        return (
            "⏳ <b>Accesso in attesa</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "La tua richiesta è già in attesa di approvazione da parte dell'admin.\n"
            "Quando verrai approvato potrai usare <code>/account collega</code> "
            "e gli altri comandi.\n"
            "Puoi controllare il percorso con <code>/onboarding</code>."
        )
    if is_blocked_telegram_user_status(canonical_status):
        return (
            "⛔ <b>Accesso non approvato</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Il tuo accesso al bot è stato rifiutato o bloccato.\n"
            "Contatta l'admin se ritieni che sia un errore."
        )
    return (
        "🙋 <b>Accesso richiesto</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Questo bot usa un accesso approvato dall'admin.\n"
        "Usa <code>/request_access</code> per inviare la tua richiesta.\n"
        "Dopo l'approvazione potrai collegare eBay direttamente da Telegram.\n"
        "Per vedere tutti i passaggi usa <code>/onboarding</code>."
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
            "La tua richiesta è già in attesa di approvazione."
            "\nPuoi controllare i prossimi passaggi con <code>/onboarding</code>."
        )
    if admin_notified:
        return (
            "✅ <b>Richiesta inviata</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "L'admin è stato notificato. Ti scriverà il bot appena l'accesso verrà approvato.\n"
            "Nel frattempo puoi rileggere il percorso con <code>/onboarding</code>."
        )
    return (
        "✅ <b>Richiesta registrata</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "La tua richiesta è stata salvata, ma l'admin non è ancora "
        "raggiungibile da questa istanza.\n"
        "Nel frattempo puoi rileggere il percorso con <code>/onboarding</code>."
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
