"""Application errors shared across modules."""

from __future__ import annotations

from typing import Optional


class EbayApiError(RuntimeError):
    """Errore leggibile per richieste eBay fallite."""

    def __init__(self, message: str, *, status_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class TelegramApiError(RuntimeError):
    """Errore leggibile per Telegram Bot API."""

    def __init__(self, message: str, *, status_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.status_code = status_code
