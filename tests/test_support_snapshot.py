import tempfile
import unittest
from pathlib import Path

from src.fiscalbay.models import (
    TELEGRAM_USER_STATUS_APPROVED,
    AuditLogEntry,
    BotOperationalMemory,
    BotRuntimeState,
    EbayTokenSet,
    LinkedEbayAccount,
    RetryQueueEntry,
    TelegramUser,
)
from src.fiscalbay.storage.sqlite import (
    append_audit_log_entry,
    resolve_linked_ebay_account,
    save_tenant_retry_queue_entries,
    save_tenant_runtime_state,
    save_tenant_status_snapshot,
    upsert_ebay_token_set,
    upsert_linked_ebay_account,
    upsert_telegram_user,
)
from src.fiscalbay.support_snapshot import (
    build_support_snapshot,
    render_support_snapshot_text,
)


class SupportSnapshotTests(unittest.TestCase):
    def test_build_support_snapshot_reports_ready_tenant(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = str(Path(tmpdir) / "state.db")
            upsert_telegram_user(
                db_path,
                TelegramUser(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    username="seller_user",
                    display_name="Mario Rossi",
                    created_at="2026-04-06T10:00:00Z",
                    status=TELEGRAM_USER_STATUS_APPROVED,
                ),
            )
            upsert_linked_ebay_account(
                db_path,
                LinkedEbayAccount(
                    telegram_user_id=123,
                    ebay_user_id="seller-ebay",
                    environment="production",
                    linked_at="2026-04-06T10:10:00Z",
                    status="linked",
                ),
            )
            account = resolve_linked_ebay_account(db_path, 123, "production")
            assert account is not None and account.id is not None
            upsert_ebay_token_set(
                db_path,
                EbayTokenSet(
                    ebay_account_id=account.id,
                    refresh_token_encrypted="plain:tenant-refresh",
                    status="active",
                ),
            )
            save_tenant_runtime_state(
                db_path,
                123,
                BotRuntimeState(
                    last_check="2026-04-07T08:00:00Z",
                    memory=BotOperationalMemory(
                        last_fetch_end="2026-04-07T08:00:01Z",
                        last_fetch_count=3,
                        last_seen_order_id="order-3",
                        last_seen_order_created_at="2026-04-07T07:50:00Z",
                        last_notified_order_id="order-2",
                        last_notified_order_created_at="2026-04-07T07:40:00Z",
                    ),
                ),
            )
            append_audit_log_entry(
                db_path,
                AuditLogEntry(
                    event_type="tenant_sync",
                    created_at="2026-04-07T08:00:02Z",
                    actor_telegram_user_id=123,
                    target_telegram_user_id=123,
                    outcome="ok",
                ),
            )
            save_tenant_status_snapshot(
                db_path,
                123,
                {"operational_state": "ready", "last_activity_at": "2026-04-07T08:00:02Z"},
                updated_at="2026-04-07T08:00:02Z",
            )

            report = build_support_snapshot(db_path, 123, environment="production")
            text = render_support_snapshot_text(report)

            self.assertEqual(report.status, "ready")
            self.assertIn("nessuna azione urgente", report.actions)
            self.assertIn("seller-ebay", text)
            self.assertIn("order-3", text)
            self.assertIn("tenant_sync/ok", text)
            self.assertEqual(report.as_dict()["status"], "ready")

    def test_build_support_snapshot_flags_reconnect_and_retry_queue(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = str(Path(tmpdir) / "state.db")
            upsert_telegram_user(
                db_path,
                TelegramUser(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    username="seller_user",
                    display_name="Mario Rossi",
                    status=TELEGRAM_USER_STATUS_APPROVED,
                ),
            )
            upsert_linked_ebay_account(
                db_path,
                LinkedEbayAccount(
                    telegram_user_id=123,
                    ebay_user_id="seller-ebay",
                    environment="production",
                    status="linked",
                ),
            )
            account = resolve_linked_ebay_account(db_path, 123, "production")
            assert account is not None and account.id is not None
            upsert_ebay_token_set(
                db_path,
                EbayTokenSet(
                    ebay_account_id=account.id,
                    refresh_token_encrypted="plain:tenant-refresh",
                    status="revoked",
                ),
            )
            save_tenant_retry_queue_entries(
                db_path,
                123,
                [RetryQueueEntry(chat_id=456, text="retry me", attempts=2)],
            )

            report = build_support_snapshot(db_path, 123, environment="production")

            self.assertEqual(report.status, "reconnect_required")
            self.assertIn("chiedi reconnect con /account collega", report.actions)
            self.assertIn("verifica coda notifiche tenant", report.actions)

    def test_build_support_snapshot_handles_unknown_user(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = str(Path(tmpdir) / "state.db")

            report = build_support_snapshot(db_path, 999, environment="production")

            self.assertEqual(report.status, "unknown_user")
            self.assertEqual(
                report.actions,
                ("verifica telegram_user_id o attendi il primo /start dell'utente",),
            )
