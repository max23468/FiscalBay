"""SQLite queues storage functions."""

from __future__ import annotations

from ..models import (
    OPERATION_STATUS_CANCELLED,
    OPERATION_STATUS_COMPLETED,
    OPERATION_STATUS_FAILED,
    OPERATION_STATUS_PENDING,
    OPERATION_STATUS_RUNNING,
    AuditLogEntry,
    OperationQueueEntry,
    as_int,
    normalize_operation_status,
)
from .connection import _connect, init_db


def append_audit_log_entry(path: str, entry: AuditLogEntry) -> AuditLogEntry:
    init_db(path)
    with _connect(path) as conn:
        cursor = conn.execute(
            "INSERT INTO audit_log "
            "("
            "event_type, actor_telegram_user_id, target_telegram_user_id, telegram_chat_id, "
            "ebay_user_id, environment, outcome, details_json, created_at"
            ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                entry.event_type,
                entry.actor_telegram_user_id,
                entry.target_telegram_user_id,
                entry.telegram_chat_id,
                entry.ebay_user_id,
                entry.environment,
                entry.outcome,
                entry.details_json,
                entry.created_at,
            ),
        )
        if cursor.lastrowid is None:
            raise RuntimeError("Inserimento audit log fallito: lastrowid mancante.")
        entry.id = int(cursor.lastrowid)
    return entry


def load_audit_log_entries(path: str, limit: int = 100) -> list[AuditLogEntry]:
    init_db(path)
    entries: list[AuditLogEntry] = []
    safe_limit = max(1, int(limit))
    with _connect(path) as conn:
        rows = conn.execute(
            "SELECT id, event_type, actor_telegram_user_id, target_telegram_user_id, "
            "telegram_chat_id, ebay_user_id, environment, outcome, details_json, created_at "
            "FROM audit_log ORDER BY id DESC LIMIT ?",
            (safe_limit,),
        ).fetchall()
        for row in rows:
            entries.append(AuditLogEntry.from_mapping(dict(row)))
    return entries


def enqueue_operation(path: str, entry: OperationQueueEntry) -> OperationQueueEntry:
    init_db(path)
    with _connect(path) as conn:
        cursor = conn.execute(
            "INSERT INTO operation_queue "
            "("
            "operation_type, status, actor_telegram_user_id, target_telegram_user_id, "
            "available_at, payload_json, result_json, last_error, attempts, created_at, updated_at"
            ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                entry.operation_type,
                normalize_operation_status(entry.status),
                entry.actor_telegram_user_id,
                entry.target_telegram_user_id,
                entry.available_at,
                entry.payload_json,
                entry.result_json,
                entry.last_error,
                entry.attempts,
                entry.created_at,
                entry.updated_at or entry.created_at,
            ),
        )
        if cursor.lastrowid is None:
            raise RuntimeError("Inserimento operation queue fallito: lastrowid mancante.")
        entry.id = int(cursor.lastrowid)
    return entry


