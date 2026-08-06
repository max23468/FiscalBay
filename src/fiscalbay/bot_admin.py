"""Telegram bot admin functions."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Callable, cast

from . import bot_common
from .bot_authz import ADMIN_ONLY_COMMANDS
from .bot_authz import load_user_status as _load_user_status
from .bot_common import (
    ADMIN_MUTATION_COMMANDS,
    SERVICE_MODE_NORMAL,
    SERVICE_MODES,
    _append_audit_log,
    _command_rate_limit_remaining_seconds,
    _format_cooldown_message,
    _iso_days_ago,
    _load_service_state,
    _mark_command_usage,
    _notify_user_access_status,
    _now_utc_iso,
    _parse_iso_timestamp,
    _save_service_state,
    _seconds_between,
    load_recent_audit_entries,
    send_message,
)
from .config import (
    load_retention_config,
)
from .models import (
    CAPABILITY_USE_BOT,
    TELEGRAM_USER_STATUS_ADMIN,
    TELEGRAM_USER_STATUS_APPROVED,
    TELEGRAM_USER_STATUS_BLOCKED,
    TELEGRAM_USER_STATUS_NEW,
    TELEGRAM_USER_STATUS_PENDING,
    AuditLogEntry,
    TelegramConfig,
    TelegramUser,
    has_telegram_user_capability,
    is_blocked_telegram_user_status,
    is_pending_telegram_user_status,
    normalize_telegram_user_status,
)
from .reconcile import enqueue_apply_user_access_operation, process_pending_operations
from .release_info import collect_release_info
from .scale_readiness import build_scale_readiness_report
from .security_ops import build_security_ops_report
from .services.tenant_status import rebuild_all_tenant_status_snapshots
from .storage.queues import load_operation_queue_entries, summarize_operation_queue
from .storage.retention import (
    delete_tenant_data,
    export_tenant_data,
    summarize_multi_tenant_readiness,
    summarize_oauth_link_sessions,
    summarize_retention_backlog,
)
from .storage.runtime import (
    load_kv_value,
    load_runtime_state,
    load_tenant_runtime_state,
    save_kv_value,
    summarize_retry_queue_backlog,
)
from .storage.users import (
    load_telegram_user,
    load_telegram_users,
    load_tenant_status_snapshots,
    resolve_primary_chat_id,
    summarize_tenant_account_status,
    update_telegram_user_status,
    upsert_telegram_user,
)
from .support_snapshot import build_support_snapshot
from .telegram_admin import (
    format_admin_access_request,
    format_admin_command_help,
    format_admin_dashboard,
    format_admin_dormant_review,
    format_admin_history,
    format_admin_maintenance_overview,
    format_admin_onboarding_invite,
    format_admin_scale_readiness,
    format_admin_security_report,
    format_admin_status_update,
    format_admin_tenant_delete_status,
    format_admin_tenant_export,
    format_admin_user_list,
    format_admin_watchlist,
    format_support_snapshot,
    format_tenant_health,
)
from .telegram_commands import (
    build_admin_approval_markup,
    format_access_request_status,
    format_access_required_status,
)

LOGGER = logging.getLogger("fiscalbay.telegram_bot")

DEFAULT_ADMIN_SUMMARY_INTERVAL_SECONDS = 6 * 60 * 60

PENDING_STALE_HOURS = 48

UNLINKED_STALE_HOURS = 72

REVOKED_STALE_HOURS = 72

INACTIVE_TENANT_HOURS = 96


def handle_access_request(
    command: str,
    *,
    telegram_config: TelegramConfig,
    chat_id: int,
    telegram_user_id: int | None,
    is_admin_user: bool,
    user_status: str | None,
    now: datetime,
    now_iso: str,
) -> list[str] | None:
    if command != "/request_access":
        return None
    if telegram_config.admin_user_id is None:
        return [
            "✅ <b>Accesso libero</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Questa istanza del bot non richiede approvazione admin."
        ]
    if telegram_user_id is None:
        return [format_access_request_status(admin_notified=False)]
    if is_admin_user:
        return [format_access_required_status(TELEGRAM_USER_STATUS_ADMIN, is_admin=True)]
    if has_telegram_user_capability(user_status, CAPABILITY_USE_BOT):
        return [
            "✅ <b>Accesso già approvato</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Il tuo account è già abilitato all'uso del bot."
        ]
    if is_blocked_telegram_user_status(user_status):
        return [format_access_request_status(blocked=True)]
    remaining = _command_rate_limit_remaining_seconds(
        telegram_config.state_path,
        telegram_user_id=telegram_user_id,
        command=command,
        now=now,
    )
    if remaining > 0:
        return [_format_cooldown_message(command, remaining)]

    existing_user = load_telegram_user(telegram_config.state_path, telegram_user_id)
    if existing_user is None:
        upsert_telegram_user(
            telegram_config.state_path,
            TelegramUser(
                telegram_user_id=telegram_user_id,
                telegram_chat_id=chat_id,
                username="",
                display_name="",
                created_at=now_iso,
                status=TELEGRAM_USER_STATUS_PENDING,
            ),
        )
        existing_user = load_telegram_user(telegram_config.state_path, telegram_user_id)
    elif is_pending_telegram_user_status(existing_user.status):
        _append_audit_log(
            telegram_config,
            event_type="request_access",
            created_at=now_iso,
            actor_telegram_user_id=telegram_user_id,
            target_telegram_user_id=telegram_user_id,
            telegram_chat_id=chat_id,
            outcome="already_pending",
            details={"user_status": existing_user.status},
        )
        return [format_access_request_status(already_pending=True)]
    else:
        update_telegram_user_status(
            telegram_config.state_path,
            telegram_user_id,
            TELEGRAM_USER_STATUS_PENDING,
            updated_at=now_iso,
        )
        existing_user = load_telegram_user(telegram_config.state_path, telegram_user_id)

    admin_notified = False
    admin_chat_id = resolve_primary_chat_id(
        telegram_config.state_path,
        telegram_config.admin_user_id,
    )
    if admin_chat_id is not None and existing_user is not None:
        bot_common.send_message(
            telegram_config.token,
            admin_chat_id,
            format_admin_access_request(
                telegram_user_id=telegram_user_id,
                username=existing_user.username,
                display_name=existing_user.display_name,
                chat_id=chat_id,
            ),
            reply_markup=build_admin_approval_markup(telegram_user_id),
        )
        admin_notified = True
    _append_audit_log(
        telegram_config,
        event_type="request_access",
        created_at=now_iso,
        actor_telegram_user_id=telegram_user_id,
        target_telegram_user_id=telegram_user_id,
        telegram_chat_id=chat_id,
        outcome="pending",
        details={"admin_notified": admin_notified},
    )
    _mark_command_usage(
        telegram_config.state_path,
        telegram_user_id=telegram_user_id,
        command=command,
        timestamp=now_iso,
    )
    return [format_access_request_status(admin_notified=admin_notified)]


def _admin_summary_key() -> str:
    return "admin_summary:last_sent_at"


def _admin_summary_hash_key() -> str:
    return "admin_summary:last_payload_hash"


def _build_user_row(
    telegram_config: TelegramConfig,
    *,
    user: TelegramUser,
) -> dict[str, Any]:
    account_status = summarize_tenant_account_status(
        telegram_config.state_path,
        user.telegram_user_id,
        "",
    )
    operational_state = "waiting_connect"
    if user.status == TELEGRAM_USER_STATUS_PENDING:
        operational_state = "pending"
    elif user.status == TELEGRAM_USER_STATUS_BLOCKED:
        operational_state = "blocked"
    elif user.status == TELEGRAM_USER_STATUS_ADMIN:
        operational_state = "admin"
    else:
        raw_account_status = str(account_status.get("account_status") or "unlinked")
        raw_token_status = str(account_status.get("token_status") or "missing")
        if raw_account_status == "linked" and raw_token_status == "active":
            operational_state = "ready"
        elif raw_account_status in {"revoked"} or raw_token_status in {
            "revoked",
            "expired",
            "token_expired",
        }:
            operational_state = "reconnect_required"
    runtime_state = load_tenant_runtime_state(
        telegram_config.state_path,
        user.telegram_user_id,
    )
    last_activity_at = (
        runtime_state.memory.last_notified_order_created_at
        or runtime_state.memory.last_seen_order_created_at
        or runtime_state.memory.last_fetch_end
        or user.created_at
        or ""
    )
    last_issue = str(account_status.get("latest_reconnect_outcome") or "")
    if not last_issue and operational_state != "ready":
        last_issue = operational_state
    return {
        "telegram_user_id": user.telegram_user_id,
        "telegram_chat_id": user.telegram_chat_id,
        "username": user.username,
        "display_name": user.display_name,
        "status": user.status,
        "operational_state": operational_state,
        "account_status": account_status.get("account_status"),
        "token_status": account_status.get("token_status"),
        "environment": account_status.get("environment"),
        "ebay_user_id": account_status.get("ebay_user_id"),
        "subscription_count": account_status.get("subscription_count", 0),
        "chat_count": account_status.get("chat_count", 0),
        "last_issue": last_issue or "none",
        "last_activity_at": last_activity_at,
        "created_at": user.created_at or "",
    }


def _build_user_rows(telegram_config: TelegramConfig) -> list[dict[str, Any]]:
    users = load_telegram_users(telegram_config.state_path)
    snapshots = load_tenant_status_snapshots(telegram_config.state_path)
    typed_snapshots = [cast(dict[str, Any], row) for row in snapshots]
    snapshot_ids = {int(row.get("telegram_user_id") or 0) for row in typed_snapshots}
    user_ids = {user.telegram_user_id for user in users}
    if user_ids and user_ids.issubset(snapshot_ids):
        return [row for row in typed_snapshots if int(row.get("telegram_user_id") or 0) in user_ids]
    rebuild_all_tenant_status_snapshots(telegram_config.state_path, now_iso=_now_utc_iso())
    snapshots = load_tenant_status_snapshots(telegram_config.state_path)
    if snapshots:
        return [
            cast(dict[str, Any], row)
            for row in snapshots
            if int(str(row.get("telegram_user_id") or 0)) in user_ids
        ]
    return [_build_user_row(telegram_config, user=user) for user in users]


def _filter_user_rows(
    telegram_config: TelegramConfig,
    predicate: Callable[[dict[str, Any]], bool],
) -> list[dict[str, Any]]:
    return [row for row in _build_user_rows(telegram_config) if predicate(row)]


def _build_inactive_user_rows(
    telegram_config: TelegramConfig,
    *,
    threshold_hours: int = INACTIVE_TENANT_HOURS,
) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    inactive_rows: list[dict[str, Any]] = []
    for row in _build_user_rows(telegram_config):
        if str(row.get("status") or "") != TELEGRAM_USER_STATUS_APPROVED:
            continue
        if str(row.get("operational_state") or "") != "ready":
            continue
        last_activity = _parse_iso_timestamp(str(row.get("last_activity_at") or ""))
        if last_activity is None:
            continue
        age_hours = int((now - last_activity).total_seconds() // 3600)
        if age_hours >= threshold_hours:
            enriched_row = dict(row)
            enriched_row["last_issue"] = f"inactive_{age_hours}h"
            enriched_row["inactive_hours"] = age_hours
            inactive_rows.append(enriched_row)
    return inactive_rows


def _build_operation_queue_samples(telegram_config: TelegramConfig) -> list[dict[str, Any]]:
    queue_entries = load_operation_queue_entries(
        telegram_config.state_path,
        limit=5,
        statuses={"pending", "running", "failed"},
    )
    return [
        {
            "operation_type": entry.operation_type,
            "status": entry.status,
            "target_telegram_user_id": entry.target_telegram_user_id,
            "attempts": entry.attempts,
        }
        for entry in queue_entries
    ]


def _audit_detail_summary(details_json: str) -> str:
    if not details_json:
        return ""
    try:
        details = json.loads(details_json)
    except json.JSONDecodeError:
        return ""
    if not isinstance(details, dict):
        return ""
    preferred_keys = (
        "admin_notified",
        "status",
        "account_status",
        "token_status",
        "remote_revocation_status",
        "operations_failed",
        "previous_mode",
        "oauth_state",
        "reason",
        "error",
    )
    parts: list[str] = []
    for key in preferred_keys:
        if key not in details:
            continue
        value = details.get(key)
        if isinstance(value, dict | list):
            continue
        parts.append(f"{key}={value}")
        if len(parts) >= 3:
            break
    return " ".join(parts)


def _audit_entry_to_history_row(entry: AuditLogEntry) -> dict[str, Any]:
    return {
        "created_at": entry.created_at,
        "event_type": entry.event_type,
        "outcome": entry.outcome,
        "actor_telegram_user_id": entry.actor_telegram_user_id,
        "target_telegram_user_id": entry.target_telegram_user_id,
        "telegram_chat_id": entry.telegram_chat_id,
        "ebay_user_id": entry.ebay_user_id,
        "environment": entry.environment,
        "detail": _audit_detail_summary(entry.details_json),
    }


def _build_recent_activity_rows(
    telegram_config: TelegramConfig,
    *,
    hours: int = 24,
) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    counts: dict[str, int] = {}
    for entry in load_recent_audit_entries(telegram_config, limit=400):
        created_at = _parse_iso_timestamp(entry.created_at)
        if created_at is None:
            continue
        if int((now - created_at).total_seconds()) > hours * 60 * 60:
            continue
        counts[entry.event_type] = counts.get(entry.event_type, 0) + 1
    return [
        {"event_type": event_type, "count": count}
        for event_type, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:6]
    ]


def _build_admin_history_rows(
    telegram_config: TelegramConfig,
    *,
    target_user_id: int | None = None,
    limit: int = 8,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for entry in load_recent_audit_entries(telegram_config, limit=250):
        if target_user_id is not None and target_user_id not in {
            entry.actor_telegram_user_id,
            entry.target_telegram_user_id,
        }:
            continue
        rows.append(_audit_entry_to_history_row(entry))
        if len(rows) >= limit:
            break
    return rows


def _percentage(numerator: int, denominator: int) -> int:
    if denominator <= 0:
        return 0
    return round((numerator / denominator) * 100)


def _build_product_metrics_payload(telegram_config: TelegramConfig) -> dict[str, int]:
    runtime_state = load_runtime_state(telegram_config.state_path)
    runtime_metrics = runtime_state.metrics
    readiness = summarize_multi_tenant_readiness(telegram_config.state_path)
    approved_users = int(readiness.get("approved_users", 0))
    linked_accounts = int(readiness.get("linked_accounts", 0))
    fiscal_orders = int(runtime_metrics.orders_with_fiscal_identifier)
    return {
        "orders_read": int(runtime_metrics.orders_read),
        "orders_with_fiscal_identifier": fiscal_orders,
        "fiscal_identifier_rate_percent": _percentage(
            fiscal_orders,
            int(runtime_metrics.orders_read),
        ),
        "notifications_sent": int(runtime_metrics.notifications_sent),
        "notification_rate_percent": _percentage(
            int(runtime_metrics.notifications_sent),
            fiscal_orders,
        ),
        "tenant_users": int(readiness.get("tenant_users", 0)),
        "approved_users": approved_users,
        "linked_accounts": linked_accounts,
        "active_token_sets": int(readiness.get("active_token_sets", 0)),
        "approved_to_linked_rate_percent": _percentage(linked_accounts, approved_users),
    }


def _build_admin_dashboard_payload(telegram_config: TelegramConfig) -> dict[str, Any]:
    rows = _build_user_rows(telegram_config)
    now = datetime.now(timezone.utc)
    audit_entries = load_recent_audit_entries(telegram_config, limit=400)
    oauth_summary = summarize_oauth_link_sessions(
        telegram_config.state_path,
        now_iso=_now_utc_iso(),
    )
    oauth_failures_recent = 0
    for entry in audit_entries:
        if entry.event_type != "oauth_failure":
            continue
        created_at = _parse_iso_timestamp(entry.created_at)
        if created_at is None:
            continue
        if int((now - created_at).total_seconds()) <= 24 * 60 * 60:
            oauth_failures_recent += 1
    pending_stale = 0
    unlinked_stale = 0
    revoked_stale = 0
    alerts: list[dict[str, str]] = []
    for row in rows:
        created_at = _parse_iso_timestamp(str(row.get("created_at") or ""))
        age_hours = int((now - created_at).total_seconds() // 3600) if created_at else 0
        status = str(row.get("status") or "")
        account_status = str(row.get("account_status") or "unlinked")
        token_status = str(row.get("token_status") or "missing")
        if status == TELEGRAM_USER_STATUS_PENDING and age_hours >= PENDING_STALE_HOURS:
            pending_stale += 1
        if (
            status == TELEGRAM_USER_STATUS_APPROVED
            and account_status != "linked"
            and age_hours >= UNLINKED_STALE_HOURS
        ):
            unlinked_stale += 1
        if (
            status == TELEGRAM_USER_STATUS_APPROVED
            and token_status in {"revoked", "expired", "token_expired"}
            and age_hours >= REVOKED_STALE_HOURS
        ):
            revoked_stale += 1
    if pending_stale:
        alerts.append(
            {
                "code": "pending_stale",
                "message": f"{pending_stale} richieste pending ferme oltre soglia",
            }
        )
    if unlinked_stale:
        alerts.append(
            {
                "code": "approved_unlinked_stale",
                "message": f"{unlinked_stale} utenti approvati non hanno ancora collegato eBay",
            }
        )
    if revoked_stale:
        alerts.append(
            {
                "code": "token_revoked_stale",
                "message": f"{revoked_stale} tenant restano con token revocato o scaduto",
            }
        )
    if int(str(oauth_summary.get("pending_expired", 0))) > 0:
        alerts.append(
            {
                "code": "oauth_sessions_expired_pending_cleanup",
                "message": (
                    f"{oauth_summary.get('pending_expired', 0)} sessioni OAuth risultano "
                    "pending ma già scadute"
                ),
            }
        )
    queue_summary = summarize_operation_queue(telegram_config.state_path)
    if queue_summary.get("pending", 0) > 0:
        alerts.append(
            {
                "code": "operation_queue_pending",
                "message": f"{queue_summary.get('pending', 0)} operazioni ancora pending",
            }
        )
    if queue_summary.get("failed", 0) > 0:
        alerts.append(
            {
                "code": "operation_queue_failed",
                "message": f"{queue_summary.get('failed', 0)} operazioni fallite da rivedere",
            }
        )
    approved_users = sum(
        1
        for row in rows
        if str(row.get("status")) in {TELEGRAM_USER_STATUS_APPROVED, TELEGRAM_USER_STATUS_ADMIN}
    )
    service_mode = _load_service_state(telegram_config.state_path).get(
        "mode",
        SERVICE_MODE_NORMAL,
    )
    pending_users = sum(1 for row in rows if str(row.get("status")) == TELEGRAM_USER_STATUS_PENDING)
    linked_users = sum(
        1
        for row in rows
        if str(row.get("account_status")) == "linked" and str(row.get("token_status")) == "active"
    )
    inactive_users = len(_build_inactive_user_rows(telegram_config))
    return {
        "service_mode": service_mode,
        "release": collect_release_info(),
        "product_metrics": _build_product_metrics_payload(telegram_config),
        "metrics": {
            "pending_users": pending_users,
            "approved_users": approved_users,
            "linked_users": linked_users,
            "inactive_users": inactive_users,
            "approved_without_link": sum(
                1
                for row in rows
                if str(row.get("status")) == TELEGRAM_USER_STATUS_APPROVED
                and str(row.get("account_status")) != "linked"
            ),
            "oauth_failures_recent": oauth_failures_recent,
            "oauth_pending_expired": int(str(oauth_summary.get("pending_expired", 0))),
            "pending_stale": pending_stale,
            "revoked_stale": revoked_stale,
        },
        "queue": queue_summary,
        "alerts": alerts,
        "recent_activity": _build_recent_activity_rows(telegram_config),
    }


def _build_admin_maintenance_payload(telegram_config: TelegramConfig) -> dict[str, Any]:
    dashboard = _build_admin_dashboard_payload(telegram_config)
    now = datetime.now(timezone.utc)
    retention_config = load_retention_config()
    retention = summarize_retention_backlog(
        telegram_config.state_path,
        audit_cutoff_iso=_iso_days_ago(
            now,
            retention_config.audit_retention_days,
        ),
        oauth_terminal_cutoff_iso=_iso_days_ago(
            now,
            retention_config.oauth_session_retention_days,
        ),
        oauth_pending_cutoff_iso=_iso_days_ago(
            now,
            retention_config.oauth_pending_retention_days,
        ),
        operation_queue_cutoff_iso=_iso_days_ago(
            now,
            retention_config.operation_queue_retention_days,
        ),
    )
    return {
        "service_mode": dashboard.get("service_mode", SERVICE_MODE_NORMAL),
        "dashboard": dashboard,
        "queue": summarize_operation_queue(telegram_config.state_path),
        "retry_backlog": summarize_retry_queue_backlog(telegram_config.retry_queue_path)["total"],
        "oauth_sessions": summarize_oauth_link_sessions(
            telegram_config.state_path,
            now_iso=_now_utc_iso(),
        ),
        "retention": retention,
        "queue_samples": _build_operation_queue_samples(telegram_config),
    }


def _handle_admin_read_command(
    command: str,
    *,
    telegram_config: TelegramConfig,
    args: list[str],
) -> list[str] | None:
    if command == "/admin":
        if args and args[0] == "help":
            return [format_admin_command_help()]
        if args and args[0] == "maintenance":
            return [
                format_admin_maintenance_overview(_build_admin_maintenance_payload(telegram_config))
            ]
        if args and args[0] == "security":
            return [format_admin_security_report(build_security_ops_report())]
        if args and args[0] == "scale":
            return [format_admin_scale_readiness(build_scale_readiness_report())]
        if args and args[0] == "storico":
            target_user_id: int | None = None
            limit = 8
            if len(args) > 1 and args[1].strip().lower() != "all":
                try:
                    target_user_id = int(args[1])
                except ValueError:
                    return ["Uso corretto: <code>/admin storico [telegram_user_id] [limit]</code>"]
            if len(args) > 2:
                try:
                    limit = min(20, max(1, int(args[2])))
                except ValueError:
                    return ["Uso corretto: <code>/admin storico [telegram_user_id] [limit]</code>"]
            return [
                format_admin_history(
                    _build_admin_history_rows(
                        telegram_config,
                        target_user_id=target_user_id,
                        limit=limit,
                    ),
                    target_user_id=target_user_id,
                    limit=limit,
                )
            ]
        return [format_admin_dashboard(_build_admin_dashboard_payload(telegram_config))]
    if command == "/admin_users":
        filter_name = str(args[0]).strip().lower() if args else "all"
        if filter_name == "all":
            return [format_admin_user_list(_build_user_rows(telegram_config))]
        if filter_name == "pending":
            pending_rows = _filter_user_rows(
                telegram_config,
                lambda row: str(row.get("status")) == TELEGRAM_USER_STATUS_PENDING,
            )
            return [
                format_admin_user_list(
                    pending_rows,
                    title="🕓 <b>Richieste pending</b>",
                    empty_message="Nessuna richiesta accesso pending al momento.",
                )
            ]
        if filter_name == "unlinked":
            unlinked_rows = _filter_user_rows(
                telegram_config,
                lambda row: (
                    str(row.get("status")) == TELEGRAM_USER_STATUS_APPROVED
                    and str(row.get("account_status") or "unlinked") != "linked"
                ),
            )
            return [
                format_admin_user_list(
                    unlinked_rows,
                    title="🔗 <b>Utenti non operativi</b>",
                    empty_message="Nessun utente approvato in attesa di collegamento.",
                )
            ]
        if filter_name == "reconnect":
            reconnect_rows = _filter_user_rows(
                telegram_config,
                lambda row: str(row.get("operational_state") or "") == "reconnect_required",
            )
            return [
                format_admin_watchlist(
                    reconnect_rows,
                    title="🔁 <b>Tenant Da Ricollegare</b>",
                    empty_message="Nessun tenant richiede reconnect in questo momento.",
                )
            ]
        if filter_name == "inactive":
            return [
                format_admin_watchlist(
                    _build_inactive_user_rows(telegram_config),
                    title="🌙 <b>Tenant Inattivi</b>",
                    empty_message="Nessun tenant operativo risulta inattivo oltre soglia.",
                )
            ]
        return ["Uso corretto: <code>/admin_users all|pending|unlinked|reconnect|inactive</code>"]
    if command == "/tenant_health":
        rows = _build_user_rows(telegram_config)
        if args:
            try:
                target_user_id = int(args[0])
            except ValueError:
                return ["Uso corretto: <code>/tenant_health [telegram_user_id]</code>"]
            rows = [row for row in rows if int(row.get("telegram_user_id") or 0) == target_user_id]
        else:
            rows = [row for row in rows if str(row.get("status") or "") != TELEGRAM_USER_STATUS_NEW]
        return [format_tenant_health(rows)]
    return None


def maybe_send_admin_summary(telegram_config: TelegramConfig) -> None:
    if telegram_config.admin_user_id is None:
        return
    admin_chat_id = resolve_primary_chat_id(
        telegram_config.state_path,
        telegram_config.admin_user_id,
    )
    if admin_chat_id is None:
        return
    now_iso = _now_utc_iso()
    last_sent_at = load_kv_value(telegram_config.state_path, _admin_summary_key())
    elapsed = _seconds_between(datetime.now(timezone.utc), last_sent_at)
    dashboard = _build_admin_dashboard_payload(telegram_config)
    pending_users = int((dashboard.get("metrics") or {}).get("pending_users", 0))
    if not dashboard.get("alerts") and pending_users == 0:
        return
    payload_hash = json.dumps(dashboard, ensure_ascii=False, sort_keys=True)
    last_payload_hash = load_kv_value(telegram_config.state_path, _admin_summary_hash_key())
    if last_payload_hash == payload_hash and elapsed is not None and elapsed < 24 * 60 * 60:
        return
    if last_payload_hash != payload_hash or elapsed is None:
        pass
    elif elapsed < DEFAULT_ADMIN_SUMMARY_INTERVAL_SECONDS:
        return
    send_message(
        telegram_config.token,
        admin_chat_id,
        format_admin_dashboard(dashboard),
    )
    save_kv_value(telegram_config.state_path, _admin_summary_key(), now_iso)
    save_kv_value(telegram_config.state_path, _admin_summary_hash_key(), payload_hash)


def handle_admin_command(
    command: str,
    args: list[str],
    *,
    telegram_config: TelegramConfig,
    chat_id: int,
    ebay_environment: str,
    telegram_user_id: int | None,
    is_admin_user: bool,
    service_mode: str,
    now: datetime,
    now_iso: str,
) -> list[str] | None:
    if command == "/service_mode":
        if not is_admin_user:
            return ["Solo l'admin può usare questo comando."]
        if not args:
            return [
                "Uso corretto: <code>/service_mode normal|maintenance|degraded</code>\n"
                f"Modalità corrente: <code>{service_mode}</code>."
            ]
        requested_mode = str(args[0]).strip().lower()
        if requested_mode not in SERVICE_MODES:
            return ["Uso corretto: <code>/service_mode normal|maintenance|degraded</code>"]
        remaining = _command_rate_limit_remaining_seconds(
            telegram_config.state_path,
            telegram_user_id=telegram_user_id,
            command=command,
            now=now,
        )
        if remaining > 0:
            return [_format_cooldown_message(command, remaining)]
        _save_service_state(
            telegram_config.state_path,
            mode=requested_mode,
            updated_by=telegram_user_id,
            updated_at=now_iso,
        )
        _mark_command_usage(
            telegram_config.state_path,
            telegram_user_id=telegram_user_id,
            command=command,
            timestamp=now_iso,
        )
        _append_audit_log(
            telegram_config,
            event_type="service_mode",
            created_at=now_iso,
            actor_telegram_user_id=telegram_user_id,
            target_telegram_user_id=telegram_user_id,
            telegram_chat_id=chat_id,
            outcome=requested_mode,
            details={"previous_mode": service_mode},
        )
        return [
            "🛠️ <b>Modalità servizio aggiornata</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"Nuova modalità: <code>{requested_mode}</code>."
        ]

    if command == "/ping" and telegram_config.admin_user_id is not None and not is_admin_user:
        return ["Solo l'admin può usare questo comando."]

    if command in ADMIN_ONLY_COMMANDS and not is_admin_user:
        return ["Solo l'admin può usare questo comando."]

    if command == "/admin" and args:
        admin_action = str(args[0]).strip().lower()
        if admin_action == "dormant":
            threshold_hours = INACTIVE_TENANT_HOURS
            if len(args) > 1:
                try:
                    threshold_hours = max(1, int(args[1]))
                except ValueError:
                    return ["Uso corretto: <code>/admin dormant [ore]</code>"]
            return [
                format_admin_dormant_review(
                    _build_inactive_user_rows(
                        telegram_config,
                        threshold_hours=threshold_hours,
                    ),
                    threshold_hours=threshold_hours,
                )
            ]
        if admin_action == "export":
            if len(args) < 2:
                return ["Uso corretto: <code>/admin export &lt;telegram_user_id&gt;</code>"]
            try:
                export_user_id = int(args[1])
            except ValueError:
                return ["Uso corretto: <code>/admin export &lt;telegram_user_id&gt;</code>"]
            export_payload = export_tenant_data(telegram_config.state_path, export_user_id)
            _append_audit_log(
                telegram_config,
                event_type="tenant_export",
                created_at=now_iso,
                actor_telegram_user_id=telegram_user_id,
                target_telegram_user_id=export_user_id,
                telegram_chat_id=chat_id,
                outcome="exported",
                details={
                    "has_user": export_payload.get("user") is not None,
                    "chat_count": len(cast(list[object], export_payload.get("chats") or [])),
                    "account_count": len(
                        cast(list[object], export_payload.get("ebay_accounts") or [])
                    ),
                },
            )
            return [format_admin_tenant_export(export_payload)]
        if admin_action == "invite":
            invite_user_id: int | None = None
            target_status: str | None = None
            account_status: dict[str, Any] | None = None
            if len(args) > 1:
                try:
                    invite_user_id = int(args[1])
                except ValueError:
                    return ["Uso corretto: <code>/admin invite [telegram_user_id]</code>"]
                target_status = _load_user_status(telegram_config, invite_user_id)
                account_status = summarize_tenant_account_status(
                    telegram_config.state_path,
                    invite_user_id,
                    ebay_environment,
                )
            _append_audit_log(
                telegram_config,
                event_type="onboarding_invite",
                created_at=now_iso,
                actor_telegram_user_id=telegram_user_id,
                target_telegram_user_id=invite_user_id,
                telegram_chat_id=chat_id,
                outcome="generated",
                details={"target_known": target_status is not None},
            )
            return [
                format_admin_onboarding_invite(
                    bot_url=os.getenv("TELEGRAM_PUBLIC_BOT_URL", "https://t.me/fiscalbay_bot"),
                    telegram_user_id=invite_user_id,
                    user_status=target_status,
                    account_status=account_status,
                )
            ]
        if admin_action == "support":
            if len(args) < 2:
                return ["Uso corretto: <code>/admin support &lt;telegram_user_id&gt;</code>"]
            try:
                support_user_id = int(args[1])
            except ValueError:
                return ["Uso corretto: <code>/admin support &lt;telegram_user_id&gt;</code>"]
            report = build_support_snapshot(
                telegram_config.state_path,
                support_user_id,
                environment=ebay_environment,
            )
            return [format_support_snapshot(report, admin_view=True)]
        if admin_action == "delete_tenant":
            if len(args) < 3:
                return [
                    "Uso corretto: "
                    "<code>/admin delete_tenant &lt;telegram_user_id&gt; confirm</code>"
                ]
            try:
                delete_user_id = int(args[1])
            except ValueError:
                return [
                    "Uso corretto: "
                    "<code>/admin delete_tenant &lt;telegram_user_id&gt; confirm</code>"
                ]
            if args[2].strip().lower() != "confirm":
                return [
                    "Cancellazione non eseguita. Conferma esplicita richiesta: "
                    "<code>/admin delete_tenant &lt;telegram_user_id&gt; confirm</code>"
                ]
            if delete_user_id == telegram_config.admin_user_id:
                return ["Non cancello il tenant admin globale da comando bot."]
            export_before_delete = export_tenant_data(telegram_config.state_path, delete_user_id)
            deleted_counts = delete_tenant_data(telegram_config.state_path, delete_user_id)
            _append_audit_log(
                telegram_config,
                event_type="tenant_delete",
                created_at=now_iso,
                actor_telegram_user_id=telegram_user_id,
                target_telegram_user_id=delete_user_id,
                telegram_chat_id=chat_id,
                outcome="deleted" if deleted_counts.get("total", 0) > 0 else "noop",
                details={
                    "deleted_counts": deleted_counts,
                    "had_user": export_before_delete.get("user") is not None,
                    "had_linked_accounts": bool(export_before_delete.get("ebay_accounts")),
                    "audit_log_retained": True,
                },
            )
            return [
                format_admin_tenant_delete_status(
                    telegram_user_id=delete_user_id,
                    deleted_counts=deleted_counts,
                )
            ]

    admin_read_response = _handle_admin_read_command(
        command,
        telegram_config=telegram_config,
        args=args,
    )
    if admin_read_response is not None:
        return admin_read_response

    if command in ADMIN_MUTATION_COMMANDS:
        if not args:
            action_map = {
                "/approve_user": "approve_user",
                "/reject_user": "reject_user",
                "/suspend_user": "suspend_user",
                "/reactivate_user": "reactivate_user",
            }
            action = action_map[command]
            return [f"Uso corretto: <code>/{action} &lt;telegram_user_id&gt;</code>"]
        try:
            target_user_id = int(args[0])
        except ValueError:
            action_map = {
                "/approve_user": "approve_user",
                "/reject_user": "reject_user",
                "/suspend_user": "suspend_user",
                "/reactivate_user": "reactivate_user",
            }
            action = action_map[command]
            return [f"Uso corretto: <code>/{action} &lt;telegram_user_id&gt;</code>"]
        timestamp = now_iso
        next_status_map = {
            "/approve_user": TELEGRAM_USER_STATUS_APPROVED,
            "/reject_user": TELEGRAM_USER_STATUS_BLOCKED,
            "/suspend_user": TELEGRAM_USER_STATUS_BLOCKED,
            "/reactivate_user": TELEGRAM_USER_STATUS_APPROVED,
        }
        next_status = next_status_map[command]
        current_user = load_telegram_user(telegram_config.state_path, target_user_id)
        status_changed = (
            current_user is None
            or normalize_telegram_user_status(current_user.status) != next_status
        )
        if status_changed:
            remaining = _command_rate_limit_remaining_seconds(
                telegram_config.state_path,
                telegram_user_id=telegram_user_id,
                command=command,
                now=now,
            )
            if remaining > 0:
                return [_format_cooldown_message(command, remaining)]
        updated_user = update_telegram_user_status(
            telegram_config.state_path,
            target_user_id,
            next_status,
            updated_at=timestamp,
        )
        if updated_user is not None:
            enqueue_apply_user_access_operation(
                telegram_config.state_path,
                actor_telegram_user_id=telegram_user_id,
                target_telegram_user_id=target_user_id,
                requested_status=next_status,
            )
            operation_summary = process_pending_operations(
                state_path=telegram_config.state_path,
                default_notify_chat_ids=telegram_config.notify_chat_ids,
                max_operations=10,
            )
        else:
            operation_summary = {"processed": 0, "completed": 0, "failed": 0, "applied": 0}
        _append_audit_log(
            telegram_config,
            event_type=(
                "approve"
                if command == "/approve_user"
                else (
                    "reject"
                    if command == "/reject_user"
                    else ("suspend" if command == "/suspend_user" else "reactivate")
                )
            ),
            created_at=timestamp,
            actor_telegram_user_id=telegram_user_id,
            target_telegram_user_id=target_user_id,
            telegram_chat_id=chat_id,
            outcome=(
                "applied"
                if updated_user is not None and status_changed
                else ("already_applied" if updated_user is not None else "missing_user")
            ),
            details={
                "status": next_status,
                "status_changed": status_changed,
                "operations_processed": operation_summary["processed"],
                "operations_failed": operation_summary["failed"],
            },
        )
        if status_changed:
            _mark_command_usage(
                telegram_config.state_path,
                telegram_user_id=telegram_user_id,
                command=command,
                timestamp=timestamp,
            )
        if updated_user is not None and status_changed and operation_summary["failed"] == 0:
            if next_status == TELEGRAM_USER_STATUS_APPROVED:
                _notify_user_access_status(
                    telegram_config,
                    telegram_user_id=target_user_id,
                    text=(
                        "✅ <b>Accesso approvato</b>\n"
                        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                        "L'admin ha approvato il tuo accesso. "
                        "Apri <code>/onboarding</code> per il percorso guidato "
                        "oppure usa subito <code>/account collega</code>, "
                        "<code>/account</code> e gli altri comandi."
                    ),
                )
            else:
                _notify_user_access_status(
                    telegram_config,
                    telegram_user_id=target_user_id,
                    text=(
                        "⛔ <b>Accesso non approvato</b>\n"
                        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                        "L'admin ha sospeso, rifiutato o bloccato il tuo accesso al bot."
                    ),
                )
        return [
            format_admin_status_update(
                telegram_user_id=target_user_id,
                status=next_status,
                updated=updated_user is not None,
            )
        ]

    return None
