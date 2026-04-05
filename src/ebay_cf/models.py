"""Typed models shared by CLI and Telegram bot."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Optional


@dataclass
class Config:
    client_id: str
    client_secret: str
    refresh_token: str
    environment: str
    scopes: str

    @property
    def api_base(self) -> str:
        if self.environment == "sandbox":
            return "https://api.sandbox.ebay.com"
        return "https://api.ebay.com"


@dataclass
class FetchOptions:
    days: int = 7
    created_after: Optional[str] = None
    created_before: Optional[str] = None
    limit: int = 50
    max_results: int = 100
    order_ids: Optional[list[str]] = None
    only_found: bool = False


@dataclass
class TelegramConfig:
    token: str
    allowed_chat_ids: Optional[set[int]]
    notify_chat_ids: set[int]
    poll_timeout_seconds: int = 30
    ebay_poll_interval_seconds: int = 120
    state_path: str = "data/state.db"
    retry_queue_path: str = "data/state.db"
    lock_path: str = "data/telegram_bot.lock"


@dataclass
class OrderRecord:
    orderId: str = ""
    creationDate: str = ""
    buyerUsername: str = ""
    buyerName: str = ""
    taxpayerId: str = ""
    taxIdentifierType: str = ""
    issuingCountry: str = ""
    found: str = "no"
    items: str = "N/D"
    total: str = "0.00 EUR"
    shippingAddress: str = "N/D"

    def as_dict(self) -> dict[str, str]:
        return {key: str(value) for key, value in asdict(self).items()}

