"""OAuth callback responsibilities."""

from __future__ import annotations

import html
import logging
import os
import urllib.parse
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from typing import Callable

from .bot_messaging import send_message
from .clients.ebay import (
    DEFAULT_IDENTITY_SCOPE,
    JsonObject,
    OAuthTokenResponse,
    build_user_consent_url,
    get_authenticated_user_profile,
    merge_scopes,
    request_authorization_code_token_response,
)
from .config import load_config
from .errors import ConfigurationError, EbayApiError
from .logging_utils import log_event
from .models import (
    CAPABILITY_MANAGE_NOTIFICATIONS,
    EBAY_ACCOUNT_STATUS_LINKED,
    OAUTH_SESSION_STATUS_COMPLETED,
    OAUTH_SESSION_STATUS_EXPIRED,
    OAUTH_SESSION_STATUS_PENDING,
    AuditLogEntry,
    Config,
    EbayTokenSet,
    LinkedEbayAccount,
    OauthLinkSession,
    TelegramConfig,
    has_telegram_user_capability,
    normalize_oauth_session_status,
)
from .storage.notifications import set_notification_subscription_enabled
from .storage.oauth import load_oauth_link_session_by_state, update_oauth_link_session
from .storage.queues import append_audit_log_entry
from .storage.users import (
    load_telegram_chats,
    load_telegram_user,
    resolve_linked_ebay_account,
    save_tenant_account_status_cache,
    upsert_ebay_token_set,
    upsert_linked_ebay_account,
)
from .tenant_credentials import encode_refresh_token

LOGGER = logging.getLogger("fiscalbay.oauth_server")

DEFAULT_CALLBACK_PATH = "/oauth/callback"

DEFAULT_PUBLIC_BOT_URL = "https://t.me/fiscalbay_bot"


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


def public_bot_url() -> str:
    return (
        os.getenv("TELEGRAM_PUBLIC_BOT_URL", DEFAULT_PUBLIC_BOT_URL).strip()
        or DEFAULT_PUBLIC_BOT_URL
    )


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


def oauth_session_uses_private_chat(state_path: str, session: OauthLinkSession) -> bool:
    return any(
        chat.telegram_user_id == session.telegram_user_id
        and chat.telegram_chat_id == session.telegram_chat_id
        and chat.chat_type == "private"
        for chat in load_telegram_chats(state_path)
    )


def describe_provider_error(error_value: str) -> OAuthFailurePresentation:
    normalized = error_value.strip().lower()
    if normalized in {"access_denied", "user_canceled", "user_cancelled"}:
        return OAuthFailurePresentation(
            title="Autorizzazione annullata",
            message=(
                "L'autorizzazione eBay è stata annullata prima del completamento. "
                "Torna su Telegram e usa di nuovo /account collega se vuoi riprovare."
            ),
            outcome="user_cancelled",
            notify_text=(
                "⚠️ <b>Collegamento eBay non completato</b>\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "L'autorizzazione è stata annullata prima del completamento.\n"
                "Usa <code>/account collega</code> se vuoi riprovare."
            ),
        )
    if normalized in {"invalid_scope", "unauthorized_client"}:
        return OAuthFailurePresentation(
            title="Collegamento non disponibile",
            message=(
                "eBay ha rifiutato la richiesta di autorizzazione per un problema di "
                "configurazione del servizio. Riprova più tardi o contatta l'admin."
            ),
            outcome="provider_configuration_error",
            notify_text=(
                "⚠️ <b>Collegamento eBay non disponibile</b>\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "eBay ha rifiutato la richiesta per un problema di configurazione del servizio.\n"
                "Non dipende dal tuo account: riprova più tardi."
            ),
        )
    return OAuthFailurePresentation(
        title="Autorizzazione non completata",
        message=(
            "eBay non ha completato l'autorizzazione richiesta. "
            f"Codice restituito: {error_value or 'n/d'}. "
            "Torna su Telegram e usa /account collega per riprovare."
        ),
        outcome="provider_error",
        notify_text=(
            "⚠️ <b>Collegamento eBay non completato</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "eBay non ha completato l'autorizzazione richiesta.\n"
            "Usa <code>/account collega</code> per riprovare."
        ),
    )


