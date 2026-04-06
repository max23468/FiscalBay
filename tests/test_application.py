import unittest
from unittest.mock import Mock

from src.ebay_cf.application import (
    fetch_tenant_records,
    resolve_fetch_context,
    resolve_tenant_fetch_account,
)
from src.ebay_cf.models import Config, FetchOptions, LinkedEbayAccount, OrderRecord


class ApplicationTests(unittest.TestCase):
    def test_resolve_tenant_fetch_account_returns_none_without_user(self) -> None:
        resolve_mock = Mock()

        account = resolve_tenant_fetch_account(
            "production",
            telegram_user_id=None,
            state_path="data/state.db",
            resolve_linked_account_fn=resolve_mock,
        )

        self.assertIsNone(account)
        resolve_mock.assert_not_called()

    def test_fetch_tenant_records_prefers_linked_account_environment(self) -> None:
        load_config_mock = Mock(
            return_value=Config(
                client_id="cid",
                client_secret="secret",
                refresh_token="refresh",
                environment="sandbox",
                scopes="scope",
            )
        )
        fetch_records_mock = Mock(return_value=[OrderRecord(orderId="order-1")])
        resolve_account_mock = Mock(
            return_value=LinkedEbayAccount(
                telegram_user_id=123,
                ebay_user_id="seller-ebay",
                environment="sandbox",
                status="linked",
            )
        )

        records = fetch_tenant_records(
            "production",
            FetchOptions(order_ids=["order-1"]),
            telegram_user_id=123,
            state_path="data/state.db",
            load_config_fn=load_config_mock,
            fetch_records_fn=fetch_records_mock,
            resolve_linked_account_fn=resolve_account_mock,
        )

        self.assertEqual([record.orderId for record in records], ["order-1"])
        resolve_account_mock.assert_called_once_with("data/state.db", 123, "production")
        load_config_mock.assert_called_once_with("sandbox")

    def test_resolve_fetch_context_uses_tenant_config_when_available(self) -> None:
        tenant_config = Config(
            client_id="tenant-cid",
            client_secret="tenant-secret",
            refresh_token="tenant-refresh",
            environment="sandbox",
            scopes="scope",
        )
        resolve_account_mock = Mock(
            return_value=LinkedEbayAccount(
                telegram_user_id=123,
                ebay_user_id="seller-ebay",
                environment="sandbox",
                status="linked",
            )
        )
        load_global_mock = Mock()
        load_tenant_mock = Mock(return_value=tenant_config)

        resolved = resolve_fetch_context(
            "production",
            telegram_user_id=123,
            state_path="data/state.db",
            load_config_fn=load_global_mock,
            resolve_linked_account_fn=resolve_account_mock,
            load_tenant_config_fn=load_tenant_mock,
        )

        self.assertEqual(resolved.config_source, "tenant_store")
        self.assertTrue(resolved.used_tenant_credentials)
        self.assertEqual(resolved.environment, "sandbox")
        self.assertEqual(resolved.ebay_user_id, "seller-ebay")
        load_tenant_mock.assert_called_once_with(
            resolve_account_mock.return_value,
            "sandbox",
            "data/state.db",
        )
        load_global_mock.assert_not_called()

    def test_resolve_fetch_context_falls_back_to_global_env(self) -> None:
        global_config = Config(
            client_id="global-cid",
            client_secret="global-secret",
            refresh_token="global-refresh",
            environment="production",
            scopes="scope",
        )
        resolve_account_mock = Mock(
            return_value=LinkedEbayAccount(
                telegram_user_id=123,
                ebay_user_id="seller-ebay",
                environment="sandbox",
                status="linked",
            )
        )
        load_global_mock = Mock(return_value=global_config)
        load_tenant_mock = Mock(return_value=None)

        resolved = resolve_fetch_context(
            "production",
            telegram_user_id=123,
            state_path="data/state.db",
            load_config_fn=load_global_mock,
            resolve_linked_account_fn=resolve_account_mock,
            load_tenant_config_fn=load_tenant_mock,
        )

        self.assertEqual(resolved.config_source, "global_env")
        self.assertFalse(resolved.used_tenant_credentials)
        self.assertEqual(resolved.environment, "sandbox")
        self.assertEqual(resolved.fallback_reason, "tenant_credentials_unavailable")
        load_global_mock.assert_called_once_with("sandbox")


if __name__ == "__main__":
    unittest.main()
