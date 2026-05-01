#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

REPO_SLUG="${FISCALBAY_RELEASE_REPO_URL:-max23468/FiscalBay}"
RUN_CI=true
RUN_DEPLOY=true
RUN_PUSH=true
DRY_RUN=false
BUMP_OVERRIDE=""
VERSION_OVERRIDE=""

usage() {
  cat <<'EOF'
Usage: scripts/release_now.sh [--dry-run] [--skip-ci] [--skip-deploy] [--skip-push]
                              [--bump major|minor|patch] [--version X.Y.Z]

Creates an explicit FiscalBay release without release PR automation.

Default behavior:
  1. verifies only the allowlisted lightweight CI workflow is present
  2. requires a clean working tree on main
  3. runs local CI checks
  4. calculates the next SemVer version from Conventional Commits since last v* tag
  5. updates CHANGELOG.md and pyproject.toml
  6. creates commit chore: release vX.Y.Z and tag vX.Y.Z
  7. pushes commit and tag
  8. creates a GitHub Release via gh or GitHub API token
  9. deploys main to the FiscalBay VPS
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      RUN_CI=false
      RUN_DEPLOY=false
      RUN_PUSH=false
      shift
      ;;
    --skip-ci)
      RUN_CI=false
      shift
      ;;
    --skip-deploy)
      RUN_DEPLOY=false
      shift
      ;;
    --skip-push)
      RUN_PUSH=false
      shift
      ;;
    --bump)
      BUMP_OVERRIDE="${2:?Missing value for --bump}"
      shift 2
      ;;
    --version)
      VERSION_OVERRIDE="${2:?Missing value for --version}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

cd "${REPO_ROOT}"

bash scripts/check_github_workflows.sh

current_branch="$(git branch --show-current)"
if [ "${DRY_RUN}" != true ] && [ "${current_branch}" != "main" ]; then
  echo "Errore: le release ufficiali vanno create da main; branch corrente: ${current_branch:-detached}." >&2
  exit 1
fi

if [ "${DRY_RUN}" != true ] && [ -n "$(git status --porcelain)" ]; then
  echo "Errore: working tree non pulito. Commit/stash prima della release." >&2
  exit 1
fi

if [ "${RUN_CI}" = true ]; then
  echo "Eseguo CI locale..."
  bash scripts/ci_verify.sh
fi

echo "Aggiorno i tag da origin..."
git fetch --tags origin

release_info_file="$(mktemp)"
cleanup() {
  rm -f "${release_info_file}"
}
trap cleanup EXIT

python3 - "$REPO_SLUG" "$BUMP_OVERRIDE" "$VERSION_OVERRIDE" "$DRY_RUN" > "${release_info_file}" <<'PY'
from __future__ import annotations

import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path

repo_slug, bump_override, version_override, dry_run_raw = sys.argv[1:5]
dry_run = dry_run_raw == "true"
if bump_override and bump_override not in {"major", "minor", "patch"}:
    raise SystemExit(f"Bump non valido: {bump_override!r}")


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], text=True).strip()


def run_git(*args: str) -> str:
    return subprocess.run(["git", *args], check=True, text=True, capture_output=True).stdout


def parse_version(raw: str) -> tuple[int, int, int]:
    match = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)", raw.strip())
    if not match:
        raise SystemExit(f"Versione non valida: {raw!r}")
    return tuple(int(part) for part in match.groups())


def bump_version(version: tuple[int, int, int], bump: str) -> tuple[int, int, int]:
    major, minor, patch = version
    if bump == "major":
        return major + 1, 0, 0
    if bump == "minor":
        return major, minor + 1, 0
    if bump == "patch":
        return major, minor, patch + 1
    raise SystemExit(f"Bump non valido: {bump!r}")


def version_string(version: tuple[int, int, int]) -> str:
    return ".".join(str(part) for part in version)


def commit_type(subject: str) -> str | None:
    match = re.match(r"^([a-z][a-z0-9-]*)(?:\([^)]*\))?(!)?:\s+(.+)$", subject)
    if not match:
        return None
    return match.group(1)


def commit_title(subject: str) -> str:
    match = re.match(r"^[a-z][a-z0-9-]*(?:\([^)]*\))?!?:\s+(.+)$", subject)
    return match.group(1) if match else subject


