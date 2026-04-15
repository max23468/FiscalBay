import unittest
from datetime import timezone
from unittest.mock import patch

from src.ebay_cf.clients.ebay import (
    clear_access_token_cache,
    get_access_token,
    make_request,
)
from src.ebay_cf.errors import EbayApiError
from src.ebay_cf.models import (
    Config,
    FetchOptions,
    OrderRecord,
)
from src.ebay_cf.services.orders import (
    extract_record,
    fetch_records,
    get_csv_fieldnames,
    parse_iso8601,
    render_table,
    resolve_date_window_from_options,
)


class EbayCfToolTests(unittest.TestCase):
    def setUp(self) -> None:
        clear_access_token_cache()

    def tearDown(self) -> None:
        clear_access_token_cache()

    def _sample_config(self) -> Config:
        return Config(
            client_id="cid",
            client_secret="secret",
            refresh_token="refresh",
            environment="production",
            scopes="https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
        )

    @patch("src.ebay_cf.clients.ebay.mint_user_access_token_response")
    def test_get_access_token_uses_cache(self, mock_mint) -> None:
        mock_mint.return_value = {"access_token": "tok-one", "expires_in": 7200}
        cfg = self._sample_config()
        self.assertEqual(get_access_token(cfg), "tok-one")
        self.assertEqual(get_access_token(cfg), "tok-one")
        self.assertEqual(mock_mint.call_count, 1)

    @patch("src.ebay_cf.clients.ebay.logger")
    @patch("src.ebay_cf.clients.ebay.time.sleep", autospec=True)
    @patch("src.ebay_cf.clients.ebay.make_request_once")
    def test_make_request_retries_transient_http(self, mock_once, mock_sleep, _mock_logger) -> None:
        mock_once.side_effect = [
            EbayApiError("HTTP 503", status_code=503),
            {"ok": True},
        ]
        self.assertEqual(make_request("GET", "https://api.ebay.com/x"), {"ok": True})
        self.assertEqual(mock_once.call_count, 2)

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
        self.assertEqual(record.taxpayerId, "RSSMRA80A01H501U")
        self.assertEqual(record.taxIdentifierType, "CODICE_FISCALE")
        self.assertEqual(record.found, "yes")

    def test_render_table_contains_header(self) -> None:
        content = render_table(
            [
                OrderRecord(
                    orderId="1",
                    creationDate="2026-04-03T10:00:00Z",
                    buyerUsername="foo",
                    taxpayerId="RSSMRA80A01H501U",
                    taxIdentifierType="CODICE_FISCALE",
                    issuingCountry="IT",
                    found="yes",
                )
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

    @patch("src.ebay_cf.services.orders.get_order_detail")
    @patch("src.ebay_cf.services.orders.get_orders")
    @patch("src.ebay_cf.services.orders.get_access_token")
    def test_fetch_records_reads_summaries_and_returns_normalized_rows(
        self,
        mock_get_access_token,
        mock_get_orders,
        mock_get_order_detail,
    ) -> None:
        mock_get_access_token.return_value = "access-token"
        mock_get_orders.return_value = [
            {"orderId": "order-1"},
            {"orderId": "order-2"},
        ]
        mock_get_order_detail.side_effect = [
            {
                "orderId": "order-1",
                "creationDate": "2026-04-03T10:00:00Z",
                "buyer": {
                    "username": "buyer-1",
                    "taxIdentifier": {
                        "taxpayerId": "RSSMRA80A01H501U",
                        "taxIdentifierType": "CODICE_FISCALE",
                        "issuingCountry": "IT",
                    },
                },
            },
            {
                "orderId": "order-2",
                "creationDate": "2026-04-03T11:00:00Z",
                "buyer": {
                    "username": "buyer-2",
                },
            },
        ]

        records = fetch_records(
            self._sample_config(),
            FetchOptions(days=7, limit=50, max_results=10, only_found=False),
        )

        self.assertEqual([record.orderId for record in records], ["order-1", "order-2"])
        self.assertEqual(records[0].taxpayerId, "RSSMRA80A01H501U")
        self.assertEqual(records[0].found, "yes")
        self.assertEqual(records[1].taxpayerId, "")
        self.assertEqual(records[1].found, "no")
        mock_get_orders.assert_called_once()
        self.assertEqual(mock_get_order_detail.call_count, 2)

    @patch("src.ebay_cf.services.orders.get_order_detail")
    @patch("src.ebay_cf.services.orders.get_access_token")
    def test_fetch_records_uses_explicit_order_ids_without_listing_call(
        self,
        mock_get_access_token,
        mock_get_order_detail,
    ) -> None:
        mock_get_access_token.return_value = "access-token"
        mock_get_order_detail.side_effect = [
            {
                "orderId": "order-10",
                "creationDate": "2026-04-03T10:00:00Z",
                "buyer": {"username": "buyer-10"},
            },
            {
                "orderId": "order-20",
                "creationDate": "2026-04-03T11:00:00Z",
                "buyer": {
                    "username": "buyer-20",
                    "taxIdentifier": {
                        "taxpayerId": "ABCDEF12G34H567I",
                        "taxIdentifierType": "CODICE_FISCALE",
                        "issuingCountry": "IT",
                    },
                },
            },
        ]

        with patch("src.ebay_cf.services.orders.get_orders") as mock_get_orders:
            records = fetch_records(
                self._sample_config(),
                FetchOptions(order_ids=["order-10", "order-20"], only_found=False),
            )

        self.assertEqual([record.orderId for record in records], ["order-10", "order-20"])
        mock_get_orders.assert_not_called()
        self.assertEqual(mock_get_order_detail.call_count, 2)

    @patch("src.ebay_cf.services.orders.get_order_detail")
    @patch("src.ebay_cf.services.orders.get_orders")
    @patch("src.ebay_cf.services.orders.get_access_token")
    def test_fetch_records_only_found_filters_missing_tax_identifier(
        self,
        mock_get_access_token,
        mock_get_orders,
        mock_get_order_detail,
    ) -> None:
        mock_get_access_token.return_value = "access-token"
        mock_get_orders.return_value = [
            {"orderId": "order-1"},
            {"orderId": "order-2"},
        ]
        mock_get_order_detail.side_effect = [
            {
                "orderId": "order-1",
                "creationDate": "2026-04-03T10:00:00Z",
                "buyer": {"username": "buyer-1"},
            },
            {
                "orderId": "order-2",
                "creationDate": "2026-04-03T11:00:00Z",
                "buyer": {
                    "username": "buyer-2",
                    "taxIdentifier": {
                        "taxpayerId": "ABCDEF12G34H567I",
                        "taxIdentifierType": "CODICE_FISCALE",
                        "issuingCountry": "IT",
                    },
                },
            },
        ]

        records = fetch_records(
            self._sample_config(),
            FetchOptions(days=7, limit=50, max_results=10, only_found=True),
        )

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].orderId, "order-2")

    @patch("src.ebay_cf.services.orders.time.sleep")
    @patch("src.ebay_cf.services.orders.get_order_detail")
    @patch("src.ebay_cf.services.orders.get_access_token")
    def test_fetch_records_waits_between_explicit_order_details_when_configured(
        self,
        mock_get_access_token,
        mock_get_order_detail,
        mock_sleep,
    ) -> None:
        mock_get_access_token.return_value = "access-token"
        mock_get_order_detail.side_effect = [
            {
                "orderId": "order-10",
                "creationDate": "2026-04-03T10:00:00Z",
                "buyer": {"username": "buyer-10"},
            },
            {
                "orderId": "order-20",
                "creationDate": "2026-04-03T11:00:00Z",
                "buyer": {"username": "buyer-20"},
            },
        ]

        with patch("src.ebay_cf.services.orders.order_detail_delay_seconds", return_value=0.25):
            fetch_records(
                self._sample_config(),
                FetchOptions(order_ids=["order-10", "order-20"], only_found=False),
            )

        mock_sleep.assert_called_once_with(0.25)


if __name__ == "__main__":
    unittest.main()
