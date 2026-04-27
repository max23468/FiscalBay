"""Operational health check for the Telegram bot runtime."""

from __future__ import annotations

import argparse
import json
import logging
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, TypedDict

from .config import configure_logging, load_telegram_config
from .logging_utils import log_event
from .models import BotMetrics, as_int
from .storage.sqlite import (
    load_effective_runtime_state,
    load_retry_queue_entries,
    summarize_multi_tenant_readiness,
    summarize_operation_queue,
)

LOGGER = logging.getLogger("fiscalbay.healthcheck")


class HealthMetrics(TypedDict):
    orders_read: int
    orders_with_fiscal_identifier: int
    notifications_sent: int
    telegram_retries: int
    consecutive_error_cycles: int
    ebay_errors: int
    telegram_errors: int


class MultiTenantHealth(TypedDict):
    tenant_users: int
    tenant_chats: int
    linked_accounts: int
    active_token_sets: int
    notification_subscriptions: int
    tenant_runtime_states: int
    tenant_credentials_ready: bool


class OperationQueueHealth(TypedDict):
    pending: int
    running: int
    failed: int
    completed: int
    cancelled: int


class HealthReport(TypedDict):
    ok: bool
    status: str
    reasons: list[str]
    ignored_reasons: list[str]
    warnings: list[str]
    lock_exists: bool
    last_check: str | None
    last_check_age_seconds: int | None
    max_age_seconds: int
    retry_queue_size: int
    notified_orders_tracked: int
    last_error: str | None
    metrics: HealthMetrics
    multi_tenant: MultiTenantHealth
    operation_queue: OperationQueueHealth
    alerts: list[str]
    service_active: bool | None
    service_name: str | None


def parse_iso8601_utc(value: str) -> datetime:
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def default_max_age_seconds(poll_interval_seconds: int) -> int:
    return max(300, poll_interval_seconds * 3)


def summarize_error_metrics(metrics: BotMetrics) -> tuple[int, int]:
    ebay_errors = 0
    telegram_errors = 0
    for error_type, count in metrics.errors_by_type.items():
        normalized = error_type.lower()
        if "ebay" in normalized:
            ebay_errors += int(count)
        if "telegram" in normalized:
            telegram_errors += int(count)
    return ebay_errors, telegram_errors