def is_breaking(subject: str, body: str) -> bool:
    return bool(re.match(r"^[a-z][a-z0-9-]*(?:\([^)]*\))?!:", subject)) or bool(
        re.search(r"^BREAKING[ -]CHANGE:", body, re.MULTILINE)
    )


def read_commits(revision_range: str) -> list[dict[str, str | bool]]:
    raw = run_git("log", "--reverse", "--format=%H%x1f%s%x1f%b%x1e", revision_range)
    commits: list[dict[str, str | bool]] = []
    for record in raw.split("\x1e"):
        record = record.strip("\n")
        if not record:
            continue
        parts = record.split("\x1f", 2)
        if len(parts) != 3:
            continue
        sha, subject, body = parts
        commits.append(
            {
                "sha": sha,
                "short": sha[:7],
                "subject": subject,
                "title": commit_title(subject),
                "type": commit_type(subject) or "",
                "breaking": is_breaking(subject, body),
            }
        )
    return commits


def choose_bump(commits: list[dict[str, str | bool]]) -> str:
    if any(commit["breaking"] for commit in commits):
        return "major"
    if any(commit["type"] == "feat" for commit in commits):
        return "minor"
    if any(commit["type"] in {"fix", "perf"} for commit in commits):
        return "patch"
    raise SystemExit("Nessun commit feat/fix/perf/breaking da rilasciare.")


def section(title: str, commits: list[dict[str, str | bool]]) -> str:
    lines = [f"### {title}", ""]
    for commit in commits:
        short = str(commit["short"])
        commit_url = f"https://github.com/{repo_slug}/commit/{commit['sha']}"
        lines.append(f"* {commit['title']} ([{short}]({commit_url}))")
    return "\n".join(lines)


def changelog_entry(
    previous_tag: str | None,
    new_version: str,
    commits: list[dict[str, str | bool]],
) -> str:
    tag = f"v{new_version}"
    today = dt.date.today().isoformat()
    if previous_tag:
        compare = f"https://github.com/{repo_slug}/compare/{previous_tag}...{tag}"
    else:
        compare = f"https://github.com/{repo_slug}/releases/tag/{tag}"
    lines = [f"## [{new_version}]({compare}) ({today})", ""]

    breaking = [commit for commit in commits if commit["breaking"]]
    features = [commit for commit in commits if commit["type"] == "feat" and not commit["breaking"]]
    fixes = [
        commit
        for commit in commits
        if commit["type"] in {"fix", "perf"} and not commit["breaking"]
    ]
    maintenance = [
        commit
        for commit in commits
        if commit["type"] in {"build", "chore", "ci", "docs", "refactor", "test"}
        and not commit["breaking"]
    ]
    other = [
        commit
        for commit in commits
        if not commit["breaking"]
        and commit not in features
        and commit not in fixes
        and commit not in maintenance
    ]

    if breaking:
        lines.append(section("Breaking Changes", breaking))
        lines.append("")
    if features:
        lines.append(section("Features", features))
        lines.append("")
    if fixes:
        lines.append(section("Bug Fixes", fixes))
        lines.append("")
    if maintenance:
        lines.append(section("Maintenance", maintenance))
        lines.append("")
    if other:
        lines.append(section("Other Changes", other))
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def update_pyproject(version: str) -> None:
    path = Path("pyproject.toml")
    content = path.read_text()
    updated, count = re.subn(
        r'(?m)^version = "[^"]+"',
        f'version = "{version}"',
        content,
        count=1,
    )
    if count != 1:
        raise SystemExit("Campo version non trovato in pyproject.toml.")
    path.write_text(updated)


def update_init_version(version: str) -> bool:
    path = Path("src/fiscalbay/__init__.py")
    if not path.exists():
        return False
    content = path.read_text()
    updated, count = re.subn(
        r'(?m)^__version__ = "[^"]+"',
        f'__version__ = "{version}"',
        content,
        count=1,
    )
    if count:
        path.write_text(updated)
        return True
    return False


def update_changelog(entry: str) -> None:
    path = Path("CHANGELOG.md")
    content = path.read_text()
    if not content.startswith("# Changelog\n"):
        raise SystemExit("CHANGELOG.md non inizia con '# Changelog'.")
    path.write_text("# Changelog\n\n" + entry + "\n" + content[len("# Changelog\n") :].lstrip())


try:
    latest_tag = git("describe", "--tags", "--match", "v[0-9]*", "--abbrev=0")
except subprocess.CalledProcessError:
    latest_tag = ""

