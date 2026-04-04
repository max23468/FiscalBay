#!/usr/bin/env python3
"""Bot Telegram per interrogare gli ordini eBay e leggere il codice fiscale."""

from __future__ import annotations

import hashlib
import html
import json
import logging
import os
import threading
import sys
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional

try:
    from .ebay_cf_tool import EbayApiError, FetchOptions, fetch_records, load_config
except ImportError:  # pragma: no cover - avvio come script diretto
    from ebay_cf_tool import EbayApiError, FetchOptions, fetch_records, load_config


TELEGRAM_API_BASE = "https://api.telegram.org"
DEFAULT_ALLOWED_CHAT_IDS = "TELEGRAM_ALLOWED_CHAT_IDS"
DEFAULT_NOTIFY_CHAT_IDS = "TELEGRAM_NOTIFY_CHAT_IDS"
DEFAULT_STATE_PATH = "data/notified_orders.json"
DEFAULT_RETRY_QUEUE_PATH = "data/failed_notifications.json"
LOGGER = logging.getLogger("ebaycf.telegram_bot")


@dataclass
class TelegramConfig:
    token: str
    allowed_chat_ids: Optional[set[int]]
    notify_chat_ids: set[int]
    poll_timeout_seconds: int = 30
    ebay_poll_interval_seconds: int = 120
    state_path: str = DEFAULT_STATE_PATH
    retry_queue_path: str = DEFAULT_RETRY_QUEUE_PATH


class TelegramApiError(RuntimeError):
    """Errore leggibile per Telegram Bot API."""


def configure_logging() -> None:
    if logging.getLogger().handlers:
        return
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)sZ | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )


def load_telegram_config() -> TelegramConfig:
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        raise TelegramApiError("Variabile ambiente mancante: TELEGRAM_BOT_TOKEN")
    raw_chat_ids = os.getenv(DEFAULT_ALLOWED_CHAT_IDS, "").strip()
    allowed_chat_ids = None
    if raw_chat_ids:
        allowed_chat_ids = {
            int(value.strip())
            for value in raw_chat_ids.split(",")
            if value.strip()
        }
    raw_notify_chat_ids = os.getenv(DEFAULT_NOTIFY_CHAT_IDS, raw_chat_ids).strip()
    notify_chat_ids = {
        int(value.strip())
        for value in raw_notify_chat_ids.split(",")
        if value.strip()
    }
    timeout = int(os.getenv("TELEGRAM_POLL_TIMEOUT", "30"))
    ebay_poll_interval = int(os.getenv("EBAY_ORDER_POLL_INTERVAL", "120"))
    return TelegramConfig(
        token=token,
        allowed_chat_ids=allowed_chat_ids,
        notify_chat_ids=notify_chat_ids,
        poll_timeout_seconds=max(1, timeout),
        ebay_poll_interval_seconds=max(30, ebay_poll_interval),
        state_path=os.getenv("EBAY_ORDER_STATE_PATH", DEFAULT_STATE_PATH),
        retry_queue_path=os.getenv("EBAY_NOTIFY_RETRY_PATH", DEFAULT_RETRY_QUEUE_PATH),
    )


def telegram_request(
    token: str,
    method: str,
    params: Optional[Dict[str, object]] = None,
) -> Dict:
    encoded_method = urllib.parse.quote(method, safe="")
    url = f"{TELEGRAM_API_BASE}/bot{token}/{encoded_method}"
    data = None
    headers = {"Accept": "application/json"}

    if params is not None:
        data = json.dumps(params).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url=url, data=data, method="POST" if data else "GET")
    for key, value in headers.items():
        request.add_header(key, value)

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = response.read().decode("utf-8")
    except Exception as exc:  # pragma: no cover - rete esterna
        raise TelegramApiError(f"Errore Telegram su {method}: {exc}") from exc

    parsed = json.loads(payload)
    if not parsed.get("ok"):
        raise TelegramApiError(f"Telegram API {method}: {parsed}")
    return parsed["result"]


def chunk_message(text: str, limit: int = 3500) -> List[str]:
    if len(text) <= limit:
        return [text]
    chunks: List[str] = []
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


def record_fingerprint(record: Dict[str, str]) -> str:
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


def format_record(record: Dict[str, str]) -> str:
    cf = record["taxpayerId"] or "non disponibile"
    tax_type = record["taxIdentifierType"] or "n/d"
    country = record["issuingCountry"] or "n/d"
    missing_fiscal = ""
    if not record.get("taxpayerId"):
        missing_fiscal = "\n⚠️ Dati fiscali non presenti nella risposta eBay per questo ordine."
    return (
        f"Ordine: <code>{html.escape(record['orderId'])}</code>\n"
        f"Data: <code>{html.escape(record['creationDate'])}</code>\n"
        f"Buyer: <code>{html.escape(record['buyerUsername'] or 'n/d')}</code>\n"
        f"Codice fiscale: <code>{html.escape(cf)}</code>\n"
        f"Tipo: <code>{html.escape(tax_type)}</code>\n"
        f"Paese: <code>{html.escape(country)}</code>{missing_fiscal}"
    )


