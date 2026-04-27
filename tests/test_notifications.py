import unittest

from src.fiscalbay.models import BotRuntimeState
from src.fiscalbay.services.notifications import mark_cycle_result


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
