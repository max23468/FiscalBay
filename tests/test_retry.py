import unittest
import urllib.error
from unittest.mock import patch

from src.ebay_cf.clients.telegram import telegram_api_request_once
from src.ebay_cf.errors import TelegramApiError
from src.ebay_cf.retry import run_with_retry


class RetryTests(unittest.TestCase):
    def test_run_with_retry_does_not_catch_keyboard_interrupt(self) -> None:
        attempts = 0

        def action() -> None:
            nonlocal attempts
            attempts += 1
            raise KeyboardInterrupt()

        with self.assertRaises(KeyboardInterrupt):
            run_with_retry(
                action,
                max_attempts=3,
                should_retry=lambda _exc: True,
            )

        self.assertEqual(attempts, 1)

    @patch("src.ebay_cf.clients.telegram.urllib.request.urlopen")
    def test_telegram_api_request_once_wraps_url_error(self, mock_urlopen) -> None:
        mock_urlopen.side_effect = urllib.error.URLError("offline")

        with self.assertRaises(TelegramApiError) as ctx:
            telegram_api_request_once("token", "sendMessage")

        self.assertIn("offline", str(ctx.exception))

    @patch("src.ebay_cf.clients.telegram.urllib.request.urlopen")
    def test_telegram_api_request_once_does_not_hide_keyboard_interrupt(
        self, mock_urlopen
    ) -> None:
        mock_urlopen.side_effect = KeyboardInterrupt()

        with self.assertRaises(KeyboardInterrupt):
            telegram_api_request_once("token", "sendMessage")


if __name__ == "__main__":
    unittest.main()