revision_range = f"{latest_tag}..HEAD" if latest_tag else "HEAD"
commits = read_commits(revision_range)
if not commits:
    raise SystemExit("Nessun commit da rilasciare.")

current_version = parse_version(latest_tag or re.search(r'(?m)^version = "([^"]+)"', Path("pyproject.toml").read_text()).group(1))
bump = bump_override or choose_bump(commits)
if version_override:
    next_version_tuple = parse_version(version_override)
else:
    next_version_tuple = bump_version(current_version, bump)
if next_version_tuple <= current_version:
    raise SystemExit(
        f"La nuova versione {version_string(next_version_tuple)} deve essere maggiore di {version_string(current_version)}."
    )
next_version = version_string(next_version_tuple)
next_tag = f"v{next_version}"

try:
    git("rev-parse", "-q", "--verify", f"refs/tags/{next_tag}")
except subprocess.CalledProcessError:
    pass
else:
    raise SystemExit(f"Tag già esistente: {next_tag}")

entry = changelog_entry(latest_tag or None, next_version, commits)
if not dry_run:
    update_pyproject(next_version)
    init_updated = update_init_version(next_version)
    update_changelog(entry)
else:
    init_updated = False

print(
    json.dumps(
        {
            "previous_tag": latest_tag or None,
            "next_version": next_version,
            "next_tag": next_tag,
            "bump": bump,
            "commit_count": len(commits),
            "init_version_updated": init_updated,
            "entry": entry,
        },
        ensure_ascii=False,
    )
)
PY

previous_tag="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["previous_tag"] or "")' "${release_info_file}")"
next_version="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["next_version"])' "${release_info_file}")"
next_tag="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["next_tag"])' "${release_info_file}")"
bump="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["bump"])' "${release_info_file}")"
entry="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["entry"])' "${release_info_file}")"

echo "Release calcolata: ${previous_tag:-nessun tag} -> ${next_tag} (${bump})"

if [ "${DRY_RUN}" = true ]; then
  echo
  echo "${entry}"
  echo "Dry run: nessun file modificato, commit/tag/release/deploy non eseguiti."
  exit 0
fi

git add CHANGELOG.md pyproject.toml src/fiscalbay/__init__.py
if git diff --cached --quiet; then
  echo "Errore: nessuna modifica di release prodotta." >&2
  exit 1
fi

git commit -m "chore: release ${next_tag}"
git tag -a "${next_tag}" -m "${next_tag}"

if [ "${RUN_PUSH}" = true ]; then
  git push origin main
  git push origin "${next_tag}"
fi

notes_file="$(mktemp)"
trap 'rm -f "${release_info_file}" "${notes_file}"' EXIT
printf "%s\n" "${entry}" > "${notes_file}"

if command -v gh >/dev/null 2>&1; then
  gh release create "${next_tag}" \
    --repo "${REPO_SLUG}" \
    --title "${next_tag}" \
    --notes-file "${notes_file}"
else
  token="${GITHUB_TOKEN:-${GH_TOKEN:-${FISCALBAY_GITHUB_TOKEN:-}}}"
  if [ -z "${token}" ]; then
    echo "Errore: gh non trovato e token GitHub mancante (GITHUB_TOKEN/GH_TOKEN/FISCALBAY_GITHUB_TOKEN)." >&2
    exit 1
  fi
  python3 - "${REPO_SLUG}" "${next_tag}" "${notes_file}" <<'PY'
from __future__ import annotations

import json
import os
import sys
import urllib.request

repo_slug, tag, notes_path = sys.argv[1:4]
token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or os.environ.get("FISCALBAY_GITHUB_TOKEN")
payload = {
    "tag_name": tag,
    "name": tag,
    "body": open(notes_path).read(),
    "draft": False,
    "prerelease": False,
}
request = urllib.request.Request(
    f"https://api.github.com/repos/{repo_slug}/releases",
    data=json.dumps(payload).encode(),
    method="POST",
    headers={
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "User-Agent": "fiscalbay-release-now",
        "X-GitHub-Api-Version": "2022-11-28",
    },
)
with urllib.request.urlopen(request, timeout=30) as response:
    created = json.loads(response.read().decode())
print(created["html_url"])
PY
fi

if [ "${RUN_DEPLOY}" = true ]; then
  bash scripts/deploy_now.sh --ref main --skip-ci --skip-push
fi

echo "Release ${next_tag} completata."
