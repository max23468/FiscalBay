"""Security operations checks for the FiscalBay runtime."""

from __future__ import annotations

import argparse
import json
import os
import stat
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, TypedDict

from .config import DEFAULT_STATE_PATH, configure_logging

DEFAULT_BACKUP_MAX_AGE_HOURS = 36
DEFAULT_RESTORE_DRILL_MAX_AGE_HOURS = 8 * 24
DEFAULT_BACKUP_ROOT = "~/maintenance-backups"
DEFAULT_RESTORE_CHECK_ROOT = "data/restore-check"
REQUIRED_ENV_NAMES = (
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_ALLOWED_CHAT_IDS",
    "TELEGRAM_ADMIN_USER_ID",
    "EBAY_CLIENT_ID",
    "EBAY_CLIENT_SECRET",
    "EBAY_TENANT_TOKEN_KEY",
)
RECOMMENDED_ENV_NAMES = (
    "EBAY_OAUTH_RUNAME",
    "EBAY_OAUTH_CONNECT_BASE_URL",
    "FISCALBAY_PUBLIC_SERVICE_MODEL",
)


class EnvVarStatus(TypedDict):
    name: str
    present: bool


class FileSecurityStatus(TypedDict):
    path: str
    exists: bool
    mode: str
    expected_mode: str
    ok: bool


class RecoveryAssetStatus(TypedDict):
    root: str
    latest_path: str
    latest_at: str
    age_hours: int | None
    max_age_hours: int
    ok: bool


class SecurityOpsReport(TypedDict):
    ok: bool
    status: str
    alerts: list[str]
    warnings: list[str]
    env_file: FileSecurityStatus
    state_db: FileSecurityStatus
    required_env: list[EnvVarStatus]
    recommended_env: list[EnvVarStatus]
    plaintext_tenant_tokens_enabled: bool
    telegram_allow_all: bool
    admin_configured: bool
    public_service_model: str
    backup: RecoveryAssetStatus
    restore_drill: RecoveryAssetStatus


def _normalize_mode(mode: int | None) -> str:
    if mode is None:
        return "missing"
    return oct(mode)[-3:]


def _path_mode(path: Path) -> int | None:
    try:
        return stat.S_IMODE(path.stat().st_mode)
    except OSError:
        return None


def _check_file(path: Path, *, expected_modes: set[int]) -> FileSecurityStatus:
    mode = _path_mode(path)
    return {
        "path": str(path),
        "exists": mode is not None,
        "mode": _normalize_mode(mode),
        "expected_mode": "_or_".join(_normalize_mode(item) for item in sorted(expected_modes)),
        "ok": mode in expected_modes,
    }


def _strip_env_value(raw_value: str) -> str:
    value = raw_value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


def read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return values
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("export "):
            stripped = stripped[len("export ") :].strip()
        key, separator, raw_value = stripped.partition("=")
        if not separator:
            continue
        key = key.strip()
        if not key:
            continue
        values[key] = _strip_env_value(raw_value)
    return values


