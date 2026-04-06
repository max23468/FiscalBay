"""Application facades shared by CLI and bot entrypoints."""

from __future__ import annotations

import argparse
from typing import Callable

from .config import load_config
from .models import Config, FetchOptions, OrderRecord
from .services.orders import fetch_records


def build_fetch_options_from_namespace(args: argparse.Namespace) -> FetchOptions:
    return FetchOptions(
        days=args.days,
        created_after=args.created_after,
        created_before=args.created_before,
        limit=args.limit,
        max_results=args.max_results,
        order_ids=args.order_ids,
        only_found=args.only_found,
    )


def fetch_environment_records(
    ebay_environment: str,
    options: FetchOptions,
    *,
    load_config_fn: Callable[[str], Config] = load_config,
    fetch_records_fn: Callable[[Config, FetchOptions], list[OrderRecord]] = fetch_records,
) -> list[OrderRecord]:
    config = load_config_fn(ebay_environment)
    return fetch_records_fn(config, options)
