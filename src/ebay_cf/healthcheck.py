"""Operational health check for the Telegram bot runtime."""

from __future__ import annotations

import argparse
import json
import logging
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .config import configure_logging, load_telegram_config
from .logging_utils import log_event
from .models import BotMetrics, as_int
from .storage.sqlite import load_retry_queue_entries, load_runtime_state

LOGGER = logging.getLogger("ebaycf.healthcheck")


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
    report: dict[str, object],
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

    raw_metrics = report.get("metrics")
    metrics = raw_metrics if isinstance(raw_metrics, dict) else {}
    consecutive_error_cycles = as_int(metrics.get("consecutive_error_cycles", 0))
    retry_queue_size = as_int(report.get("retry_queue_size", 0))

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
    service_name: str = "ebaycf-bot",
    max_consecutive_error_cycles: int | None = None,
    max_retry_queue_size: int | None = None,
) -> dict[str, object]:
    telegram_config = load_telegram_config()
    state = load_runtime_state(telegram_config.state_path)
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
    status = "ok" if not reasons else "fail"
    report = {
        "ok": not reasons,
        "status": status,
        "reasons": reasons,
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
            "orders_with_cf": state.metrics.orders_with_cf,
            "notifications_sent": state.metrics.notifications_sent,
            "telegram_retries": state.metrics.telegram_retries,
            "consecutive_error_cycles": state.metrics.consecutive_error_cycles,
            "ebay_errors": ebay_errors,
            "telegram_errors": telegram_errors,
        },
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
        orders_with_cf=state.metrics.orders_with_cf,
        notifications_sent=state.metrics.notifications_sent,
        telegram_retries=state.metrics.telegram_retries,
        consecutive_error_cycles=state.metrics.consecutive_error_cycles,
        ebay_errors=ebay_errors,
        telegram_errors=telegram_errors,
    )
    return report


def render_text_report(report: dict[str, object]) -> str:
    last_check_age = report["last_check_age_seconds"]
    last_check_age_text = str(last_check_age) if last_check_age is not None else "none"
    raw_reasons = report.get("reasons")
    reasons = raw_reasons if isinstance(raw_reasons, list) else []
    raw_warnings = report.get("warnings")
    warnings = raw_warnings if isinstance(raw_warnings, list) else []
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
    raw_metrics = report.get("metrics")
    metrics = raw_metrics if isinstance(raw_metrics, dict) else {}
    lines.extend(
        [
            f"metrics.orders_read: {metrics.get('orders_read', 0)}",
            f"metrics.orders_with_cf: {metrics.get('orders_with_cf', 0)}",
            f"metrics.notifications_sent: {metrics.get('notifications_sent', 0)}",
            f"metrics.telegram_retries: {metrics.get('telegram_retries', 0)}",
            f"metrics.consecutive_error_cycles: {metrics.get('consecutive_error_cycles', 0)}",
            f"metrics.ebay_errors: {metrics.get('ebay_errors', 0)}",
            f"metrics.telegram_errors: {metrics.get('telegram_errors', 0)}",
        ]
    )
    raw_alerts = report.get("alerts")
    alerts = raw_alerts if isinstance(raw_alerts, list) else []
    lines.append("reasons: " + (", ".join(str(item) for item in reasons) if reasons else "none"))
    lines.append("warnings: " + (", ".join(str(item) for item in warnings) if warnings else "none"))
    lines.append("alerts: " + (", ".join(str(item) for item in alerts) if alerts else "none"))
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
        default="ebaycf-bot",
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
    )
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(render_text_report(report))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
