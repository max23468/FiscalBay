import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src.ebay_cf.git_utils import (
    ensure_index_lock_available,
    list_index_lock_holders,
    remove_stale_index_lock,
    resolve_git_dir,
    run_git_command,
)


class GitUtilsTests(unittest.TestCase):
    @patch("src.ebay_cf.git_utils.subprocess.run")
    def test_resolve_git_dir_returns_absolute_path(self, mock_run) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            repo_path = Path(tmpdir)
            mock_run.return_value = subprocess.CompletedProcess(
                args=["git", "rev-parse", "--git-dir"],
                returncode=0,
                stdout=".git\n",
                stderr="",
            )

            git_dir = resolve_git_dir(str(repo_path))

            self.assertEqual(git_dir, (repo_path / ".git").resolve())

    @patch("src.ebay_cf.git_utils.subprocess.run")
    def test_list_index_lock_holders_returns_empty_when_unlocked(self, mock_run) -> None:
        mock_run.return_value = subprocess.CompletedProcess(
            args=["lsof", "/tmp/index.lock"],
            returncode=1,
            stdout="",
            stderr="",
        )

        holders = list_index_lock_holders(Path("/tmp/index.lock"))

        self.assertEqual(holders, [])

    @patch("src.ebay_cf.git_utils.list_index_lock_holders")
    @patch("src.ebay_cf.git_utils.resolve_git_dir")
    def test_remove_stale_index_lock_deletes_unheld_file(
        self, mock_resolve_git_dir, mock_list_holders
    ) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            git_dir = Path(tmpdir) / ".git"
            git_dir.mkdir()
            lock_path = git_dir / "index.lock"
            lock_path.write_text("", encoding="utf-8")
            mock_resolve_git_dir.return_value = git_dir
            mock_list_holders.return_value = []

            message = remove_stale_index_lock(tmpdir)

            self.assertIn("Rimosso lock Git stale", message)
            self.assertFalse(lock_path.exists())

    @patch("src.ebay_cf.git_utils.list_index_lock_holders")
    @patch("src.ebay_cf.git_utils.resolve_git_dir")
    def test_remove_stale_index_lock_refuses_when_process_is_active(
        self, mock_resolve_git_dir, mock_list_holders
    ) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            git_dir = Path(tmpdir) / ".git"
            git_dir.mkdir()
            lock_path = git_dir / "index.lock"
            lock_path.write_text("", encoding="utf-8")
            mock_resolve_git_dir.return_value = git_dir
            mock_list_holders.return_value = ["git 123 matteo 3uW REG ... index.lock"]

            with self.assertRaises(RuntimeError) as ctx:
                remove_stale_index_lock(tmpdir)

            self.assertIn("sembra ancora in uso", str(ctx.exception))
            self.assertTrue(lock_path.exists())

    @patch("src.ebay_cf.git_utils.time.sleep")
    @patch("src.ebay_cf.git_utils.list_index_lock_holders")
    @patch("src.ebay_cf.git_utils.resolve_git_dir")
    def test_ensure_index_lock_available_removes_stale_lock(
        self,
        mock_resolve_git_dir,
        mock_list_holders,
        mock_sleep,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            git_dir = Path(tmpdir) / ".git"
            git_dir.mkdir()
            lock_path = git_dir / "index.lock"
            lock_path.write_text("", encoding="utf-8")
            mock_resolve_git_dir.return_value = git_dir
            mock_list_holders.return_value = []

            events = ensure_index_lock_available(tmpdir, wait_seconds=0.1, poll_interval=0.01)

            self.assertEqual(len(events), 1)
            self.assertFalse(lock_path.exists())
            mock_sleep.assert_not_called()

    @patch("src.ebay_cf.git_utils.time.sleep")
    @patch("src.ebay_cf.git_utils.list_index_lock_holders")
    @patch("src.ebay_cf.git_utils.resolve_git_dir")
    def test_ensure_index_lock_available_waits_for_active_process(
        self,
        mock_resolve_git_dir,
        mock_list_holders,
        mock_sleep,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            git_dir = Path(tmpdir) / ".git"
            git_dir.mkdir()
            lock_path = git_dir / "index.lock"
            lock_path.write_text("", encoding="utf-8")
            mock_resolve_git_dir.return_value = git_dir
            mock_list_holders.side_effect = [
                ["git 123 matteo 3uW REG ... index.lock"],
                [],
            ]

            def remove_after_wait(_seconds: float) -> None:
                lock_path.unlink(missing_ok=True)

            mock_sleep.side_effect = remove_after_wait

            events = ensure_index_lock_available(tmpdir, wait_seconds=0.5, poll_interval=0.01)

            self.assertEqual(events, [])
            self.assertFalse(lock_path.exists())

    @patch("src.ebay_cf.git_utils.subprocess.run")
    @patch("src.ebay_cf.git_utils.ensure_index_lock_available")
    def test_run_git_command_calls_git_after_preflight(
        self,
        mock_ensure_lock,
        mock_run,
    ) -> None:
        mock_run.return_value = subprocess.CompletedProcess(
            args=["git", "status"],
            returncode=0,
            stdout="ok\n",
            stderr="",
        )

        result = run_git_command(["status"], repo_path="/repo", wait_seconds=2.0)

        mock_ensure_lock.assert_called_once_with(
            "/repo",
            wait_seconds=2.0,
            poll_interval=0.25,
        )
        mock_run.assert_called_once_with(
            ["git", "status"],
            cwd="/repo",
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.stdout, "ok\n")


if __name__ == "__main__":
    unittest.main()
