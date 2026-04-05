"""Telegram bot runtime and command handling."""

from __future__ import annotations

import hashlib
import html
import json
import logging
import os
import signal
import sys
import threading
import time
import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows
    fcntl = None

from .clients.telegram import ensure_long_polling, telegram_request
from .config import configure_logging, load_config, load_telegram_config
from .errors import EbayApiError, TelegramApiError
from .models import FetchOptions, TelegramConfig
from .services.orders import fetch_records
from .storage.sqlite import (
    ensure_parent_dir,
    load_retry_queue,
    load_state,
    save_retry_queue,
    save_state,
)

LOGGER = logging.getLogger("ebaycf.telegram_bot")

TELEGRAM_CMD_MAX_DAYS = 365
TELEGRAM_CMD_MIN_DAYS = 1
TELEGRAM_CMD_MAX_RESULTS = 500
TELEGRAM_CMD_MIN_RESULTS = 1

CALLBACK_ULTIMI = "menu:ultimi"
CALLBACK_TUTTI = "menu:tutti"
CALLBACK_STATO = "menu:stato"
CALLBACK_HELP = "menu:help"

_shutdown = threading.Event()


def chunk_message(text: str, limit: int = 3500) -> list[str]:
    if len(text) <= limit:
        return [text]
    chunks: list[str] = []
    current = []
    current_length = 0
    for line in text.splitlines():
        extra = len(line) + (1 if current else 0)
        if current and current_length + extra > limit:
            chunks.append("\n".join(current))
            current = [line]
            current_length = len(line)
            continue
        current.append(line)
        current_length += extra
    if current:
        chunks.append("\n".join(current))
    return chunks


def request_with_backoff(
    fn,
    label: str,
    attempts: int = 4,
    initial_delay: float = 1.0,
) -> object:
    delay = initial_delay
    last_error: Optional[Exception] = None
    for idx in range(1, attempts + 1):
        try:
            return fn()
        except (TelegramApiError, EbayApiError) as exc:
            last_error = exc
            if idx >= attempts:
                break
            LOGGER.warning("%s tentativo %s/%s fallito: %s", label, idx, attempts, exc)
            time.sleep(delay)
            delay = min(delay * 2, 30)
    assert last_error is not None
    raise last_error


