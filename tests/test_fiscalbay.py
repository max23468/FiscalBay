import unittest
import xml.etree.ElementTree as ET
from datetime import timezone
from unittest.mock import patch

from src.fiscalbay.clients.ebay import (
    clear_access_token_cache,
    get_access_token,
    request_json,
    revoke_user_refresh_token,
)
from src.fiscalbay.clients.trading import _extract_tax_identifiers
from src.fiscalbay.errors import EbayApiError
from src.fiscalbay.models import (
    Config,
    FetchOptions,
    OrderRecord,
)
from src.fiscalbay.services.orders import (
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
        self._trading_tax_patch = patch(
            "src.fiscalbay.services.orders.get_order_tax_identifiers",
            return_value={},
        )
        self._trading_tax_by_date_patch = patch(
            "src.fiscalbay.services.orders.get_order_tax_identifiers_by_date",
            return_value={},
        )
        self.mock_get_order_tax_identifiers = self._trading_tax_patch.start()
        self.mock_get_order_tax_identifiers_by_date = self._trading_tax_by_date_patch.start()
        self.addCleanup(self._trading_tax_patch.stop)
        self.addCleanup(self._trading_tax_by_date_patch.stop)

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

    @patch("src.fiscalbay.clients.ebay.request_user_access_token_response")
    def test_get_access_token_uses_cache(self, mock_mint) -> None:
        mock_mint.return_value = {"access_token": "tok-one", "expires_in": 7200}
        cfg = self._sample_config()
        self.assertEqual(get_access_token(cfg), "tok-one")
        self.assertEqual(get_access_token(cfg), "tok-one")
        self.assertEqual(mock_mint.call_count, 1)

    @patch("src.fiscalbay.clients.ebay.request_user_access_token_response")
    def test_get_access_token_cache_is_scoped_to_refresh_token(self, mock_mint) -> None:
        mock_mint.side_effect = [
            {"access_token": "tok-one", "expires_in": 7200},
            {"access_token": "tok-two", "expires_in": 7200},
        ]
        first_cfg = self._sample_config()
        second_cfg = Config(
            client_id=first_cfg.client_id,
            client_secret=first_cfg.client_secret,
            refresh_token="refresh-for-another-ebay-account",
            environment=first_cfg.environment,
            scopes=first_cfg.scopes,
        )

        self.assertEqual(get_access_token(first_cfg), "tok-one")
        self.assertEqual(get_access_token(first_cfg), "tok-one")
        self.assertEqual(get_access_token(second_cfg), "tok-two")
        self.assertEqual(mock_mint.call_count, 2)

    def test_revoke_user_refresh_token_reports_unsupported_remote_revocation(self) -> None:
        with self.assertRaises(EbayApiError) as ctx:
            revoke_user_refresh_token(self._sample_config())

        self.assertIn("Revoca remota OAuth eBay non automatica", str(ctx.exception))

    @patch("src.fiscalbay.clients.ebay.logger")
    @patch("src.fiscalbay.clients.ebay.time.sleep", autospec=True)
    @patch("src.fiscalbay.clients.ebay.request_json_once")
    def test_make_request_retries_transient_http(self, mock_once, mock_sleep, _mock_logger) -> None:
        mock_once.side_effect = [
            EbayApiError("HTTP 503", status_code=503),
            {"ok": True},
        ]
        self.assertEqual(request_json("GET", "https://api.ebay.com/x"), {"ok": True})
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

    def test_extract_record_reads_tax_identifier_from_plural_container(self) -> None:
        order = {
            "orderId": "12-34567-89013",
            "creationDate": "2026-04-03T10:00:00.000Z",
            "buyer": {
                "username": "buyer-test",
                "taxIdentifiers": [
                    {
                        "taxpayerId": "RSSMRA80A01H501U",
                        "taxIdentifierType": "CODICE_FISCALE",
                        "issuingCountry": "IT",
                    }
                ],
            },
        }
        record = extract_record(order)
        self.assertEqual(record.taxpayerId, "RSSMRA80A01H501U")
        self.assertEqual(record.taxIdentifierType, "CODICE_FISCALE")
        self.assertEqual(record.found, "yes")

    def test_extract_record_falls_back_to_primary_tax_identifier_when_empty(self) -> None:
        order = {
            "orderId": "12-34567-89014",
            "creationDate": "2026-04-03T10:00:00.000Z",
            "buyer": {
                "username": "buyer-test",
                "taxIdentifier": {
                    "taxIdentifierType": "CODICE_FISCALE",
                    "issuingCountry": "IT",
                },
            },
        }
        record = extract_record(order)
        self.assertEqual(record.taxpayerId, "")
        self.assertEqual(record.taxIdentifierType, "CODICE_FISCALE")
        self.assertEqual(record.found, "no")

    def test_extract_record_reads_tax_identifier_alias_keys(self) -> None:
        order = {
            "orderId": "12-34567-89015",
            "creationDate": "2026-04-03T10:00:00.000Z",
            "buyer": {
                "username": "buyer-test",
                "taxIdentifiers": [
                    {
                        "id": "RSSMRA80A01H501U",
                        "type": "CODICE_FISCALE",
                        "countryCode": "IT",
                    }
                ],
            },
        }
        record = extract_record(order)
        self.assertEqual(record.taxpayerId, "RSSMRA80A01H501U")
        self.assertEqual(record.taxIdentifierType, "CODICE_FISCALE")
        self.assertEqual(record.issuingCountry, "IT")
        self.assertEqual(record.found, "yes")

    def test_extract_trading_tax_identifiers_maps_order_ids_and_type(self) -> None:
        payload = """<?xml version="1.0" encoding="utf-8"?>
        <GetOrdersResponse xmlns="urn:ebay:apis:eBLBaseComponents">
          <Ack>Success</Ack>
          <OrderArray>
            <Order>
              <OrderID>order-1</OrderID>
              <ExtendedOrderID>extended-1</ExtendedOrderID>
              <BuyerTaxIdentifier>
                <ID>RSSMRA80A01H501U</ID>
                <Type>CodiceFiscale</Type>
                <Attribute name="IssuingCountry">IT</Attribute>
              </BuyerTaxIdentifier>
            </Order>
          </OrderArray>
        </GetOrdersResponse>
        """

        identifiers = _extract_tax_identifiers(ET.fromstring(payload))

        self.assertEqual(identifiers["order-1"]["taxpayerId"], "RSSMRA80A01H501U")
        self.assertEqual(identifiers["extended-1"]["taxIdentifierType"], "CODICE_FISCALE")
        self.assertEqual(identifiers["order-1"]["issuingCountry"], "IT")

    def test_extract_record_reads_notification_order_details(self) -> None:
        order = {
            "orderId": "12-34567-89016",
            "creationDate": "2026-04-03T10:00:00.000Z",
            "orderPaymentStatus": "PAID",
            "buyer": {
                "username": "buyer-test",
                "buyerRegistrationAddress": {
                    "fullName": "Mario Rossi",
                    "email": "mario@example.com",
                },
                "taxIdentifier": {
                    "taxpayerId": "RSSMRA80A01H501U",
                    "taxIdentifierType": "CODICE_FISCALE",
                    "issuingCountry": "IT",
                },
            },
            "lineItems": [
                {"quantity": 2, "title": "Prodotto A"},
                {"quantity": "3", "title": "Prodotto B"},
            ],
            "pricingSummary": {"total": {"value": "42.50", "currency": "EUR"}},
            "fulfillmentStartInstructions": [
                {
                    "shippingStep": {
                        "shipTo": {
                            "fullName": "Mario Rossi",
                            "contactAddress": {
                                "addressLine1": "Via Roma 1",
                                "city": "Milano",
                                "postalCode": "20100",
                            },
                        }
                    }
                }
            ],
        }

        record = extract_record(order)

        self.assertEqual(record.buyerName, "Mario Rossi")
        self.assertEqual(record.buyerEmail, "mario@example.com")
        self.assertEqual(record.orderQuantity, "5")
        self.assertEqual(record.productDescription, "Prodotto A, Prodotto B")
        self.assertEqual(record.total, "42.50 EUR")
        self.assertEqual(record.transactionStatus, "PAID")
        self.assertIn("Via Roma 1", record.shippingAddress)

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
        self.assertIn("buyerEmail", fieldnames)
        self.assertIn("orderQuantity", fieldnames)
        self.assertIn("productDescription", fieldnames)
        self.assertIn("transactionStatus", fieldnames)

    @patch("src.fiscalbay.services.orders.get_order_detail")
    @patch("src.fiscalbay.services.orders.get_orders")
    @patch("src.fiscalbay.services.orders.get_access_token")
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

    @patch("src.fiscalbay.services.orders.get_order_detail")
    @patch("src.fiscalbay.services.orders.get_orders")
    @patch("src.fiscalbay.services.orders.get_access_token")
    def test_fetch_records_enriches_missing_tax_identifier_from_trading_api(
        self,
        mock_get_access_token,
        mock_get_orders,
        mock_get_order_detail,
    ) -> None:
        mock_get_access_token.return_value = "access-token"
        mock_get_orders.return_value = [{"orderId": "order-1"}]
        mock_get_order_detail.return_value = {
            "orderId": "order-1",
            "creationDate": "2026-04-03T10:00:00Z",
            "buyer": {"username": "buyer-1"},
        }
        self.mock_get_order_tax_identifiers.return_value = {
            "order-1": {
                "taxpayerId": "RSSMRA80A01H501U",
                "taxIdentifierType": "CODICE_FISCALE",
                "issuingCountry": "IT",
            }
        }

        records = fetch_records(
            self._sample_config(),
            FetchOptions(days=7, limit=50, max_results=10, only_found=True),
        )

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].orderId, "order-1")
        self.assertEqual(records[0].taxpayerId, "RSSMRA80A01H501U")
        self.assertEqual(records[0].taxIdentifierType, "CODICE_FISCALE")
        self.mock_get_order_tax_identifiers.assert_called_once_with(
            self._sample_config(),
            "access-token",
            ["order-1"],
        )

    @patch("src.fiscalbay.services.orders.get_order_detail")
    @patch("src.fiscalbay.services.orders.get_access_token")
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

        with patch("src.fiscalbay.services.orders.get_orders") as mock_get_orders:
            records = fetch_records(
                self._sample_config(),
                FetchOptions(order_ids=["order-10", "order-20"], only_found=False),
            )

        self.assertEqual([record.orderId for record in records], ["order-10", "order-20"])
        mock_get_orders.assert_not_called()
        self.assertEqual(mock_get_order_detail.call_count, 2)

    @patch("src.fiscalbay.services.orders.get_order_detail")
    @patch("src.fiscalbay.services.orders.get_orders")
    @patch("src.fiscalbay.services.orders.get_access_token")
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

    @patch("src.fiscalbay.services.orders.get_order_detail")
    @patch("src.fiscalbay.services.orders.get_orders")
    @patch("src.fiscalbay.services.orders.get_access_token")
    def test_fetch_records_can_use_summaries_without_detail_calls(
        self,
        mock_get_access_token,
        mock_get_orders,
        mock_get_order_detail,
    ) -> None:
        mock_get_access_token.return_value = "access-token"
        mock_get_orders.return_value = [
            {
                "orderId": "order-1",
                "creationDate": "2026-04-03T10:00:00Z",
                "buyer": {"username": "buyer-1"},
            },
            {
                "orderId": "order-2",
                "creationDate": "2026-04-03T11:00:00Z",
                "buyer": {"username": "buyer-2"},
            },
        ]

        records = fetch_records(
            self._sample_config(),
            FetchOptions(
                days=7,
                limit=50,
                max_results=10,
                only_found=False,
                include_details=False,
            ),
        )

        self.assertEqual([record.orderId for record in records], ["order-1", "order-2"])
        mock_get_orders.assert_called_once()
        mock_get_order_detail.assert_not_called()

    @patch("src.fiscalbay.services.orders.time.sleep")
    @patch("src.fiscalbay.services.orders.get_order_detail")
    @patch("src.fiscalbay.services.orders.get_access_token")
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

        with patch("src.fiscalbay.services.orders.order_detail_delay_seconds", return_value=0.25):
            fetch_records(
                self._sample_config(),
                FetchOptions(order_ids=["order-10", "order-20"], only_found=False),
            )

        mock_sleep.assert_called_once_with(0.25)

    @patch("src.fiscalbay.services.orders.get_order_detail")
    @patch("src.fiscalbay.services.orders.get_access_token")
    def test_fetch_records_order_ids_fallback_when_detail_returns_invalid_order_id(
        self,
        mock_get_access_token,
        mock_get_order_detail,
    ) -> None:
        mock_get_access_token.return_value = "access-token"
        mock_get_order_detail.side_effect = EbayApiError(
            "HTTP 400 Invalid Order Id",
            status_code=400,
        )

        with patch("src.fiscalbay.services.orders.get_orders") as mock_get_orders:
            records = fetch_records(
                self._sample_config(),
                FetchOptions(order_ids=["order-10"], only_found=False),
            )

        mock_get_orders.assert_not_called()
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].orderId, "order-10")
        self.assertEqual(records[0].taxpayerId, "")
        self.assertEqual(records[0].found, "no")

    @patch("src.fiscalbay.services.orders.get_order_detail")
    @patch("src.fiscalbay.services.orders.get_orders")
    @patch("src.fiscalbay.services.orders.get_access_token")
    def test_fetch_records_include_details_falls_back_to_summary_on_invalid_order_id(
        self,
        mock_get_access_token,
        mock_get_orders,
        mock_get_order_detail,
    ) -> None:
        mock_get_access_token.return_value = "access-token"
        mock_get_orders.return_value = [
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
            }
        ]
        mock_get_order_detail.side_effect = EbayApiError(
            "HTTP 400 Invalid Order Id",
            status_code=400,
        )

        records = fetch_records(
            self._sample_config(),
            FetchOptions(days=7, max_results=10, only_found=False, include_details=True),
        )

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].orderId, "order-1")
        self.assertEqual(records[0].taxpayerId, "RSSMRA80A01H501U")
        self.assertEqual(records[0].taxIdentifierType, "CODICE_FISCALE")
        self.assertEqual(records[0].found, "yes")

    @patch("src.fiscalbay.services.orders.get_order_detail")
    @patch("src.fiscalbay.services.orders.get_orders")
    @patch("src.fiscalbay.services.orders.get_access_token")
    def test_fetch_records_include_details_retries_with_legacy_order_id(
        self,
        mock_get_access_token,
        mock_get_orders,
        mock_get_order_detail,
    ) -> None:
        mock_get_access_token.return_value = "access-token"
        mock_get_orders.return_value = [
            {
                "orderId": "25-14513-45828",
                "legacyOrderId": "v1|1234567890|0",
            }
        ]
        mock_get_order_detail.side_effect = [
            EbayApiError("HTTP 400 Invalid Order Id", status_code=400),
            {
                "orderId": "25-14513-45828",
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
        ]

        records = fetch_records(
            self._sample_config(),
            FetchOptions(days=7, max_results=10, only_found=False, include_details=True),
        )

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].orderId, "25-14513-45828")
        self.assertEqual(records[0].taxpayerId, "RSSMRA80A01H501U")
        self.assertEqual(mock_get_order_detail.call_count, 2)
        self.assertEqual(mock_get_order_detail.call_args_list[1].args[2], "v1|1234567890|0")


if __name__ == "__main__":
    unittest.main()
