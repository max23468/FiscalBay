"""Minimal OAuth entrypoint server for Telegram self-service onboarding."""

from __future__ import annotations

import html
import logging
import os
import urllib.parse
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Callable

from .bot import send_message
from .clients.ebay import build_user_consent_url, mint_authorization_code_token_response
from .config import load_config, load_telegram_config
from .errors import ConfigurationError
from .logging_utils import log_event
from .models import EbayTokenSet, LinkedEbayAccount, OauthLinkSession, TelegramConfig
from .storage.sqlite import (
    load_oauth_link_session_by_state,
    resolve_linked_ebay_account,
    update_oauth_link_session,
    upsert_ebay_token_set,
    upsert_linked_ebay_account,
)
from .tenant_credentials import encode_refresh_token

LOGGER = logging.getLogger("ebaycf.oauth_server")
DEFAULT_OAUTH_HOST = "127.0.0.1"
DEFAULT_OAUTH_PORT = 8787
DEFAULT_CALLBACK_PATH = "/oauth/callback"


@dataclass
class OAuthCallbackResult:
    telegram_chat_id: int
    telegram_user_id: int
    environment: str
    ebay_user_id: str
    account_status: str


def oauth_callback_url() -> str:
    explicit = os.getenv("EBAY_OAUTH_CALLBACK_URL", "").strip()
    if explicit:
        return explicit
    connect_base = os.getenv("EBAY_OAUTH_CONNECT_BASE_URL", "").strip()
    if not connect_base:
        raise ConfigurationError(
            "Variabile ambiente mancante: EBAY_OAUTH_CALLBACK_URL o EBAY_OAUTH_CONNECT_BASE_URL"
        )
    parsed = urllib.parse.urlparse(connect_base)
    base_path = parsed.path.rstrip("/")
    if base_path.endswith("/start"):
        callback_path = f"{base_path[: -len('/start')]}/callback"
    else:
        callback_path = f"{base_path.rstrip('/')}{DEFAULT_CALLBACK_PATH}"
    rebuilt = parsed._replace(path=callback_path, query="", fragment="")
    return urllib.parse.urlunparse(rebuilt)


def oauth_runame(environment: str) -> str:
    env_name = environment.strip().lower()
    if env_name == "sandbox":
        sandbox = os.getenv("EBAY_OAUTH_RUNAME_SANDBOX", "").strip()
        if sandbox:
            return sandbox

    runame = os.getenv("EBAY_OAUTH_RUNAME", "").strip()
    if runame:
        return runame

    if env_name == "sandbox":
        raise ConfigurationError(
            "Variabile ambiente mancante: EBAY_OAUTH_RUNAME_SANDBOX "
            "(oppure EBAY_OAUTH_RUNAME come fallback)."
        )
    raise ConfigurationError("Variabile ambiente mancante: EBAY_OAUTH_RUNAME")


def session_is_expired(session: OauthLinkSession, *, now: datetime | None = None) -> bool:
    if not session.expires_at:
        return False
    reference = now or datetime.now(timezone.utc)
    expires_at = datetime.fromisoformat(session.expires_at.replace("Z", "+00:00"))
    return expires_at <= reference


def render_html_page(title: str, message: str, *, is_error: bool = False) -> bytes:
    accent = "#9a3412" if is_error else "#166534"
    badge = "Errore" if is_error else "OK"
    safe_title = html.escape(title)
    safe_message = html.escape(message)
    body = (
        "<!doctype html><html lang='it'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        f"<title>{safe_title}</title>"
        "<style>"
        "body{font-family:ui-sans-serif,system-ui,sans-serif;background:#f6f7f9;"
        "color:#111827;padding:40px;}"
        ".card{max-width:720px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;"
        "border-radius:16px;padding:28px;box-shadow:0 18px 40px rgba(17,24,39,.08);}"
        f".badge{{display:inline-block;background:{accent};color:#fff;border-radius:999px;"
        "padding:6px 10px;font-size:12px;font-weight:700;"
        "letter-spacing:.04em;text-transform:uppercase;}}"
        "h1{margin:16px 0 10px;font-size:28px;}"
        "p{line-height:1.6;font-size:16px;color:#374151;}"
        "</style></head><body><div class='card'>"
        f"<span class='badge'>{badge}</span><h1>{safe_title}</h1><p>{safe_message}</p>"
        "</div></body></html>"
    )
    return body.encode("utf-8")


