"""Scale readiness checks without automatic storage migration."""

from __future__ import annotations

import argparse
import json
from typing import Optional, TypedDict

from .config import configure_logging
from .healthcheck import HealthReport, build_health_report
from .models import as_int

WATCH_RATIO = 0.60
RECOMMEND_RATIO = 0.80


class ScaleTrigger(TypedDict):
    name: str
    current: int
    limit: int
    usage_percent: int
    level: str
    description: str


class ScaleReadinessReport(TypedDict):
    ok: bool
    status: str
    summary: str
    triggers: list[ScaleTrigger]
    signals: list[str]
    next_actions: list[str]
    migration_plan: list[str]


def _usage_percent(current: int, limit: int) -> int:
    if limit <= 0:
        return 0
    return min(999, round((current / limit) * 100))


def _trigger_level(current: int, limit: int) -> str:
    if limit <= 0:
        return "watch"
    ratio = current / limit
    if current > limit:
        return "required"
    if ratio >= RECOMMEND_RATIO:
        return "recommend"
    if ratio >= WATCH_RATIO:
        return "watch"
    return "ok"


def _build_trigger(
    *,
    name: str,
    current: int,
    limit: int,
    description: str,
) -> ScaleTrigger:
    return {
        "name": name,
        "current": current,
        "limit": limit,
        "usage_percent": _usage_percent(current, limit),
        "level": _trigger_level(current, limit),
        "description": description,
    }


def _highest_status(triggers: list[ScaleTrigger], signals: list[str]) -> str:
    levels = {trigger["level"] for trigger in triggers}
    if "required" in levels:
        return "migration_required"
    if "recommend" in levels or "sqlite_migration_recommended" in signals:
        return "migration_recommended"
    if "watch" in levels or signals:
        return "watch"
    return "within_policy"


def _summary_for_status(status: str) -> str:
    if status == "migration_required":
        return "Soglie pubbliche superate: blocca crescita e prepara migrazione prima di allargare."
    if status == "migration_recommended":
        return "Soglie vicine: prepara piano Postgres, ma non migrare automaticamente."
    if status == "watch":
        return "Profilo ancora valido, con segnali da osservare nei prossimi cicli."
    return "Profilo approved_public_small dentro soglie: SQLite resta adeguato."


def _next_actions(status: str) -> list[str]:
    if status == "migration_required":
        return [
            "mettere in pausa nuove approvazioni o onboarding non essenziale",
            "creare backup fresco e validare restore drill",
            "preparare ambiente Postgres gestito e piano rollback",
            "pianificare finestra di migrazione con freeze operativo",
        ]
    if status == "migration_recommended":
        return [
            "aggiornare inventario schema e volumi SQLite",
            "scegliere provider Postgres o database gestito equivalente",
            "preparare prova di migrazione su copia offline",
            "continuare a monitorare soglie e queue prima di migrare",
        ]
    if status == "watch":
        return [
            "monitorare trend tenant/account/token nei prossimi cicli",
            "tenere backup e restore drill recenti",
            "non aumentare soglie senza revisione operativa",
        ]
    return [
        "mantenere SQLite come default operativo",
        "continuare backup, restore drill e healthcheck periodici",
    ]


def _migration_plan() -> list[str]:
    return [
        "freeze temporaneo di nuove approvazioni e mutazioni admin non urgenti",
        "backup completo di state.db e .env con restore drill riuscito",
        "provisioning Postgres gestito con credenziali fuori dal repository",
        "migrazione schema e import da copia SQLite offline",
        "smoke check applicativo su ambiente candidato",
        "switch controllato del runtime e monitoraggio queue/errori",
        "rollback su SQLite solo da backup verificato se lo smoke fallisce",
    ]


def build_scale_readiness_from_health(report: HealthReport) -> ScaleReadinessReport:
    public_service = report["public_service"]
    operation_queue = report["operation_queue"]
    tenant_snapshots = report["tenant_snapshots"]
    metrics = report["metrics"]

    triggers = [
        _build_trigger(
            name="approved_users",
            current=as_int(public_service.get("approved_users", 0)),
            limit=as_int(public_service.get("approved_users_limit", 0)),
            description="utenti approvati nel profilo pubblico",
        ),
        _build_trigger(
            name="linked_accounts",
            current=as_int(public_service.get("linked_accounts", 0)),
            limit=as_int(public_service.get("linked_accounts_limit", 0)),
            description="account eBay collegati",
        ),
        _build_trigger(
            name="active_token_sets",
            current=as_int(public_service.get("active_token_sets", 0)),
            limit=as_int(public_service.get("active_token_sets_limit", 0)),
            description="set token tenant attivi",
        ),
        _build_trigger(
            name="sqlite_db_bytes",
            current=as_int(public_service.get("sqlite_db_bytes", 0)),
            limit=as_int(public_service.get("sqlite_db_limit_bytes", 0)),
            description="dimensione state.db rispetto alla soglia SQLite",
        ),
    ]

    signals: list[str] = []
    if not bool(public_service.get("scale_within_policy", True)):
        signals.append("public_service_policy_limit_reached")
    if bool(public_service.get("sqlite_migration_recommended", False)):
        signals.append("sqlite_migration_recommended")
    if as_int(operation_queue.get("pending", 0)) > 0:
        signals.append("operation_queue_pending")
    if as_int(operation_queue.get("failed", 0)) > 0:
        signals.append("operation_queue_failed")
    if as_int(tenant_snapshots.get("stale", 0)) > 0:
        signals.append("tenant_snapshot_stale")
    if as_int(metrics.get("consecutive_error_cycles", 0)) > 0:
        signals.append("recent_error_cycles")
    for warning in report.get("warnings", []):
        if (
            warning
            in {
                "public_service_policy_limit_reached",
                "sqlite_migration_recommended",
                "tenant_snapshot_stale",
            }
            and warning not in signals
        ):
            signals.append(str(warning))

    status = _highest_status(triggers, signals)
    return {
        "ok": status != "migration_required",
        "status": status,
        "summary": _summary_for_status(status),
        "triggers": triggers,
        "signals": signals,
        "next_actions": _next_actions(status),
        "migration_plan": _migration_plan(),
    }


def build_scale_readiness_report() -> ScaleReadinessReport:
    return build_scale_readiness_from_health(build_health_report())


def render_scale_readiness_report(report: ScaleReadinessReport) -> str:
    lines = [
        f"status: {report['status']}",
        f"summary: {report['summary']}",
        "signals: " + (", ".join(report["signals"]) if report["signals"] else "none"),
    ]
    for trigger in report["triggers"]:
        lines.append(
            "trigger."
            f"{trigger['name']}: {trigger['current']}/{trigger['limit']} "
            f"usage={trigger['usage_percent']}% level={trigger['level']}"
        )
    lines.append("next_actions: " + " | ".join(report["next_actions"]))
    lines.append("migration_plan: " + " | ".join(report["migration_plan"]))
    return "\n".join(lines)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Scale readiness check di FiscalBay.")
    parser.add_argument("--json", action="store_true", help="Stampa il report in JSON.")
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    configure_logging()
    parser = build_parser()
    args = parser.parse_args(argv)
    report = build_scale_readiness_report()
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(render_scale_readiness_report(report))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
