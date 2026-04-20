"""Notification and bot state services."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Callable

from ..errors import EbayApiError, TelegramApiError
from ..logging_utils import generate_operation_id, log_event
from ..models import (
    BotRuntimeState,
    FetchOptions,
    OrderRecord,
    RetryQueueEntry,
    TelegramConfig,
)
from ..telegram_commands import (
    format_auto_notification,
    has_codice_fiscale,
    record_fingerprint,
)

LOGGER = logging.getLogger("fiscalbay.notifications")


def increment_metric(state: BotRuntimeState, metric: str, amount: int = 1) -> None:
    current = getattr(state.metrics, metric)
    setattr(state.metrics, metric, int(current) + amount)


def increment_error_metric(state: BotRuntimeState, error_type: str) -> None:
    errors = state.metrics.errors_by_type
    errors[error_type] = int(errors.get(error_type, 0)) + 1


def mark_cycle_result(state: BotRuntimeState, *, had_errors: bool) -> None:
    if had_errors:
        state.metrics.consecutive_error_cycles += 1
        return
    state.metrics.consecutive_error_cycles = 0


def process_retry_queue(
    telegram_config: TelegramConfig,
    state: BotRuntimeState,
    *,
    load_retry_queue_fn: Callable[[str], list[RetryQueueEntry]],
    save_retry_queue_fn: Callable[[str, list[RetryQueueEntry]], None],
    send_message_fn: Callable[..., None],
    cycle_id: str,
) -> None:
    queue = load_retry_queue_fn(telegram_config.retry_queue_path)
    if not queue:
        return
    log_event(LOGGER, logging.INFO, "retry_queue_start", cycle_id=cycle_id, size=len(queue))
    remaining: list[RetryQueueEntry] = []
    for item in queue:
        try:
            send_message_fn(telegram_config.token, item.chat_id, item.text)
            increment_metric(state, "notifications_sent")
        except TelegramApiError as exc:
            item.attempts += 1
            if item.attempts < 5:
                remaining.append(item)
            state.last_error = str(exc)
            increment_error_metric(state, "telegram_send")
            increment_metric(state, "telegram_retries")
            log_event(
                LOGGER,
                logging.WARNING,
                "retry_queue_send_failed",
                cycle_id=cycle_id,
                chat_id=item.chat_id,
                attempts=item.attempts,
                error=exc,
            )
    save_retry_queue_fn(telegram_config.retry_queue_path, remaining)
    log_event(
        LOGGER,
        logging.INFO,
        "retry_queue_complete",
        cycle_id=cycle_id,
        remaining=len(remaining),
    )


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def order_sort_key(record: OrderRecord) -> str:
    return record.creationDate


def fetch_new_order_records(
    ebay_environment: str,
    state: BotRuntimeState,
    *,
    fetch_records_for_environment_fn: Callable[[str, FetchOptions], list[OrderRecord]],
    request_with_backoff_fn: Callable[..., object],
    lookback_minutes: int = 180,
    cycle_id: str,
) -> list[OrderRecord]:
    last_fetch_end = state.memory.last_fetch_end
    last_check = state.last_check
    if isinstance(last_fetch_end, str) and last_fetch_end:
        start = last_fetch_end
    elif isinstance(last_check, str) and last_check:
        start = last_check
    else:
        start = (now_utc() - timedelta(minutes=lookback_minutes)).isoformat().replace("+00:00", "Z")
    end = now_utc().isoformat().replace("+00:00", "Z")

    records = request_with_backoff_fn(
        lambda: fetch_records_for_environment_fn(
            ebay_environment,
            FetchOptions(
                created_after=start,
                created_before=end,
                max_results=100,
                only_found=False,
            ),
        ),
        label="fetch_new_orders",
    )
    assert isinstance(records, list)
    state.memory.last_fetch_start = start
    state.memory.last_fetch_end = end
    state.memory.last_fetch_count = len(records)
    if records:
        latest_record = max(records, key=order_sort_key)
        state.memory.last_seen_order_id = latest_record.orderId
        state.memory.last_seen_order_created_at = latest_record.creationDate
    log_event(
        LOGGER,
        logging.INFO,
        "orders_window_fetched",
        cycle_id=cycle_id,
        environment=ebay_environment,
        start=start,
        end=end,
        fetched=len(records),
    )

    notified_order_ids = set(state.notified_order_ids)
    notified_hashes = set(state.notified_hashes)
    new_records: list[OrderRecord] = []
    for record in records:
        oid = record.orderId
        if not oid or oid in notified_order_ids:
            continue
        if record_fingerprint(record) in notified_hashes:
            continue
        if has_codice_fiscale(record):
            new_records.append(record)
    new_records.sort(key=order_sort_key)
    return new_records


def update_state_with_records(
    state: BotRuntimeState,
    records: list[OrderRecord],
    *,
    checked_at: str | None = None,
    max_tracked_orders: int = 1000,
) -> BotRuntimeState:
    existing_ids = list(state.notified_order_ids)
    id_set = set(existing_ids)
    existing_hashes = list(state.notified_hashes)
    hash_set = set(existing_hashes)
    for record in records:
        oid = record.orderId
        fp = record_fingerprint(record)
        if oid and oid not in id_set:
            existing_ids.append(oid)
            id_set.add(oid)
        if fp and fp not in hash_set:
            existing_hashes.append(fp)
            hash_set.add(fp)
    if records:
        latest_notified = max(records, key=order_sort_key)
        state.memory.last_notified_order_id = latest_notified.orderId
        state.memory.last_notified_order_created_at = latest_notified.creationDate
    state.notified_order_ids = existing_ids[-max_tracked_orders:]
    state.notified_hashes = existing_hashes[-max_tracked_orders:]
    state.last_check = checked_at or now_utc().isoformat().replace("+00:00", "Z")
    return state


def maybe_send_new_order_notifications(
    telegram_config: TelegramConfig,
    ebay_environment: str,
    *,
    load_state_fn: Callable[[str], BotRuntimeState],
    save_state_fn: Callable[[str, BotRuntimeState], None],
    load_retry_queue_fn: Callable[[str], list[RetryQueueEntry]],
    save_retry_queue_fn: Callable[[str, list[RetryQueueEntry]], None],
    fetch_records_for_environment_fn: Callable[[str, FetchOptions], list[OrderRecord]],
    send_message_fn: Callable[..., None],
    request_with_backoff_fn: Callable[..., object],
) -> None:
    cycle_id = generate_operation_id("notify")
    cycle_had_errors = False
    if not telegram_config.notify_chat_ids:
        log_event(
            LOGGER,
            logging.INFO,
            "notify_skipped",
            cycle_id=cycle_id,
            reason="no_notify_chat_ids",
        )
        return
    state = load_state_fn(telegram_config.state_path)
    process_retry_queue(
        telegram_config,
        state,
        load_retry_queue_fn=load_retry_queue_fn,
        save_retry_queue_fn=save_retry_queue_fn,
        send_message_fn=send_message_fn,
        cycle_id=cycle_id,
    )
    save_state_fn(telegram_config.state_path, state)

    try:
        records = fetch_new_order_records(
            ebay_environment,
            state,
            fetch_records_for_environment_fn=fetch_records_for_environment_fn,
            request_with_backoff_fn=request_with_backoff_fn,
            cycle_id=cycle_id,
        )
    except Exception as exc:
        cycle_had_errors = True
        state.last_error = str(exc)
        if isinstance(exc, EbayApiError):
            increment_error_metric(state, "ebay_fetch")
        elif isinstance(exc, TelegramApiError):
            increment_error_metric(state, "telegram_fetch")
        else:
            increment_error_metric(state, "notify_cycle")
        mark_cycle_result(state, had_errors=True)
        save_state_fn(telegram_config.state_path, state)
        log_event(
            LOGGER,
            logging.ERROR,
            "notify_fetch_failed",
            cycle_id=cycle_id,
            environment=ebay_environment,
            error=exc,
        )
        raise
    first_bootstrap = not state.last_check
    if first_bootstrap:
        increment_metric(state, "orders_with_cf", len(records))
        mark_cycle_result(state, had_errors=False)
        log_event(
            LOGGER,
            logging.INFO,
            "notify_bootstrap",
            cycle_id=cycle_id,
            records=len(records),
        )
        updated_state = update_state_with_records(state, records)
        save_state_fn(telegram_config.state_path, updated_state)
        return

    failed_queue = load_retry_queue_fn(telegram_config.retry_queue_path)
    sent_count = 0
    for record in records:
        text = format_auto_notification(record)
        for chat_id in telegram_config.notify_chat_ids:
            try:
                send_message_fn(telegram_config.token, chat_id, text)
                increment_metric(state, "notifications_sent")
                sent_count += 1
            except TelegramApiError as exc:
                cycle_had_errors = True
                failed_queue.append(RetryQueueEntry(chat_id=chat_id, text=text, attempts=1))
                state.last_error = str(exc)
                increment_error_metric(state, "telegram_send")
                log_event(
                    LOGGER,
                    logging.WARNING,
                    "notify_send_failed",
                    cycle_id=cycle_id,
                    chat_id=chat_id,
                    order_id=record.orderId,
                    error=exc,
                )
    save_retry_queue_fn(telegram_config.retry_queue_path, failed_queue)
    increment_metric(state, "orders_read", len(records))
    increment_metric(state, "orders_with_cf", len(records))
    mark_cycle_result(state, had_errors=cycle_had_errors)
    updated_state = update_state_with_records(state, records)
    save_state_fn(telegram_config.state_path, updated_state)
    log_event(
        LOGGER,
        logging.INFO,
        "notify_cycle_complete",
        cycle_id=cycle_id,
        environment=ebay_environment,
        new_records=len(records),
        notifications_sent=sent_count,
        retry_queue_size=len(failed_queue),
    )
