"""CLI entrypoint."""

from __future__ import annotations

import logging
import os
import sys
from typing import Optional

from .config import load_config
from .errors import AppError
from .models import FetchOptions
from .services.orders import fetch_records, parse_args, write_output

logger = logging.getLogger(__name__)


def main(argv: Optional[list[str]] = None) -> int:
    args = parse_args(argv)
    log_level = os.getenv("LOG_LEVEL", "WARNING").upper()
    logging.basicConfig(
        level=getattr(logging, log_level, logging.WARNING),
        format="%(levelname)s %(name)s: %(message)s",
    )
    try:
        config = load_config(args.environment)
        options = FetchOptions(
            days=args.days,
            created_after=args.created_after,
            created_before=args.created_before,
            limit=args.limit,
            max_results=args.max_results,
            order_ids=args.order_ids,
            only_found=args.only_found,
        )
        records = fetch_records(config, options)
        write_output(records, args.format, args.output)
    except AppError as exc:
        logger.error("%s", exc)
        print(f"Errore: {exc}", file=sys.stderr)
        return 1
    return 0
