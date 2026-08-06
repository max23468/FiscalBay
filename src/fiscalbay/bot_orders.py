"""Telegram bot orders functions."""

from __future__ import annotations

import html
import logging
from typing import Callable

from .bot_common import (
    _fetch_tenant_records_for_user,
    _notification_filter_mode_from_filters,
    _record_matches_notification_filter,
    fetch_environment_records,
    send_message,
)
from .bot_messaging import request_with_backoff
from .errors import ConfigurationError, EbayApiError, UserInputError
from .fiscal_export import build_fiscal_export_report
from .logging_utils import log_event
from .models import (
    BotRuntimeState,
    FetchOptions,
    OrderRecord,
    RetryQueueEntry,
    TelegramConfig,
)
from .services.notifications import (
    maybe_send_new_order_notifications as _maybe_send_new_order_notifications,
)
from .storage.notifications import (
    list_notification_tenants,
    load_notification_subscriptions,
)
from .storage.runtime import (
    load_retry_queue_entries,
    load_runtime_state,
    load_tenant_retry_queue_entries,
    load_tenant_runtime_state,
    save_retry_queue_entries,
    save_runtime_state,
    save_tenant_retry_queue_entries,
    save_tenant_runtime_state,
)
from .storage.users import (
    load_telegram_chats,
    load_tenant_account_status_cache,
    resolve_ebay_token_set,
)
from .telegram_common import record_fingerprint
from .telegram_orders import (
    format_fiscal_export_messages,
    format_order_notification_summary,
    format_orders_command_help,
    format_priority_records,
    format_report_summary,
    format_review_records,
    format_search_records,
    format_why_not_notified_status,
    options_for_command,
)
from .telegram_orders import format_record as _format_record
from .telegram_orders import format_records as _format_records
from .telegram_orders import looks_like_order_id as _looks_like_order_id
from .telegram_orders import order_record_matches_search as _order_record_matches_search
from .tenant_credentials import decode_refresh_token

LOGGER = logging.getLogger("fiscalbay.telegram_bot")


def _format_order_lookup_error(
    *,
    exc: EbayApiError,
    order_id: str,
    environment: str,
) -> str:
    message = str(exc)
    if exc.status_code == 400 and "Invalid Order Id" in message:
        return (
            "⚠️ eBay ha rifiutato questo orderId come non valido per le credenziali correnti.\n"
            f"OrderId: <code>{html.escape(order_id)}</code> • ambiente: "
            f"<code>{html.escape(environment)}</code>\n"
            "Controlla che l'ID sia nel formato atteso (es. <code>12-34567-89012</code>) "
            "e che appartenga allo stesso account eBay collegato al bot.\n"
            "Suggerimento: usa prima <code>/ordini tutti 30 200</code> "
            "e copia l'orderId mostrato dal bot."
        )
    return f"⚠️ {html.escape(message)}"


