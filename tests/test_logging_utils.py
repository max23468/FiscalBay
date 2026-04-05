import logging
import unittest
from unittest.mock import Mock

from src.ebay_cf.logging_utils import format_log_context, log_event


class LoggingUtilsTests(unittest.TestCase):
    def test_format_log_context_sorts_and_normalizes_fields(self) -> None:
        rendered = format_log_context(
            "notify_cycle_complete",
            retry_queue_size=2,
            last_error="telegram timeout",
            empty="",
        )
        self.assertEqual(
            rendered,
            'event=notify_cycle_complete empty="" last_error=telegram_timeout retry_queue_size=2',
        )

    def test_log_event_uses_formatted_message(self) -> None:
        logger = Mock(spec=logging.Logger)

        log_event(logger, logging.INFO, "bot_started", environment="production")

        logger.log.assert_called_once_with(logging.INFO, "event=bot_started environment=production")
