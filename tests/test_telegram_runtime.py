import threading
import unittest
from unittest.mock import Mock, patch

from src.fiscalbay.errors import AppError, TelegramApiError
from src.fiscalbay.models import TelegramConfig
from src.fiscalbay.services import telegram_runtime


class TelegramRuntimeTests(unittest.TestCase):
    def telegram_config(self) -> TelegramConfig:
        return TelegramConfig(
            token="telegram-token",
            allowed_chat_ids=set(),
            notify_chat_ids=set(),
            poll_timeout_seconds=1,
            ebay_poll_interval_seconds=60,
            state_path="state.db",
            retry_queue_path="state.db",
            lock_path="bot.lock",
        )

    def test_extract_message_and_callback_contexts_handle_threads_and_actor_names(self) -> None:
        message_update = {
            "message": {
                "chat": {"id": 456, "type": "private"},
                "from": {
                    "id": 123,
                    "username": "mrossi",
                    "first_name": "Mario",
                    "last_name": "Rossi",
                },
                "text": "/start",
                "message_thread_id": 99,
            }
        }
        callback_update = {
            "callback_query": {
                "id": "cb-1",
                "data": "menu:help",
                "from": {"id": 123, "username": "mrossi"},
                "message": {"chat": {"id": 456, "type": "group"}, "message_thread_id": "ignored"},
            }
        }

        self.assertEqual(
            telegram_runtime.extract_message_context(message_update), (456, "/start", 99)
        )
        self.assertEqual(
            telegram_runtime.extract_message_actor(message_update),
            (123, 456, "mrossi", "Mario Rossi", "private"),
        )
        self.assertEqual(
            telegram_runtime.extract_callback_context(callback_update),
            ("cb-1", 456, "menu:help", None),
        )
        self.assertEqual(
            telegram_runtime.extract_callback_actor(callback_update),
            (123, 456, "mrossi", "mrossi", "group"),
        )

    def test_request_shutdown_sets_active_event(self) -> None:
        shutdown_event = threading.Event()
        previous = telegram_runtime._ACTIVE_SHUTDOWN_EVENT
        telegram_runtime._ACTIVE_SHUTDOWN_EVENT = shutdown_event
        self.addCleanup(setattr, telegram_runtime, "_ACTIVE_SHUTDOWN_EVENT", previous)

        telegram_runtime.request_shutdown(15, None)

        self.assertTrue(shutdown_event.is_set())

    def test_auto_notify_loop_runs_once_and_stops_when_wait_returns_true(self) -> None:
        shutdown_event = Mock()
        shutdown_event.is_set.side_effect = [False]
        shutdown_event.wait.return_value = True
        notify_mock = Mock()

        telegram_runtime.auto_notify_loop(
            self.telegram_config(),
            "production",
            shutdown_event=shutdown_event,
            maybe_send_new_order_notifications_fn=notify_mock,
        )

        notify_mock.assert_called_once()
        shutdown_event.wait.assert_called_once_with(timeout=60)

    @patch("src.fiscalbay.services.telegram_runtime.signal.signal")
    @patch("src.fiscalbay.services.telegram_runtime.telegram_request")
    @patch("src.fiscalbay.services.telegram_runtime.ensure_long_polling")
    def test_run_bot_processes_message_callback_and_releases_lock(
        self,
        ensure_long_polling_mock,
        telegram_request_mock,
        _signal_mock,
    ) -> None:
        config = self.telegram_config()
        lock_handle = object()
        sent_messages: list[tuple[str, int, str]] = []
        updates = [
            {
                "update_id": 10,
                "message": {
                    "chat": {"id": 456, "type": "private"},
                    "from": {"id": 123, "username": "mrossi"},
                    "text": "/ping",
                },
            },
            {
                "update_id": 11,
                "callback_query": {
                    "id": "cb-1",
                    "data": "menu:help",
                    "from": {"id": 123, "username": "mrossi"},
                    "message": {"chat": {"id": 456, "type": "private"}},
                },
            },
            {"update_id": 12, "message": {"chat": {"id": 456}, "text": "   "}},
        ]

        def request_with_backoff(action, *, label: str):
            self.assertEqual(label, "getUpdates")
            del action
            if request_with_backoff.calls:
                raise KeyboardInterrupt
            request_with_backoff.calls += 1
            return updates

        request_with_backoff.calls = 0

        exit_code = telegram_runtime.run_bot(
            configure_logging_fn=Mock(),
            load_telegram_config_fn=Mock(return_value=config),
            acquire_process_lock_fn=Mock(return_value=lock_handle),
            release_process_lock_fn=Mock(),
            process_message_fn=Mock(side_effect=lambda **kwargs: [f"reply:{kwargs['text']}"]),
            register_runtime_contact_fn=Mock(),
            send_message_fn=lambda token, chat_id, text, **_kwargs: sent_messages.append(
                (token, chat_id, text)
            ),
            maybe_send_new_order_notifications_fn=Mock(),
            request_with_backoff_fn=request_with_backoff,
            sync_bot_branding_fn=Mock(),
        )

        self.assertEqual(exit_code, 0)
        ensure_long_polling_mock.assert_called_once_with("telegram-token")
        telegram_request_mock.assert_called_once_with(
            "telegram-token",
            "answerCallbackQuery",
            {"callback_query_id": "cb-1", "text": "Comando eseguito"},
        )
        self.assertEqual(
            sent_messages,
            [
                ("telegram-token", 456, "reply:/ping"),
                ("telegram-token", 456, "reply:/help"),
            ],
        )

    @patch("src.fiscalbay.services.telegram_runtime.signal.signal")
    @patch("src.fiscalbay.services.telegram_runtime.ensure_long_polling")
    def test_run_bot_reports_configuration_errors_and_releases_acquired_lock(
        self,
        ensure_long_polling_mock,
        _signal_mock,
    ) -> None:
        config = self.telegram_config()
        release_lock_mock = Mock()

        exit_code = telegram_runtime.run_bot(
            configure_logging_fn=Mock(),
            load_telegram_config_fn=Mock(return_value=config),
            acquire_process_lock_fn=Mock(return_value="lock"),
            release_process_lock_fn=release_lock_mock,
            process_message_fn=Mock(),
            register_runtime_contact_fn=Mock(),
            send_message_fn=Mock(),
            maybe_send_new_order_notifications_fn=Mock(),
            request_with_backoff_fn=Mock(),
            sync_bot_branding_fn=Mock(side_effect=AppError("branding errata")),
        )

        self.assertEqual(exit_code, 1)
        ensure_long_polling_mock.assert_called_once_with("telegram-token")
        release_lock_mock.assert_called_once_with("lock", "bot.lock")

    @patch("src.fiscalbay.services.telegram_runtime.signal.signal")
    @patch("src.fiscalbay.services.telegram_runtime.telegram_request")
    @patch("src.fiscalbay.services.telegram_runtime.ensure_long_polling")
    def test_run_bot_logs_send_and_callback_ack_failures(
        self,
        _ensure_long_polling_mock,
        telegram_request_mock,
        _signal_mock,
    ) -> None:
        config = self.telegram_config()
        telegram_request_mock.side_effect = TelegramApiError("ack ko")

        def request_with_backoff(_action, *, label: str):
            if request_with_backoff.calls:
                raise KeyboardInterrupt
            request_with_backoff.calls += 1
            return [
                {
                    "update_id": 20,
                    "callback_query": {
                        "id": "cb-2",
                        "data": "menu:help",
                        "from": {"id": 123},
                        "message": {"chat": {"id": 456}},
                    },
                }
            ]

        request_with_backoff.calls = 0

        exit_code = telegram_runtime.run_bot(
            configure_logging_fn=Mock(),
            load_telegram_config_fn=Mock(return_value=config),
            acquire_process_lock_fn=Mock(return_value="lock"),
            release_process_lock_fn=Mock(),
            process_message_fn=Mock(return_value=["reply"]),
            register_runtime_contact_fn=Mock(),
            send_message_fn=Mock(side_effect=TelegramApiError("send ko")),
            maybe_send_new_order_notifications_fn=Mock(),
            request_with_backoff_fn=request_with_backoff,
        )

        self.assertEqual(exit_code, 0)


if __name__ == "__main__":
    unittest.main()
