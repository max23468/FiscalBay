"""Tenant credential resolution helpers."""

from __future__ import annotations

import os
from typing import Callable

from cryptography.fernet import Fernet, InvalidToken

from .config import load_config_with_refresh_token
from .models import Config, EbayTokenSet, LinkedEbayAccount
from .storage.sqlite import resolve_ebay_token_set

FERNET_TENANT_TOKEN_PREFIX = "fernet:"
PLAINTEXT_TENANT_TOKEN_PREFIX = "plain:"
ENABLE_PLAINTEXT_TENANT_TOKENS = "EBAY_ENABLE_PLAINTEXT_TENANT_TOKENS"
TENANT_TOKEN_KEY = "EBAY_TENANT_TOKEN_KEY"


def load_token_cipher() -> Fernet | None:
    key = os.getenv(TENANT_TOKEN_KEY, "").strip()
    if not key:
        return None
    return Fernet(key.encode("utf-8"))


def decode_refresh_token(refresh_token_encrypted: str) -> str | None:
    if not refresh_token_encrypted:
        return None
    if refresh_token_encrypted.startswith(FERNET_TENANT_TOKEN_PREFIX):
        cipher = load_token_cipher()
        if cipher is None:
            return None
        payload = refresh_token_encrypted.removeprefix(FERNET_TENANT_TOKEN_PREFIX).encode("utf-8")
        try:
            return cipher.decrypt(payload).decode("utf-8")
        except (InvalidToken, UnicodeDecodeError):
            return None
    if not os.getenv(ENABLE_PLAINTEXT_TENANT_TOKENS):
        return None
    if refresh_token_encrypted.startswith(PLAINTEXT_TENANT_TOKEN_PREFIX):
        return refresh_token_encrypted.removeprefix(PLAINTEXT_TENANT_TOKEN_PREFIX)
    return None


def encode_refresh_token(refresh_token: str) -> str | None:
    if not refresh_token:
        return None
    cipher = load_token_cipher()
    if cipher is not None:
        encrypted = cipher.encrypt(refresh_token.encode("utf-8")).decode("utf-8")
        return f"{FERNET_TENANT_TOKEN_PREFIX}{encrypted}"
    if not os.getenv(ENABLE_PLAINTEXT_TENANT_TOKENS):
        return None
    return f"{PLAINTEXT_TENANT_TOKEN_PREFIX}{refresh_token}"


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