def _truthy_env(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_status(values: dict[str, str], names: tuple[str, ...]) -> list[EnvVarStatus]:
    return [{"name": name, "present": bool(values.get(name, "").strip())} for name in names]


def _latest_manifest_asset(root: Path) -> Path | None:
    try:
        candidates = [
            path for path in root.iterdir() if path.is_dir() and (path / "MANIFEST.txt").is_file()
        ]
    except OSError:
        return None
    if not candidates:
        return None
    return max(candidates, key=lambda path: (path / "MANIFEST.txt").stat().st_mtime)


def _asset_status(
    root: Path,
    *,
    max_age_hours: int,
    now: datetime,
) -> RecoveryAssetStatus:
    latest = _latest_manifest_asset(root)
    if latest is None:
        return {
            "root": str(root),
            "latest_path": "",
            "latest_at": "",
            "age_hours": None,
            "max_age_hours": max_age_hours,
            "ok": False,
        }
    manifest = latest / "MANIFEST.txt"
    latest_at = datetime.fromtimestamp(manifest.stat().st_mtime, timezone.utc)
    age_hours = max(0, int((now - latest_at).total_seconds() // 3600))
    return {
        "root": str(root),
        "latest_path": str(latest),
        "latest_at": latest_at.isoformat().replace("+00:00", "Z"),
        "age_hours": age_hours,
        "max_age_hours": max_age_hours,
        "ok": age_hours <= max_age_hours,
    }


def build_security_ops_report(
    *,
    env_file: str | None = None,
    state_db_path: str | None = None,
    backup_root: str | None = None,
    restore_check_root: str | None = None,
    max_backup_age_hours: int = DEFAULT_BACKUP_MAX_AGE_HOURS,
    max_restore_drill_age_hours: int = DEFAULT_RESTORE_DRILL_MAX_AGE_HOURS,
) -> SecurityOpsReport:
    now = datetime.now(timezone.utc)
    env_file_value = env_file or os.getenv("FISCALBAY_ENV_FILE") or ".env"
    env_path = Path(env_file_value).expanduser()
    env_values = read_env_file(env_path)
    state_path = Path(
        state_db_path or env_values.get("EBAY_ORDER_STATE_PATH") or DEFAULT_STATE_PATH
    ).expanduser()
    backup_root_value = backup_root or os.getenv("BACKUP_ROOT") or DEFAULT_BACKUP_ROOT
    backup_path = Path(backup_root_value).expanduser()
    restore_check_root_value = (
        restore_check_root
        or os.getenv("FISCALBAY_RESTORE_CHECK_ROOT")
        or DEFAULT_RESTORE_CHECK_ROOT
    )
    restore_path = Path(restore_check_root_value).expanduser()

    env_file_status = _check_file(env_path, expected_modes={0o600})
    state_db_status = _check_file(state_path, expected_modes={0o600, 0o660})
    required_env = _env_status(env_values, REQUIRED_ENV_NAMES)
    recommended_env = _env_status(env_values, RECOMMENDED_ENV_NAMES)
    plaintext_enabled = _truthy_env(env_values.get("EBAY_ENABLE_PLAINTEXT_TENANT_TOKENS", ""))
    raw_allowed_chats = env_values.get("TELEGRAM_ALLOWED_CHAT_IDS", "").strip().lower()
    telegram_allow_all = raw_allowed_chats in {"*", "all"}
    admin_configured = bool(env_values.get("TELEGRAM_ADMIN_USER_ID", "").strip())
    public_service_model = env_values.get(
        "FISCALBAY_PUBLIC_SERVICE_MODEL",
        "approved_public_small",
    ).strip()
    backup_status = _asset_status(backup_path, max_age_hours=max_backup_age_hours, now=now)
    restore_drill_status = _asset_status(
        restore_path,
        max_age_hours=max_restore_drill_age_hours,
        now=now,
    )

    alerts: list[str] = []
    warnings: list[str] = []
    if not env_file_status["exists"]:
        alerts.append("env_file_missing")
    elif not env_file_status["ok"]:
        alerts.append("env_file_bad_mode")
    if state_db_status["exists"] and not state_db_status["ok"]:
        alerts.append("state_db_bad_mode")
    elif not state_db_status["exists"]:
        warnings.append("state_db_missing")
    missing_required = [item["name"] for item in required_env if not item["present"]]
    if missing_required:
        alerts.append("required_env_missing")
    missing_recommended = [item["name"] for item in recommended_env if not item["present"]]
    if missing_recommended:
        warnings.append("recommended_env_missing")
    if plaintext_enabled:
        alerts.append("plaintext_tenant_tokens_enabled")
    if telegram_allow_all and not admin_configured:
        alerts.append("telegram_allow_all_without_admin")
    if public_service_model != "approved_public_small":
        warnings.append("public_service_model_changed")
    if not backup_status["ok"]:
        warnings.append("backup_missing_or_stale")
    if not restore_drill_status["ok"]:
        warnings.append("restore_drill_missing_or_stale")

    return {
        "ok": not alerts,
        "status": "ok" if not alerts else "fail",
        "alerts": alerts,
        "warnings": warnings,
        "env_file": env_file_status,
        "state_db": state_db_status,
        "required_env": required_env,
        "recommended_env": recommended_env,
        "plaintext_tenant_tokens_enabled": plaintext_enabled,
        "telegram_allow_all": telegram_allow_all,
        "admin_configured": admin_configured,
        "public_service_model": public_service_model or "approved_public_small",
        "backup": backup_status,
        "restore_drill": restore_drill_status,
    }


def _render_env_status(items: list[EnvVarStatus]) -> str:
    return ", ".join(f"{item['name']}={'ok' if item['present'] else 'missing'}" for item in items)


def render_security_ops_report(report: SecurityOpsReport) -> str:
    backup = report["backup"]
    restore_drill = report["restore_drill"]
    lines = [
        f"status: {report['status']}",
        "alerts: " + (", ".join(report["alerts"]) if report["alerts"] else "none"),
        "warnings: " + (", ".join(report["warnings"]) if report["warnings"] else "none"),
        f"env_file.path: {report['env_file']['path']}",
        f"env_file.mode: {report['env_file']['mode']}",
        f"env_file.expected_mode: {report['env_file']['expected_mode']}",
        f"state_db.path: {report['state_db']['path']}",
        f"state_db.mode: {report['state_db']['mode']}",
        f"state_db.expected_mode: {report['state_db']['expected_mode']}",
        "required_env: " + _render_env_status(report["required_env"]),
        "recommended_env: " + _render_env_status(report["recommended_env"]),
        f"plaintext_tenant_tokens_enabled: {report['plaintext_tenant_tokens_enabled']}",
        f"telegram_allow_all: {report['telegram_allow_all']}",
        f"admin_configured: {report['admin_configured']}",
        f"public_service_model: {report['public_service_model']}",
        f"backup.latest_path: {backup['latest_path'] or 'none'}",
        f"backup.age_hours: {backup['age_hours']}",
        f"backup.max_age_hours: {backup['max_age_hours']}",
        f"restore_drill.latest_path: {restore_drill['latest_path'] or 'none'}",
        f"restore_drill.age_hours: {restore_drill['age_hours']}",
        f"restore_drill.max_age_hours: {restore_drill['max_age_hours']}",
    ]
    return "\n".join(lines)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Security operations check di FiscalBay.")
    parser.add_argument("--json", action="store_true", help="Stampa il report in JSON.")
    parser.add_argument("--env-file", help="Percorso del file .env da verificare.")
    parser.add_argument("--state-db", help="Percorso del database state.db da verificare.")
    parser.add_argument("--backup-root", help="Root dei backup manutentivi.")
    parser.add_argument("--restore-check-root", help="Root dei restore drill.")
    parser.add_argument(
        "--max-backup-age-hours",
        type=int,
        default=DEFAULT_BACKUP_MAX_AGE_HOURS,
        help="Età massima consigliata per l'ultimo backup.",
    )
    parser.add_argument(
        "--max-restore-drill-age-hours",
        type=int,
        default=DEFAULT_RESTORE_DRILL_MAX_AGE_HOURS,
        help="Età massima consigliata per l'ultimo restore drill.",
    )
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    configure_logging()
    parser = build_parser()
    args = parser.parse_args(argv)
    report = build_security_ops_report(
        env_file=args.env_file,
        state_db_path=args.state_db,
        backup_root=args.backup_root,
        restore_check_root=args.restore_check_root,
        max_backup_age_hours=args.max_backup_age_hours,
        max_restore_drill_age_hours=args.max_restore_drill_age_hours,
    )
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(render_security_ops_report(report))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
