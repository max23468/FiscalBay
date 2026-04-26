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

from .bot_messaging import send_message
from .clients.ebay import (
    DEFAULT_IDENTITY_SCOPE,
    build_user_consent_url,
    get_authenticated_user_profile,
    merge_scopes,
    request_authorization_code_token_response,
)
from .config import load_config, load_telegram_config
from .errors import ConfigurationError, EbayApiError
from .logging_utils import log_event
from .models import (
    EBAY_ACCOUNT_STATUS_LINKED,
    OAUTH_SESSION_STATUS_COMPLETED,
    OAUTH_SESSION_STATUS_EXPIRED,
    OAUTH_SESSION_STATUS_FAILED,
    OAUTH_SESSION_STATUS_PENDING,
    AuditLogEntry,
    EbayTokenSet,
    LinkedEbayAccount,
    OauthLinkSession,
    TelegramConfig,
    normalize_oauth_session_status,
)
from .storage.sqlite import (
    append_audit_log_entry,
    load_oauth_link_session_by_state,
    resolve_linked_ebay_account,
    save_tenant_account_status_cache,
    summarize_tenant_account_status,
    update_oauth_link_session,
    upsert_ebay_token_set,
    upsert_linked_ebay_account,
)
from .tenant_credentials import encode_refresh_token

LOGGER = logging.getLogger("fiscalbay.oauth_server")
DEFAULT_OAUTH_HOST = "127.0.0.1"
DEFAULT_OAUTH_PORT = 8787
DEFAULT_CALLBACK_PATH = "/oauth/callback"


def append_oauth_audit_log(
    telegram_config: TelegramConfig,
    *,
    event_type: str,
    created_at: str,
    actor_telegram_user_id: int | None = None,
    target_telegram_user_id: int | None = None,
    telegram_chat_id: int | None = None,
    ebay_user_id: str = "",
    environment: str = "",
    outcome: str = "",
    details_json: str = "",
) -> None:
    append_audit_log_entry(
        telegram_config.state_path,
        AuditLogEntry(
            event_type=event_type,
            created_at=created_at,
            actor_telegram_user_id=actor_telegram_user_id,
            target_telegram_user_id=target_telegram_user_id,
            telegram_chat_id=telegram_chat_id,
            ebay_user_id=ebay_user_id,
            environment=environment,
            outcome=outcome,
            details_json=details_json,
        ),
    )


@dataclass
class OAuthCallbackResult:
    telegram_chat_id: int
    telegram_user_id: int
    environment: str
    ebay_user_id: str
    account_status: str


@dataclass
class OAuthFailurePresentation:
    title: str
    message: str
    outcome: str
    notify_text: str


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


def render_action_html_page(
    title: str,
    message: str,
    *,
    is_error: bool = False,
    action_label: str = "",
    action_url: str = "",
    hint: str = "",
    auto_redirect_seconds: int | None = None,
) -> bytes:
    accent = "#9a3412" if is_error else "#166534"
    badge = "Errore" if is_error else "OK"
    safe_title = html.escape(title)
    safe_message = html.escape(message)
    safe_hint = html.escape(hint)
    safe_action_label = html.escape(action_label)
    safe_action_url = html.escape(action_url, quote=True)
    meta_refresh = ""
    refresh_hint = ""
    if auto_redirect_seconds is not None and action_url:
        meta_refresh = (
            f"<meta http-equiv='refresh' content='{max(0, int(auto_redirect_seconds))};"
            f"url={safe_action_url}'>"
        )
        refresh_hint = (
            "<p class='muted'>Se non succede nulla automaticamente, usa il pulsante qui sotto.</p>"
        )
    action_block = ""
    if action_label and action_url:
        action_block = (
            f"<p><a class='button' href='{safe_action_url}'>{safe_action_label}</a></p>"
            f"{refresh_hint}"
        )
    hint_block = f"<p class='muted'>{safe_hint}</p>" if safe_hint else ""
    body = (
        "<!doctype html><html lang='it'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        f"{meta_refresh}"
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
        ".muted{font-size:14px;color:#6b7280;}"
        ".button{display:inline-block;background:#111827;color:#fff;text-decoration:none;"
        "padding:12px 18px;border-radius:12px;font-weight:700;}"
        "</style></head><body><div class='card'>"
        f"<span class='badge'>{badge}</span><h1>{safe_title}</h1><p>{safe_message}</p>"
        f"{action_block}{hint_block}</div></body></html>"
    )
    return body.encode("utf-8")


