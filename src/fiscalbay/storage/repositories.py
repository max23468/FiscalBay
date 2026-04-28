"""Small repository facades over the SQLite compatibility module."""

from __future__ import annotations

from dataclasses import dataclass

from ..models import AuditLogEntry, OauthLinkSession, OperationQueueEntry, TelegramUser
from . import sqlite


@dataclass(frozen=True)
class RuntimeStateRepository:
    path: str

    def rebuild_tenant_snapshots(self, *, now_iso: str | None = None) -> dict[str, int]:
        return sqlite.rebuild_all_tenant_status_snapshots(self.path, now_iso=now_iso)

    def load_tenant_snapshots(self) -> list[dict[str, object]]:
        return sqlite.load_tenant_status_snapshots(self.path)


@dataclass(frozen=True)
class TelegramAccessRepository:
    path: str

    def load_user(self, telegram_user_id: int) -> TelegramUser | None:
        return sqlite.load_telegram_user(self.path, telegram_user_id)

    def load_users(self) -> list[TelegramUser]:
        return sqlite.load_telegram_users(self.path)


@dataclass(frozen=True)
class OAuthAccountRepository:
    path: str

    def create_link_session(self, session: OauthLinkSession) -> OauthLinkSession:
        return sqlite.create_oauth_link_session(self.path, session)

    def latest_link_session(self, telegram_user_id: int) -> OauthLinkSession | None:
        return sqlite.load_latest_oauth_link_session(self.path, telegram_user_id)


@dataclass(frozen=True)
class AuditRepository:
    path: str

    def append(self, entry: AuditLogEntry) -> AuditLogEntry:
        return sqlite.append_audit_log_entry(self.path, entry)


@dataclass(frozen=True)
class OperationQueueRepository:
    path: str

    def enqueue(self, entry: OperationQueueEntry) -> OperationQueueEntry:
        return sqlite.enqueue_operation(self.path, entry)

    def summarize(self) -> dict[str, int]:
        return sqlite.summarize_operation_queue(self.path)
