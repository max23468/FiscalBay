"""Operational health check for the Telegram bot runtime."""

from __future__ import annotations

import argparse
import json
import logging
import os
import shutil
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional, TypedDict

from .config import (
    configure_logging,
    load_public_service_config,
    load_retention_config,
    load_telegram_config,
)
from .logging_utils import log_event
from .models import BotMetrics, as_int
from .storage.sqlite import (
    load_effective_runtime_state,
    load_retry_queue_entries,
    summarize_multi_tenant_readiness,
    summarize_operation_queue,
    summarize_retention_backlog,
    summarize_tenant_status_snapshots,
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
    approved_users: int
    pending_users: int
    blocked_users: int
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


class TenantSnapshotHealth(TypedDict):
    total: int
    ready: int
    reconnect_required: int
    waiting_connect: int
    stale: int


class RetentionHealth(TypedDict):
    last_pruned_at: str
    last_pruned_age_seconds: int | None
    audit_overdue: int
    oauth_terminal_overdue: int
    oauth_pending_overdue: int
    operation_queue_overdue: int
    last_audit_deleted: int
    last_oauth_deleted: int
    last_operation_queue_deleted: int
    oldest_audit_created_at: str
    oldest_oauth_created_at: str


class ResourceHealth(TypedDict):
    resource_path: str
    disk_total_bytes: int
    disk_used_bytes: int
    disk_free_bytes: int
    disk_used_percent: float
    inode_total: int | None
    inode_used: int | None
    inode_free: int | None
    inode_used_percent: float | None
    memory_total_mb: int | None
    memory_available_mb: int | None
    memory_available_percent: float | None


class PublicServiceHealth(TypedDict):
    service_model: str
    telegram_first: bool
    web_role: str
    onboarding_hosting: str
    approved_users: int
    approved_users_limit: int
    linked_accounts: int
    linked_accounts_limit: int
    active_token_sets: int
    active_token_sets_limit: int
    sqlite_db_bytes: int
    sqlite_db_limit_bytes: int
    sqlite_migration_recommended: bool
    scale_within_policy: bool


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
    tenant_snapshots: TenantSnapshotHealth
    retention: RetentionHealth
    resources: ResourceHealth
    public_service: PublicServiceHealth
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


def _iso_days_ago(now: datetime, days: int) -> str:
    return (now - timedelta(days=days)).isoformat().replace("+00:00", "Z")


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


def _read_linux_meminfo(path: str = "/proc/meminfo") -> dict[str, int]:
    meminfo: dict[str, int] = {}
    try:
        with open(path, encoding="utf-8") as meminfo_file:
            for line in meminfo_file:
                key, separator, raw_value = line.partition(":")
                if not separator:
                    continue
                parts = raw_value.strip().split()
                if not parts:
                    continue
                try:
                    meminfo[key] = int(parts[0])
                except ValueError:
                    continue
    except OSError:
        return {}
    return meminfo


def collect_resource_health(resource_path: str) -> ResourceHealth:
    disk_usage = shutil.disk_usage(resource_path)
    disk_used_percent = (
        round((disk_usage.used / disk_usage.total) * 100, 2) if disk_usage.total else 0.0
    )

    inode_total: int | None = None
    inode_used: int | None = None
    inode_free: int | None = None
    inode_used_percent: float | None = None
    try:
        stat = os.statvfs(resource_path)
        inode_total = int(stat.f_files)
        inode_free = int(stat.f_ffree)
        inode_used = max(0, inode_total - inode_free)
        inode_used_percent = round((inode_used / inode_total) * 100, 2) if inode_total > 0 else None
    except OSError:
        pass

    meminfo = _read_linux_meminfo()
    memory_total_mb: int | None = None
    memory_available_mb: int | None = None
    memory_available_percent: float | None = None
    memory_total_kb = meminfo.get("MemTotal")
    memory_available_kb = meminfo.get("MemAvailable")
    if memory_total_kb:
        memory_total_mb = memory_total_kb // 1024
        if memory_available_kb is not None:
            memory_available_mb = memory_available_kb // 1024
            memory_available_percent = round((memory_available_kb / memory_total_kb) * 100, 2)

    return {
        "resource_path": resource_path,
        "disk_total_bytes": int(disk_usage.total),
        "disk_used_bytes": int(disk_usage.used),
        "disk_free_bytes": int(disk_usage.free),
        "disk_used_percent": disk_used_percent,
        "inode_total": inode_total,
        "inode_used": inode_used,
        "inode_free": inode_free,
        "inode_used_percent": inode_used_percent,
        "memory_total_mb": memory_total_mb,
        "memory_available_mb": memory_available_mb,
        "memory_available_percent": memory_available_percent,
    }


def build_alerts(
    report: HealthReport,
    *,
    check_service_active: bool,
    service_name: str,
    max_consecutive_error_cycles: int | None,
    max_retry_queue_size: int | None,
    max_disk_used_percent: float | None,
    max_inode_used_percent: float | None,
    min_memory_available_mb: int | None,
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
    public_service = report.get("public_service")
    if public_service:
        if public_service["approved_users"] > public_service["approved_users_limit"]:
            alerts.append("public_approved_users_limit_exceeded")
        if public_service["linked_accounts"] > public_service["linked_accounts_limit"]:
            alerts.append("public_linked_accounts_limit_exceeded")
        if public_service["active_token_sets"] > public_service["active_token_sets_limit"]:
            alerts.append("public_active_token_sets_limit_exceeded")
        if public_service["sqlite_db_bytes"] > public_service["sqlite_db_limit_bytes"]:
            alerts.append("sqlite_db_size_limit_exceeded")
    resources = report.get("resources")
    if resources:
        if (
            max_disk_used_percent is not None
            and resources["disk_used_percent"] > max_disk_used_percent
        ):
            alerts.append("disk_used_percent_exceeded")
        inode_used_percent = resources.get("inode_used_percent")
        if (
            max_inode_used_percent is not None
            and inode_used_percent is not None
            and inode_used_percent > max_inode_used_percent
        ):
            alerts.append("inode_used_percent_exceeded")
        memory_available_mb = resources.get("memory_available_mb")
        if (
            min_memory_available_mb is not None
            and memory_available_mb is not None
            and memory_available_mb < min_memory_available_mb
        ):
            alerts.append("memory_available_mb_below_minimum")
    retention = report.get("retention")
    if retention:
        if (
            retention.get("last_pruned_age_seconds") is not None
            and int(retention.get("last_pruned_age_seconds") or 0) > 48 * 60 * 60
        ):
            alerts.append("retention_prune_stale")
        retention_backlog = (
            int(retention.get("audit_overdue", 0))
            + int(retention.get("oauth_terminal_overdue", 0))
            + int(retention.get("oauth_pending_overdue", 0))
            + int(retention.get("operation_queue_overdue", 0))
        )
        if retention_backlog > 100:
            alerts.append("retention_backlog_exceeded")
    return alerts


def build_health_report(
    max_age_seconds: Optional[int] = None,
    *,
    check_service_active: bool = False,
    service_name: str = "fiscalbay-bot",
    max_consecutive_error_cycles: int | None = None,
    max_retry_queue_size: int | None = None,
    max_disk_used_percent: float | None = None,
    max_inode_used_percent: float | None = None,
    min_memory_available_mb: int | None = None,
    resource_path: str = ".",
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
    public_service_config = load_public_service_config()
    operation_queue = summarize_operation_queue(telegram_config.state_path)
    now = datetime.now(timezone.utc)
    retention_config = load_retention_config()
    tenant_snapshots = summarize_tenant_status_snapshots(
        telegram_config.state_path,
        stale_before_iso=(now - timedelta(hours=24)).isoformat().replace("+00:00", "Z"),
    )
    retention_summary = summarize_retention_backlog(
        telegram_config.state_path,
        audit_cutoff_iso=_iso_days_ago(now, retention_config.audit_retention_days),
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
    retention_last_pruned_at = str(retention_summary.get("last_pruned_at") or "")
    retention_last_age_seconds: int | None = None
    if retention_last_pruned_at:
        try:
            retention_last_age_seconds = max(
                0,
                int((now - parse_iso8601_utc(retention_last_pruned_at)).total_seconds()),
            )
        except ValueError:
            retention_last_age_seconds = None
    else:
        warnings.append("retention_prune_missing")
    audit_overdue = as_int(retention_summary.get("audit_overdue", 0))
    oauth_terminal_overdue = as_int(retention_summary.get("oauth_terminal_overdue", 0))
    oauth_pending_overdue = as_int(retention_summary.get("oauth_pending_overdue", 0))
    operation_queue_overdue = as_int(retention_summary.get("operation_queue_overdue", 0))
    last_audit_deleted = as_int(retention_summary.get("last_audit_deleted", 0))
    last_oauth_deleted = as_int(retention_summary.get("last_oauth_deleted", 0))
    last_operation_queue_deleted = as_int(retention_summary.get("last_operation_queue_deleted", 0))
    if audit_overdue > 0:
        warnings.append("audit_retention_backlog")
    if oauth_terminal_overdue > 0 or oauth_pending_overdue > 0:
        warnings.append("oauth_retention_backlog")
    if operation_queue_overdue > 0:
        warnings.append("operation_queue_retention_backlog")
    if as_int(tenant_snapshots.get("stale", 0)) > 0:
        warnings.append("tenant_snapshot_stale")
    multi_tenant_health: MultiTenantHealth = {
        "tenant_users": multi_tenant.get("tenant_users", 0),
        "approved_users": multi_tenant.get("approved_users", 0),
        "pending_users": multi_tenant.get("pending_users", 0),
        "blocked_users": multi_tenant.get("blocked_users", 0),
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
    tenant_snapshot_health: TenantSnapshotHealth = {
        "total": tenant_snapshots.get("total", 0),
        "ready": tenant_snapshots.get("ready", 0),
        "reconnect_required": tenant_snapshots.get("reconnect_required", 0),
        "waiting_connect": tenant_snapshots.get("waiting_connect", 0),
        "stale": tenant_snapshots.get("stale", 0),
    }
    retention_health: RetentionHealth = {
        "last_pruned_at": retention_last_pruned_at,
        "last_pruned_age_seconds": retention_last_age_seconds,
        "audit_overdue": audit_overdue,
        "oauth_terminal_overdue": oauth_terminal_overdue,
        "oauth_pending_overdue": oauth_pending_overdue,
        "operation_queue_overdue": operation_queue_overdue,
        "last_audit_deleted": last_audit_deleted,
        "last_oauth_deleted": last_oauth_deleted,
        "last_operation_queue_deleted": last_operation_queue_deleted,
        "oldest_audit_created_at": str(retention_summary.get("oldest_audit_created_at") or ""),
        "oldest_oauth_created_at": str(retention_summary.get("oldest_oauth_created_at") or ""),
    }
    resources = collect_resource_health(resource_path)
    sqlite_db_bytes = 0
    try:
        sqlite_db_bytes = Path(telegram_config.state_path).stat().st_size
    except OSError:
        sqlite_db_bytes = 0
    public_scale_within_policy = (
        multi_tenant_health["approved_users"] <= public_service_config.max_approved_users
        and multi_tenant_health["linked_accounts"] <= public_service_config.max_linked_accounts
        and multi_tenant_health["active_token_sets"] <= public_service_config.max_active_token_sets
        and sqlite_db_bytes <= public_service_config.sqlite_max_db_bytes
    )
    public_service_health: PublicServiceHealth = {
        "service_model": public_service_config.service_model,
        "telegram_first": True,
        "web_role": public_service_config.web_role,
        "onboarding_hosting": public_service_config.onboarding_hosting,
        "approved_users": multi_tenant_health["approved_users"],
        "approved_users_limit": public_service_config.max_approved_users,
        "linked_accounts": multi_tenant_health["linked_accounts"],
        "linked_accounts_limit": public_service_config.max_linked_accounts,
        "active_token_sets": multi_tenant_health["active_token_sets"],
        "active_token_sets_limit": public_service_config.max_active_token_sets,
        "sqlite_db_bytes": sqlite_db_bytes,
        "sqlite_db_limit_bytes": public_service_config.sqlite_max_db_bytes,
        "sqlite_migration_recommended": sqlite_db_bytes > public_service_config.sqlite_max_db_bytes
        or multi_tenant_health["active_token_sets"] > public_service_config.max_active_token_sets,
        "scale_within_policy": public_scale_within_policy,
    }
    if not public_scale_within_policy:
        warnings.append("public_service_policy_limit_reached")
    if public_service_health["sqlite_migration_recommended"]:
        warnings.append("sqlite_migration_recommended")
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
        "tenant_snapshots": tenant_snapshot_health,
        "retention": retention_health,
        "resources": resources,
        "public_service": public_service_health,
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
        max_disk_used_percent=max_disk_used_percent,
        max_inode_used_percent=max_inode_used_percent,
        min_memory_available_mb=min_memory_available_mb,
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
        approved_users=multi_tenant_health["approved_users"],
        operation_queue_pending=operation_queue["pending"],
        operation_queue_failed=operation_queue["failed"],
        tenant_snapshots_total=tenant_snapshot_health["total"],
        tenant_snapshots_stale=tenant_snapshot_health["stale"],
        retention_audit_overdue=retention_health["audit_overdue"],
        retention_oauth_overdue=(
            retention_health["oauth_terminal_overdue"] + retention_health["oauth_pending_overdue"]
        ),
        disk_used_percent=resources["disk_used_percent"],
        inode_used_percent=resources["inode_used_percent"],
        memory_available_mb=resources["memory_available_mb"],
        public_scale_within_policy=public_service_health["scale_within_policy"],
        sqlite_db_bytes=public_service_health["sqlite_db_bytes"],
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
        "approved_users": 0,
        "pending_users": 0,
        "blocked_users": 0,
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
    default_tenant_snapshots: TenantSnapshotHealth = {
        "total": 0,
        "ready": 0,
        "reconnect_required": 0,
        "waiting_connect": 0,
        "stale": 0,
    }
    default_retention: RetentionHealth = {
        "last_pruned_at": "",
        "last_pruned_age_seconds": None,
        "audit_overdue": 0,
        "oauth_terminal_overdue": 0,
        "oauth_pending_overdue": 0,
        "operation_queue_overdue": 0,
        "last_audit_deleted": 0,
        "last_oauth_deleted": 0,
        "last_operation_queue_deleted": 0,
        "oldest_audit_created_at": "",
        "oldest_oauth_created_at": "",
    }
    default_resources: ResourceHealth = {
        "resource_path": ".",
        "disk_total_bytes": 0,
        "disk_used_bytes": 0,
        "disk_free_bytes": 0,
        "disk_used_percent": 0.0,
        "inode_total": None,
        "inode_used": None,
        "inode_free": None,
        "inode_used_percent": None,
        "memory_total_mb": None,
        "memory_available_mb": None,
        "memory_available_percent": None,
    }
    default_public_service: PublicServiceHealth = {
        "service_model": "approved_public_small",
        "telegram_first": True,
        "web_role": "onboarding_callback_support",
        "onboarding_hosting": "vps_oauth_callback",
        "approved_users": 0,
        "approved_users_limit": 0,
        "linked_accounts": 0,
        "linked_accounts_limit": 0,
        "active_token_sets": 0,
        "active_token_sets_limit": 0,
        "sqlite_db_bytes": 0,
        "sqlite_db_limit_bytes": 0,
        "sqlite_migration_recommended": False,
        "scale_within_policy": True,
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
    tenant_snapshots = report.get("tenant_snapshots", default_tenant_snapshots)
    retention = report.get("retention", default_retention)
    resources = report.get("resources", default_resources)
    public_service = report.get("public_service", default_public_service)
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
            f"multi_tenant.approved_users: {multi_tenant.get('approved_users', 0)}",
            f"multi_tenant.pending_users: {multi_tenant.get('pending_users', 0)}",
            f"multi_tenant.blocked_users: {multi_tenant.get('blocked_users', 0)}",
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
            f"tenant_snapshots.total: {tenant_snapshots.get('total', 0)}",
            f"tenant_snapshots.ready: {tenant_snapshots.get('ready', 0)}",
            f"tenant_snapshots.reconnect_required: {tenant_snapshots.get('reconnect_required', 0)}",
            f"tenant_snapshots.waiting_connect: {tenant_snapshots.get('waiting_connect', 0)}",
            f"tenant_snapshots.stale: {tenant_snapshots.get('stale', 0)}",
            f"retention.last_pruned_at: {retention.get('last_pruned_at') or 'none'}",
            f"retention.last_pruned_age_seconds: {retention.get('last_pruned_age_seconds')}",
            f"retention.audit_overdue: {retention.get('audit_overdue', 0)}",
            f"retention.oauth_terminal_overdue: {retention.get('oauth_terminal_overdue', 0)}",
            f"retention.oauth_pending_overdue: {retention.get('oauth_pending_overdue', 0)}",
            f"retention.operation_queue_overdue: {retention.get('operation_queue_overdue', 0)}",
            f"retention.last_audit_deleted: {retention.get('last_audit_deleted', 0)}",
            f"retention.last_oauth_deleted: {retention.get('last_oauth_deleted', 0)}",
            "retention.last_operation_queue_deleted: "
            f"{retention.get('last_operation_queue_deleted', 0)}",
            f"resources.path: {resources.get('resource_path', '.')}",
            f"resources.disk_used_percent: {resources.get('disk_used_percent', 0.0)}",
            f"resources.inode_used_percent: {resources.get('inode_used_percent')}",
            f"resources.memory_available_mb: {resources.get('memory_available_mb')}",
            f"resources.memory_available_percent: {resources.get('memory_available_percent')}",
            f"public_service.service_model: {public_service.get('service_model')}",
            f"public_service.web_role: {public_service.get('web_role')}",
            f"public_service.onboarding_hosting: {public_service.get('onboarding_hosting')}",
            "public_service.approved_users: "
            f"{public_service.get('approved_users', 0)}/"
            f"{public_service.get('approved_users_limit', 0)}",
            "public_service.linked_accounts: "
            f"{public_service.get('linked_accounts', 0)}/"
            f"{public_service.get('linked_accounts_limit', 0)}",
            "public_service.active_token_sets: "
            f"{public_service.get('active_token_sets', 0)}/"
            f"{public_service.get('active_token_sets_limit', 0)}",
            "public_service.sqlite_db_bytes: "
            f"{public_service.get('sqlite_db_bytes', 0)}/"
            f"{public_service.get('sqlite_db_limit_bytes', 0)}",
            "public_service.sqlite_migration_recommended: "
            f"{public_service.get('sqlite_migration_recommended', False)}",
            "public_service.scale_within_policy: "
            f"{public_service.get('scale_within_policy', True)}",
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
        "--max-disk-used-percent",
        type=float,
        help="Percentuale massima di disco usato sul percorso monitorato.",
    )
    parser.add_argument(
        "--max-inode-used-percent",
        type=float,
        help="Percentuale massima di inode usati sul percorso monitorato.",
    )
    parser.add_argument(
        "--min-memory-available-mb",
        type=int,
        help="Memoria disponibile minima accettata, in MB.",
    )
    parser.add_argument(
        "--resource-path",
        default=".",
        help="Percorso filesystem da usare per disco e inode. Default: directory corrente.",
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
        max_disk_used_percent=args.max_disk_used_percent,
        max_inode_used_percent=args.max_inode_used_percent,
        min_memory_available_mb=args.min_memory_available_mb,
        resource_path=args.resource_path,
        ignored_reasons=args.ignore_reason,
    )
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(render_text_report(report))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