def record_fingerprint(record: dict[str, str]) -> str:
    raw = "|".join(
        [
            record.get("orderId", ""),
            record.get("creationDate", ""),
            record.get("buyerUsername", ""),
            record.get("taxpayerId", ""),
            record.get("taxIdentifierType", ""),
            record.get("issuingCountry", ""),
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def format_record(record: dict[str, str]) -> str:
    cf = record.get("taxpayerId") or "non disponibile"
    tax_type = record.get("taxIdentifierType") or "n/d"
    country = record.get("issuingCountry") or "n/d"
    order_id = html.escape(record.get("orderId", ""))
    missing_fiscal = ""
    if not record.get("taxpayerId"):
        missing_fiscal = (
            "\n⚠️ <i>Dati fiscali non presenti nella risposta eBay per questo ordine.</i>"
        )

    ebay_url = (
        "https://www.ebay.it/sh/ord/details?orderid="
        f"{urllib.parse.quote(record.get('orderId', ''))}"
    )

    items = html.escape(record.get("items", "N/D"))
    total = html.escape(record.get("total", "N/D"))
    shipping = html.escape(record.get("shippingAddress", "N/D"))
    buyer = html.escape(record.get("buyerUsername", "") or "n/d")
    created_at = html.escape(record.get("creationDate", ""))

    return (
        f'🛒 <b>Ordine</b> • <a href="{ebay_url}"><code>{order_id}</code></a>\n'
        f"┌ 📅 <b>Data</b>: <code>{created_at}</code>\n"
        f"├ 👤 <b>Acquirente</b>: <code>{buyer}</code>\n"
        f"├ 📦 <b>Articoli</b>: <i>{items}</i>\n"
        f"├ 💰 <b>Totale</b>: <code>{total}</code>\n"
        f"├ 📍 <b>Spedizione</b>: <code>{shipping}</code>\n"
        "└ 💳 <b>CF</b>: "
        f"<code>{html.escape(cf)}</code> "
        f"<i>({html.escape(tax_type)})</i> • "
        f"<code>{html.escape(country)}</code>"
        f"{missing_fiscal}"
    )


def format_records(
    records: Iterable[dict[str, str]], only_found: bool, page_size: int = 5
) -> list[str]:
    rows = list(records)
    if not rows:
        if only_found:
            return [
                "🔎 Nessun ordine con codice fiscale restituito da eBay nella selezione richiesta."
            ]
        return ["🔎 Nessun ordine trovato nella selezione richiesta."]
    pages: list[str] = []
    for start in range(0, len(rows), page_size):
        page_rows = rows[start : start + page_size]
        page_no = (start // page_size) + 1
        total_pages = (len(rows) + page_size - 1) // page_size
        header = (
            "📋 <b>Riepilogo ordini</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"📦 Totale: <code>{len(rows)}</code> • 📄 Pagina: <code>{page_no}/{total_pages}</code>"
        )
        body = "\n\n".join(format_record(row) for row in page_rows)
        pages.append(header + "\n\n" + body)
    return pages


def parse_command(text: str) -> tuple[str, list[str]]:
    parts = text.strip().split()
    if not parts:
        return "", []
    command = parts[0].split("@", 1)[0].lower()
    return command, parts[1:]


def build_help_text() -> str:
    return (
        "🤖 <b>Benvenuto in eBay CF Bot</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Comandi disponibili:\n"
        "• 🟢 <code>/ping</code> → verifica rapida\n"
        "• 📊 <code>/stato</code> → stato e metriche bot\n"
        "• 📦 <code>/ultimi [giorni] [max]</code> → ordini con CF trovato\n"
        "• 📋 <code>/tutti [giorni] [max]</code> → tutti gli ordini\n"
        "• 🔍 <code>/ordine [id]</code> → dettaglio ordine singolo\n"
        "• ℹ️ <code>/help</code> → questa guida\n\n"
        "<b>Esempi rapidi</b>\n"
        "• <code>/ultimi 7 20</code>\n"
        "• <code>/tutti 3 50</code>\n"
        "• <code>/ordine 12-34567-89012</code>\n\n"
        f"<i>Limiti input: giorni {TELEGRAM_CMD_MIN_DAYS}-{TELEGRAM_CMD_MAX_DAYS}, "
        f"max ordini {TELEGRAM_CMD_MIN_RESULTS}-{TELEGRAM_CMD_MAX_RESULTS}.</i>"
    )


def build_main_menu_markup() -> dict[str, object]:
    return {
        "inline_keyboard": [
            [
                {"text": "Ultimi CF", "callback_data": CALLBACK_ULTIMI},
                {"text": "Tutti", "callback_data": CALLBACK_TUTTI},
            ],
            [
                {"text": "Stato", "callback_data": CALLBACK_STATO},
                {"text": "Help", "callback_data": CALLBACK_HELP},
            ],
        ]
    }


def callback_command_from_data(data: str) -> Optional[str]:
    mapping = {
        CALLBACK_ULTIMI: "/ultimi 7 20",
        CALLBACK_TUTTI: "/tutti 7 20",
        CALLBACK_STATO: "/stato",
        CALLBACK_HELP: "/help",
    }
    return mapping.get(data.strip())


def should_attach_main_menu(command: str) -> bool:
    return command in ("", "/start", "/help", "/ping", "/stato")


def options_for_command(command: str, args: list[str]) -> FetchOptions:
    if command == "/ordine":
        if not args:
            raise TelegramApiError("Uso corretto: /ordine <order_id>")
        return FetchOptions(order_ids=[args[0]], only_found=False, max_results=1)

    try:
        days = int(args[0]) if len(args) >= 1 else 7
    except ValueError as exc:
        raise TelegramApiError("Il numero di giorni deve essere un intero.") from exc
    try:
        max_results = int(args[1]) if len(args) >= 2 else 20
    except ValueError as exc:
        raise TelegramApiError("Il numero massimo ordini deve essere un intero.") from exc

    if not TELEGRAM_CMD_MIN_DAYS <= days <= TELEGRAM_CMD_MAX_DAYS:
        raise TelegramApiError(
            "Giorni fuori intervallo: usa un valore tra "
            f"{TELEGRAM_CMD_MIN_DAYS} e {TELEGRAM_CMD_MAX_DAYS}."
        )
    if not TELEGRAM_CMD_MIN_RESULTS <= max_results <= TELEGRAM_CMD_MAX_RESULTS:
        raise TelegramApiError(
            "Max ordini fuori intervallo: usa un valore tra "
            f"{TELEGRAM_CMD_MIN_RESULTS} e {TELEGRAM_CMD_MAX_RESULTS}."
        )

    only_found = command != "/tutti"
    return FetchOptions(days=days, max_results=max_results, only_found=only_found)


def is_authorized(chat_id: int, config: TelegramConfig) -> bool:
    if config.allowed_chat_ids is None:
        return True
    return chat_id in config.allowed_chat_ids


def send_message(
    token: str,
    chat_id: int,
    text: str,
    message_thread_id: Optional[int] = None,
    reply_markup: Optional[dict[str, object]] = None,
) -> None:
    chunks = chunk_message(text)
    for idx, chunk in enumerate(chunks):
        params: dict[str, object] = {
            "chat_id": chat_id,
            "text": chunk,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
        if message_thread_id is not None:
            params["message_thread_id"] = message_thread_id
        if reply_markup is not None and idx == len(chunks) - 1:
            params["reply_markup"] = reply_markup
        try:
            telegram_request(token, "sendMessage", params)
        except TelegramApiError as exc:
            if getattr(exc, "status_code", None) != 400 and "HTTP 400" not in str(exc):
                raise
            fallback_params: dict[str, object] = {
                "chat_id": chat_id,
                "text": chunk,
                "disable_web_page_preview": True,
            }
            if message_thread_id is not None:
                fallback_params["message_thread_id"] = message_thread_id
            if reply_markup is not None and idx == len(chunks) - 1:
                fallback_params["reply_markup"] = reply_markup
            telegram_request(token, "sendMessage", fallback_params)


def acquire_process_lock(lock_path: str):
    if fcntl is None:
        LOGGER.warning(
            "fcntl non disponibile: lock esclusivo non attivo su %s. "
            "Non avviare due istanze con lo stesso token.",
            lock_path,
        )
        return None
    ensure_parent_dir(lock_path)
    handle = open(lock_path, "a+", encoding="utf-8")
    try:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        handle.close()
        raise TelegramApiError(
            "Un'altra istanza del bot e' gia' in esecuzione (lock su "
            f"{lock_path}). Chiudi l'altra copia o imposta TELEGRAM_BOT_LOCK_PATH."
        ) from None
    try:
        os.chmod(lock_path, 0o600)
    except OSError:
        pass
    return handle


def increment_metric(state: dict[str, object], metric: str, amount: int = 1) -> None:
    metrics = state.setdefault("metrics", {})
    metrics[metric] = int(metrics.get(metric, 0)) + amount


def increment_error_metric(state: dict[str, object], error_type: str) -> None:
    metrics = state.setdefault("metrics", {})
    errors = metrics.setdefault("errors_by_type", {})
    errors[error_type] = int(errors.get(error_type, 0)) + 1


def format_status(state: dict[str, object], retry_queue_size: int) -> str:
    metrics = state.get("metrics", {})
    errors = metrics.get("errors_by_type", {})
    errors_text = html.escape(json.dumps(errors, ensure_ascii=False)) if errors else "nessuno"
    last_check_str = str(state.get("last_check") or "mai")
    last_error_str = str(state.get("last_error") or "nessuno")

    return (
        "📊 <b>Stato del Bot</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"⏱️ Ultimo check eBay: <code>{html.escape(last_check_str)}</code>\n"
        f"📦 Ordini analizzati: <code>{int(metrics.get('orders_read', 0))}</code>\n"
        f"📩 Notifiche inviate: <code>{int(metrics.get('notifications_sent', 0))}</code>\n"
        f"⏳ Coda retry: <code>{retry_queue_size}</code>\n"
        f"⚠️ Ultimo errore: <code>{html.escape(last_error_str)}</code>\n"
        f"📉 Errori per tipo: <code>{errors_text}</code>"
    )


def process_retry_queue(telegram_config: TelegramConfig, state: dict[str, object]) -> None:
    queue = load_retry_queue(telegram_config.retry_queue_path)
    if not queue:
        return
    remaining: list[dict[str, object]] = []
    for item in queue:
        try:
            send_message(telegram_config.token, int(item["chat_id"]), str(item["text"]))
            increment_metric(state, "notifications_sent")
        except TelegramApiError as exc:
            item["attempts"] = int(item.get("attempts", 0)) + 1
            if item["attempts"] < 5:
                remaining.append(item)
            state["last_error"] = str(exc)
            increment_error_metric(state, "telegram_send")
    save_retry_queue(telegram_config.retry_queue_path, remaining)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def order_sort_key(record: dict[str, str]) -> str:
    return record.get("creationDate", "")


def has_codice_fiscale(record: dict[str, str]) -> bool:
    return (record.get("taxIdentifierType") or "").upper() == "CODICE_FISCALE" and bool(
        record.get("taxpayerId")
    )


def format_auto_notification(record: dict[str, str]) -> str:
    prefix = "🚨 <b>NUOVO ORDINE EBAY RICEVUTO!</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
    return prefix + format_record(record)


def fetch_new_order_records(
    ebay_environment: str,
    state: dict[str, object],
    lookback_minutes: int = 180,
) -> list[dict[str, str]]:
    config = load_config(ebay_environment)
    last_check = state.get("last_check")
    if isinstance(last_check, str) and last_check:
        start = last_check
    else:
        start = (now_utc() - timedelta(minutes=lookback_minutes)).isoformat().replace("+00:00", "Z")
    end = now_utc().isoformat().replace("+00:00", "Z")

    records = request_with_backoff(
        lambda: fetch_records(
            config,
            FetchOptions(
                created_after=start,
                created_before=end,
                max_results=100,
                only_found=False,
            ),
        ),
        label="fetch_new_orders",
    )
    assert isinstance(records, list)

    notified_order_ids = set(state.get("notified_order_ids", []))
    notified_hashes = set(state.get("notified_hashes", []))
    new_records: list[dict[str, str]] = []
    for record in records:
        oid = record.get("orderId")
        if not oid or oid in notified_order_ids:
            continue
        if record_fingerprint(record) in notified_hashes:
            continue
        if has_codice_fiscale(record):
            new_records.append(record)
    new_records.sort(key=order_sort_key)
    return new_records


def update_state_with_records(
    state: dict[str, object],
    records: list[dict[str, str]],
    checked_at: Optional[str] = None,
    max_tracked_orders: int = 1000,
) -> dict[str, object]:
    existing_ids = list(state.get("notified_order_ids", []))
    id_set = set(existing_ids)
    existing_hashes = list(state.get("notified_hashes", []))
    hash_set = set(existing_hashes)
    for record in records:
        oid = record.get("orderId")
        fp = record_fingerprint(record)
        if oid and oid not in id_set:
            existing_ids.append(oid)
            id_set.add(oid)
        if fp and fp not in hash_set:
            existing_hashes.append(fp)
            hash_set.add(fp)
    state["notified_order_ids"] = existing_ids[-max_tracked_orders:]
    state["notified_hashes"] = existing_hashes[-max_tracked_orders:]
    state["last_check"] = checked_at or now_utc().isoformat().replace("+00:00", "Z")
    return state


def maybe_send_new_order_notifications(
    telegram_config: TelegramConfig,
    ebay_environment: str,
) -> None:
    if not telegram_config.notify_chat_ids:
        return
    state = load_state(telegram_config.state_path)
    process_retry_queue(telegram_config, state)
    save_state(telegram_config.state_path, state)

    records = fetch_new_order_records(ebay_environment, state)
    first_bootstrap = not state.get("last_check")
    if first_bootstrap:
        updated_state = update_state_with_records(state, records)
        save_state(telegram_config.state_path, updated_state)
        return

    failed_queue = load_retry_queue(telegram_config.retry_queue_path)
    for record in records:
        text = format_auto_notification(record)
        for chat_id in telegram_config.notify_chat_ids:
            try:
                send_message(telegram_config.token, chat_id, text)
                increment_metric(state, "notifications_sent")
            except TelegramApiError as exc:
                failed_queue.append({"chat_id": chat_id, "text": text, "attempts": 1})
                state["last_error"] = str(exc)
                increment_error_metric(state, "telegram_send")
    save_retry_queue(telegram_config.retry_queue_path, failed_queue)
    increment_metric(state, "orders_read", len(records))
    updated_state = update_state_with_records(state, records)
    save_state(telegram_config.state_path, updated_state)


def auto_notify_loop(telegram_config: TelegramConfig, ebay_environment: str) -> None:
    while not _shutdown.is_set():
        try:
            maybe_send_new_order_notifications(telegram_config, ebay_environment)
        except Exception as exc:  # pragma: no cover - loop resiliente
            LOGGER.exception("Errore auto notify: %s", exc)
        if _shutdown.wait(timeout=telegram_config.ebay_poll_interval_seconds):
            break


def process_message(
    text: str,
    chat_id: int,
    telegram_config: TelegramConfig,
    ebay_environment: str,
) -> list[str]:
    if not is_authorized(chat_id, telegram_config):
        return ["Chat non autorizzata per questo bot."]

    command, args = parse_command(text)
    if command in ("", "/start", "/help"):
        return [build_help_text()]

    if command == "/ping":
        return ["pong ✅"]

    if command == "/stato":
        state = load_state(telegram_config.state_path)
        retry_queue_size = len(load_retry_queue(telegram_config.retry_queue_path))
        return [format_status(state, retry_queue_size)]

    if command not in ("/ultimi", "/ordine", "/tutti"):
        return ["Comando non riconosciuto. Usa /help per vedere i comandi disponibili."]

    config = load_config(ebay_environment)
    options = options_for_command(command, args)
    records = request_with_backoff(
        lambda: fetch_records(config, options),
        label=f"fetch_records_{command}",
    )
    assert isinstance(records, list)
    return format_records(records, only_found=options.only_found)


def extract_message_context(update: dict) -> tuple[Optional[int], str, Optional[int]]:
    message = update.get("message") or update.get("edited_message") or {}
    chat = message.get("chat") or {}
    text = message.get("text") or ""
    thread_id = message.get("message_thread_id")
    if isinstance(thread_id, int):
        return chat.get("id"), text, thread_id
    return chat.get("id"), text, None


def extract_callback_context(
    update: dict,
) -> tuple[Optional[str], Optional[int], Optional[str], Optional[int]]:
    callback = update.get("callback_query") or {}
    callback_id = callback.get("id")
    data = callback.get("data")
    message = callback.get("message") or {}
    chat = message.get("chat") or {}
    thread_id = message.get("message_thread_id")
    normalized_thread = thread_id if isinstance(thread_id, int) else None
    if not isinstance(callback_id, str):
        return None, None, None, normalized_thread
    if not isinstance(data, str):
        return callback_id, chat.get("id"), None, normalized_thread
    return callback_id, chat.get("id"), data, normalized_thread


def request_shutdown(signum: int, frame: Optional[object]) -> None:
    LOGGER.info("Segnale %s ricevuto, arresto in corso...", signum)
    _shutdown.set()


def run_bot() -> int:
    configure_logging()
    lock_handle = None
    try:
        telegram_config = load_telegram_config()
        ebay_environment = os.getenv("EBAY_ENVIRONMENT", "production")
        lock_handle = acquire_process_lock(telegram_config.lock_path)
        ensure_long_polling(telegram_config.token)
    except (TelegramApiError, EbayApiError) as exc:
        LOGGER.error("Errore configurazione: %s", exc)
        print(f"Errore configurazione: {exc}", file=sys.stderr)
        if lock_handle is not None:
            lock_handle.close()
        return 1

    signal.signal(signal.SIGTERM, request_shutdown)

    notifier_thread = threading.Thread(
        target=auto_notify_loop,
        args=(telegram_config, ebay_environment),
        daemon=True,
    )
    notifier_thread.start()

    offset = 0
    updates_backoff_seconds = 1.0
    while not _shutdown.is_set():
        try:
            poll_timeout = telegram_config.poll_timeout_seconds
            if _shutdown.is_set():
                poll_timeout = min(poll_timeout, 2)
            updates = request_with_backoff(
                lambda: telegram_request(
                    telegram_config.token,
                    "getUpdates",
                    {
                        "offset": offset,
                        "timeout": poll_timeout,
                        "allowed_updates": ["message", "edited_message", "callback_query"],
                    },
                ),
                label="getUpdates",
            )
            assert isinstance(updates, list)
            updates_backoff_seconds = 1.0
            for update in updates:
                offset = max(offset, int(update["update_id"]) + 1)
                callback_id, callback_chat_id, callback_data, callback_thread_id = (
                    extract_callback_context(update)
                )
                if callback_id and callback_chat_id and callback_data:
                    callback_text = callback_command_from_data(callback_data)
                    if callback_text:
                        try:
                            replies = process_message(
                                text=callback_text,
                                chat_id=callback_chat_id,
                                telegram_config=telegram_config,
                                ebay_environment=ebay_environment,
                            )
                        except (TelegramApiError, EbayApiError, ValueError) as exc:
                            replies = [f"Errore: {html.escape(str(exc))}"]
                        for index, reply in enumerate(replies):
                            try:
                                send_message(
                                    telegram_config.token,
                                    callback_chat_id,
                                    reply,
                                    message_thread_id=callback_thread_id,
                                    reply_markup=(
                                        build_main_menu_markup()
                                        if index == len(replies) - 1
                                        else None
                                    ),
                                )
                            except TelegramApiError as exc:
                                LOGGER.error("Invio risposta callback fallito: %s", exc)
                        try:
                            telegram_request(
                                telegram_config.token,
                                "answerCallbackQuery",
                                {
                                    "callback_query_id": callback_id,
                                    "text": "Comando eseguito",
                                },
                            )
                        except TelegramApiError as exc:
                            LOGGER.warning("answerCallbackQuery fallita: %s", exc)
                    else:
                        try:
                            telegram_request(
                                telegram_config.token,
                                "answerCallbackQuery",
                                {
                                    "callback_query_id": callback_id,
                                    "text": "Azione non riconosciuta",
                                },
                            )
                        except TelegramApiError as exc:
                            LOGGER.warning("answerCallbackQuery fallita: %s", exc)
                    continue

                cid, msg_text, thread_id = extract_message_context(update)
                if not cid or not msg_text.strip():
                    continue
                command, _ = parse_command(msg_text)
                show_menu = is_authorized(cid, telegram_config) and should_attach_main_menu(command)
                try:
                    replies = process_message(
                        text=msg_text,
                        chat_id=cid,
                        telegram_config=telegram_config,
                        ebay_environment=ebay_environment,
                    )
                except (TelegramApiError, EbayApiError, ValueError) as exc:
                    replies = [f"Errore: {html.escape(str(exc))}"]
                for index, reply in enumerate(replies):
                    try:
                        send_message(
                            telegram_config.token,
                            cid,
                            reply,
                            message_thread_id=thread_id,
                            reply_markup=(
                                build_main_menu_markup()
                                if show_menu and index == len(replies) - 1
                                else None
                            ),
                        )
                    except TelegramApiError as exc:
                        LOGGER.error("Invio risposta fallito: %s", exc)
            if _shutdown.is_set():
                break
        except KeyboardInterrupt:
            _shutdown.set()
            break
        except Exception as exc:  # pragma: no cover - loop resiliente
            LOGGER.exception("Errore runtime bot: %s", exc)
            time.sleep(updates_backoff_seconds)
            updates_backoff_seconds = min(updates_backoff_seconds * 2, 30.0)
            if _shutdown.is_set():
                break

    if lock_handle is not None:
        try:
            if fcntl is not None:
                fcntl.flock(lock_handle.fileno(), fcntl.LOCK_UN)
        except OSError:
            pass
        lock_handle.close()
    return 0
