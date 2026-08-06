import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src.fiscalbay.bot import process_message
from src.fiscalbay.bot_common import sync_runtime_contact
from src.fiscalbay.bot_orders import maybe_send_new_order_notifications
from src.fiscalbay.models import (
    TELEGRAM_USER_STATUS_APPROVED,
    BotOperationalMemory,
    BotRuntimeState,
    EbayTokenSet,
    LinkedEbayAccount,
    OrderRecord,
    TelegramConfig,
)
from src.fiscalbay.storage.notifications import (
    set_notification_subscription_enabled,
)
from src.fiscalbay.storage.runtime import (
    load_state,
    save_state,
    save_tenant_runtime_state,
)
from src.fiscalbay.storage.users import (
    load_telegram_user,
    resolve_linked_ebay_account,
    update_telegram_user_status,
    upsert_ebay_token_set,
    upsert_linked_ebay_account,
)


def _order_records(records: list[dict[str, object]]) -> list[OrderRecord]:
    return [OrderRecord.from_mapping(record) for record in records]


class BotOrdersTests(unittest.TestCase):
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

            self.assertEqual(replies, ["Solo l'admin può usare questo comando."])

    def test_admin_security_surfaces_security_ops_report(self) -> None:
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

            with patch(
                "src.fiscalbay.bot_admin.build_security_ops_report",
                return_value={
                    "status": "ok",
                    "alerts": [],
                    "warnings": [],
                    "env_file": {"mode": "600", "expected_mode": "600"},
                    "state_db": {"mode": "660", "expected_mode": "600_or_660"},
                    "required_env": [{"name": "TELEGRAM_BOT_TOKEN", "present": True}],
                    "recommended_env": [{"name": "EBAY_OAUTH_RUNAME", "present": True}],
                    "plaintext_tenant_tokens_enabled": False,
                    "telegram_allow_all": True,
                    "admin_configured": True,
                    "public_service_model": "approved_public_small",
                    "backup": {"age_hours": 2, "max_age_hours": 36},
                    "restore_drill": {"age_hours": 24, "max_age_hours": 192},
                },
            ):
                replies = process_message(
                    text="/admin sicurezza",
                    chat_id=123,
                    telegram_config=config,
                    ebay_environment="production",
                    telegram_user_id=123,
                )

            self.assertEqual(len(replies), 1)
            self.assertIn("Security operations", replies[0])
            self.assertIn("Stato: <code>ok</code>", replies[0])
            self.assertIn("TELEGRAM_BOT_TOKEN", replies[0])
            self.assertIn("fiscalbay-security-check", replies[0])

    def test_admin_scale_surfaces_scale_readiness_report(self) -> None:
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

            with patch(
                "src.fiscalbay.bot_admin.build_scale_readiness_report",
                return_value={
                    "status": "watch",
                    "summary": "Profilo ancora valido.",
                    "signals": ["tenant_snapshot_stale"],
                    "triggers": [
                        {
                            "name": "approved_users",
                            "current": 15,
                            "limit": 25,
                            "usage_percent": 60,
                            "level": "watch",
                        }
                    ],
                    "next_actions": ["monitorare trend tenant/account/token"],
                    "migration_plan": ["freeze temporaneo", "backup completo"],
                },
            ):
                replies = process_message(
                    text="/admin scala",
                    chat_id=123,
                    telegram_config=config,
                    ebay_environment="production",
                    telegram_user_id=123,
                )

            self.assertEqual(len(replies), 1)
            self.assertIn("Scale readiness", replies[0])
            self.assertIn("Stato: <code>watch</code>", replies[0])
            self.assertIn("approved_users", replies[0])
            self.assertIn("fiscalbay-scale-check", replies[0])

    def test_admin_dormant_review_is_non_destructive(self) -> None:
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
                username="dormant_user",
                display_name="Dormant User",
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
                    status="active",
                ),
            )
            save_tenant_runtime_state(
                str(db_path),
                1000,
                BotRuntimeState(
                    last_check="2026-04-01T10:00:00Z",
                    memory=BotOperationalMemory(last_fetch_end="2026-04-01T10:00:00Z"),
                ),
            )

            replies = process_message(
                text="/admin dormant 1",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )

            self.assertIn("Review tenant dormienti", replies[0])
            self.assertIn("dormant_user", replies[0])
            self.assertIsNotNone(load_telegram_user(str(db_path), 1000))

    @patch("src.fiscalbay.bot_common.fetch_records")
    @patch("src.fiscalbay.bot_common.load_config")
    @patch("src.fiscalbay.bot_orders.send_message")
    @patch.dict(
        "os.environ",
        {
            "FISCALBAY_MISSING_TAX_ALERT_MIN_MISSING": "2",
            "FISCALBAY_MISSING_TAX_ALERT_MIN_PERCENT": "50",
            "FISCALBAY_MISSING_TAX_ALERT_COOLDOWN_SECONDS": "3600",
        },
        clear=False,
    )
    def test_subsequent_poll_alerts_on_missing_tax_identifier_spike(
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
                        "orders_with_fiscal_identifier": 0,
                        "notifications_sent": 0,
                        "errors_by_type": {},
                    },
                },
            )
            mock_load_config.return_value = object()
            mock_fetch_records.return_value = _order_records(
                [
                    {
                        "orderId": "missing-1",
                        "creationDate": "2026-04-05T20:00:00Z",
                        "buyerUsername": "buyer-missing-1",
                        "taxpayerId": "",
                        "taxIdentifierType": "",
                    },
                    {
                        "orderId": "missing-2",
                        "creationDate": "2026-04-05T20:05:00Z",
                        "buyerUsername": "buyer-missing-2",
                        "taxpayerId": "",
                        "taxIdentifierType": "",
                    },
                    {
                        "orderId": "fiscal-1",
                        "creationDate": "2026-04-05T20:10:00Z",
                        "buyerUsername": "buyer-fiscal",
                        "taxpayerId": "RSSMRA80A01H501U",
                        "taxIdentifierType": "CODICE_FISCALE",
                        "issuingCountry": "IT",
                    },
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

            sent_texts = [call.args[2] for call in mock_send_message.call_args_list]
            self.assertTrue(any("Spike ordini senza dato fiscale" in text for text in sent_texts))
            self.assertTrue(any("fiscal-1" in text for text in sent_texts))
            state = load_state(str(db_path))
            self.assertNotIn("missing-1", state["notified_order_ids"])
            self.assertIn("fiscal-1", state["notified_order_ids"])
            self.assertEqual(state["metrics"]["orders_read"], 3)
            self.assertEqual(state["metrics"]["orders_with_fiscal_identifier"], 1)
            self.assertEqual(state["metrics"]["notifications_sent"], 2)
            self.assertTrue(state["memory"]["last_missing_tax_alert_at"])

    @patch("src.fiscalbay.bot_common.fetch_records")
    @patch("src.fiscalbay.bot_common.load_config")
    @patch("src.fiscalbay.bot_orders.send_message")
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

    @patch("src.fiscalbay.bot_common.fetch_records")
    @patch("src.fiscalbay.bot_common.load_config")
    def test_process_message_orders_search_matches_buyer_fields(
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
            mock_fetch_records.return_value = _order_records(
                [
                    {
                        "orderId": "plainorder1",
                        "creationDate": "2026-04-05T20:00:00Z",
                        "buyerUsername": "mario-shop",
                        "buyerEmail": "mario@example.com",
                        "taxpayerId": "",
                        "taxIdentifierType": "",
                    },
                    {
                        "orderId": "plainorder2",
                        "creationDate": "2026-04-05T21:00:00Z",
                        "buyerUsername": "buyer-vat",
                        "buyerEmail": "vat@example.com",
                        "taxpayerId": "IT12345678901",
                        "taxIdentifierType": "VAT_NUMBER",
                    },
                    {
                        "orderId": "plainorder3",
                        "creationDate": "2026-04-05T22:00:00Z",
                        "buyerUsername": "other",
                        "buyerName": "Mario Rossi",
                        "buyerEmail": "other@example.com",
                        "taxpayerId": "RSSMRA80A01H501U",
                        "taxIdentifierType": "CODICE_FISCALE",
                    },
                ]
            )

            replies = process_message(
                text="/ordini cerca mario-shop 30 100",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Ricerca Ordini", replies[0])
            self.assertIn("plainorder1", replies[0])
            self.assertNotIn("plainorder3", replies[0])
            self.assertNotIn("plainorder2", replies[0])
            options = mock_fetch_records.call_args.args[1]
            self.assertEqual(options.days, 30)
            self.assertEqual(options.max_results, 100)
            self.assertFalse(options.only_found)

    @patch("src.fiscalbay.bot_common.fetch_records")
    @patch("src.fiscalbay.bot_common.load_config")
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
            mock_fetch_records.return_value = _order_records(
                [
                    {
                        "orderId": "order-1",
                        "creationDate": "2026-04-05T20:00:00Z",
                        "buyerUsername": "buyer",
                        "taxpayerId": "",
                        "taxIdentifierType": "",
                        "issuingCountry": "IT",
                    }
                ]
            )

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

    @patch("src.fiscalbay.bot_common.fetch_records")
    @patch("src.fiscalbay.bot_common.load_config")
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
            mock_fetch_records.return_value = _order_records(
                [
                    {
                        "orderId": "order-vat-1",
                        "creationDate": "2026-04-05T20:00:00Z",
                        "buyerUsername": "buyer",
                        "taxpayerId": "IT12345678901",
                        "taxIdentifierType": "VAT_NUMBER",
                        "issuingCountry": "IT",
                    }
                ]
            )

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

    @patch("src.fiscalbay.bot_common.fetch_records")
    @patch("src.fiscalbay.bot_common.load_config")
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
            mock_fetch_records.return_value = _order_records(
                [
                    {
                        "orderId": "order-1",
                        "creationDate": "2026-04-05T20:00:00Z",
                        "buyerUsername": "buyer",
                        "taxpayerId": "RSSMRA80A01H501U",
                        "taxIdentifierType": "CODICE_FISCALE",
                        "issuingCountry": "IT",
                    }
                ]
            )

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

    @patch("src.fiscalbay.bot_common.fetch_records")
    @patch("src.fiscalbay.bot_common.load_config")
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
            mock_fetch_records.return_value = _order_records(
                [
                    {
                        "orderId": "order-2",
                        "creationDate": "2026-04-05T20:00:00Z",
                        "buyerUsername": "buyer",
                        "taxpayerId": "RSSMRA80A01H501U",
                        "taxIdentifierType": "CODICE_FISCALE",
                        "issuingCountry": "IT",
                    }
                ]
            )

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

    @patch("src.fiscalbay.bot_common.fetch_records")
    @patch("src.fiscalbay.bot_common.load_config")
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
            mock_fetch_records.return_value = _order_records(
                [
                    {
                        "orderId": "order-3",
                        "creationDate": "2026-04-05T20:00:00Z",
                        "buyerUsername": "buyer",
                        "taxpayerId": "RSSMRA80A01H501U",
                        "taxIdentifierType": "CODICE_FISCALE",
                        "issuingCountry": "IT",
                    }
                ]
            )

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
            self.assertIn("chat corrente non è pronta", replies[0])
            self.assertIn("Comando rapido", replies[0])

    @patch("src.fiscalbay.bot_common.fetch_records")
    @patch("src.fiscalbay.bot_common.load_config")
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
            mock_fetch_records.return_value = _order_records(
                [
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
            )

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

    @patch("src.fiscalbay.bot_common.fetch_records")
    @patch("src.fiscalbay.bot_common.load_config")
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
            mock_fetch_records.return_value = _order_records(
                [
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
            )

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

    @patch("src.fiscalbay.bot_common.fetch_records")
    @patch("src.fiscalbay.bot_common.load_config")
    def test_process_message_orders_export_renders_seller_fiscal_csv(
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
            mock_fetch_records.return_value = _order_records(
                [
                    {
                        "orderId": "order-missing",
                        "creationDate": "2026-04-05T20:00:00Z",
                        "buyerUsername": "buyer-missing",
                        "taxpayerId": "",
                        "taxIdentifierType": "",
                    },
                    {
                        "orderId": "order-ok",
                        "creationDate": "2026-04-05T21:00:00Z",
                        "buyerUsername": "buyer-ok",
                        "taxpayerId": "IT12345678901",
                        "taxIdentifierType": "VAT_NUMBER",
                    },
                ]
            )

            replies = process_message(
                text="/ordini export 7 20",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 2)
            self.assertIn("Export Fiscale Venditore", replies[0])
            self.assertIn("Ordini esportati: <code>2</code>", replies[0])
            self.assertIn("Con dato fiscale: <code>1</code>", replies[0])
            self.assertIn("CSV export", replies[1])
            self.assertIn("periodStart,periodEnd,orderId", replies[1])
            self.assertIn("order-ok", replies[1])
            self.assertIn("available", replies[1])
            self.assertIn("order-missing", replies[1])
            self.assertIn("missing", replies[1])

    @patch("src.fiscalbay.bot_common.fetch_records")
    @patch("src.fiscalbay.bot_common.load_config")
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
            mock_fetch_records.return_value = _order_records(
                [
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
            )

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


if __name__ == "__main__":
    unittest.main()
