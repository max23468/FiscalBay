"""Configuration loading helpers."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass

from .errors import ConfigurationError
from .models import Config, TelegramConfig

DEFAULT_SCOPE = "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly"
DEFAULT_ALLOWED_CHAT_IDS = "TELEGRAM_ALLOWED_CHAT_IDS"
DEFAULT_NOTIFY_CHAT_IDS = "TELEGRAM_NOTIFY_CHAT_IDS"
DEFAULT_STATE_PATH = "data/state.db"
DEFAULT_RETRY_QUEUE_PATH = "data/state.db"
DEFAULT_LOCK_PATH = "data/telegram_bot.lock"
DEFAULT_AUDIT_RETENTION_DAYS = 180
DEFAULT_OAUTH_SESSION_RETENTION_DAYS = 30
DEFAULT_OAUTH_PENDING_RETENTION_DAYS = 7
DEFAULT_OPERATION_QUEUE_RETENTION_DAYS = 30


@dataclass(frozen=True)
class RetentionConfig:
    audit_retention_days: int = DEFAULT_AUDIT_RETENTION_DAYS
    oauth_session_retention_days: int = DEFAULT_OAUTH_SESSION_RETENTION_DAYS
    oauth_pending_retention_days: int = DEFAULT_OAUTH_PENDING_RETENTION_DAYS
    operation_queue_retention_days: int = DEFAULT_OPERATION_QUEUE_RETENTION_DAYS


def configure_logging(default_level: str = "INFO") -> None:
    if logging.getLogger().handlers:
        return
    level_name = os.getenv("LOG_LEVEL", default_level).upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)sZ | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )


def get_env_text(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def require_env_text(name: str) -> str:
    value = get_env_text(name)
    if not value:
        raise ConfigurationError(f"Variabile ambiente mancante: {name}")
    return value


def get_env_int(name: str, default: int, *, min_value: int | None = None) -> int:
    raw_value = get_env_text(name)
    if not raw_value:
        parsed = default
    else:
        try:
            parsed = int(raw_value)
        except ValueError as exc:
            raise ConfigurationError(
                f"Variabile ambiente {name} non valida: atteso intero, ricevuto {raw_value!r}"
            ) from exc
    if min_value is not None and parsed < min_value:
        return min_value
    return parsed


def get_env_optional_int(name: str) -> int | None:
    raw_value = get_env_text(name)
    if not raw_value:
        return None
    try:
        return int(raw_value)
    except ValueError as exc:
        raise ConfigurationError(
            f"Variabile ambiente {name} non valida: atteso intero, ricevuto {raw_value!r}"
        ) from exc


def get_env_int_set(
    name: str,
    default: str = "",
    *,
    allow_wildcard: bool = False,
) -> set[int] | None:
    raw_value = get_env_text(name, default)
    if allow_wildcard and raw_value.lower() in {"*", "all"}:
        return None
    values: set[int] = set()
    for raw_item in raw_value.split(","):
        item = raw_item.strip()
        if not item:
            continue
        try:
            values.add(int(item))
        except ValueError as exc:
            raise ConfigurationError(
                f"Variabile ambiente {name} non valida: {item!r} non e' un intero"
            ) from exc
    return values


def load_retention_config() -> RetentionConfig:
    return RetentionConfig(
        audit_retention_days=get_env_int(
            "FISCALBAY_AUDIT_RETENTION_DAYS",
            DEFAULT_AUDIT_RETENTION_DAYS,
            min_value=1,
        ),
        oauth_session_retention_days=get_env_int(
            "FISCALBAY_OAUTH_SESSION_RETENTION_DAYS",
            DEFAULT_OAUTH_SESSION_RETENTION_DAYS,
            min_value=1,
        ),
        oauth_pending_retention_days=get_env_int(
            "FISCALBAY_OAUTH_PENDING_RETENTION_DAYS",
            DEFAULT_OAUTH_PENDING_RETENTION_DAYS,
            min_value=1,
        ),
        operation_queue_retention_days=get_env_int(
            "FISCALBAY_OPERATION_QUEUE_RETENTION_DAYS",
            DEFAULT_OPERATION_QUEUE_RETENTION_DAYS,
            min_value=1,
        ),
    )


def load_config(environment: str) -> Config:
    missing = [
        name
        for name in ("EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET", "EBAY_REFRESH_TOKEN")
        if not os.getenv(name)
    ]
    if missing:
        raise ConfigurationError("Variabili ambiente mancanti: " + ", ".join(missing))
    return Config(
        client_id=os.environ["EBAY_CLIENT_ID"],
        client_secret=os.environ["EBAY_CLIENT_SECRET"],
        refresh_token=os.environ["EBAY_REFRESH_TOKEN"],
        environment=environment,
        scopes=os.getenv("EBAY_SCOPES", DEFAULT_SCOPE),
    )


def load_config_with_refresh_token(environment: str, refresh_token: str) -> Config:
    if not refresh_token:
        raise ConfigurationError("Refresh token tenant mancante.")
    missing = [name for name in ("EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET") if not os.getenv(name)]
    if missing:
        raise ConfigurationError("Variabili ambiente mancanti: " + ", ".join(missing))
    return Config(
        client_id=os.environ["EBAY_CLIENT_ID"],
        client_secret=os.environ["EBAY_CLIENT_SECRET"],
        refresh_token=refresh_token,
        environment=environment,
        scopes=os.getenv("EBAY_SCOPES", DEFAULT_SCOPE),
    )


def load_telegram_config() -> TelegramConfig:
    token = require_env_text("TELEGRAM_BOT_TOKEN")
    raw_chat_ids = get_env_text(DEFAULT_ALLOWED_CHAT_IDS)
    allowed_chat_ids = get_env_int_set(
        DEFAULT_ALLOWED_CHAT_IDS,
        allow_wildcard=True,
    )
    raw_notify_chat_ids = get_env_text(DEFAULT_NOTIFY_CHAT_IDS, raw_chat_ids)
    notify_chat_ids: set[int]
    if raw_notify_chat_ids.lower() in {"*", "all"}:
        notify_chat_ids = set()
    else:
        parsed_notify_chat_ids = get_env_int_set(
            DEFAULT_NOTIFY_CHAT_IDS,
            raw_chat_ids,
            allow_wildcard=False,
        )
        notify_chat_ids = parsed_notify_chat_ids or set()
        if parsed_notify_chat_ids is None:
            notify_chat_ids = set()

    timeout = get_env_int("TELEGRAM_POLL_TIMEOUT", 30, min_value=1)
    ebay_poll_interval = get_env_int("EBAY_ORDER_POLL_INTERVAL", 120, min_value=30)
    admin_user_id = get_env_optional_int("TELEGRAM_ADMIN_USER_ID")

    return TelegramConfig(
        token=token,
        allowed_chat_ids=allowed_chat_ids,
        notify_chat_ids=notify_chat_ids,
        admin_user_id=admin_user_id,
        poll_timeout_seconds=timeout,
        ebay_poll_interval_seconds=ebay_poll_interval,
        state_path=get_env_text("EBAY_ORDER_STATE_PATH", DEFAULT_STATE_PATH),
        retry_queue_path=get_env_text("EBAY_NOTIFY_RETRY_PATH", DEFAULT_RETRY_QUEUE_PATH),
        lock_path=get_env_text("TELEGRAM_BOT_LOCK_PATH", DEFAULT_LOCK_PATH),
    )
