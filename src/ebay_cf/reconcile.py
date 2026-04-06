"""Periodic reconciliation and deferred operation processing."""

from __future__ import annotations

import argparse
import json
import logging
from datetime import datetime, timezone

from .config import configure_logging, load_telegram_config
from .logging_utils import log_event
from .models import (
    OPERATION_STATUS_COMPLETED,
    OPERATION_STATUS_FAILED,
    OPERATION_TYPE_APPLY_USER_ACCESS_STATE,
    OperationQueueEntry,
)
from .storage.sqlite import (
    apply_telegram_user_access_status,
    claim_pending_operation,
    enqueue_operation,
    expire_stale_oauth_link_sessions,
    load_notification_subscriptions,
    load_telegram_chats,
    load_telegram_user,
    load_telegram_users,
    reconcile_account_token_consistency,
    summarize_operation_queue,
    update_operation_queue_entry,
)

LOGGER = logging.getLogger("ebaycf.reconcile")


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


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
        applied_user = apply_telegram_user_access_status(
            state_path,
            target_user_id,
            user.status,
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
    queue_summary_after = summarize_operation_queue(telegram_config.state_path)
    report: dict[str, object] = {
        "ok": True,
        "operations": operations,
        "access": access,
        "expired_oauth_sessions": expired_sessions,
        "revoked_inconsistent_token_sets": revoked_token_sets,
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
        print(
            "reconciliation ok"
            f" processed={report['operations']['processed']}"
            f" failed={report['operations']['failed']}"
            f" users_adjusted={report['access']['users_adjusted']}"
            f" expired_sessions={report['expired_oauth_sessions']}"
            f" revoked_tokens={report['revoked_inconsistent_token_sets']}"
        )
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
