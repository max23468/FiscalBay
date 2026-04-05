#!/usr/bin/env python3
"""Bot Telegram per interrogare gli ordini eBay e leggere il codice fiscale."""

from __future__ import annotations

import hashlib
import html
import json
import logging
import os
import random
import signal
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows
    fcntl = None

try:
    from .ebay_cf_tool import EbayApiError, FetchOptions, fetch_records, load_config
except ImportError:  # pragma: no cover - avvio come script diretto
    from ebay_cf_tool import EbayApiError, FetchOptions, fetch_records, load_config

LOGGER = logging.getLogger("ebaycf.telegram_bot")

TELEGRAM_API_BASE = "https://api.telegram.org"
DEFAULT_ALLOWED_CHAT_IDS = "TELEGRAM_ALLOWED_CHAT_IDS"
DEFAULT_NOTIFY_CHAT_IDS = "TELEGRAM_NOTIFY_CHAT_IDS"
DEFAULT_STATE_PATH = "data/state.db"
DEFAULT_RETRY_QUEUE_PATH = "data/state.db"
DEFAULT_LOCK_PATH = "data/telegram_bot.lock"

TELEGRAM_CMD_MAX_DAYS = 365
TELEGRAM_CMD_MIN_DAYS = 1
TELEGRAM_CMD_MAX_RESULTS = 500
TELEGRAM_CMD_MIN_RESULTS = 1

DEFAULT_TELEGRAM_RETRIES = 5
DEFAULT_TELEGRAM_BASE_DELAY = 0.5

CALLBACK_ULTIMI = "menu:ultimi"
CALLBACK_TUTTI = "menu:tutti"
CALLBACK_STATO = "menu:stato"
CALLBACK_HELP = "menu:help"

_shutdown = threading.Event()


@dataclass
class TelegramConfig:
    token: str
    allowed_chat_ids: Optional[set[int]]
    notify_chat_ids: set[int]
    poll_timeout_seconds: int = 30
    ebay_poll_interval_seconds: int = 120
    state_path: str = DEFAULT_STATE_PATH
    retry_queue_path: str = DEFAULT_RETRY_QUEUE_PATH
    lock_path: str = DEFAULT_LOCK_PATH


