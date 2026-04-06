"""Typed models shared by CLI and Telegram bot."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Iterable, Mapping, Optional, Union


def as_int(value: object, default: int = 0) -> int:
    if value is None:
        return default
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            return default
    return default


def as_str_list(value: object) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, Iterable):
        return [str(item) for item in value]
    return []


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
class TelegramUser:
    telegram_user_id: int
    telegram_chat_id: int
    username: str = ""
    display_name: str = ""
    created_at: str | None = None
    status: str = "active"

    @classmethod
    def from_mapping(cls, data: Mapping[str, object]) -> "TelegramUser":
        return cls(
            telegram_user_id=as_int(data.get("telegram_user_id", 0)),
            telegram_chat_id=as_int(data.get("telegram_chat_id", 0)),
            username=str(data.get("username", "")),
            display_name=str(data.get("display_name", "")),
            created_at=str(data["created_at"]) if data.get("created_at") else None,
            status=str(data.get("status", "active")),
        )

    def as_dict(self) -> dict[str, object]:
        return {
            "telegram_user_id": self.telegram_user_id,
            "telegram_chat_id": self.telegram_chat_id,
            "username": self.username,
            "display_name": self.display_name,
            "created_at": self.created_at,
            "status": self.status,
        }


@dataclass
class LinkedEbayAccount:
    telegram_user_id: int
    ebay_user_id: str
    environment: str = "production"
    scopes: str = ""
    linked_at: str | None = None
    status: str = "linked"
    id: int | None = None

    @classmethod
    def from_mapping(cls, data: Mapping[str, object]) -> "LinkedEbayAccount":
        raw_id = data.get("id")
        return cls(
            id=as_int(raw_id) if raw_id is not None else None,
            telegram_user_id=as_int(data.get("telegram_user_id", 0)),
            ebay_user_id=str(data.get("ebay_user_id", "")),
            environment=str(data.get("environment", "production")),
            scopes=str(data.get("scopes", "")),
            linked_at=str(data["linked_at"]) if data.get("linked_at") else None,
            status=str(data.get("status", "linked")),
        )

    def as_dict(self) -> dict[str, object]:
        payload: dict[str, object] = {
            "telegram_user_id": self.telegram_user_id,
            "ebay_user_id": self.ebay_user_id,
            "environment": self.environment,
            "scopes": self.scopes,
            "linked_at": self.linked_at,
            "status": self.status,
        }
        if self.id is not None:
            payload["id"] = self.id
        return payload


@dataclass
class BotMetrics:
    orders_read: int = 0
    notifications_sent: int = 0
    errors_by_type: dict[str, int] = field(default_factory=dict)

    @classmethod
    def from_mapping(cls, data: Mapping[str, object]) -> "BotMetrics":
        raw_errors = data.get("errors_by_type", {})
        errors_by_type: dict[str, int] = {}
        if isinstance(raw_errors, Mapping):
            errors_by_type = {str(key): as_int(value) for key, value in raw_errors.items()}
        return cls(
            orders_read=as_int(data.get("orders_read", 0)),
            notifications_sent=as_int(data.get("notifications_sent", 0)),
            errors_by_type=errors_by_type,
        )

    def as_dict(self) -> dict[str, object]:
        return {
            "orders_read": self.orders_read,
            "notifications_sent": self.notifications_sent,
            "errors_by_type": dict(self.errors_by_type),
        }


@dataclass
class RetryQueueEntry:
    chat_id: int
    text: str
    attempts: int = 0
    id: int | None = None

    @classmethod
    def from_mapping(cls, data: Mapping[str, object]) -> "RetryQueueEntry":
        raw_id = data.get("id")
        return cls(
            id=as_int(raw_id) if raw_id is not None else None,
            chat_id=as_int(data.get("chat_id", 0)),
            text=str(data.get("text", "")),
            attempts=as_int(data.get("attempts", 0)),
        )

    def as_dict(self) -> dict[str, object]:
        payload: dict[str, object] = {
            "chat_id": self.chat_id,
            "text": self.text,
            "attempts": self.attempts,
        }
        if self.id is not None:
            payload["id"] = self.id
        return payload


@dataclass
class BotRuntimeState:
    notified_order_ids: list[str] = field(default_factory=list)
    notified_hashes: list[str] = field(default_factory=list)
    last_check: str | None = None
    last_error: str | None = None
    metrics: BotMetrics = field(default_factory=BotMetrics)

    @classmethod
    def from_mapping(cls, data: Mapping[str, object]) -> "BotRuntimeState":
        raw_metrics = data.get("metrics", {})
        if isinstance(raw_metrics, BotMetrics):
            metrics = raw_metrics
        elif isinstance(raw_metrics, Mapping):
            metrics = BotMetrics.from_mapping(raw_metrics)
        else:
            metrics = BotMetrics()
        return cls(
            notified_order_ids=as_str_list(data.get("notified_order_ids", [])),
            notified_hashes=as_str_list(data.get("notified_hashes", [])),
            last_check=str(data["last_check"]) if data.get("last_check") else None,
            last_error=str(data["last_error"]) if data.get("last_error") else None,
            metrics=metrics,
        )

    def as_dict(self) -> dict[str, object]:
        return {
            "notified_order_ids": list(self.notified_order_ids),
            "notified_hashes": list(self.notified_hashes),
            "last_check": self.last_check,
            "last_error": self.last_error,
            "metrics": self.metrics.as_dict(),
        }


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

    @classmethod
    def from_mapping(cls, data: Mapping[str, object]) -> "OrderRecord":
        return cls(
            orderId=str(data.get("orderId", "")),
            creationDate=str(data.get("creationDate", "")),
            buyerUsername=str(data.get("buyerUsername", "")),
            buyerName=str(data.get("buyerName", "")),
            taxpayerId=str(data.get("taxpayerId", "")),
            taxIdentifierType=str(data.get("taxIdentifierType", "")),
            issuingCountry=str(data.get("issuingCountry", "")),
            found=str(data.get("found", "no")),
            items=str(data.get("items", "N/D")),
            total=str(data.get("total", "0.00 EUR")),
            shippingAddress=str(data.get("shippingAddress", "N/D")),
        )

    def as_dict(self) -> dict[str, str]:
        return {key: str(value) for key, value in asdict(self).items()}

    def has_codice_fiscale(self) -> bool:
        return self.taxIdentifierType.upper() == "CODICE_FISCALE" and bool(self.taxpayerId)

    def fingerprint_parts(self) -> tuple[str, ...]:
        return (
            self.orderId,
            self.creationDate,
            self.buyerUsername,
            self.taxpayerId,
            self.taxIdentifierType,
            self.issuingCountry,
        )


OrderRecordLike = Union[OrderRecord, Mapping[str, object]]
BotRuntimeStateLike = Union[BotRuntimeState, Mapping[str, object]]
RetryQueueEntryLike = Union[RetryQueueEntry, Mapping[str, object]]
TelegramUserLike = Union[TelegramUser, Mapping[str, object]]
LinkedEbayAccountLike = Union[LinkedEbayAccount, Mapping[str, object]]
