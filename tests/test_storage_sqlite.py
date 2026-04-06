import sqlite3
import tempfile
import unittest
from pathlib import Path

from src.ebay_cf.storage.sqlite import (
    SCHEMA_VERSION,
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
                    "orders_with_cf": 2,
                    "notifications_sent": 3,
                    "telegram_retries": 1,
                    "consecutive_error_cycles": 2,
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
                    "orders_with_cf": 2,
                    "notifications_sent": 3,
                    "telegram_retries": 1,
                    "consecutive_error_cycles": 2,
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
            self.assertEqual(len(restored), 2)
            self.assertEqual(restored[0]["chat_id"], 123)
            self.assertEqual(restored[0]["text"], "msg-1")
            self.assertEqual(restored[0]["attempts"], 1)
            self.assertIn("id", restored[0])
            self.assertEqual(restored[1]["chat_id"], 456)
            self.assertEqual(restored[1]["text"], "msg-2")
            self.assertEqual(restored[1]["attempts"], 2)
            self.assertIn("id", restored[1])

    def test_legacy_notified_orders_table_is_migrated(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"

            with sqlite3.connect(db_path) as conn:
                conn.execute("CREATE TABLE notified_orders (order_id TEXT, hash TEXT)")
                conn.execute(
                    "CREATE TABLE retry_queue "
                    "("
                    "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                    "chat_id INTEGER, text TEXT, attempts INTEGER"
                    ")"
                )
                conn.execute("CREATE TABLE kv_store (key TEXT PRIMARY KEY, value TEXT)")
                conn.execute(
                    "INSERT INTO notified_orders (order_id, hash) VALUES (?, ?)",
                    ("legacy-order", "legacy-hash"),
                )
                conn.execute(
                    "INSERT INTO kv_store (key, value) VALUES (?, ?)",
                    ("last_check", "2026-04-05T20:00:00Z"),
                )

            restored = load_state(str(db_path))
            self.assertEqual(restored["notified_order_ids"], ["legacy-order"])
            self.assertEqual(restored["notified_hashes"], ["legacy-hash"])
            self.assertEqual(restored["last_check"], "2026-04-05T20:00:00Z")

            with sqlite3.connect(db_path) as conn:
                version = conn.execute("PRAGMA user_version").fetchone()[0]
                self.assertEqual(version, SCHEMA_VERSION)
                legacy = conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='notified_orders'"
                ).fetchone()
                self.assertIsNone(legacy)
                ids = conn.execute("SELECT order_id FROM notified_order_ids").fetchall()
                hashes = conn.execute("SELECT hash FROM notified_hashes").fetchall()
                self.assertEqual(ids[0][0], "legacy-order")
                self.assertEqual(hashes[0][0], "legacy-hash")

    def test_save_state_removes_stale_values_without_duplicates(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"

            save_state(
                str(db_path),
                {
                    "notified_order_ids": ["order-1", "order-2", "order-2"],
                    "notified_hashes": ["hash-1", "hash-2", "hash-2"],
                    "last_check": None,
                    "last_error": None,
                    "metrics": {},
                },
            )
            save_state(
                str(db_path),
                {
                    "notified_order_ids": ["order-2"],
                    "notified_hashes": ["hash-2"],
                    "last_check": None,
                    "last_error": None,
                    "metrics": {},
                },
            )

            restored = load_state(str(db_path))
            self.assertEqual(restored["notified_order_ids"], ["order-2"])
            self.assertEqual(restored["notified_hashes"], ["hash-2"])

    def test_retry_queue_updates_existing_rows_without_full_reset(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"

            save_retry_queue(
                str(db_path),
                [
                    {"chat_id": 123, "text": "msg-1", "attempts": 1},
                    {"chat_id": 456, "text": "msg-2", "attempts": 2},
                ],
            )
            initial = load_retry_queue(str(db_path))

            save_retry_queue(
                str(db_path),
                [
                    {
                        "id": initial[1]["id"],
                        "chat_id": 456,
                        "text": "msg-2-updated",
                        "attempts": 3,
                    },
                    {
                        "chat_id": 789,
                        "text": "msg-3",
                        "attempts": 0,
                    },
                ],
            )

            restored = load_retry_queue(str(db_path))
            self.assertEqual(len(restored), 2)
            self.assertEqual(restored[0]["id"], initial[1]["id"])
            self.assertEqual(restored[0]["chat_id"], 456)
            self.assertEqual(restored[0]["text"], "msg-2-updated")
            self.assertEqual(restored[0]["attempts"], 3)
            self.assertEqual(restored[1]["chat_id"], 789)
            self.assertEqual(restored[1]["text"], "msg-3")

    def test_legacy_json_state_file_is_migrated_to_sqlite(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "notified_orders.json"
            db_path.write_text(
                (
                    '{"notified_order_ids":["order-1"],'
                    '"notified_hashes":["hash-1"],'
                    '"last_check":"2026-04-05T20:00:00Z",'
                    '"last_error":null,'
                    '"metrics":{"orders_read":2,"orders_with_cf":1,"notifications_sent":1,"telegram_retries":0,"consecutive_error_cycles":0,"errors_by_type":{}}}'
                ),
                encoding="utf-8",
            )

            restored = load_state(str(db_path))

            self.assertEqual(restored["notified_order_ids"], ["order-1"])
            self.assertEqual(restored["notified_hashes"], ["hash-1"])
            self.assertEqual(restored["last_check"], "2026-04-05T20:00:00Z")
            self.assertTrue((Path(tmpdir) / "notified_orders.json.legacy-json.bak").exists())

            with sqlite3.connect(db_path) as conn:
                version = conn.execute("PRAGMA user_version").fetchone()[0]
                self.assertEqual(version, SCHEMA_VERSION)

    def test_legacy_json_retry_queue_file_is_migrated_to_sqlite(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "failed_notifications.json"
            db_path.write_text(
                '[{"chat_id":123,"text":"retry me","attempts":2}]',
                encoding="utf-8",
            )

            restored = load_retry_queue(str(db_path))

            self.assertEqual(len(restored), 1)
            self.assertEqual(restored[0]["chat_id"], 123)
            self.assertEqual(restored[0]["text"], "retry me")
            self.assertEqual(restored[0]["attempts"], 2)
            self.assertTrue((Path(tmpdir) / "failed_notifications.json.legacy-json.bak").exists())


if __name__ == "__main__":
    unittest.main()
