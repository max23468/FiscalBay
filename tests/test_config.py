import os
import unittest
from unittest.mock import patch

from src.fiscalbay.config import (
    DEFAULT_SCOPE,
    load_config,
    load_public_service_config,
    load_rate_limit_config,
    load_retention_config,
    load_telegram_config,
)
from src.fiscalbay.errors import ConfigurationError


class ConfigTests(unittest.TestCase):
    def test_load_config_defaults_to_fulfillment_scope_only(self) -> None:
        with patch.dict(
            os.environ,
            {
                "EBAY_CLIENT_ID": "client-id",
                "EBAY_CLIENT_SECRET": "client-secret",
                "EBAY_REFRESH_TOKEN": "refresh-token",
            },
            clear=True,
        ):
            config = load_config("production")

        self.assertEqual(
            DEFAULT_SCOPE,
            "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
        )
        self.assertEqual(config.scopes, DEFAULT_SCOPE)
        self.assertNotIn("commerce.identity.readonly", config.scopes)

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

    def test_load_retention_config_uses_validated_env_helpers(self) -> None:
        with patch.dict(
            os.environ,
            {
                "FISCALBAY_AUDIT_RETENTION_DAYS": "90",
                "FISCALBAY_OAUTH_SESSION_RETENTION_DAYS": "20",
                "FISCALBAY_OAUTH_PENDING_RETENTION_DAYS": "5",
                "FISCALBAY_OPERATION_QUEUE_RETENTION_DAYS": "12",
            },
            clear=True,
        ):
            config = load_retention_config()

        self.assertEqual(config.audit_retention_days, 90)
        self.assertEqual(config.oauth_session_retention_days, 20)
        self.assertEqual(config.oauth_pending_retention_days, 5)
        self.assertEqual(config.operation_queue_retention_days, 12)

    def test_load_public_service_config_uses_scale_thresholds(self) -> None:
        with patch.dict(
            os.environ,
            {
                "FISCALBAY_PUBLIC_SERVICE_MODEL": "approved_public_small",
                "FISCALBAY_WEB_ROLE": "oauth_support_only",
                "FISCALBAY_ONBOARDING_HOSTING": "vps",
                "FISCALBAY_PUBLIC_MAX_APPROVED_USERS": "12",
                "FISCALBAY_PUBLIC_MAX_LINKED_ACCOUNTS": "10",
                "FISCALBAY_PUBLIC_MAX_ACTIVE_TOKEN_SETS": "9",
                "FISCALBAY_SQLITE_MAX_DB_BYTES": "2097152",
            },
            clear=True,
        ):
            config = load_public_service_config()

        self.assertEqual(config.service_model, "approved_public_small")
        self.assertEqual(config.web_role, "oauth_support_only")
        self.assertEqual(config.onboarding_hosting, "vps")
        self.assertEqual(config.max_approved_users, 12)
        self.assertEqual(config.max_linked_accounts, 10)
        self.assertEqual(config.max_active_token_sets, 9)
        self.assertEqual(config.sqlite_max_db_bytes, 2097152)

    def test_load_rate_limit_config_uses_public_service_cooldowns(self) -> None:
        with patch.dict(
            os.environ,
            {
                "FISCALBAY_RATE_LIMIT_ENABLED": "1",
                "FISCALBAY_RATE_LIMIT_REQUEST_ACCESS_SECONDS": "90",
                "FISCALBAY_RATE_LIMIT_CONNECT_SECONDS": "20",
                "FISCALBAY_RATE_LIMIT_DISCONNECT_SECONDS": "8",
                "FISCALBAY_RATE_LIMIT_LEAVE_BOT_SECONDS": "7",
                "FISCALBAY_RATE_LIMIT_SERVICE_MODE_SECONDS": "3",
                "FISCALBAY_RATE_LIMIT_ADMIN_MUTATION_SECONDS": "4",
            },
            clear=True,
        ):
            config = load_rate_limit_config()

        self.assertTrue(config.enabled)
        self.assertEqual(config.request_access_seconds, 90)
        self.assertEqual(config.connect_seconds, 20)
        self.assertEqual(config.disconnect_seconds, 8)
        self.assertEqual(config.leave_bot_seconds, 7)
        self.assertEqual(config.service_mode_seconds, 3)
        self.assertEqual(config.admin_mutation_seconds, 4)

    def test_load_rate_limit_config_can_be_disabled(self) -> None:
        with patch.dict(
            os.environ,
            {
                "FISCALBAY_RATE_LIMIT_ENABLED": "off",
                "FISCALBAY_RATE_LIMIT_ADMIN_MUTATION_SECONDS": "-1",
            },
            clear=True,
        ):
            config = load_rate_limit_config()

        self.assertFalse(config.enabled)
        self.assertEqual(config.admin_mutation_seconds, 0)

    def test_invalid_telegram_chat_id_raises_configuration_error(self) -> None:
        with patch.dict(
            os.environ,
            {"TELEGRAM_BOT_TOKEN": "token", "TELEGRAM_ALLOWED_CHAT_IDS": "abc"},
            clear=True,
        ):
            with self.assertRaises(ConfigurationError):
                load_telegram_config()


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
