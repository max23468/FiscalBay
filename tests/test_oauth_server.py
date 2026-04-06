import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from src.ebay_cf.models import Config, OauthLinkSession, TelegramConfig
from src.ebay_cf.oauth_server import (
    build_oauth_start_redirect,
    complete_oauth_link,
    oauth_callback_url,
    oauth_runame,
)
from src.ebay_cf.storage.sqlite import (
    create_oauth_link_session,
    load_audit_log_entries,
    load_ebay_token_sets,
    load_latest_oauth_link_session,
    resolve_linked_ebay_account,
)


class OAuthServerTests(unittest.TestCase):
    def test_oauth_callback_url_can_be_derived_from_connect_base(self) -> None:
        with patch.dict(
            "os.environ",
            {"EBAY_OAUTH_CONNECT_BASE_URL": "https://example.com/oauth/start"},
            clear=False,
        ):
            self.assertEqual(oauth_callback_url(), "https://example.com/oauth/callback")

    def test_oauth_runame_uses_sandbox_override(self) -> None:
        with patch.dict(
            "os.environ",
            {
                "EBAY_OAUTH_RUNAME": "prod-ru-name",
                "EBAY_OAUTH_RUNAME_SANDBOX": "sandbox-ru-name",
            },
            clear=False,
        ):
            self.assertEqual(oauth_runame("sandbox"), "sandbox-ru-name")
            self.assertEqual(oauth_runame("production"), "prod-ru-name")

    def test_build_oauth_start_redirect_uses_session_environment(self) -> None:
        config = Config(
            client_id="cid",
            client_secret="secret",
            refresh_token="refresh",
            environment="sandbox",
            scopes="scope",
        )
        redirect = build_oauth_start_redirect(
            "state-123",
            "data/state.db",
            load_session_fn=lambda _path, _state, _provider: OauthLinkSession(
                telegram_user_id=123,
                telegram_chat_id=456,
                environment="sandbox",
                oauth_state="state-123",
                status="pending",
            ),
            load_config_fn=lambda _environment: config,
            runame_fn=lambda _environment: "sandbox-ru-name",
        )

        self.assertIn("https://auth.sandbox.ebay.com/oauth2/authorize?", redirect)
        self.assertIn("state=state-123", redirect)
        self.assertIn("redirect_uri=sandbox-ru-name", redirect)
        self.assertIn(
            "scope=scope+https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope%2Fcommerce.identity.readonly",
            redirect,
        )

    def test_complete_oauth_link_persists_account_and_token(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            create_oauth_link_session(
                str(db_path),
                OauthLinkSession(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    environment="sandbox",
                    oauth_state="state-1",
                    status="pending",
                ),
            )
            telegram_config = TelegramConfig(
                token="telegram-token",
                allowed_chat_ids=None,
                notify_chat_ids={456},
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )
            send_message_mock = Mock()

            result = complete_oauth_link(
                "state-1",
                "oauth-code",
                telegram_config=telegram_config,
                load_config_fn=lambda _environment: Config(
                    client_id="cid",
                    client_secret="secret",
                    refresh_token="global-refresh",
                    environment="sandbox",
                    scopes="scope-1 scope-2",
                ),
                callback_url_fn=lambda: "https://example.com/oauth/callback",
                runame_fn=lambda _environment: "sandbox-ru-name",
                exchange_code_fn=lambda _config, _code, _runame: {
                    "refresh_token": "tenant-refresh",
                    "access_token": "access-token",
                    "scope": "scope-1 scope-2",
                    "expires_in": 7200,
                },
                fetch_user_profile_fn=lambda _config, _access_token: {"username": "real-ebay-user"},
                encode_refresh_token_fn=lambda refresh_token: f"plain:{refresh_token}",
                send_message_fn=send_message_mock,
            )

            self.assertEqual(result.environment, "sandbox")
            self.assertEqual(result.ebay_user_id, "real-ebay-user")
            account = resolve_linked_ebay_account(str(db_path), 123, "sandbox")
            assert account is not None
            self.assertEqual(account.status, "linked")
            self.assertEqual(account.ebay_user_id, "real-ebay-user")
            token_set = load_ebay_token_sets(str(db_path))[0]
            self.assertEqual(token_set.refresh_token_encrypted, "plain:tenant-refresh")
            self.assertEqual(token_set.status, "active")
            session = load_latest_oauth_link_session(str(db_path), 123)
            assert session is not None
            self.assertEqual(session.status, "completed")
            audit_entries = load_audit_log_entries(str(db_path))
            self.assertEqual(audit_entries[0].event_type, "oauth_success")
            self.assertEqual(audit_entries[0].outcome, "linked")
            self.assertEqual(audit_entries[0].ebay_user_id, "real-ebay-user")
            send_message_mock.assert_called_once()


if __name__ == "__main__":
    unittest.main()
