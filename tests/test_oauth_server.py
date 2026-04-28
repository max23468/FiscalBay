import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from src.fiscalbay.errors import ConfigurationError
from src.fiscalbay.models import Config, OauthLinkSession, TelegramConfig
from src.fiscalbay.oauth_server import (
    build_oauth_start_redirect,
    complete_oauth_link,
    describe_callback_exception,
    describe_provider_error,
    oauth_callback_url,
    oauth_runame,
    render_about_page,
    render_action_html_page,
    render_home_page,
    render_oauth_start_help_page,
    render_oauth_start_page,
    render_privacy_page,
    render_public_icon_asset_for_path,
    render_public_page_for_path,
)
from src.fiscalbay.storage.sqlite import (
    create_oauth_link_session,
    load_audit_log_entries,
    load_ebay_token_sets,
    load_latest_oauth_link_session,
    resolve_linked_ebay_account,
)


class OAuthServerTests(unittest.TestCase):
    def test_render_oauth_start_page_contains_cta_and_refresh(self) -> None:
        body = render_oauth_start_page("https://example.com/continue").decode("utf-8")

        self.assertIn("Continua con eBay", body)
        self.assertIn("Continua su eBay", body)
        self.assertIn("https://example.com/continue", body)
        self.assertIn("http-equiv='refresh'", body)

    def test_render_oauth_start_help_page_explains_telegram_entrypoint(self) -> None:
        body = render_oauth_start_help_page().decode("utf-8")

        self.assertIn("Collegamento da Telegram", body)
        self.assertIn("/account collega", body)
        self.assertIn("Apri Telegram", body)

    def test_render_action_html_page_can_include_hint_and_action(self) -> None:
        body = render_action_html_page(
            "Collegamento riuscito",
            "Messaggio di conferma",
            action_label="Apri Telegram",
            action_url="https://t.me/",
            hint="Puoi chiudere questa pagina.",
        ).decode("utf-8")

        self.assertIn("Apri Telegram", body)
        self.assertIn("https://t.me/", body)
        self.assertIn("Puoi chiudere questa pagina.", body)

    def test_render_privacy_page_describes_data_handling(self) -> None:
        body = render_privacy_page().decode("utf-8")

        self.assertIn("Informativa privacy", body)
        self.assertIn("refresh token eBay cifrato a riposo", body)
        self.assertIn("non deduce o ricostruisce dati fiscali", body)
        self.assertNotIn("collegare un account", body)
        self.assertNotIn("collegamento OAuth", body)

    def test_render_about_page_describes_service_scope(self) -> None:
        body = render_about_page().decode("utf-8")

        self.assertIn("About FiscalBay", body)
        self.assertIn("assistente fiscale ordini per venditori eBay", body)
        self.assertIn("dashboard eBay generalista", body)
        self.assertNotIn("collega un account eBay", body)
        self.assertNotIn("pagine OAuth di eBay", body)

    def test_render_home_page_is_telegram_first(self) -> None:
        body = render_home_page().decode("utf-8")

        self.assertIn("FiscalBay", body)
        self.assertIn("Assistente fiscale ordini per venditori eBay", body)
        self.assertIn("href='/favicon.svg'", body)
        self.assertIn("href='/apple-touch-icon.png'", body)
        self.assertIn("href='/privacy'", body)
        self.assertIn("href='/about'", body)
        self.assertIn("Apri Telegram", body)
        self.assertIn("Avvio da Telegram", body)
        self.assertIn("buyer.taxIdentifier", body)
        self.assertNotIn("Collega eBay", body)
        self.assertNotIn("Pagine eBay Dev", body)

    def test_render_public_icon_asset_for_path_serves_favicon_variants(self) -> None:
        svg_asset = render_public_icon_asset_for_path("/favicon.svg")
        png_asset = render_public_icon_asset_for_path("/apple-touch-icon.png")
        ico_asset = render_public_icon_asset_for_path("/favicon.ico")

        assert svg_asset is not None
        assert png_asset is not None
        assert ico_asset is not None
        self.assertEqual(svg_asset[1], "image/svg+xml; charset=utf-8")
        self.assertEqual(png_asset[1], "image/png")
        self.assertEqual(ico_asset[1], "image/png")
        self.assertTrue(svg_asset[0].startswith(b"<svg"))
        self.assertGreater(len(png_asset[0]), 0)

    def test_render_public_page_for_path_matches_branding_urls(self) -> None:
        home_body = render_public_page_for_path("/")
        privacy_body = render_public_page_for_path("/privacy/")
        about_body = render_public_page_for_path("/about")

        assert home_body is not None
        assert privacy_body is not None
        assert about_body is not None
        self.assertIn("FiscalBay", home_body.decode("utf-8"))
        self.assertIn("Informativa privacy", privacy_body.decode("utf-8"))
        self.assertIn("About FiscalBay", about_body.decode("utf-8"))
        self.assertIsNone(render_public_page_for_path("/oauth/start"))

    def test_describe_provider_error_for_user_cancelled(self) -> None:
        presentation = describe_provider_error("access_denied")

        self.assertEqual(presentation.title, "Autorizzazione annullata")
        self.assertEqual(presentation.outcome, "user_cancelled")
        self.assertIn("/account collega", presentation.message)
        self.assertIn("/account collega", presentation.notify_text)

    def test_describe_callback_exception_for_expired_session(self) -> None:
        presentation = describe_callback_exception(
            Exception("La sessione OAuth e' scaduta. Usa di nuovo /account collega.")
        )

        self.assertEqual(presentation.title, "Collegamento fallito")
        self.assertEqual(presentation.outcome, "callback_error")

        config_presentation = describe_callback_exception(
            ConfigurationError("La sessione OAuth e' scaduta. Usa di nuovo /account collega.")
        )
        self.assertEqual(config_presentation.title, "Sessione scaduta")
        self.assertEqual(config_presentation.outcome, "session_expired")
        self.assertIn("/account collega", config_presentation.notify_text)

    def test_describe_callback_exception_for_unavailable_session(self) -> None:
        config_presentation = describe_callback_exception(
            ConfigurationError("La sessione OAuth non e' piu' disponibile.")
        )

        self.assertEqual(config_presentation.title, "Link non più valido")
        self.assertIn("non è più valido", config_presentation.message)
        self.assertIn("non più valido", config_presentation.notify_text)
        self.assertEqual(config_presentation.outcome, "session_unavailable")

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
        self.assertIn("prompt=login", redirect)
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
            success_message = send_message_mock.call_args.args[2]
            self.assertIn("/account", success_message)
            self.assertIn("/settings", success_message)
            self.assertIn("/ordini fiscali", success_message)


if __name__ == "__main__":
    unittest.main()
