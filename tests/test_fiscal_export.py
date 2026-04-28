import unittest
from datetime import datetime, timezone

from src.fiscalbay.fiscal_export import (
    build_fiscal_export_report,
    normalize_fiscal_export_options,
    render_fiscal_export_csv,
    render_fiscal_export_json,
    render_fiscal_export_summary,
)
from src.fiscalbay.models import FetchOptions, OrderRecord


def fixed_now() -> datetime:
    return datetime(2026, 4, 29, 10, 30, tzinfo=timezone.utc)


class FiscalExportTests(unittest.TestCase):
    def test_normalize_fiscal_export_options_freezes_period_window(self) -> None:
        options, period_start, period_end = normalize_fiscal_export_options(
            FetchOptions(days=3, max_results=20),
            now_fn=fixed_now,
        )

        self.assertEqual(period_start, "2026-04-26T10:30:00Z")
        self.assertEqual(period_end, "2026-04-29T10:30:00Z")
        self.assertEqual(options.created_after, period_start)
        self.assertEqual(options.created_before, period_end)
        self.assertEqual(options.max_results, 20)
        self.assertTrue(options.include_details)
        self.assertFalse(options.only_found)

    def test_build_fiscal_export_report_orders_rows_and_counts_missing_data(self) -> None:
        seen_options: list[FetchOptions] = []

        def fetch_records(options: FetchOptions) -> list[OrderRecord]:
            seen_options.append(options)
            return [
                OrderRecord(
                    orderId="order-old",
                    creationDate="2026-04-28T08:00:00Z",
                    buyerUsername="buyer-old",
                    taxpayerId="",
                    taxIdentifierType="",
                    total="10.00 EUR",
                ),
                OrderRecord(
                    orderId="order-new",
                    creationDate="2026-04-29T09:00:00Z",
                    buyerUsername="buyer-new",
                    taxpayerId="IT12345678901",
                    taxIdentifierType="VAT_NUMBER",
                    total="20.00 EUR",
                ),
            ]

        report = build_fiscal_export_report(
            FetchOptions(days=1, max_results=50),
            fetch_records_fn=fetch_records,
            now_fn=fixed_now,
        )

        self.assertEqual(seen_options[0].created_after, "2026-04-28T10:30:00Z")
        self.assertEqual([record.orderId for record in report.records], ["order-new", "order-old"])
        self.assertEqual(report.total_orders, 2)
        self.assertEqual(report.with_fiscal_identifier, 1)
        self.assertEqual(report.missing_fiscal_identifier, 1)

    def test_render_fiscal_export_csv_marks_available_and_missing_rows(self) -> None:
        report = build_fiscal_export_report(
            FetchOptions(days=1),
            fetch_records_fn=lambda _options: [
                OrderRecord(
                    orderId="order-ok",
                    creationDate="2026-04-29T09:00:00Z",
                    taxpayerId="RSSMRA80A01H501U",
                    taxIdentifierType="CODICE_FISCALE",
                ),
                OrderRecord(orderId="order-missing", creationDate="2026-04-29T08:00:00Z"),
            ],
            now_fn=fixed_now,
        )

        csv_content = render_fiscal_export_csv(report)

        self.assertIn("periodStart,periodEnd,orderId", csv_content)
        self.assertIn("order-ok", csv_content)
        self.assertIn("available", csv_content)
        self.assertIn("order-missing", csv_content)
        self.assertIn("missing", csv_content)
        self.assertIn("taxpayerId,taxIdentifierType", csv_content)

    def test_render_fiscal_export_json_and_summary_include_counts(self) -> None:
        report = build_fiscal_export_report(
            FetchOptions(days=1),
            fetch_records_fn=lambda _options: [OrderRecord(orderId="order-1")],
            now_fn=fixed_now,
        )

        self.assertIn('"total_orders": 1', render_fiscal_export_json(report))
        self.assertIn("Senza dato fiscale: 1", render_fiscal_export_summary(report))


if __name__ == "__main__":
    unittest.main()
