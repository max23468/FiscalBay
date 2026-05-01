import io
import unittest
from argparse import Namespace
from unittest.mock import patch

from src.fiscalbay import cli
from src.fiscalbay.errors import AppError


class CliTests(unittest.TestCase):
    @patch("src.fiscalbay.cli.write_output")
    @patch("src.fiscalbay.cli.fetch_environment_records")
    @patch("src.fiscalbay.cli.build_fetch_options_from_namespace")
    @patch("src.fiscalbay.cli.parse_args")
    def test_main_fetches_records_and_writes_requested_format(
        self,
        parse_args_mock,
        build_options_mock,
        fetch_records_mock,
        write_output_mock,
    ) -> None:
        args = Namespace(environment="sandbox", format="json", output="orders.json")
        options = object()
        records = [object()]
        parse_args_mock.return_value = args
        build_options_mock.return_value = options
        fetch_records_mock.return_value = records

        exit_code = cli.main(["--environment", "sandbox"])

        self.assertEqual(exit_code, 0)
        parse_args_mock.assert_called_once_with(["--environment", "sandbox"])
        build_options_mock.assert_called_once_with(args)
        fetch_records_mock.assert_called_once_with("sandbox", options)
        write_output_mock.assert_called_once_with(records, "json", "orders.json")

    @patch("src.fiscalbay.cli.write_output")
    @patch("src.fiscalbay.cli.fetch_environment_records")
    @patch("src.fiscalbay.cli.build_fetch_options_from_namespace")
    @patch("src.fiscalbay.cli.parse_args")
    def test_main_reports_app_errors_to_stderr(
        self,
        parse_args_mock,
        build_options_mock,
        fetch_records_mock,
        write_output_mock,
    ) -> None:
        parse_args_mock.return_value = Namespace(
            environment="production", format="table", output=None
        )
        build_options_mock.side_effect = AppError("config mancante")

        stderr = io.StringIO()
        with patch("sys.stderr", stderr):
            exit_code = cli.main([])

        self.assertEqual(exit_code, 1)
        self.assertIn("Errore: config mancante", stderr.getvalue())
        fetch_records_mock.assert_not_called()
        write_output_mock.assert_not_called()


if __name__ == "__main__":
    unittest.main()