def explain_why_order_not_notified(
    order: OrderRecord,
    state: BotRuntimeState,
    *,
    environment: str,
    state_path: str,
    telegram_user_id: int | None,
    chat_id: int | None,
) -> dict[str, str]:
    order_id = order.orderId
    fingerprint = record_fingerprint(order)
    delivery_status = "delivery_unknown"
    delivery_headline = "Il contesto di recapito di questa chat non è disponibile."
    delivery_detail = (
        "Il comando non riesce a verificare preferenze notifiche senza chat o utente Telegram."
    )
    if telegram_user_id is not None and chat_id is not None:
        chats = load_telegram_chats(state_path)
        subscriptions = load_notification_subscriptions(state_path)
        chat = next(
            (
                item
                for item in chats
                if item.telegram_user_id == telegram_user_id and item.telegram_chat_id == chat_id
            ),
            None,
        )
        subscription = next(
            (
                item
                for item in subscriptions
                if item.telegram_user_id == telegram_user_id and item.telegram_chat_id == chat_id
            ),
            None,
        )
        if chat is None:
            delivery_status = "chat_not_registered"
            delivery_headline = "Questa chat non è ancora registrata come target notifiche."
            delivery_detail = "Invia un comando al bot da questa chat e verifica poi /settings."
        elif not chat.notifications_enabled:
            delivery_status = "chat_notifications_disabled"
            delivery_headline = "Le notifiche risultano disabilitate per questa chat."
            delivery_detail = (
                "Riattiva la chat con /settings notifiche on prima di aspettarti nuovi avvisi."
            )
        elif subscription is None:
            delivery_status = "chat_not_subscribed"
            delivery_headline = "Questa chat non ha una subscription notifiche attiva."
            delivery_detail = (
                "Serve una subscription tenant per ricevere auto-notifiche in questa chat."
            )
        elif not subscription.enabled:
            delivery_status = "chat_subscription_disabled"
            delivery_headline = "La subscription notifiche di questa chat è disattivata."
            delivery_detail = (
                "Riattiva la subscription con /settings notifiche on per ricevere nuovi ordini."
            )
        else:
            delivery_status = "delivery_ready"
            delivery_headline = "Questa chat risulta abilitata a ricevere notifiche."
            delivery_detail = (
                "Se l'ordine è eleggibile e non già deduplicato, il recapito qui è pronto."
            )
    if not order_id:
        return {
            "order_id": "n/d",
            "environment": environment,
            "status": "missing_order_id",
            "headline": "L'ordine non ha un identificativo stabile utilizzabile.",
            "detail": "Il runtime non notificherebbe un record senza orderId.",
            "delivery_status": delivery_status,
            "delivery_headline": delivery_headline,
            "delivery_detail": delivery_detail,
        }
    if not order.has_fiscal_identifier():
        return {
            "order_id": order_id,
            "environment": environment,
            "status": "not_eligible",
            "headline": "L'ordine non rientra nei criteri di notifica correnti.",
            "detail": (
                "Il bot notifica solo ordini con identificativo fiscale presente e valorizzato."
            ),
            "delivery_status": delivery_status,
            "delivery_headline": delivery_headline,
            "delivery_detail": delivery_detail,
        }
    if order_id in set(state.notified_order_ids):
        return {
            "order_id": order_id,
            "environment": environment,
            "status": "already_notified_order_id",
            "headline": "L'ordine risulta già notificato o tracciato come visto.",
            "detail": "La deduplica per orderId evita una seconda notifica.",
            "delivery_status": delivery_status,
            "delivery_headline": delivery_headline,
            "delivery_detail": delivery_detail,
        }
    if fingerprint in set(state.notified_hashes):
        return {
            "order_id": order_id,
            "environment": environment,
            "status": "already_notified_fingerprint",
            "headline": "L'ordine collide con una fingerprint già notificata.",
            "detail": "La deduplica per fingerprint evita duplicati anche oltre il solo orderId.",
            "delivery_status": delivery_status,
            "delivery_headline": delivery_headline,
            "delivery_detail": delivery_detail,
        }
    return {
        "order_id": order_id,
        "environment": environment,
        "status": "would_notify",
        "headline": "Con i criteri attuali questo ordine risulta notificabile.",
        "detail": (
            "Se entra in una finestra nuova del polling e la chat ha notifiche attive, "
            "il bot lo notificherà."
        ),
        "delivery_status": delivery_status,
        "delivery_headline": delivery_headline,
        "delivery_detail": delivery_detail,
    }


