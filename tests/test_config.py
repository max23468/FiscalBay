import os
import unittest
from unittest.mock import patch

from src.ebay_cf.config import load_telegram_config


class ConfigTests(unittest.TestCase):
    def test_load_telegram_config_defaults_to_deny_all_without_allowed_chat_ids(self) -> None:
        with patch.dict(
            os.environ,
            {"TELEGRAM_BOT_TOKEN": "token"},
            clear=True,
        ):
            config = load_telegram_config()

        self.assertEqual(config.allowed_chat_ids, set())


if __name__ == "__main__":
    unittest.main()
