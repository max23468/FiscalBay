"""Telegram presentation for settings."""

from __future__ import annotations

import html
from typing import Any, Mapping

from .models import (
    normalize_telegram_user_status,
)
from .telegram_common import format_remote_revocation_line


def format_data_request_status(
    *,
    request_type: str,
    admin_notified: bool,
    account_status: Mapping[str, Any],
) -> str:
    safe_request_type = html.escape(request_type)
    account_label = html.escape(str(account_status.get("account_status") or "unlinked"))
    token_label = html.escape(str(account_status.get("token_status") or "missing"))
    notified_text = "notificato" if admin_notified else "non raggiungibile ora"
    if request_type == "delete":
        next_step = (
            "l'admin deve prima esportare i dati senza segreti e poi confermare "
            "la cancellazione locale del tenant"
        )
    else:
        next_step = "l'admin può preparare un export operativo senza segreti"
    return (
        "🗂️ <b>Richiesta dati registrata</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Tipo richiesta: <code>{safe_request_type}</code>\n"
        f"Admin: <code>{notified_text}</code>\n"
        f"Account locale: <code>{account_label}</code> token=<code>{token_label}</code>\n"
        "Azione automatica: <code>nessuna cancellazione</code>\n"
        f"Prossimo passo: {next_step}.\n"
        "Puoi scollegare subito eBay con <code>/account scollega</code> oppure "
        "disattivare l'uso del bot con <code>/settings lascia</code>."
    )


def format_data_request_help(policy_status: Mapping[str, Any]) -> str:
    audit_retention_days = html.escape(str(policy_status.get("audit_retention_days", 180)))
    oauth_retention_days = html.escape(str(policy_status.get("oauth_session_retention_days", 30)))
    operation_retention_days = html.escape(
        str(policy_status.get("operation_queue_retention_days", 30))
    )
    return (
        "🗂️ <b>Dati e privacy</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "FiscalBay conserva solo dati operativi minimi: identità Telegram, mapping "
        "account eBay, token cifrati, preferenze notifiche, stato runtime e audit.\n"
        "Non mantiene uno storico locale completo degli ordini: i dettagli ordine "
        "sono letti da eBay e mostrati quando servono.\n"
        f"Retention audit: <code>{audit_retention_days} giorni</code>\n"
        f"Retention sessioni OAuth concluse: <code>{oauth_retention_days} giorni</code>\n"
        f"Retention operation queue concluse: <code>{operation_retention_days} giorni</code>\n"
        "Azioni disponibili:\n"
        "• <code>/settings dati export</code> → chiedi export locale senza segreti\n"
        "• <code>/settings dati cancellazione</code> → chiedi cancellazione dati locali\n"
        "La cancellazione resta confermata dall'admin e mantiene l'audit minimo "
        "fino alla retention."
    )


def format_service_status(service_status: Mapping[str, Any]) -> str:
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
        f"🛠️ Modalità servizio: <code>{mode}</code>\n"
        f"📖 Consultazione disponibile: <code>{read_available}</code>\n"
        f"✍️ Azioni operative disponibili: <code>{write_available}</code>\n"
        f"🔗 Nuovi collegamenti eBay disponibili: <code>{connect_available}</code>\n"
        "Se non sei ancora approvato usa <code>/request_access</code>. "
        "Per la governance sintetica usa <code>/settings policy</code>."
    )


def format_policy_status(policy_status: Mapping[str, Any]) -> str:
    mode = html.escape(str(policy_status.get("mode") or "normal"))
    service_model = html.escape(str(policy_status.get("service_model") or "approved_public_small"))
    web_role = html.escape(str(policy_status.get("web_role") or "onboarding_callback_support"))
    onboarding_hosting = html.escape(
        str(policy_status.get("onboarding_hosting") or "vps_oauth_callback")
    )
    approved_users = html.escape(str(policy_status.get("approved_users", 0)))
    approved_limit = html.escape(str(policy_status.get("approved_users_limit", 0)))
    linked_accounts = html.escape(str(policy_status.get("linked_accounts", 0)))
    linked_limit = html.escape(str(policy_status.get("linked_accounts_limit", 0)))
    token_sets = html.escape(str(policy_status.get("active_token_sets", 0)))
    token_limit = html.escape(str(policy_status.get("active_token_sets_limit", 0)))
    sqlite_limit_mb = html.escape(str(policy_status.get("sqlite_db_limit_mb", 0)))
    rate_limit_enabled = bool(policy_status.get("rate_limit_enabled", True))
    request_limit = html.escape(str(policy_status.get("rate_limit_request_access_seconds", 0)))
    connect_limit = html.escape(str(policy_status.get("rate_limit_connect_seconds", 0)))
    admin_limit = html.escape(str(policy_status.get("rate_limit_admin_mutation_seconds", 0)))
    rate_limit_status = "attivo" if rate_limit_enabled else "disattivato"
    return (
        "📜 <b>Policy Servizio</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Servizio pubblico piccolo e curato, Telegram first e ad accesso approvato.\n"
        "Accesso operativo soggetto ad approvazione di un solo admin globale.\n"
        "Notifiche attive di default per utenti approvati, "
        "salvo scelta utente o intervento admin.\n"
        f"Modello: <code>{service_model}</code>\n"
        f"Web: <code>{web_role}</code> su <code>{onboarding_hosting}</code>\n"
        f"Utenti approvati: <code>{approved_users}/{approved_limit}</code>\n"
        f"Account collegati: <code>{linked_accounts}/{linked_limit}</code>\n"
        f"Token attivi: <code>{token_sets}/{token_limit}</code>\n"
        f"SQLite resta accettabile entro <code>{sqlite_limit_mb}MB</code> "
        "e bassa concorrenza.\n"
        f"Rate limiting per utente: <code>{rate_limit_status}</code> "
        f"(accesso {request_limit}s, account {connect_limit}s, admin {admin_limit}s).\n"
        "Il bot mostra solo dati fiscali realmente restituiti da eBay.\n"
        "Privacy e dati: <code>/settings dati</code> mostra dati conservati, retention "
        "e richieste assistite di export/cancellazione.\n"
        f"Modalità servizio corrente: <code>{mode}</code>\n"
        "Riferimento operativo: <code>docs/SERVICE_GOVERNANCE.md</code> nel repository."
    )


def format_leave_status(leave_status: Mapping[str, Any]) -> str:
    ebay_user_id = html.escape(str(leave_status.get("ebay_user_id", "n/d")))
    environment = html.escape(str(leave_status.get("environment", "n/d")))
    account_was_linked = bool(leave_status.get("account_was_linked", False))
    remote_revocation_status = html.escape(
        str(leave_status.get("remote_revocation_status", "not_attempted"))
    )
    remote_revocation_detail = html.escape(str(leave_status.get("remote_revocation_detail", "")))
    remote_line = format_remote_revocation_line(
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


def format_notifications_status(notification_status: Mapping[str, Any]) -> str:
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


def format_settings_status(settings_status: Mapping[str, Any]) -> str:
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
            "controlla ordini e notificabilità con <code>/ordini fiscali</code> "
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
        "<code>/settings lascia</code>, <code>/settings dati</code>, "
        "<code>/settings notifiche on</code>, "
        "<code>/settings notifiche off</code>."
    )
