import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from src.fiscalbay.errors import EbayApiError, TelegramApiError
from src.fiscalbay.models import (
    BotOperationalMemory,
    BotRuntimeState,
    OrderRecord,
    RetryQueueEntry,
    TelegramConfig,
)
from src.fiscalbay.services.notifications import (
    fetch_order_window_records,
    filter_new_notifiable_order_records,
    filter_new_order_records,
    mark_cycle_result,
    maybe_send_missing_tax_spike_alert,
    maybe_send_new_order_notifications,
    process_retry_queue,
    should_send_missing_tax_spike_alert,
)
from src.fiscalbay.telegram_commands import record_fingerprint


def make_record(
    order_id: str,
    created_at: str,
    *,
    taxpayer_id: str = "",
    tax_type: str = "",
) -> OrderRecord:
    return OrderRecord(
        orderId=order_id,
        creationDate=created_at,
        taxpayerId=taxpayer_id,
        taxIdentifierType=tax_type,
    )


class NotificationStateTests(unittest.TestCase):
    def test_successful_cycle_clears_stale_last_error(self) -> None:
        state = BotRuntimeState(last_error="previous error")
        state.metrics.consecutive_error_cycles = 3

        mark_cycle_result(state, had_errors=False)

        self.assertIsNone(state.last_error)
        self.assertEqual(state.metrics.consecutive_error_cycles, 0)

    def test_failed_cycle_preserves_last_error_and_increments_counter(self) -> None:
        state = BotRuntimeState(last_error="current error")
        state.metrics.consecutive_error_cycles = 3

        mark_cycle_result(state, had_errors=True)

        self.assertEqual(state.last_error, "current error")
        self.assertEqual(state.metrics.consecutive_error_cycles, 4)

    def test_process_retry_queue_requeues_transient_failures_and_drops_exhausted_items(
        self,
    ) -> None:
        state = BotRuntimeState()
        queue = [
            RetryQueueEntry(chat_id=10, text="ok", attempts=0),
            RetryQueueEntry(chat_id=11, text="retry", attempts=3),
            RetryQueueEntry(chat_id=12, text="drop", attempts=4),
        ]
        saved_queues: list[list[RetryQueueEntry]] = []
        sent: list[tuple[str, int, str]] = []

        def send_message(token: str, chat_id: int, text: str) -> None:
            if chat_id in {11, 12}:
                raise TelegramApiError(f"telegram_{chat_id}", status_code=429)
            sent.append((token, chat_id, text))

        process_retry_queue(
            TelegramConfig(token="bot-token", allowed_chat_ids=None, notify_chat_ids=set()),
            state,
            load_retry_queue_fn=lambda _: list(queue),
            save_retry_queue_fn=lambda _path, items: saved_queues.append(list(items)),
            send_message_fn=send_message,
            cycle_id="cycle-1",
        )

        self.assertEqual(sent, [("bot-token", 10, "ok")])
        self.assertEqual(state.metrics.notifications_sent, 1)
        self.assertEqual(state.metrics.telegram_retries, 2)
        self.assertEqual(state.metrics.errors_by_type["telegram_send"], 2)
        self.assertEqual(state.last_error, "telegram_12")
        self.assertEqual(len(saved_queues), 1)
        self.assertEqual([(item.chat_id, item.attempts) for item in saved_queues[0]], [(11, 4)])

    def test_fetch_order_window_records_prefers_last_fetch_end_and_tracks_latest_record(
        self,
    ) -> None:
        state = BotRuntimeState(
            last_check="2026-04-07T09:00:00Z",
            memory=BotOperationalMemory(last_fetch_end="2026-04-07T09:30:00Z"),
        )
        records = [
            make_record("order-2", "2026-04-07T09:50:00Z"),
            make_record("order-1", "2026-04-07T09:40:00Z"),
        ]
        captured: dict[str, object] = {}

        def fetch_records(environment: str, options: object) -> list[OrderRecord]:
            captured["environment"] = environment
            captured["options"] = options
            return list(records)

        with patch(
            "src.fiscalbay.services.notifications.now_utc",
            return_value=datetime(2026, 4, 7, 10, 0, tzinfo=timezone.utc),
        ):
            fetched = fetch_order_window_records(
                "production",
                state,
                fetch_records_for_environment_fn=fetch_records,
                request_with_backoff_fn=lambda fn, **_kwargs: fn(),
                cycle_id="cycle-2",
            )

        options = captured["options"]
        self.assertEqual(captured["environment"], "production")
        self.assertEqual(getattr(options, "created_after"), "2026-04-07T09:30:00Z")
        self.assertEqual(getattr(options, "created_before"), "2026-04-07T10:00:00Z")
        self.assertEqual(state.memory.last_fetch_start, "2026-04-07T09:30:00Z")
        self.assertEqual(state.memory.last_fetch_end, "2026-04-07T10:00:00Z")
        self.assertEqual(state.memory.last_fetch_count, 2)
        self.assertEqual(state.memory.last_seen_order_id, "order-2")
        self.assertEqual(state.memory.last_seen_order_created_at, "2026-04-07T09:50:00Z")
        self.assertEqual([record.orderId for record in fetched], ["order-1", "order-2"])

    def test_filter_new_record_helpers_skip_known_ids_and_hashes(self) -> None:
        fresh = make_record("order-3", "2026-04-07T10:00:00Z", taxpayer_id="CF3", tax_type="CF")
        known_id = make_record("order-1", "2026-04-07T09:00:00Z", taxpayer_id="CF1", tax_type="CF")
        known_hash = make_record(
            "order-2", "2026-04-07T09:30:00Z", taxpayer_id="CF2", tax_type="CF"
        )
        missing_tax = make_record("order-4", "2026-04-07T10:30:00Z")
        state = BotRuntimeState(
            notified_order_ids=["order-1"],
            notified_hashes=[record_fingerprint(known_hash)],
        )

        new_records = filter_new_order_records(state, [fresh, known_id, known_hash, missing_tax])
        notifiable = filter_new_notifiable_order_records(
            state, [fresh, known_id, known_hash, missing_tax]
        )

        self.assertEqual([record.orderId for record in new_records], ["order-3", "order-4"])
        self.assertEqual([record.orderId for record in notifiable], ["order-3"])

    def test_should_send_missing_tax_spike_alert_checks_thresholds_signature_and_cooldown(
        self,
    ) -> None:
        records = [
            make_record("order-1", "2026-04-07T09:00:00Z"),
            make_record("order-2", "2026-04-07T09:05:00Z"),
            make_record("order-3", "2026-04-07T09:10:00Z", taxpayer_id="CF3", tax_type="CF"),
        ]
        now = datetime(2026, 4, 7, 10, 0, tzinfo=timezone.utc)

        self.assertTrue(
            should_send_missing_tax_spike_alert(
                BotRuntimeState(),
                records,
                now=now,
                min_missing=2,
                min_percent=60,
                cooldown_seconds=3600,
            )
        )
        self.assertFalse(
            should_send_missing_tax_spike_alert(
                BotRuntimeState(
                    memory=BotOperationalMemory(
                        last_missing_tax_alert_signature="order-1|order-2",
                    )
                ),
                records,
                now=now,
                min_missing=2,
                min_percent=60,
                cooldown_seconds=3600,
            )
        )
        self.assertFalse(
            should_send_missing_tax_spike_alert(
                BotRuntimeState(
                    memory=BotOperationalMemory(
                        last_missing_tax_alert_at="2026-04-07T09:30:00Z",
                    )
                ),
                records,
                now=now,
                min_missing=2,
                min_percent=60,
                cooldown_seconds=3600,
            )
        )

    def test_maybe_send_missing_tax_spike_alert_sends_and_queues_failures(self) -> None:
        state = BotRuntimeState()
        failed_queue: list[RetryQueueEntry] = []
        sent: list[int] = []
        records = [
            make_record("order-1", "2026-04-07T09:00:00Z"),
            make_record("order-2", "2026-04-07T09:05:00Z"),
            make_record("order-3", "2026-04-07T09:10:00Z", taxpayer_id="CF3", tax_type="CF"),
        ]

        def send_message(token: str, chat_id: int, text: str) -> None:
            self.assertIn("order-1", text)
            if chat_id == 20:
                raise TelegramApiError("send_ko", status_code=429)
            sent.append(chat_id)

        with (
            patch.dict(
                "os.environ",
                {
                    "FISCALBAY_MISSING_TAX_ALERT_ENABLED": "1",
                    "FISCALBAY_MISSING_TAX_ALERT_MIN_MISSING": "2",
                    "FISCALBAY_MISSING_TAX_ALERT_MIN_PERCENT": "60",
                    "FISCALBAY_MISSING_TAX_ALERT_COOLDOWN_SECONDS": "0",
                },
                clear=False,
            ),
            patch(
                "src.fiscalbay.services.notifications.now_utc",
                return_value=datetime(2026, 4, 7, 10, 0, tzinfo=timezone.utc),
            ),
        ):
            had_errors = maybe_send_missing_tax_spike_alert(
                TelegramConfig(
                    token="bot-token",
                    allowed_chat_ids=None,
                    notify_chat_ids={10, 20},
                ),
                state,
                records,
                failed_queue=failed_queue,
                send_message_fn=send_message,
                cycle_id="cycle-3",
            )

        self.assertTrue(had_errors)
        self.assertEqual(sent, [10])
        self.assertEqual([(item.chat_id, item.attempts) for item in failed_queue], [(20, 1)])
        self.assertEqual(state.metrics.notifications_sent, 1)
        self.assertEqual(state.metrics.errors_by_type["telegram_send"], 1)
        self.assertEqual(state.last_error, "send_ko")
        self.assertEqual(state.memory.last_missing_tax_alert_signature, "order-1|order-2")
        self.assertEqual(state.memory.last_missing_tax_alert_at, "2026-04-07T10:00:00Z")

    def test_maybe_send_new_order_notifications_bootstraps_without_sending_messages(self) -> None:
        state = BotRuntimeState()
        saved_states: list[BotRuntimeState] = []
        sent_messages: list[tuple[str, int, str]] = []
        records = [
            make_record("order-2", "2026-04-07T09:30:00Z", taxpayer_id="CF2", tax_type="CF"),
            make_record("order-1", "2026-04-07T09:00:00Z", taxpayer_id="CF1", tax_type="CF"),
        ]

        maybe_send_new_order_notifications(
            TelegramConfig(
                token="bot-token",
                allowed_chat_ids=None,
                notify_chat_ids={10},
                state_path="state.db",
                retry_queue_path="retry.db",
            ),
            "production",
            load_state_fn=lambda _path: state,
            save_state_fn=lambda _path, current: saved_states.append(current),
            load_retry_queue_fn=lambda _path: [],
            save_retry_queue_fn=lambda _path, queue: self.fail(f"unexpected retry save: {queue}"),
            fetch_records_for_environment_fn=lambda _env, _options: list(records),
            send_message_fn=lambda token, chat_id, text: sent_messages.append(
                (token, chat_id, text)
            ),
            request_with_backoff_fn=lambda fn, **_kwargs: fn(),
        )

        self.assertEqual(sent_messages, [])
        self.assertEqual(len(saved_states), 2)
        final_state = saved_states[-1]
        self.assertEqual(final_state.metrics.orders_with_fiscal_identifier, 2)
        self.assertEqual(final_state.metrics.consecutive_error_cycles, 0)
        self.assertEqual(final_state.notified_order_ids, ["order-1", "order-2"])
        self.assertEqual(final_state.memory.last_notified_order_id, "order-2")

    def test_maybe_send_new_order_notifications_persists_fetch_errors(self) -> None:
        state = BotRuntimeState(last_check="2026-04-07T08:00:00Z")
        saved_states: list[BotRuntimeState] = []

        with self.assertRaisesRegex(EbayApiError, "ebay_ko"):
            maybe_send_new_order_notifications(
                TelegramConfig(
                    token="bot-token",
                    allowed_chat_ids=None,
                    notify_chat_ids={10},
                    state_path="state.db",
                    retry_queue_path="retry.db",
                ),
                "production",
                load_state_fn=lambda _path: state,
                save_state_fn=lambda _path, current: saved_states.append(current),
                load_retry_queue_fn=lambda _path: [],
                save_retry_queue_fn=lambda _path, queue: None,
                fetch_records_for_environment_fn=lambda _env, _options: self.fail(
                    "unexpected fetch"
                ),
                send_message_fn=lambda token, chat_id, text: None,
                request_with_backoff_fn=lambda _fn, **_kwargs: (_ for _ in ()).throw(
                    EbayApiError("ebay_ko", status_code=503)
                ),
            )

        self.assertEqual(len(saved_states), 2)
        final_state = saved_states[-1]
        self.assertEqual(final_state.last_error, "ebay_ko")
        self.assertEqual(final_state.metrics.errors_by_type["ebay_fetch"], 1)
        self.assertEqual(final_state.metrics.consecutive_error_cycles, 1)
