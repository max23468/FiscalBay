import unittest
from unittest.mock import patch

from src.telegram_bot import (
    TelegramConfig,
    build_help_text,
    chunk_message,
    format_auto_notification,
    format_records,
    has_codice_fiscale,
    options_for_command,
    parse_command,
    process_message,
    update_state_with_records,
)


class TelegramBotTests(unittest.TestCase):
    def test_parse_command_strips_bot_suffix(self) -> None:
        command, args = parse_command("/ultimi@mybot 7 5")
        self.assertEqual(command, "/ultimi")
        self.assertEqual(args, ["7", "5"])

    def test_options_for_command_ordine(self) -> None:
        options = options_for_command("/ordine", ["12-34567-89012"])
        self.assertEqual(options.order_ids, ["12-34567-89012"])
        self.assertFalse(options.only_found)

    def test_chunk_message_splits_long_payload(self) -> None:
        chunks = chunk_message(("a" * 2000) + "\n" + ("b" * 2000))
        self.assertEqual(len(chunks), 2)

    def test_format_records_empty_only_found(self) -> None:
        content = format_records([], only_found=True)
        self.assertIn("Nessun ordine con codice fiscale", content)

    def test_build_help_text_mentions_commands(self) -> None:
        text = build_help_text()
        self.assertIn("/ultimi", text)
        self.assertIn("/ordine", text)

    @patch("src.telegram_bot.fetch_records")
    @patch("src.telegram_bot.load_config")
    def test_process_message_for_help(self, mock_load_config, mock_fetch_records) -> None:
        replies = process_message(
            text="/help",
            chat_id=1,
            telegram_config=TelegramConfig(token="x", allowed_chat_ids=None, notify_chat_ids=set()),
            ebay_environment="production",
        )
        self.assertEqual(len(replies), 1)
        self.assertIn("Comandi disponibili", replies[0])
        mock_load_config.assert_not_called()
        mock_fetch_records.assert_not_called()

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
        self.assertIn("Nuovo ordine eBay ricevuto", text)
        self.assertIn("RSSMRA80A01H501U", text)

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


if __name__ == "__main__":
    unittest.main()
