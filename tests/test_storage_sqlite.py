import tempfile
import unittest
from pathlib import Path

from src.ebay_cf.storage.sqlite import (
    load_retry_queue,
    load_state,
    save_retry_queue,
    save_state,
)


class SQLiteStorageIntegrationTests(unittest.TestCase):
    def test_state_roundtrip_on_temp_sqlite_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"

            initial = load_state(str(db_path))
            self.assertEqual(initial["notified_order_ids"], [])
            self.assertEqual(initial["notified_hashes"], [])
            self.assertIsNone(initial["last_check"])

            state = {
                "notified_order_ids": ["order-1", "order-2"],
                "notified_hashes": ["hash-1", "hash-2"],
                "last_check": "2026-04-05T20:00:00Z",
                "last_error": "boom",
                "metrics": {
                    "orders_read": 7,
                    "notifications_sent": 3,
                    "errors_by_type": {"telegram_send": 1},
                },
            }
            save_state(str(db_path), state)

            restored = load_state(str(db_path))
            self.assertEqual(restored["notified_order_ids"], ["order-1", "order-2"])
            self.assertEqual(restored["notified_hashes"], ["hash-1", "hash-2"])
            self.assertEqual(restored["last_check"], "2026-04-05T20:00:00Z")
            self.assertEqual(restored["last_error"], "boom")
            self.assertEqual(
                restored["metrics"],
                {
                    "orders_read": 7,
                    "notifications_sent": 3,
                    "errors_by_type": {"telegram_send": 1},
                },
            )

    def test_retry_queue_roundtrip_on_temp_sqlite_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"

            self.assertEqual(load_retry_queue(str(db_path)), [])

            queue = [
                {"chat_id": 123, "text": "msg-1", "attempts": 1},
                {"chat_id": 456, "text": "msg-2", "attempts": 2},
            ]
            save_retry_queue(str(db_path), queue)

            restored = load_retry_queue(str(db_path))
            self.assertEqual(restored, queue)


if __name__ == "__main__":
    unittest.main()
