"""OAuth linking helpers used by the Telegram command layer."""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone

from .models import OAUTH_SESSION_STATUS_PENDING, OauthLinkSession
from .storage.sqlite import create_oauth_link_session, load_latest_oauth_link_session


def is_reusable_oauth_session(
    session: OauthLinkSession | None,
    *,
    environment: str,
    now: datetime,
) -> bool:
    if session is None:
        return False
    if session.environment != environment:
        return False
    if session.status != OAUTH_SESSION_STATUS_PENDING:
        return False
    if not session.expires_at:
        return True
    try:
        expires_at = datetime.fromisoformat(session.expires_at.replace("Z", "+00:00"))
    except ValueError:
        return False
    return expires_at > now


def build_connect_entrypoint_url(oauth_state: str) -> str:
    base_url = os.getenv("EBAY_OAUTH_CONNECT_BASE_URL", "").strip()
    if not base_url:
        return ""
    separator = "&" if "?" in base_url else "?"
    return f"{base_url}{separator}state={oauth_state}"


def create_or_reuse_oauth_link_session(
    state_path: str,
    *,
    telegram_user_id: int,
    telegram_chat_id: int,
    environment: str,
    now: datetime | None = None,
) -> tuple[OauthLinkSession, bool]:
    current_time = now or datetime.now(timezone.utc)
    latest_session = load_latest_oauth_link_session(state_path, telegram_user_id)
    if latest_session is not None and is_reusable_oauth_session(
        latest_session,
        environment=environment,
        now=current_time,
    ):
        return latest_session, False
    created = create_oauth_link_session(
        state_path,
        OauthLinkSession(
            telegram_user_id=telegram_user_id,
            telegram_chat_id=telegram_chat_id,
            provider="ebay",
            environment=environment,
            oauth_state=secrets.token_urlsafe(18),
            status=OAUTH_SESSION_STATUS_PENDING,
            expires_at=(current_time + timedelta(minutes=15)).isoformat().replace("+00:00", "Z"),
            created_at=current_time.isoformat().replace("+00:00", "Z"),
        ),
    )
    return created, True
