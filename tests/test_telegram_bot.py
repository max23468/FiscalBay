import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfoNotFoundError

from src.fiscalbay.bot import (
    CALLBACK_HELP,
    CALLBACK_OTHER_ACTIONS,
    CALLBACK_REQUEST_ACCESS,
    CALLBACK_SETTINGS,
    CALLBACK_STATO,
    CALLBACK_TUTTI,
    CALLBACK_ULTIMI,
    TELEGRAM_CMD_MAX_DAYS,
    TelegramApiError,
    TelegramConfig,
    acquire_process_lock,
    build_contextual_menu_markup,
    build_help_text,
    build_main_menu_markup,
    build_other_actions_text,
    callback_command_from_data,
    chunk_message,
    ensure_long_polling,
    extract_callback_context,
    format_auto_notification,
    format_records,
    has_fiscal_identifier,
    options_for_command,
    parse_command,
    process_message,
    release_process_lock,
    send_message,
    sync_runtime_branding,
    update_state_with_records,
)
from src.fiscalbay.clients.telegram import sync_bot_branding
from src.fiscalbay.storage.sqlite import load_kv_value
from src.fiscalbay.telegram_commands import (
    BOT_DISPLAY_NAME,
    BOT_TAGLINE,
    CALLBACK_ADMIN_MAINTENANCE,
    CALLBACK_ADMIN_USERS_PENDING,
    CALLBACK_ORDINI,
    CALLBACK_ORDINI_PRIORITY,
    CALLBACK_ORDINI_REPORT,
    CALLBACK_ORDINI_REVIEW,
    build_telegram_branding_profile,
    format_order_date,
    is_admin_authorized,
)


