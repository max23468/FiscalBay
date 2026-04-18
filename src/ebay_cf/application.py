"""Application facades shared by CLI and bot entrypoints."""

from __future__ import annotations

import argparse
from typing import Callable

from .config import load_config
from .errors import ConfigurationError
from .models import Config, FetchOptions, LinkedEbayAccount, OrderRecord, ResolvedFetchContext
from .services.orders import fetch_records
from .storage.sqlite import load_tenant_account_status_cache, resolve_linked_ebay_account
from .tenant_credentials import load_tenant_config_from_storage


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


def resolve_fetch_context(
    ebay_environment: str,
    *,
    telegram_user_id: int | None = None,
    state_path: str | None = None,
    allow_global_fallback: bool = True,
    load_config_fn: Callable[[str], Config] = load_config,
    resolve_linked_account_fn: Callable[
        [str, int, str | None], LinkedEbayAccount | None
    ] = resolve_linked_ebay_account,
    load_tenant_config_fn: Callable[[LinkedEbayAccount, str, str], Config | None]
    | None = load_tenant_config_from_storage,
) -> ResolvedFetchContext:
    linked_account: LinkedEbayAccount | None = None
    resolved_environment = ebay_environment
    if telegram_user_id and state_path:
        linked_account = resolve_linked_account_fn(state_path, telegram_user_id, ebay_environment)
        if linked_account is not None and linked_account.environment:
            resolved_environment = linked_account.environment

    cached_status: dict[str, object] = {}
    if telegram_user_id and state_path:
        cached_status = load_tenant_account_status_cache(state_path, telegram_user_id)

    cached_account_status = str(cached_status.get("account_status") or "unlinked")
    cached_token_status = str(cached_status.get("token_status") or "missing")
    cached_requires_reconnect = cached_account_status in {"disconnected", "revoked"} or (
        cached_token_status in {"revoked", "expired", "token_expired"}
    )

    if linked_account is not None and cached_requires_reconnect:
        fallback_reason = "tenant_reconnect_required"
        if telegram_user_id is not None and not allow_global_fallback:
            raise ConfigurationError(
                "Le credenziali tenant eBay richiedono un reconnect. "
                "Completa di nuovo /connect per collegare un token valido."
            )
        return ResolvedFetchContext(
            config=load_config_fn(resolved_environment),
            config_source="global_env",
            environment=resolved_environment,
            telegram_user_id=telegram_user_id,
            ebay_user_id=linked_account.ebay_user_id,
            used_tenant_credentials=False,
            fallback_reason=fallback_reason,
        )

    if linked_account is not None and load_tenant_config_fn is not None:
        tenant_config = load_tenant_config_fn(
            linked_account,
            resolved_environment,
            state_path or "",
        )
        if tenant_config is not None:
            return ResolvedFetchContext(
                config=tenant_config,
                config_source="tenant_store",
                environment=resolved_environment,
                telegram_user_id=telegram_user_id,
                ebay_user_id=linked_account.ebay_user_id,
                used_tenant_credentials=True,
            )

    fallback_reason = None
    if linked_account is not None:
        fallback_reason = "tenant_credentials_unavailable"
    elif telegram_user_id:
        fallback_reason = "tenant_account_unlinked"

    if telegram_user_id is not None and not allow_global_fallback:
        if fallback_reason == "tenant_credentials_unavailable":
            raise ConfigurationError(
                "Credenziali tenant eBay non disponibili per questo utente. "
                "Completa di nuovo /connect per collegare un token valido."
            )
        raise ConfigurationError(
            "Nessun account eBay collegato per questo utente. "
            "Usa /connect per collegare il tuo account eBay."
        )

    return ResolvedFetchContext(
        config=load_config_fn(resolved_environment),
        config_source="global_env",
        environment=resolved_environment,
        telegram_user_id=telegram_user_id,
        ebay_user_id=linked_account.ebay_user_id if linked_account is not None else "",
        used_tenant_credentials=False,
        fallback_reason=fallback_reason,
    )


def resolve_tenant_fetch_account(
    preferred_environment: str,
    *,
    telegram_user_id: int | None,
    state_path: str,
    resolve_linked_account_fn: Callable[
        [str, int, str | None], LinkedEbayAccount | None
    ] = resolve_linked_ebay_account,
) -> LinkedEbayAccount | None:
    if not telegram_user_id:
        return None
    return resolve_linked_account_fn(state_path, telegram_user_id, preferred_environment)


def fetch_tenant_records(
    ebay_environment: str,
    options: FetchOptions,
    *,
    telegram_user_id: int | None,
    state_path: str,
    allow_global_fallback: bool = True,
    load_config_fn: Callable[[str], Config] = load_config,
    fetch_records_fn: Callable[[Config, FetchOptions], list[OrderRecord]] = fetch_records,
    resolve_linked_account_fn: Callable[
        [str, int, str | None], LinkedEbayAccount | None
    ] = resolve_linked_ebay_account,
) -> list[OrderRecord]:
    resolved = resolve_fetch_context(
        ebay_environment,
        telegram_user_id=telegram_user_id,
        state_path=state_path,
        allow_global_fallback=allow_global_fallback,
        load_config_fn=load_config_fn,
        resolve_linked_account_fn=resolve_linked_account_fn,
    )
    return fetch_records_fn(resolved.config, options)
