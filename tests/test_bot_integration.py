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
from src.ebay_cf.models import BotRuntimeState, Config, LinkedEbayAccount, TelegramConfig
from src.ebay_cf.storage.sqlite import (
    load_notification_subscriptions,
    load_retry_queue,
    load_state,
    load_telegram_chats,
    load_telegram_users,
    save_state,
    save_tenant_runtime_state,
    upsert_linked_ebay_account,
)


class BotIntegrationTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