def render_oauth_start_page(redirect_url: str) -> bytes:
    return render_action_html_page(
        "Continua con eBay",
        (
            "Stai per essere reindirizzato alla pagina di autorizzazione eBay. "
            "Completa il consenso nello stesso browser e poi torna pure su Telegram."
        ),
        action_label="Continua su eBay",
        action_url=redirect_url,
        hint=("Se chiudi questa pagina prima del consenso, il collegamento non verra' completato."),
        auto_redirect_seconds=0,
    )


def describe_provider_error(error_value: str) -> OAuthFailurePresentation:
    normalized = error_value.strip().lower()
    if normalized in {"access_denied", "user_canceled", "user_cancelled"}:
        return OAuthFailurePresentation(
            title="Autorizzazione annullata",
            message=(
                "L'autorizzazione eBay e' stata annullata prima del completamento. "
                "Torna su Telegram e usa di nuovo /connect se vuoi riprovare."
            ),
            outcome="user_cancelled",
            notify_text=(
                "⚠️ <b>Collegamento eBay non completato</b>\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "L'autorizzazione e' stata annullata prima del completamento.\n"
                "Usa <code>/connect</code> se vuoi riprovare."
            ),
        )
    if normalized in {"invalid_scope", "unauthorized_client"}:
        return OAuthFailurePresentation(
            title="Collegamento non disponibile",
            message=(
                "eBay ha rifiutato la richiesta di autorizzazione per un problema di "
                "configurazione del servizio. Riprova piu' tardi o contatta l'admin."
            ),
            outcome="provider_configuration_error",
            notify_text=(
                "⚠️ <b>Collegamento eBay non disponibile</b>\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "eBay ha rifiutato la richiesta per un problema di configurazione del servizio.\n"
                "Non dipende dal tuo account: riprova piu' tardi."
            ),
        )
    return OAuthFailurePresentation(
        title="Autorizzazione non completata",
        message=(
            "eBay non ha completato l'autorizzazione richiesta. "
            f"Codice restituito: {error_value or 'n/d'}. "
            "Torna su Telegram e usa /connect per riprovare."
        ),
        outcome="provider_error",
        notify_text=(
            "⚠️ <b>Collegamento eBay non completato</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "eBay non ha completato l'autorizzazione richiesta.\n"
            "Usa <code>/connect</code> per riprovare."
        ),
    )


def describe_callback_exception(exc: Exception) -> OAuthFailurePresentation:
    message = str(exc)
    if isinstance(exc, ConfigurationError):
        if "scaduta" in message.lower():
            return OAuthFailurePresentation(
                title="Sessione scaduta",
                message=(
                    "La sessione di collegamento e' scaduta prima del completamento. "
                    "Torna su Telegram e usa di nuovo /connect."
                ),
                outcome="session_expired",
                notify_text=(
                    "⚠️ <b>Sessione OAuth scaduta</b>\n"
                    "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                    "Il collegamento non e' stato completato in tempo.\n"
                    "Usa <code>/connect</code> per aprire una nuova sessione."
                ),
            )
        if "non trovata" in message.lower() or "non e' piu' disponibile" in message.lower():
            return OAuthFailurePresentation(
                title="Link non piu' valido",
                message=(
                    "Il link di collegamento non e' piu' valido o non e' piu' disponibile. "
                    "Torna su Telegram e usa /connect per generarne uno nuovo."
                ),
                outcome="session_unavailable",
                notify_text=(
                    "⚠️ <b>Link di collegamento non piu' valido</b>\n"
                    "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                    "La sessione OAuth non e' piu' disponibile.\n"
                    "Usa <code>/connect</code> per generarne una nuova."
                ),
            )
        return OAuthFailurePresentation(
            title="Collegamento non disponibile",
            message=(
                "Il servizio non ha potuto completare il collegamento per un problema di "
                "configurazione o salvataggio. Riprova piu' tardi o contatta l'admin."
            ),
            outcome="service_configuration_error",
            notify_text=(
                "⚠️ <b>Collegamento eBay non disponibile</b>\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Il servizio non ha potuto completare il collegamento per un problema tecnico.\n"
                "Non dipende dal tuo account: riprova piu' tardi."
            ),
        )
    if isinstance(exc, EbayApiError):
        return OAuthFailurePresentation(
            title="Errore temporaneo eBay",
            message=(
                "eBay non ha completato correttamente il callback o lo scambio token. "
                "Riprova piu' tardi da Telegram con /connect."
            ),
            outcome="provider_runtime_error",
            notify_text=(
                "⚠️ <b>Errore temporaneo durante il collegamento</b>\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "eBay non ha completato correttamente il callback o lo scambio token.\n"
                "Usa <code>/connect</code> per riprovare piu' tardi."
            ),
        )
    return OAuthFailurePresentation(
        title="Collegamento fallito",
        message=(
            "Il collegamento non e' stato completato per un errore inatteso del servizio. "
            "Riprova piu' tardi da Telegram con /connect."
        ),
        outcome="callback_error",
        notify_text=(
            "⚠️ <b>Collegamento eBay fallito</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Il servizio ha incontrato un errore inatteso durante il callback.\n"
            "Usa <code>/connect</code> per riprovare piu' tardi."
        ),
    )


