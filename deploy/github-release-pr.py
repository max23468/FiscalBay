#!/usr/bin/env python3
"""Merge release-please PRs without GitHub Actions."""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any


class GitHubError(RuntimeError):
    pass


@dataclass(frozen=True)
class GitHubClient:
    repo: str
    token: str

    @property
    def api_base(self) -> str:
        return f"https://api.github.com/repos/{self.repo}"

    def request(
        self,
        method: str,
        path: str,
        *,
        payload: dict[str, Any] | None = None,
    ) -> Any:
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            f"{self.api_base}{path}",
            data=body,
            method=method,
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {self.token}",
                "User-Agent": "fiscalbay-release-automation",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                raw = response.read()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise GitHubError(
                f"GitHub API {method} {path} failed: HTTP {exc.code}: {detail}"
            ) from exc
        if not raw:
            return None
        return json.loads(raw.decode("utf-8"))


def env_bool(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def split_repo(repo: str) -> tuple[str, str]:
    if "/" not in repo:
        raise ValueError(f"Repository non valido: {repo}")
    owner, name = repo.split("/", 1)
    return owner, name


def list_release_prs(
    client: GitHubClient, *, owner: str, branch: str, base: str
) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode(
        {
            "state": "open",
            "base": base,
            "head": f"{owner}:{branch}",
            "per_page": "10",
        }
    )
    return client.request("GET", f"/pulls?{query}")


def wait_for_mergeable(client: GitHubClient, number: int, *, attempts: int = 6) -> dict[str, Any]:
    pr: dict[str, Any] | None = None
    for attempt in range(attempts):
        pr = client.request("GET", f"/pulls/{number}")
        if pr.get("mergeable") is not None:
            return pr
        time.sleep(min(2**attempt, 8))
    assert pr is not None
    return pr


def list_pr_files(client: GitHubClient, number: int) -> list[str]:
    files: list[str] = []
    page = 1
    while True:
        batch = client.request("GET", f"/pulls/{number}/files?per_page=100&page={page}")
        if not batch:
            return files
        files.extend(str(item["filename"]) for item in batch)
        page += 1


def ensure_allowed_files(files: list[str], allowed_files: set[str]) -> None:
    unexpected = sorted(set(files) - allowed_files)
    if unexpected:
        joined = ", ".join(unexpected)
        raise GitHubError(f"Release PR contiene file inattesi: {joined}")


def main() -> int:
    token = (
        os.environ.get("GITHUB_TOKEN")
        or os.environ.get("GH_TOKEN")
        or os.environ.get("FISCALBAY_GITHUB_TOKEN")
    )
    if not token:
        raise GitHubError("Token GitHub mancante.")

    repo = os.environ.get("FISCALBAY_RELEASE_REPO_URL", "max23468/FiscalBay")
    target_branch = os.environ.get("FISCALBAY_RELEASE_TARGET_BRANCH", "main")
    release_branch = os.environ.get(
        "FISCALBAY_RELEASE_BRANCH",
        f"release-please--branches--{target_branch}--components--fiscalbay",
    )
    merge_method = os.environ.get("FISCALBAY_RELEASE_MERGE_METHOD", "squash")
    dry_run = env_bool("FISCALBAY_RELEASE_DRY_RUN", False)
    validate_files = env_bool("FISCALBAY_RELEASE_VALIDATE_CHANGED_FILES", True)
    allowed_files = set(
        item.strip()
        for item in os.environ.get(
            "FISCALBAY_RELEASE_ALLOWED_FILES",
            "CHANGELOG.md,pyproject.toml,.release-please-manifest.json,src/fiscalbay/__init__.py",
        ).split(",")
        if item.strip()
    )

    owner, _ = split_repo(repo)
    client = GitHubClient(repo=repo, token=token)
    release_prs = list_release_prs(
        client,
        owner=owner,
        branch=release_branch,
        base=target_branch,
    )
    if not release_prs:
        print(json.dumps({"status": "no_release_pr", "release_branch": release_branch}))
        return 0
    if len(release_prs) > 1:
        raise GitHubError(f"Trovate piu' Release PR aperte per {release_branch}.")

    pr = wait_for_mergeable(client, int(release_prs[0]["number"]))
    number = int(pr["number"])
    title = str(pr["title"])
    head_sha = str(pr["head"]["sha"])
    mergeable = pr.get("mergeable")
    if mergeable is not True:
        raise GitHubError(f"Release PR #{number} non mergeable: {mergeable!r}.")
    if not title.startswith("chore(main): release "):
        raise GitHubError(f"Titolo Release PR inatteso: {title!r}.")

    files = list_pr_files(client, number)
    if validate_files:
        ensure_allowed_files(files, allowed_files)

    if dry_run:
        print(
            json.dumps(
                {
                    "status": "dry_run",
                    "number": number,
                    "title": title,
                    "head_sha": head_sha,
                    "files": files,
                },
                ensure_ascii=False,
            )
        )
        return 0

    merge = client.request(
        "PUT",
        f"/pulls/{number}/merge",
        payload={
            "commit_title": title,
            "merge_method": merge_method,
            "sha": head_sha,
        },
    )
    print(
        json.dumps(
            {
                "status": "merged",
                "number": number,
                "title": title,
                "head_sha": head_sha,
                "merge_sha": merge.get("sha"),
                "files": files,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (GitHubError, ValueError) as exc:
        print(f"Errore: {exc}", file=sys.stderr)
        raise SystemExit(1)