def build_oauth_start_redirect(
    oauth_state: str,
    state_path: str,
    *,
    load_session_fn: Callable[
        [str, str, str], OauthLinkSession | None
    ] = load_oauth_link_session_by_state,
    load_config_fn: Callable[[str], object] = load_config,
    runame_fn: Callable[[str], str] = oauth_runame,
) -> str:
    session = load_session_fn(state_path, oauth_state, "ebay")
    if session is None:
        raise ConfigurationError("Sessione OAuth non trovata.")
    if session.status != "pending":
        raise ConfigurationError("La sessione OAuth non e' piu' disponibile.")
    if session_is_expired(session):
        raise ConfigurationError("La sessione OAuth e' scaduta. Usa di nuovo /connect.")

    config = load_config_fn(session.environment)
    assert hasattr(config, "environment")
    assert hasattr(config, "client_id")
    assert hasattr(config, "scopes")
    return build_user_consent_url(
        config,
        redirect_uri=runame_fn(session.environment),
        state=session.oauth_state,
    )


def complete_oauth_link(
    oauth_state: str,
    code: str,
    *,
    telegram_config: TelegramConfig,
    load_session_fn: Callable[
        [str, str, str], OauthLinkSession | None
    ] = load_oauth_link_session_by_state,
    load_config_fn: Callable[[str], object] = load_config,
    callback_url_fn: Callable[[], str] = oauth_callback_url,
    runame_fn: Callable[[str], str] = oauth_runame,
    exchange_code_fn: Callable[[object, str, str], dict] = mint_authorization_code_token_response,
    encode_refresh_token_fn: Callable[[str], str | None] = encode_refresh_token,
    send_message_fn: Callable[..., None] = send_message,
) -> OAuthCallbackResult:
    session = load_session_fn(telegram_config.state_path, oauth_state, "ebay")
    if session is None:
        raise ConfigurationError("Sessione OAuth non trovata.")
    if session.status != "pending":
        raise ConfigurationError("La sessione OAuth non e' piu' disponibile.")
    if session_is_expired(session):
        update_oauth_link_session(telegram_config.state_path, oauth_state, status="expired")
        raise ConfigurationError("La sessione OAuth e' scaduta. Usa di nuovo /connect.")

    callback_url = callback_url_fn()
    update_oauth_link_session(
        telegram_config.state_path,
        oauth_state,
        redirect_uri=callback_url,
    )

    config = load_config_fn(session.environment)
    token_payload = exchange_code_fn(config, code, runame_fn(session.environment))
    refresh_token = str(token_payload.get("refresh_token", "") or "")
    encrypted_refresh_token = encode_refresh_token_fn(refresh_token)
    if not encrypted_refresh_token:
        raise ConfigurationError(
            "Impossibile salvare il refresh token tenant: configura la cifratura "
            "o abilita il fallback plaintext per la beta privata."
        )

    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    expires_at = None
    expires_in_raw = token_payload.get("expires_in")
    if expires_in_raw is not None:
        expires_at = (
            (datetime.now(timezone.utc) + timedelta(seconds=max(30, int(expires_in_raw))))
            .isoformat()
            .replace("+00:00", "Z")
        )

    ebay_user_id = str(token_payload.get("username") or token_payload.get("ebay_user_id") or "")
    if not ebay_user_id:
        ebay_user_id = f"ebay-user-{session.telegram_user_id}"

    upsert_linked_ebay_account(
        telegram_config.state_path,
        LinkedEbayAccount(
            telegram_user_id=session.telegram_user_id,
            ebay_user_id=ebay_user_id,
            environment=session.environment,
            scopes=str(token_payload.get("scope") or config.scopes),
            linked_at=timestamp,
            status="linked",
        ),
    )
    account = resolve_linked_ebay_account(
        telegram_config.state_path,
        session.telegram_user_id,
        session.environment,
    )
    if account is None or account.id is None:
        raise ConfigurationError("Impossibile risolvere l'account eBay collegato dopo OAuth.")

    upsert_ebay_token_set(
        telegram_config.state_path,
        EbayTokenSet(
            ebay_account_id=account.id,
            refresh_token_encrypted=encrypted_refresh_token,
            access_token=str(token_payload.get("access_token", "") or ""),
            scope_set=str(token_payload.get("scope") or config.scopes),
            expires_at=expires_at,
            updated_at=timestamp,
            status="active",
        ),
    )
    update_oauth_link_session(telegram_config.state_path, oauth_state, status="completed")
    send_message_fn(
        telegram_config.token,
        session.telegram_chat_id,
        (
            "✅ <b>Account eBay collegato</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🪪 Account: <code>{html.escape(ebay_user_id)}</code>\n"
            f"🌍 Ambiente: <code>{html.escape(session.environment)}</code>\n"
            "Ora puoi usare <code>/account</code> per controllare lo stato."
        ),
    )
    return OAuthCallbackResult(
        telegram_chat_id=session.telegram_chat_id,
        telegram_user_id=session.telegram_user_id,
        environment=session.environment,
        ebay_user_id=ebay_user_id,
        account_status="linked",
    )


