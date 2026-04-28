"""Release and deployment metadata helpers."""

from __future__ import annotations

import subprocess
from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as package_metadata_version
from pathlib import Path
from typing import TypedDict


class ReleaseInfo(TypedDict):
    package_version: str
    package_version_source: str
    git_commit: str
    git_short_commit: str
    git_branch: str
    git_tag: str
    git_latest_tag: str
    git_commits_since_latest_tag: int | None
    git_dirty: bool | None
    release_status: str


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _run_git(args: list[str], *, cwd: Path) -> str | None:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=str(cwd),
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    output = result.stdout.strip()
    return output or None


def _package_version_from_pyproject(repo_root: Path) -> str | None:
    try:
        lines = (repo_root / "pyproject.toml").read_text(encoding="utf-8").splitlines()
    except OSError:
        return None
    in_project = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            in_project = stripped == "[project]"
            continue
        if not in_project or not stripped.startswith("version"):
            continue
        key, separator, raw_value = stripped.partition("=")
        if separator and key.strip() == "version":
            version = raw_value.strip().strip('"').strip("'")
            return version or None
    return None


def _package_version(repo_root: Path) -> tuple[str, str]:
    try:
        return package_metadata_version("fiscalbay"), "installed_package"
    except PackageNotFoundError:
        fallback = _package_version_from_pyproject(repo_root)
        if fallback:
            return fallback, "pyproject"
        return "unknown", "unknown"


def _git_dirty(repo_root: Path) -> bool | None:
    status = _run_git(["status", "--porcelain", "--untracked-files=no"], cwd=repo_root)
    if status is None:
        return None
    return bool(status)


def _commits_since_latest_tag(repo_root: Path, latest_tag: str) -> int | None:
    if not latest_tag:
        return None
    count_text = _run_git(["rev-list", f"{latest_tag}..HEAD", "--count"], cwd=repo_root)
    if count_text is None:
        return None
    try:
        return int(count_text)
    except ValueError:
        return None


def _release_status(*, git_dirty: bool | None, git_tag: str, commits_since_tag: int | None) -> str:
    if git_dirty is True:
        return "dirty"
    if not git_tag:
        if commits_since_tag is None:
            return "unknown"
        if commits_since_tag > 0:
            return "ahead_of_latest_tag"
        return "untagged"
    if git_dirty is False:
        return "tagged_clean"
    return "tagged_unknown_cleanliness"


def _version_tag(package_version: str) -> str:
    if package_version == "unknown":
        return ""
    return f"v{package_version}"


def collect_release_info(repo_root: Path | None = None) -> ReleaseInfo:
    """Collect local package and Git metadata without requiring a Git checkout."""

    root = repo_root or _repo_root()
    package_version, package_version_source = _package_version(root)
    git_commit = _run_git(["rev-parse", "HEAD"], cwd=root) or ""
    git_short_commit = _run_git(["rev-parse", "--short", "HEAD"], cwd=root) or ""
    git_branch = _run_git(["branch", "--show-current"], cwd=root) or ""
    git_tag = _run_git(["describe", "--exact-match", "--tags", "HEAD"], cwd=root) or ""
    git_latest_tag = _run_git(["describe", "--tags", "--abbrev=0"], cwd=root) or ""
    git_dirty = _git_dirty(root)
    commits_since_latest_tag = _commits_since_latest_tag(root, git_latest_tag)
    release_status = _release_status(
        git_dirty=git_dirty,
        git_tag=git_tag,
        commits_since_tag=commits_since_latest_tag,
    )
    if not git_commit and package_version != "unknown":
        package_tag = _version_tag(package_version)
        git_tag = package_tag
        git_latest_tag = git_latest_tag or package_tag
        commits_since_latest_tag = 0
        release_status = "package_release"
    return {
        "package_version": package_version,
        "package_version_source": package_version_source,
        "git_commit": git_commit,
        "git_short_commit": git_short_commit,
        "git_branch": git_branch,
        "git_tag": git_tag,
        "git_latest_tag": git_latest_tag,
        "git_commits_since_latest_tag": commits_since_latest_tag,
        "git_dirty": git_dirty,
        "release_status": release_status,
    }
