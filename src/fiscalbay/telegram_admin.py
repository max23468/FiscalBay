"""Telegram presentation for admin."""

from __future__ import annotations

import html
import json
from typing import Any, Iterable, Mapping

from .models import (
    TelegramUser,
    normalize_telegram_user_status,
)
from .support_snapshot import SupportSnapshotReport


def format_admin_onboarding_invite(
    *,
    bot_url: str,
    telegram_user_id: int | None = None,
    user_status: str | None = None,
    account_status: Mapping[str, Any] | None = None,
) -> str:
    account = account_status or {}
    canonical_status = (
        normalize_telegram_user_status(user_status) if user_status is not None else "unknown"
    )
    raw_account_status = str(account.get("account_status") or "unlinked")
    raw_token_status = str(account.get("token_status") or "missing")
    target = str(telegram_user_id) if telegram_user_id is not None else "generico"
    safe_bot_url = html.escape(bot_url or "https://t.me/fiscalbay_bot", quote=True)
    if telegram_user_id is None:
        admin_next = "Invia il testo al venditore selezionato e attendi /request_access."
    elif canonical_status in {"new", "pending"}:
        admin_next = f"Quando sei pronto approva con /approve_user {telegram_user_id}."
    elif canonical_status == "approved" and raw_account_status != "linked":
        admin_next = "L'utente è approvato: chiedi di completare /account collega."
    elif canonical_status == "approved":
        admin_next = "L'utente sembra già operativo: verifica eventuali dubbi con /admin support."
    else:
        admin_next = "Controlla lo stato utente prima di procedere."
    invite_text = (
        "Ciao, ti ho invitato a usare FiscalBay.\n"
        f"Apri il bot: {bot_url or 'https://t.me/fiscalbay_bot'}\n"
        "1. scrivi /start in chat privata\n"
        "2. invia /request_access\n"
        "3. dopo approvazione, usa /account collega per collegare eBay\n"
        "4. verifica con /account e poi /ordini fiscali\n"
        "L'accesso è selettivo e viene approvato manualmente."
    )
    return (
        "🧭 <b>Invito onboarding selettivo</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Target: <code>{html.escape(target)}</code>\n"
        f"Stato utente: <code>{html.escape(canonical_status)}</code>\n"
        f"Account: <code>{html.escape(raw_account_status)}</code> "
        f"token=<code>{html.escape(raw_token_status)}</code>\n"
        f'Bot pubblico: <a href="{safe_bot_url}">{safe_bot_url}</a>\n\n'
        "<b>Messaggio da inviare</b>\n"
        f"<pre>{html.escape(invite_text)}</pre>\n"
        f"<b>Prossimo passo admin</b>\n{html.escape(admin_next)}"
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


def format_admin_data_request(
    *,
    telegram_user_id: int,
    username: str,
    display_name: str,
    chat_id: int,
    request_type: str,
    account_status: Mapping[str, Any],
) -> str:
    safe_username = html.escape(username or "n/d")
    safe_display_name = html.escape(display_name or "n/d")
    safe_request_type = html.escape(request_type)
    account_label = html.escape(str(account_status.get("account_status") or "unlinked"))
    token_label = html.escape(str(account_status.get("token_status") or "missing"))
    ebay_user_id = html.escape(str(account_status.get("ebay_user_id") or "n/d"))
    environment = html.escape(str(account_status.get("environment") or "n/d"))
    if request_type == "delete":
        admin_next_steps = (
            f"1. <code>/admin export {telegram_user_id}</code>\n"
            f"2. <code>/admin delete_tenant {telegram_user_id} confirm</code>"
        )
    else:
        admin_next_steps = f"<code>/admin export {telegram_user_id}</code>"
    return (
        "🗂️ <b>Richiesta dati utente</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Tipo richiesta: <code>{safe_request_type}</code>\n"
        f"🆔 Telegram user: <code>{telegram_user_id}</code>\n"
        f"👤 Username: <code>{safe_username}</code>\n"
        f"🏷️ Nome: <code>{safe_display_name}</code>\n"
        f"💬 Chat: <code>{chat_id}</code>\n"
        f"Account: <code>{account_label}</code> token=<code>{token_label}</code>\n"
        f"eBay: <code>{ebay_user_id}</code> • env=<code>{environment}</code>\n"
        "Azione richiesta all'admin:\n"
        f"{admin_next_steps}\n"
        "La richiesta utente non ha cancellato dati in automatico."
    )


def format_support_snapshot(report: SupportSnapshotReport, *, admin_view: bool = False) -> str:
    user = report.user
    account = report.account_status
    runtime = report.runtime_state
    memory = runtime.memory
    title = "🧾 <b>Support Snapshot Utente</b>" if admin_view else "🧾 <b>Support Snapshot</b>"
    user_name = "n/d"
    user_status = "unknown"
    if user is not None:
        user_name = user.display_name or user.username or "n/d"
        user_status = user.status
    latest_audit = report.recent_audit[0] if report.recent_audit else None
    latest_audit_text = (
        f"{latest_audit.created_at} {latest_audit.event_type}/{latest_audit.outcome}"
        if latest_audit is not None
        else "none"
    )
    recent_orders = [
        (
            "ultimo visto",
            memory.last_seen_order_id,
            memory.last_seen_order_created_at,
        ),
        (
            "ultimo notificato",
            memory.last_notified_order_id,
            memory.last_notified_order_created_at,
        ),
    ]
    order_lines = []
    for label, order_id, created_at in recent_orders:
        order_lines.append(
            f"• {label}: <code>{html.escape(order_id or 'none')}</code> "
            f"(<code>{html.escape(created_at or 'none')}</code>)"
        )
    action_lines = "\n".join(f"• {html.escape(action)}" for action in report.actions)
    tenant_snapshot_state = str(report.tenant_snapshot.get("operational_state") or "none")
    return (
        f"{title}\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🆔 Telegram user: <code>{report.telegram_user_id}</code>\n"
        f"👤 Utente: <code>{html.escape(user_name)}</code> "
        f"status=<code>{html.escape(user_status)}</code>\n"
        f"📌 Snapshot: <code>{html.escape(report.status)}</code>\n"
        f"Generato: <code>{html.escape(report.generated_at)}</code>\n\n"
        "👤 <b>Account</b>\n"
        f"• linked: <code>{str(bool(account.get('linked'))).lower()}</code>\n"
        f"• eBay: <code>{html.escape(str(account.get('ebay_user_id') or 'n/d'))}</code>\n"
        f"• env: <code>{html.escape(str(account.get('environment') or 'n/d'))}</code>\n"
        f"• account: <code>{html.escape(str(account.get('account_status') or 'unlinked'))}</code> "
        f"token=<code>{html.escape(str(account.get('token_status') or 'missing'))}</code>\n\n"
        "🔄 <b>Sync</b>\n"
        f"• last_check: <code>{html.escape(runtime.last_check or 'none')}</code>\n"
        f"• last_fetch_end: <code>{html.escape(memory.last_fetch_end or 'none')}</code>\n"
        f"• last_fetch_count: <code>{memory.last_fetch_count}</code>\n"
        f"• last_error: <code>{html.escape(runtime.last_error or 'none')}</code>\n\n"
        "📦 <b>Ordini recenti</b>\n" + "\n".join(order_lines) + "\n\n"
        "🧯 <b>Segnali supporto</b>\n"
        f"• retry_queue: <code>{len(report.retry_queue)}</code>\n"
        f"• latest_audit: <code>{html.escape(latest_audit_text)}</code>\n"
        f"• tenant_snapshot: <code>{html.escape(tenant_snapshot_state)}</code>\n\n"
        "➡️ <b>Azioni consigliate</b>\n"
        f"{action_lines}"
    )


def format_admin_user_list(
    users: Iterable[Mapping[str, Any] | TelegramUser],
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

    def render_user_line(user_row: Mapping[str, Any]) -> str:
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
        if isinstance(user_row, TelegramUser):
            continue
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
    rows: Iterable[Mapping[str, Any]],
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


def format_admin_tenant_export(export_payload: Mapping[str, Any]) -> str:
    user = export_payload.get("user") or {}
    account_status = export_payload.get("account_status") or {}
    tenant_id = html.escape(str(export_payload.get("telegram_user_id") or "n/d"))
    account_label = html.escape(str(account_status.get("account_status") or "unlinked"))
    token_label = html.escape(str(account_status.get("token_status") or "missing"))
    payload_json = json.dumps(export_payload, ensure_ascii=False, sort_keys=True)
    if len(payload_json) > 3200:
        payload_json = payload_json[:3200] + "\n...troncato nel messaggio Telegram..."
    return (
        "📤 <b>Export tenant</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Tenant: <code>{tenant_id}</code>\n"
        f"Status: <code>{html.escape(str(user.get('status') or 'missing'))}</code>\n"
        f"Account: <code>{account_label}</code> token=<code>{token_label}</code>\n"
        "I token sono esclusi: vengono mostrati solo flag di presenza e metadati.\n"
        f"<pre>{html.escape(payload_json)}</pre>"
    )


def format_admin_tenant_delete_status(
    *,
    telegram_user_id: int,
    deleted_counts: Mapping[str, int],
) -> str:
    total = int(deleted_counts.get("total", 0))
    rows = [
        "🧨 <b>Cancellazione tenant</b>",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        f"Tenant: <code>{telegram_user_id}</code>",
        f"Righe operative eliminate: <code>{total}</code>",
        "Audit log: <code>conservato</code> per tracciabilità minima.",
    ]
    for key in sorted(deleted_counts):
        if key == "total":
            continue
        rows.append(
            f"• {html.escape(str(key))}: <code>{html.escape(str(deleted_counts[key]))}</code>"
        )
    return "\n".join(rows)


def format_admin_dormant_review(
    rows: Iterable[Mapping[str, Any]],
    *,
    threshold_hours: int,
) -> str:
    rendered_rows = list(rows)
    if not rendered_rows:
        return (
            "🌙 <b>Review tenant dormienti</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"Nessun tenant operativo inattivo oltre <code>{threshold_hours}h</code>."
        )
    lines = [
        "🌙 <b>Review tenant dormienti</b>",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        f"Soglia: <code>{threshold_hours}h</code> • Totale: <code>{len(rendered_rows)}</code>",
        "Questa vista è solo review: non disattiva e non cancella nulla.",
    ]
    for row in rendered_rows:
        lines.append(
            "• "
            f"<code>{html.escape(str(row.get('telegram_user_id') or 'n/d'))}</code> "
            f"user=<code>{html.escape(str(row.get('username') or 'n/d'))}</code> "
            f"last=<code>{html.escape(str(row.get('last_activity_at') or 'n/d'))}</code> "
            f"age=<code>{html.escape(str(row.get('inactive_hours') or 'n/d'))}h</code>"
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


def format_admin_dashboard(dashboard: Mapping[str, Any]) -> str:
    product_metrics = dashboard.get("product_metrics") or {}
    metrics = dashboard.get("metrics") or {}
    queue = dashboard.get("queue") or {}
    release = dashboard.get("release") or {}
    alerts = dashboard.get("alerts") or []
    recent_activity = list(dashboard.get("recent_activity") or [])
    mode = html.escape(str(dashboard.get("service_mode") or "normal"))
    package_version = html.escape(str(release.get("package_version") or "unknown"))
    git_tag = html.escape(str(release.get("git_tag") or "none"))
    git_latest_tag = html.escape(str(release.get("git_latest_tag") or "none"))
    git_commit = html.escape(str(release.get("git_short_commit") or "none"))
    git_branch = html.escape(str(release.get("git_branch") or "none"))
    release_status = html.escape(str(release.get("release_status") or "unknown"))
    git_dirty = release.get("git_dirty")
    git_dirty_label = "unknown" if git_dirty is None else ("si" if bool(git_dirty) else "no")
    orders_read = html.escape(str(product_metrics.get("orders_read", 0)))
    orders_with_fiscal = html.escape(str(product_metrics.get("orders_with_fiscal_identifier", 0)))
    fiscal_rate = html.escape(str(product_metrics.get("fiscal_identifier_rate_percent", 0)))
    notifications_sent = html.escape(str(product_metrics.get("notifications_sent", 0)))
    notification_rate = html.escape(str(product_metrics.get("notification_rate_percent", 0)))
    tenant_users = html.escape(str(product_metrics.get("tenant_users", 0)))
    active_token_sets = html.escape(str(product_metrics.get("active_token_sets", 0)))
    linked_rate = html.escape(str(product_metrics.get("approved_to_linked_rate_percent", 0)))
    oauth_failures_recent = html.escape(str(metrics.get("oauth_failures_recent", 0)))
    pending = html.escape(str(metrics.get("pending_users", 0)))
    approved = html.escape(str(metrics.get("approved_users", 0)))
    linked = html.escape(str(metrics.get("linked_users", 0)))
    approved_unlinked = html.escape(str(metrics.get("approved_without_link", 0)))
    inactive = html.escape(str(metrics.get("inactive_users", 0)))
    pending_stale = html.escape(str(metrics.get("pending_stale", 0)))
    revoked_stale = html.escape(str(metrics.get("revoked_stale", 0)))
    oauth_pending_expired = html.escape(str(metrics.get("oauth_pending_expired", 0)))
    queue_pending = html.escape(str(queue.get("pending", 0)))
    queue_failed = html.escape(str(queue.get("failed", 0)))
    sections = [
        "🧭 <b>Admin Dashboard</b>",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        f"🛠️ Modalità servizio: <code>{mode}</code>",
        (f"🏷️ Release: <code>{package_version}</code> • status <code>{release_status}</code>"),
        (
            f"🔖 Tag: <code>{git_tag}</code> • latest <code>{git_latest_tag}</code> • "
            f"commit <code>{git_commit}</code>"
        ),
        f"🌿 Branch: <code>{git_branch}</code> • dirty: <code>{git_dirty_label}</code>",
        "\n📈 <b>Metriche prodotto</b>",
        f"📦 Ordini letti: <code>{orders_read}</code> • fiscali: "
        f"<code>{orders_with_fiscal}</code> (<code>{fiscal_rate}%</code>)",
        f"📩 Notifiche inviate: <code>{notifications_sent}</code> "
        f"(<code>{notification_rate}%</code> sugli ordini fiscali)",
        f"👥 Tenant: <code>{tenant_users}</code> • token attivi: "
        f"<code>{active_token_sets}</code> • linked/approved: <code>{linked_rate}%</code>",
        "\n🧭 <b>Governance</b>",
        f"🕓 Pending: <code>{pending}</code> • ✅ Approved: <code>{approved}</code>",
        f"🔗 Tenant linked: <code>{linked}</code> • "
        f"⌛ Approved non operativi: <code>{approved_unlinked}</code>",
        f"🌙 Tenant dormienti: <code>{inactive}</code>",
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
    if recent_activity:
        sections.append("\n🧾 <b>Attività 24h</b>")
        sections.extend(
            "• "
            f"<code>{html.escape(str(row.get('event_type') or 'unknown'))}</code>: "
            f"<code>{html.escape(str(row.get('count') or 0))}</code>"
            for row in recent_activity
        )
    sections.append("Storico operativo: <code>/admin storico [telegram_user_id] [limit]</code>.")
    return "\n".join(sections)


def _admin_next_action_for_row(row: Mapping[str, Any]) -> str:
    status = str(row.get("status") or "")
    operational_state = str(row.get("operational_state") or "")
    account_status = str(row.get("account_status") or "unlinked")
    token_status = str(row.get("token_status") or "missing")
    if status == "pending":
        return "approva/rifiuta"
    if status == "blocked":
        return "riattiva se serve"
    if operational_state == "reconnect_required" or token_status in {
        "revoked",
        "expired",
        "token_expired",
    }:
        return "chiedi reconnect"
    if status == "approved" and account_status != "linked":
        return "invita connect"
    if operational_state == "ready":
        return "monitora"
    if status == "admin":
        return "admin"
    return "review"


def format_admin_history(
    rows: Iterable[Mapping[str, Any]],
    *,
    target_user_id: int | None,
    limit: int,
) -> str:
    rendered_rows = list(rows)
    target = "tutti" if target_user_id is None else str(target_user_id)
    if not rendered_rows:
        return (
            "🧾 <b>Storico operativo</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"Filtro tenant: <code>{html.escape(target)}</code>\n"
            "Nessun evento audit recente da mostrare."
        )
    lines = [
        "🧾 <b>Storico operativo</b>",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        f"Filtro tenant: <code>{html.escape(target)}</code> • limite <code>{limit}</code>",
    ]
    for row in rendered_rows:
        actor = html.escape(str(row.get("actor_telegram_user_id") or "n/d"))
        target_id = html.escape(str(row.get("target_telegram_user_id") or "n/d"))
        event_type = html.escape(str(row.get("event_type") or "unknown"))
        outcome = html.escape(str(row.get("outcome") or "n/d"))
        created_at = html.escape(str(row.get("created_at") or "n/d"))
        detail = html.escape(str(row.get("detail") or ""))
        detail_text = f" • <code>{detail}</code>" if detail else ""
        lines.append(
            f"• <code>{created_at}</code> "
            f"event=<code>{event_type}</code> outcome=<code>{outcome}</code> "
            f"actor=<code>{actor}</code> target=<code>{target_id}</code>"
            f"{detail_text}"
        )
    return "\n".join(lines)


def _format_admin_env_status(rows: Iterable[Mapping[str, Any]]) -> str:
    parts = []
    for row in rows:
        name = html.escape(str(row.get("name") or "unknown"))
        status = "ok" if bool(row.get("present")) else "missing"
        parts.append(f"<code>{name}</code>=<code>{status}</code>")
    return ", ".join(parts) if parts else "n/d"


def format_admin_security_report(report: Mapping[str, Any]) -> str:
    env_file = report.get("env_file") or {}
    state_db = report.get("state_db") or {}
    backup = report.get("backup") or {}
    restore_drill = report.get("restore_drill") or {}
    alerts = [html.escape(str(item)) for item in report.get("alerts") or []]
    warnings = [html.escape(str(item)) for item in report.get("warnings") or []]
    required_env = _format_admin_env_status(report.get("required_env") or [])
    recommended_env = _format_admin_env_status(report.get("recommended_env") or [])
    status = html.escape(str(report.get("status") or "unknown"))
    env_mode = html.escape(str(env_file.get("mode") or "missing"))
    env_expected = html.escape(str(env_file.get("expected_mode") or "600"))
    env_owner = html.escape(f"{env_file.get('uid')}:{env_file.get('gid')}")
    env_expected_owner = html.escape(
        f"{env_file.get('expected_uid')}:{env_file.get('expected_gid')}"
    )
    state_mode = html.escape(str(state_db.get("mode") or "missing"))
    state_expected = html.escape(str(state_db.get("expected_mode") or "600_or_660"))
    state_owner = html.escape(f"{state_db.get('uid')}:{state_db.get('gid')}")
    state_expected_owner = html.escape(
        f"{state_db.get('expected_uid')}:{state_db.get('expected_gid')}"
    )
    public_service_model = html.escape(str(report.get("public_service_model") or "n/d"))
    backup_age = html.escape(str(backup.get("age_hours")))
    backup_max = html.escape(str(backup.get("max_age_hours")))
    restore_age = html.escape(str(restore_drill.get("age_hours")))
    restore_max = html.escape(str(restore_drill.get("max_age_hours")))
    plaintext_label = "si" if bool(report.get("plaintext_tenant_tokens_enabled")) else "no"
    allow_all_label = "si" if bool(report.get("telegram_allow_all")) else "no"
    admin_label = "si" if bool(report.get("admin_configured")) else "no"
    lines = [
        "🛡️ <b>Security operations</b>",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        f"Stato: <code>{status}</code>",
        f"Alert: <code>{', '.join(alerts) if alerts else 'none'}</code>",
        f"Warning: <code>{', '.join(warnings) if warnings else 'none'}</code>",
        "\n🔐 <b>Segreti e permessi</b>",
        f".env mode: <code>{env_mode}</code> atteso <code>{env_expected}</code>",
        f".env owner: <code>{env_owner}</code> atteso <code>{env_expected_owner}</code>",
        f"state.db mode: <code>{state_mode}</code> atteso <code>{state_expected}</code>",
        f"state.db owner: <code>{state_owner}</code> atteso <code>{state_expected_owner}</code>",
        f"Env richieste: {required_env}",
        f"Env consigliate: {recommended_env}",
        f"Plaintext tenant token: <code>{plaintext_label}</code>",
        f"Allow all Telegram: <code>{allow_all_label}</code> • admin: <code>{admin_label}</code>",
        f"Profilo pubblico: <code>{public_service_model}</code>",
        "\n🧯 <b>Recovery</b>",
        f"Backup recente: <code>{backup_age}</code>h / max <code>{backup_max}</code>h",
        f"Restore drill: <code>{restore_age}</code>h / max <code>{restore_max}</code>h",
        "CLI: <code>fiscalbay-security-check</code>.",
    ]
    return "\n".join(lines)


def _format_admin_scale_triggers(rows: Iterable[Mapping[str, Any]]) -> list[str]:
    rendered: list[str] = []
    for row in rows:
        name = html.escape(str(row.get("name") or "unknown"))
        current = html.escape(str(row.get("current") or 0))
        limit = html.escape(str(row.get("limit") or 0))
        usage = html.escape(str(row.get("usage_percent") or 0))
        level = html.escape(str(row.get("level") or "ok"))
        rendered.append(
            f"• <code>{name}</code>: <code>{current}</code>/<code>{limit}</code> "
            f"(<code>{usage}%</code>) livello <code>{level}</code>"
        )
    return rendered


def format_admin_scale_readiness(report: Mapping[str, Any]) -> str:
    status = html.escape(str(report.get("status") or "unknown"))
    summary = html.escape(str(report.get("summary") or ""))
    signals = [html.escape(str(item)) for item in report.get("signals") or []]
    next_actions = [html.escape(str(item)) for item in report.get("next_actions") or []]
    migration_plan = [html.escape(str(item)) for item in report.get("migration_plan") or []]
    lines = [
        "📏 <b>Scale readiness</b>",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        f"Stato: <code>{status}</code>",
        f"Sintesi: {summary}",
        f"Segnali: <code>{', '.join(signals) if signals else 'none'}</code>",
        "\n📊 <b>Trigger</b>",
    ]
    trigger_lines = _format_admin_scale_triggers(report.get("triggers") or [])
    lines.extend(trigger_lines or ["• Nessun trigger disponibile."])
    lines.append("\n➡️ <b>Prossime azioni</b>")
    lines.extend(f"• {action}" for action in next_actions)
    lines.append("\n🧭 <b>Piano migrazione pronto</b>")
    lines.extend(f"• {step}" for step in migration_plan[:4])
    lines.append("CLI: <code>fiscalbay-scale-check</code>.")
    return "\n".join(lines)


def format_admin_maintenance_overview(payload: Mapping[str, Any]) -> str:
    dashboard = payload.get("dashboard") or {}
    metrics = dashboard.get("metrics") or {}
    release = dashboard.get("release") or {}
    queue = payload.get("queue") or {}
    oauth = payload.get("oauth_sessions") or {}
    retention = payload.get("retention") or {}
    queue_samples = list(payload.get("queue_samples") or [])
    mode = html.escape(str(payload.get("service_mode") or "normal"))
    retry_backlog = html.escape(str(payload.get("retry_backlog", 0)))
    package_version = html.escape(str(release.get("package_version") or "unknown"))
    release_status = html.escape(str(release.get("release_status") or "unknown"))
    git_tag = html.escape(str(release.get("git_tag") or "none"))
    git_latest_tag = html.escape(str(release.get("git_latest_tag") or "none"))
    git_commit = html.escape(str(release.get("git_short_commit") or "none"))
    commits_since_tag = release.get("git_commits_since_latest_tag")
    commits_since_tag_text = "unknown" if commits_since_tag is None else str(commits_since_tag)
    oauth_retention_overdue = int(retention.get("oauth_terminal_overdue", 0)) + int(
        retention.get("oauth_pending_overdue", 0)
    )
    lines = [
        "🧹 <b>Maintenance Overview</b>",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        f"🛠️ Modalità servizio: <code>{mode}</code>",
        (
            f"🏷️ Release: <code>{package_version}</code> • "
            f"<code>{release_status}</code> • tag <code>{git_tag}</code>"
        ),
        (
            f"🔖 Latest tag: <code>{git_latest_tag}</code> • "
            f"commit <code>{git_commit}</code> • ahead "
            f"<code>{html.escape(commits_since_tag_text)}</code>"
        ),
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
        (
            f"🗄️ Retention: audit arretrati "
            f"<code>{html.escape(str(retention.get('audit_overdue', 0)))}</code> • "
            f"OAuth arretrati <code>{html.escape(str(oauth_retention_overdue))}</code>"
        ),
    ]
    if retention.get("last_pruned_at"):
        lines.append(
            "• retention last_pruned="
            f"<code>{html.escape(str(retention.get('last_pruned_at')))}</code>"
        )
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
        lines.append("\n🎯 <b>Priorità consigliate</b>")
        lines.extend(f"• {action}" for action in quick_actions)
    lines.append(
        "Usa <code>/admin</code>, <code>/tenant_health</code> e "
        "<code>/admin_users reconnect</code> per approfondire. "
        "Per audit recente usa <code>/admin storico [id]</code>."
    )
    return "\n".join(lines)


def format_tenant_health(rows: Iterable[Mapping[str, Any]]) -> str:
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
        next_action = _admin_next_action_for_row(row)
        lines.append(
            "• "
            f"<code>{html.escape(str(row.get('telegram_user_id') or 'n/d'))}</code> "
            f"access=<code>{html.escape(str(row.get('status') or 'n/d'))}</code> "
            f"account=<code>{html.escape(str(row.get('account_status') or 'unlinked'))}</code> "
            f"token=<code>{html.escape(str(row.get('token_status') or 'missing'))}</code> "
            f"notif=<code>{html.escape(str(row.get('subscription_count') or 0))}</code> "
            f"last=<code>{html.escape(str(row.get('last_issue') or 'none'))}</code> "
            f"activity=<code>{html.escape(str(row.get('last_activity_at') or 'n/d'))}</code> "
            f"next=<code>{html.escape(next_action)}</code>"
        )
    return "\n".join(lines)


def format_admin_command_help() -> str:
    return (
        "🧭 <b>Admin</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Usa <code>/admin</code> come cruscotto operativo.\n"
        "• <code>/admin</code> → dashboard e alert prodotto\n"
        "• <code>/admin invite [id]</code> → testo invito onboarding selettivo\n"
        "• <code>/admin manutenzione</code> → backlog operativo e cleanup\n"
        "• <code>/admin dormant [ore]</code> → review tenant dormienti\n"
        "• <code>/admin export &lt;id&gt;</code> → export tenant senza segreti\n"
        "• <code>/admin support &lt;id&gt;</code> → snapshot supporto utente\n"
        "• <code>/admin delete_tenant &lt;id&gt; confirm</code> → cancellazione operativa\n"
        "• <code>/admin service normal|maintenance|degraded</code> → modalità servizio\n"
        "• <code>/admin scala</code> → readiness SQLite/Postgres\n"
        "• <code>/admin sicurezza</code> → check security operations\n"
        "• <code>/admin storico [id] [limit]</code> → audit operativo recente\n"
        "• <code>/admin_users all|pending|unlinked|reconnect|inactive</code> → liste utenti\n"
        "• <code>/tenant_health [user_id]</code> → salute tenant compatta\n"
        "• <code>/approve_user &lt;id&gt;</code> / <code>/reject_user &lt;id&gt;</code> → accessi"
    )
