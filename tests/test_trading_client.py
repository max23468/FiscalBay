import unittest
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from io import BytesIO
from unittest.mock import MagicMock, patch

from src.fiscalbay.clients import trading
from src.fiscalbay.errors import EbayApiError
from src.fiscalbay.models import Config


def sample_config(environment: str = "production") -> Config:
    return Config(
        client_id="cid",
        client_secret="secret",
        refresh_token="refresh",
        environment=environment,
        scopes="scope",
    )


def trading_response(*orders: str, ack: str = "Success") -> ET.Element:
    body = (
        f'<GetOrdersResponse xmlns="{trading.TRADING_NAMESPACE}">'
        f"<Ack>{ack}</Ack>"
        f"<OrderArray>{''.join(orders)}</OrderArray>"
        "</GetOrdersResponse>"
    )
    return ET.fromstring(body)


def order_xml(order_id: str, *, extended_order_id: str = "", taxpayer_id: str = "IT123") -> str:
    return (
        "<Order>"
        f"<OrderID>{order_id}</OrderID>"
        f"<ExtendedOrderID>{extended_order_id}</ExtendedOrderID>"
        "<BuyerTaxIdentifier>"
        f"<ID>{taxpayer_id}</ID>"
        "<Type>Codice Fiscale</Type>"
        '<Attribute name="IssuingCountry">IT</Attribute>'
        "</BuyerTaxIdentifier>"
        "</Order>"
    )


