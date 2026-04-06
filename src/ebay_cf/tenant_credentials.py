"""Tenant credential resolution helpers."""

from __future__ import annotations

import os
from typing import Callable

from .config import load_config_with_refresh_token
from .models import Config, EbayTokenSet, LinkedEbayAccount
from .storage.sqlite import resolve_ebay_token_set

PLAINTEXT_TENANT_TOKEN_PREFIX = "plain:"
ENABLE_PLAINTEXT_TENANT_TOKENS = "EBAY_ENABLE_PLAINTEXT_TENANT_TOKENS"


def decode_refresh_token(refresh_token_encrypted: str) -> str | None:
    if not refresh_token_encrypted:
        return None
    if not os.getenv(ENABLE_PLAINTEXT_TENANT_TOKENS):
        return None
    if refresh_token_encrypted.startswith(PLAINTEXT_TENANT_TOKEN_PREFIX):
        return refresh_token_encrypted.removeprefix(PLAINTEXT_TENANT_TOKEN_PREFIX)
    return None


def load_tenant_config_from_storage(
    linked_account: LinkedEbayAccount,
    environment: str,
    state_path: str,
    *,
    resolve_token_set_fn: Callable[
        [str, int, str | None], EbayTokenSet | None
    ] = resolve_ebay_token_set,
    decode_refresh_token_fn: Callable[[str], str | None] = decode_refresh_token,
    load_config_with_refresh_token_fn: Callable[
        [str, str], Config
    ] = load_config_with_refresh_token,
) -> Config | None:
    token_set = resolve_token_set_fn(state_path, linked_account.telegram_user_id, environment)
    if token_set is None:
        return None
    if token_set.status != "active":
        return None
    refresh_token = decode_refresh_token_fn(token_set.refresh_token_encrypted)
    if not refresh_token:
        return None
    return load_config_with_refresh_token_fn(environment, refresh_token)
