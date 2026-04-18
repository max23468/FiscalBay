import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src.ebay_cf.healthcheck import (
    build_health_report,
    default_max_age_seconds,
    main,
    render_text_report,
)
from src.ebay_cf.models import BotMetrics, BotRuntimeState, TelegramConfig
from src.ebay_cf.storage.sqlite import save_retry_queue, save_state, save_tenant_runtime_state


class HealthcheckTests(unittest.TestCase):
    def test_default_max_age_seconds_uses_safe_floor(self) -> None:
        self.assertEqual(default_max_age_seconds(120), 360)
        self.assertEqual(default_max_age_seconds(60), 300)

    def test_build_health_report_is_ok_for_recent_state_and_lock(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            lock_path = Path(tmpdir) / "telegram_bot.lock"
            lock_path.write_text("pid=123\n", encoding="utf-8")
            save_state(
                str(db_path),
                {
                    "notified_order_ids": ["order-1"],
                    "notified_hashes": ["hash-1"],
                    "last_check": "2026-04-05T20:00:00Z",
                    "last_error": None,
                    "metrics": {
                        "orders_read": 4,
                        "orders_with_cf": 1,
                        "notifications_sent": 2,
                        "telegram_retries": 0,
                        "consecutive_error_cycles": 0,
                        "errors_by_type": {},
                    },
                },
            )

            with patch("src.ebay_cf.healthcheck.datetime") as mock_datetime:
                from datetime import datetime, timezone

                mock_datetime.now.return_value = datetime(2026, 4, 5, 20, 2, 0, tzinfo=timezone.utc)
                mock_datetime.fromisoformat = datetime.fromisoformat
                config = TelegramConfig(
                    token="x",
                    allowed_chat_ids=None,
                    notify_chat_ids={123},
                    ebay_poll_interval_seconds=120,
                    state_path=str(db_path),
                    retry_queue_path=str(db_path),
                    lock_path=str(lock_path),
                )
                with patch("src.ebay_cf.healthcheck.load_telegram_config", return_value=config):
                    report = build_health_report()

            self.assertTrue(report["ok"])
            self.assertEqual(report["status"], "ok")
            self.assertEqual(report["reasons"], [])
            self.assertEqual(report["retry_queue_size"], 0)
            self.assertEqual(report["metrics"]["orders_read"], 4)
            self.assertEqual(report["metrics"]["orders_with_cf"], 1)
            self.assertEqual(report["metrics"]["telegram_errors"], 0)
            self.assertIn("multi_tenant", report)
            self.assertFalse(report["multi_tenant"]["tenant_credentials_ready"])

    def test_build_health_report_fails_for_missing_lock_and_stale_check(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            save_state(
                str(db_path),
                {
                    "notified_order_ids": [],
                    "notified_hashes": [],
                    "last_check": "2026-04-05T20:00:00Z",
                    "last_error": "telegram timeout",
                    "metrics": {
                        "orders_read": 0,
                        "orders_with_cf": 0,
                        "notifications_sent": 0,
                        "telegram_retries": 2,
                        "consecutive_error_cycles": 4,
                        "errors_by_type": {"telegram_send": 1},
                    },
                },
            )
            save_retry_queue(
                str(db_path),
                [{"chat_id": 123, "text": "retry me", "attempts": 1}],
            )

            with patch("src.ebay_cf.healthcheck.datetime") as mock_datetime:
                from datetime import datetime, timezone

                mock_datetime.now.return_value = datetime(2026, 4, 5, 21, 0, 0, tzinfo=timezone.utc)
                mock_datetime.fromisoformat = datetime.fromisoformat
                config = TelegramConfig(
                    token="x",
                    allowed_chat_ids=None,
                    notify_chat_ids={123},
                    ebay_poll_interval_seconds=120,
                    state_path=str(db_path),
                    retry_queue_path=str(db_path),
                    lock_path=str(Path(tmpdir) / "missing.lock"),
                )
                with patch("src.ebay_cf.healthcheck.load_telegram_config", return_value=config):
                    with patch("src.ebay_cf.healthcheck.service_is_active", return_value=False):
                        report = build_health_report(
                            max_age_seconds=60,
                            check_service_active=True,
                            max_consecutive_error_cycles=3,
                            max_retry_queue_size=0,
                        )

            self.assertFalse(report["ok"])
            self.assertIn("lock_missing", report["reasons"])
            self.assertIn("last_check_stale", report["reasons"])
            self.assertIn("last_error_present", report["warnings"])
            self.assertIn("retry_queue_not_empty", report["warnings"])
            self.assertEqual(report["metrics"]["telegram_retries"], 2)
            self.assertEqual(report["metrics"]["telegram_errors"], 1)
            self.assertIn("service_inactive", report["alerts"])
            self.assertIn("consecutive_error_cycles_exceeded", report["alerts"])
            self.assertIn("retry_queue_size_exceeded", report["alerts"])

    def test_build_health_report_prefers_fresh_tenant_runtime_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            lock_path = Path(tmpdir) / "telegram_bot.lock"
            lock_path.write_text("pid=123\n", encoding="utf-8")
            save_state(
                str(db_path),
                {
                    "notified_order_ids": [],
                    "notified_hashes": [],
                    "last_check": "2026-04-05T20:00:00Z",
                    "last_error": None,
                    "metrics": {
                        "orders_read": 0,
                        "orders_with_cf": 0,
                        "notifications_sent": 0,
                        "telegram_retries": 0,
                        "consecutive_error_cycles": 0,
                        "errors_by_type": {},
                    },
                },
            )
            save_tenant_runtime_state(
                str(db_path),
                42,
                BotRuntimeState(
                    last_check="2026-04-05T20:02:00Z",
                    metrics=BotMetrics(
                        orders_read=5,
                        orders_with_cf=2,
                        notifications_sent=1,
                        telegram_retries=0,
                        consecutive_error_cycles=0,
                        errors_by_type={},
                    ),
                ),
            )

            with patch("src.ebay_cf.healthcheck.datetime") as mock_datetime:
                from datetime import datetime, timezone

                mock_datetime.now.return_value = datetime(2026, 4, 5, 20, 3, 0, tzinfo=timezone.utc)
                mock_datetime.fromisoformat = datetime.fromisoformat
                config = TelegramConfig(
                    token="x",
                    allowed_chat_ids=None,
                    notify_chat_ids={123},
                    ebay_poll_interval_seconds=120,
                    state_path=str(db_path),
                    retry_queue_path=str(db_path),
                    lock_path=str(lock_path),
                )
                with patch("src.ebay_cf.healthcheck.load_telegram_config", return_value=config):
                    report = build_health_report()

            self.assertTrue(report["ok"])
            self.assertEqual(report["status"], "ok")
            self.assertEqual(report["last_check"], "2026-04-05T20:02:00Z")
            self.assertEqual(report["metrics"]["orders_read"], 5)
            self.assertEqual(report["metrics"]["orders_with_cf"], 2)

    def test_render_text_report_includes_reasons_and_warnings(self) -> None:
        text = render_text_report(
            {
                "status": "fail",
                "lock_exists": False,
                "last_check": None,
                "last_check_age_seconds": None,
                "max_age_seconds": 300,
                "retry_queue_size": 2,
                "notified_orders_tracked": 4,
                "last_error": "boom",
                "metrics": {
                    "orders_read": 8,
                    "orders_with_cf": 3,
                    "notifications_sent": 2,
                    "telegram_retries": 1,
                    "consecutive_error_cycles": 2,
                    "ebay_errors": 0,
                    "telegram_errors": 2,
                },
                "reasons": ["lock_missing"],
                "warnings": ["retry_queue_not_empty"],
                "alerts": ["service_inactive"],
                "multi_tenant": {
                    "tenant_users": 1,
                    "tenant_chats": 1,
                    "linked_accounts": 0,
                    "active_token_sets": 0,
                    "notification_subscriptions": 1,
                    "tenant_runtime_states": 0,
                    "tenant_credentials_ready": False,
                },
            }
        )
        self.assertIn("status: fail", text)
        self.assertIn("metrics.orders_with_cf: 3", text)
        self.assertIn("alerts: service_inactive", text)
        self.assertIn("reasons: lock_missing", text)
        self.assertIn("warnings: retry_queue_not_empty", text)
        self.assertIn("multi_tenant.tenant_users: 1", text)

    @patch("src.ebay_cf.healthcheck.build_health_report")
    def test_main_can_render_json(self, mock_build_health_report) -> None:
        mock_build_health_report.return_value = {
            "ok": True,
            "status": "ok",
            "reasons": [],
            "warnings": [],
            "lock_exists": True,
            "last_check": "2026-04-05T20:00:00Z",
            "last_check_age_seconds": 12,
            "max_age_seconds": 300,
            "retry_queue_size": 0,
            "notified_orders_tracked": 1,
            "last_error": None,
            "metrics": {
                "orders_read": 1,
                "orders_with_cf": 1,
                "notifications_sent": 1,
                "telegram_retries": 0,
                "consecutive_error_cycles": 0,
                "ebay_errors": 0,
                "telegram_errors": 0,
            },
            "alerts": [],
            "multi_tenant": {
                "tenant_users": 0,
                "tenant_chats": 0,
                "linked_accounts": 0,
                "active_token_sets": 0,
                "notification_subscriptions": 0,
                "tenant_runtime_states": 0,
                "tenant_credentials_ready": False,
            },
        }

        with patch("builtins.print") as mock_print:
            exit_code = main(["--json"])

        self.assertEqual(exit_code, 0)
        printed = mock_print.call_args.args[0]
        self.assertEqual(json.loads(printed)["status"], "ok")
