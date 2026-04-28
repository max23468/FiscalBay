import unittest

from src.fiscalbay.scale_readiness import (
    build_scale_readiness_from_health,
    render_scale_readiness_report,
)


def _health_report(
    *,
    approved_users: int = 2,
    linked_accounts: int = 2,
    active_token_sets: int = 2,
    sqlite_db_bytes: int = 1024,
    limit: int = 25,
    sqlite_limit: int = 50 * 1024 * 1024,
    queue_failed: int = 0,
    tenant_stale: int = 0,
) -> dict[str, object]:
    return {
        "warnings": [],
        "public_service": {
            "approved_users": approved_users,
            "approved_users_limit": limit,
            "linked_accounts": linked_accounts,
            "linked_accounts_limit": limit,
            "active_token_sets": active_token_sets,
            "active_token_sets_limit": limit,
            "sqlite_db_bytes": sqlite_db_bytes,
            "sqlite_db_limit_bytes": sqlite_limit,
            "sqlite_migration_recommended": active_token_sets > limit
            or sqlite_db_bytes > sqlite_limit,
            "scale_within_policy": approved_users <= limit
            and linked_accounts <= limit
            and active_token_sets <= limit
            and sqlite_db_bytes <= sqlite_limit,
        },
        "operation_queue": {
            "pending": 0,
            "running": 0,
            "failed": queue_failed,
            "completed": 0,
            "cancelled": 0,
        },
        "tenant_snapshots": {
            "total": approved_users,
            "ready": linked_accounts,
            "reconnect_required": 0,
            "waiting_connect": 0,
            "stale": tenant_stale,
        },
        "metrics": {
            "orders_read": 0,
            "orders_with_fiscal_identifier": 0,
            "notifications_sent": 0,
            "telegram_retries": 0,
            "consecutive_error_cycles": 0,
            "ebay_errors": 0,
            "telegram_errors": 0,
        },
    }


class ScaleReadinessTests(unittest.TestCase):
    def test_within_policy_keeps_sqlite_as_default(self) -> None:
        report = build_scale_readiness_from_health(_health_report())  # type: ignore[arg-type]

        self.assertTrue(report["ok"])
        self.assertEqual(report["status"], "within_policy")
        self.assertIn("SQLite resta adeguato", report["summary"])
        self.assertIn("mantenere SQLite", " ".join(report["next_actions"]))

    def test_watch_when_near_soft_threshold_or_stale_snapshot(self) -> None:
        report = build_scale_readiness_from_health(
            _health_report(approved_users=15, tenant_stale=1)  # type: ignore[arg-type]
        )

        self.assertTrue(report["ok"])
        self.assertEqual(report["status"], "watch")
        self.assertIn("tenant_snapshot_stale", report["signals"])
        approved = next(item for item in report["triggers"] if item["name"] == "approved_users")
        self.assertEqual(approved["level"], "watch")

    def test_recommends_migration_preparation_before_limits_are_exceeded(self) -> None:
        report = build_scale_readiness_from_health(
            _health_report(active_token_sets=20)  # type: ignore[arg-type]
        )
        rendered = render_scale_readiness_report(report)

        self.assertTrue(report["ok"])
        self.assertEqual(report["status"], "migration_recommended")
        self.assertIn("prepara piano Postgres", report["summary"])
        self.assertIn("prova di migrazione", rendered)

    def test_requires_migration_when_public_limit_is_exceeded(self) -> None:
        report = build_scale_readiness_from_health(
            _health_report(active_token_sets=26)  # type: ignore[arg-type]
        )

        self.assertFalse(report["ok"])
        self.assertEqual(report["status"], "migration_required")
        self.assertIn("sqlite_migration_recommended", report["signals"])
        token_trigger = next(
            item for item in report["triggers"] if item["name"] == "active_token_sets"
        )
        self.assertEqual(token_trigger["level"], "required")


if __name__ == "__main__":
    unittest.main()
