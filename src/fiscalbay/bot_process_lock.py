"""Process lock helpers for the Telegram bot runtime."""

from __future__ import annotations

import logging
import os
from contextlib import suppress
from datetime import datetime, timezone
from typing import Any, TextIO

from .errors import TelegramApiError
from .logging_utils import log_event
from .storage.sqlite import ensure_parent_dir

_fcntl: Any
try:
    import fcntl as _fcntl
except ImportError:  # pragma: no cover - Windows
    _fcntl = None

fcntl: Any = _fcntl

LOGGER = logging.getLogger("fiscalbay.telegram_bot.lock")


def acquire_process_lock(lock_path: str) -> TextIO | None:
    if fcntl is None:
        log_event(
            LOGGER,
            logging.WARNING,
            "process_lock_unavailable",
            lock_path=lock_path,
            reason="fcntl_unavailable",
        )
        return None
    ensure_parent_dir(lock_path)
    handle = open(lock_path, "a+", encoding="utf-8")
    try:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        handle.seek(0)
        holder = handle.read().strip()
        handle.close()
        holder_details = f" ({holder})" if holder else ""
        raise TelegramApiError(
            "Un'altra istanza del bot è già in esecuzione (lock su "
            f"{lock_path}{holder_details}). Chiudi l'altra copia o imposta "
            "TELEGRAM_BOT_LOCK_PATH."
        ) from None
    try:
        os.chmod(lock_path, 0o600)
    except OSError:
        pass
    handle.seek(0)
    handle.truncate()
    handle.write(f"pid={os.getpid()}\nstarted_at={datetime.now(timezone.utc).isoformat()}\n")
    handle.flush()
    return handle


def release_process_lock(lock_handle: TextIO | None, lock_path: str) -> None:
    if lock_handle is None:
        return
    try:
        if fcntl is not None:
            fcntl.flock(lock_handle.fileno(), fcntl.LOCK_UN)
    except OSError:
        pass
    with suppress(OSError):
        lock_handle.close()
    with suppress(FileNotFoundError, OSError):
        os.remove(lock_path)