class TelegramBotTests(unittest.TestCase):
    def test_build_main_menu_markup_contains_inline_keyboard(self) -> None:
        markup = build_main_menu_markup()
        keyboard = markup.get("inline_keyboard")
        self.assertIsInstance(keyboard, list)
        self.assertEqual(
            keyboard,
            [
                [
                    {"text": "Collega eBay", "callback_data": "menu:connect"},
                    {"text": "Account", "callback_data": "menu:account"},
                ],
                [
                    {"text": "Ordini fiscali", "callback_data": CALLBACK_ULTIMI},
                    {"text": "Tutti ordini", "callback_data": CALLBACK_TUTTI},
                ],
                [
                    {"text": "Stato", "callback_data": CALLBACK_STATO},
                    {"text": "Altre azioni", "callback_data": CALLBACK_OTHER_ACTIONS},
                ],
            ],
        )
        all_callbacks = [button.get("callback_data") for row in keyboard for button in row]
        self.assertIn(CALLBACK_ULTIMI, all_callbacks)
        self.assertIn(CALLBACK_TUTTI, all_callbacks)
        self.assertIn(CALLBACK_STATO, all_callbacks)
        self.assertIn(CALLBACK_OTHER_ACTIONS, all_callbacks)

    def test_build_main_menu_markup_can_reflect_unlinked_state(self) -> None:
        markup = build_main_menu_markup(
            account_linked=False,
            reconnect_required=False,
            notifications_enabled=False,
        )
        all_callbacks = [
            button.get("callback_data")
            for row in markup.get("inline_keyboard", [])
            for button in row
        ]
        self.assertIn(CALLBACK_OTHER_ACTIONS, all_callbacks)
        self.assertNotIn("menu:disconnect", all_callbacks)

    def test_build_contextual_menu_markup_for_orders_focuses_order_actions(self) -> None:
        markup = build_contextual_menu_markup("/ordini fiscali 7 20")
        keyboard = markup.get("inline_keyboard")
        self.assertEqual(
            keyboard,
            [
                [
                    {"text": "Ordini fiscali", "callback_data": CALLBACK_ULTIMI},
                    {"text": "Tutti ordini", "callback_data": CALLBACK_TUTTI},
                ],
                [
                    {"text": "Da controllare", "callback_data": CALLBACK_ORDINI_REVIEW},
                    {"text": "Report", "callback_data": CALLBACK_ORDINI_REPORT},
                ],
                [
                    {"text": "Priorita'", "callback_data": CALLBACK_ORDINI_PRIORITY},
                    {"text": "Account", "callback_data": "menu:account"},
                ],
                [{"text": "Guida", "callback_data": CALLBACK_HELP}],
            ],
        )

    def test_build_contextual_menu_markup_for_account_reflects_state(self) -> None:
        markup = build_contextual_menu_markup(
            "/account",
            account_linked=True,
            reconnect_required=True,
            notifications_enabled=False,
        )
        keyboard = markup.get("inline_keyboard")
        self.assertEqual(
            keyboard[0][0], {"text": "Ricollega eBay", "callback_data": "menu:connect"}
        )
        self.assertEqual(keyboard[0][1], {"text": "Scollega", "callback_data": "menu:disconnect"})
        self.assertIn(
            {"text": "Attiva notifiche", "callback_data": "menu:notifications_on"}, keyboard[2]
        )

    def test_build_contextual_menu_markup_for_admin_uses_admin_actions(self) -> None:
        markup = build_contextual_menu_markup("/admin", is_admin=True)
        all_callbacks = [
            button.get("callback_data")
            for row in markup.get("inline_keyboard", [])
            for button in row
        ]
        self.assertIn(CALLBACK_ADMIN_USERS_PENDING, all_callbacks)
        self.assertIn(CALLBACK_ADMIN_MAINTENANCE, all_callbacks)
        self.assertNotIn("menu:connect", all_callbacks)

    def test_callback_command_from_data_maps_buttons(self) -> None:
        self.assertEqual(callback_command_from_data(CALLBACK_ORDINI), "/ordini")
        self.assertEqual(callback_command_from_data(CALLBACK_ULTIMI), "/ordini fiscali 7 20")
        self.assertEqual(callback_command_from_data(CALLBACK_TUTTI), "/ordini tutti 7 20")
        self.assertEqual(
            callback_command_from_data(CALLBACK_ORDINI_REVIEW),
            "/ordini controlla 7 20",
        )
        self.assertEqual(
            callback_command_from_data(CALLBACK_ORDINI_REPORT),
            "/ordini report 7 20",
        )
        self.assertEqual(
            callback_command_from_data(CALLBACK_ORDINI_PRIORITY),
            "/ordini priorita 7 20",
        )
        self.assertEqual(callback_command_from_data(CALLBACK_STATO), "/stato")
        self.assertEqual(callback_command_from_data(CALLBACK_SETTINGS), "/settings")
        self.assertEqual(
            callback_command_from_data("menu:notifications_on"),
            "/settings notifiche on",
        )
        self.assertEqual(
            callback_command_from_data("menu:notifications_off"),
            "/settings notifiche off",
        )
        self.assertEqual(
            callback_command_from_data(CALLBACK_ADMIN_USERS_PENDING), "/admin_users pending"
        )
        self.assertEqual(
            callback_command_from_data(CALLBACK_ADMIN_MAINTENANCE), "/admin manutenzione"
        )
        self.assertEqual(callback_command_from_data(CALLBACK_OTHER_ACTIONS), "/altre_azioni")
        self.assertEqual(callback_command_from_data(CALLBACK_REQUEST_ACCESS), "/request_access")
        self.assertEqual(callback_command_from_data("access:approve:321"), "/approve_user 321")
        self.assertEqual(callback_command_from_data("access:reject:321"), "/reject_user 321")
        self.assertEqual(callback_command_from_data(CALLBACK_HELP), "/help")
        self.assertIsNone(callback_command_from_data("menu:unknown"))

    def test_extract_callback_context_reads_callback_query(self) -> None:
        update = {
            "callback_query": {
                "id": "cb-1",
                "data": CALLBACK_STATO,
                "message": {
                    "chat": {"id": 123},
                    "message_thread_id": 9,
                },
            }
        }
        callback_id, chat_id, data, thread_id = extract_callback_context(update)
        self.assertEqual(callback_id, "cb-1")
        self.assertEqual(chat_id, 123)
        self.assertEqual(data, CALLBACK_STATO)
        self.assertEqual(thread_id, 9)

    def test_is_admin_authorized_requires_configured_admin(self) -> None:
        self.assertFalse(
            is_admin_authorized(
                123,
                123,
                TelegramConfig(token="x", allowed_chat_ids={123}, notify_chat_ids=set()),
            )
        )
        self.assertTrue(
            is_admin_authorized(
                123,
                123,
                TelegramConfig(
                    token="x",
                    allowed_chat_ids={123},
                    notify_chat_ids=set(),
                    admin_user_id=123,
                ),
            )
        )

    def test_parse_command_strips_bot_suffix(self) -> None:
        command, args = parse_command("/ultimi@mybot 7 5")
        self.assertEqual(command, "/ultimi")
        self.assertEqual(args, ["7", "5"])

    def test_options_for_command_ordine(self) -> None:
        options = options_for_command("/ordine", ["12-34567-89012"])
        self.assertEqual(options.order_ids, ["12-34567-89012"])
        self.assertFalse(options.only_found)
        self.assertTrue(options.include_details)

    def test_options_for_command_tutti_uses_summary_mode(self) -> None:
        options = options_for_command("/tutti", ["7", "20"])
        self.assertFalse(options.only_found)
        self.assertFalse(options.include_details)

    def test_options_for_command_rejects_days_out_of_range(self) -> None:
        with self.assertRaises(TelegramApiError):
            options_for_command("/ultimi", [str(TELEGRAM_CMD_MAX_DAYS + 1), "10"])

    def test_options_for_command_rejects_max_results_out_of_range(self) -> None:
        with self.assertRaises(TelegramApiError):
            options_for_command("/tutti", ["7", "9999"])

    def test_options_for_command_rejects_non_integer_days(self) -> None:
        with self.assertRaises(TelegramApiError):
            options_for_command("/ultimi", ["foo"])

    def test_chunk_message_splits_long_payload(self) -> None:
        chunks = chunk_message(("a" * 2000) + "\n" + ("b" * 2000))
        self.assertEqual(len(chunks), 2)

    def test_format_records_empty_only_found(self) -> None:
        content = format_records([], only_found=True)[0]
        self.assertIn("Nessun ordine con identificativo fiscale", content)

    def test_build_help_text_mentions_commands(self) -> None:
        text = build_help_text()
        self.assertIn("pulsanti rapidi", text)
        self.assertIn("Comandi principali", text)
        self.assertIn("Guide dettagliate", text)
        self.assertIn("/altre_azioni", text)
        self.assertIn("/ordini fiscali", text)
        self.assertIn("/settings", text)
        self.assertIn("/settings notifiche on", text)
        self.assertIn("/request_access", text)
        self.assertNotIn("/ping", text)
        self.assertNotIn("/ordini report", text)
        self.assertNotIn("/admin_users", text)
        self.assertIn(BOT_DISPLAY_NAME, text)

    def test_build_other_actions_text_collects_secondary_commands(self) -> None:
        text = build_other_actions_text()
        self.assertIn("Altre azioni", text)
        self.assertIn("/help", text)
        self.assertIn("/request_access", text)
        self.assertIn("/settings notifiche on", text)
        self.assertNotIn("/admin_users", text)

        admin_text = build_other_actions_text(is_admin=True)
        self.assertIn("/admin_users", admin_text)

    def test_build_help_text_can_include_admin_shortcuts(self) -> None:
        text = build_help_text(is_admin=True)
        self.assertIn("Area admin", text)
        self.assertIn("/admin_users", text)
        self.assertIn("/admin help", text)
        self.assertIn("/ping", text)
        self.assertNotIn("/approve_user", text)

    def test_build_telegram_branding_profile_contains_expected_fields(self) -> None:
        profile = build_telegram_branding_profile()
        self.assertEqual(profile["name"], BOT_DISPLAY_NAME)
        self.assertEqual(profile["short_description"], BOT_TAGLINE)
        commands = profile["commands"]
        self.assertIsInstance(commands, list)
        self.assertEqual(len(commands), 4)
        self.assertEqual(commands[0]["command"], "stato")
        self.assertEqual(commands[-1]["command"], "altre_azioni")
        self.assertNotIn("help", {command["command"] for command in commands})
        self.assertNotIn("settings", {command["command"] for command in commands})
        self.assertNotIn("request_access", {command["command"] for command in commands})
        self.assertNotIn("ping", {command["command"] for command in commands})

    @patch("src.fiscalbay.bot.fetch_records")
    @patch("src.fiscalbay.bot.load_config")
    def test_process_message_for_other_actions(self, mock_load_config, mock_fetch_records) -> None:
        replies = process_message(
            text="/altre_azioni",
            chat_id=1,
            telegram_config=TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids=set(),
            ),
            ebay_environment="production",
        )
        self.assertEqual(len(replies), 1)
        self.assertIn("/settings", replies[0])
        self.assertIn("/request_access", replies[0])
        mock_load_config.assert_not_called()
        mock_fetch_records.assert_not_called()

    @patch("src.fiscalbay.bot.fetch_records")
    @patch("src.fiscalbay.bot.load_config")
    def test_process_message_for_help(self, mock_load_config, mock_fetch_records) -> None:
        replies = process_message(
            text="/help",
            chat_id=1,
            telegram_config=TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids=set(),
            ),
            ebay_environment="production",
        )
        self.assertEqual(len(replies), 1)
        self.assertIn("Benvenuto in FiscalBay", replies[0])
        mock_load_config.assert_not_called()
        mock_fetch_records.assert_not_called()

    def test_process_message_ping(self) -> None:
        replies = process_message(
            text="/ping",
            chat_id=1,
            telegram_config=TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids=set(),
            ),
            ebay_environment="production",
        )
        self.assertEqual(replies, ["pong ✅"])

    def test_update_state_with_records_tracks_ids(self) -> None:
        state = {"notified_order_ids": ["1"], "last_check": None}
        updated = update_state_with_records(
            state,
            [{"orderId": "2"}, {"orderId": "1"}],
            checked_at="2026-04-03T20:00:00Z",
        )
        self.assertEqual(updated["notified_order_ids"], ["1", "2"])
        self.assertEqual(updated["last_check"], "2026-04-03T20:00:00Z")

    def test_format_auto_notification_mentions_new_order(self) -> None:
        text = format_auto_notification(
            {
                "orderId": "12-345",
                "creationDate": "2026-04-03T10:00:00Z",
                "buyerUsername": "buyer",
                "buyerName": "Mario Rossi",
                "buyerEmail": "mario@example.com",
                "taxpayerId": "RSSMRA80A01H501U",
                "taxIdentifierType": "CODICE_FISCALE",
                "issuingCountry": "IT",
                "orderQuantity": "2",
                "productDescription": "Prodotto A",
                "total": "42.50 EUR",
                "transactionStatus": "PAID",
                "shippingAddress": "Mario Rossi, Via Roma 1, Milano",
            }
        )
        self.assertIn("NUOVO ORDINE EBAY RICEVUTO", text)
        self.assertIn("RSSMRA80A01H501U", text)
        self.assertIn("Data</b>: <code>03/04/2026 12:00</code>", text)
        self.assertIn("Nome completo", text)
        self.assertIn("Mario Rossi", text)
        self.assertEqual(text.count("Mario Rossi"), 1)
        self.assertIn("mario@example.com", text)
        self.assertIn("Descrizione prodotto", text)
        self.assertIn("Prodotto A", text)
        self.assertIn("Quantità ordine", text)
        self.assertIn("Stato transazione", text)
        self.assertIn("Pagato", text)
        self.assertNotIn("PAID", text)

    def test_format_order_date_falls_back_when_rome_timezone_is_unavailable(self) -> None:
        with patch(
            "src.fiscalbay.telegram_commands.ZoneInfo",
            side_effect=ZoneInfoNotFoundError("No time zone found with key Europe/Rome"),
        ):
            self.assertEqual(format_order_date("2026-04-03T10:00:00Z"), "03/04/2026 10:00")

    def test_format_order_fallback_when_missing_fiscal_fields(self) -> None:
        text = format_auto_notification(
            {
                "orderId": "12-345",
                "creationDate": "2026-04-03T10:00:00Z",
                "buyerUsername": "buyer",
                "taxpayerId": "",
                "taxIdentifierType": "",
                "issuingCountry": "",
            }
        )
        self.assertIn("Dati fiscali non presenti", text)

    def test_has_fiscal_identifier_requires_type_and_value(self) -> None:
        self.assertTrue(
            has_fiscal_identifier(
                {
                    "taxIdentifierType": "CODICE_FISCALE",
                    "taxpayerId": "RSSMRA80A01H501U",
                }
            )
        )
        self.assertTrue(
            has_fiscal_identifier(
                {
                    "taxIdentifierType": "VAT_NUMBER",
                    "taxpayerId": "IT123",
                }
            )
        )
        self.assertFalse(
            has_fiscal_identifier(
                {
                    "taxIdentifierType": "CODICE_FISCALE",
                    "taxpayerId": "",
                }
            )
        )

    def test_format_auto_notification_uses_vat_label_when_available(self) -> None:
        text = format_auto_notification(
            {
                "orderId": "12-346",
                "creationDate": "2026-04-03T10:00:00Z",
                "buyerUsername": "buyer-vat",
                "taxpayerId": "IT12345678901",
                "taxIdentifierType": "VAT_NUMBER",
                "issuingCountry": "IT",
            }
        )
        self.assertIn("P.IVA", text)
        self.assertIn("VAT_NUMBER", text)

    @patch("src.fiscalbay.bot.telegram_request")
    def test_send_message_retries_without_parse_mode_on_http_400(
        self, mock_telegram_request
    ) -> None:
        mock_telegram_request.side_effect = [
            TelegramApiError("Errore Telegram su sendMessage: HTTP 400: Bad Request"),
            {"message_id": 1},
        ]
        send_message("token", 123, "ciao")
        self.assertEqual(mock_telegram_request.call_count, 2)
        first_call = mock_telegram_request.call_args_list[0].args[2]
        second_call = mock_telegram_request.call_args_list[1].args[2]
        self.assertEqual(first_call.get("parse_mode"), "HTML")
        self.assertNotIn("parse_mode", second_call)

    @patch("src.fiscalbay.bot.telegram_request")
    def test_send_message_includes_reply_markup(self, mock_telegram_request) -> None:
        mock_telegram_request.return_value = {"message_id": 1}
        reply_markup = build_main_menu_markup()
        send_message("token", 123, "ciao", reply_markup=reply_markup)
        params = mock_telegram_request.call_args.args[2]
        self.assertEqual(params.get("reply_markup"), reply_markup)

    @patch("src.fiscalbay.clients.telegram.telegram_request")
    def test_ensure_long_polling_deletes_existing_webhook(self, mock_telegram_request) -> None:
        ensure_long_polling("token")
        mock_telegram_request.assert_called_once_with(
            "token",
            "deleteWebhook",
            {"drop_pending_updates": False},
        )

    @patch("src.fiscalbay.clients.telegram.telegram_request")
    def test_sync_bot_branding_updates_profile_and_commands(self, mock_telegram_request) -> None:
        profile = build_telegram_branding_profile()
        sync_bot_branding(
            "token",
            name=profile["name"],
            short_description=profile["short_description"],
            description=profile["description"],
            commands=profile["commands"],
        )
        methods = [call.args[1] for call in mock_telegram_request.call_args_list]
        self.assertEqual(
            methods,
            [
                "setMyName",
                "setMyShortDescription",
                "setMyDescription",
                "setMyCommands",
                "setChatMenuButton",
            ],
        )

    @patch("src.fiscalbay.bot.sync_bot_branding")
    def test_sync_runtime_branding_skips_when_profile_is_unchanged(
        self,
        mock_sync_bot_branding,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="token",
                allowed_chat_ids=set(),
                notify_chat_ids=set(),
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_branding(config)
            sync_runtime_branding(config)

            self.assertEqual(mock_sync_bot_branding.call_count, 1)
            self.assertIsNotNone(
                load_kv_value(str(db_path), "branding_sync:profile_hash"),
            )

    @patch("src.fiscalbay.bot.sync_bot_branding")
    def test_sync_runtime_branding_backs_off_after_rate_limit(
        self,
        mock_sync_bot_branding,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="token",
                allowed_chat_ids=set(),
                notify_chat_ids=set(),
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )
            mock_sync_bot_branding.side_effect = TelegramApiError(
                "Errore Telegram su setMyName: HTTP 429: Too Many Requests: retry_after_120",
                status_code=429,
            )

            sync_runtime_branding(config)
            sync_runtime_branding(config)

            self.assertEqual(mock_sync_bot_branding.call_count, 1)
            self.assertEqual(load_kv_value(str(db_path), "branding_sync:profile_hash"), None)
            self.assertIsNotNone(load_kv_value(str(db_path), "branding_sync:retry_at"))

    def test_process_lock_writes_metadata_and_removes_file_on_release(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            lock_path = Path(tmpdir) / "telegram_bot.lock"

            handle = acquire_process_lock(str(lock_path))
            self.assertTrue(lock_path.exists())
            content = lock_path.read_text(encoding="utf-8")
            self.assertIn("pid=", content)
            self.assertIn("started_at=", content)

            release_process_lock(handle, str(lock_path))
            self.assertFalse(lock_path.exists())

    def test_acquire_process_lock_reports_holder_details_when_already_locked(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            lock_path = Path(tmpdir) / "telegram_bot.lock"

            handle = acquire_process_lock(str(lock_path))
            try:
                with self.assertRaises(TelegramApiError) as ctx:
                    acquire_process_lock(str(lock_path))
            finally:
                release_process_lock(handle, str(lock_path))

            self.assertIn("pid=", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
