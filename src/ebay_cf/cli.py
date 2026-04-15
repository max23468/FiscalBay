"""CLI entrypoint."""

from __future__ import annotations

import logging
import os
import sys
from typing import Optional

from .application import build_fetch_options_from_namespace, fetch_environment_records
from .errors import AppError
from .services.orders import parse_args, write_output

logger = logging.getLogger(__name__)


def main(argv: Optional[list[str]] = None) -> int:
    args = parse_args(argv)
    log_level = os.getenv("LOG_LEVEL", "WARNING").upper()
    logging.basicConfig(
        level=getattr(logging, log_level, logging.WARNING),
        format="%(levelname)s %(name)s: %(message)s",
    )
    try:
        options = build_fetch_options_from_namespace(args)
        records = fetch_environment_records(args.environment, options)
        write_output(records, args.format, args.output)
    except AppError as exc:
        logger.error("%s", exc)
        print(f"Errore: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
