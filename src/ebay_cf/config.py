"""Configuration loading helpers."""

from __future__ import annotations

import logging
import os

from .errors import ConfigurationError
from .models import Config, TelegramConfig

DEFAULT_SCOPE = "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly"
DEFAULT_ALLOWED_CHAT_IDS = "TELEGRAM_ALLOWED_CHAT_IDS"
DEFAULT_NOTIFY_CHAT_IDS = "TELEGRAM_NOTIFY_CHAT_IDS"
DEFAULT_STATE_PATH = "data/state.db"
DEFAULT_RETRY_QUEUE_PATH = "data/state.db"
DEFAULT_LOCK_PATH = "data/telegram_bot.lock"


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
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        raise ConfigurationError("Variabile ambiente mancante: TELEGRAM_BOT_TOKEN")

    raw_chat_ids = os.getenv(DEFAULT_ALLOWED_CHAT_IDS, "").strip()
    allowed_chat_ids = {int(value.strip()) for value in raw_chat_ids.split(",") if value.strip()}

    raw_notify_chat_ids = os.getenv(DEFAULT_NOTIFY_CHAT_IDS, raw_chat_ids).strip()
    notify_chat_ids = {
        int(value.strip()) for value in raw_notify_chat_ids.split(",") if value.strip()
    }

    timeout = int(os.getenv("TELEGRAM_POLL_TIMEOUT", "30"))
    ebay_poll_interval = int(os.getenv("EBAY_ORDER_POLL_INTERVAL", "120"))
    admin_user_id_raw = os.getenv("TELEGRAM_ADMIN_USER_ID", "").strip()
    admin_user_id = int(admin_user_id_raw) if admin_user_id_raw else None

    return TelegramConfig(
        token=token,
        allowed_chat_ids=allowed_chat_ids,
        notify_chat_ids=notify_chat_ids,
        admin_user_id=admin_user_id,
        poll_timeout_seconds=max(1, timeout),
        ebay_poll_interval_seconds=max(30, ebay_poll_interval),
        state_path=os.getenv("EBAY_ORDER_STATE_PATH", DEFAULT_STATE_PATH),
        retry_queue_path=os.getenv("EBAY_NOTIFY_RETRY_PATH", DEFAULT_RETRY_QUEUE_PATH),
        lock_path=os.getenv("TELEGRAM_BOT_LOCK_PATH", DEFAULT_LOCK_PATH),
    )
