import grp
import os
import pwd
import tempfile
import unittest
from pathlib import Path

from src.fiscalbay.security_ops import build_security_ops_report, render_security_ops_report


def _write_env(path: Path, values: dict[str, str]) -> None:
    path.write_text("\n".join(f"{key}={value}" for key, value in values.items()), encoding="utf-8")


class SecurityOpsTests(unittest.TestCase):
    def test_build_security_ops_report_uses_deployed_runtime_identity(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            env_path = root / ".env"
            state_db = root / "state.db"
            identity_path = root / "runtime.env"
            _write_env(env_path, {})
            state_db.write_text("sqlite", encoding="utf-8")
            os.chmod(env_path, 0o640)
            os.chmod(state_db, 0o600)
            _write_env(
                identity_path,
                {
                    "APP_USER": pwd.getpwuid(os.getuid()).pw_name,
                    "APP_GROUP": grp.getgrgid(os.getgid()).gr_name,
                },
            )

            report = build_security_ops_report(
                env_file=str(env_path),
                state_db_path=str(state_db),
                runtime_identity_file=str(identity_path),
                backup_root=str(root / "backups"),
                restore_check_root=str(root / "restore-check"),
                env_expected_uid=os.getuid(),
            )

            self.assertTrue(report["env_file"]["owner_ok"])
            self.assertTrue(report["state_db"]["owner_ok"])

    def test_build_security_ops_report_accepts_locked_down_runtime_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            env_path = root / ".env"
            state_db = root / "state.db"
            backup = root / "backups" / "2026-04-28-fiscalbay"
            restore = root / "restore-check" / "2026-04-28-fiscalbay"
            backup.mkdir(parents=True)
            restore.mkdir(parents=True)
            (backup / "MANIFEST.txt").write_text("backup\n", encoding="utf-8")
            (restore / "MANIFEST.txt").write_text("restore\n", encoding="utf-8")
            _write_env(
                env_path,
                {
                    "TELEGRAM_BOT_TOKEN": "telegram-secret",
                    "TELEGRAM_ALLOWED_CHAT_IDS": "*",
                    "TELEGRAM_ADMIN_USER_ID": "123",
                    "EBAY_CLIENT_ID": "client",
                    "EBAY_CLIENT_SECRET": "ebay-secret",
                    "EBAY_TENANT_TOKEN_KEY": "tenant-key",
                    "EBAY_OAUTH_RUNAME": "runame",
                    "EBAY_OAUTH_CONNECT_BASE_URL": "https://example.test",
                    "FISCALBAY_PUBLIC_SERVICE_MODEL": "approved_public_small",
                    "EBAY_ORDER_STATE_PATH": str(state_db),
                },
            )
            state_db.write_text("sqlite", encoding="utf-8")
            os.chmod(env_path, 0o640)
            os.chmod(state_db, 0o660)

            report = build_security_ops_report(
                env_file=str(env_path),
                backup_root=str(root / "backups"),
                restore_check_root=str(root / "restore-check"),
                max_backup_age_hours=24,
                max_restore_drill_age_hours=24,
                env_expected_uid=os.getuid(),
                env_expected_gid=os.getgid(),
                state_expected_uid=os.getuid(),
                state_expected_gid=os.getgid(),
            )

            self.assertTrue(report["ok"])
            self.assertEqual(report["alerts"], [])
            self.assertEqual(report["env_file"]["mode"], "640")
            self.assertEqual(report["state_db"]["mode"], "660")
            self.assertTrue(report["telegram_allow_all"])
            self.assertTrue(report["admin_configured"])

    def test_build_security_ops_report_flags_sensitive_misconfiguration(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            env_path = root / ".env"
            state_db = root / "state.db"
            _write_env(
                env_path,
                {
                    "TELEGRAM_BOT_TOKEN": "telegram-secret",
                    "TELEGRAM_ALLOWED_CHAT_IDS": "*",
                    "EBAY_CLIENT_ID": "client",
                    "EBAY_CLIENT_SECRET": "ebay-secret",
                    "EBAY_ENABLE_PLAINTEXT_TENANT_TOKENS": "1",
                    "EBAY_ORDER_STATE_PATH": str(state_db),
                },
            )
            state_db.write_text("sqlite", encoding="utf-8")
            os.chmod(env_path, 0o644)
            os.chmod(state_db, 0o644)

            report = build_security_ops_report(
                env_file=str(env_path),
                backup_root=str(root / "backups"),
                restore_check_root=str(root / "restore-check"),
                env_expected_uid=os.getuid(),
                env_expected_gid=os.getgid(),
                state_expected_uid=os.getuid(),
                state_expected_gid=os.getgid(),
            )
            rendered = render_security_ops_report(report)

            self.assertFalse(report["ok"])
            self.assertIn("env_file_bad_mode", report["alerts"])
            self.assertIn("state_db_bad_mode", report["alerts"])
            self.assertIn("required_env_missing", report["alerts"])
            self.assertIn("plaintext_tenant_tokens_enabled", report["alerts"])
            self.assertIn("telegram_allow_all_without_admin", report["alerts"])
            self.assertNotIn("telegram-secret", rendered)
            self.assertNotIn("ebay-secret", rendered)
            self.assertIn("TELEGRAM_BOT_TOKEN=ok", rendered)

    def test_build_security_ops_report_rejects_unsafe_env_owner(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            env_path = root / ".env"
            _write_env(env_path, {})
            os.chmod(env_path, 0o640)

            report = build_security_ops_report(
                env_file=str(env_path),
                state_db_path=str(root / "missing.db"),
                backup_root=str(root / "backups"),
                restore_check_root=str(root / "restore-check"),
                env_expected_uid=os.getuid() + 1,
                env_expected_gid=os.getgid(),
            )

            self.assertIn("env_file_bad_owner", report["alerts"])
            self.assertFalse(report["env_file"]["owner_ok"])


if __name__ == "__main__":
    unittest.main()
