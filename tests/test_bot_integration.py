import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src.fiscalbay.bot import process_message
from src.fiscalbay.bot_common import sync_runtime_contact
from src.fiscalbay.bot_orders import maybe_send_new_order_notifications
from src.fiscalbay.models import (
    EbayTokenSet,
    LinkedEbayAccount,
    OrderRecord,
    TelegramConfig,
)
from src.fiscalbay.storage.queues import (
    load_audit_log_entries,
)
from src.fiscalbay.storage.runtime import (
    load_retry_queue,
    load_state,
    save_state,
)
from src.fiscalbay.storage.users import (
    load_telegram_users,
    upsert_ebay_token_set,
    upsert_linked_ebay_account,
)
from src.fiscalbay.telegram_common import record_fingerprint


def _order_records(records: list[dict[str, object]]) -> list[OrderRecord]:
    return [OrderRecord.from_mapping(record) for record in records]


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

    @patch("src.fiscalbay.bot_common.send_message")
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
            self.assertIn("Comandi principali", approved_help[0])
            self.assertNotIn("Area admin", approved_help[0])

    @patch("src.fiscalbay.bot_common.fetch_records")
    @patch("src.fiscalbay.bot_common.load_config")
    @patch("src.fiscalbay.bot_orders.send_message")
    def test_subsequent_poll_sends_only_new_records(
        self,
        mock_send_message,
        mock_load_config,
        mock_fetch_records,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            old_record = OrderRecord(
                orderId="old-order",
                creationDate="2026-04-05T19:00:00Z",
                buyerUsername="buyer-old",
                taxpayerId="RSSOLD80A01H501U",
                taxIdentifierType="CODICE_FISCALE",
                issuingCountry="IT",
            )
            new_record = OrderRecord(
                orderId="new-order",
                creationDate="2026-04-05T20:00:00Z",
                buyerUsername="buyer-new",
                taxpayerId="RSSNEW80A01H501U",
                taxIdentifierType="CODICE_FISCALE",
                issuingCountry="IT",
            )

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

    @patch.dict(
        "os.environ",
        {
            "EBAY_CLIENT_ID": "cid",
            "EBAY_CLIENT_SECRET": "secret",
            "EBAY_ENABLE_PLAINTEXT_TENANT_TOKENS": "1",
            "FISCALBAY_RATE_LIMIT_ENABLED": "off",
        },
        clear=False,
    )
    @patch("src.fiscalbay.bot_common.fetch_records")
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
            mock_fetch_records.return_value = _order_records(
                [
                    {
                        "orderId": "12-34567-89012",
                        "creationDate": "2026-04-06T10:30:00Z",
                        "buyerUsername": "buyer",
                    }
                ]
            )

            replies = process_message(
                text="/ordini cerca 12-34567-89012",
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

            repeated = process_message(
                text="/ordini cerca 12-34567-89012",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )
            self.assertIn("cooldown", repeated[0])
            mock_fetch_records.assert_called_once()

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
            self.assertIn("callback OAuth non è ancora configurato", replies[0])
            self.assertIn("non un errore del tuo account", replies[0])
            self.assertIn("Stato account attuale: <code>unlinked</code>", replies[0])


if __name__ == "__main__":
    unittest.main()
