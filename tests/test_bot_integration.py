import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src.fiscalbay.bot import (
    enqueue_apply_user_access_operation,
    maybe_send_new_order_notifications,
    process_message,
    record_fingerprint,
    sync_runtime_contact,
)
from src.fiscalbay.models import (
    TELEGRAM_USER_STATUS_ADMIN,
    TELEGRAM_USER_STATUS_APPROVED,
    AuditLogEntry,
    BotRuntimeState,
    EbayTokenSet,
    LinkedEbayAccount,
    OauthLinkSession,
    TelegramConfig,
)
from src.fiscalbay.storage.sqlite import (
    append_audit_log_entry,
    create_oauth_link_session,
    load_audit_log_entries,
    load_latest_oauth_link_session,
    load_notification_subscriptions,
    load_operation_queue_entries,
    load_retry_queue,
    load_state,
    load_telegram_chats,
    load_telegram_users,
    resolve_linked_ebay_account,
    save_retry_queue,
    save_state,
    save_tenant_runtime_state,
    set_notification_subscription_enabled,
    update_telegram_user_status,
    upsert_ebay_token_set,
    upsert_linked_ebay_account,
)


class BotIntegrationTests(unittest.TestCase):
    def test_start_for_new_user_prompts_request_access(self) -> None:
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
            telegram_user_id=111111,
        )

        self.assertEqual(len(replies), 1)
        self.assertIn("/request_access", replies[0])
        self.assertIn("solo chat privata", replies[0])

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

    def test_removed_legacy_commands_point_to_canonical_commands(self) -> None:
        config = TelegramConfig(
            token="x",
            allowed_chat_ids={573159993},
            notify_chat_ids=set(),
        )

        cases = {
            "/connect": "/account collega",
            "/disconnect": "/account scollega",
            "/notifications": "/settings notifiche",
            "/ultimi": "/ordini fiscali",
            "/ordine 12-34567-89012": "/ordini cerca",
        }
        for command, expected_hint in cases.items():
            with self.subTest(command=command):
                replies = process_message(
                    text=command,
                    chat_id=573159993,
                    telegram_config=config,
                    ebay_environment="production",
                    telegram_user_id=111111,
                )
                self.assertEqual(len(replies), 1)
                self.assertIn("Comando accorpato", replies[0])
                self.assertIn(expected_hint, replies[0])

    def test_start_for_approved_user_without_account_prompts_connect(self) -> None:
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
                telegram_user_id=999,
                chat_id=456,
                username="other_user",
                display_name="Other User",
                chat_type="private",
            )
            update_telegram_user_status(
                str(db_path),
                999,
                TELEGRAM_USER_STATUS_APPROVED,
                updated_at="2026-04-06T10:00:00Z",
            )

            replies = process_message(
                text="/start",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=999,
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("accesso e' approvato", replies[0])
            self.assertIn("/account collega", replies[0])

    def test_start_for_approved_user_with_linked_account_shows_operational_commands(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={456},
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
                    environment="sandbox",
                    linked_at="2026-04-06T10:10:00Z",
                    status="linked",
                ),
            )
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=1,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="",
                    scope_set="scope",
                    status="active",
                ),
            )

            replies = process_message(
                text="/start",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("account eBay risulta collegato", replies[0])
            self.assertIn("seller-ebay", replies[0])
            self.assertIn("/ordini fiscali", replies[0])

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

    @patch("src.fiscalbay.bot.send_message")
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

    @patch("src.fiscalbay.bot.send_message")
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

    @patch("src.fiscalbay.bot.send_message")
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

    @patch("src.fiscalbay.bot.send_message")
    def test_admin_can_approve_user_and_user_becomes_operational(self, mock_send_message) -> None:
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
            process_message(
                text="/request_access",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=999,
            )
            mock_send_message.reset_mock()

            replies = process_message(
                text="/approve_user 999",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )

            users = load_telegram_users(str(db_path))
            approved_user = next(user for user in users if user.telegram_user_id == 999)
            self.assertEqual(approved_user.status, "approved")
            audit_entries = load_audit_log_entries(str(db_path), limit=5)
            self.assertEqual(audit_entries[0].event_type, "approve")
            self.assertEqual(audit_entries[0].outcome, "applied")
            self.assertEqual(len(replies), 1)
            self.assertIn("approved", replies[0])
            mock_send_message.assert_called_once()
            self.assertEqual(mock_send_message.call_args.args[1], 456)

            approved_help = process_message(
                text="/help",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=999,
            )
            self.assertIn("Benvenuto in FiscalBay", approved_help[0])

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

    def test_non_approved_user_cannot_open_account_before_approval(self) -> None:
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
                telegram_user_id=999,
                chat_id=456,
                username="other_user",
                display_name="Other User",
                chat_type="private",
            )

            replies = process_message(
                text="/account",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=999,
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("/request_access", replies[0])

    def test_pending_user_cannot_review_access_requests(self) -> None:
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

            replies = process_message(
                text="/admin_users all",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=999,
            )

            self.assertEqual(replies, ["Solo l'admin puo' usare questo comando."])

    @patch("src.fiscalbay.bot.send_message")
    def test_admin_users_view_highlights_pending_waiting_connect_and_ready(
        self,
        mock_send_message,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 457, 458, 573159993},
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
            sync_runtime_contact(
                config,
                telegram_user_id=1001,
                chat_id=458,
                username="ready_user",
                display_name="Ready User",
                chat_type="private",
            )
            update_telegram_user_status(
                str(db_path),
                1001,
                TELEGRAM_USER_STATUS_APPROVED,
                updated_at="2026-04-06T10:05:00Z",
            )
            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=1001,
                    ebay_user_id="ready-ebay",
                    environment="production",
                    linked_at="2026-04-06T10:10:00Z",
                    status="linked",
                ),
            )
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=1,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="",
                    scope_set="scope",
                    status="active",
                ),
            )

            replies = process_message(
                text="/admin_users all",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Richieste pending", replies[0])
            self.assertIn("Approvati ma non ancora operativi", replies[0])
            self.assertIn("Utenti operativi", replies[0])
            self.assertIn("ready-ebay", replies[0])
            mock_send_message.assert_called_once()

    @patch("src.fiscalbay.bot.send_message")
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

    def test_repeated_connect_reuses_pending_oauth_session(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids=set(),
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

            first_replies = process_message(
                text="/account collega",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=999,
            )
            first_session = load_latest_oauth_link_session(str(db_path), 999)
            assert first_session is not None

            second_replies = process_message(
                text="/account collega",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=999,
            )
            second_session = load_latest_oauth_link_session(str(db_path), 999)
            assert second_session is not None

            self.assertEqual(first_session.id, second_session.id)
            self.assertEqual(first_session.oauth_state, second_session.oauth_state)
            self.assertEqual(len(first_replies), 1)
            self.assertIn("Sessione OAuth", first_replies[0])
            self.assertIn("Sessione OAuth", second_replies[0])
            self.assertIn("Sessione OAuth preparata correttamente", first_replies[0])
            self.assertIn("Sessione gia' pronta", second_replies[0])

            audit_entries = load_audit_log_entries(str(db_path), limit=5)
            self.assertEqual(audit_entries[0].event_type, "connect")
            self.assertEqual(audit_entries[0].outcome, "session_reused")

    def test_service_status_and_policy_are_available_through_canonical_commands(self) -> None:
        replies = process_message(
            text="/stato servizio",
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
        self.assertIn("accesso approvato", replies[0])

        policy_replies = process_message(
            text="/settings policy",
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
        self.assertEqual(len(policy_replies), 1)
        self.assertIn("Policy Servizio", policy_replies[0])

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

    @patch("src.fiscalbay.bot.send_message")
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

    def test_admin_can_filter_reconnect_and_inactive_users(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={123, 456, 457, 458},
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
                username="reconnect_user",
                display_name="Reconnect User",
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
                    ebay_user_id="seller-reconnect",
                    environment="production",
                    linked_at="2026-04-06T10:10:00Z",
                    status="linked",
                ),
            )
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=1,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="",
                    scope_set="scope",
                    status="revoked",
                ),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=1001,
                chat_id=457,
                username="inactive_user",
                display_name="Inactive User",
                chat_type="private",
            )
            update_telegram_user_status(
                str(db_path),
                1001,
                TELEGRAM_USER_STATUS_APPROVED,
                updated_at="2026-04-01T10:00:00Z",
            )
            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=1001,
                    ebay_user_id="seller-inactive",
                    environment="production",
                    linked_at="2026-04-01T10:10:00Z",
                    status="linked",
                ),
            )
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=2,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="",
                    scope_set="scope",
                    status="active",
                ),
            )
            save_tenant_runtime_state(
                str(db_path),
                1001,
                BotRuntimeState.from_mapping(
                    {
                        "memory": {
                            "last_fetch_end": "2026-03-01T10:00:00Z",
                        }
                    }
                ),
            )

            reconnect_replies = process_message(
                text="/admin_users reconnect",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )
            self.assertIn("reconnect_user", reconnect_replies[0])
            self.assertNotIn("inactive_user", reconnect_replies[0])

            inactive_replies = process_message(
                text="/admin_users inactive",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )
            self.assertIn("inactive_user", inactive_replies[0])
            self.assertNotIn("reconnect_user", inactive_replies[0])

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
            self.assertIn("retry backlog", replies[0])
            self.assertIn("queue op=", replies[0])
            self.assertIn("pending_session user=", replies[0])
            self.assertIn("Priorita' consigliate", replies[0])

    def test_maintenance_mode_blocks_connect_but_not_account_reads(self) -> None:
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

            mode_replies = process_message(
                text="/service_mode maintenance",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )
            self.assertIn("maintenance", mode_replies[0])

            connect_replies = process_message(
                text="/account collega",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=999,
            )
            self.assertIn("manutenzione", connect_replies[0])

            account_replies = process_message(
                text="/account",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=999,
            )
            self.assertIn("Account eBay", account_replies[0])

    @patch("src.fiscalbay.bot.fetch_records")
    @patch("src.fiscalbay.bot.load_config")
    @patch("src.fiscalbay.bot.send_message")
    def test_first_bootstrap_persists_state_without_sending_messages(
        self,
        mock_send_message,
        mock_load_config,
        mock_fetch_records,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            mock_load_config.return_value = object()
            mock_fetch_records.return_value = [
                {
                    "orderId": "new-order",
                    "creationDate": "2026-04-05T20:00:00Z",
                    "buyerUsername": "buyer",
                    "taxpayerId": "RSSMRA80A01H501U",
                    "taxIdentifierType": "CODICE_FISCALE",
                    "issuingCountry": "IT",
                }
            ]

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

    @patch("src.fiscalbay.bot.fetch_records")
    @patch("src.fiscalbay.bot.load_config")
    @patch("src.fiscalbay.bot.send_message")
    def test_subsequent_poll_sends_only_new_records(
        self,
        mock_send_message,
        mock_load_config,
        mock_fetch_records,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            old_record = {
                "orderId": "old-order",
                "creationDate": "2026-04-05T19:00:00Z",
                "buyerUsername": "buyer-old",
                "taxpayerId": "RSSOLD80A01H501U",
                "taxIdentifierType": "CODICE_FISCALE",
                "issuingCountry": "IT",
            }
            new_record = {
                "orderId": "new-order",
                "creationDate": "2026-04-05T20:00:00Z",
                "buyerUsername": "buyer-new",
                "taxpayerId": "RSSNEW80A01H501U",
                "taxIdentifierType": "CODICE_FISCALE",
                "issuingCountry": "IT",
            }

            save_state(
                str(db_path),
                {
                    "notified_order_ids": ["old-order"],
                    "notified_hashes": [record_fingerprint(old_record)],
                    "last_check": "2026-04-05T19:30:00Z",
                    "last_error": None,
                    "metrics": {
                        "orders_read": 0,
                        "notifications_sent": 0,
                        "errors_by_type": {},
                    },
                },
            )
            mock_load_config.return_value = object()
            mock_fetch_records.return_value = [old_record, new_record]

            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={123},
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            maybe_send_new_order_notifications(config, "production")

            state = load_state(str(db_path))
            queue = load_retry_queue(str(db_path))
            self.assertEqual(mock_send_message.call_count, 1)
            self.assertIn("new-order", state["notified_order_ids"])
            self.assertEqual(state["metrics"]["orders_read"], 1)
            self.assertEqual(state["metrics"]["notifications_sent"], 1)
            self.assertEqual(queue, [])

    @patch("src.fiscalbay.bot.fetch_records")
    @patch("src.fiscalbay.bot.load_config")
    @patch("src.fiscalbay.bot.send_message")
    def test_poll_uses_last_fetch_end_for_incremental_window(
        self,
        mock_send_message,
        mock_load_config,
        mock_fetch_records,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            save_state(
                str(db_path),
                {
                    "notified_order_ids": [],
                    "notified_hashes": [],
                    "last_check": "2026-04-05T19:30:00Z",
                    "last_error": None,
                    "metrics": {
                        "orders_read": 0,
                        "notifications_sent": 0,
                        "errors_by_type": {},
                    },
                    "memory": {
                        "last_fetch_end": "2026-04-05T19:20:00Z",
                    },
                },
            )
            mock_load_config.return_value = object()
            mock_fetch_records.return_value = []

            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={123},
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            maybe_send_new_order_notifications(config, "production")

            options = mock_fetch_records.call_args.args[1]
            self.assertEqual(options.created_after, "2026-04-05T19:20:00Z")
            state = load_state(str(db_path))
            self.assertTrue(state["memory"]["last_fetch_end"])
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

    @patch.dict(
        "os.environ",
        {
            "EBAY_CLIENT_ID": "cid",
            "EBAY_CLIENT_SECRET": "secret",
            "EBAY_ENABLE_PLAINTEXT_TENANT_TOKENS": "1",
        },
        clear=False,
    )
    @patch("src.fiscalbay.bot.fetch_records")
    def test_process_message_fetch_uses_linked_account_environment_for_tenant(
        self,
        mock_fetch_records,
    ) -> None:
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
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=1,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="",
                    scope_set="scope",
                    status="active",
                ),
            )
            mock_fetch_records.return_value = [
                {
                    "orderId": "order-1",
                    "creationDate": "2026-04-06T10:30:00Z",
                    "buyerUsername": "buyer",
                }
            ]

            replies = process_message(
                text="/ordini cerca order-1",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertTrue(replies)
            mock_fetch_records.assert_called_once()
            resolved_config = mock_fetch_records.call_args.args[0]
            self.assertEqual(resolved_config.environment, "sandbox")
            self.assertEqual(resolved_config.refresh_token, "tenant-refresh")

    def test_process_message_order_requires_connected_tenant_credentials(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={456},
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

            replies = process_message(
                text="/ordini cerca order-1",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Usa /account collega", replies[0])

    @patch("src.fiscalbay.bot.fetch_records")
    @patch("src.fiscalbay.bot.load_config")
    def test_process_message_order_includes_notification_summary(
        self,
        mock_load_config,
        mock_fetch_records,
    ) -> None:
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
            mock_load_config.return_value = object()
            mock_fetch_records.return_value = [
                {
                    "orderId": "order-4",
                    "creationDate": "2026-04-05T20:00:00Z",
                    "buyerUsername": "buyer",
                    "taxpayerId": "RSSMRA80A01H501U",
                    "taxIdentifierType": "CODICE_FISCALE",
                    "issuingCountry": "IT",
                }
            ]

            replies = process_message(
                text="/ordini cerca order-4",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Notificabilita'", replies[0])
            self.assertIn("would_notify", replies[0])
            self.assertIn("delivery_ready", replies[0])

    @patch("src.fiscalbay.bot.fetch_records")
    @patch("src.fiscalbay.bot.load_config")
    def test_process_message_why_not_notified_reports_missing_fiscal_identifier(
        self,
        mock_load_config,
        mock_fetch_records,
    ) -> None:
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
            mock_load_config.return_value = object()
            mock_fetch_records.return_value = [
                {
                    "orderId": "order-1",
                    "creationDate": "2026-04-05T20:00:00Z",
                    "buyerUsername": "buyer",
                    "taxpayerId": "",
                    "taxIdentifierType": "",
                    "issuingCountry": "IT",
                }
            ]

            replies = process_message(
                text="/ordini spiega order-1",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("not_eligible", replies[0])
            self.assertIn("identificativo fiscale", replies[0])
            self.assertIn("Blocco attuale", replies[0])
            self.assertIn("Prossima azione", replies[0])

    @patch("src.fiscalbay.bot.fetch_records")
    @patch("src.fiscalbay.bot.load_config")
    def test_process_message_why_not_notified_reports_vat_order_as_eligible(
        self,
        mock_load_config,
        mock_fetch_records,
    ) -> None:
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
            mock_load_config.return_value = object()
            mock_fetch_records.return_value = [
                {
                    "orderId": "order-vat-1",
                    "creationDate": "2026-04-05T20:00:00Z",
                    "buyerUsername": "buyer",
                    "taxpayerId": "IT12345678901",
                    "taxIdentifierType": "VAT_NUMBER",
                    "issuingCountry": "IT",
                }
            ]

            replies = process_message(
                text="/ordini spiega order-vat-1",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("would_notify", replies[0])
            self.assertIn("delivery_ready", replies[0])

    @patch("src.fiscalbay.bot.fetch_records")
    @patch("src.fiscalbay.bot.load_config")
    def test_process_message_why_not_notified_reports_already_notified_order(
        self,
        mock_load_config,
        mock_fetch_records,
    ) -> None:
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
            save_tenant_runtime_state(
                str(db_path),
                123,
                BotRuntimeState(
                    notified_order_ids=["order-1"],
                    notified_hashes=[],
                    last_check="2026-04-05T20:00:00Z",
                ),
            )
            mock_load_config.return_value = object()
            mock_fetch_records.return_value = [
                {
                    "orderId": "order-1",
                    "creationDate": "2026-04-05T20:00:00Z",
                    "buyerUsername": "buyer",
                    "taxpayerId": "RSSMRA80A01H501U",
                    "taxIdentifierType": "CODICE_FISCALE",
                    "issuingCountry": "IT",
                }
            ]

            replies = process_message(
                text="/ordini spiega order-1",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("already_notified_order_id", replies[0])
            self.assertIn("deduplica per orderId", replies[0])

    @patch("src.fiscalbay.bot.fetch_records")
    @patch("src.fiscalbay.bot.load_config")
    def test_process_message_why_not_notified_reports_would_notify(
        self,
        mock_load_config,
        mock_fetch_records,
    ) -> None:
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
            mock_load_config.return_value = object()
            mock_fetch_records.return_value = [
                {
                    "orderId": "order-2",
                    "creationDate": "2026-04-05T20:00:00Z",
                    "buyerUsername": "buyer",
                    "taxpayerId": "RSSMRA80A01H501U",
                    "taxIdentifierType": "CODICE_FISCALE",
                    "issuingCountry": "IT",
                }
            ]

            replies = process_message(
                text="/ordini spiega order-2",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("would_notify", replies[0])
            self.assertIn("notificabile", replies[0])
            self.assertIn("delivery_ready", replies[0])
            self.assertIn("Nessuna azione richiesta", replies[0])

    @patch("src.fiscalbay.bot.fetch_records")
    @patch("src.fiscalbay.bot.load_config")
    def test_process_message_why_not_notified_reports_disabled_chat_delivery(
        self,
        mock_load_config,
        mock_fetch_records,
    ) -> None:
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
            set_notification_subscription_enabled(
                str(db_path),
                123,
                456,
                False,
                created_at="2026-04-06T10:00:00Z",
                updated_at="2026-04-06T10:05:00Z",
            )
            mock_load_config.return_value = object()
            mock_fetch_records.return_value = [
                {
                    "orderId": "order-3",
                    "creationDate": "2026-04-05T20:00:00Z",
                    "buyerUsername": "buyer",
                    "taxpayerId": "RSSMRA80A01H501U",
                    "taxIdentifierType": "CODICE_FISCALE",
                    "issuingCountry": "IT",
                }
            ]

            replies = process_message(
                text="/ordini spiega order-3",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("would_notify", replies[0])
            self.assertIn("chat_notifications_disabled", replies[0])
            self.assertIn("/settings notifiche on", replies[0])
            self.assertIn("chat corrente non e' pronta", replies[0])
            self.assertIn("Comando rapido", replies[0])

    def test_process_message_account_reports_linked_account_status(self) -> None:
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
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=1,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="",
                    scope_set="scope",
                    status="active",
                ),
            )

            replies = process_message(
                text="/account",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Utente eBay: <code>seller-ebay</code>", replies[0])
            self.assertIn("Ambiente: <code>sandbox</code>", replies[0])
            self.assertIn("Token: <code>active</code>", replies[0])
            self.assertIn("Chat corrente: <code>attive</code>", replies[0])
            self.assertIn("Prossimi passi", replies[0])

    def test_process_message_reconnect_status_reports_linked_account_as_ok(self) -> None:
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
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=1,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="",
                    scope_set="scope",
                    status="active",
                ),
            )

            replies = process_message(
                text="/account reconnect",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Stato attuale: <code>linked</code>", replies[0])
            self.assertIn("Nessuna azione richiesta", replies[0])

    def test_process_message_reconnect_status_requires_connect_when_unlinked(self) -> None:
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

            replies = process_message(
                text="/account reconnect",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Stato attuale: <code>unlinked</code>", replies[0])
            self.assertIn("/account collega", replies[0])

    def test_process_message_reconnect_status_reports_reconnect_required_for_revoked_token(
        self,
    ) -> None:
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
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=1,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="",
                    scope_set="scope",
                    status="revoked",
                ),
            )

            replies = process_message(
                text="/account reconnect",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Stato attuale: <code>reconnect_required</code>", replies[0])
            self.assertIn("Stato token: <code>revoked</code>", replies[0])
            self.assertIn("/account collega", replies[0])

    def test_process_message_reconnect_status_reports_ready_connect_session(self) -> None:
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
            create_oauth_link_session(
                str(db_path),
                OauthLinkSession(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    environment="production",
                    oauth_state="ready-state",
                    status="pending",
                    expires_at="2099-04-06T10:10:00Z",
                    created_at="2026-04-06T10:00:00Z",
                ),
            )

            replies = process_message(
                text="/account reconnect",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Sessione connect pronta", replies[0])
            self.assertIn("2099-04-06T10:10:00Z", replies[0])

    def test_process_message_reconnect_status_includes_last_known_failure_reason(self) -> None:
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
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=1,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="",
                    scope_set="scope",
                    status="revoked",
                ),
            )
            append_audit_log_entry(
                str(db_path),
                AuditLogEntry(
                    event_type="oauth_failure",
                    created_at="2026-04-06T11:00:00Z",
                    actor_telegram_user_id=123,
                    target_telegram_user_id=123,
                    telegram_chat_id=456,
                    environment="sandbox",
                    outcome="session_expired",
                    details_json="La sessione OAuth e' scaduta. Usa di nuovo /account collega.",
                ),
            )

            replies = process_message(
                text="/account reconnect",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Sessione OAuth scaduta", replies[0])
            self.assertIn("Usa di nuovo /account collega", replies[0])

    def test_process_message_connect_creates_oauth_session(self) -> None:
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

            replies = process_message(
                text="/account collega",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Sessione OAuth", replies[0])
            self.assertIn("callback OAuth non e' ancora configurato", replies[0])
            self.assertIn("non un errore del tuo account", replies[0])
            self.assertIn("Stato account attuale: <code>unlinked</code>", replies[0])

    @patch.dict(
        "os.environ",
        {"EBAY_OAUTH_CONNECT_BASE_URL": "https://example.com/oauth/start"},
        clear=False,
    )
    def test_process_message_connect_includes_public_connect_url(self) -> None:
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

            replies = process_message(
                text="/account collega",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("https://example.com/oauth/start?state=", replies[0])
            self.assertIn("1. apri il link", replies[0])
            self.assertIn("/account reconnect", replies[0])

    def test_process_message_connect_reconnects_from_disconnected_state(self) -> None:
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
                    environment="production",
                    linked_at="2026-04-06T10:10:00Z",
                    status="disconnected",
                ),
            )

            replies = process_message(
                text="/account collega",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Ricollega account eBay", replies[0])
            self.assertIn("Stato account attuale: <code>disconnected</code>", replies[0])
            self.assertIn("seller-ebay", replies[0])

    def test_process_message_disconnect_revokes_local_account(self) -> None:
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
                    linked_at="2026-04-06T10:00:00Z",
                    status="linked",
                ),
            )
            account = resolve_linked_ebay_account(str(db_path), 123, "sandbox")
            assert account is not None
            assert account.id is not None
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=account.id,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="access-token",
                    scope_set="scope",
                    status="active",
                ),
            )

            replies = process_message(
                text="/account scollega",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Utente eBay scollegato", replies[0])

            account_replies = process_message(
                text="/account",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )
            self.assertIn("Stato: <code>disconnected</code>", account_replies[0])
            self.assertIn("Usa <code>/account collega</code>", account_replies[0])

    @patch("src.fiscalbay.bot.load_tenant_config_from_storage")
    @patch("src.fiscalbay.bot.revoke_user_refresh_token")
    def test_process_message_disconnect_attempts_remote_revocation(
        self,
        mock_revoke_user_refresh_token,
        mock_load_tenant_config_from_storage,
    ) -> None:
        mock_load_tenant_config_from_storage.return_value = object()
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
                    environment="production",
                    linked_at="2026-04-06T10:00:00Z",
                    status="linked",
                ),
            )
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=1,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="access-token",
                    scope_set="scope",
                    status="active",
                ),
            )

            replies = process_message(
                text="/account scollega",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            mock_revoke_user_refresh_token.assert_called_once()
            self.assertIn("Revoca remota eBay: <code>completata</code>", replies[0])
            self.assertIn("accesso al bot resta approvato", replies[0])

    @patch("src.fiscalbay.bot.load_tenant_config_from_storage")
    @patch("src.fiscalbay.bot.revoke_user_refresh_token")
    def test_process_message_disconnect_reports_remote_revocation_failure(
        self,
        mock_revoke_user_refresh_token,
        mock_load_tenant_config_from_storage,
    ) -> None:
        mock_revoke_user_refresh_token.side_effect = RuntimeError("boom")
        mock_load_tenant_config_from_storage.return_value = object()
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
                    environment="production",
                    linked_at="2026-04-06T10:00:00Z",
                    status="linked",
                ),
            )
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=1,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="access-token",
                    scope_set="scope",
                    status="active",
                ),
            )

            replies = process_message(
                text="/account scollega",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("non confermata", replies[0])

    @patch("src.fiscalbay.bot.load_tenant_config_from_storage")
    @patch("src.fiscalbay.bot.revoke_user_refresh_token")
    def test_process_message_leave_bot_resets_access_and_notifications(
        self,
        mock_revoke_user_refresh_token,
        mock_load_tenant_config_from_storage,
    ) -> None:
        mock_load_tenant_config_from_storage.return_value = object()
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
                    linked_at="2026-04-06T10:00:00Z",
                    status="linked",
                ),
            )
            account = resolve_linked_ebay_account(str(db_path), 123, "production")
            assert account is not None
            assert account.id is not None
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=account.id,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="access-token",
                    scope_set="scope",
                    status="active",
                ),
            )
            set_notification_subscription_enabled(
                str(db_path),
                123,
                456,
                True,
                created_at="2026-04-06T10:00:00Z",
                updated_at="2026-04-06T10:00:00Z",
            )

            replies = process_message(
                text="/settings lascia",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            mock_revoke_user_refresh_token.assert_called_once()
            self.assertIn("Accesso operativo al bot: <code>disattivato</code>", replies[0])
            self.assertIn("/request_access", replies[0])

            users = load_telegram_users(str(db_path))
            self.assertEqual(len(users), 1)
            self.assertEqual(users[0].status, "new")

            subscriptions = load_notification_subscriptions(str(db_path))
            self.assertEqual(len(subscriptions), 1)
            self.assertFalse(subscriptions[0].enabled)

            linked_account = resolve_linked_ebay_account(str(db_path), 123, "production")
            self.assertIsNone(linked_account)

            post_leave_replies = process_message(
                text="/help",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )
            self.assertIn("/request_access", post_leave_replies[0])

    def test_process_message_leave_bot_is_not_available_for_admin(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={456},
                state_path=str(db_path),
                retry_queue_path=str(db_path),
                admin_user_id=123,
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=456,
                username="admin_user",
                display_name="Mario Rossi",
                chat_type="private",
            )
            update_telegram_user_status(
                str(db_path),
                123,
                TELEGRAM_USER_STATUS_ADMIN,
                updated_at="2026-04-06T10:00:00Z",
            )

            replies = process_message(
                text="/settings lascia",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("non e' disponibile", replies[0])
            self.assertIn("/account scollega", replies[0])

    def test_process_message_notifications_toggle_subscription_for_chat(self) -> None:
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

            off_replies = process_message(
                text="/settings notifiche off",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )
            self.assertIn("disattivate", off_replies[0])

            subscriptions = load_notification_subscriptions(str(db_path))
            self.assertEqual(len(subscriptions), 1)
            self.assertFalse(subscriptions[0].enabled)

            on_replies = process_message(
                text="/settings notifiche on",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )
            self.assertIn("attive", on_replies[0])
            subscriptions = load_notification_subscriptions(str(db_path))
            self.assertTrue(subscriptions[0].enabled)

    def test_process_message_notifications_without_args_reports_current_status(self) -> None:
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

            replies = process_message(
                text="/settings notifiche",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )
            self.assertEqual(len(replies), 1)
            self.assertIn("Notifiche chat", replies[0])
            self.assertIn("attive", replies[0])
            self.assertIn("/account collega", replies[0])

    def test_process_message_notifications_filter_updates_subscription(self) -> None:
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

            replies = process_message(
                text="/settings filtro vat",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Filtro attivo: <code>solo_piva</code>", replies[0])
            subscriptions = load_notification_subscriptions(str(db_path))
            self.assertEqual(len(subscriptions), 1)
            self.assertIn("VAT_NUMBER", subscriptions[0].filters)

    def test_process_message_notifications_toggle_preserves_existing_filter(self) -> None:
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

            process_message(
                text="/settings filtro vat",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )
            process_message(
                text="/settings notifiche off",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )
            replies = process_message(
                text="/settings notifiche on",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Filtro attivo: <code>solo_piva</code>", replies[0])
            subscriptions = load_notification_subscriptions(str(db_path))
            self.assertEqual(len(subscriptions), 1)
            self.assertTrue(subscriptions[0].enabled)
            self.assertIn("VAT_NUMBER", subscriptions[0].filters)

    def test_process_message_settings_reports_chat_preferences(self) -> None:
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
            update_telegram_user_status(
                str(db_path),
                123,
                TELEGRAM_USER_STATUS_APPROVED,
                updated_at="2026-04-06T10:00:00Z",
            )
            save_tenant_runtime_state(
                str(db_path),
                123,
                BotRuntimeState.from_mapping(
                    {
                        "memory": {
                            "last_fetch_start": "2026-04-06T09:00:00Z",
                            "last_fetch_end": "2026-04-06T09:05:00Z",
                            "last_seen_order_id": "seen-order",
                            "last_seen_order_created_at": "2026-04-06T09:04:00Z",
                            "last_notified_order_id": "sent-order",
                            "last_notified_order_created_at": "2026-04-06T09:03:00Z",
                        }
                    }
                ),
            )

            replies = process_message(
                text="/settings",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Impostazioni", replies[0])
            self.assertIn("Notifiche chat: <code>attive</code>", replies[0])
            self.assertIn("Accesso bot: <code>approvato</code>", replies[0])
            self.assertIn("Ultima finestra polling", replies[0])
            self.assertIn("seen-order", replies[0])
            self.assertIn("sent-order", replies[0])
            self.assertIn("/settings lascia", replies[0])
            self.assertIn("Prossimi passi", replies[0])

    def test_process_message_settings_reports_ready_connect_session(self) -> None:
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
            create_oauth_link_session(
                str(db_path),
                OauthLinkSession(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    environment="production",
                    oauth_state="ready-state",
                    status="pending",
                    expires_at="2099-04-06T10:10:00Z",
                    created_at="2026-04-06T10:00:00Z",
                ),
            )

            replies = process_message(
                text="/settings",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Sessione connect pronta", replies[0])
            self.assertIn("2099-04-06T10:10:00Z", replies[0])

    @patch("src.fiscalbay.bot.fetch_records")
    @patch("src.fiscalbay.bot.load_config")
    def test_process_message_review_orders_lists_records_without_fiscal_data(
        self,
        mock_load_config,
        mock_fetch_records,
    ) -> None:
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
            mock_load_config.return_value = object()
            mock_fetch_records.return_value = [
                {
                    "orderId": "order-missing",
                    "creationDate": "2026-04-05T20:00:00Z",
                    "buyerUsername": "buyer-missing",
                    "taxpayerId": "",
                    "taxIdentifierType": "",
                    "issuingCountry": "IT",
                },
                {
                    "orderId": "order-ok",
                    "creationDate": "2026-04-05T21:00:00Z",
                    "buyerUsername": "buyer-ok",
                    "taxpayerId": "IT12345678901",
                    "taxIdentifierType": "VAT_NUMBER",
                    "issuingCountry": "IT",
                },
            ]

            replies = process_message(
                text="/ordini controlla 7 20",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Ordini Da Controllare", replies[0])
            self.assertIn("order-missing", replies[0])
            self.assertNotIn("order-ok", replies[0])

    @patch("src.fiscalbay.bot.fetch_records")
    @patch("src.fiscalbay.bot.load_config")
    def test_process_message_report_summary_renders_compact_counts(
        self,
        mock_load_config,
        mock_fetch_records,
    ) -> None:
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
            mock_load_config.return_value = object()
            mock_fetch_records.return_value = [
                {
                    "orderId": "order-missing",
                    "creationDate": "2026-04-05T20:00:00Z",
                    "buyerUsername": "buyer-missing",
                    "taxpayerId": "",
                    "taxIdentifierType": "",
                    "issuingCountry": "IT",
                },
                {
                    "orderId": "order-cf",
                    "creationDate": "2026-04-05T21:00:00Z",
                    "buyerUsername": "buyer-cf",
                    "taxpayerId": "RSSMRA80A01H501U",
                    "taxIdentifierType": "CODICE_FISCALE",
                    "issuingCountry": "IT",
                },
                {
                    "orderId": "order-vat",
                    "creationDate": "2026-04-05T22:00:00Z",
                    "buyerUsername": "buyer-vat",
                    "taxpayerId": "IT12345678901",
                    "taxIdentifierType": "VAT_NUMBER",
                    "issuingCountry": "DE",
                },
            ]

            replies = process_message(
                text="/ordini report 7 20",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Mini Report Fiscale", replies[0])
            self.assertIn("Con P.IVA: <code>1</code>", replies[0])
            self.assertIn("Con CF: <code>1</code>", replies[0])
            self.assertIn("Senza dato fiscale: <code>1</code>", replies[0])
            self.assertIn("Paese emissione non IT: <code>1</code>", replies[0])

    @patch("src.fiscalbay.bot.fetch_records")
    @patch("src.fiscalbay.bot.load_config")
    def test_process_message_priority_orders_sorts_review_then_vat_then_cf(
        self,
        mock_load_config,
        mock_fetch_records,
    ) -> None:
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
            mock_load_config.return_value = object()
            mock_fetch_records.return_value = [
                {
                    "orderId": "order-cf",
                    "creationDate": "2026-04-05T21:00:00Z",
                    "buyerUsername": "buyer-cf",
                    "taxpayerId": "RSSMRA80A01H501U",
                    "taxIdentifierType": "CODICE_FISCALE",
                    "issuingCountry": "IT",
                },
                {
                    "orderId": "order-review",
                    "creationDate": "2026-04-05T20:00:00Z",
                    "buyerUsername": "buyer-review",
                    "taxpayerId": "",
                    "taxIdentifierType": "",
                    "issuingCountry": "IT",
                },
                {
                    "orderId": "order-vat",
                    "creationDate": "2026-04-05T22:00:00Z",
                    "buyerUsername": "buyer-vat",
                    "taxpayerId": "IT12345678901",
                    "taxIdentifierType": "VAT_NUMBER",
                    "issuingCountry": "IT",
                },
            ]

            replies = process_message(
                text="/ordini priorita 7 20",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Ordini Prioritari", replies[0])
            self.assertLess(replies[0].index("order-review"), replies[0].index("order-vat"))
            self.assertLess(replies[0].index("order-vat"), replies[0].index("order-cf"))

    @patch("src.fiscalbay.bot.fetch_records")
    @patch("src.fiscalbay.bot.load_config")
    @patch("src.fiscalbay.bot.send_message")
    @patch.dict(
        "os.environ",
        {
            "EBAY_CLIENT_ID": "cid",
            "EBAY_CLIENT_SECRET": "secret",
            "EBAY_ENABLE_PLAINTEXT_TENANT_TOKENS": "1",
        },
        clear=False,
    )
    def test_maybe_send_new_order_notifications_respects_vat_filter(
        self,
        mock_send_message,
        mock_load_config,
        mock_fetch_records,
    ) -> None:
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
            save_tenant_runtime_state(
                str(db_path),
                123,
                BotRuntimeState.from_mapping(
                    {
                        "last_check": "2026-04-05T19:30:00Z",
                        "metrics": {
                            "orders_read": 0,
                            "notifications_sent": 0,
                            "errors_by_type": {},
                        },
                    }
                ),
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
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=1,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="",
                    scope_set="scope",
                    status="active",
                ),
            )
            process_message(
                text="/settings filtro vat",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )
            mock_load_config.return_value = object()
            mock_fetch_records.return_value = [
                {
                    "orderId": "order-cf",
                    "creationDate": "2026-04-05T20:00:00Z",
                    "buyerUsername": "buyer-cf",
                    "taxpayerId": "RSSMRA80A01H501U",
                    "taxIdentifierType": "CODICE_FISCALE",
                    "issuingCountry": "IT",
                },
                {
                    "orderId": "order-vat",
                    "creationDate": "2026-04-05T21:00:00Z",
                    "buyerUsername": "buyer-vat",
                    "taxpayerId": "IT12345678901",
                    "taxIdentifierType": "VAT_NUMBER",
                    "issuingCountry": "IT",
                },
            ]

            maybe_send_new_order_notifications(config, "production")

            self.assertEqual(mock_send_message.call_count, 1)
            sent_text = mock_send_message.call_args.args[2]
            self.assertIn("order-vat", sent_text)
            self.assertNotIn("order-cf", sent_text)


if __name__ == "__main__":
    unittest.main()
