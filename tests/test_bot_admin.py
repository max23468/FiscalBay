import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src.fiscalbay.bot import process_message
from src.fiscalbay.bot_common import sync_runtime_contact
from src.fiscalbay.bot_orders import maybe_send_new_order_notifications
from src.fiscalbay.models import (
    TELEGRAM_USER_STATUS_ADMIN,
    TELEGRAM_USER_STATUS_APPROVED,
    AuditLogEntry,
    BotOperationalMemory,
    BotRuntimeState,
    EbayTokenSet,
    LinkedEbayAccount,
    OauthLinkSession,
    OrderRecord,
    RetryQueueEntry,
    TelegramConfig,
)
from src.fiscalbay.reconcile import enqueue_apply_user_access_operation
from src.fiscalbay.storage.notifications import (
    load_notification_subscriptions,
)
from src.fiscalbay.storage.oauth import create_oauth_link_session
from src.fiscalbay.storage.queues import (
    append_audit_log_entry,
    load_audit_log_entries,
    load_operation_queue_entries,
)
from src.fiscalbay.storage.runtime import (
    load_state,
    save_retry_queue,
    save_state,
    save_tenant_retry_queue_entries,
    save_tenant_runtime_state,
)
from src.fiscalbay.storage.users import (
    load_telegram_chats,
    load_telegram_user,
    load_telegram_users,
    resolve_linked_ebay_account,
    update_telegram_user_status,
    upsert_ebay_token_set,
    upsert_linked_ebay_account,
)


def _order_records(records: list[dict[str, object]]) -> list[OrderRecord]:
    return [OrderRecord.from_mapping(record) for record in records]