def describe_callback_exception(exc: Exception) -> OAuthFailurePresentation:
    message = str(exc)
    if isinstance(exc, ConfigurationError):
        if "scaduta" in message.lower():
            return OAuthFailurePresentation(
                title="Sessione scaduta",
                message=(
                    "La sessione di collegamento è scaduta prima del completamento. "
                    "Torna su Telegram e usa di nuovo /account collega."
                ),
                outcome="session_expired",
                notify_text=(
                    "⚠️ <b>Sessione OAuth scaduta</b>\n"
                    "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                    "Il collegamento non è stato completato in tempo.\n"
                    "Usa <code>/account collega</code> per aprire una nuova sessione."
                ),
            )
        if "non trovata" in message.lower() or "non è più disponibile" in message.lower():
            return OAuthFailurePresentation(
                title="Link non più valido",
                message=(
                    "Il link di collegamento non è più valido o non è più disponibile. "
                    "Torna su Telegram e usa /account collega per generarne uno nuovo."
                ),
                outcome="session_unavailable",
                notify_text=(
                    "⚠️ <b>Link di collegamento non più valido</b>\n"
                    "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                    "La sessione OAuth non è più disponibile.\n"
                    "Usa <code>/account collega</code> per generarne una nuova."
                ),
            )
        return OAuthFailurePresentation(
            title="Collegamento non disponibile",
            message=(
                "Il servizio non ha potuto completare il collegamento per un problema di "
                "configurazione o salvataggio. Riprova più tardi o contatta l'admin."
            ),
            outcome="service_configuration_error",
            notify_text=(
                "⚠️ <b>Collegamento eBay non disponibile</b>\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Il servizio non ha potuto completare il collegamento per un problema tecnico.\n"
                "Non dipende dal tuo account: riprova più tardi."
            ),
        )
    if isinstance(exc, EbayApiError):
        return OAuthFailurePresentation(
            title="Errore temporaneo eBay",
            message=(
                "eBay non ha completato correttamente il callback o lo scambio token. "
                "Riprova più tardi da Telegram con /account collega."
            ),
            outcome="provider_runtime_error",
            notify_text=(
                "⚠️ <b>Errore temporaneo durante il collegamento</b>\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "eBay non ha completato correttamente il callback o lo scambio token.\n"
                "Usa <code>/account collega</code> per riprovare più tardi."
            ),
        )
    return OAuthFailurePresentation(
        title="Collegamento fallito",
        message=(
            "Il collegamento non è stato completato per un errore inatteso del servizio. "
            "Riprova più tardi da Telegram con /account collega."
        ),
        outcome="callback_error",
        notify_text=(
            "⚠️ <b>Collegamento eBay fallito</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Il servizio ha incontrato un errore inatteso durante il callback.\n"
            "Usa <code>/account collega</code> per riprovare più tardi."
        ),
    )


def oauth_consent_config(config: Config) -> Config:
    return replace(config, scopes=merge_scopes(config.scopes, DEFAULT_IDENTITY_SCOPE))


def build_oauth_start_redirect(
    oauth_state: str,
    state_path: str,
    *,
    load_session_fn: Callable[
        [str, str, str], OauthLinkSession | None
    ] = load_oauth_link_session_by_state,
    load_config_fn: Callable[[str], Config] = load_config,
    runame_fn: Callable[[str], str] = oauth_runame,
) -> str:
    session = load_session_fn(state_path, oauth_state, "ebay")
    if session is None:
        raise ConfigurationError("Sessione OAuth non trovata.")
    if normalize_oauth_session_status(session.status) != OAUTH_SESSION_STATUS_PENDING:
        raise ConfigurationError("La sessione OAuth non è più disponibile.")
    if session_is_expired(session):
        raise ConfigurationError("La sessione OAuth è scaduta. Usa di nuovo /account collega.")

    config = oauth_consent_config(load_config_fn(session.environment))
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
    load_config_fn: Callable[[str], Config] = load_config,
    callback_url_fn: Callable[[], str] = oauth_callback_url,
    runame_fn: Callable[[str], str] = oauth_runame,
    exchange_code_fn: Callable[
        [Config, str, str], OAuthTokenResponse
    ] = request_authorization_code_token_response,
    fetch_user_profile_fn: Callable[[Config, str], JsonObject] = get_authenticated_user_profile,
    encode_refresh_token_fn: Callable[[str], str | None] = encode_refresh_token,
    send_message_fn: Callable[..., None] = send_message,
) -> OAuthCallbackResult:
    session = load_session_fn(telegram_config.state_path, oauth_state, "ebay")
    if session is None:
        raise ConfigurationError("Sessione OAuth non trovata.")
    if normalize_oauth_session_status(session.status) != OAUTH_SESSION_STATUS_PENDING:
        raise ConfigurationError("La sessione OAuth non è più disponibile.")
    if session_is_expired(session):
        update_oauth_link_session(
            telegram_config.state_path,
            oauth_state,
            status=OAUTH_SESSION_STATUS_EXPIRED,
        )
        raise ConfigurationError("La sessione OAuth è scaduta. Usa di nuovo /account collega.")
    if not oauth_session_uses_private_chat(telegram_config.state_path, session):
        raise ConfigurationError("La sessione OAuth non proviene da una chat privata.")

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
    can_manage_notifications = False
    telegram_user = load_telegram_user(telegram_config.state_path, session.telegram_user_id)
    if telegram_user is not None:
        can_manage_notifications = has_telegram_user_capability(
            telegram_user.status,
            CAPABILITY_MANAGE_NOTIFICATIONS,
        )
    chat_exists = any(
        chat.telegram_user_id == session.telegram_user_id
        and chat.telegram_chat_id == session.telegram_chat_id
        and chat.chat_type == "private"
        for chat in load_telegram_chats(telegram_config.state_path)
    )
    if can_manage_notifications and chat_exists:
        set_notification_subscription_enabled(
            telegram_config.state_path,
            session.telegram_user_id,
            session.telegram_chat_id,
            True,
            created_at=timestamp,
            updated_at=timestamp,
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
            "<code>/ordini fiscali</code> per controllare gli ordini recenti."
        ),
    )
    return OAuthCallbackResult(
        telegram_chat_id=session.telegram_chat_id,
        telegram_user_id=session.telegram_user_id,
        environment=session.environment,
        ebay_user_id=ebay_user_id,
        account_status=EBAY_ACCOUNT_STATUS_LINKED,
    )
