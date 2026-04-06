"""Notification and bot state services."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Callable

from ..errors import TelegramApiError
from ..logging_utils import log_event
from ..models import (
    BotRuntimeState,
    BotRuntimeStateLike,
    FetchOptions,
    OrderRecord,
    OrderRecordLike,
    RetryQueueEntry,
    RetryQueueEntryLike,
    TelegramConfig,
)
from ..storage.sqlite import BotState
from ..telegram_commands import (
    format_auto_notification,
    has_codice_fiscale,
    record_fingerprint,
    to_order_record,
)

LOGGER = logging.getLogger("ebaycf.notifications")


def to_runtime_state(state: BotRuntimeStateLike) -> BotRuntimeState:
    if isinstance(state, BotRuntimeState):
        return state
    return BotRuntimeState.from_mapping(state)


def to_retry_queue_entry(item: RetryQueueEntryLike) -> RetryQueueEntry:
    if isinstance(item, RetryQueueEntry):
        return item
    return RetryQueueEntry.from_mapping(item)


def increment_metric(state: BotRuntimeStateLike, metric: str, amount: int = 1) -> None:
    runtime_state = to_runtime_state(state)
    current = getattr(runtime_state.metrics, metric)
    setattr(runtime_state.metrics, metric, int(current) + amount)


def increment_error_metric(state: BotRuntimeStateLike, error_type: str) -> None:
    runtime_state = to_runtime_state(state)
    errors = runtime_state.metrics.errors_by_type
    errors[error_type] = int(errors.get(error_type, 0)) + 1


def process_retry_queue(
    telegram_config: TelegramConfig,
    state: BotRuntimeStateLike,
    *,
    load_retry_queue_fn: Callable[[str], list[RetryQueueEntry]],
    save_retry_queue_fn: Callable[[str, list[RetryQueueEntry]], None],
    send_message_fn: Callable[..., None],
) -> None:
    runtime_state = to_runtime_state(state)
    queue = [
        to_retry_queue_entry(item) for item in load_retry_queue_fn(telegram_config.retry_queue_path)
    ]
    if not queue:
        return
    log_event(LOGGER, logging.INFO, "retry_queue_start", size=len(queue))
    remaining: list[RetryQueueEntry] = []
    for item in queue:
        try:
            send_message_fn(telegram_config.token, item.chat_id, item.text)
            increment_metric(runtime_state, "notifications_sent")
        except TelegramApiError as exc:
            item.attempts += 1
            if item.attempts < 5:
                remaining.append(item)
            runtime_state.last_error = str(exc)
            increment_error_metric(runtime_state, "telegram_send")
            log_event(
                LOGGER,
                logging.WARNING,
                "retry_queue_send_failed",
                chat_id=item.chat_id,
                attempts=item.attempts,
                error=exc,
            )
    save_retry_queue_fn(telegram_config.retry_queue_path, remaining)
    log_event(LOGGER, logging.INFO, "retry_queue_complete", remaining=len(remaining))


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def order_sort_key(record: OrderRecordLike) -> str:
    return to_order_record(record).creationDate


def fetch_new_order_records(
    ebay_environment: str,
    state: BotRuntimeStateLike,
    *,
    load_config_fn: Callable[[str], object],
    fetch_records_fn: Callable[[object, FetchOptions], list[OrderRecordLike]],
    request_with_backoff_fn: Callable[..., object],
    lookback_minutes: int = 180,
) -> list[OrderRecord]:
    runtime_state = to_runtime_state(state)
    config = load_config_fn(ebay_environment)
    last_check = runtime_state.last_check
    if isinstance(last_check, str) and last_check:
        start = last_check
    else:
        start = (now_utc() - timedelta(minutes=lookback_minutes)).isoformat().replace("+00:00", "Z")
    end = now_utc().isoformat().replace("+00:00", "Z")

    records = request_with_backoff_fn(
        lambda: fetch_records_fn(
            config,
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
    log_event(
        LOGGER,
        logging.INFO,
        "orders_window_fetched",
        start=start,
        end=end,
        fetched=len(records),
    )

    notified_order_ids = set(runtime_state.notified_order_ids)
    notified_hashes = set(runtime_state.notified_hashes)
    new_records: list[OrderRecord] = []
    for raw_record in records:
        record = to_order_record(raw_record)
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
    state: BotRuntimeStateLike,
    records: list[OrderRecordLike],
    *,
    checked_at: str | None = None,
    max_tracked_orders: int = 1000,
) -> BotState:
    runtime_state = to_runtime_state(state)
    existing_ids = list(runtime_state.notified_order_ids)
    id_set = set(existing_ids)
    existing_hashes = list(runtime_state.notified_hashes)
    hash_set = set(existing_hashes)
    for raw_record in records:
        record = to_order_record(raw_record)
        oid = record.orderId
        fp = record_fingerprint(record)
        if oid and oid not in id_set:
            existing_ids.append(oid)
            id_set.add(oid)
        if fp and fp not in hash_set:
            existing_hashes.append(fp)
            hash_set.add(fp)
    runtime_state.notified_order_ids = existing_ids[-max_tracked_orders:]
    runtime_state.notified_hashes = existing_hashes[-max_tracked_orders:]
    runtime_state.last_check = checked_at or now_utc().isoformat().replace("+00:00", "Z")
    return runtime_state.as_dict()


def maybe_send_new_order_notifications(
    telegram_config: TelegramConfig,
    ebay_environment: str,
    *,
    load_state_fn: Callable[[str], BotRuntimeState],
    save_state_fn: Callable[[str, BotRuntimeState], None],
    load_retry_queue_fn: Callable[[str], list[RetryQueueEntry]],
    save_retry_queue_fn: Callable[[str, list[RetryQueueEntry]], None],
    load_config_fn: Callable[[str], object],
    fetch_records_fn: Callable[[object, FetchOptions], list[OrderRecordLike]],
    send_message_fn: Callable[..., None],
    request_with_backoff_fn: Callable[..., object],
) -> None:
    if not telegram_config.notify_chat_ids:
        log_event(LOGGER, logging.INFO, "notify_skipped", reason="no_notify_chat_ids")
        return
    state = to_runtime_state(load_state_fn(telegram_config.state_path))
    process_retry_queue(
        telegram_config,
        state,
        load_retry_queue_fn=load_retry_queue_fn,
        save_retry_queue_fn=save_retry_queue_fn,
        send_message_fn=send_message_fn,
    )
    save_state_fn(telegram_config.state_path, state)

    records = fetch_new_order_records(
        ebay_environment,
        state,
        load_config_fn=load_config_fn,
        fetch_records_fn=fetch_records_fn,
        request_with_backoff_fn=request_with_backoff_fn,
    )
    first_bootstrap = not state.last_check
    if first_bootstrap:
        log_event(LOGGER, logging.INFO, "notify_bootstrap", records=len(records))
        updated_state = update_state_with_records(state, records)
        save_state_fn(telegram_config.state_path, BotRuntimeState.from_mapping(updated_state))
        return

    failed_queue = [
        to_retry_queue_entry(item) for item in load_retry_queue_fn(telegram_config.retry_queue_path)
    ]
    sent_count = 0
    for record in records:
        text = format_auto_notification(record)
        for chat_id in telegram_config.notify_chat_ids:
            try:
                send_message_fn(telegram_config.token, chat_id, text)
                increment_metric(state, "notifications_sent")
                sent_count += 1
            except TelegramApiError as exc:
                failed_queue.append(RetryQueueEntry(chat_id=chat_id, text=text, attempts=1))
                state.last_error = str(exc)
                increment_error_metric(state, "telegram_send")
                log_event(
                    LOGGER,
                    logging.WARNING,
                    "notify_send_failed",
                    chat_id=chat_id,
                    order_id=record.orderId,
                    error=exc,
                )
    save_retry_queue_fn(telegram_config.retry_queue_path, failed_queue)
    increment_metric(state, "orders_read", len(records))
    updated_state = update_state_with_records(state, records)
    save_state_fn(telegram_config.state_path, BotRuntimeState.from_mapping(updated_state))
    log_event(
        LOGGER,
        logging.INFO,
        "notify_cycle_complete",
        new_records=len(records),
        notifications_sent=sent_count,
        retry_queue_size=len(failed_queue),
    )
