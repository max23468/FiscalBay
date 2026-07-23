import unittest
import urllib.error
from datetime import datetime, timezone
from io import BytesIO
from unittest.mock import MagicMock, patch

from src.fiscalbay.clients import ebay, telegram
from src.fiscalbay.errors import EbayApiError, TelegramApiError
from src.fiscalbay.models import Config


def sample_config(environment: str = "production") -> Config:
    return Config(
        client_id="cid",
        client_secret="secret",
        refresh_token="refresh",
        environment=environment,
        scopes="scope-a scope-b",
    )


class EbayClientAdditionalTests(unittest.TestCase):
    @patch("src.fiscalbay.clients.ebay.urllib.request.urlopen")
    def test_request_json_once_handles_success_empty_invalid_and_transport_errors(
        self,
        urlopen_mock,
    ) -> None:
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"ok": true}'
        urlopen_mock.return_value = response
        self.assertEqual(ebay.request_json_once("GET", "https://api.ebay.com/x"), {"ok": True})

        response.__enter__.return_value.read.return_value = b""
        self.assertEqual(ebay.request_json_once("GET", "https://api.ebay.com/x"), {})

        response.__enter__.return_value.read.return_value = b"[1, 2]"
        with self.assertRaises(EbayApiError):
            ebay.request_json_once("GET", "https://api.ebay.com/x")

        urlopen_mock.side_effect = urllib.error.HTTPError(
            "https://api.ebay.com/x",
            400,
            "Bad Request",
            {},
            BytesIO(b'{"message": "richiesta errata"}'),
        )
        with self.assertRaises(EbayApiError) as http_ctx:
            ebay.request_json_once("GET", "https://api.ebay.com/x")
        self.assertEqual(http_ctx.exception.status_code, 400)
        self.assertIn("richiesta errata", str(http_ctx.exception))

        urlopen_mock.side_effect = urllib.error.HTTPError(
            "https://api.ebay.com/x",
            500,
            "Server Error",
            {},
            BytesIO(b"down"),
        )
        with self.assertRaises(EbayApiError) as non_json_ctx:
            ebay.request_json_once("GET", "https://api.ebay.com/x")
        self.assertIn("down", str(non_json_ctx.exception))

        urlopen_mock.side_effect = urllib.error.URLError("offline")
        with self.assertRaises(EbayApiError) as network_ctx:
            ebay.request_json_once("GET", "https://api.ebay.com/x")
        self.assertIn("Errore di rete", str(network_ctx.exception))

    @patch("src.fiscalbay.clients.ebay.urllib.request.urlopen")
    def test_request_json_once_closes_http_error_body(self, urlopen_mock) -> None:
        body = BytesIO(b'{"message": "boom"}')
        urlopen_mock.side_effect = urllib.error.HTTPError(
            "https://api.ebay.com/x", 400, "Bad Request", {}, body
        )
        with self.assertRaises(EbayApiError):
            ebay.request_json_once("GET", "https://api.ebay.com/x")
        self.assertTrue(body.closed)

    @patch("src.fiscalbay.clients.telegram.urllib.request.urlopen")
    def test_telegram_api_request_once_closes_http_error_body(self, urlopen_mock) -> None:
        body = BytesIO(b'{"description": "boom"}')
        urlopen_mock.side_effect = urllib.error.HTTPError(
            "https://api.telegram.org/bottoken/sendMessage", 429, "Too Many", {}, body
        )
        with self.assertRaises(TelegramApiError):
            telegram.telegram_api_request_once("token", "sendMessage")
        self.assertTrue(body.closed)

    def test_retry_settings_bases_and_retryable_statuses_are_normalized(self) -> None:
        with patch.dict(
            "os.environ",
            {"EBAY_HTTP_MAX_RETRIES": "0", "EBAY_HTTP_RETRY_BASE_DELAY": "0"},
            clear=False,
        ):
            self.assertEqual(ebay.request_retry_settings(), (1, 0.05))

        self.assertTrue(ebay.ebay_error_retryable(EbayApiError("network")))
        self.assertTrue(ebay.ebay_error_retryable(EbayApiError("rate", status_code=429)))
        self.assertTrue(ebay.ebay_error_retryable(EbayApiError("server", status_code=503)))
        self.assertFalse(ebay.ebay_error_retryable(EbayApiError("bad", status_code=400)))

    @patch("src.fiscalbay.clients.ebay.request_json")
    def test_token_and_identity_helpers_build_expected_requests(self, request_json_mock) -> None:
        request_json_mock.side_effect = [
            {"access_token": "access", "expires_in": 3600},
            {"refresh_token": "tenant-refresh", "access_token": "tenant-access"},
            {"username": "seller"},
        ]
        config = sample_config("sandbox")

        refresh_response = ebay.request_user_access_token_response(config)
        code_response = ebay.request_authorization_code_token_response(
            config,
            "oauth-code",
            "runame",
        )
        profile = ebay.get_authenticated_user_profile(config, "access")

        self.assertEqual(refresh_response["access_token"], "access")
        self.assertEqual(code_response["refresh_token"], "tenant-refresh")
        self.assertEqual(profile["username"], "seller")
        refresh_call = request_json_mock.call_args_list[0]
        self.assertEqual(refresh_call.args[0], "POST")
        self.assertIn("/identity/v1/oauth2/token", refresh_call.args[1])
        self.assertIn(b"grant_type=refresh_token", refresh_call.kwargs["data"])
        code_call = request_json_mock.call_args_list[1]
        self.assertIn(b"grant_type=authorization_code", code_call.kwargs["data"])
        identity_call = request_json_mock.call_args_list[2]
        self.assertIn("apiz.sandbox.ebay.com", identity_call.args[1])

    @patch("src.fiscalbay.clients.ebay.request_json")
    def test_get_orders_paginates_and_get_order_detail_quotes_order_id(
        self, request_json_mock
    ) -> None:
        request_json_mock.side_effect = [
            {"orders": [{"orderId": "order-1"}, {"orderId": "order-2"}]},
            {"orders": [{"orderId": "order-3"}]},
            {"orderId": "legacy/order 1"},
        ]
        config = sample_config()

        orders = ebay.get_orders(
            config,
            "access",
            datetime(2026, 5, 1, tzinfo=timezone.utc),
            datetime(2026, 5, 2, tzinfo=timezone.utc),
            page_size=2,
            max_results=5,
        )
        detail = ebay.get_order_detail(config, "access", "legacy/order 1")

        self.assertEqual([order["orderId"] for order in orders], ["order-1", "order-2", "order-3"])
        self.assertEqual(detail["orderId"], "legacy/order 1")
        self.assertIn("offset=2", request_json_mock.call_args_list[1].args[1])
        self.assertIn("legacy%2Forder%201", request_json_mock.call_args_list[2].args[1])

    def test_get_access_token_reports_missing_token_and_reuses_concurrent_cache(self) -> None:
        ebay.clear_access_token_cache()
        config = sample_config()
        with patch(
            "src.fiscalbay.clients.ebay.request_user_access_token_response",
            return_value={},
        ):
            with self.assertRaises(EbayApiError):
                ebay.get_access_token(config)

        with (
            patch("src.fiscalbay.clients.ebay.time.time", side_effect=[100.0, 100.0, 100.0, 100.0]),
            patch(
                "src.fiscalbay.clients.ebay.request_user_access_token_response",
                return_value={"access_token": "fresh", "expires_in": 3600},
            ) as mint_mock,
        ):
            self.assertEqual(ebay.get_access_token(config), "fresh")
            self.assertEqual(ebay.get_access_token(config), "fresh")

        self.assertEqual(mint_mock.call_count, 1)