def service_is_active(service_name: str) -> bool | None:
    try:
        result = subprocess.run(
            ["systemctl", "is-active", "--quiet", service_name],
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        return None
    return result.returncode == 0


def build_alerts(
    report: HealthReport,
    *,
    check_service_active: bool,
    service_name: str,
    max_consecutive_error_cycles: int | None,
    max_retry_queue_size: int | None,
) -> list[str]:
    alerts: list[str] = []
    service_active = service_is_active(service_name) if check_service_active else None
    report["service_active"] = service_active
    report["service_name"] = service_name if check_service_active else None

    if check_service_active and service_active is False:
        alerts.append("service_inactive")

    metrics = report["metrics"]
    consecutive_error_cycles = as_int(metrics.get("consecutive_error_cycles", 0))
    retry_queue_size = report["retry_queue_size"]

    if (
        max_consecutive_error_cycles is not None
        and consecutive_error_cycles > max_consecutive_error_cycles
    ):
        alerts.append("consecutive_error_cycles_exceeded")
    if max_retry_queue_size is not None and retry_queue_size > max_retry_queue_size:
        alerts.append("retry_queue_size_exceeded")
    return alerts


def build_health_report(
    max_age_seconds: Optional[int] = None,
    *,
    check_service_active: bool = False,
    service_name: str = "fiscalbay-bot",
    max_consecutive_error_cycles: int | None = None,
    max_retry_queue_size: int | None = None,
    ignored_reasons: list[str] | None = None,
) -> HealthReport:
    telegram_config = load_telegram_config()
    state = load_effective_runtime_state(telegram_config.state_path)
    retry_queue = load_retry_queue_entries(telegram_config.retry_queue_path)
    effective_max_age = max_age_seconds or default_max_age_seconds(
        telegram_config.ebay_poll_interval_seconds
    )

    reasons: list[str] = []
    warnings: list[str] = []
    lock_exists = Path(telegram_config.lock_path).exists()
    if not lock_exists:
        reasons.append("lock_missing")

    last_check = state.last_check
    age_seconds: Optional[int] = None
    if isinstance(last_check, str) and last_check:
        last_check_dt = parse_iso8601_utc(last_check)
        age_seconds = max(0, int((datetime.now(timezone.utc) - last_check_dt).total_seconds()))
        if age_seconds > effective_max_age:
            reasons.append("last_check_stale")
    else:
        reasons.append("last_check_missing")

    last_error = state.last_error
    if last_error:
        warnings.append("last_error_present")
    if retry_queue:
        warnings.append("retry_queue_not_empty")

    ebay_errors, telegram_errors = summarize_error_metrics(state.metrics)
    multi_tenant = summarize_multi_tenant_readiness(telegram_config.state_path)
    operation_queue = summarize_operation_queue(telegram_config.state_path)
    multi_tenant_health: MultiTenantHealth = {
        "tenant_users": multi_tenant.get("tenant_users", 0),
        "tenant_chats": multi_tenant.get("tenant_chats", 0),
        "linked_accounts": multi_tenant.get("linked_accounts", 0),
        "active_token_sets": multi_tenant.get("active_token_sets", 0),
        "notification_subscriptions": multi_tenant.get("notification_subscriptions", 0),
        "tenant_runtime_states": multi_tenant.get("tenant_runtime_states", 0),
        "tenant_credentials_ready": multi_tenant.get("linked_accounts", 0) > 0
        and multi_tenant.get("active_token_sets", 0) > 0,
    }
    operation_queue_health: OperationQueueHealth = {
        "pending": operation_queue.get("pending", 0),
        "running": operation_queue.get("running", 0),
        "failed": operation_queue.get("failed", 0),
        "completed": operation_queue.get("completed", 0),
        "cancelled": operation_queue.get("cancelled", 0),
    }
    ignored_reason_set = set(ignored_reasons or [])
    fatal_reasons = [reason for reason in reasons if reason not in ignored_reason_set]
    effective_ignored_reasons = [reason for reason in reasons if reason in ignored_reason_set]
    status = "ok" if not fatal_reasons else "fail"
    report: HealthReport = {
        "ok": not fatal_reasons,
        "status": status,
        "reasons": reasons,
        "ignored_reasons": effective_ignored_reasons,
        "warnings": warnings,
        "lock_exists": lock_exists,
        "last_check": last_check,
        "last_check_age_seconds": age_seconds,
        "max_age_seconds": effective_max_age,
        "retry_queue_size": len(retry_queue),
        "notified_orders_tracked": len(state.notified_order_ids),
        "last_error": last_error,
        "metrics": {
            "orders_read": state.metrics.orders_read,
            "orders_with_fiscal_identifier": state.metrics.orders_with_fiscal_identifier,
            "notifications_sent": state.metrics.notifications_sent,
            "telegram_retries": state.metrics.telegram_retries,
            "consecutive_error_cycles": state.metrics.consecutive_error_cycles,
            "ebay_errors": ebay_errors,
            "telegram_errors": telegram_errors,
        },
        "multi_tenant": multi_tenant_health,
        "operation_queue": operation_queue_health,
        "alerts": [],
        "service_active": None,
        "service_name": None,
    }
    alerts = build_alerts(
        report,
        check_service_active=check_service_active,
        service_name=service_name,
        max_consecutive_error_cycles=max_consecutive_error_cycles,
        max_retry_queue_size=max_retry_queue_size,
    )
    report["alerts"] = alerts
    if alerts:
        report["status"] = "fail"
        report["ok"] = False
    log_event(
        LOGGER,
        logging.INFO,
        "healthcheck_built",
        status=report["status"],
        retry_queue_size=len(retry_queue),
        reasons_count=len(reasons),
        warnings_count=len(warnings),
        alerts_count=len(alerts),
        orders_read=state.metrics.orders_read,
        orders_with_fiscal_identifier=state.metrics.orders_with_fiscal_identifier,
        notifications_sent=state.metrics.notifications_sent,
        telegram_retries=state.metrics.telegram_retries,
        consecutive_error_cycles=state.metrics.consecutive_error_cycles,
        ebay_errors=ebay_errors,
        telegram_errors=telegram_errors,
        tenant_users=multi_tenant["tenant_users"],
        linked_accounts=multi_tenant["linked_accounts"],
        active_token_sets=multi_tenant["active_token_sets"],
        operation_queue_pending=operation_queue["pending"],
        operation_queue_failed=operation_queue["failed"],
    )
    return report


def render_text_report(report: HealthReport) -> str:
    last_check_age = report["last_check_age_seconds"]
    last_check_age_text = str(last_check_age) if last_check_age is not None else "none"
    reasons = report["reasons"]
    warnings = report["warnings"]
    ignored_reasons = report.get("ignored_reasons", [])
    default_multi_tenant: MultiTenantHealth = {
        "tenant_users": 0,
        "tenant_chats": 0,
        "linked_accounts": 0,
        "active_token_sets": 0,
        "notification_subscriptions": 0,
        "tenant_runtime_states": 0,
        "tenant_credentials_ready": False,
    }
    default_operation_queue: OperationQueueHealth = {
        "pending": 0,
        "running": 0,
        "failed": 0,
        "completed": 0,
        "cancelled": 0,
    }
    lines = [
        f"status: {report['status']}",
        f"service_active: {report.get('service_active', 'not_checked')}",
        f"lock_exists: {report['lock_exists']}",
        f"last_check: {report['last_check'] or 'none'}",
        f"last_check_age_seconds: {last_check_age_text}",
        f"max_age_seconds: {report['max_age_seconds']}",
        f"retry_queue_size: {report['retry_queue_size']}",
        f"notified_orders_tracked: {report['notified_orders_tracked']}",
        f"last_error: {report['last_error'] or 'none'}",
    ]
    metrics = report["metrics"]
    lines.extend(
        [
            f"metrics.orders_read: {metrics.get('orders_read', 0)}",
            "metrics.orders_with_fiscal_identifier: "
            f"{metrics.get('orders_with_fiscal_identifier', 0)}",
            f"metrics.notifications_sent: {metrics.get('notifications_sent', 0)}",
            f"metrics.telegram_retries: {metrics.get('telegram_retries', 0)}",
            f"metrics.consecutive_error_cycles: {metrics.get('consecutive_error_cycles', 0)}",
            f"metrics.ebay_errors: {metrics.get('ebay_errors', 0)}",
            f"metrics.telegram_errors: {metrics.get('telegram_errors', 0)}",
        ]
    )
    alerts = report["alerts"]
    multi_tenant = report.get("multi_tenant", default_multi_tenant)
    operation_queue = report.get("operation_queue", default_operation_queue)
    lines.append("reasons: " + (", ".join(str(item) for item in reasons) if reasons else "none"))
    lines.append(
        "ignored_reasons: "
        + (", ".join(str(item) for item in ignored_reasons) if ignored_reasons else "none")
    )
    lines.append("warnings: " + (", ".join(str(item) for item in warnings) if warnings else "none"))
    lines.append("alerts: " + (", ".join(str(item) for item in alerts) if alerts else "none"))
    lines.extend(
        [
            f"multi_tenant.tenant_users: {multi_tenant.get('tenant_users', 0)}",
            f"multi_tenant.tenant_chats: {multi_tenant.get('tenant_chats', 0)}",
            f"multi_tenant.linked_accounts: {multi_tenant.get('linked_accounts', 0)}",
            f"multi_tenant.active_token_sets: {multi_tenant.get('active_token_sets', 0)}",
            "multi_tenant.notification_subscriptions: "
            f"{multi_tenant.get('notification_subscriptions', 0)}",
            f"multi_tenant.tenant_runtime_states: {multi_tenant.get('tenant_runtime_states', 0)}",
            "multi_tenant.tenant_credentials_ready: "
            f"{multi_tenant.get('tenant_credentials_ready', False)}",
            f"operation_queue.pending: {operation_queue.get('pending', 0)}",
            f"operation_queue.running: {operation_queue.get('running', 0)}",
            f"operation_queue.failed: {operation_queue.get('failed', 0)}",
        ]
    )
    return "\n".join(lines)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Health check del runtime del bot Telegram.")
    parser.add_argument(
        "--json",
        action="store_true",
        help="Stampa il report in JSON.",
    )
    parser.add_argument(
        "--max-age-seconds",
        type=int,
        help="Eta' massima accettata per last_check. Default: max(300, poll_interval*3).",
    )
    parser.add_argument(
        "--check-service-active",
        action="store_true",
        help="Fallisce se il servizio systemd indicato non risulta attivo.",
    )
    parser.add_argument(
        "--service-name",
        default="fiscalbay-bot",
        help="Nome servizio systemd da controllare con --check-service-active.",
    )
    parser.add_argument(
        "--max-consecutive-error-cycles",
        type=int,
        help="Numero massimo accettato di cicli consecutivi con errore.",
    )
    parser.add_argument(
        "--max-retry-queue-size",
        type=int,
        help="Dimensione massima accettata della retry queue prima di fallire.",
    )
    parser.add_argument(
        "--ignore-reason",
        action="append",
        default=[],
        help=(
            "Motivo non bloccante da ignorare nel codice di uscita. "
            "Ripetibile; utile per smoke check di deploy."
        ),
    )
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    configure_logging()
    parser = build_parser()
    args = parser.parse_args(argv)
    report = build_health_report(
        max_age_seconds=args.max_age_seconds,
        check_service_active=args.check_service_active,
        service_name=args.service_name,
        max_consecutive_error_cycles=args.max_consecutive_error_cycles,
        max_retry_queue_size=args.max_retry_queue_size,
        ignored_reasons=args.ignore_reason,
    )
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(render_text_report(report))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
