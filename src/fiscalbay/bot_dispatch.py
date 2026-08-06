"""Telegram message dispatch."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Callable

from .bot_account import handle_account_command
from .bot_admin import handle_access_request, handle_admin_command
from .bot_authz import has_command_capability as _has_command_capability
from .bot_authz import is_admin_user as _is_admin_user
from .bot_authz import is_user_approved as _is_user_approved
from .bot_authz import load_user_status as _load_user_status
from .bot_common import (
    SERVICE_MODE_NORMAL,
    _command_rate_limit_remaining_seconds,
    _fetch_tenant_records_for_user,
    _format_cooldown_message,
    _load_service_state,
    _mark_command_usage,
    _service_mode_blocks_command,
    fetch_environment_records,
    handle_common_command,
    resolve_tenant_command_context,
)
from .bot_orders import handle_orders_command
from .bot_settings import handle_public_settings_command, handle_settings_command
from .models import (
    TELEGRAM_USER_STATUS_NEW,
    BotRuntimeState,
    FetchOptions,
    OrderRecord,
    RetryQueueEntry,
    TelegramConfig,
    TenantChatContext,
)
from .storage.runtime import (
    load_retry_queue_entries,
    load_runtime_state,
    load_tenant_retry_queue_entries,
    load_tenant_runtime_state,
)
from .storage.users import resolve_ebay_token_set, summarize_tenant_account_status
from .telegram_commands import format_access_required_status, is_authorized, parse_command
from .tenant_credentials import decode_refresh_token


def _route_grouped_command(command: str, args: list[str]) -> tuple[str, list[str]]:
    if command == "/account" and args:
        account_action = args[0].strip().lower()
        if account_action == "collega":
            return "/connect", args[1:]
        if account_action == "scollega":
            return "/disconnect", args[1:]
        if account_action == "reconnect":
            return "/reconnect_status", args[1:]

    if command == "/settings" and args:
        settings_action = args[0].strip().lower()
        if settings_action == "notifiche":
            return "/notifications", args[1:]
        if settings_action == "filtro":
            return "/notifications", ["filter", *args[1:]]
        if settings_action == "lascia":
            return "/leave_bot", args[1:]
        if settings_action == "dati":
            return "/data_request", args[1:]
        if settings_action == "policy":
            return "/policy", args[1:]

    if command == "/stato" and args and args[0].strip().lower() == "servizio":
        return "/service_status", args[1:]

    if command == "/admin" and args:
        admin_action = args[0].strip().lower()
        translations = {
            "help": "help",
            "manutenzione": "maintenance",
            "sicurezza": "security",
            "scala": "scale",
            "dormant": "dormant",
            "invite": "invite",
            "export": "export",
            "delete_tenant": "delete_tenant",
            "support": "support",
        }
        if admin_action == "service":
            return "/service_mode", args[1:]
        if translated := translations.get(admin_action):
            return command, [translated, *args[1:]]

    return command, args


def _resolve_runtime_context(
    telegram_config: TelegramConfig,
    *,
    chat_id: int,
    telegram_user_id: int | None,
    ebay_environment: str,
) -> tuple[
    TenantChatContext | None,
    str,
    int | None,
    Callable[[str], BotRuntimeState],
    Callable[[str], list[RetryQueueEntry]],
    Callable[[str, FetchOptions], list[OrderRecord]],
    dict[str, object],
]:
    tenant_context = resolve_tenant_command_context(
        telegram_config,
        chat_id=chat_id,
        telegram_user_id=telegram_user_id,
    )
    strict_tenant_credentials = telegram_config.admin_user_id is not None
    resolved_environment = ebay_environment
    resolved_telegram_user_id = telegram_user_id
    load_state_fn: Callable[[str], BotRuntimeState] = load_runtime_state
    load_retry_queue_fn: Callable[[str], list[RetryQueueEntry]] = load_retry_queue_entries
    fetch_records_fn: Callable[[str, FetchOptions], list[OrderRecord]] = fetch_environment_records

    if tenant_context is not None:
        resolved_telegram_user_id = tenant_context.telegram_user_id
        resolved_environment = tenant_context.environment or ebay_environment
        tenant_user_id = tenant_context.telegram_user_id

        def load_state_fn(_path: str) -> BotRuntimeState:
            return load_tenant_runtime_state(telegram_config.state_path, tenant_user_id)

        def load_retry_queue_fn(_path: str) -> list[RetryQueueEntry]:
            return load_tenant_retry_queue_entries(telegram_config.retry_queue_path, tenant_user_id)

    if resolved_telegram_user_id:
        tenant_user_id = resolved_telegram_user_id

        def fetch_records_fn(environment: str, options: FetchOptions) -> list[OrderRecord]:
            return _fetch_tenant_records_for_user(
                environment,
                options,
                telegram_user_id=tenant_user_id,
                state_path=telegram_config.state_path,
                allow_global_fallback=not strict_tenant_credentials,
            )

    runtime_context: dict[str, object] = {
        "tenant_scope": "tenant" if tenant_context is not None else "global",
        "environment": resolved_environment,
        "config_source": (
            "tenant_required"
            if tenant_context is not None and strict_tenant_credentials
            else "global_env"
        ),
    }
    if tenant_context is not None and resolved_telegram_user_id is not None:
        account_status = summarize_tenant_account_status(
            telegram_config.state_path,
            resolved_telegram_user_id,
            resolved_environment,
        )
        token_set = resolve_ebay_token_set(
            telegram_config.state_path,
            resolved_telegram_user_id,
            resolved_environment,
        )
        token_ready = (
            bool(account_status.get("linked"))
            and token_set is not None
            and token_set.status == "active"
            and bool(decode_refresh_token(token_set.refresh_token_encrypted))
        )
        if token_ready:
            runtime_context["config_source"] = "tenant_store"
        else:
            runtime_context["fallback_reason"] = (
                "tenant_credentials_unavailable"
                if account_status.get("linked")
                else "tenant_account_unlinked"
            )
    return (
        tenant_context,
        resolved_environment,
        resolved_telegram_user_id,
        load_state_fn,
        load_retry_queue_fn,
        fetch_records_fn,
        runtime_context,
    )


def dispatch_message(
    text: str,
    chat_id: int,
    telegram_config: TelegramConfig,
    ebay_environment: str,
    telegram_user_id: int | None = None,
) -> list[str]:
    if not is_authorized(chat_id, telegram_config):
        return ["Chat non autorizzata per questo bot."]

    command, args = _route_grouped_command(*parse_command(text))
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat().replace("+00:00", "Z")
    is_admin_user = _is_admin_user(telegram_user_id, telegram_config)
    user_status = _load_user_status(telegram_config, telegram_user_id)
    can_use_bot = _is_user_approved(telegram_config, telegram_user_id)
    service_mode = str(
        _load_service_state(telegram_config.state_path).get("mode") or SERVICE_MODE_NORMAL
    )
    has_command_capability = _has_command_capability(
        telegram_config,
        telegram_user_id=telegram_user_id,
        command=command,
    )

    response = handle_public_settings_command(
        command,
        args,
        telegram_config=telegram_config,
        chat_id=chat_id,
        environment=ebay_environment,
        telegram_user_id=telegram_user_id,
        is_admin_user=is_admin_user,
        can_use_bot=can_use_bot,
        now=now,
        now_iso=now_iso,
    )
    if response is not None:
        return response
    response = handle_access_request(
        command,
        telegram_config=telegram_config,
        chat_id=chat_id,
        telegram_user_id=telegram_user_id,
        is_admin_user=is_admin_user,
        user_status=user_status,
        now=now,
        now_iso=now_iso,
    )
    if response is not None:
        return response
    response = handle_admin_command(
        command,
        args,
        telegram_config=telegram_config,
        chat_id=chat_id,
        ebay_environment=ebay_environment,
        telegram_user_id=telegram_user_id,
        is_admin_user=is_admin_user,
        service_mode=service_mode,
        now=now,
        now_iso=now_iso,
    )
    if response is not None:
        return response

    if command in {"", "/start"}:
        response = handle_account_command(
            command,
            args,
            telegram_config=telegram_config,
            chat_id=chat_id,
            resolved_environment=ebay_environment,
            resolved_telegram_user_id=telegram_user_id,
            now=now,
            now_iso=now_iso,
            is_admin_user=is_admin_user,
            user_status=user_status,
        )
        if response is not None:
            return response

    if not has_command_capability:
        if command == "/help":
            return [format_access_required_status(user_status or TELEGRAM_USER_STATUS_NEW)]
        return [
            "Utente non ancora approvato per questo bot. "
            "Usa <code>/request_access</code> per inviare la richiesta all'admin."
        ]
    if not can_use_bot and command not in {"/help", "/onboarding", "/altre_azioni"}:
        return [
            "Utente non ancora approvato per questo bot. "
            "Usa <code>/request_access</code> per inviare la richiesta all'admin."
        ]
    if service_block_message := _service_mode_blocks_command(service_mode, command):
        return [service_block_message]

    (
        tenant_context,
        resolved_environment,
        resolved_telegram_user_id,
        load_state_fn,
        load_retry_queue_fn,
        fetch_records_fn,
        runtime_context,
    ) = _resolve_runtime_context(
        telegram_config,
        chat_id=chat_id,
        telegram_user_id=telegram_user_id,
        ebay_environment=ebay_environment,
    )

    if command == "/ordini" and args:
        remaining = _command_rate_limit_remaining_seconds(
            telegram_config.state_path,
            telegram_user_id=resolved_telegram_user_id,
            command=command,
            now=now,
        )
        if remaining > 0:
            return [_format_cooldown_message(command, remaining)]
        _mark_command_usage(
            telegram_config.state_path,
            telegram_user_id=resolved_telegram_user_id,
            command=command,
            timestamp=now_iso,
        )

    response = handle_orders_command(
        command,
        args,
        telegram_config=telegram_config,
        chat_id=chat_id,
        resolved_environment=resolved_environment,
        resolved_telegram_user_id=resolved_telegram_user_id,
        load_state_fn=load_state_fn,
        fetch_records_for_environment_fn=fetch_records_fn,
    )
    if response is not None:
        return response
    response = handle_account_command(
        command,
        args,
        telegram_config=telegram_config,
        chat_id=chat_id,
        resolved_environment=resolved_environment,
        resolved_telegram_user_id=resolved_telegram_user_id,
        now=now,
        now_iso=now_iso,
        is_admin_user=is_admin_user,
        user_status=user_status,
    )
    if response is not None:
        return response
    response = handle_settings_command(
        command,
        args,
        telegram_config=telegram_config,
        chat_id=chat_id,
        resolved_environment=resolved_environment,
        resolved_telegram_user_id=resolved_telegram_user_id,
        tenant_context=tenant_context,
        user_status=user_status,
        now=now,
    )
    if response is not None:
        return response
    response = handle_common_command(
        command,
        telegram_config=telegram_config,
        is_admin_user=is_admin_user,
        runtime_context=runtime_context,
        load_state_fn=load_state_fn,
        load_retry_queue_fn=load_retry_queue_fn,
    )
    if response is not None:
        return response
    return ["Comando non riconosciuto. Usa /help per vedere i comandi disponibili."]
