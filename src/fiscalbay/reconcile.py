"""Periodic reconciliation and deferred operation processing."""

from __future__ import annotations

import argparse
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import cast

from .config import configure_logging, load_retention_config, load_telegram_config
from .logging_utils import log_event
from .models import (
    OPERATION_STATUS_COMPLETED,
    OPERATION_STATUS_FAILED,
    OPERATION_TYPE_APPLY_USER_ACCESS_STATE,
    AuditLogEntry,
    OperationQueueEntry,
    normalize_telegram_user_status,
)
from .storage.sqlite import (
    append_audit_log_entry,
    apply_telegram_user_access_status,
    claim_pending_operation,
    enqueue_operation,
    expire_stale_oauth_link_sessions,
    load_notification_subscriptions,
    load_telegram_chats,
    load_telegram_user,
    load_telegram_users,
    prune_audit_log_entries,
    prune_oauth_link_sessions,
    prune_operation_queue_entries,
    rebuild_all_tenant_status_snapshots,
    reconcile_account_token_consistency,
    save_retention_prune_status,
    summarize_operation_queue,
    update_operation_queue_entry,
)

LOGGER = logging.getLogger("fiscalbay.reconcile")


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _iso_days_ago(now: datetime, days: int) -> str:
    return (now - timedelta(days=days)).isoformat().replace("+00:00", "Z")


def enqueue_apply_user_access_operation(
    state_path: str,
    *,
    actor_telegram_user_id: int | None,
    target_telegram_user_id: int,
    requested_status: str,
) -> None:
    timestamp = now_utc_iso()
    enqueue_operation(
        state_path,
        entry=OperationQueueEntry(
            operation_type=OPERATION_TYPE_APPLY_USER_ACCESS_STATE,
            created_at=timestamp,
            actor_telegram_user_id=actor_telegram_user_id,
            target_telegram_user_id=target_telegram_user_id,
            payload_json=json.dumps(
                {"requested_status": requested_status},
                ensure_ascii=False,
                sort_keys=True,
            ),
            updated_at=timestamp,
        ),
    )


def _notification_snapshot(
    state_path: str,
    telegram_user_id: int,
) -> tuple[tuple[int, bool, bool], ...]:
    subscriptions = {
        subscription.telegram_chat_id: subscription.enabled
        for subscription in load_notification_subscriptions(state_path)
        if subscription.telegram_user_id == telegram_user_id
    }
    snapshot: list[tuple[int, bool, bool]] = []
    for chat in load_telegram_chats(state_path):
        if chat.telegram_user_id != telegram_user_id:
            continue
        snapshot.append(
            (
                chat.telegram_chat_id,
                chat.notifications_enabled,
                subscriptions.get(chat.telegram_chat_id, False),
            )
        )
    return tuple(sorted(snapshot))


def _requested_status_for_operation(claimed: OperationQueueEntry, current_status: str) -> str:
    if not claimed.payload_json:
        return current_status
    try:
        payload = json.loads(claimed.payload_json)
    except json.JSONDecodeError:
        return current_status
    if not isinstance(payload, dict):
        return current_status
    requested_status = payload.get("requested_status")
    return normalize_telegram_user_status(str(requested_status or ""), default=current_status)