def maybe_send_new_order_notifications(
    telegram_config: TelegramConfig,
    ebay_environment: str,
) -> None:
    tenant_targets = list_notification_tenants(telegram_config.state_path)
    strict_tenant_credentials = telegram_config.admin_user_id is not None
    if not tenant_targets:
        if not strict_tenant_credentials:
            _maybe_send_new_order_notifications(
                telegram_config,
                ebay_environment,
                load_state_fn=load_runtime_state,
                save_state_fn=save_runtime_state,
                load_retry_queue_fn=load_retry_queue_entries,
                save_retry_queue_fn=save_retry_queue_entries,
                fetch_records_for_environment_fn=fetch_environment_records,
                send_message_fn=send_message,
                request_with_backoff_fn=request_with_backoff,
            )
            return
        log_event(
            LOGGER,
            logging.INFO,
            "notify_skipped",
            reason="no_tenant_targets",
        )
        return

    for target in tenant_targets:
        cached_account_status = load_tenant_account_status_cache(
            telegram_config.state_path,
            target.telegram_user_id,
        )
        cached_status = str(cached_account_status.get("account_status") or "unlinked")
        cached_token_status = str(cached_account_status.get("token_status") or "missing")
        if cached_status in {"disconnected", "revoked"} or cached_token_status in {
            "revoked",
            "expired",
            "token_expired",
        }:
            log_event(
                LOGGER,
                logging.INFO,
                "notify_tenant_skipped",
                telegram_user_id=target.telegram_user_id,
                environment=target.environment,
                reason="tenant_reconnect_cached",
            )
            continue
        token_set = resolve_ebay_token_set(
            telegram_config.state_path,
            target.telegram_user_id,
            target.environment,
        )
        if (
            token_set is None
            or token_set.status != "active"
            or not decode_refresh_token(token_set.refresh_token_encrypted)
        ):
            log_event(
                LOGGER,
                logging.WARNING,
                "notify_tenant_skipped",
                telegram_user_id=target.telegram_user_id,
                environment=target.environment,
                reason="tenant_credentials_unavailable",
            )
            continue
        tenant_config = TelegramConfig(
            token=telegram_config.token,
            allowed_chat_ids=telegram_config.allowed_chat_ids,
            notify_chat_ids=set(target.notify_chat_ids),
            poll_timeout_seconds=telegram_config.poll_timeout_seconds,
            ebay_poll_interval_seconds=telegram_config.ebay_poll_interval_seconds,
            state_path=telegram_config.state_path,
            retry_queue_path=telegram_config.retry_queue_path,
            lock_path=telegram_config.lock_path,
        )
        tenant_user_id = target.telegram_user_id

        def load_state(_path: str) -> BotRuntimeState:
            return load_tenant_runtime_state(telegram_config.state_path, tenant_user_id)

        def save_state(_path: str, state: BotRuntimeState) -> None:
            save_tenant_runtime_state(telegram_config.state_path, tenant_user_id, state)

        def load_queue(_path: str) -> list[RetryQueueEntry]:
            return load_tenant_retry_queue_entries(telegram_config.retry_queue_path, tenant_user_id)

        def save_queue(_path: str, queue: list[RetryQueueEntry]) -> None:
            save_tenant_retry_queue_entries(telegram_config.retry_queue_path, tenant_user_id, queue)

        def fetch_tenant_records(env: str, options: FetchOptions) -> list[OrderRecord]:
            return _fetch_tenant_records_for_user(
                env,
                options,
                telegram_user_id=tenant_user_id,
                state_path=telegram_config.state_path,
                allow_global_fallback=not strict_tenant_credentials,
            )

        def should_deliver(record: OrderRecord, chat_id: int) -> bool:
            return _record_matches_notification_filter(
                next(
                    (
                        _notification_filter_mode_from_filters(subscription.filters)
                        for subscription in load_notification_subscriptions(
                            telegram_config.state_path
                        )
                        if subscription.telegram_user_id == tenant_user_id
                        and subscription.telegram_chat_id == chat_id
                    ),
                    "all",
                ),
                record,
            )

        _maybe_send_new_order_notifications(
            tenant_config,
            target.environment or ebay_environment,
            load_state_fn=load_state,
            save_state_fn=save_state,
            load_retry_queue_fn=load_queue,
            save_retry_queue_fn=save_queue,
            fetch_records_for_environment_fn=fetch_tenant_records,
            send_message_fn=send_message,
            request_with_backoff_fn=request_with_backoff,
            should_deliver_record_fn=should_deliver,
        )


