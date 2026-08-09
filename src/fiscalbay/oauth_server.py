"""OAuth server responsibilities."""

from __future__ import annotations

import json
import logging
import os
import urllib.parse
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .bot_messaging import send_message
from .config import load_telegram_config
from .ebay_account_deletion import (
    ACCOUNT_DELETION_PATH,
    AccountDeletionError,
    account_deletion_config,
    challenge_response,
    process_notification,
)
from .logging_utils import log_event
from .models import (
    OAUTH_SESSION_STATUS_FAILED,
    TelegramConfig,
)
from .oauth_callback import (
    append_oauth_audit_log,
    build_oauth_start_redirect,
    complete_oauth_link,
    describe_callback_exception,
    describe_provider_error,
    public_bot_url,
)
from .oauth_rendering import (
    render_action_html_page,
    render_html_page,
    render_oauth_start_help_page,
    render_oauth_start_page,
    render_public_icon_asset_for_path,
    render_public_page_for_path,
)
from .storage.oauth import load_oauth_link_session_by_state, update_oauth_link_session
from .storage.users import (
    summarize_tenant_account_status,
)

LOGGER = logging.getLogger("fiscalbay.oauth_server")

DEFAULT_OAUTH_HOST = "127.0.0.1"

DEFAULT_OAUTH_PORT = 8787


class FiscalBayOAuthHTTPServer(ThreadingHTTPServer):
    telegram_config: TelegramConfig


