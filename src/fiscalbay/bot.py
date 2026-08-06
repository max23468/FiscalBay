"""Telegram bot bot functions."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional, cast

from .bot_admin import maybe_send_admin_summary
from .bot_common import (
    _parse_iso_timestamp,
    send_message,
    sync_runtime_contact,
)
from .bot_dispatch import dispatch_message
from .bot_messaging import request_with_backoff
from .bot_orders import maybe_send_new_order_notifications
from .bot_process_lock import acquire_process_lock, release_process_lock
from .clients.telegram import (
    BotCommand,
    sync_bot_branding,
)
from .config import (
    configure_logging,
    load_telegram_config,
)
from .errors import TelegramApiError
from .logging_utils import log_event
from .models import (
    TelegramConfig,
)
from .services.telegram_runtime import (
    auto_notify_loop as _auto_notify_loop,
)
from .services.telegram_runtime import (
    request_shutdown as _request_shutdown,
)
from .services.telegram_runtime import (
    run_bot as _run_bot,
)
from .storage.runtime import (
    load_kv_value,
    save_kv_value,
)
from .telegram_commands import build_telegram_branding_profile


def _run_notification_cycle(telegram_config: TelegramConfig, ebay_environment: str) -> None:
    maybe_send_new_order_notifications(telegram_config, ebay_environment)
    maybe_send_admin_summary(telegram_config)


LOGGER = logging.getLogger("fiscalbay.telegram_bot")

DEFAULT_BRANDING_SYNC_BACKOFF_SECONDS = 6 * 60 * 60


def _branding_sync_enabled() -> bool:
    value = os.getenv("TELEGRAM_SYNC_BRANDING", "1").strip().lower()
    return value not in {"0", "false", "no", "off"}


def _branding_profile_hash(profile: dict[str, object]) -> str:
    serialized = json.dumps(profile, ensure_ascii=True, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _branding_profile_hash_key() -> str:
    return "branding_sync:profile_hash"


def _branding_sync_retry_at_key() -> str:
    return "branding_sync:retry_at"


def _extract_retry_after_seconds(error: TelegramApiError) -> int | None:
    if error.status_code != 429:
        return None
    match = re.search(r"\bretry[_ -]?after[_ =:]+(\d+)", str(error), flags=re.IGNORECASE)
    if match is None:
        return None
    return max(1, int(match.group(1)))


def sync_runtime_branding(telegram_config: TelegramConfig) -> None:
    if not _branding_sync_enabled():
        return
    branding_profile = build_telegram_branding_profile()
    commands = cast(list[BotCommand], branding_profile["commands"])
    profile_hash = _branding_profile_hash(branding_profile)
    stored_hash = load_kv_value(telegram_config.state_path, _branding_profile_hash_key())
    if stored_hash == profile_hash:
        log_event(LOGGER, logging.INFO, "telegram_branding_sync_skipped", reason="unchanged")
        return

    now = datetime.now(timezone.utc)
    retry_at_raw = load_kv_value(telegram_config.state_path, _branding_sync_retry_at_key())
    retry_at = _parse_iso_timestamp(retry_at_raw)
    if retry_at is not None and now < retry_at:
        log_event(
            LOGGER,
            logging.INFO,
            "telegram_branding_sync_skipped",
            reason="backoff_active",
            retry_at=retry_at.isoformat().replace("+00:00", "Z"),
        )
        return

    try:
        sync_bot_branding(
            telegram_config.token,
            name=str(branding_profile["name"]),
            short_description=str(branding_profile["short_description"]),
            description=str(branding_profile["description"]),
            commands=commands,
        )
        save_kv_value(telegram_config.state_path, _branding_profile_hash_key(), profile_hash)
        log_event(
            LOGGER,
            logging.INFO,
            "telegram_branding_synced",
            command_count=len(commands),
        )
    except TelegramApiError as exc:
        if exc.status_code == 429:
            retry_after_seconds = (
                _extract_retry_after_seconds(exc) or DEFAULT_BRANDING_SYNC_BACKOFF_SECONDS
            )
            retry_at = now + timedelta(seconds=retry_after_seconds)
            save_kv_value(
                telegram_config.state_path,
                _branding_sync_retry_at_key(),
                retry_at.isoformat().replace("+00:00", "Z"),
            )
        log_event(
            LOGGER,
            logging.WARNING,
            "telegram_branding_sync_failed",
            error=exc,
        )


def process_message(
    text: str,
    chat_id: int,
    telegram_config: TelegramConfig,
    ebay_environment: str,
    telegram_user_id: int | None = None,
) -> list[str]:
    return dispatch_message(
        text,
        chat_id,
        telegram_config,
        ebay_environment,
        telegram_user_id,
    )


def auto_notify_loop(telegram_config: TelegramConfig, ebay_environment: str) -> None:
    import threading

    _auto_notify_loop(
        telegram_config,
        ebay_environment,
        shutdown_event=threading.Event(),
        maybe_send_new_order_notifications_fn=_run_notification_cycle,
    )


def request_shutdown(signum: int, frame: Optional[object]) -> None:
    _request_shutdown(signum, frame)


def run_bot() -> int:
    return _run_bot(
        configure_logging_fn=configure_logging,
        load_telegram_config_fn=load_telegram_config,
        acquire_process_lock_fn=acquire_process_lock,
        release_process_lock_fn=release_process_lock,
        process_message_fn=process_message,
        register_runtime_contact_fn=sync_runtime_contact,
        send_message_fn=send_message,
        maybe_send_new_order_notifications_fn=_run_notification_cycle,
        request_with_backoff_fn=request_with_backoff,
        sync_bot_branding_fn=sync_runtime_branding,
    )


if __name__ == "__main__":
    raise SystemExit(run_bot())