def format_records(records: Iterable[Dict[str, str]], only_found: bool, page_size: int = 5) -> List[str]:
    rows = list(records)
    if not rows:
        if only_found:
            return ["Nessun ordine con codice fiscale restituito da eBay nella selezione richiesta."]
        return ["Nessun ordine trovato nella selezione richiesta."]
    pages: List[str] = []
    for start in range(0, len(rows), page_size):
        page_rows = rows[start:start + page_size]
        page_no = (start // page_size) + 1
        total_pages = (len(rows) + page_size - 1) // page_size
        header = f"📦 Ordini elaborati: <b>{len(rows)}</b> • Pagina <b>{page_no}/{total_pages}</b>"
        body = "\n\n".join(f"🔹 {format_record(row)}" for row in page_rows)
        pages.append(header + "\n\n" + body)
    return pages


def parse_command(text: str) -> tuple[str, List[str]]:
    parts = text.strip().split()
    if not parts:
        return "", []
    command = parts[0].split("@", 1)[0].lower()
    return command, parts[1:]


def build_help_text() -> str:
    return (
        "Comandi disponibili:\n"
        "/ping - health check rapido\n"
        "/stato - stato monitor ordini/notifiche\n"
        "/ultimi [giorni] [max] - legge gli ordini recenti e restituisce i CF trovati\n"
        "/ordine <order_id> - legge un ordine specifico\n"
        "/tutti [giorni] [max] - mostra tutti gli ordini anche senza CF\n"
        "/help - mostra questo aiuto\n\n"
        "Esempi:\n"
        "<code>/ultimi 7 20</code>\n"
        "<code>/ordine 12-34567-89012</code>"
    )


def options_for_command(command: str, args: List[str]) -> FetchOptions:
    if command == "/ordine":
        if not args:
            raise TelegramApiError("Uso corretto: /ordine <order_id>")
        return FetchOptions(order_ids=[args[0]], only_found=False, max_results=1)

    days = int(args[0]) if len(args) >= 1 else 7
    max_results = int(args[1]) if len(args) >= 2 else 20
    only_found = command != "/tutti"
    return FetchOptions(days=days, max_results=max_results, only_found=only_found)


def is_authorized(chat_id: int, config: TelegramConfig) -> bool:
    if config.allowed_chat_ids is None:
        return True
    return chat_id in config.allowed_chat_ids


def send_message(token: str, chat_id: int, text: str) -> None:
    for chunk in chunk_message(text):
            if "HTTP 400" in str(exc):
                fallback_params = {
                    "chat_id": chat_id,
                    "text": chunk,
                    "disable_web_page_preview": True,
                }
                request_with_backoff(
                    lambda: telegram_request(token, "sendMessage", fallback_params),
                    label="sendMessage-fallback",
                )
                continue
            request_with_backoff(
                lambda: telegram_request(token, "sendMessage", params),
                label="sendMessage-retry",
            )
            continue
        return {
            "notified_order_ids": [],
            "notified_hashes": [],
            "last_check": None,
            "last_error": None,
            "metrics": {
                "orders_read": 0,
                "notifications_sent": 0,
                "errors_by_type": {},
            },
        }
        loaded = json.load(handle)
    loaded.setdefault("notified_order_ids", [])
    loaded.setdefault("notified_hashes", [])
    loaded.setdefault("last_check", None)
    loaded.setdefault("last_error", None)
    loaded.setdefault(
        "metrics",
        {"orders_read": 0, "notifications_sent": 0, "errors_by_type": {}},
    )
    loaded["metrics"].setdefault("orders_read", 0)
    loaded["metrics"].setdefault("notifications_sent", 0)
    loaded["metrics"].setdefault("errors_by_type", {})
    return loaded


def load_retry_queue(path: str) -> List[Dict[str, object]]:
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def save_retry_queue(path: str, queue: List[Dict[str, object]]) -> None:
    ensure_parent_dir(path)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(queue, handle, indent=2, ensure_ascii=False)


def increment_metric(state: Dict[str, object], metric: str, amount: int = 1) -> None:
    metrics = state.setdefault("metrics", {})
    metrics[metric] = int(metrics.get(metric, 0)) + amount


def increment_error_metric(state: Dict[str, object], error_type: str) -> None:
    metrics = state.setdefault("metrics", {})
    errors = metrics.setdefault("errors_by_type", {})
    errors[error_type] = int(errors.get(error_type, 0)) + 1


def format_status(state: Dict[str, object], retry_queue_size: int) -> str:
    metrics = state.get("metrics", {})
    errors = metrics.get("errors_by_type", {})
    return (
        "📊 Stato bot\n"
        f"Ultimo check eBay: <code>{html.escape(str(state.get('last_check') or 'mai'))}</code>\n"
        f"Ordini analizzati: <b>{int(metrics.get('orders_read', 0))}</b>\n"
        f"Notifiche inviate: <b>{int(metrics.get('notifications_sent', 0))}</b>\n"
        f"Coda retry notifiche: <b>{retry_queue_size}</b>\n"
        f"Ultimo errore: <code>{html.escape(str(state.get('last_error') or 'nessuno'))}</code>\n"
        f"Errori per tipo: <code>{html.escape(json.dumps(errors, ensure_ascii=False))}</code>"
    )


    records = request_with_backoff(
        lambda: fetch_records(
            config,
            FetchOptions(
                created_after=start,
                created_before=end,
                max_results=100,
                only_found=False,
            ),
        label="fetch_records",
    notified_hashes = set(state.get("notified_hashes", []))
        record
        for record in records
        if record.get("orderId")
        and record["orderId"] not in notified_order_ids
        and record_fingerprint(record) not in notified_hashes
    existing_hashes = list(state.get("notified_hashes", []))
    existing_hashes_set = set(existing_hashes)
        fingerprint = record_fingerprint(record)
        if fingerprint not in existing_hashes_set:
            existing_hashes.append(fingerprint)
            existing_hashes_set.add(fingerprint)
    state["notified_hashes"] = existing_hashes[-max_tracked_orders:]
def process_retry_queue(
    telegram_config: TelegramConfig,
    state: Dict[str, object],
) -> None:
    queue = load_retry_queue(telegram_config.retry_queue_path)
    if not queue:
        return
    remaining: List[Dict[str, object]] = []
    for item in queue:
        try:
            send_message(
                telegram_config.token,
                int(item["chat_id"]),
                str(item["text"]),
            )
            increment_metric(state, "notifications_sent")
        except TelegramApiError as exc:
            item["attempts"] = int(item.get("attempts", 0)) + 1
            if item["attempts"] < 5:
                remaining.append(item)
            state["last_error"] = str(exc)
            increment_error_metric(state, "telegram_send")
    save_retry_queue(telegram_config.retry_queue_path, remaining)


    process_retry_queue(telegram_config, state)
    increment_metric(state, "orders_read", len(records))
    failed_queue = load_retry_queue(telegram_config.retry_queue_path)
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
    if command == "/ping":
        return ["pong ✅"]
    if command == "/stato":
        state = load_state(telegram_config.state_path)
        retry_queue_size = len(load_retry_queue(telegram_config.retry_queue_path))
        return [format_status(state, retry_queue_size)]
    records = request_with_backoff(
        lambda: fetch_records(config, options),
        label=f"fetch_records_{command}",
    )
    return format_records(records, only_found=options.only_found)
        configure_logging()
    updates_backoff_seconds = 1
            updates = request_with_backoff(
                lambda: telegram_request(
                    telegram_config.token,
                    "getUpdates",
                    {
                        "offset": offset,
                        "timeout": telegram_config.poll_timeout_seconds,
                        "allowed_updates": ["message", "edited_message"],
                    },
                ),
                label="getUpdates",
            updates_backoff_seconds = 1
            LOGGER.error("Errore runtime bot: %s", exc)
            time.sleep(updates_backoff_seconds)
            updates_backoff_seconds = min(updates_backoff_seconds * 2, 30)
    return datetime.now(timezone.utc)


def order_sort_key(record: Dict[str, str]) -> str:
    return record.get("creationDate", "")


def has_codice_fiscale(record: Dict[str, str]) -> bool:
    return (
        (record.get("taxIdentifierType") or "").upper() == "CODICE_FISCALE"
        and bool(record.get("taxpayerId"))
    )


def format_auto_notification(record: Dict[str, str]) -> str:
    prefix = "Nuovo ordine eBay ricevuto\n\n"
    return prefix + format_record(record)


def fetch_new_order_records(
    ebay_environment: str,
    state: Dict[str, object],
    lookback_minutes: int = 180,
) -> List[Dict[str, str]]:
    config = load_config(ebay_environment)
    last_check = state.get("last_check")
    if isinstance(last_check, str) and last_check:
        start = last_check
    else:
        start = (now_utc() - timedelta(minutes=lookback_minutes)).isoformat().replace(
            "+00:00", "Z"
        )
    end = now_utc().isoformat().replace("+00:00", "Z")
    records = fetch_records(
        config,
        FetchOptions(
            created_after=start,
            created_before=end,
            max_results=100,
            only_found=False,
        ),
    )
    notified_order_ids = set(state.get("notified_order_ids", []))
    new_records = [
        record for record in records if record.get("orderId") and record["orderId"] not in notified_order_ids
    ]
    new_records = [record for record in new_records if has_codice_fiscale(record)]
    new_records.sort(key=order_sort_key)
    return new_records


def update_state_with_records(
    state: Dict[str, object],
    records: List[Dict[str, str]],
    checked_at: Optional[str] = None,
    max_tracked_orders: int = 1000,
) -> Dict[str, object]:
    existing = list(state.get("notified_order_ids", []))
    existing_set = set(existing)
    for record in records:
        order_id = record.get("orderId")
        if order_id and order_id not in existing_set:
            existing.append(order_id)
            existing_set.add(order_id)
    state["notified_order_ids"] = existing[-max_tracked_orders:]
    state["last_check"] = checked_at or now_utc().isoformat().replace("+00:00", "Z")
    return state


def maybe_send_new_order_notifications(
    telegram_config: TelegramConfig,
    ebay_environment: str,
) -> None:
    if not telegram_config.notify_chat_ids:
        return
    state = load_state(telegram_config.state_path)
    records = fetch_new_order_records(ebay_environment, state)
    first_bootstrap = not state.get("last_check")
    if first_bootstrap:
        updated_state = update_state_with_records(state, records)
        save_state(telegram_config.state_path, updated_state)
        return
    for record in records:
        send_to_all_targets(
            telegram_config.token,
            telegram_config.notify_chat_ids,
            format_auto_notification(record),
        )
    updated_state = update_state_with_records(state, records)
    save_state(telegram_config.state_path, updated_state)


def auto_notify_loop(telegram_config: TelegramConfig, ebay_environment: str) -> None:
    while True:
        try:
            maybe_send_new_order_notifications(telegram_config, ebay_environment)
        except Exception as exc:  # pragma: no cover - loop resiliente
            print(f"Errore auto notify: {exc}", file=sys.stderr)
        time.sleep(telegram_config.ebay_poll_interval_seconds)


def process_message(
    text: str,
    chat_id: int,
    telegram_config: TelegramConfig,
    ebay_environment: str,
) -> List[str]:
    if not is_authorized(chat_id, telegram_config):
        return ["Chat non autorizzata per questo bot."]

    command, args = parse_command(text)
    if command in ("", "/start", "/help"):
        return [build_help_text()]

    if command not in ("/ultimi", "/ordine", "/tutti"):
        return ["Comando non riconosciuto. Usa /help."]

    config = load_config(ebay_environment)
    options = options_for_command(command, args)
    records = fetch_records(config, options)
    return [format_records(records, only_found=options.only_found)]


def extract_text(update: Dict) -> tuple[Optional[int], str]:
    message = update.get("message") or update.get("edited_message") or {}
    chat = message.get("chat") or {}
    text = message.get("text") or ""
    return chat.get("id"), text


def run_bot() -> int:
    try:
        telegram_config = load_telegram_config()
        ebay_environment = os.getenv("EBAY_ENVIRONMENT", "production")
    except (TelegramApiError, EbayApiError) as exc:
        print(f"Errore configurazione: {exc}", file=sys.stderr)
        return 1

    notifier_thread = threading.Thread(
        target=auto_notify_loop,
        args=(telegram_config, ebay_environment),
        daemon=True,
    )
    notifier_thread.start()

    offset = 0
    while True:
        try:
            updates = telegram_request(
                telegram_config.token,
                "getUpdates",
                {
                    "offset": offset,
                    "timeout": telegram_config.poll_timeout_seconds,
                    "allowed_updates": ["message", "edited_message"],
                },
            )
            for update in updates:
                offset = max(offset, int(update["update_id"]) + 1)
                chat_id, text = extract_text(update)
                if not chat_id or not text.strip():
                    continue
                try:
                    replies = process_message(
                        text=text,
                        chat_id=chat_id,
                        telegram_config=telegram_config,
                        ebay_environment=ebay_environment,
                    )
                except (TelegramApiError, EbayApiError, ValueError) as exc:
                    replies = [f"Errore: {html.escape(str(exc))}"]
                for reply in replies:
                    send_message(telegram_config.token, chat_id, reply)
        except KeyboardInterrupt:
            return 0
        except Exception as exc:  # pragma: no cover - loop resiliente
            print(f"Errore runtime bot: {exc}", file=sys.stderr)
            time.sleep(3)


if __name__ == "__main__":
    raise SystemExit(run_bot())
