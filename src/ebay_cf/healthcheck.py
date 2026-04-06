"""Operational health check for the Telegram bot runtime."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .config import configure_logging, load_telegram_config
from .storage.sqlite import load_retry_queue_entries, load_runtime_state


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


def build_health_report(max_age_seconds: Optional[int] = None) -> dict[str, object]:
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

    status = "ok" if not reasons else "fail"
    return {
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
    }


def render_text_report(report: dict[str, object]) -> str:
    last_check_age = report["last_check_age_seconds"]
    last_check_age_text = str(last_check_age) if last_check_age is not None else "none"
    raw_reasons = report.get("reasons")
    reasons = raw_reasons if isinstance(raw_reasons, list) else []
    raw_warnings = report.get("warnings")
    warnings = raw_warnings if isinstance(raw_warnings, list) else []
    lines = [
        f"status: {report['status']}",
        f"lock_exists: {report['lock_exists']}",
        f"last_check: {report['last_check'] or 'none'}",
        f"last_check_age_seconds: {last_check_age_text}",
        f"max_age_seconds: {report['max_age_seconds']}",
        f"retry_queue_size: {report['retry_queue_size']}",
        f"notified_orders_tracked: {report['notified_orders_tracked']}",
        f"last_error: {report['last_error'] or 'none'}",
    ]
    lines.append("reasons: " + (", ".join(str(item) for item in reasons) if reasons else "none"))
    lines.append("warnings: " + (", ".join(str(item) for item in warnings) if warnings else "none"))
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
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    configure_logging()
    parser = build_parser()
    args = parser.parse_args(argv)
    report = build_health_report(max_age_seconds=args.max_age_seconds)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(render_text_report(report))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