class TelegramApiError(RuntimeError):
    """Errore leggibile per Telegram Bot API."""

    def __init__(self, message: str, *, status_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.status_code = status_code


def _telegram_retry_settings() -> tuple[int, float]:
    retries = int(os.getenv("TELEGRAM_HTTP_MAX_RETRIES", str(DEFAULT_TELEGRAM_RETRIES)))
    base = float(os.getenv("TELEGRAM_HTTP_RETRY_BASE_DELAY", str(DEFAULT_TELEGRAM_BASE_DELAY)))
    return max(1, retries), max(0.05, base)


def _telegram_error_retryable(exc: TelegramApiError) -> bool:
    code = exc.status_code
    if code is None:
        return True
    if code == 429:
        return True
    return 500 <= code <= 599


def configure_logging() -> None:
    if logging.getLogger().handlers:
        return
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(
        level=level,
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
        lock_path=os.getenv("TELEGRAM_BOT_LOCK_PATH", DEFAULT_LOCK_PATH),
    )


def _telegram_request_once(
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
    except urllib.error.HTTPError as exc:  # pragma: no cover - rete esterna
        body = exc.read().decode("utf-8", errors="replace")
        try:
            error_payload = json.loads(body)
            description = error_payload.get("description") or body
        except json.JSONDecodeError:
            description = body or str(exc)
        raise TelegramApiError(
            f"Errore Telegram su {method}: HTTP {exc.code}: {description}",
            status_code=exc.code,
        ) from exc
    except Exception as exc:  # pragma: no cover - rete esterna
        raise TelegramApiError(f"Errore Telegram su {method}: {exc}") from exc

    parsed = json.loads(payload)
    if not parsed.get("ok"):
        raise TelegramApiError(f"Telegram API {method}: {parsed}")
    return parsed["result"]


def telegram_request(
    token: str,
    method: str,
    params: Optional[Dict[str, object]] = None,
) -> Dict:
    max_retries, base_delay = _telegram_retry_settings()
    last: Optional[BaseException] = None
    for attempt in range(max_retries):
        try:
            return _telegram_request_once(token, method, params)
        except TelegramApiError as exc:
            last = exc
            if not _telegram_error_retryable(exc) or attempt == max_retries - 1:
                raise
            delay = base_delay * (2**attempt) + random.uniform(0, 0.25)
            LOGGER.warning(
                "Richiesta Telegram fallita (tentativo %s/%s), riprovo tra %.2fs: %s",
                attempt + 1,
                max_retries,
                delay,
                exc,
            )
            time.sleep(delay)
    assert last is not None
    raise last


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
    cf = record.get("taxpayerId") or "non disponibile"
    tax_type = record.get("taxIdentifierType") or "n/d"
    country = record.get("issuingCountry") or "n/d"
    order_id = html.escape(record.get("orderId", ""))
    missing_fiscal = ""
    if not record.get("taxpayerId"):
        missing_fiscal = "\n⚠️ <i>Dati fiscali non presenti nella risposta eBay per questo ordine.</i>"

    ebay_url = f"https://www.ebay.it/sh/ord/details?orderid={urllib.parse.quote(record.get('orderId', ''))}"

    items = html.escape(record.get("items", "N/D"))
    total = html.escape(record.get("total", "N/D"))
    shipping = html.escape(record.get("shippingAddress", "N/D"))
    buyer = html.escape(record.get("buyerUsername", "") or "n/d")
    created_at = html.escape(record.get("creationDate", ""))

    return (
        f"🛒 <b>Ordine</b> • <a href=\"{ebay_url}\"><code>{order_id}</code></a>\n"
        f"┌ 📅 <b>Data</b>: <code>{created_at}</code>\n"
        f"├ 👤 <b>Acquirente</b>: <code>{buyer}</code>\n"
        f"├ 📦 <b>Articoli</b>: <i>{items}</i>\n"
        f"├ 💰 <b>Totale</b>: <code>{total}</code>\n"
        f"├ 📍 <b>Spedizione</b>: <code>{shipping}</code>\n"
        f"└ 💳 <b>CF</b>: <code>{html.escape(cf)}</code> <i>({html.escape(tax_type)})</i> • <code>{html.escape(country)}</code>"
        f"{missing_fiscal}"
    )


def format_records(records: Iterable[Dict[str, str]], only_found: bool, page_size: int = 5) -> List[str]:
    rows = list(records)
    if not rows:
        if only_found:
            return ["🔎 Nessun ordine con codice fiscale restituito da eBay nella selezione richiesta."]
        return ["🔎 Nessun ordine trovato nella selezione richiesta."]
    pages: List[str] = []
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


def parse_command(text: str) -> tuple[str, List[str]]:
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


def build_main_menu_markup() -> Dict[str, object]:
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


def options_for_command(command: str, args: List[str]) -> FetchOptions:
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
            f"Giorni fuori intervallo: usa un valore tra {TELEGRAM_CMD_MIN_DAYS} e {TELEGRAM_CMD_MAX_DAYS}."
        )
    if not TELEGRAM_CMD_MIN_RESULTS <= max_results <= TELEGRAM_CMD_MAX_RESULTS:
        raise TelegramApiError(
            f"Max ordini fuori intervallo: usa un valore tra {TELEGRAM_CMD_MIN_RESULTS} e {TELEGRAM_CMD_MAX_RESULTS}."
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
    reply_markup: Optional[Dict[str, object]] = None,
) -> None:
    chunks = chunk_message(text)
    for idx, chunk in enumerate(chunks):
        params: Dict[str, object] = {
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
            fallback_params: Dict[str, object] = {
                "chat_id": chat_id,
                "text": chunk,
                "disable_web_page_preview": True,
            }
            if message_thread_id is not None:
                fallback_params["message_thread_id"] = message_thread_id
            if reply_markup is not None and idx == len(chunks) - 1:
                fallback_params["reply_markup"] = reply_markup
            telegram_request(token, "sendMessage", fallback_params)


def send_to_all_targets(
    token: str,
    chat_ids: Iterable[int],
    text: str,
    message_thread_id: Optional[int] = None,
) -> None:
    for chat_id in chat_ids:
        send_message(token, chat_id, text, message_thread_id=message_thread_id)


def ensure_long_polling(token: str) -> None:
    telegram_request(token, "deleteWebhook", {"drop_pending_updates": False})


def ensure_parent_dir(path: str) -> None:
    directory = os.path.dirname(path)
    if directory:
        os.makedirs(directory, exist_ok=True)


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
            "Un'altra istanza del bot è già in esecuzione (lock su "
            f"{lock_path}). Chiudi l'altra copia o imposta TELEGRAM_BOT_LOCK_PATH."
        ) from None
    try:
        os.chmod(lock_path, 0o600)
    except OSError:
        pass
    return handle


def init_db(path: str) -> None:
    ensure_parent_dir(path)
    with sqlite3.connect(path, timeout=10.0) as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS notified_orders (order_id TEXT, hash TEXT)")
        conn.execute("CREATE TABLE IF NOT EXISTS retry_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER, text TEXT, attempts INTEGER)")
        conn.execute("CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT)")


def load_state(path: str) -> Dict[str, object]:
    init_db(path)
    state = {
        "notified_order_ids": [],
        "notified_hashes": [],
        "last_check": None,
        "last_error": None,
        "metrics": {"orders_read": 0, "notifications_sent": 0, "errors_by_type": {}},
    }
    with sqlite3.connect(path, timeout=10.0) as conn:
        for row in conn.execute("SELECT order_id, hash FROM notified_orders"):
            if row[0]: state["notified_order_ids"].append(row[0])
            if row[1]: state["notified_hashes"].append(row[1])
        for row in conn.execute("SELECT key, value FROM kv_store"):
            if row[0] == "last_check": state["last_check"] = row[1]
            elif row[0] == "last_error": state["last_error"] = row[1]
            elif row[0] == "metrics": state["metrics"] = json.loads(row[1])
    return state


def save_state(path: str, state: Dict[str, object]) -> None:
    init_db(path)
    with sqlite3.connect(path, timeout=10.0) as conn:
        conn.execute("DELETE FROM notified_orders")
        ids = state.get("notified_order_ids", [])
        hashes = state.get("notified_hashes", [])
        rows = []
        max_len = max(len(ids), len(hashes))
        for i in range(max_len):
            rows.append((
                ids[i] if i < len(ids) else None,
                hashes[i] if i < len(hashes) else None,
            ))
        conn.executemany("INSERT INTO notified_orders (order_id, hash) VALUES (?, ?)", rows)
        
        metrics_json = json.dumps(state.get("metrics", {}))
        conn.execute("INSERT OR REPLACE INTO kv_store (key, value) VALUES ('metrics', ?)", (metrics_json,))
        if state.get("last_check"):
            conn.execute("INSERT OR REPLACE INTO kv_store (key, value) VALUES ('last_check', ?)", (state["last_check"],))
        if state.get("last_error"):
            conn.execute("INSERT OR REPLACE INTO kv_store (key, value) VALUES ('last_error', ?)", (state["last_error"],))


def load_retry_queue(path: str) -> List[Dict[str, object]]:
    init_db(path)
    queue = []
    with sqlite3.connect(path, timeout=10.0) as conn:
        for row in conn.execute("SELECT chat_id, text, attempts FROM retry_queue ORDER BY id"):
            queue.append({"chat_id": row[0], "text": row[1], "attempts": row[2]})
    return queue


def save_retry_queue(path: str, queue: List[Dict[str, object]]) -> None:
    init_db(path)
    with sqlite3.connect(path, timeout=10.0) as conn:
        conn.execute("DELETE FROM retry_queue")
        rows = [(item["chat_id"], item["text"], item.get("attempts", 0)) for item in queue]
        conn.executemany("INSERT INTO retry_queue (chat_id, text, attempts) VALUES (?, ?, ?)", rows)


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
    errors_text = (
        html.escape(json.dumps(errors, ensure_ascii=False))
        if errors
        else "nessuno"
    )
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


def process_retry_queue(telegram_config: TelegramConfig, state: Dict[str, object]) -> None:
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


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def order_sort_key(record: Dict[str, str]) -> str:
    return record.get("creationDate", "")


def has_codice_fiscale(record: Dict[str, str]) -> bool:
    return (
        (record.get("taxIdentifierType") or "").upper() == "CODICE_FISCALE"
        and bool(record.get("taxpayerId"))
    )


def format_auto_notification(record: Dict[str, str]) -> str:
    prefix = "🚨 <b>NUOVO ORDINE EBAY RICEVUTO!</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
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
    new_records: List[Dict[str, str]] = []
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
    state: Dict[str, object],
    records: List[Dict[str, str]],
    checked_at: Optional[str] = None,
    max_tracked_orders: int = 1000,
) -> Dict[str, object]:
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
) -> List[str]:
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


def extract_message_context(update: Dict) -> tuple[Optional[int], str, Optional[int]]:
    """Restituisce (chat_id, testo, message_thread_id per forum / topic)."""
    message = update.get("message") or update.get("edited_message") or {}
    chat = message.get("chat") or {}
    text = message.get("text") or ""
    thread_id = message.get("message_thread_id")
    if isinstance(thread_id, int):
        return chat.get("id"), text, thread_id
    return chat.get("id"), text, None


def extract_callback_context(
    update: Dict,
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


def _request_shutdown(signum: int, frame: Optional[object]) -> None:
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

    signal.signal(signal.SIGTERM, _request_shutdown)

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


if __name__ == "__main__":
    raise SystemExit(run_bot())