class BotAdminTests(unittest.TestCase):
    def test_start_for_admin_surfaces_operational_admin_commands(self) -> None:
        replies = process_message(
            text="/start",
            chat_id=573159993,
            telegram_config=TelegramConfig(
                token="x",
                allowed_chat_ids={573159993},
                notify_chat_ids=set(),
                admin_user_id=573159993,
            ),
            ebay_environment="production",
            telegram_user_id=573159993,
        )

        self.assertEqual(len(replies), 1)
        self.assertIn("/admin", replies[0])
        self.assertIn("/admin manutenzione", replies[0])
        self.assertIn("/admin_users reconnect", replies[0])

    def test_process_message_prompts_request_for_non_approved_user(self) -> None:
        replies = process_message(
            text="/help",
            chat_id=573159993,
            telegram_config=TelegramConfig(
                token="x",
                allowed_chat_ids={573159993},
                notify_chat_ids=set(),
                admin_user_id=573159993,
            ),
            ebay_environment="production",
            telegram_user_id=111111,
        )

        self.assertEqual(len(replies), 1)
        self.assertIn("/request_access", replies[0])

    def test_process_message_help_is_role_aware_for_admin(self) -> None:
        replies = process_message(
            text="/help",
            chat_id=573159993,
            telegram_config=TelegramConfig(
                token="x",
                allowed_chat_ids={573159993},
                notify_chat_ids=set(),
                admin_user_id=573159993,
            ),
            ebay_environment="production",
            telegram_user_id=573159993,
        )

        self.assertEqual(len(replies), 1)
        self.assertIn("Area admin", replies[0])
        self.assertIn("/admin help", replies[0])
        self.assertIn("/admin_users", replies[0])

    def test_sync_runtime_contact_persists_new_non_admin_user(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={456},
                notify_chat_ids={456},
                admin_user_id=123,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=999,
                chat_id=456,
                username="other_user",
                display_name="Other User",
                chat_type="private",
            )

            users = load_telegram_users(str(db_path))
            chats = load_telegram_chats(str(db_path))
            subscriptions = load_notification_subscriptions(str(db_path))

            self.assertEqual(len(users), 1)
            self.assertEqual(users[0].status, "new")
            self.assertEqual(len(chats), 1)
            self.assertEqual(subscriptions, [])

    def test_sync_runtime_contact_rejects_non_private_chat(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids=None,
                notify_chat_ids={456},
                admin_user_id=123,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=999,
                chat_id=456,
                chat_type="group",
            )

            self.assertEqual(load_telegram_users(str(db_path)), [])
            self.assertEqual(load_telegram_chats(str(db_path)), [])

    @patch("src.fiscalbay.bot_common.send_message")
    def test_sync_runtime_contact_does_not_notify_admin_on_first_seen_user(
        self, mock_send_message
    ) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={123, 456},
                notify_chat_ids=set(),
                admin_user_id=123,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=123,
                username="admin_user",
                display_name="Admin",
                chat_type="private",
            )
            mock_send_message.reset_mock()

            sync_runtime_contact(
                config,
                telegram_user_id=999,
                chat_id=456,
                username="other_user",
                display_name="Other User",
                chat_type="private",
            )

            mock_send_message.assert_not_called()

    @patch("src.fiscalbay.bot_common.send_message")
    def test_sync_runtime_contact_never_notifies_admin(self, mock_send_message) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={123, 456},
                notify_chat_ids=set(),
                admin_user_id=123,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=123,
                username="admin_user",
                display_name="Admin",
                chat_type="private",
            )
            mock_send_message.reset_mock()

            sync_runtime_contact(
                config,
                telegram_user_id=999,
                chat_id=456,
                username="other_user",
                display_name="Other User",
                chat_type="private",
            )
            sync_runtime_contact(
                config,
                telegram_user_id=999,
                chat_id=456,
                username="other_user",
                display_name="Other User",
                chat_type="private",
            )

            mock_send_message.assert_not_called()

    @patch("src.fiscalbay.bot_common.send_message")
    def test_request_access_notifies_admin_and_marks_user_pending(self, mock_send_message) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids=set(),
                admin_user_id=123,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=123,
                username="admin_user",
                display_name="Admin",
                chat_type="private",
            )
            sync_runtime_contact(
                config,
                telegram_user_id=999,
                chat_id=456,
                username="other_user",
                display_name="Other User",
                chat_type="private",
            )

            replies = process_message(
                text="/request_access",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=999,
            )

            users = load_telegram_users(str(db_path))
            requested_user = next(user for user in users if user.telegram_user_id == 999)
            self.assertEqual(requested_user.status, "pending")
            audit_entries = load_audit_log_entries(str(db_path))
            self.assertEqual(audit_entries[0].event_type, "request_access")
            self.assertEqual(audit_entries[0].outcome, "pending")
            self.assertEqual(len(replies), 1)
            self.assertIn("Richiesta inviata", replies[0])
            mock_send_message.assert_called_once()
            self.assertEqual(mock_send_message.call_args.args[1], 123)

    @patch("src.fiscalbay.bot_common.send_message")
    def test_user_can_request_assisted_data_deletion(self, mock_send_message) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={123, 456},
                notify_chat_ids=set(),
                admin_user_id=123,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )
            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=123,
                username="admin_user",
                display_name="Admin",
                chat_type="private",
            )
            sync_runtime_contact(
                config,
                telegram_user_id=1000,
                chat_id=456,
                username="ops_user",
                display_name="Ops User",
                chat_type="private",
            )
            update_telegram_user_status(
                str(db_path),
                1000,
                TELEGRAM_USER_STATUS_APPROVED,
                updated_at="2026-04-06T10:00:00Z",
            )
            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=1000,
                    ebay_user_id="seller-1000",
                    environment="production",
                    linked_at="2026-04-06T10:00:00Z",
                ),
            )

            replies = process_message(
                text="/settings dati cancellazione",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=1000,
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Richiesta dati registrata", replies[0])
            self.assertIn("Tipo richiesta: <code>delete</code>", replies[0])
            self.assertIn("Azione automatica: <code>nessuna cancellazione</code>", replies[0])
            self.assertIsNotNone(load_telegram_user(str(db_path), 1000))
            self.assertIsNotNone(resolve_linked_ebay_account(str(db_path), 1000, "production"))
            mock_send_message.assert_called_once()
            self.assertEqual(mock_send_message.call_args.args[1], 123)
            self.assertIn("Richiesta dati utente", mock_send_message.call_args.args[2])
            self.assertIn("/admin export 1000", mock_send_message.call_args.args[2])
            self.assertIn("/admin delete_tenant 1000 confirm", mock_send_message.call_args.args[2])
            audit_entries = load_audit_log_entries(str(db_path), 5)
            self.assertEqual(audit_entries[0].event_type, "data_request")
            self.assertEqual(audit_entries[0].outcome, "delete_requested")

            repeated = process_message(
                text="/settings dati cancellazione",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=1000,
            )
            self.assertIn("cooldown", repeated[0])
            mock_send_message.assert_called_once()

    def test_process_message_status_reads_real_sqlite_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            save_state(
                str(db_path),
                {
                    "notified_order_ids": ["order-1"],
                    "notified_hashes": ["hash-1"],
                    "last_check": "2026-04-05T20:00:00Z",
                    "last_error": "none",
                    "metrics": {
                        "orders_read": 4,
                        "notifications_sent": 2,
                        "errors_by_type": {},
                    },
                },
            )

            replies = process_message(
                text="/stato",
                chat_id=1,
                telegram_config=TelegramConfig(
                    token="x",
                    allowed_chat_ids={1, 123, 456, 573159993},
                    notify_chat_ids=set(),
                    state_path=str(db_path),
                    retry_queue_path=str(db_path),
                ),
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("2026-04-05T20:00:00Z", replies[0])
            self.assertIn("<code>4</code>", replies[0])
            self.assertIn("<code>2</code>", replies[0])

    def test_approved_user_cannot_use_admin_commands(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={123, 456},
                notify_chat_ids=set(),
                admin_user_id=123,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=456,
                chat_id=456,
                username="approved_user",
                display_name="Approved User",
                chat_type="private",
            )
            update_telegram_user_status(
                str(db_path),
                456,
                TELEGRAM_USER_STATUS_APPROVED,
                updated_at="2026-04-28T10:00:00Z",
            )

            for command in (
                "/admin",
                "/admin help",
                "/admin_users all",
                "/tenant_health",
                "/approve_user 999",
                "/reject_user 999",
                "/suspend_user 999",
                "/reactivate_user 999",
                "/service_mode maintenance",
                "/ping",
            ):
                with self.subTest(command=command):
                    replies = process_message(
                        text=command,
                        chat_id=456,
                        telegram_config=config,
                        ebay_environment="production",
                        telegram_user_id=456,
                    )
                    self.assertEqual(replies, ["Solo l'admin può usare questo comando."])

    def test_persisted_admin_status_does_not_grant_admin_to_non_configured_user(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={123, 456},
                notify_chat_ids=set(),
                admin_user_id=123,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=456,
                chat_id=456,
                username="stale_admin",
                display_name="Stale Admin",
                chat_type="private",
            )
            update_telegram_user_status(
                str(db_path),
                456,
                TELEGRAM_USER_STATUS_ADMIN,
                updated_at="2026-04-28T10:00:00Z",
            )

            admin_replies = process_message(
                text="/admin_users all",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=456,
            )
            help_replies = process_message(
                text="/help",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=456,
            )

            self.assertEqual(admin_replies, ["Solo l'admin può usare questo comando."])
            self.assertIn("Benvenuto in FiscalBay", help_replies[0])
            self.assertNotIn("Area admin", help_replies[0])

    @patch("src.fiscalbay.bot_common.send_message")
    def test_repeated_approve_user_is_idempotent(self, mock_send_message) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={456},
                admin_user_id=123,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=123,
                username="admin_user",
                display_name="Admin",
                chat_type="private",
            )
            sync_runtime_contact(
                config,
                telegram_user_id=999,
                chat_id=456,
                username="other_user",
                display_name="Other User",
                chat_type="private",
            )
            process_message(
                text="/request_access",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=999,
            )
            mock_send_message.reset_mock()

            process_message(
                text="/approve_user 999",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )
            mock_send_message.reset_mock()

            replies = process_message(
                text="/approve_user 999",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )

            audit_entries = load_audit_log_entries(str(db_path), limit=5)
            self.assertEqual(audit_entries[0].event_type, "approve")
            self.assertEqual(audit_entries[0].outcome, "already_applied")
            self.assertEqual(len(replies), 1)
            self.assertIn("approved", replies[0])
            mock_send_message.assert_not_called()

            subscriptions = load_notification_subscriptions(str(db_path))
            self.assertEqual(len(subscriptions), 1)
            self.assertTrue(subscriptions[0].enabled)

    def test_admin_dashboard_surfaces_stable_product_metrics(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={123, 456},
                notify_chat_ids=set(),
                admin_user_id=123,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )
            save_state(
                str(db_path),
                {
                    "notified_order_ids": [],
                    "notified_hashes": [],
                    "last_check": "2026-04-06T10:00:00Z",
                    "last_error": None,
                    "metrics": {
                        "orders_read": 10,
                        "orders_with_fiscal_identifier": 4,
                        "notifications_sent": 2,
                        "telegram_retries": 0,
                        "consecutive_error_cycles": 0,
                        "errors_by_type": {},
                    },
                },
            )
            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=123,
                username="admin_user",
                display_name="Admin",
                chat_type="private",
            )
            sync_runtime_contact(
                config,
                telegram_user_id=999,
                chat_id=456,
                username="approved_user",
                display_name="Approved User",
                chat_type="private",
            )
            update_telegram_user_status(
                str(db_path),
                999,
                TELEGRAM_USER_STATUS_APPROVED,
                updated_at="2026-04-06T10:00:00Z",
            )
            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=999,
                    ebay_user_id="ready-ebay",
                    environment="production",
                    linked_at="2026-04-06T10:05:00Z",
                    status="linked",
                ),
            )
            account = resolve_linked_ebay_account(str(db_path), 999, "production")
            self.assertIsNotNone(account)
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=account.id or 0,
                    refresh_token_encrypted="encrypted",
                    status="active",
                ),
            )

            replies = process_message(
                text="/admin",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )

            self.assertIn("Metriche prodotto", replies[0])
            self.assertIn("Ordini letti: <code>10</code>", replies[0])
            self.assertIn("fiscali: <code>4</code> (<code>40%</code>)", replies[0])
            self.assertIn("Notifiche inviate: <code>2</code>", replies[0])
            self.assertIn("linked/approved: <code>50%</code>", replies[0])
            self.assertIn("/admin storico", replies[0])

    def test_admin_history_filters_recent_audit_by_tenant(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={123},
                notify_chat_ids=set(),
                admin_user_id=123,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )
            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=123,
                username="admin_user",
                display_name="Admin",
                chat_type="private",
            )
            append_audit_log_entry(
                str(db_path),
                AuditLogEntry(
                    event_type="data_request",
                    created_at="2026-04-28T10:00:00Z",
                    actor_telegram_user_id=999,
                    target_telegram_user_id=999,
                    telegram_chat_id=456,
                    outcome="delete_requested",
                    details_json='{"admin_notified": true, "account_status": "linked"}',
                ),
            )
            append_audit_log_entry(
                str(db_path),
                AuditLogEntry(
                    event_type="oauth_failure",
                    created_at="2026-04-28T10:05:00Z",
                    actor_telegram_user_id=888,
                    target_telegram_user_id=888,
                    telegram_chat_id=457,
                    outcome="failed",
                    details_json='{"reason": "token_expired"}',
                ),
            )

            replies = process_message(
                text="/admin storico 999 5",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Storico operativo", replies[0])
            self.assertIn("Filtro tenant: <code>999</code>", replies[0])
            self.assertIn("data_request", replies[0])
            self.assertIn("delete_requested", replies[0])
            self.assertIn("admin_notified=True", replies[0])
            self.assertNotIn("oauth_failure", replies[0])
            self.assertNotIn("888", replies[0])

    def test_service_mode_is_rate_limited(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={123},
                notify_chat_ids=set(),
                admin_user_id=123,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=123,
                username="admin_user",
                display_name="Admin",
                chat_type="private",
            )

            replies = process_message(
                text="/service_mode maintenance",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )
            self.assertIn("maintenance", replies[0])

            second_replies = process_message(
                text="/service_mode degraded",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )
            self.assertIn("cooldown", second_replies[0])

    @patch("src.fiscalbay.bot_common.send_message")
    def test_admin_status_mutations_are_rate_limited_per_admin(self, mock_send_message) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={123, 456, 789},
                notify_chat_ids=set(),
                admin_user_id=123,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=123,
                username="admin_user",
                display_name="Admin",
                chat_type="private",
            )
            for telegram_user_id, chat_id in ((999, 456), (888, 789)):
                sync_runtime_contact(
                    config,
                    telegram_user_id=telegram_user_id,
                    chat_id=chat_id,
                    username=f"user_{telegram_user_id}",
                    display_name=f"User {telegram_user_id}",
                    chat_type="private",
                )
                process_message(
                    text="/request_access",
                    chat_id=chat_id,
                    telegram_config=config,
                    ebay_environment="production",
                    telegram_user_id=telegram_user_id,
                )
            mock_send_message.reset_mock()

            first_replies = process_message(
                text="/approve_user 999",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )
            second_replies = process_message(
                text="/approve_user 888",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )

            self.assertIn("approved", first_replies[0])
            self.assertIn("cooldown", second_replies[0])
            blocked_user = load_telegram_user(str(db_path), 888)
            self.assertIsNotNone(blocked_user)
            self.assertEqual(blocked_user.status, "pending")

    @patch("src.fiscalbay.bot_common.send_message")
    def test_admin_can_filter_pending_and_unlinked_users(self, mock_send_message) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={123, 456, 457},
                notify_chat_ids=set(),
                admin_user_id=123,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=123,
                username="admin_user",
                display_name="Admin",
                chat_type="private",
            )
            sync_runtime_contact(
                config,
                telegram_user_id=999,
                chat_id=456,
                username="pending_user",
                display_name="Pending User",
                chat_type="private",
            )
            process_message(
                text="/request_access",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=999,
            )
            sync_runtime_contact(
                config,
                telegram_user_id=1000,
                chat_id=457,
                username="approved_user",
                display_name="Approved User",
                chat_type="private",
            )
            update_telegram_user_status(
                str(db_path),
                1000,
                TELEGRAM_USER_STATUS_APPROVED,
                updated_at="2026-04-06T10:00:00Z",
            )

            pending_replies = process_message(
                text="/admin_users pending",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )
            self.assertIn("pending_user", pending_replies[0])
            self.assertNotIn("approved_user", pending_replies[0])

            unlinked_replies = process_message(
                text="/admin_users unlinked",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )
            self.assertIn("approved_user", unlinked_replies[0])
            self.assertNotIn("pending_user", unlinked_replies[0])
            mock_send_message.assert_called_once()

    def test_admin_empty_filtered_views_use_specific_empty_messages(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={123},
                notify_chat_ids=set(),
                admin_user_id=123,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=123,
                username="admin_user",
                display_name="Admin",
                chat_type="private",
            )

            pending_replies = process_message(
                text="/admin_users pending",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )
            self.assertIn("Nessuna richiesta accesso pending", pending_replies[0])

            unlinked_replies = process_message(
                text="/admin_users unlinked",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )
            self.assertIn(
                "Nessun utente approvato in attesa di collegamento",
                unlinked_replies[0],
            )

            reconnect_replies = process_message(
                text="/admin_users reconnect",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )
            self.assertIn("Nessun tenant richiede reconnect", reconnect_replies[0])

            inactive_replies = process_message(
                text="/admin_users inactive",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )
            self.assertIn("Nessun tenant operativo risulta inattivo", inactive_replies[0])

            maintenance_replies = process_message(
                text="/admin manutenzione",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )
            self.assertIn("Maintenance Overview", maintenance_replies[0])
            self.assertIn("OAuth pending attive", maintenance_replies[0])

    def test_admin_maintenance_overview_highlights_queue_and_oauth_cleanup(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={123, 456},
                notify_chat_ids=set(),
                admin_user_id=123,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=123,
                username="admin_user",
                display_name="Admin",
                chat_type="private",
            )
            sync_runtime_contact(
                config,
                telegram_user_id=1000,
                chat_id=456,
                username="ops_user",
                display_name="Ops User",
                chat_type="private",
            )
            update_telegram_user_status(
                str(db_path),
                1000,
                TELEGRAM_USER_STATUS_APPROVED,
                updated_at="2026-04-06T10:00:00Z",
            )
            create_oauth_link_session(
                str(db_path),
                OauthLinkSession(
                    telegram_user_id=1000,
                    telegram_chat_id=456,
                    oauth_state="expired-pending-state",
                    status="pending",
                    expires_at="2026-04-06T10:05:00Z",
                    created_at="2026-04-06T10:00:00Z",
                ),
            )
            create_oauth_link_session(
                str(db_path),
                OauthLinkSession(
                    telegram_user_id=1000,
                    telegram_chat_id=456,
                    oauth_state="failed-state",
                    status="failed",
                    expires_at="2026-04-06T10:10:00Z",
                    created_at="2026-04-06T10:00:00Z",
                ),
            )
            save_retry_queue(
                str(db_path),
                [
                    {"chat_id": 456, "text": "retry me", "attempts": 2},
                ],
            )
            save_tenant_retry_queue_entries(
                str(db_path),
                1000,
                [RetryQueueEntry(chat_id=456, text="tenant retry", attempts=1)],
            )
            enqueue_apply_user_access_operation(
                state_path=str(db_path),
                actor_telegram_user_id=123,
                target_telegram_user_id=1000,
                requested_status=TELEGRAM_USER_STATUS_APPROVED,
            )
            queue_entries = load_operation_queue_entries(str(db_path), limit=5)
            self.assertEqual(len(queue_entries), 1)

            replies = process_message(
                text="/admin manutenzione",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("OAuth pending scadute", replies[0])
            self.assertIn("retry backlog: <code>2</code>", replies[0])
            self.assertIn("queue op=", replies[0])
            self.assertIn("pending_session user=", replies[0])
            self.assertIn("Priorità consigliate", replies[0])

    def test_admin_can_export_and_delete_tenant_data(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={123, 456},
                notify_chat_ids=set(),
                admin_user_id=123,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )
            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=123,
                username="admin_user",
                display_name="Admin",
                chat_type="private",
            )
            sync_runtime_contact(
                config,
                telegram_user_id=1000,
                chat_id=456,
                username="ops_user",
                display_name="Ops User",
                chat_type="private",
            )
            update_telegram_user_status(
                str(db_path),
                1000,
                TELEGRAM_USER_STATUS_APPROVED,
                updated_at="2026-04-06T10:00:00Z",
            )
            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=1000,
                    ebay_user_id="seller-1000",
                    environment="production",
                    linked_at="2026-04-06T10:00:00Z",
                ),
            )
            account = resolve_linked_ebay_account(str(db_path), 1000, "production")
            assert account is not None and account.id is not None
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=account.id,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="access-token",
                    status="active",
                ),
            )

            export_replies = process_message(
                text="/admin export 1000",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )

            self.assertIn("Export tenant", export_replies[0])
            self.assertIn("refresh_token_configured", export_replies[0])
            self.assertNotIn("tenant-refresh", export_replies[0])

            delete_replies = process_message(
                text="/admin delete_tenant 1000 confirm",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )

            self.assertIn("Cancellazione tenant", delete_replies[0])
            self.assertIsNone(load_telegram_user(str(db_path), 1000))
            self.assertIsNone(resolve_linked_ebay_account(str(db_path), 1000, "production"))
            audit_events = [entry.event_type for entry in load_audit_log_entries(str(db_path), 5)]
            self.assertIn("tenant_delete", audit_events)
            self.assertIn("tenant_export", audit_events)

    @patch("src.fiscalbay.bot_common.fetch_records")
    @patch("src.fiscalbay.bot_common.load_config")
    @patch("src.fiscalbay.bot_orders.send_message")
    def test_first_bootstrap_persists_state_without_sending_messages(
        self,
        mock_send_message,
        mock_load_config,
        mock_fetch_records,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            mock_load_config.return_value = object()
            mock_fetch_records.return_value = _order_records(
                [
                    {
                        "orderId": "new-order",
                        "creationDate": "2026-04-05T20:00:00Z",
                        "buyerUsername": "buyer",
                        "taxpayerId": "RSSMRA80A01H501U",
                        "taxIdentifierType": "CODICE_FISCALE",
                        "issuingCountry": "IT",
                    }
                ]
            )

            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={123},
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            maybe_send_new_order_notifications(config, "production")

            state = load_state(str(db_path))
            self.assertIn("new-order", state["notified_order_ids"])
            self.assertTrue(state["last_check"])
            mock_send_message.assert_not_called()

    def test_sync_runtime_contact_persists_user_chat_and_subscription(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={456},
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=456,
                username="seller_user",
                display_name="Mario Rossi",
                chat_type="private",
            )

            users = load_telegram_users(str(db_path))
            chats = load_telegram_chats(str(db_path))
            subscriptions = load_notification_subscriptions(str(db_path))

            self.assertEqual(len(users), 1)
            self.assertEqual(users[0].telegram_user_id, 123)
            self.assertEqual(users[0].telegram_chat_id, 456)
            self.assertEqual(users[0].username, "seller_user")

            self.assertEqual(len(chats), 1)
            self.assertEqual(chats[0].telegram_user_id, 123)
            self.assertEqual(chats[0].telegram_chat_id, 456)
            self.assertTrue(chats[0].notifications_enabled)

            self.assertEqual(len(subscriptions), 1)
            self.assertEqual(subscriptions[0].telegram_user_id, 123)
            self.assertEqual(subscriptions[0].telegram_chat_id, 456)
            self.assertTrue(subscriptions[0].enabled)

    def test_process_message_status_uses_tenant_state_when_chat_is_mapped(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={456},
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=456,
                username="seller_user",
                display_name="Mario Rossi",
                chat_type="private",
            )
            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=123,
                    ebay_user_id="seller-ebay",
                    environment="sandbox",
                    linked_at="2026-04-06T10:10:00Z",
                    status="linked",
                ),
            )
            save_tenant_runtime_state(
                str(db_path),
                123,
                BotRuntimeState.from_mapping(
                    {
                        "notified_order_ids": ["tenant-order"],
                        "notified_hashes": ["tenant-hash"],
                        "last_check": "2026-04-06T10:20:00Z",
                        "last_error": None,
                        "metrics": {
                            "orders_read": 9,
                            "orders_with_fiscal_identifier": 4,
                            "notifications_sent": 3,
                            "telegram_retries": 0,
                            "errors_by_type": {},
                        },
                    }
                ),
            )
            save_state(
                str(db_path),
                {
                    "notified_order_ids": ["global-order"],
                    "notified_hashes": ["global-hash"],
                    "last_check": "2026-04-06T09:00:00Z",
                    "last_error": None,
                    "metrics": {
                        "orders_read": 1,
                        "orders_with_fiscal_identifier": 0,
                        "notifications_sent": 0,
                        "errors_by_type": {},
                    },
                },
            )

            replies = process_message(
                text="/stato",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("2026-04-06T10:20:00Z", replies[0])
            self.assertIn("<code>9</code>", replies[0])
            self.assertIn("Scope runtime: <code>tenant</code>", replies[0])
            self.assertIn("Sorgente credenziali: <code>global_env</code>", replies[0])
            self.assertIn(
                "Fallback credenziali: <code>tenant_credentials_unavailable</code>", replies[0]
            )
            self.assertNotIn("2026-04-06T09:00:00Z", replies[0])

    def test_process_message_support_snapshot_for_approved_user(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={456},
                notify_chat_ids=set(),
                admin_user_id=999,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )
            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=456,
                username="seller_user",
                display_name="Mario Rossi",
                chat_type="private",
            )
            update_telegram_user_status(
                str(db_path),
                123,
                TELEGRAM_USER_STATUS_APPROVED,
                updated_at="2026-04-06T10:00:00Z",
            )
            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=123,
                    ebay_user_id="seller-ebay",
                    environment="production",
                    linked_at="2026-04-06T10:10:00Z",
                    status="linked",
                ),
            )
            account = resolve_linked_ebay_account(str(db_path), 123, "production")
            assert account is not None and account.id is not None
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=account.id,
                    refresh_token_encrypted="plain:tenant-refresh",
                    status="active",
                ),
            )
            save_tenant_runtime_state(
                str(db_path),
                123,
                BotRuntimeState(
                    last_check="2026-04-07T08:00:00Z",
                    memory=BotOperationalMemory(
                        last_fetch_end="2026-04-07T08:00:01Z",
                        last_fetch_count=1,
                        last_seen_order_id="order-1",
                    ),
                ),
            )

            replies = process_message(
                text="/support",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Support Snapshot", replies[0])
            self.assertIn("seller-ebay", replies[0])
            self.assertIn("order-1", replies[0])
            self.assertIn("nessuna azione urgente", replies[0])

    def test_process_message_admin_support_snapshot_for_target_user(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={999, 456},
                notify_chat_ids=set(),
                admin_user_id=999,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )
            sync_runtime_contact(
                config,
                telegram_user_id=999,
                chat_id=999,
                username="admin_user",
                display_name="Admin",
                chat_type="private",
            )
            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=456,
                username="seller_user",
                display_name="Mario Rossi",
                chat_type="private",
            )
            update_telegram_user_status(
                str(db_path),
                123,
                TELEGRAM_USER_STATUS_APPROVED,
                updated_at="2026-04-06T10:00:00Z",
            )
            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=123,
                    ebay_user_id="seller-ebay",
                    environment="production",
                    linked_at="2026-04-06T10:10:00Z",
                    status="linked",
                ),
            )
            account = resolve_linked_ebay_account(str(db_path), 123, "production")
            assert account is not None and account.id is not None
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=account.id,
                    refresh_token_encrypted="plain:tenant-refresh",
                    status="active",
                ),
            )

            replies = process_message(
                text="/admin support 123",
                chat_id=999,
                telegram_user_id=999,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Support Snapshot Utente", replies[0])
            self.assertIn("Telegram user: <code>123</code>", replies[0])
            self.assertIn("seller-ebay", replies[0])


if __name__ == "__main__":
    unittest.main()