def oauth_consent_config(config: object) -> object:
    assert hasattr(config, "client_id")
    assert hasattr(config, "client_secret")
    assert hasattr(config, "refresh_token")
    assert hasattr(config, "environment")
    assert hasattr(config, "scopes")
    consent_scopes = merge_scopes(str(config.scopes), DEFAULT_IDENTITY_SCOPE)
    return type(config)(
        client_id=config.client_id,
        client_secret=config.client_secret,
        refresh_token=config.refresh_token,
        environment=config.environment,
        scopes=consent_scopes,
    )


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
    if normalize_oauth_session_status(session.status) != OAUTH_SESSION_STATUS_PENDING:
        raise ConfigurationError("La sessione OAuth non e' piu' disponibile.")
    if session_is_expired(session):
        raise ConfigurationError("La sessione OAuth e' scaduta. Usa di nuovo /connect.")

    config = oauth_consent_config(load_config_fn(session.environment))
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
    exchange_code_fn: Callable[
        [object, str, str], dict
    ] = request_authorization_code_token_response,
    fetch_user_profile_fn: Callable[[object, str], dict] = get_authenticated_user_profile,
    encode_refresh_token_fn: Callable[[str], str | None] = encode_refresh_token,
    send_message_fn: Callable[..., None] = send_message,
) -> OAuthCallbackResult:
    session = load_session_fn(telegram_config.state_path, oauth_state, "ebay")
    if session is None:
        raise ConfigurationError("Sessione OAuth non trovata.")
    if normalize_oauth_session_status(session.status) != OAUTH_SESSION_STATUS_PENDING:
        raise ConfigurationError("La sessione OAuth non e' piu' disponibile.")
    if session_is_expired(session):
        update_oauth_link_session(
            telegram_config.state_path,
            oauth_state,
            status=OAUTH_SESSION_STATUS_EXPIRED,
        )
        raise ConfigurationError("La sessione OAuth e' scaduta. Usa di nuovo /connect.")

    callback_url = callback_url_fn()
    update_oauth_link_session(
        telegram_config.state_path,
        oauth_state,
        redirect_uri=callback_url,
    )

    config = oauth_consent_config(load_config_fn(session.environment))
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

    access_token = str(token_payload.get("access_token", "") or "")
    ebay_user_id = str(token_payload.get("username") or token_payload.get("ebay_user_id") or "")
    if access_token:
        try:
            user_profile = fetch_user_profile_fn(config, access_token)
        except EbayApiError as exc:
            log_event(
                LOGGER,
                logging.WARNING,
                "oauth_identity_lookup_failed",
                environment=session.environment,
                status_code=exc.status_code,
                error=exc,
            )
        else:
            ebay_user_id = str(
                user_profile.get("username")
                or user_profile.get("userId")
                or user_profile.get("user_id")
                or ebay_user_id
            )
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
            status=EBAY_ACCOUNT_STATUS_LINKED,
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
            access_token=access_token,
            scope_set=str(token_payload.get("scope") or config.scopes),
            expires_at=expires_at,
            updated_at=timestamp,
            status="active",
        ),
    )
    update_oauth_link_session(
        telegram_config.state_path,
        oauth_state,
        status=OAUTH_SESSION_STATUS_COMPLETED,
    )
    append_oauth_audit_log(
        telegram_config,
        event_type="oauth_success",
        created_at=timestamp,
        actor_telegram_user_id=session.telegram_user_id,
        target_telegram_user_id=session.telegram_user_id,
        telegram_chat_id=session.telegram_chat_id,
        ebay_user_id=ebay_user_id,
        environment=session.environment,
        outcome="linked",
        details_json=str(token_payload.get("scope") or config.scopes),
    )
    save_tenant_account_status_cache(
        telegram_config.state_path,
        session.telegram_user_id,
        {
            "linked": True,
            "environment": session.environment,
            "ebay_user_id": ebay_user_id,
            "account_status": "linked",
            "token_status": "active",
            "token_configured": True,
            "latest_reconnect_outcome": "linked",
            "latest_reconnect_reason": "",
        },
    )
    send_message_fn(
        telegram_config.token,
        session.telegram_chat_id,
        (
            "✅ <b>Account eBay collegato</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🪪 Account: <code>{html.escape(ebay_user_id)}</code>\n"
            f"🌍 Ambiente: <code>{html.escape(session.environment)}</code>\n"
            "Ora puoi usare <code>/account</code> per controllare lo stato,\n"
            "<code>/settings</code> per verificare la chat e "
            "<code>/ultimi</code> per controllare gli ordini recenti."
        ),
    )
    return OAuthCallbackResult(
        telegram_chat_id=session.telegram_chat_id,
        telegram_user_id=session.telegram_user_id,
        environment=session.environment,
        ebay_user_id=ebay_user_id,
        account_status=EBAY_ACCOUNT_STATUS_LINKED,
    )


