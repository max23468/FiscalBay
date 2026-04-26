import os
import unittest
from unittest.mock import patch

from src.fiscalbay.config import load_telegram_config


class ConfigTests(unittest.TestCase):
    def test_load_telegram_config_defaults_to_deny_all_without_allowed_chat_ids(self) -> None:
        with patch.dict(
            os.environ,
            {"TELEGRAM_BOT_TOKEN": "token"},
            clear=True,
        ):
            config = load_telegram_config()

        self.assertEqual(config.allowed_chat_ids, set())


    def test_load_telegram_config_allows_all_with_wildcard(self) -> None:
        with patch.dict(
            os.environ,
            {"TELEGRAM_BOT_TOKEN": "token", "TELEGRAM_ALLOWED_CHAT_IDS": "*"},
            clear=True,
        ):
            config = load_telegram_config()

        self.assertIsNone(config.allowed_chat_ids)


class AuthorizationTests(unittest.TestCase):
    def test_is_authorized_denies_when_allowlist_is_empty(self) -> None:
        from src.fiscalbay.models import TelegramConfig
        from src.fiscalbay.telegram_commands import is_authorized

        config = TelegramConfig(token="token", allowed_chat_ids=set(), notify_chat_ids=set())
        self.assertFalse(is_authorized(123456, config))

    def test_is_authorized_allows_when_allowlist_is_none(self) -> None:
        from src.fiscalbay.models import TelegramConfig
        from src.fiscalbay.telegram_commands import is_authorized

        config = TelegramConfig(token="token", allowed_chat_ids=None, notify_chat_ids=set())
        self.assertTrue(is_authorized(123456, config))


if __name__ == "__main__":
    unittest.main()