class TelegramClientAdditionalTests(unittest.TestCase):
    @patch("src.fiscalbay.clients.telegram.urllib.request.urlopen")
    def test_telegram_api_request_once_handles_success_and_errors(self, urlopen_mock) -> None:
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"ok": true, "result": [{"id": 1}]}'
        urlopen_mock.return_value = response
        result = telegram.telegram_api_request_once("token", "getUpdates", {"offset": 1})
        request = urlopen_mock.call_args.args[0]

        self.assertEqual(result, [{"id": 1}])
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(request.headers["Content-type"], "application/json")

        response.__enter__.return_value.read.return_value = b'{"ok": false, "description": "ko"}'
        with self.assertRaises(TelegramApiError):
            telegram.telegram_api_request_once("token", "getMe")

        response.__enter__.return_value.read.return_value = b"[1]"
        with self.assertRaises(TelegramApiError):
            telegram.telegram_api_request_once("token", "getMe")

        urlopen_mock.side_effect = urllib.error.HTTPError(
            "https://api.telegram.org/bottoken/sendMessage",
            429,
            "Too Many Requests",
            {},
            BytesIO(b'{"description": "retry later"}'),
        )
        with self.assertRaises(TelegramApiError) as http_ctx:
            telegram.telegram_api_request_once("token", "sendMessage")
        self.assertEqual(http_ctx.exception.status_code, 429)
        self.assertIn("retry later", str(http_ctx.exception))

        urlopen_mock.side_effect = RuntimeError("socket rotto")
        with self.assertRaises(TelegramApiError) as network_ctx:
            telegram.telegram_api_request_once("token", "sendMessage")
        self.assertIn("socket rotto", str(network_ctx.exception))

    def test_telegram_retry_helpers_and_branding_dispatch(self) -> None:
        with patch.dict(
            "os.environ",
            {"TELEGRAM_HTTP_MAX_RETRIES": "0", "TELEGRAM_HTTP_RETRY_BASE_DELAY": "0"},
            clear=False,
        ):
            self.assertEqual(telegram.telegram_retry_settings(), (1, 0.05))

        self.assertTrue(telegram.telegram_error_retryable(TelegramApiError("network")))
        self.assertTrue(
            telegram.telegram_error_retryable(TelegramApiError("rate", status_code=429))
        )
        self.assertTrue(
            telegram.telegram_error_retryable(TelegramApiError("server", status_code=500))
        )
        self.assertFalse(
            telegram.telegram_error_retryable(TelegramApiError("bad", status_code=400))
        )

        with patch("src.fiscalbay.clients.telegram.telegram_request") as request_mock:
            telegram.ensure_long_polling("token")
            telegram.sync_bot_branding(
                "token",
                name="FiscalBay",
                short_description="short",
                description="long",
                commands=[{"command": "start", "description": "Avvio"}],
            )

        self.assertEqual(request_mock.call_count, 6)
        self.assertEqual(request_mock.call_args_list[0].args[1], "deleteWebhook")
        self.assertEqual(request_mock.call_args_list[-1].args[1], "setChatMenuButton")

    @patch("src.fiscalbay.retry.time.sleep")
    @patch("src.fiscalbay.clients.telegram.telegram_request_once")
    def test_telegram_api_request_retries_transient_errors(
        self, request_once_mock, _sleep_mock
    ) -> None:
        request_once_mock.side_effect = [TelegramApiError("rate", status_code=429), {"ok": True}]

        self.assertEqual(telegram.telegram_api_request("token", "getMe"), {"ok": True})
        self.assertEqual(request_once_mock.call_count, 2)


if __name__ == "__main__":
    unittest.main()