class OAuthHandler(BaseHTTPRequestHandler):
    server_version = "FiscalBayOAuth/0.1"

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
        self._write_response(HTTPStatus.OK, render_oauth_start_page(redirect_url))

    def _handle_callback(self, params: dict[str, list[str]]) -> None:
        oauth_state = (params.get("state") or [""])[0]
        error_value = (params.get("error") or [""])[0]
        session = load_oauth_link_session_by_state(
            self.server.telegram_config.state_path,  # type: ignore[attr-defined]
            oauth_state,
            "ebay",
        )
        if error_value:
            presentation = describe_provider_error(error_value)
            append_oauth_audit_log(
                self.server.telegram_config,  # type: ignore[attr-defined]
                event_type="oauth_failure",
                created_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                actor_telegram_user_id=session.telegram_user_id if session is not None else None,
                target_telegram_user_id=session.telegram_user_id if session is not None else None,
                telegram_chat_id=session.telegram_chat_id if session is not None else None,
                environment=session.environment if session is not None else "",
                outcome=presentation.outcome,
                details_json=error_value,
            )
            if session is not None:
                update_oauth_link_session(
                    self.server.telegram_config.state_path,  # type: ignore[attr-defined]
                    oauth_state,
                    status=OAUTH_SESSION_STATUS_FAILED,
                )
                summarize_tenant_account_status(
                    self.server.telegram_config.state_path,  # type: ignore[attr-defined]
                    session.telegram_user_id,
                    session.environment,
                )
                send_message(
                    self.server.telegram_config.token,  # type: ignore[attr-defined]
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
            presentation = describe_callback_exception(exc)
            append_oauth_audit_log(
                self.server.telegram_config,  # type: ignore[attr-defined]
                event_type="oauth_failure",
                created_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                actor_telegram_user_id=session.telegram_user_id if session is not None else None,
                target_telegram_user_id=session.telegram_user_id if session is not None else None,
                telegram_chat_id=session.telegram_chat_id if session is not None else None,
                environment=session.environment if session is not None else "",
                outcome=presentation.outcome,
                details_json=str(exc),
            )
            if session is not None:
                update_oauth_link_session(
                    self.server.telegram_config.state_path,  # type: ignore[attr-defined]
                    oauth_state,
                    status=OAUTH_SESSION_STATUS_FAILED,
                )
                summarize_tenant_account_status(
                    self.server.telegram_config.state_path,  # type: ignore[attr-defined]
                    session.telegram_user_id,
                    session.environment,
                )
                send_message(
                    self.server.telegram_config.token,  # type: ignore[attr-defined]
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
            self.server.telegram_config.state_path,  # type: ignore[attr-defined]
            result.telegram_user_id,
            result.environment,
        )
        self._write_response(
            HTTPStatus.OK,
            render_action_html_page(
                "Collegamento riuscito",
                (
                    "Puoi tornare su Telegram: il bot ha gia' confermato il collegamento "
                    "e ti aspetta li'."
                ),
                action_label="Apri Telegram",
                action_url="https://t.me/",
                hint="Se l'app Telegram e' gia' aperta, puoi semplicemente chiudere questa pagina.",
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