class OAuthHandler(BaseHTTPRequestHandler):
    server_version = "eBayCFOAuth/0.1"

    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/healthz":
            self._write_response(HTTPStatus.OK, b"ok", "text/plain; charset=utf-8")
            return

        params = urllib.parse.parse_qs(parsed.query)
        if parsed.path.endswith("/start"):
            self._handle_start(params)
            return
        if parsed.path.endswith("/callback"):
            self._handle_callback(params)
            return

        self._write_response(
            HTTPStatus.NOT_FOUND,
            render_html_page(
                "Risorsa non trovata", "Percorso OAuth non riconosciuto.", is_error=True
            ),
        )

    def _handle_start(self, params: dict[str, list[str]]) -> None:
        oauth_state = (params.get("state") or [""])[0]
        try:
            redirect_url = build_oauth_start_redirect(
                oauth_state, self.server.telegram_config.state_path
            )  # type: ignore[attr-defined]
        except Exception as exc:
            log_event(LOGGER, logging.ERROR, "oauth_start_failed", error=exc, state=oauth_state)
            self._write_response(
                HTTPStatus.BAD_REQUEST,
                render_html_page("Collegamento non disponibile", str(exc), is_error=True),
            )
            return

        self.send_response(HTTPStatus.FOUND)
        self.send_header("Location", redirect_url)
        self.end_headers()

    def _handle_callback(self, params: dict[str, list[str]]) -> None:
        oauth_state = (params.get("state") or [""])[0]
        error_value = (params.get("error") or [""])[0]
        if error_value:
            update_oauth_link_session(
                self.server.telegram_config.state_path,  # type: ignore[attr-defined]
                oauth_state,
                status="failed",
            )
            self._write_response(
                HTTPStatus.BAD_REQUEST,
                render_html_page(
                    "Autorizzazione annullata",
                    f"eBay ha restituito l'errore: {error_value}",
                    is_error=True,
                ),
            )
            return

        code = (params.get("code") or [""])[0]
        try:
            result = complete_oauth_link(
                oauth_state,
                code,
                telegram_config=self.server.telegram_config,  # type: ignore[attr-defined]
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
            update_oauth_link_session(
                self.server.telegram_config.state_path,  # type: ignore[attr-defined]
                oauth_state,
                status="failed",
            )
            log_event(LOGGER, logging.ERROR, "oauth_callback_failed", error=exc, state=oauth_state)
            self._write_response(
                HTTPStatus.BAD_REQUEST,
                render_html_page("Collegamento fallito", str(exc), is_error=True),
            )
            return

        self._write_response(
            HTTPStatus.OK,
            render_html_page(
                "Collegamento riuscito",
                "Puoi tornare su Telegram: il bot ha gia' confermato il collegamento.",
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
    server = ThreadingHTTPServer((host, port), OAuthHandler)
    server.telegram_config = telegram_config  # type: ignore[attr-defined]
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
