"""Support snapshot helpers for a single FiscalBay tenant."""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from .models import AuditLogEntry, BotRuntimeState, RetryQueueEntry, TelegramUser, as_int
from .storage.sqlite import (
    load_audit_log_entries,
    load_telegram_user,
    load_tenant_retry_queue_entries,
    load_tenant_runtime_state,
    load_tenant_status_snapshot,
    summarize_tenant_account_status,
)


@dataclass(frozen=True)
class SupportSnapshotReport:
    generated_at: str
    telegram_user_id: int
    user: TelegramUser | None
    account_status: dict[str, object]
    runtime_state: BotRuntimeState
    retry_queue: tuple[RetryQueueEntry, ...]
    recent_audit: tuple[AuditLogEntry, ...]
    tenant_snapshot: dict[str, object]
    actions: tuple[str, ...]

    @property
    def status(self) -> str:
        if self.user is None:
            return "unknown_user"
        account_status = str(self.account_status.get("account_status") or "unlinked")
        token_status = str(self.account_status.get("token_status") or "missing")
        if (
            account_status == "linked"
            and token_status == "active"
            and self.runtime_state.last_check
            and not self.runtime_state.last_error
        ):
            return "ready"
        if account_status in {"disconnected", "revoked"} or token_status in {
            "revoked",
            "expired",
            "token_expired",
        }:
            return "reconnect_required"
        if account_status != "linked":
            return "waiting_connect"
        return "attention"

    def as_dict(self) -> dict[str, object]:
        return {
            "generated_at": self.generated_at,
            "telegram_user_id": self.telegram_user_id,
            "status": self.status,
            "user": self.user.as_dict() if self.user is not None else None,
            "account_status": dict(self.account_status),
            "runtime_state": self.runtime_state.as_dict(),
            "retry_queue": [entry.as_dict() for entry in self.retry_queue],
            "recent_audit": [entry.as_dict() for entry in self.recent_audit],
            "tenant_snapshot": dict(self.tenant_snapshot),
            "actions": list(self.actions),
        }


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _filter_tenant_audit(
    entries: list[AuditLogEntry],
    telegram_user_id: int,
    *,
    limit: int,
) -> tuple[AuditLogEntry, ...]:
    filtered: list[AuditLogEntry] = []
    for entry in entries:
        if telegram_user_id not in {
            entry.actor_telegram_user_id,
            entry.target_telegram_user_id,
        }:
            continue
        filtered.append(entry)
        if len(filtered) >= limit:
            break
    return tuple(filtered)


def _build_actions(
    *,
    user: TelegramUser | None,
    account_status: dict[str, object],
    runtime_state: BotRuntimeState,
    retry_queue: tuple[RetryQueueEntry, ...],
) -> tuple[str, ...]:
    actions: list[str] = []
    if user is None:
        return ("verifica telegram_user_id o attendi il primo /start dell'utente",)

    user_status = str(user.status or "")
    raw_account_status = str(account_status.get("account_status") or "unlinked")
    raw_token_status = str(account_status.get("token_status") or "missing")

    if user_status in {"new", "pending"}:
        actions.append("valuta e approva l'accesso utente")
    if user_status == "blocked":
        actions.append("utente bloccato: riattiva solo se previsto")
    if raw_account_status != "linked":
        actions.append("invita l'utente a usare /account collega")
    elif raw_token_status != "active":
        actions.append("chiedi reconnect con /account collega")
    if runtime_state.last_error:
        actions.append("controlla ultimo errore runtime tenant")
    if retry_queue:
        actions.append("verifica coda notifiche tenant")
    if not runtime_state.last_check:
        actions.append("attendi il primo ciclo di sync o chiedi /ordini fiscali")
    if not runtime_state.memory.last_seen_order_id:
        actions.append("nessun ordine recente tracciato: prova /ordini tutti")
    if not actions:
        actions.append("nessuna azione urgente")
    return tuple(actions)


