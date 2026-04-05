#!/usr/bin/env python3
"""Compatibility wrapper for the CLI module."""

from ebay_cf.cli import main
from ebay_cf.clients.ebay import (
    clear_access_token_cache,
    get_access_token,
    get_order_detail,
    get_orders,
    make_request,
    mint_user_access_token_response,
)
from ebay_cf.config import load_config
from ebay_cf.errors import EbayApiError
from ebay_cf.models import Config, FetchOptions
from ebay_cf.services.orders import (
    choose_tax_identifier,
    extract_record,
    fetch_records,
    get_csv_fieldnames,
    parse_args,
    parse_iso8601,
    render_table,
    resolve_date_window_from_options,
    write_output,
)


def mint_user_access_token(config: Config) -> str:
    return get_access_token(config)


if __name__ == "__main__":
    raise SystemExit(main())
