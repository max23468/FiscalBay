"""Utilities for safe git maintenance tasks."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def resolve_git_dir(repo_path: str = ".") -> Path:
    result = subprocess.run(
        ["git", "rev-parse", "--git-dir"],
        cwd=repo_path,
        check=True,
        capture_output=True,
        text=True,
    )
    git_dir = result.stdout.strip()
    if not git_dir:
        raise RuntimeError("Directory git non risolta.")
    path = Path(git_dir)
    if not path.is_absolute():
        path = Path(repo_path) / path
    return path.resolve()


def list_index_lock_holders(lock_path: Path) -> list[str]:
    result = subprocess.run(
        ["lsof", str(lock_path)],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode not in (0, 1):
        stderr = result.stderr.strip() or "errore sconosciuto"
        raise RuntimeError(f"Impossibile verificare i processi che tengono il lock: {stderr}")
    lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    if len(lines) <= 1:
        return []
    return lines[1:]


def remove_stale_index_lock(repo_path: str = ".") -> str:
    git_dir = resolve_git_dir(repo_path)
    lock_path = git_dir / "index.lock"
    if not lock_path.exists():
        return f"Nessun index.lock presente in {lock_path}."

    holders = list_index_lock_holders(lock_path)
    if holders:
        raise RuntimeError(
            "index.lock sembra ancora in uso da un processo attivo: "
            f"{holders[0]}. Non lo rimuovo automaticamente."
        )

    lock_path.unlink()
    return f"Rimosso lock Git stale: {lock_path}"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Rimuove in sicurezza un index.lock Git rimasto sporco."
    )
    parser.add_argument(
        "repo",
        nargs="?",
        default=".",
        help="Percorso del repository Git. Default: directory corrente.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        message = remove_stale_index_lock(args.repo)
    except (subprocess.CalledProcessError, RuntimeError) as exc:
        print(f"Errore: {exc}", file=sys.stderr)
        return 1
    print(message)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