def build_support_snapshot(
    state_path: str,
    telegram_user_id: int,
    *,
    environment: str | None = None,
    audit_limit: int = 6,
) -> SupportSnapshotReport:
    user = load_telegram_user(state_path, telegram_user_id)
    account_status = summarize_tenant_account_status(state_path, telegram_user_id, environment)
    runtime_state = load_tenant_runtime_state(state_path, telegram_user_id)
    retry_queue = tuple(load_tenant_retry_queue_entries(state_path, telegram_user_id))
    recent_audit = _filter_tenant_audit(
        load_audit_log_entries(state_path, limit=max(50, audit_limit * 10)),
        telegram_user_id,
        limit=audit_limit,
    )
    tenant_snapshot = load_tenant_status_snapshot(state_path, telegram_user_id)
    actions = _build_actions(
        user=user,
        account_status=account_status,
        runtime_state=runtime_state,
        retry_queue=retry_queue,
    )
    return SupportSnapshotReport(
        generated_at=_now_iso(),
        telegram_user_id=telegram_user_id,
        user=user,
        account_status=account_status,
        runtime_state=runtime_state,
        retry_queue=retry_queue,
        recent_audit=recent_audit,
        tenant_snapshot=tenant_snapshot,
        actions=actions,
    )


def render_support_snapshot_text(report: SupportSnapshotReport) -> str:
    user = report.user
    account = report.account_status
    runtime = report.runtime_state
    memory = runtime.memory
    user_label = "n/d"
    if user is not None:
        name = user.display_name or user.username or "n/d"
        user_label = f"{name} ({user.status})"
    latest_audit = report.recent_audit[0] if report.recent_audit else None
    latest_audit_text = (
        f"{latest_audit.created_at} {latest_audit.event_type}/{latest_audit.outcome}"
        if latest_audit is not None
        else "none"
    )
    lines = [
        "Support snapshot utente",
        f"Generato: {report.generated_at}",
        f"Telegram user: {report.telegram_user_id}",
        f"Utente: {user_label}",
        f"Stato snapshot: {report.status}",
        "",
        "Account",
        f"- linked: {bool(account.get('linked'))}",
        f"- environment: {account.get('environment') or 'n/d'}",
        f"- ebay_user_id: {account.get('ebay_user_id') or 'n/d'}",
        f"- account_status: {account.get('account_status') or 'unlinked'}",
        f"- token_status: {account.get('token_status') or 'missing'}",
        "",
        "Sync e ordini",
        f"- last_check: {runtime.last_check or 'none'}",
        f"- last_error: {runtime.last_error or 'none'}",
        f"- last_fetch_end: {memory.last_fetch_end or 'none'}",
        f"- last_fetch_count: {memory.last_fetch_count}",
        f"- last_seen_order: {memory.last_seen_order_id or 'none'}",
        f"- last_seen_order_created_at: {memory.last_seen_order_created_at or 'none'}",
        f"- last_notified_order: {memory.last_notified_order_id or 'none'}",
        f"- last_notified_order_created_at: {memory.last_notified_order_created_at or 'none'}",
        "",
        "Segnali supporto",
        f"- retry_queue: {len(report.retry_queue)}",
        f"- latest_audit: {latest_audit_text}",
        f"- tenant_snapshot_state: {report.tenant_snapshot.get('operational_state') or 'none'}",
        "",
        "Azioni consigliate",
        *[f"- {action}" for action in report.actions],
    ]
    return "\n".join(lines)


def _parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Mostra uno snapshot supporto per un tenant.")
    parser.add_argument("telegram_user_id", type=int, help="Telegram user id del tenant.")
    parser.add_argument(
        "--state-path",
        default=os.getenv("TELEGRAM_STATE_PATH", "data/state.db"),
        help="Percorso SQLite runtime.",
    )
    parser.add_argument("--environment", help="Ambiente eBay da preferire.")
    parser.add_argument("--json", action="store_true", help="Stampa JSON invece del testo.")
    return parser.parse_args(argv)


def main(argv: Optional[list[str]] = None) -> int:
    args = _parse_args(argv)
    report = build_support_snapshot(
        args.state_path,
        as_int(args.telegram_user_id),
        environment=args.environment,
    )
    if args.json:
        print(json.dumps(report.as_dict(), indent=2, ensure_ascii=False))
    else:
        print(render_support_snapshot_text(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
