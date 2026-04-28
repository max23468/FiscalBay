import tempfile
import unittest
from importlib.metadata import PackageNotFoundError
from pathlib import Path
from unittest.mock import patch

from src.fiscalbay.release_info import collect_release_info


class ReleaseInfoTests(unittest.TestCase):
    def test_collect_release_info_falls_back_to_pyproject_without_git(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            repo_root = Path(tmpdir)
            (repo_root / "pyproject.toml").write_text(
                '[project]\nname = "fiscalbay"\nversion = "1.2.3"\n',
                encoding="utf-8",
            )

            with patch(
                "src.fiscalbay.release_info.package_metadata_version",
                side_effect=PackageNotFoundError,
            ):
                info = collect_release_info(repo_root)

        self.assertEqual(info["package_version"], "1.2.3")
        self.assertEqual(info["package_version_source"], "pyproject")
        self.assertEqual(info["git_commit"], "")
        self.assertEqual(info["git_tag"], "v1.2.3")
        self.assertEqual(info["git_latest_tag"], "v1.2.3")
        self.assertEqual(info["git_commits_since_latest_tag"], 0)
        self.assertIsNone(info["git_dirty"])
        self.assertEqual(info["release_status"], "package_release")

    def test_collect_release_info_marks_dirty_checkout(self) -> None:
        git_outputs = {
            ("rev-parse", "HEAD"): "abcdef1234567890",
            ("rev-parse", "--short", "HEAD"): "abcdef1",
            ("branch", "--show-current"): "main",
            ("describe", "--exact-match", "--tags", "HEAD"): "v1.2.3",
            ("describe", "--tags", "--abbrev=0"): "v1.2.3",
            ("status", "--porcelain", "--untracked-files=no"): " M README.md",
            ("rev-list", "v1.2.3..HEAD", "--count"): "0",
        }

        def fake_run_git(args: list[str], *, cwd: Path) -> str | None:
            return git_outputs.get(tuple(args))

        with tempfile.TemporaryDirectory() as tmpdir:
            repo_root = Path(tmpdir)
            (repo_root / "pyproject.toml").write_text(
                '[project]\nname = "fiscalbay"\nversion = "1.2.3"\n',
                encoding="utf-8",
            )
            with patch(
                "src.fiscalbay.release_info.package_metadata_version",
                side_effect=PackageNotFoundError,
            ):
                with patch("src.fiscalbay.release_info._run_git", side_effect=fake_run_git):
                    info = collect_release_info(repo_root)

        self.assertEqual(info["git_short_commit"], "abcdef1")
        self.assertEqual(info["git_tag"], "v1.2.3")
        self.assertTrue(info["git_dirty"])
        self.assertEqual(info["release_status"], "dirty")
