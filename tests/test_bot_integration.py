import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src.ebay_cf.bot import (
    maybe_send_new_order_notifications,
    process_message,
    record_fingerprint,
    sync_runtime_contact,
)
from src.ebay_cf.models import (
    BotRuntimeState,
    Config,
    EbayTokenSet,
    LinkedEbayAccount,
    TelegramConfig,
)
from src.ebay_cf.storage.sqlite import (
    load_notification_subscriptions,
    load_retry_queue,
    load_state,
    load_telegram_chats,
    load_telegram_users,
    resolve_linked_ebay_account,
    save_state,
    save_tenant_runtime_state,
    upsert_ebay_token_set,
    upsert_linked_ebay_account,
)


class BotIntegrationTests(unittest.TestCase):
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

    @patch("src.ebay_cf.bot.send_message")
    def test_request_access_notifies_admin_and_marks_user_pending(self, mock_send_message) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids=None,
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
            self.assertEqual(len(replies), 1)
            self.assertIn("Richiesta inviata", replies[0])
            mock_send_message.assert_called_once()
            self.assertEqual(mock_send_message.call_args.args[1], 123)

    @patch("src.ebay_cf.bot.send_message")
    def test_admin_can_approve_user_and_user_becomes_operational(self, mock_send_message) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids=None,
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
            self.assertIn("Benvenuto in eBay CF Bot", approved_help[0])

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
                    allowed_chat_ids=None,
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

    @patch("src.ebay_cf.bot.fetch_records")
    @patch("src.ebay_cf.bot.load_config")
    @patch("src.ebay_cf.bot.send_message")
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
                allowed_chat_ids=None,
                notify_chat_ids={123},
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            maybe_send_new_order_notifications(config, "production")

            state = load_state(str(db_path))
            self.assertIn("new-order", state["notified_order_ids"])
            self.assertTrue(state["last_check"])
            mock_send_message.assert_not_called()

    @patch("src.ebay_cf.bot.fetch_records")
    @patch("src.ebay_cf.bot.load_config")
    @patch("src.ebay_cf.bot.send_message")
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
                allowed_chat_ids=None,
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

    def test_sync_runtime_contact_persists_user_chat_and_subscription(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids=None,
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
                allowed_chat_ids=None,
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
                            "orders_with_cf": 4,
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
                        "orders_with_cf": 0,
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

    @patch("src.ebay_cf.bot.fetch_records")
    @patch("src.ebay_cf.bot.load_config")
    def test_process_message_fetch_uses_linked_account_environment_for_tenant(
        self,
        mock_load_config,
        mock_fetch_records,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids=None,
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
            mock_load_config.return_value = Config(
                client_id="cid",
                client_secret="secret",
                refresh_token="refresh",
                environment="sandbox",
                scopes="scope",
            )
            mock_fetch_records.return_value = [
                {
                    "orderId": "order-1",
                    "creationDate": "2026-04-06T10:30:00Z",
                    "buyerUsername": "buyer",
                }
            ]

            replies = process_message(
                text="/ordine order-1",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertTrue(replies)
            mock_load_config.assert_called_once_with("sandbox")

    def test_process_message_account_reports_linked_account_status(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids=None,
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

    def test_process_message_connect_creates_oauth_session(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids=None,
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
                text="/connect",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Sessione OAuth", replies[0])
            self.assertIn("callback OAuth non e' ancora configurato", replies[0])

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
                allowed_chat_ids=None,
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
                text="/connect",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("https://example.com/oauth/start?state=", replies[0])

    def test_process_message_disconnect_revokes_local_account(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids=None,
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
                text="/disconnect",
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
            self.assertIn("non collegato", account_replies[0])

    def test_process_message_notifications_toggle_subscription_for_chat(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids=None,
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
                text="/notifications off",
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
                text="/notifications on",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )
            self.assertIn("attive", on_replies[0])
            subscriptions = load_notification_subscriptions(str(db_path))
            self.assertTrue(subscriptions[0].enabled)

    def test_process_message_settings_reports_chat_preferences(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids=None,
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
                text="/settings",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Impostazioni", replies[0])
            self.assertIn("Notifiche chat: <code>attive</code>", replies[0])


if __name__ == "__main__":
    unittest.main()
