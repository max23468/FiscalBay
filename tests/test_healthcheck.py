import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from src.fiscalbay.healthcheck import (
    build_health_report,
    collect_resource_health,
    default_max_age_seconds,
    main,
    render_text_report,
)
from src.fiscalbay.models import AuditLogEntry, BotMetrics, BotRuntimeState, TelegramConfig
from src.fiscalbay.storage.sqlite import (
    append_audit_log_entry,
    save_retry_queue,
    save_state,
    save_tenant_runtime_state,
)


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
                        "orders_with_fiscal_identifier": 1,
                        "notifications_sent": 2,
                        "telegram_retries": 0,
                        "consecutive_error_cycles": 0,
                        "errors_by_type": {},
                    },
                },
            )

            with patch("src.fiscalbay.healthcheck.datetime") as mock_datetime:
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
                with patch("src.fiscalbay.healthcheck.load_telegram_config", return_value=config):
                    report = build_health_report()

            self.assertTrue(report["ok"])
            self.assertEqual(report["status"], "ok")
            self.assertEqual(report["reasons"], [])
            self.assertEqual(report["retry_queue_size"], 0)
            self.assertEqual(report["metrics"]["orders_read"], 4)
            self.assertEqual(report["metrics"]["orders_with_fiscal_identifier"], 1)
            self.assertEqual(report["metrics"]["telegram_errors"], 0)
            self.assertIn("multi_tenant", report)
            self.assertFalse(report["multi_tenant"]["tenant_credentials_ready"])
            self.assertIn("release", report)
            self.assertIn("release_status", report["release"])

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
                        "orders_with_fiscal_identifier": 0,
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

            with patch("src.fiscalbay.healthcheck.datetime") as mock_datetime:
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
                with patch("src.fiscalbay.healthcheck.load_telegram_config", return_value=config):
                    with patch("src.fiscalbay.healthcheck.service_is_active", return_value=False):
                        report = build_health_report(
                            max_age_seconds=60,
                            check_service_active=True,
                            max_consecutive_error_cycles=3,
                            max_retry_queue_size=0,
                        )

            self.assertFalse(report["ok"])
            self.assertIn("lock_missing", report["reasons"])
            self.assertIn("last_check_stale", report["reasons"])
            self.assertEqual(report["ignored_reasons"], [])
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
                        "orders_with_fiscal_identifier": 0,
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
                        orders_with_fiscal_identifier=2,
                        notifications_sent=1,
                        telegram_retries=0,
                        consecutive_error_cycles=0,
                        errors_by_type={},
                    ),
                ),
            )

            with patch("src.fiscalbay.healthcheck.datetime") as mock_datetime:
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
                with patch("src.fiscalbay.healthcheck.load_telegram_config", return_value=config):
                    report = build_health_report()

            self.assertTrue(report["ok"])
            self.assertEqual(report["status"], "ok")
            self.assertEqual(report["last_check"], "2026-04-05T20:02:00Z")
            self.assertEqual(report["metrics"]["orders_read"], 5)
            self.assertEqual(report["metrics"]["orders_with_fiscal_identifier"], 2)

    def test_build_health_report_can_ignore_stale_check_for_smoke_checks(self) -> None:
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
                    "last_error": "HTTP 504",
                    "metrics": {
                        "orders_read": 0,
                        "orders_with_fiscal_identifier": 0,
                        "notifications_sent": 0,
                        "telegram_retries": 0,
                        "consecutive_error_cycles": 3,
                        "errors_by_type": {"ebay_api": 1},
                    },
                },
            )

            with patch("src.fiscalbay.healthcheck.datetime") as mock_datetime:
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
                    lock_path=str(lock_path),
                )
                with patch("src.fiscalbay.healthcheck.load_telegram_config", return_value=config):
                    report = build_health_report(
                        max_age_seconds=60,
                        ignored_reasons=["last_check_stale"],
                    )

            self.assertTrue(report["ok"])
            self.assertEqual(report["status"], "ok")
            self.assertEqual(report["reasons"], ["last_check_stale"])
            self.assertEqual(report["ignored_reasons"], ["last_check_stale"])
            self.assertIn("last_error_present", report["warnings"])

    def test_build_health_report_exposes_retention_backlog(self) -> None:
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
                        "orders_with_fiscal_identifier": 0,
                        "notifications_sent": 0,
                        "telegram_retries": 0,
                        "consecutive_error_cycles": 0,
                        "errors_by_type": {},
                    },
                },
            )
            append_audit_log_entry(
                str(db_path),
                AuditLogEntry(event_type="old", created_at="2025-01-01T00:00:00Z"),
            )

            with patch("src.fiscalbay.healthcheck.datetime") as mock_datetime:
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
                with patch("src.fiscalbay.healthcheck.load_telegram_config", return_value=config):
                    report = build_health_report()

            self.assertTrue(report["ok"])
            self.assertEqual(report["retention"]["audit_overdue"], 1)
            self.assertIn("retention_prune_missing", report["warnings"])
            self.assertIn("audit_retention_backlog", report["warnings"])

    def test_collect_resource_health_reads_disk_inode_and_memory(self) -> None:
        disk_usage = SimpleNamespace(total=1000, used=850, free=150)
        statvfs = SimpleNamespace(f_files=100, f_ffree=20)
        with patch("src.fiscalbay.healthcheck.shutil.disk_usage", return_value=disk_usage):
            with patch("src.fiscalbay.healthcheck.os.statvfs", return_value=statvfs):
                with patch(
                    "src.fiscalbay.healthcheck._read_linux_meminfo",
                    return_value={"MemTotal": 1024 * 1024, "MemAvailable": 256 * 1024},
                ):
                    resources = collect_resource_health("/opt/fiscalbay")

        self.assertEqual(resources["resource_path"], "/opt/fiscalbay")
        self.assertEqual(resources["disk_used_percent"], 85.0)
        self.assertEqual(resources["inode_used"], 80)
        self.assertEqual(resources["inode_used_percent"], 80.0)
        self.assertEqual(resources["memory_total_mb"], 1024)
        self.assertEqual(resources["memory_available_mb"], 256)
        self.assertEqual(resources["memory_available_percent"], 25.0)

    def test_build_health_report_alerts_on_resource_thresholds(self) -> None:
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
                        "orders_with_fiscal_identifier": 0,
                        "notifications_sent": 0,
                        "telegram_retries": 0,
                        "consecutive_error_cycles": 0,
                        "errors_by_type": {},
                    },
                },
            )

            with patch("src.fiscalbay.healthcheck.datetime") as mock_datetime:
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
                resources = {
                    "resource_path": "/opt/fiscalbay",
                    "disk_total_bytes": 1000,
                    "disk_used_bytes": 920,
                    "disk_free_bytes": 80,
                    "disk_used_percent": 92.0,
                    "inode_total": 100,
                    "inode_used": 91,
                    "inode_free": 9,
                    "inode_used_percent": 91.0,
                    "memory_total_mb": 1024,
                    "memory_available_mb": 64,
                    "memory_available_percent": 6.25,
                }
                with patch("src.fiscalbay.healthcheck.load_telegram_config", return_value=config):
                    with patch(
                        "src.fiscalbay.healthcheck.collect_resource_health",
                        return_value=resources,
                    ):
                        report = build_health_report(
                            max_disk_used_percent=90,
                            max_inode_used_percent=90,
                            min_memory_available_mb=128,
                            resource_path="/opt/fiscalbay",
                        )

            self.assertFalse(report["ok"])
            self.assertIn("disk_used_percent_exceeded", report["alerts"])
            self.assertIn("inode_used_percent_exceeded", report["alerts"])
            self.assertIn("memory_available_mb_below_minimum", report["alerts"])

    def test_build_health_report_alerts_on_public_service_policy_limits(self) -> None:
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
                        "orders_with_fiscal_identifier": 0,
                        "notifications_sent": 0,
                        "telegram_retries": 0,
                        "consecutive_error_cycles": 0,
                        "errors_by_type": {},
                    },
                },
            )

            with patch.dict(
                "os.environ",
                {
                    "FISCALBAY_PUBLIC_MAX_APPROVED_USERS": "1",
                    "FISCALBAY_PUBLIC_MAX_LINKED_ACCOUNTS": "1",
                    "FISCALBAY_PUBLIC_MAX_ACTIVE_TOKEN_SETS": "1",
                    "FISCALBAY_SQLITE_MAX_DB_BYTES": "1048576",
                },
                clear=False,
            ):
                with patch("src.fiscalbay.healthcheck.datetime") as mock_datetime:
                    from datetime import datetime, timezone

                    mock_datetime.now.return_value = datetime(
                        2026, 4, 5, 20, 2, 0, tzinfo=timezone.utc
                    )
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
                    readiness = {
                        "tenant_users": 4,
                        "approved_users": 2,
                        "pending_users": 1,
                        "blocked_users": 1,
                        "tenant_chats": 4,
                        "linked_accounts": 2,
                        "active_token_sets": 2,
                        "notification_subscriptions": 2,
                        "tenant_runtime_states": 2,
                    }
                    resources = collect_resource_health(str(Path(tmpdir)))
                    with patch(
                        "src.fiscalbay.healthcheck.load_telegram_config",
                        return_value=config,
                    ):
                        with patch(
                            "src.fiscalbay.healthcheck.summarize_multi_tenant_readiness",
                            return_value=readiness,
                        ):
                            with patch(
                                "src.fiscalbay.healthcheck.collect_resource_health",
                                return_value=resources,
                            ):
                                with patch(
                                    "src.fiscalbay.healthcheck.Path.stat",
                                    return_value=SimpleNamespace(st_size=2_000_000),
                                ):
                                    report = build_health_report()

            self.assertFalse(report["ok"])
            self.assertIn("public_approved_users_limit_exceeded", report["alerts"])
            self.assertIn("public_linked_accounts_limit_exceeded", report["alerts"])
            self.assertIn("public_active_token_sets_limit_exceeded", report["alerts"])
            self.assertIn("sqlite_db_size_limit_exceeded", report["alerts"])
            self.assertIn("sqlite_migration_recommended", report["warnings"])
            self.assertFalse(report["public_service"]["scale_within_policy"])

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
                    "orders_with_fiscal_identifier": 3,
                    "notifications_sent": 2,
                    "telegram_retries": 1,
                    "consecutive_error_cycles": 2,
                    "ebay_errors": 0,
                    "telegram_errors": 2,
                },
                "reasons": ["lock_missing"],
                "ignored_reasons": ["last_check_stale"],
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
                "release": {
                    "package_version": "1.0.1",
                    "package_version_source": "pyproject",
                    "git_commit": "abc123456",
                    "git_short_commit": "abc1234",
                    "git_branch": "main",
                    "git_tag": "v1.0.1",
                    "git_latest_tag": "v1.0.1",
                    "git_commits_since_latest_tag": 0,
                    "git_dirty": False,
                    "release_status": "tagged_clean",
                },
            }
        )
        self.assertIn("status: fail", text)
        self.assertIn("metrics.orders_with_fiscal_identifier: 3", text)
        self.assertIn("alerts: service_inactive", text)
        self.assertIn("reasons: lock_missing", text)
        self.assertIn("ignored_reasons: last_check_stale", text)
        self.assertIn("warnings: retry_queue_not_empty", text)
        self.assertIn("multi_tenant.tenant_users: 1", text)
        self.assertIn("release.package_version: 1.0.1", text)
        self.assertIn("release.status: tagged_clean", text)

    @patch("src.fiscalbay.healthcheck.build_health_report")
    def test_main_can_render_json(self, mock_build_health_report) -> None:
        mock_build_health_report.return_value = {
            "ok": True,
            "status": "ok",
            "reasons": [],
            "ignored_reasons": [],
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
                "orders_with_fiscal_identifier": 1,
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