class TradingClientTests(unittest.TestCase):
    def test_trading_api_base_and_site_id_use_environment_defaults(self) -> None:
        self.assertIn("sandbox", trading.trading_api_base("sandbox"))
        self.assertEqual(trading.trading_api_base("production"), "https://api.ebay.com/ws/api.dll")
        with patch.dict("os.environ", {"EBAY_TRADING_SITE_ID": ""}, clear=False):
            self.assertEqual(trading.trading_site_id(), trading.DEFAULT_TRADING_SITE_ID)
        with patch.dict("os.environ", {"EBAY_TRADING_SITE_ID": "77"}, clear=False):
            self.assertEqual(trading.trading_site_id(), "77")

    def test_get_order_tax_identifiers_batches_ids_and_maps_extended_ids(self) -> None:
        first_root = trading_response(
            order_xml("order-1", extended_order_id="legacy-1", taxpayer_id="RSSMRA")
        )
        second_root = trading_response(order_xml("order-21", taxpayer_id="VAT123"))
        order_ids = ["order-1", "order-1", "", *[f"order-{index}" for index in range(2, 22)]]

        with patch("src.fiscalbay.clients.trading.request_trading_xml") as request_mock:
            request_mock.side_effect = [first_root, second_root]
            identifiers = trading.get_order_tax_identifiers(sample_config(), "access", order_ids)

        self.assertEqual(request_mock.call_count, 2)
        self.assertEqual(identifiers["order-1"]["taxpayerId"], "RSSMRA")
        self.assertEqual(identifiers["legacy-1"]["taxIdentifierType"], "CODICE_FISCALE")
        self.assertEqual(identifiers["order-21"]["issuingCountry"], "IT")

    def test_get_order_tax_identifiers_by_date_stops_on_partial_page(self) -> None:
        root = trading_response(order_xml("order-1"))
        with patch(
            "src.fiscalbay.clients.trading.request_trading_xml", return_value=root
        ) as request_mock:
            identifiers = trading.get_order_tax_identifiers_by_date(
                sample_config(),
                "access",
                datetime(2026, 5, 1, tzinfo=timezone.utc),
                datetime(2026, 5, 2, tzinfo=timezone.utc),
                page_size=20,
                max_results=100,
            )

        self.assertEqual(request_mock.call_count, 1)
        self.assertEqual(identifiers["order-1"]["taxIdentifierType"], "CODICE_FISCALE")

    @patch("src.fiscalbay.clients.trading.urllib.request.urlopen")
    def test_request_trading_xml_once_parses_success_and_sets_headers(self, urlopen_mock) -> None:
        response = MagicMock()
        response.__enter__.return_value.read.return_value = (
            f'<GetOrdersResponse xmlns="{trading.TRADING_NAMESPACE}">'
            "<Ack>Warning</Ack>"
            "<OrderArray />"
            "</GetOrdersResponse>"
        ).encode("utf-8")
        urlopen_mock.return_value = response

        root = trading.request_trading_xml_once(
            sample_config("sandbox"), "access-token", b"<xml />"
        )

        request = urlopen_mock.call_args.args[0]
        self.assertEqual(root.findtext("e:Ack", namespaces=trading.NS), "Warning")
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(request.headers["X-ebay-api-call-name"], "GetOrders")
        self.assertEqual(request.headers["X-ebay-api-iaf-token"], "access-token")

    @patch("src.fiscalbay.clients.trading.urllib.request.urlopen")
    def test_request_trading_xml_once_reports_http_network_xml_and_ack_errors(
        self,
        urlopen_mock,
    ) -> None:
        urlopen_mock.side_effect = urllib.error.HTTPError(
            "https://api.ebay.com/ws/api.dll",
            500,
            "Server Error",
            {},
            BytesIO(b"down"),
        )
        with self.assertRaises(EbayApiError) as http_ctx:
            trading.request_trading_xml_once(sample_config(), "access", b"<xml />")
        self.assertEqual(http_ctx.exception.status_code, 500)

        urlopen_mock.side_effect = urllib.error.URLError("offline")
        with self.assertRaises(EbayApiError) as network_ctx:
            trading.request_trading_xml_once(sample_config(), "access", b"<xml />")
        self.assertIn("Errore di rete", str(network_ctx.exception))

        response = MagicMock()
        response.__enter__.return_value.read.return_value = b"<not-xml"
        urlopen_mock.side_effect = None
        urlopen_mock.return_value = response
        with self.assertRaises(EbayApiError) as xml_ctx:
            trading.request_trading_xml_once(sample_config(), "access", b"<xml />")
        self.assertIn("XML non valida", str(xml_ctx.exception))

        response.__enter__.return_value.read.return_value = (
            f'<GetOrdersResponse xmlns="{trading.TRADING_NAMESPACE}">'
            "<Ack>Failure</Ack>"
            "<Errors><ErrorCode>123</ErrorCode><ShortMessage>Nope</ShortMessage></Errors>"
            "</GetOrdersResponse>"
        ).encode("utf-8")
        with self.assertRaises(EbayApiError) as ack_ctx:
            trading.request_trading_xml_once(sample_config(), "access", b"<xml />")
        self.assertIn("error 123", str(ack_ctx.exception))

    @patch("src.fiscalbay.clients.trading.urllib.request.urlopen")
    def test_request_trading_xml_once_rejects_xml_with_entities(self, urlopen_mock) -> None:
        response = MagicMock()
        response.__enter__.return_value.read.return_value = (
            '<?xml version="1.0"?>'
            '<!DOCTYPE GetOrdersResponse [<!ENTITY xxe "boom">]>'
            f'<GetOrdersResponse xmlns="{trading.TRADING_NAMESPACE}">'
            "<Ack>Success</Ack>&xxe;</GetOrdersResponse>"
        ).encode("utf-8")
        urlopen_mock.return_value = response
        with self.assertRaises(EbayApiError) as ctx:
            trading.request_trading_xml_once(sample_config(), "access", b"<xml />")
        self.assertIn("XML non valida", str(ctx.exception))

    @patch("src.fiscalbay.retry.time.sleep")
    @patch("src.fiscalbay.clients.trading.request_trading_xml_once")
    def test_request_trading_xml_retries_transient_trading_errors(
        self,
        request_once_mock,
        _sleep_mock,
    ) -> None:
        expected_root = trading_response()
        request_once_mock.side_effect = [
            EbayApiError("rate limit", status_code=429),
            expected_root,
        ]

        root = trading.request_trading_xml(sample_config(), "access", b"<xml />")

        self.assertIs(root, expected_root)
        self.assertEqual(request_once_mock.call_count, 2)


if __name__ == "__main__":
    unittest.main()