def load_operation_queue_entries(
    path: str,
    *,
    limit: int = 100,
    statuses: set[str] | None = None,
) -> list[OperationQueueEntry]:
    init_db(path)
    entries: list[OperationQueueEntry] = []
    safe_limit = max(1, int(limit))
    with _connect(path) as conn:
        if statuses:
            normalized_statuses = [
                normalize_operation_status(status) for status in sorted(statuses)
            ]
            placeholders = ", ".join("?" for _ in normalized_statuses)
            rows = conn.execute(
                "SELECT id, operation_type, status, actor_telegram_user_id, "
                "target_telegram_user_id, available_at, payload_json, result_json, "
                "last_error, attempts, created_at, updated_at "
                f"FROM operation_queue WHERE status IN ({placeholders}) "
                "ORDER BY id ASC LIMIT ?",
                (*normalized_statuses, safe_limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, operation_type, status, actor_telegram_user_id, "
                "target_telegram_user_id, available_at, payload_json, result_json, "
                "last_error, attempts, created_at, updated_at "
                "FROM operation_queue ORDER BY id ASC LIMIT ?",
                (safe_limit,),
            ).fetchall()
        for row in rows:
            entries.append(OperationQueueEntry.from_mapping(dict(row)))
    return entries


def update_operation_queue_entry(
    path: str,
    operation_id: int,
    *,
    status: str | None = None,
    result_json: str | None = None,
    last_error: str | None = None,
    attempts: int | None = None,
    updated_at: str,
) -> OperationQueueEntry | None:
    init_db(path)
    assignments: list[str] = ["updated_at = ?"]
    params: list[object] = [updated_at]
    if status is not None:
        assignments.append("status = ?")
        params.append(normalize_operation_status(status))
    if result_json is not None:
        assignments.append("result_json = ?")
        params.append(result_json)
    if last_error is not None:
        assignments.append("last_error = ?")
        params.append(last_error)
    if attempts is not None:
        assignments.append("attempts = ?")
        params.append(attempts)
    params.append(operation_id)
    with _connect(path) as conn:
        conn.execute(
            f"UPDATE operation_queue SET {', '.join(assignments)} WHERE id = ?",
            tuple(params),
        )
        row = conn.execute(
            "SELECT id, operation_type, status, actor_telegram_user_id, "
            "target_telegram_user_id, available_at, payload_json, result_json, "
            "last_error, attempts, created_at, updated_at "
            "FROM operation_queue WHERE id = ? LIMIT 1",
            (operation_id,),
        ).fetchone()
        if row is None:
            return None
    return OperationQueueEntry.from_mapping(dict(row))


def claim_pending_operation(path: str, *, now_iso: str) -> OperationQueueEntry | None:
    init_db(path)
    with _connect(path) as conn:
        row = conn.execute(
            "SELECT id, operation_type, status, actor_telegram_user_id, "
            "target_telegram_user_id, available_at, payload_json, result_json, "
            "last_error, attempts, created_at, updated_at "
            "FROM operation_queue "
            "WHERE status = ? AND (available_at IS NULL OR available_at <= ?) "
            "ORDER BY id ASC LIMIT 1",
            (OPERATION_STATUS_PENDING, now_iso),
        ).fetchone()
        if row is None:
            return None
        operation = OperationQueueEntry.from_mapping(dict(row))
        next_attempts = operation.attempts + 1
        conn.execute(
            "UPDATE operation_queue "
            "SET status = ?, attempts = ?, updated_at = ? "
            "WHERE id = ? AND status = ?",
            (
                OPERATION_STATUS_RUNNING,
                next_attempts,
                now_iso,
                operation.id,
                OPERATION_STATUS_PENDING,
            ),
        )
        if conn.total_changes == 0:
            return None
        operation.status = OPERATION_STATUS_RUNNING
        operation.attempts = next_attempts
        operation.updated_at = now_iso
    return operation


def summarize_operation_queue(path: str) -> dict[str, int]:
    init_db(path)
    with _connect(path) as conn:
        pending = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM operation_queue WHERE status = ?",
                (OPERATION_STATUS_PENDING,),
            ).fetchone()[0]
        )
        running = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM operation_queue WHERE status = ?",
                (OPERATION_STATUS_RUNNING,),
            ).fetchone()[0]
        )
        failed = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM operation_queue WHERE status = ?",
                (OPERATION_STATUS_FAILED,),
            ).fetchone()[0]
        )
        completed = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM operation_queue WHERE status = ?",
                (OPERATION_STATUS_COMPLETED,),
            ).fetchone()[0]
        )
        cancelled = as_int(
            conn.execute(
                "SELECT COUNT(*) FROM operation_queue WHERE status = ?",
                (OPERATION_STATUS_CANCELLED,),
            ).fetchone()[0]
        )
    return {
        "pending": pending,
        "running": running,
        "failed": failed,
        "completed": completed,
        "cancelled": cancelled,
    }