class OAuthHandler(BaseHTTPRequestHandler):
    server: FiscalBayOAuthHTTPServer
    server_version = "FiscalBayOAuth/0.1"

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        if path == "/healthz":
            self._write_response(HTTPStatus.OK, b"ok", "text/plain; charset=utf-8")
            return
        if path == ACCOUNT_DELETION_PATH:
            self._handle_account_deletion_challenge(parsed)
            return
        public_asset = render_public_icon_asset_for_path(path)
        if public_asset is not None:
            body, content_type = public_asset
            self._write_response(HTTPStatus.OK, body, content_type)
            return
        public_page = render_public_page_for_path(path)
        if public_page is not None:
            self._write_response(HTTPStatus.OK, public_page)
            return

        params = urllib.parse.parse_qs(parsed.query)
        if path.endswith("/start"):
            self._handle_start(params)
            return
        if path.endswith("/callback"):
            self._handle_callback(params)
            return

        self._write_response(
            HTTPStatus.NOT_FOUND,
            render_html_page(
                "Risorsa non trovata", "Percorso OAuth non riconosciuto.", is_error=True
            ),
        )

    def do_POST(self) -> None:
        path = urllib.parse.urlparse(self.path).path.rstrip("/") or "/"
        if path != ACCOUNT_DELETION_PATH:
            self._write_response(HTTPStatus.NOT_FOUND, b"not found", "text/plain; charset=utf-8")
            return
        if self.headers.get("Content-Type", "").split(";", 1)[0].strip() != "application/json":
            self._write_response(
                HTTPStatus.UNSUPPORTED_MEDIA_TYPE,
                b"content type unsupported",
                "text/plain; charset=utf-8",
            )
            return
        raw_length = self.headers.get("Content-Length", "")
        try:
            content_length = int(raw_length)
        except ValueError:
            content_length = -1
        if content_length < 0 or content_length > 128 * 1024:
            self._write_response(
                HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
                b"payload too large",
                "text/plain; charset=utf-8",
            )
            return
        body = self.rfile.read(content_length)
        try:
            process_notification(
                self.server.telegram_config.state_path,
                body,
                self.headers.get("X-EBAY-SIGNATURE", ""),
            )
        except AccountDeletionError as exc:
            status = (
                HTTPStatus.PRECONDITION_FAILED
                if exc.code.startswith("signature")
                else HTTPStatus.SERVICE_UNAVAILABLE
            )
            self._write_response(status, exc.code.encode(), "text/plain; charset=utf-8")
            return
        except Exception as exc:
            log_event(LOGGER, logging.ERROR, "ebay_account_deletion_failed", error=exc)
            self._write_response(
                HTTPStatus.SERVICE_UNAVAILABLE,
                b"processing_error",
                "text/plain; charset=utf-8",
            )
            return
        self._write_response(HTTPStatus.NO_CONTENT, b"", "text/plain; charset=utf-8")

    def _handle_account_deletion_challenge(self, parsed: urllib.parse.ParseResult) -> None:
        challenge_code = (urllib.parse.parse_qs(parsed.query).get("challenge_code") or [""])[0]
        if not challenge_code:
            self._write_response(HTTPStatus.BAD_REQUEST, b"challenge code missing")
            return
        try:
            endpoint, verification_token = account_deletion_config()
        except Exception:
            self._write_response(HTTPStatus.SERVICE_UNAVAILABLE, b"not configured")
            return
        body = json.dumps(
            {"challengeResponse": challenge_response(challenge_code, verification_token, endpoint)},
            separators=(",", ":"),
        ).encode()
        self._write_response(HTTPStatus.OK, body, "application/json")

    def _handle_start(self, params: dict[str, list[str]]) -> None:
        oauth_state = (params.get("state") or [""])[0]
        if not oauth_state:
            self._write_response(HTTPStatus.OK, render_oauth_start_help_page())
            return
        try:
            redirect_url = build_oauth_start_redirect(
                oauth_state, self.server.telegram_config.state_path
            )
        except Exception as exc:
            log_event(LOGGER, logging.ERROR, "oauth_start_failed", error=exc, state=oauth_state)
            self._write_response(
                HTTPStatus.BAD_REQUEST,
                render_html_page("Collegamento non disponibile", str(exc), is_error=True),
            )
            return
        self._write_response(HTTPStatus.OK, render_oauth_start_page(redirect_url))

    def _handle_callback(self, params: dict[str, list[str]]) -> None:
        oauth_state = (params.get("state") or [""])[0]
        error_value = (params.get("error") or [""])[0]
        session = load_oauth_link_session_by_state(
            self.server.telegram_config.state_path,
            oauth_state,
            "ebay",
        )
        if error_value:
            presentation = describe_provider_error(error_value)
            if session is not None:
                append_oauth_audit_log(
                    self.server.telegram_config,
                    event_type="oauth_failure",
                    created_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    actor_telegram_user_id=session.telegram_user_id,
                    target_telegram_user_id=session.telegram_user_id,
                    telegram_chat_id=session.telegram_chat_id,
                    environment=session.environment,
                    outcome=presentation.outcome,
                    details_json=error_value[:200],
                )
                update_oauth_link_session(
                    self.server.telegram_config.state_path,
                    oauth_state,
                    status=OAUTH_SESSION_STATUS_FAILED,
                )
                summarize_tenant_account_status(
                    self.server.telegram_config.state_path,
                    session.telegram_user_id,
                    session.environment,
                )
                send_message(
                    self.server.telegram_config.token,
                    session.telegram_chat_id,
                    presentation.notify_text,
                )
            self._write_response(
                HTTPStatus.BAD_REQUEST,
                render_html_page(
                    presentation.title,
                    presentation.message,
                    is_error=True,
                ),
            )
            return

        code = (params.get("code") or [""])[0]
        try:
            result = complete_oauth_link(
                oauth_state,
                code,
                telegram_config=self.server.telegram_config,
            )
            log_event(
                LOGGER,
                logging.INFO,
                "oauth_callback_completed",
                telegram_user_id=result.telegram_user_id,
                chat_id=result.telegram_chat_id,
                environment=result.environment,
            )
        except Exception as exc:
            presentation = describe_callback_exception(exc)
            if session is not None:
                append_oauth_audit_log(
                    self.server.telegram_config,
                    event_type="oauth_failure",
                    created_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    actor_telegram_user_id=session.telegram_user_id,
                    target_telegram_user_id=session.telegram_user_id,
                    telegram_chat_id=session.telegram_chat_id,
                    environment=session.environment,
                    outcome=presentation.outcome,
                    details_json=str(exc)[:200],
                )
                update_oauth_link_session(
                    self.server.telegram_config.state_path,
                    oauth_state,
                    status=OAUTH_SESSION_STATUS_FAILED,
                )
                summarize_tenant_account_status(
                    self.server.telegram_config.state_path,
                    session.telegram_user_id,
                    session.environment,
                )
                send_message(
                    self.server.telegram_config.token,
                    session.telegram_chat_id,
                    presentation.notify_text,
                )
            log_event(LOGGER, logging.ERROR, "oauth_callback_failed", error=exc, state=oauth_state)
            self._write_response(
                HTTPStatus.BAD_REQUEST,
                render_html_page(presentation.title, presentation.message, is_error=True),
            )
            return

        summarize_tenant_account_status(
            self.server.telegram_config.state_path,
            result.telegram_user_id,
            result.environment,
        )
        self._write_response(
            HTTPStatus.OK,
            render_action_html_page(
                "Collegamento riuscito",
                (
                    "Puoi tornare su Telegram: il bot ha già confermato il collegamento "
                    "e ti aspetta lì."
                ),
                action_label="Apri Telegram",
                action_url=public_bot_url(),
                hint="Se l'app Telegram è già aperta, puoi semplicemente chiudere questa pagina.",
            ),
        )

    def log_message(self, format: str, *args: object) -> None:
        LOGGER.info("oauth_http %s", format % args)

    def _write_response(
        self,
        status: HTTPStatus,
        body: bytes,
        content_type: str = "text/html; charset=utf-8",
    ) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def run_oauth_server() -> int:
    telegram_config = load_telegram_config()
    host = os.getenv("EBAY_OAUTH_SERVER_HOST", DEFAULT_OAUTH_HOST).strip() or DEFAULT_OAUTH_HOST
    port = int(os.getenv("EBAY_OAUTH_SERVER_PORT", str(DEFAULT_OAUTH_PORT)))
    server = FiscalBayOAuthHTTPServer((host, port), OAuthHandler)
    server.telegram_config = telegram_config
    log_event(LOGGER, logging.INFO, "oauth_server_started", host=host, port=port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log_event(LOGGER, logging.INFO, "oauth_server_stopped")
    finally:
        server.server_close()
    return 0


def main() -> int:
    return run_oauth_server()
