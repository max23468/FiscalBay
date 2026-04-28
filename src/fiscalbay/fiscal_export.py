"""Seller-facing fiscal export helpers."""

from __future__ import annotations

import argparse
import csv
import json
import os
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from importlib import import_module
from io import StringIO
from typing import Callable, Mapping, Optional, Sequence, cast

from .errors import EbayApiError
from .models import Config, FetchOptions, OrderRecord

FISCAL_EXPORT_FIELDNAMES = [
    "periodStart",
    "periodEnd",
    "orderId",
    "creationDate",
    "buyerUsername",
    "buyerName",
    "buyerEmail",
    "taxpayerId",
    "taxIdentifierType",
    "issuingCountry",
    "fiscalDataStatus",
    "missingFiscalFields",
    "transactionStatus",
    "total",
    "orderQuantity",
    "productDescription",
    "shippingAddress",
]


@dataclass(frozen=True)
class FiscalExportReport:
    generated_at: str
    period_start: str
    period_end: str
    records: tuple[OrderRecord, ...]

    @property
    def total_orders(self) -> int:
        return len(self.records)

    @property
    def with_fiscal_identifier(self) -> int:
        return sum(1 for record in self.records if record.has_fiscal_identifier())

    @property
    def missing_fiscal_identifier(self) -> int:
        return self.total_orders - self.with_fiscal_identifier

    def as_summary_dict(self) -> dict[str, object]:
        return {
            "generated_at": self.generated_at,
            "period_start": self.period_start,
            "period_end": self.period_end,
            "total_orders": self.total_orders,
            "with_fiscal_identifier": self.with_fiscal_identifier,
            "missing_fiscal_identifier": self.missing_fiscal_identifier,
        }


OrderRecordInput = OrderRecord | Mapping[str, object]
FetchRecordsForExport = Callable[[FetchOptions], Sequence[OrderRecordInput]]
FetchRecordsWithConfig = Callable[[Config, FetchOptions], Sequence[OrderRecordInput]]


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _parse_iso8601(value: str) -> datetime:
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _coerce_record(record: OrderRecordInput) -> OrderRecord:
    if isinstance(record, OrderRecord):
        return record
    return OrderRecord.from_mapping(record)


def _missing_fields(record: OrderRecord) -> str:
    missing = []
    if not record.taxpayerId:
        missing.append("taxpayerId")
    if not record.taxIdentifierType:
        missing.append("taxIdentifierType")
    return ",".join(missing)


def _export_row(record: OrderRecord, report: FiscalExportReport) -> dict[str, str]:
    fiscal_data_status = "available" if record.has_fiscal_identifier() else "missing"
    return {
        "periodStart": report.period_start,
        "periodEnd": report.period_end,
        "orderId": record.orderId,
        "creationDate": record.creationDate,
        "buyerUsername": record.buyerUsername,
        "buyerName": record.buyerName,
        "buyerEmail": record.buyerEmail,
        "taxpayerId": record.taxpayerId,
        "taxIdentifierType": record.taxIdentifierType,
        "issuingCountry": record.issuingCountry,
        "fiscalDataStatus": fiscal_data_status,
        "missingFiscalFields": _missing_fields(record),
        "transactionStatus": record.transactionStatus,
        "total": record.total,
        "orderQuantity": record.orderQuantity,
        "productDescription": record.productDescription,
        "shippingAddress": record.shippingAddress,
    }


def fiscal_export_rows(report: FiscalExportReport) -> list[dict[str, str]]:
    return [_export_row(record, report) for record in report.records]


def normalize_fiscal_export_options(
    options: FetchOptions,
    *,
    now_fn: Callable[[], datetime] = _now_utc,
) -> tuple[FetchOptions, str, str]:
    if options.order_ids:
        period_start = options.created_after or ""
        period_end = options.created_before or ""
        return replace(options, include_details=True), period_start, period_end

    period_end_dt = _parse_iso8601(options.created_before) if options.created_before else now_fn()
    period_start_dt = (
        _parse_iso8601(options.created_after)
        if options.created_after
        else period_end_dt - timedelta(days=options.days)
    )
    if period_start_dt >= period_end_dt:
        raise EbayApiError("--created-after deve essere precedente a --created-before.")

    period_start = _iso_z(period_start_dt)
    period_end = _iso_z(period_end_dt)
    export_options = replace(
        options,
        created_after=period_start,
        created_before=period_end,
        include_details=True,
        only_found=False,
    )
    return export_options, period_start, period_end


