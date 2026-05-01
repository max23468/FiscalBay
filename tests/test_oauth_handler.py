import unittest
from http import HTTPStatus
from unittest.mock import Mock, patch

from src.fiscalbay.models import OauthLinkSession, TelegramConfig
from src.fiscalbay.oauth_server import OAuthCallbackResult, OAuthHandler


def telegram_config() -> TelegramConfig:
    return TelegramConfig(
        token="telegram-token",
        allowed_chat_ids=None,
        notify_chat_ids=set(),
        state_path="state.db",
        retry_queue_path="state.db",
    )


def make_handler(path: str = "/") -> OAuthHandler:
    handler = OAuthHandler.__new__(OAuthHandler)
    handler.path = path
    handler.server = Mock(telegram_config=telegram_config())
    handler._write_response = Mock()
    return handler


def pending_session() -> OauthLinkSession:
    return OauthLinkSession(
        telegram_user_id=123,
        telegram_chat_id=456,
        environment="sandbox",
        oauth_state="state-1",
        status="pending",
    )


class OAuthHandlerTests(unittest.TestCase):
    def test_do_get_routes_health_public_assets_start_callback_and_not_found(self) -> None:
        handler = make_handler("/healthz")
        handler.do_GET()
        handler._write_response.assert_called_once_with(
            HTTPStatus.OK,
            b"ok",
            "text/plain; charset=utf-8",
        )

        handler = make_handler("/favicon.svg")
        handler.do_GET()
        self.assertEqual(handler._write_response.call_args.args[0], HTTPStatus.OK)
        self.assertEqual(handler._write_response.call_args.args[2], "image/svg+xml; charset=utf-8")

        handler = make_handler("/")
        handler.do_GET()
        self.assertEqual(handler._write_response.call_args.args[0], HTTPStatus.OK)

        handler = make_handler("/oauth/start?state=state-1")
        handler._handle_start = Mock()
        handler.do_GET()
        handler._handle_start.assert_called_once_with({"state": ["state-1"]})

        handler = make_handler("/oauth/callback?state=state-1&code=abc")
        handler._handle_callback = Mock()
        handler.do_GET()
        handler._handle_callback.assert_called_once_with({"state": ["state-1"], "code": ["abc"]})

        handler = make_handler("/missing")
        handler.do_GET()
        self.assertEqual(handler._write_response.call_args.args[0], HTTPStatus.NOT_FOUND)

    @patch("src.fiscalbay.oauth_server.build_oauth_start_redirect")
    def test_handle_start_renders_help_success_and_failure(self, redirect_mock) -> None:
        handler = make_handler()
        handler._handle_start({})
        self.assertEqual(handler._write_response.call_args.args[0], HTTPStatus.OK)
        self.assertIn(b"Collegamento da Telegram", handler._write_response.call_args.args[1])

        redirect_mock.return_value = "https://auth.ebay.com/oauth"
        handler = make_handler()
        handler._handle_start({"state": ["state-1"]})
        self.assertEqual(handler._write_response.call_args.args[0], HTTPStatus.OK)
        self.assertIn(b"Continua con eBay", handler._write_response.call_args.args[1])

        redirect_mock.side_effect = RuntimeError("state non valido")
        handler = make_handler()
        handler._handle_start({"state": ["bad"]})
        self.assertEqual(handler._write_response.call_args.args[0], HTTPStatus.BAD_REQUEST)
        self.assertIn(b"state non valido", handler._write_response.call_args.args[1])

    @patch("src.fiscalbay.oauth_server.send_message")
    @patch("src.fiscalbay.oauth_server.summarize_tenant_account_status")
    @patch("src.fiscalbay.oauth_server.update_oauth_link_session")
    @patch("src.fiscalbay.oauth_server.append_oauth_audit_log")
    @patch("src.fiscalbay.oauth_server.load_oauth_link_session_by_state")
    def test_handle_callback_records_provider_error_for_existing_session(
        self,
        load_session_mock,
        append_audit_mock,
        update_session_mock,
        summarize_mock,
        send_message_mock,
    ) -> None:
        load_session_mock.return_value = pending_session()
        handler = make_handler()

        handler._handle_callback({"state": ["state-1"], "error": ["invalid_scope"]})

        self.assertEqual(handler._write_response.call_args.args[0], HTTPStatus.BAD_REQUEST)
        append_audit_mock.assert_called_once()
        update_session_mock.assert_called_once()
        summarize_mock.assert_called_once_with("state.db", 123, "sandbox")
        send_message_mock.assert_called_once()

    @patch("src.fiscalbay.oauth_server.public_bot_url", return_value="https://t.me/fiscalbay_bot")
    @patch("src.fiscalbay.oauth_server.summarize_tenant_account_status")
    @patch("src.fiscalbay.oauth_server.complete_oauth_link")
    @patch("src.fiscalbay.oauth_server.load_oauth_link_session_by_state")
    def test_handle_callback_renders_success_after_completed_link(
        self,
        load_session_mock,
        complete_link_mock,
        summarize_mock,
        _bot_url_mock,
    ) -> None:
        load_session_mock.return_value = pending_session()
        complete_link_mock.return_value = OAuthCallbackResult(
            telegram_chat_id=456,
            telegram_user_id=123,
            environment="sandbox",
            ebay_user_id="seller",
            account_status="linked",
        )
        handler = make_handler()

        handler._handle_callback({"state": ["state-1"], "code": ["oauth-code"]})

        complete_link_mock.assert_called_once_with(
            "state-1",
            "oauth-code",
            telegram_config=handler.server.telegram_config,
        )
        summarize_mock.assert_called_once_with("state.db", 123, "sandbox")
        self.assertEqual(handler._write_response.call_args.args[0], HTTPStatus.OK)
        self.assertIn(b"Collegamento riuscito", handler._write_response.call_args.args[1])

    @patch("src.fiscalbay.oauth_server.send_message")
    @patch("src.fiscalbay.oauth_server.summarize_tenant_account_status")
    @patch("src.fiscalbay.oauth_server.update_oauth_link_session")
    @patch("src.fiscalbay.oauth_server.append_oauth_audit_log")
    @patch("src.fiscalbay.oauth_server.complete_oauth_link")
    @patch("src.fiscalbay.oauth_server.load_oauth_link_session_by_state")
    def test_handle_callback_records_completion_failure(
        self,
        load_session_mock,
        complete_link_mock,
        append_audit_mock,
        update_session_mock,
        summarize_mock,
        send_message_mock,
    ) -> None:
        load_session_mock.return_value = pending_session()
        complete_link_mock.side_effect = RuntimeError("boom")
        handler = make_handler()

        handler._handle_callback({"state": ["state-1"], "code": ["oauth-code"]})

        self.assertEqual(handler._write_response.call_args.args[0], HTTPStatus.BAD_REQUEST)
        append_audit_mock.assert_called_once()
        update_session_mock.assert_called_once()
        summarize_mock.assert_called_once_with("state.db", 123, "sandbox")
        send_message_mock.assert_called_once()


if __name__ == "__main__":
    unittest.main()