def process_pending_operations(
    *,
    state_path: str,
    default_notify_chat_ids: set[int],
    max_operations: int = 20,
) -> dict[str, int]:
    processed = 0
    completed = 0
    failed = 0
    applied = 0
    for _ in range(max(0, max_operations)):
        claimed = claim_pending_operation(state_path, now_iso=now_utc_iso())
        if claimed is None:
            break
        processed += 1
        if claimed.operation_type != OPERATION_TYPE_APPLY_USER_ACCESS_STATE:
            update_operation_queue_entry(
                state_path,
                claimed.id or 0,
                status=OPERATION_STATUS_FAILED,
                last_error=f"unsupported_operation:{claimed.operation_type}",
                updated_at=now_utc_iso(),
            )
            failed += 1
            continue

        target_user_id = claimed.target_telegram_user_id
        if target_user_id is None:
            update_operation_queue_entry(
                state_path,
                claimed.id or 0,
                status=OPERATION_STATUS_FAILED,
                last_error="missing_target_user",
                updated_at=now_utc_iso(),
            )
            failed += 1
            continue

        user = load_telegram_user(state_path, target_user_id)
        if user is None:
            update_operation_queue_entry(
                state_path,
                claimed.id or 0,
                status=OPERATION_STATUS_COMPLETED,
                result_json=json.dumps({"result": "missing_user"}, sort_keys=True),
                updated_at=now_utc_iso(),
            )
            completed += 1
            continue

        before = _notification_snapshot(state_path, target_user_id)
        requested_status = _requested_status_for_operation(claimed, user.status)
        applied_user = apply_telegram_user_access_status(
            state_path,
            target_user_id,
            requested_status,
            updated_at=now_utc_iso(),
            default_notify_chat_ids=default_notify_chat_ids,
        )
        after = _notification_snapshot(state_path, target_user_id)
        changed = before != after
        if changed:
            applied += 1
        update_operation_queue_entry(
            state_path,
            claimed.id or 0,
            status=OPERATION_STATUS_COMPLETED,
            result_json=json.dumps(
                {
                    "result": "applied",
                    "status": applied_user.status if applied_user is not None else user.status,
                    "notifications_changed": changed,
                },
                ensure_ascii=False,
                sort_keys=True,
            ),
            last_error="",
            updated_at=now_utc_iso(),
        )
        completed += 1
    return {
        "processed": processed,
        "completed": completed,
        "failed": failed,
        "applied": applied,
    }


def reconcile_access_permissions(
    *,
    state_path: str,
    default_notify_chat_ids: set[int],
) -> dict[str, int]:
    scanned = 0
    adjusted = 0
    for user in load_telegram_users(state_path):
        scanned += 1
        before = _notification_snapshot(state_path, user.telegram_user_id)
        apply_telegram_user_access_status(
            state_path,
            user.telegram_user_id,
            user.status,
            updated_at=now_utc_iso(),
            default_notify_chat_ids=default_notify_chat_ids,
        )
        after = _notification_snapshot(state_path, user.telegram_user_id)
        if before != after:
            adjusted += 1
    return {
        "users_scanned": scanned,
        "users_adjusted": adjusted,
    }


def prune_retained_data(state_path: str) -> dict[str, int | str]:
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat().replace("+00:00", "Z")
    retention_config = load_retention_config()
    audit_cutoff = _iso_days_ago(now, retention_config.audit_retention_days)
    oauth_terminal_cutoff = _iso_days_ago(now, retention_config.oauth_session_retention_days)
    oauth_pending_cutoff = _iso_days_ago(now, retention_config.oauth_pending_retention_days)
    operation_queue_cutoff = _iso_days_ago(now, retention_config.operation_queue_retention_days)

    oauth_deleted = prune_oauth_link_sessions(
        state_path,
        terminal_cutoff_iso=oauth_terminal_cutoff,
        pending_cutoff_iso=oauth_pending_cutoff,
    )
    operation_queue_deleted = prune_operation_queue_entries(
        state_path,
        cutoff_iso=operation_queue_cutoff,
    )
    audit_deleted = prune_audit_log_entries(state_path, cutoff_iso=audit_cutoff)
    save_retention_prune_status(
        state_path,
        now_iso=now_iso,
        audit_retention_days=retention_config.audit_retention_days,
        oauth_session_retention_days=retention_config.oauth_session_retention_days,
        operation_queue_retention_days=retention_config.operation_queue_retention_days,
        audit_deleted=audit_deleted,
        oauth_deleted=oauth_deleted["deleted"],
        oauth_pending_deleted=oauth_deleted["pending_deleted"],
        oauth_terminal_deleted=oauth_deleted["terminal_deleted"],
        operation_queue_deleted=operation_queue_deleted,
    )
    append_audit_log_entry(
        state_path,
        AuditLogEntry(
            event_type="retention_prune",
            created_at=now_iso,
            outcome="completed",
            details_json=json.dumps(
                {
                    "audit_deleted": audit_deleted,
                    "audit_retention_days": retention_config.audit_retention_days,
                    "operation_queue_deleted": operation_queue_deleted,
                    "operation_queue_retention_days": (
                        retention_config.operation_queue_retention_days
                    ),
                    "oauth_deleted": oauth_deleted["deleted"],
                    "oauth_pending_deleted": oauth_deleted["pending_deleted"],
                    "oauth_session_retention_days": (retention_config.oauth_session_retention_days),
                    "oauth_terminal_deleted": oauth_deleted["terminal_deleted"],
                    "stale_pending_oauth_days": retention_config.oauth_pending_retention_days,
                },
                ensure_ascii=False,
                sort_keys=True,
            ),
        ),
    )
    return {
        "last_pruned_at": now_iso,
        "audit_deleted": audit_deleted,
        "oauth_deleted": oauth_deleted["deleted"],
        "oauth_pending_deleted": oauth_deleted["pending_deleted"],
        "oauth_terminal_deleted": oauth_deleted["terminal_deleted"],
        "operation_queue_deleted": operation_queue_deleted,
        "audit_retention_days": retention_config.audit_retention_days,
        "oauth_session_retention_days": retention_config.oauth_session_retention_days,
        "stale_pending_oauth_days": retention_config.oauth_pending_retention_days,
        "operation_queue_retention_days": retention_config.operation_queue_retention_days,
    }