def build_fiscal_export_report(
    options: FetchOptions,
    *,
    fetch_records_fn: FetchRecordsForExport,
    now_fn: Callable[[], datetime] = _now_utc,
) -> FiscalExportReport:
    export_options, period_start, period_end = normalize_fiscal_export_options(
        options,
        now_fn=now_fn,
    )
    records = [_coerce_record(record) for record in fetch_records_fn(export_options)]
    ordered_records = tuple(
        sorted(
            records,
            key=lambda record: (record.creationDate, record.orderId),
            reverse=True,
        )
    )
    return FiscalExportReport(
        generated_at=_iso_z(now_fn()),
        period_start=period_start,
        period_end=period_end,
        records=ordered_records,
    )


def build_fiscal_export(
    config: Config,
    options: FetchOptions,
    *,
    fetch_records_fn: FetchRecordsWithConfig | None = None,
    now_fn: Callable[[], datetime] = _now_utc,
) -> FiscalExportReport:
    if fetch_records_fn is None:
        orders_module = import_module("fiscalbay.services.orders")
        fetch_records_fn = cast(FetchRecordsWithConfig, orders_module.fetch_records)
    return build_fiscal_export_report(
        options,
        fetch_records_fn=lambda export_options: fetch_records_fn(config, export_options),
        now_fn=now_fn,
    )


def render_fiscal_export_csv(report: FiscalExportReport) -> str:
    string_io = StringIO()
    writer = csv.DictWriter(string_io, fieldnames=FISCAL_EXPORT_FIELDNAMES)
    writer.writeheader()
    writer.writerows(fiscal_export_rows(report))
    return string_io.getvalue().rstrip("\n")


def render_fiscal_export_json(report: FiscalExportReport) -> str:
    payload = {
        "summary": report.as_summary_dict(),
        "rows": fiscal_export_rows(report),
    }
    return json.dumps(payload, indent=2, ensure_ascii=False)


def render_fiscal_export_summary(report: FiscalExportReport) -> str:
    return (
        "Export fiscale venditore\n"
        f"Generato: {report.generated_at}\n"
        f"Periodo: {report.period_start or 'N/D'} -> {report.period_end or 'N/D'}\n"
        f"Ordini: {report.total_orders}\n"
        f"Con dato fiscale: {report.with_fiscal_identifier}\n"
        f"Senza dato fiscale: {report.missing_fiscal_identifier}"
    )


def _parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Genera un export fiscale venditore dagli ordini eBay."
    )
    parser.add_argument(
        "--environment",
        choices=("production", "sandbox"),
        default=os.getenv("EBAY_ENVIRONMENT", "production"),
        help="Ambiente eBay da usare (default: production).",
    )
    parser.add_argument("--days", type=int, default=7, help="Periodo in giorni (default: 7).")
    parser.add_argument("--created-after", help="Data ISO-8601 UTC iniziale.")
    parser.add_argument("--created-before", help="Data ISO-8601 UTC finale.")
    parser.add_argument("--limit", type=int, default=50, help="Dimensione pagina getOrders.")
    parser.add_argument(
        "--max-results",
        type=int,
        default=100,
        help="Numero massimo di ordini da esportare.",
    )
    parser.add_argument(
        "--telegram-user-id",
        type=int,
        help="Usa le credenziali tenant del venditore indicato.",
    )
    parser.add_argument(
        "--state-path",
        default=os.getenv("TELEGRAM_STATE_PATH", "data/state.db"),
        help="Percorso SQLite tenant quando usi --telegram-user-id.",
    )
    parser.add_argument(
        "--format",
        choices=("csv", "json", "summary"),
        default="csv",
        help="Formato output (default: csv).",
    )
    parser.add_argument("--output", help="File destinazione. Se omesso stampa su stdout.")
    return parser.parse_args(argv)


def _render_report(report: FiscalExportReport, fmt: str) -> str:
    if fmt == "json":
        return render_fiscal_export_json(report)
    if fmt == "summary":
        return render_fiscal_export_summary(report)
    return render_fiscal_export_csv(report)


def main(argv: Optional[list[str]] = None) -> int:
    args = _parse_args(argv)
    options = FetchOptions(
        days=args.days,
        created_after=args.created_after,
        created_before=args.created_before,
        limit=args.limit,
        max_results=args.max_results,
        only_found=False,
        include_details=True,
    )
    if args.telegram_user_id is not None:
        application_module = import_module("fiscalbay.application")
        resolved = application_module.resolve_fetch_context(
            args.environment,
            telegram_user_id=args.telegram_user_id,
            state_path=args.state_path,
            allow_global_fallback=False,
        )
        config = cast(Config, resolved.config)
    else:
        config_module = import_module("fiscalbay.config")
        config = cast(Config, config_module.load_config(args.environment))
    report = build_fiscal_export(config, options)
    content = _render_report(report, args.format)
    if args.output:
        with open(args.output, "w", encoding="utf-8", newline="") as handle:
            handle.write(content)
            if not content.endswith("\n"):
                handle.write("\n")
    else:
        print(content)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
