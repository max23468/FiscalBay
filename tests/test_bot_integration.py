import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src.ebay_cf.bot import (
    maybe_send_new_order_notifications,
    process_message,
    record_fingerprint,
)
from src.ebay_cf.models import TelegramConfig
from src.ebay_cf.storage.sqlite import load_retry_queue, load_state, save_state


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


if __name__ == "__main__":
    unittest.main()
