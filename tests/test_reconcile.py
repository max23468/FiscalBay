import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from src.fiscalbay.models import (
    OPERATION_TYPE_RECONCILE_RUNTIME,
    AuditLogEntry,
    OauthLinkSession,
    OperationQueueEntry,
    TelegramChat,
    TelegramConfig,
    TelegramUser,
)
from src.fiscalbay.reconcile import (
    enqueue_apply_user_access_operation,
    process_pending_operations,
    reconcile_access_permissions,
    run_reconciliation,
)
from src.fiscalbay.storage.sqlite import (
    append_audit_log_entry,
    create_oauth_link_session,
    enqueue_operation,
    load_audit_log_entries,
    load_notification_subscriptions,
    load_oauth_link_session_by_state,
    load_operation_queue_entries,
    load_telegram_user,
    upsert_telegram_chat,
    upsert_telegram_user,
)


class ReconcileTests(unittest.TestCase):
    def test_process_pending_operations_applies_requested_status_from_payload(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            upsert_telegram_user(
                str(db_path),
                TelegramUser(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    username="seller_user",
                    display_name="Mario Rossi",
                    created_at="2026-04-06T10:00:00Z",
                    status="approved",
                ),
            )
            upsert_telegram_chat(
                str(db_path),
                TelegramChat(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    chat_type="private",
                    is_primary=True,
                    notifications_enabled=True,
                    created_at="2026-04-06T10:00:00Z",
                    updated_at="2026-04-06T10:00:00Z",
                ),
            )
            enqueue_apply_user_access_operation(
                str(db_path),
                actor_telegram_user_id=999,
                target_telegram_user_id=123,
                requested_status="blocked",
            )

            summary = process_pending_operations(
                state_path=str(db_path),
                default_notify_chat_ids={456},
            )

            self.assertEqual(summary["processed"], 1)
            self.assertEqual(summary["completed"], 1)
            updated_user = load_telegram_user(str(db_path), 123)
            assert updated_user is not None
            self.assertEqual(updated_user.status, "blocked")
            subscriptions = load_notification_subscriptions(str(db_path))
            self.assertEqual(len(subscriptions), 1)
            self.assertFalse(subscriptions[0].enabled)

    def test_process_pending_operations_applies_user_access_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            upsert_telegram_user(
                str(db_path),
                TelegramUser(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    username="seller_user",
                    display_name="Mario Rossi",
                    created_at="2026-04-06T10:00:00Z",
                    status="approved",
                ),
            )
            upsert_telegram_chat(
                str(db_path),
                TelegramChat(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    chat_type="private",
                    is_primary=True,
                    notifications_enabled=False,
                    created_at="2026-04-06T10:00:00Z",
                    updated_at="2026-04-06T10:00:00Z",
                ),
            )
            enqueue_apply_user_access_operation(
                str(db_path),
                actor_telegram_user_id=999,
                target_telegram_user_id=123,
                requested_status="approved",
            )

            summary = process_pending_operations(
                state_path=str(db_path),
                default_notify_chat_ids={456},
            )

            self.assertEqual(summary["processed"], 1)
            self.assertEqual(summary["failed"], 0)
            subscriptions = load_notification_subscriptions(str(db_path))
            self.assertEqual(len(subscriptions), 1)
            self.assertTrue(subscriptions[0].enabled)
            entries = load_operation_queue_entries(str(db_path))
            self.assertEqual(entries[0].status, "completed")

    def test_process_pending_operations_marks_unsupported_operation_as_failed(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            enqueue_operation(
                str(db_path),
                OperationQueueEntry(
                    operation_type=OPERATION_TYPE_RECONCILE_RUNTIME,
                    created_at="2026-04-06T10:00:00Z",
                ),
            )

            summary = process_pending_operations(
                state_path=str(db_path),
                default_notify_chat_ids=set(),
            )

            self.assertEqual(summary, {"processed": 1, "completed": 0, "failed": 1, "applied": 0})
            entries = load_operation_queue_entries(str(db_path))
            self.assertEqual(entries[0].status, "failed")
            self.assertEqual(entries[0].last_error, "unsupported_operation:reconcile_runtime")

    def test_process_pending_operations_marks_missing_target_user_as_failed(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            enqueue_operation(
                str(db_path),
                OperationQueueEntry(
                    operation_type="apply_user_access_state",
                    created_at="2026-04-06T10:00:00Z",
                ),
            )

            summary = process_pending_operations(
                state_path=str(db_path),
                default_notify_chat_ids=set(),
            )

            self.assertEqual(summary, {"processed": 1, "completed": 0, "failed": 1, "applied": 0})
            entries = load_operation_queue_entries(str(db_path))
            self.assertEqual(entries[0].status, "failed")
            self.assertEqual(entries[0].last_error, "missing_target_user")

    def test_process_pending_operations_marks_missing_user_as_completed(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            enqueue_apply_user_access_operation(
                str(db_path),
                actor_telegram_user_id=999,
                target_telegram_user_id=123,
                requested_status="approved",
            )

            summary = process_pending_operations(
                state_path=str(db_path),
                default_notify_chat_ids=set(),
            )

            self.assertEqual(summary, {"processed": 1, "completed": 1, "failed": 0, "applied": 0})
            entries = load_operation_queue_entries(str(db_path))
            self.assertEqual(entries[0].status, "completed")
            self.assertEqual(entries[0].result_json, '{"result": "missing_user"}')

    def test_process_pending_operations_ignores_unknown_requested_status(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            upsert_telegram_user(
                str(db_path),
                TelegramUser(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    username="seller_user",
                    display_name="Mario Rossi",
                    created_at="2026-04-06T10:00:00Z",
                    status="approved",
                ),
            )
            upsert_telegram_chat(
                str(db_path),
                TelegramChat(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    chat_type="private",
                    is_primary=True,
                    notifications_enabled=True,
                    created_at="2026-04-06T10:00:00Z",
                    updated_at="2026-04-06T10:00:00Z",
                ),
            )
            enqueue_operation(
                str(db_path),
                OperationQueueEntry(
                    operation_type="apply_user_access_state",
                    created_at="2026-04-06T10:00:00Z",
                    actor_telegram_user_id=999,
                    target_telegram_user_id=123,
                    payload_json='{"requested_status":"legacy-bad-status"}',
                    updated_at="2026-04-06T10:00:00Z",
                ),
            )

            summary = process_pending_operations(
                state_path=str(db_path),
                default_notify_chat_ids={456},
            )

            self.assertEqual(summary["processed"], 1)
            updated_user = load_telegram_user(str(db_path), 123)
            assert updated_user is not None
            self.assertEqual(updated_user.status, "approved")
            subscriptions = load_notification_subscriptions(str(db_path))
            self.assertEqual(len(subscriptions), 1)
            self.assertTrue(subscriptions[0].enabled)

    def test_reconcile_access_permissions_counts_adjusted_users(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            upsert_telegram_user(
                str(db_path),
                TelegramUser(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    username="seller_user",
                    display_name="Mario Rossi",
                    created_at="2026-04-06T10:00:00Z",
                    status="approved",
                ),
            )
            upsert_telegram_chat(
                str(db_path),
                TelegramChat(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    chat_type="private",
                    is_primary=True,
                    notifications_enabled=False,
                    created_at="2026-04-06T10:00:00Z",
                    updated_at="2026-04-06T10:00:00Z",
                ),
            )

            summary = reconcile_access_permissions(
                state_path=str(db_path),
                default_notify_chat_ids={456},
            )

            self.assertEqual(summary, {"users_scanned": 1, "users_adjusted": 1})
            subscriptions = load_notification_subscriptions(str(db_path))
            self.assertEqual(len(subscriptions), 1)
            self.assertTrue(subscriptions[0].enabled)

    def test_run_reconciliation_expires_stale_oauth_sessions(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            lock_path = Path(tmpdir) / "telegram_bot.lock"
            lock_path.write_text("pid=123\n", encoding="utf-8")
            now = datetime.now(timezone.utc)
            created_at = (now - timedelta(hours=2)).isoformat().replace("+00:00", "Z")
            expires_at = (now - timedelta(hours=1)).isoformat().replace("+00:00", "Z")
            create_oauth_link_session(
                str(db_path),
                OauthLinkSession(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    oauth_state="state-1",
                    status="pending",
                    expires_at=expires_at,
                    created_at=created_at,
                ),
            )
            append_audit_log_entry(
                str(db_path),
                AuditLogEntry(event_type="old_event", created_at="2025-01-01T00:00:00Z"),
            )
            config = TelegramConfig(
                token="x",
                allowed_chat_ids=None,
                notify_chat_ids=set(),
                state_path=str(db_path),
                retry_queue_path=str(db_path),
                lock_path=str(lock_path),
            )

            with patch("src.fiscalbay.reconcile.load_telegram_config", return_value=config):
                report = run_reconciliation()

            self.assertEqual(report["expired_oauth_sessions"], 1)
            session = load_oauth_link_session_by_state(str(db_path), "state-1")
            self.assertIsNotNone(session)
            assert session is not None
            self.assertEqual(session.status, "expired")
            audit_event_types = [
                entry.event_type for entry in load_audit_log_entries(str(db_path), limit=5)
            ]
            self.assertIn("retention_prune", audit_event_types)
            self.assertNotIn("old_event", audit_event_types)
            self.assertEqual(report["retention"]["audit_deleted"], 1)


if __name__ == "__main__":
    unittest.main()