def run_reconciliation() -> dict[str, object]:
    telegram_config = load_telegram_config()
    queue_summary_before = summarize_operation_queue(telegram_config.state_path)
    operations = process_pending_operations(
        state_path=telegram_config.state_path,
        default_notify_chat_ids=telegram_config.notify_chat_ids,
    )
    access = reconcile_access_permissions(
        state_path=telegram_config.state_path,
        default_notify_chat_ids=telegram_config.notify_chat_ids,
    )
    expired_sessions = expire_stale_oauth_link_sessions(
        telegram_config.state_path,
        now_iso=now_utc_iso(),
    )
    revoked_token_sets = reconcile_account_token_consistency(telegram_config.state_path)
    snapshots = rebuild_all_tenant_status_snapshots(
        telegram_config.state_path,
        now_iso=now_utc_iso(),
    )
    retention = prune_retained_data(telegram_config.state_path)
    queue_summary_after = summarize_operation_queue(telegram_config.state_path)
    report: dict[str, object] = {
        "ok": True,
        "operations": operations,
        "access": access,
        "expired_oauth_sessions": expired_sessions,
        "revoked_inconsistent_token_sets": revoked_token_sets,
        "tenant_snapshots": snapshots,
        "retention": retention,
        "operation_queue_before": queue_summary_before,
        "operation_queue_after": queue_summary_after,
    }
    log_event(
        LOGGER,
        logging.INFO,
        "reconciliation_complete",
        operations_processed=operations["processed"],
        operations_failed=operations["failed"],
        users_adjusted=access["users_adjusted"],
        expired_oauth_sessions=expired_sessions,
        revoked_inconsistent_token_sets=revoked_token_sets,
        tenant_snapshots_rebuilt=snapshots["snapshots_rebuilt"],
        audit_pruned=retention["audit_deleted"],
        oauth_sessions_pruned=retention["oauth_deleted"],
        operation_queue_pruned=retention["operation_queue_deleted"],
        queue_pending=queue_summary_after["pending"],
        queue_failed=queue_summary_after["failed"],
    )
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Riallinea stato multiutente e coda operativa.")
    parser.add_argument("--json", action="store_true", help="Stampa output JSON.")
    args = parser.parse_args(argv)

    configure_logging()
    report = run_reconciliation()
    if args.json:
        print(json.dumps(report, ensure_ascii=False, sort_keys=True))
    else:
        operations = cast(dict[str, int], report["operations"])
        access = cast(dict[str, int], report["access"])
        snapshots = cast(dict[str, int], report["tenant_snapshots"])
        retention = cast(dict[str, int | str], report["retention"])
        print(
            "reconciliation ok"
            f" processed={operations['processed']}"
            f" failed={operations['failed']}"
            f" users_adjusted={access['users_adjusted']}"
            f" expired_sessions={report['expired_oauth_sessions']}"
            f" revoked_tokens={report['revoked_inconsistent_token_sets']}"
            f" snapshots={snapshots['snapshots_rebuilt']}"
            f" audit_pruned={retention['audit_deleted']}"
            f" oauth_pruned={retention['oauth_deleted']}"
            f" operation_queue_pruned={retention['operation_queue_deleted']}"
        )
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
