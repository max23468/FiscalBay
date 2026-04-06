"""Application errors shared across modules."""

from __future__ import annotations

from typing import Optional


class AppError(RuntimeError):
    """Base error for readable application failures."""


class ConfigurationError(AppError):
    """Errore leggibile causato da configurazione mancante o incoerente."""


class ExternalServiceError(AppError):
    """Errore leggibile causato da dipendenze esterne."""

    def __init__(self, message: str, *, status_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class EbayApiError(ExternalServiceError):
    """Errore leggibile per richieste eBay fallite."""

    def __init__(self, message: str, *, status_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class TelegramApiError(ExternalServiceError):
    """Errore leggibile per Telegram Bot API."""

    def __init__(self, message: str, *, status_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class UserInputError(TelegramApiError):
    """Errore leggibile causato da input o uso non valido."""
