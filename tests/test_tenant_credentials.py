import os
import unittest
from unittest.mock import Mock, patch

from src.ebay_cf.models import Config, EbayTokenSet, LinkedEbayAccount
from src.ebay_cf.tenant_credentials import (
    decode_refresh_token,
    load_tenant_config_from_storage,
)


class TenantCredentialsTests(unittest.TestCase):
    def test_decode_refresh_token_requires_explicit_opt_in(self) -> None:
        with patch.dict(os.environ, {}, clear=False):
            self.assertIsNone(decode_refresh_token("plain:tenant-refresh"))

    def test_decode_refresh_token_accepts_plaintext_only_when_enabled(self) -> None:
        with patch.dict(os.environ, {"EBAY_ENABLE_PLAINTEXT_TENANT_TOKENS": "1"}, clear=False):
            self.assertEqual(decode_refresh_token("plain:tenant-refresh"), "tenant-refresh")

    def test_load_tenant_config_from_storage_returns_none_for_inactive_token(self) -> None:
        resolve_token_mock = Mock(
            return_value=EbayTokenSet(
                ebay_account_id=7,
                refresh_token_encrypted="plain:tenant-refresh",
                status="revoked",
            )
        )

        config = load_tenant_config_from_storage(
            LinkedEbayAccount(
                telegram_user_id=123,
                ebay_user_id="seller-ebay",
                environment="sandbox",
            ),
            "sandbox",
            "data/state.db",
            resolve_token_set_fn=resolve_token_mock,
            decode_refresh_token_fn=Mock(return_value="tenant-refresh"),
        )

        self.assertIsNone(config)

    def test_load_tenant_config_from_storage_builds_config_when_token_decodes(self) -> None:
        resolve_token_mock = Mock(
            return_value=EbayTokenSet(
                ebay_account_id=7,
                refresh_token_encrypted="plain:tenant-refresh",
                status="active",
            )
        )
        load_config_mock = Mock(
            return_value=Config(
                client_id="cid",
                client_secret="secret",
                refresh_token="tenant-refresh",
                environment="sandbox",
                scopes="scope",
            )
        )

        config = load_tenant_config_from_storage(
            LinkedEbayAccount(
                telegram_user_id=123,
                ebay_user_id="seller-ebay",
                environment="sandbox",
            ),
            "sandbox",
            "data/state.db",
            resolve_token_set_fn=resolve_token_mock,
            decode_refresh_token_fn=Mock(return_value="tenant-refresh"),
            load_config_with_refresh_token_fn=load_config_mock,
        )

        assert config is not None
        self.assertEqual(config.refresh_token, "tenant-refresh")
        load_config_mock.assert_called_once_with("sandbox", "tenant-refresh")


if __name__ == "__main__":
    unittest.main()
