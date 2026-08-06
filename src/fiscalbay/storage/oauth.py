"""SQLite oauth storage functions."""

from __future__ import annotations

from ..models import (
    EBAY_ACCOUNT_STATUS_DISCONNECTED,
    OAUTH_SESSION_STATUS_CANCELLED,
    OAUTH_SESSION_STATUS_PENDING,
    LinkedEbayAccount,
    OauthLinkSession,
)
from .connection import _connect, init_db
from .users import resolve_linked_ebay_account


def create_oauth_link_session(path: str, session: OauthLinkSession) -> OauthLinkSession:
    init_db(path)
    with _connect(path) as conn:
        cursor = conn.execute(
            "INSERT INTO oauth_link_sessions "
            "("
            "telegram_user_id, telegram_chat_id, provider, environment, oauth_state, "
            "code_verifier, "
            "redirect_uri, status, expires_at, created_at"
            ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                session.telegram_user_id,
                session.telegram_chat_id,
                session.provider,
                session.environment,
                session.oauth_state,
                session.code_verifier,
                session.redirect_uri,
                session.status,
                session.expires_at,
                session.created_at,
            ),
        )
        if cursor.lastrowid is None:
            raise RuntimeError("Inserimento sessione OAuth fallito: lastrowid mancante.")
        session.id = int(cursor.lastrowid)
    return session


def load_latest_oauth_link_session(
    path: str,
    telegram_user_id: int,
    provider: str = "ebay",
) -> OauthLinkSession | None:
    init_db(path)
    with _connect(path) as conn:
        row = conn.execute(
            "SELECT id, telegram_user_id, telegram_chat_id, provider, environment, oauth_state, "
            "code_verifier, redirect_uri, status, expires_at, created_at "
            "FROM oauth_link_sessions "
            "WHERE telegram_user_id = ? AND provider = ? "
            "ORDER BY id DESC LIMIT 1",
            (telegram_user_id, provider),
        ).fetchone()
        if row is None:
            return None
    return OauthLinkSession.from_mapping(dict(row))


def load_oauth_link_session_by_state(
    path: str,
    oauth_state: str,
    provider: str = "ebay",
) -> OauthLinkSession | None:
    init_db(path)
    with _connect(path) as conn:
        row = conn.execute(
            "SELECT id, telegram_user_id, telegram_chat_id, provider, environment, oauth_state, "
            "code_verifier, redirect_uri, status, expires_at, created_at "
            "FROM oauth_link_sessions "
            "WHERE oauth_state = ? AND provider = ? "
            "LIMIT 1",
            (oauth_state, provider),
        ).fetchone()
        if row is None:
            return None
    return OauthLinkSession.from_mapping(dict(row))


def update_oauth_link_session(
    path: str,
    oauth_state: str,
    *,
    status: str | None = None,
    redirect_uri: str | None = None,
) -> None:
    init_db(path)
    assignments: list[str] = []
    params: list[object] = []
    if status is not None:
        assignments.append("status = ?")
        params.append(status)
    if redirect_uri is not None:
        assignments.append("redirect_uri = ?")
        params.append(redirect_uri)
    if not assignments:
        return
    params.append(oauth_state)
    with _connect(path) as conn:
        conn.execute(
            f"UPDATE oauth_link_sessions SET {', '.join(assignments)} WHERE oauth_state = ?",
            tuple(params),
        )


def disconnect_linked_ebay_account(
    path: str,
    telegram_user_id: int,
    environment: str | None = None,
) -> LinkedEbayAccount | None:
    account = resolve_linked_ebay_account(path, telegram_user_id, environment)
    if account is None or account.id is None:
        return None

    init_db(path)
    with _connect(path) as conn:
        conn.execute(
            "UPDATE ebay_accounts SET status = ? WHERE id = ?",
            (EBAY_ACCOUNT_STATUS_DISCONNECTED, account.id),
        )
        conn.execute(
            "UPDATE ebay_tokens "
            "SET refresh_token_encrypted = '', access_token = '', status = 'revoked', "
            "updated_at = CURRENT_TIMESTAMP "
            "WHERE ebay_account_id = ?",
            (account.id,),
        )
        conn.execute(
            "UPDATE oauth_link_sessions SET status = ? "
            "WHERE telegram_user_id = ? AND provider = 'ebay' AND status = ?",
            (OAUTH_SESSION_STATUS_CANCELLED, telegram_user_id, OAUTH_SESSION_STATUS_PENDING),
        )

    account.status = EBAY_ACCOUNT_STATUS_DISCONNECTED
    return account
