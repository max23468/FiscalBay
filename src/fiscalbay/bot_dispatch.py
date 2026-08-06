"""Telegram message dispatch."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Callable

from . import bot_common
from .bot_account import _handle_account_command
from .bot_admin import _handle_admin_command
from .bot_authz import has_command_capability as _has_command_capability
from .bot_authz import is_admin_user as _is_admin_user
from .bot_authz import is_user_approved as _is_user_approved
from .bot_authz import load_user_status as _load_user_status
from .bot_common import (
    SERVICE_MODE_NORMAL,
    _append_audit_log,
    _build_policy_status_payload,
    _build_service_status_payload,
    _command_rate_limit_remaining_seconds,
    _fetch_tenant_records_for_user,
    _format_cooldown_message,
    _load_service_state,
    _mark_command_usage,
    _service_mode_blocks_command,
    fetch_environment_records,
    resolve_tenant_command_context,
)
from .bot_orders import _handle_orders_command
from .bot_settings import _handle_settings_command
from .models import (
    CAPABILITY_USE_BOT,
    TELEGRAM_USER_STATUS_ADMIN,
    TELEGRAM_USER_STATUS_APPROVED,
    TELEGRAM_USER_STATUS_NEW,
    TELEGRAM_USER_STATUS_PENDING,
    BotRuntimeState,
    FetchOptions,
    OrderRecord,
    RetryQueueEntry,
    TelegramConfig,
    TelegramUser,
    has_telegram_user_capability,
    is_blocked_telegram_user_status,
    is_pending_telegram_user_status,
)
from .storage.runtime import (
    load_retry_queue_entries,
    load_runtime_state,
    load_tenant_retry_queue_entries,
    load_tenant_runtime_state,
)
from .storage.users import (
    load_telegram_user,
    resolve_ebay_token_set,
    resolve_primary_chat_id,
    summarize_tenant_account_status,
    update_telegram_user_status,
    upsert_telegram_user,
)
from .support_snapshot import build_support_snapshot
from .telegram_account import format_onboarding_guide
from .telegram_admin import (
    format_admin_access_request,
    format_admin_data_request,
    format_support_snapshot,
)
from .telegram_commands import (
    build_admin_approval_markup,
    build_help_text,
    build_other_actions_text,
    build_start_text,
    format_access_request_status,
    format_access_required_status,
    format_status,
    is_authorized,
    parse_command,
)
from .telegram_settings import (
    format_data_request_help,
    format_data_request_status,
    format_policy_status,
    format_service_status,
)
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
        if admin_action == "help":
            return command, ["help", *args[1:]]
        if admin_action == "manutenzione":
            return command, ["maintenance", *args[1:]]
        if admin_action == "sicurezza":
            return command, ["security", *args[1:]]
        if admin_action == "scala":
            return command, ["scale", *args[1:]]
        if admin_action == "dormant":
            return command, ["dormant", *args[1:]]
        if admin_action == "invite":
            return command, ["invite", *args[1:]]
        if admin_action == "export":
            return command, ["export", *args[1:]]
        if admin_action == "delete_tenant":
            return command, ["delete_tenant", *args[1:]]
        if admin_action == "support":
            return command, ["support", *args[1:]]
        if admin_action == "service":
            return "/service_mode", args[1:]

    return command, args


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
    service_state = _load_service_state(telegram_config.state_path)
    service_mode = str(service_state.get("mode") or SERVICE_MODE_NORMAL)
    has_command_capability = _has_command_capability(
        telegram_config,
        telegram_user_id=telegram_user_id,
        command=command,
    )

    if command == "/service_status":
        return [format_service_status(_build_service_status_payload(telegram_config.state_path))]

    if command == "/policy":
        return [format_policy_status(_build_policy_status_payload(telegram_config.state_path))]

    if command == "/data_request" and (is_admin_user or can_use_bot):
        if telegram_user_id is None:
            return [
                "🗂️ <b>Dati e privacy</b>\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Non riesco a identificare l'utente Telegram da questa richiesta."
            ]
        request_arg = str(args[0]).strip().lower() if args else ""
        if request_arg in {"", "help"}:
            return [
                format_data_request_help(_build_policy_status_payload(telegram_config.state_path))
            ]
        if request_arg == "export":
            request_type = "export"
        elif request_arg == "cancellazione":
            request_type = "delete"
        else:
            return [
                "Uso corretto: <code>/settings dati export</code> oppure "
                "<code>/settings dati cancellazione</code>"
            ]
        remaining = _command_rate_limit_remaining_seconds(
            telegram_config.state_path,
            telegram_user_id=telegram_user_id,
            command=command,
            now=now,
        )
        if remaining > 0:
            return [_format_cooldown_message(command, remaining)]
        current_user = load_telegram_user(telegram_config.state_path, telegram_user_id)
        account_status = summarize_tenant_account_status(
            telegram_config.state_path,
            telegram_user_id,
            ebay_environment,
        )
        admin_notified = False
        admin_chat_id = (
            resolve_primary_chat_id(telegram_config.state_path, telegram_config.admin_user_id)
            if telegram_config.admin_user_id is not None
            else None
        )
        if admin_chat_id is not None and current_user is not None:
            bot_common.send_message(
                telegram_config.token,
                admin_chat_id,
                format_admin_data_request(
                    telegram_user_id=telegram_user_id,
                    username=current_user.username,
                    display_name=current_user.display_name,
                    chat_id=chat_id,
                    request_type=request_type,
                    account_status=account_status,
                ),
            )
            admin_notified = True
        _append_audit_log(
            telegram_config,
            event_type="data_request",
            created_at=now_iso,
            actor_telegram_user_id=telegram_user_id,
            target_telegram_user_id=telegram_user_id,
            telegram_chat_id=chat_id,
            environment=ebay_environment,
            outcome=f"{request_type}_requested",
            details={
                "admin_notified": admin_notified,
                "account_status": str(account_status.get("account_status") or ""),
                "token_status": str(account_status.get("token_status") or ""),
            },
        )
        _mark_command_usage(
            telegram_config.state_path,
            telegram_user_id=telegram_user_id,
            command=command,
            timestamp=now_iso,
        )
        return [
            format_data_request_status(
                request_type=request_type,
                admin_notified=admin_notified,
                account_status=account_status,
            )
        ]

    if command == "/request_access":
        if telegram_config.admin_user_id is None:
            return [
                "✅ <b>Accesso libero</b>\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Questa istanza del bot non richiede approvazione admin."
            ]
        if telegram_user_id is None:
            return [format_access_request_status(admin_notified=False)]
        if is_admin_user:
            return [format_access_required_status(TELEGRAM_USER_STATUS_ADMIN, is_admin=True)]
        if has_telegram_user_capability(user_status, CAPABILITY_USE_BOT):
            return [
                "✅ <b>Accesso già approvato</b>\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "Il tuo account è già abilitato all'uso del bot."
            ]
        if is_blocked_telegram_user_status(user_status):
            return [format_access_request_status(blocked=True)]
        remaining = _command_rate_limit_remaining_seconds(
            telegram_config.state_path,
            telegram_user_id=telegram_user_id,
            command=command,
            now=now,
        )
        if remaining > 0:
            return [_format_cooldown_message(command, remaining)]

        timestamp = now_iso
        existing_user = load_telegram_user(telegram_config.state_path, telegram_user_id)
        if existing_user is None:
            upsert_telegram_user(
                telegram_config.state_path,
                TelegramUser(
                    telegram_user_id=telegram_user_id,
                    telegram_chat_id=chat_id,
                    username="",
                    display_name="",
                    created_at=timestamp,
                    status=TELEGRAM_USER_STATUS_PENDING,
                ),
            )
            existing_user = load_telegram_user(telegram_config.state_path, telegram_user_id)
        elif is_pending_telegram_user_status(existing_user.status):
            _append_audit_log(
                telegram_config,
                event_type="request_access",
                created_at=timestamp,
                actor_telegram_user_id=telegram_user_id,
                target_telegram_user_id=telegram_user_id,
                telegram_chat_id=chat_id,
                outcome="already_pending",
                details={"user_status": existing_user.status},
            )
            return [format_access_request_status(already_pending=True)]
        else:
            update_telegram_user_status(
                telegram_config.state_path,
                telegram_user_id,
                TELEGRAM_USER_STATUS_PENDING,
                updated_at=timestamp,
            )
            existing_user = load_telegram_user(telegram_config.state_path, telegram_user_id)

        admin_notified = False
        admin_chat_id = (
            resolve_primary_chat_id(telegram_config.state_path, telegram_config.admin_user_id)
            if telegram_config.admin_user_id is not None
            else None
        )
        if admin_chat_id is not None and existing_user is not None:
            bot_common.send_message(
                telegram_config.token,
                admin_chat_id,
                format_admin_access_request(
                    telegram_user_id=telegram_user_id,
                    username=existing_user.username,
                    display_name=existing_user.display_name,
                    chat_id=chat_id,
                ),
                reply_markup=build_admin_approval_markup(telegram_user_id),
            )
            admin_notified = True
        _append_audit_log(
            telegram_config,
            event_type="request_access",
            created_at=timestamp,
            actor_telegram_user_id=telegram_user_id,
            target_telegram_user_id=telegram_user_id,
            telegram_chat_id=chat_id,
            outcome="pending",
            details={"admin_notified": admin_notified},
        )
        _mark_command_usage(
            telegram_config.state_path,
            telegram_user_id=telegram_user_id,
            command=command,
            timestamp=timestamp,
        )
        return [format_access_request_status(admin_notified=admin_notified)]

    admin_response = _handle_admin_command(
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
    if admin_response is not None:
        return admin_response

    if command in ("", "/start"):
        if is_admin_user:
            return [build_start_text(user_status=TELEGRAM_USER_STATUS_ADMIN, is_admin=True)]
        if telegram_config.admin_user_id is not None and not can_use_bot:
            return [build_start_text(user_status=user_status or TELEGRAM_USER_STATUS_NEW)]

        start_account_status: dict[str, object] | None = None
        if telegram_user_id is not None:
            start_account_status = summarize_tenant_account_status(
                telegram_config.state_path,
                telegram_user_id,
                ebay_environment,
            )
        return [
            build_start_text(
                user_status=user_status or TELEGRAM_USER_STATUS_APPROVED,
                account_status=start_account_status,
            )
        ]

    service_block_message = _service_mode_blocks_command(service_mode, command)
    if service_block_message is not None:
        return [service_block_message]

    if command == "/help" and (
        is_admin_user or can_use_bot or telegram_config.admin_user_id is None
    ):
        return [build_help_text(is_admin=is_admin_user)]

    if command == "/altre_azioni" and has_command_capability:
        return [build_other_actions_text(is_admin=is_admin_user)]

    if not has_command_capability:
        if command == "/help":
            return [format_access_required_status(user_status or TELEGRAM_USER_STATUS_NEW)]
        if command == "/request_access":
            return [
                format_access_request_status(blocked=is_blocked_telegram_user_status(user_status))
            ]
        return [
            "Utente non ancora approvato per questo bot. "
            "Usa <code>/request_access</code> per inviare la richiesta all'admin."
        ]

    if not can_use_bot and command not in (
        "",
        "/start",
        "/help",
        "/onboarding",
        "/altre_azioni",
        "/request_access",
    ):
        return [
            "Utente non ancora approvato per questo bot. "
            "Usa <code>/request_access</code> per inviare la richiesta all'admin."
        ]

    tenant_context = resolve_tenant_command_context(
        telegram_config,
        chat_id=chat_id,
        telegram_user_id=telegram_user_id,
    )
    strict_tenant_credentials = telegram_config.admin_user_id is not None
    resolved_environment = ebay_environment
    load_state_fn: Callable[[str], BotRuntimeState] = load_runtime_state
    load_retry_queue_fn: Callable[[str], list[RetryQueueEntry]] = load_retry_queue_entries
    fetch_records_for_environment_fn: Callable[[str, FetchOptions], list[OrderRecord]] = (
        fetch_environment_records
    )
    resolved_telegram_user_id = telegram_user_id
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

        def fetch_records_for_environment_fn(
            env: str,
            options: FetchOptions,
        ) -> list[OrderRecord]:
            return _fetch_tenant_records_for_user(
                env,
                options,
                telegram_user_id=tenant_user_id,
                state_path=telegram_config.state_path,
                allow_global_fallback=not strict_tenant_credentials,
            )

    command_context: dict[str, object] = {
        "tenant_scope": "tenant" if tenant_context is not None else "global",
        "environment": resolved_environment,
        "config_source": (
            "tenant_required"
            if tenant_context is not None and strict_tenant_credentials
            else "global_env"
        ),
    }
    if command_context["tenant_scope"] == "tenant" and resolved_telegram_user_id is not None:
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
            command_context["config_source"] = "tenant_store"
        else:
            command_context["fallback_reason"] = (
                "tenant_credentials_unavailable"
                if account_status.get("linked")
                else "tenant_account_unlinked"
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

    orders_response = _handle_orders_command(
        command,
        args,
        telegram_config=telegram_config,
        chat_id=chat_id,
        resolved_environment=resolved_environment,
        resolved_telegram_user_id=resolved_telegram_user_id,
        load_state_fn=load_state_fn,
        fetch_records_for_environment_fn=fetch_records_for_environment_fn,
    )
    if orders_response is not None:
        return orders_response

    if command == "/stato":
        state = load_state_fn(telegram_config.state_path)
        retry_queue_size = len(load_retry_queue_fn(telegram_config.retry_queue_path))
        return [format_status(state, retry_queue_size, runtime_context=command_context)]

    if command == "/onboarding":
        onboarding_account_status: dict[str, object] | None = None
        if resolved_telegram_user_id is not None:
            onboarding_account_status = summarize_tenant_account_status(
                telegram_config.state_path,
                resolved_telegram_user_id,
                resolved_environment,
            )
        return [
            format_onboarding_guide(
                user_status=user_status or TELEGRAM_USER_STATUS_NEW,
                account_status=onboarding_account_status,
                is_admin=is_admin_user,
            )
        ]

    if command == "/support":
        if resolved_telegram_user_id is None:
            return ["Non riesco a identificare l'utente Telegram per lo snapshot supporto."]
        report = build_support_snapshot(
            telegram_config.state_path,
            resolved_telegram_user_id,
            environment=resolved_environment,
        )
        return [format_support_snapshot(report)]

    account_response = _handle_account_command(
        command,
        args,
        telegram_config=telegram_config,
        chat_id=chat_id,
        resolved_environment=resolved_environment,
        resolved_telegram_user_id=resolved_telegram_user_id,
        now=now,
        now_iso=now_iso,
    )
    if account_response is not None:
        return account_response

    settings_response = _handle_settings_command(
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
    if settings_response is not None:
        return settings_response

    if command == "/help":
        return [build_help_text()]
    if command == "/ping":
        return ["pong ✅"]
    return ["Comando non riconosciuto. Usa /help per vedere i comandi disponibili."]