def handle_orders_command(
    command: str,
    args: list[str],
    *,
    telegram_config: TelegramConfig,
    chat_id: int,
    resolved_environment: str,
    resolved_telegram_user_id: int | None,
    load_state_fn: Callable[[str], BotRuntimeState],
    fetch_records_for_environment_fn: Callable[[str, FetchOptions], list[OrderRecord]],
) -> list[str] | None:
    if command == "/ordini":
        if not args:
            return [format_orders_command_help()]
        order_action = args[0].strip().lower()
        order_args = args[1:]
        if order_action == "fiscali":
            options = options_for_command("/ultimi", order_args)
            try:
                records = request_with_backoff(
                    lambda: fetch_records_for_environment_fn(resolved_environment, options),
                    label="fetch_records_ordini_fiscali",
                )
            except ConfigurationError as exc:
                return [f"⚠️ {exc}"]
            return _format_records(records, only_found=options.only_found)
        if order_action == "tutti":
            options = options_for_command("/tutti", order_args)
            try:
                records = request_with_backoff(
                    lambda: fetch_records_for_environment_fn(resolved_environment, options),
                    label="fetch_records_ordini_tutti",
                )
            except ConfigurationError as exc:
                return [f"⚠️ {exc}"]
            return _format_records(records, only_found=options.only_found)
        if order_action == "cerca":
            if not order_args:
                return [
                    "Uso corretto: <code>/ordini cerca &lt;order_id|testo&gt; [giorni] [max]</code>"
                ]
            query = order_args[0]
            if not _looks_like_order_id(query):
                try:
                    options = options_for_command("/tutti", order_args[1:])
                except UserInputError as exc:
                    return [f"⚠️ {html.escape(str(exc))}"]
                try:
                    records = request_with_backoff(
                        lambda: fetch_records_for_environment_fn(resolved_environment, options),
                        label="fetch_records_ordini_cerca_testo",
                    )
                except ConfigurationError as exc:
                    return [f"⚠️ {exc}"]
                matched = [
                    record for record in records if _order_record_matches_search(record, query)
                ]
                return format_search_records(
                    matched,
                    query=query,
                    days=options.days or 7,
                    max_results=options.max_results,
                )
            order_id = query
            options = FetchOptions(order_ids=[order_id], only_found=False, max_results=1)
            try:
                records = request_with_backoff(
                    lambda: fetch_records_for_environment_fn(resolved_environment, options),
                    label="fetch_records_ordini_cerca",
                )
            except EbayApiError as exc:
                return [
                    _format_order_lookup_error(
                        exc=exc,
                        order_id=order_id,
                        environment=resolved_environment,
                    )
                ]
            except ConfigurationError as exc:
                return [f"⚠️ {exc}"]
            if not records:
                return ["🔎 Nessun ordine trovato nella selezione richiesta."]
            order_record = records[0]
            state = load_state_fn(telegram_config.state_path)
            explanation = explain_why_order_not_notified(
                order_record,
                state,
                environment=resolved_environment,
                state_path=telegram_config.state_path,
                telegram_user_id=resolved_telegram_user_id,
                chat_id=chat_id,
            )
            return [
                _format_record(order_record)
                + "\n\n"
                + format_order_notification_summary(explanation)
            ]
        if order_action == "spiega":
            if not order_args:
                return ["Uso corretto: <code>/ordini spiega &lt;order_id&gt;</code>"]
            order_id = order_args[0]
            options = FetchOptions(order_ids=[order_id], only_found=False, max_results=1)
            try:
                records = request_with_backoff(
                    lambda: fetch_records_for_environment_fn(resolved_environment, options),
                    label="fetch_records_ordini_spiega",
                )
            except EbayApiError as exc:
                return [
                    _format_order_lookup_error(
                        exc=exc,
                        order_id=order_id,
                        environment=resolved_environment,
                    )
                ]
            except ConfigurationError as exc:
                return [f"⚠️ {exc}"]
            if not records:
                return [
                    format_why_not_notified_status(
                        {
                            "order_id": order_id,
                            "environment": resolved_environment,
                            "status": "order_not_found",
                            "headline": (
                                "L'ordine non è stato trovato con le credenziali correnti."
                            ),
                            "detail": (
                                "Verifica orderId, ambiente e collegamento account prima "
                                "di riprovare."
                            ),
                        }
                    )
                ]
            state = load_state_fn(telegram_config.state_path)
            explanation = explain_why_order_not_notified(
                records[0],
                state,
                environment=resolved_environment,
                state_path=telegram_config.state_path,
                telegram_user_id=resolved_telegram_user_id,
                chat_id=chat_id,
            )
            return [format_why_not_notified_status(explanation)]
        if order_action == "controlla":
            options = options_for_command("/tutti", order_args)
            try:
                records = request_with_backoff(
                    lambda: fetch_records_for_environment_fn(resolved_environment, options),
                    label="fetch_records_ordini_controlla",
                )
            except ConfigurationError as exc:
                return [f"⚠️ {exc}"]
            review_records = [record for record in records if not record.has_fiscal_identifier()]
            return format_review_records(review_records)
        if order_action == "report":
            options = options_for_command("/tutti", order_args)
            try:
                records = request_with_backoff(
                    lambda: fetch_records_for_environment_fn(resolved_environment, options),
                    label="fetch_records_ordini_report",
                )
            except ConfigurationError as exc:
                return [f"⚠️ {exc}"]
            return [
                format_report_summary(
                    records,
                    days=options.days or 7,
                    max_results=options.max_results,
                )
            ]
        if order_action == "priorita":
            options = options_for_command("/tutti", order_args)
            try:
                records = request_with_backoff(
                    lambda: fetch_records_for_environment_fn(resolved_environment, options),
                    label="fetch_records_ordini_priorita",
                )
            except ConfigurationError as exc:
                return [f"⚠️ {exc}"]
            return format_priority_records(records)
        if order_action == "export":
            options = options_for_command("/tutti", order_args)
            try:
                report = request_with_backoff(
                    lambda: build_fiscal_export_report(
                        options,
                        fetch_records_fn=lambda export_options: fetch_records_for_environment_fn(
                            resolved_environment,
                            export_options,
                        ),
                    ),
                    label="fetch_records_ordini_export",
                )
            except ConfigurationError as exc:
                return [f"⚠️ {exc}"]
            return format_fiscal_export_messages(report)
        return [format_orders_command_help()]

    return None
