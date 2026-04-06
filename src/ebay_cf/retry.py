"""Shared retry/backoff helpers."""

from __future__ import annotations

import random
import time
from typing import Callable, TypeVar

T = TypeVar("T")
E = TypeVar("E", bound=BaseException)


def compute_backoff_delay(
    base_delay: float,
    attempt_index: int,
    *,
    jitter_max: float = 0.25,
) -> float:
    return base_delay * (2**attempt_index) + random.uniform(0, jitter_max)


def run_with_retry(
    action: Callable[[], T],
    *,
    max_attempts: int,
    should_retry: Callable[[BaseException], bool],
    on_retry: Callable[[BaseException, int, int, float], None] | None = None,
    base_delay: float = 0.5,
    max_delay: float | None = None,
    jitter_max: float = 0.25,
    sleep_fn: Callable[[float], None] = time.sleep,
) -> T:
    attempts = max(1, max_attempts)
    last_error: BaseException | None = None
    for attempt_index in range(attempts):
        try:
            return action()
        except BaseException as exc:
            last_error = exc
            is_last_attempt = attempt_index == attempts - 1
            if is_last_attempt or not should_retry(exc):
                raise
            delay = compute_backoff_delay(base_delay, attempt_index, jitter_max=jitter_max)
            if max_delay is not None:
                delay = min(delay, max_delay)
            if on_retry is not None:
                on_retry(exc, attempt_index + 1, attempts, delay)
            sleep_fn(delay)
    assert last_error is not None
    raise last_error
