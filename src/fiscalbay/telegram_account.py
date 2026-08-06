"""Telegram presentation for account."""

from __future__ import annotations

import html
from typing import Any, Mapping

from .models import (
    is_blocked_telegram_user_status,
    is_pending_telegram_user_status,
    normalize_telegram_user_status,
)
from .telegram_common import format_remote_revocation_line


def format_onboarding_guide(
    *,
    user_status: str,
    account_status: Mapping[str, Any] | None = None,
    is_admin: bool = False,
) -> str:
    if is_admin:
        return (
            "🧭 <b>Onboarding admin</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Il tuo account è admin: puoi invitare venditori selezionati con "
            "<code>/admin invite</code> e seguire le richieste con "
            "<code>/admin_users pending</code>.\n"
            "Il flusso resta approvato manualmente: nessuna registrazione libera."
        )

    canonical_status = normalize_telegram_user_status(user_status)
    account = account_status or {}
    raw_account_status = str(account.get("account_status") or "unlinked")
    raw_token_status = str(account.get("token_status") or "missing")
    ebay_user_id = html.escape(str(account.get("ebay_user_id") or "n/d"))
    environment = html.escape(str(account.get("environment") or "n/d"))

    if is_blocked_telegram_user_status(canonical_status):
        stage = "Accesso non approvato"
        current = "Il tuo accesso risulta bloccato o rifiutato."
        next_step = "Contatta l'admin se pensi che la valutazione vada rivista."
    elif is_pending_telegram_user_status(canonical_status):
        stage = "Richiesta in revisione"
        current = "Hai già inviato la richiesta: ora serve approvazione admin."
        next_step = "Attendi l'approvazione, poi torna qui e usa /account collega."
    elif canonical_status == "new":
        stage = "Invito ricevuto"
        current = "Sei stato visto dal bot, ma non hai ancora accesso operativo."
        next_step = "Usa /request_access dalla chat privata con il bot."
    elif raw_account_status in {"disconnected", "revoked"} or raw_token_status in {
        "revoked",
        "expired",
        "token_expired",
    }:
        stage = "Reconnect eBay"
        current = "Accesso bot approvato, ma il collegamento eBay richiede un nuovo consenso."
        next_step = "Usa /account collega per completare il reconnect eBay."
    elif raw_account_status != "linked":
        stage = "Collega eBay"
        current = "Accesso bot approvato, account eBay non ancora collegato."
        next_step = "Usa /account collega, completa il consenso e torna in chat."
    else:
        stage = "Operativo"
        current = "Accesso bot approvato e account eBay collegato."
        next_step = "Controlla /ordini fiscali o verifica lo stato con /support."

    checklist = (
        "1. chat privata con il bot\n"
        "2. richiesta accesso con <code>/request_access</code>\n"
        "3. approvazione manuale dell'admin\n"
        "4. collegamento eBay con <code>/account collega</code>\n"
        "5. verifica con <code>/account</code> e <code>/ordini fiscali</code>"
    )
    return (
        "🧭 <b>Onboarding FiscalBay</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Fase attuale: <code>{html.escape(stage)}</code>\n"
        f"Stato accesso: <code>{html.escape(canonical_status)}</code>\n"
        f"Account eBay: <code>{html.escape(raw_account_status)}</code> "
        f"token=<code>{html.escape(raw_token_status)}</code>\n"
        f"eBay: <code>{ebay_user_id}</code> • env=<code>{environment}</code>\n\n"
        f"{current}\n"
        f"Prossimo passo: {next_step}\n\n"
        "<b>Percorso selettivo</b>\n"
        f"{checklist}\n\n"
        "L'accesso resta approvato manualmente: il bot non apre registrazioni libere."
    )


def _format_personal_snapshot(account_status: Mapping[str, Any]) -> str:
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


def format_account_status(account_status: Mapping[str, Any]) -> str:
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
            "Il collegamento risulta revocato o non più utilizzabile. "
            "Prossimo passo: usa <code>/account collega</code> per autorizzare di nuovo eBay."
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
            "L'account è scollegato dal bot e il token locale è stato rimosso. "
            "Prossimo passo: usa <code>/account collega</code> per ricollegarlo."
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
            "Il collegamento esiste ancora, ma il token non è più utilizzabile. "
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


def format_reconnect_status(account_status: Mapping[str, Any]) -> str:
    linked = bool(account_status.get("linked"))
    raw_account_status = str(account_status.get("account_status") or "unlinked")
    raw_token_status = str(account_status.get("token_status") or "missing")
    reconnect_hint = format_reconnect_reason_hint(account_status)
    environment = html.escape(str(account_status.get("environment") or "n/d"))
    ebay_user_id = html.escape(str(account_status.get("ebay_user_id") or "n/d"))
    personal_snapshot = _format_personal_snapshot(account_status)

    if raw_account_status in {"revoked", "disconnected"}:
        next_step = (
            "usa <code>/account collega</code> per collegare di nuovo l'account"
            if raw_account_status == "disconnected"
            else "usa <code>/account collega</code> per autorizzare di nuovo eBay"
        )
        return (
            "🔁 <b>Reconnect status</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"📌 Stato attuale: <code>{html.escape(raw_account_status)}</code>\n"
            f"🪪 Ultimo utente eBay: <code>{ebay_user_id}</code>\n"
            f"🌍 Ambiente: <code>{environment}</code>\n"
            f"Prossima azione: {next_step}."
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


def format_reconnect_reason_hint(account_status: Mapping[str, Any]) -> str:
    outcome = str(account_status.get("latest_reconnect_outcome") or "").strip()
    reason = str(account_status.get("latest_reconnect_reason") or "").strip()
    if not outcome and not reason:
        return ""

    if outcome == "session_expired":
        label = "Sessione OAuth scaduta"
    elif outcome == "session_unavailable":
        label = "Link di collegamento non più valido"
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


def format_connect_status(connect_status: Mapping[str, Any]) -> str:
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
        "♻️ Sessione già pronta: puoi riaprire il link qui sotto.\n"
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
            + "3. torna in chat: il bot confermerà il risultato qui.\n"
            + "Se vuoi ricontrollare prima lo stato usa <code>/account reconnect</code>."
        )
    return (
        base
        + "⚠️ Il callback OAuth non è ancora configurato sul server.\n"
        + "La sessione è stata preparata, ma il servizio non può ancora "
        "aprire il flusso pubblico.\n"
        + "Questa è una limitazione di configurazione del server, non un errore del tuo account."
    )


def format_disconnect_status(disconnect_status: Mapping[str, Any]) -> str:
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
    remote_line = format_remote_revocation_line(
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
