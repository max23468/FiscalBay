import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src.fiscalbay.bot import process_message
from src.fiscalbay.bot_common import sync_runtime_contact
from src.fiscalbay.bot_orders import maybe_send_new_order_notifications
from src.fiscalbay.errors import TelegramApiError
from src.fiscalbay.models import (
    TELEGRAM_USER_STATUS_ADMIN,
    TELEGRAM_USER_STATUS_APPROVED,
    BotRuntimeState,
    Config,
    EbayTokenSet,
    LinkedEbayAccount,
    OauthLinkSession,
    OrderRecord,
    TelegramConfig,
)
from src.fiscalbay.storage.notifications import (
    load_notification_subscriptions,
    set_notification_subscription_enabled,
)
from src.fiscalbay.storage.oauth import create_oauth_link_session
from src.fiscalbay.storage.queues import (
    load_audit_log_entries,
)
from src.fiscalbay.storage.runtime import (
    save_tenant_runtime_state,
)
from src.fiscalbay.storage.users import (
    load_telegram_users,
    resolve_linked_ebay_account,
    update_telegram_user_status,
    upsert_ebay_token_set,
    upsert_linked_ebay_account,
)


def _order_records(records: list[dict[str, object]]) -> list[OrderRecord]:
    return [OrderRecord.from_mapping(record) for record in records]


class BotSettingsTests(unittest.TestCase):
    @patch("src.fiscalbay.bot_common.send_message", side_effect=TelegramApiError("send ko"))
    def test_failed_data_request_notification_does_not_start_cooldown(
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

            for _ in range(2):
                with self.assertRaises(TelegramApiError):
                    process_message(
                        text="/settings dati cancellazione",
                        chat_id=456,
                        telegram_config=config,
                        ebay_environment="production",
                        telegram_user_id=1000,
                    )

            self.assertEqual(mock_send_message.call_count, 2)
            self.assertEqual(load_audit_log_entries(str(db_path), 5), [])

    def test_settings_data_explains_retention_and_assisted_actions(self) -> None:
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

            replies = process_message(
                text="/settings dati",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=1000,
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Dati e privacy", replies[0])
            self.assertIn("Retention audit", replies[0])
            self.assertIn("/settings dati export", replies[0])
            self.assertIn("/settings dati cancellazione", replies[0])

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
        self.assertIn("Telegram first", policy_replies[0])
        self.assertIn("Utenti approvati", policy_replies[0])
        self.assertIn("Rate limiting per utente", policy_replies[0])

    @patch("src.fiscalbay.bot_common.fetch_records")
    @patch("src.fiscalbay.bot_common.load_config")
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
            mock_fetch_records.return_value = _order_records(
                [
                    {
                        "orderId": "12-34567-89012",
                        "creationDate": "2026-04-05T20:00:00Z",
                        "buyerUsername": "buyer",
                        "taxpayerId": "RSSMRA80A01H501U",
                        "taxIdentifierType": "CODICE_FISCALE",
                        "issuingCountry": "IT",
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

            self.assertEqual(len(replies), 1)
            self.assertIn("Notificabilità", replies[0])
            self.assertIn("would_notify", replies[0])
            self.assertIn("delivery_ready", replies[0])

    @patch("src.fiscalbay.bot_account.load_tenant_config_from_storage")
    def test_process_message_leave_bot_resets_access_and_notifications(
        self,
        mock_load_tenant_config_from_storage,
    ) -> None:
        mock_load_tenant_config_from_storage.return_value = Config(
            client_id="cid",
            client_secret="secret",
            refresh_token="refresh-token",
            environment="production",
            scopes="scope",
        )
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
            mock_load_tenant_config_from_storage.assert_called_once()
            self.assertIn("Revoca consenso eBay: <code>manuale</code>", replies[0])
            self.assertIn("Third-party app access", replies[0])
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
            self.assertIn("non è disponibile", replies[0])
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

    @patch("src.fiscalbay.bot_common.fetch_records")
    @patch("src.fiscalbay.bot_common.load_config")
    @patch("src.fiscalbay.bot_orders.send_message")
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
            mock_fetch_records.return_value = _order_records(
                [
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
            )

            maybe_send_new_order_notifications(config, "production")

            self.assertEqual(mock_send_message.call_count, 1)
            sent_text = mock_send_message.call_args.args[2]
            self.assertIn("order-vat", sent_text)
            self.assertNotIn("order-cf", sent_text)


if __name__ == "__main__":
    unittest.main()
