from datetime import timezone
import unittest

from src.ebay_cf_tool import (
    FetchOptions,
    extract_record,
    get_csv_fieldnames,
    parse_iso8601,
    render_table,
    resolve_date_window_from_options,
)


class EbayCfToolTests(unittest.TestCase):
    def test_parse_iso8601_accepts_zulu(self) -> None:
        dt = parse_iso8601("2026-04-03T10:11:12Z")
        self.assertEqual(dt.tzinfo, timezone.utc)
        self.assertEqual(dt.year, 2026)
        self.assertEqual(dt.minute, 11)

    def test_extract_record_reads_tax_identifier(self) -> None:
        order = {
            "orderId": "12-34567-89012",
            "creationDate": "2026-04-03T10:00:00.000Z",
            "buyer": {
                "username": "buyer-test",
                "taxIdentifier": {
                    "taxpayerId": "RSSMRA80A01H501U",
                    "taxIdentifierType": "CODICE_FISCALE",
                    "issuingCountry": "IT",
                },
            },
        }
        record = extract_record(order)
        self.assertEqual(record["taxpayerId"], "RSSMRA80A01H501U")
        self.assertEqual(record["taxIdentifierType"], "CODICE_FISCALE")
        self.assertEqual(record["found"], "yes")

    def test_render_table_contains_header(self) -> None:
        content = render_table(
            [
                {
                    "orderId": "1",
                    "creationDate": "2026-04-03T10:00:00Z",
                    "buyerUsername": "foo",
                    "taxpayerId": "RSSMRA80A01H501U",
                    "taxIdentifierType": "CODICE_FISCALE",
                    "issuingCountry": "IT",
                    "found": "yes",
                }
            ]
        )
        self.assertIn("orderId", content)
        self.assertIn("CODICE_FISCALE", content)

    def test_resolve_date_window_from_options_rejects_invalid_range(self) -> None:
        with self.assertRaises(Exception):
            resolve_date_window_from_options(
                FetchOptions(
                    created_after="2026-04-03T10:00:00Z",
                    created_before="2026-04-03T09:00:00Z",
                )
            )

    def test_get_csv_fieldnames_has_defaults_when_empty(self) -> None:
        fieldnames = get_csv_fieldnames([])
        self.assertIn("taxpayerId", fieldnames)
        self.assertIn("buyerName", fieldnames)


if __name__ == "__main__":
    unittest.main()
