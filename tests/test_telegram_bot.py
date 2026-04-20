import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src.fiscalbay.bot import (
    CALLBACK_HELP,
    CALLBACK_REQUEST_ACCESS,
    CALLBACK_SETTINGS,
    CALLBACK_STATO,
    CALLBACK_TUTTI,
    CALLBACK_ULTIMI,
    TELEGRAM_CMD_MAX_DAYS,
    TelegramApiError,
    TelegramConfig,
    acquire_process_lock,
    build_help_text,
    build_main_menu_markup,
    callback_command_from_data,
    chunk_message,
    ensure_long_polling,
    extract_callback_context,
    format_auto_notification,
    format_records,
    has_codice_fiscale,
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
    build_telegram_branding_profile,
)


class TelegramBotTests(unittest.TestCase):
    def test_build_main_menu_markup_contains_inline_keyboard(self) -> None:
        markup = build_main_menu_markup()
        keyboard = markup.get("inline_keyboard")
        self.assertIsInstance(keyboard, list)
        all_callbacks = [button.get("callback_data") for row in keyboard for button in row]
        self.assertIn(CALLBACK_ULTIMI, all_callbacks)
        self.assertIn(CALLBACK_TUTTI, all_callbacks)
        self.assertIn(CALLBACK_STATO, all_callbacks)
        self.assertIn(CALLBACK_HELP, all_callbacks)
        self.assertIn(CALLBACK_SETTINGS, all_callbacks)

    def test_callback_command_from_data_maps_buttons(self) -> None:
        self.assertEqual(callback_command_from_data(CALLBACK_ULTIMI), "/ultimi 7 20")
        self.assertEqual(callback_command_from_data(CALLBACK_TUTTI), "/tutti 7 20")
        self.assertEqual(callback_command_from_data(CALLBACK_STATO), "/stato")
        self.assertEqual(callback_command_from_data(CALLBACK_SETTINGS), "/settings")
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
        self.assertIn("Nessun ordine con codice fiscale", content)

    def test_build_help_text_mentions_commands(self) -> None:
        text = build_help_text()
        self.assertIn("/ultimi", text)
        self.assertIn("/ordine", text)
        self.assertIn("/settings", text)
        self.assertIn("/leave_bot", text)
        self.assertIn("/reconnect_status", text)
        self.assertIn("/why_not_notified", text)
        self.assertIn("/notifications on", text)
        self.assertIn("/request_access", text)
        self.assertIn("/users", text)
        self.assertIn(BOT_DISPLAY_NAME, text)

    def test_build_telegram_branding_profile_contains_expected_fields(self) -> None:
        profile = build_telegram_branding_profile()
        self.assertEqual(profile["name"], BOT_DISPLAY_NAME)
        self.assertEqual(profile["short_description"], BOT_TAGLINE)
        commands = profile["commands"]
        self.assertIsInstance(commands, list)
        self.assertGreaterEqual(len(commands), 6)
        self.assertEqual(commands[0]["command"], "help")
        self.assertEqual(commands[1]["command"], "connect")

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
                "taxpayerId": "RSSMRA80A01H501U",
                "taxIdentifierType": "CODICE_FISCALE",
                "issuingCountry": "IT",
            }
        )
        self.assertIn("NUOVO ORDINE EBAY RICEVUTO", text)
        self.assertIn("RSSMRA80A01H501U", text)

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

    def test_has_codice_fiscale_requires_type_and_value(self) -> None:
        self.assertTrue(
            has_codice_fiscale(
                {
                    "taxIdentifierType": "CODICE_FISCALE",
                    "taxpayerId": "RSSMRA80A01H501U",
                }
            )
        )
        self.assertFalse(
            has_codice_fiscale(
                {
                    "taxIdentifierType": "VAT_NUMBER",
                    "taxpayerId": "IT123",
                }
            )
        )
        self.assertFalse(
            has_codice_fiscale(
                {
                    "taxIdentifierType": "CODICE_FISCALE",
                    "taxpayerId": "",
                }
            )
        )

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
