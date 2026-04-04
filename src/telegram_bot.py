#!/usr/bin/env python3
"""Bot Telegram per interrogare gli ordini eBay e leggere il codice fiscale."""

from __future__ import annotations

import html
import json
import os
import threading
import sys
import time
import urllib.error
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


@dataclass
class TelegramConfig:
    token: str
    allowed_chat_ids: Optional[set[int]]
    notify_chat_ids: set[int]
    poll_timeout_seconds: int = 30
    ebay_poll_interval_seconds: int = 120
    state_path: str = DEFAULT_STATE_PATH


@dataclass
class RuntimeStatus:
    last_auto_notify_ok: Optional[str] = None
    last_auto_notify_error: Optional[str] = None
    last_runtime_error: Optional[str] = None


class TelegramApiError(RuntimeError):
    """Errore leggibile per Telegram Bot API."""


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
    except urllib.error.HTTPError as exc:  # pragma: no cover - rete esterna
        body = exc.read().decode("utf-8", errors="replace")
        try:
            error_payload = json.loads(body)
            description = error_payload.get("description") or body
        except json.JSONDecodeError:
            description = body or str(exc)
        raise TelegramApiError(
            f"Errore Telegram su {method}: HTTP {exc.code}: {description}"
        ) from exc
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


def format_record(record: Dict[str, str]) -> str:
    cf = record["taxpayerId"] or "non disponibile"
    tax_type = record["taxIdentifierType"] or "n/d"
    country = record["issuingCountry"] or "n/d"
    return (
        f"Ordine: <code>{html.escape(record['orderId'])}</code>\n"
        f"Data: <code>{html.escape(record['creationDate'])}</code>\n"
        f"Buyer: <code>{html.escape(record['buyerUsername'] or 'n/d')}</code>\n"
        f"Codice fiscale: <code>{html.escape(cf)}</code>\n"
        f"Tipo: <code>{html.escape(tax_type)}</code>\n"
        f"Paese: <code>{html.escape(country)}</code>"
    )


def format_records(records: Iterable[Dict[str, str]], only_found: bool) -> str:
    rows = list(records)
    if not rows:
        if only_found:
            return "Nessun ordine con codice fiscale restituito da eBay nella selezione richiesta."
        return "Nessun ordine trovato nella selezione richiesta."
    header = f"Ordini elaborati: <b>{len(rows)}</b>"
    return header + "\n\n" + "\n\n".join(format_record(row) for row in rows)


def parse_command(text: str) -> tuple[str, List[str]]:
    parts = text.strip().split()
    if not parts:
        return "", []
    command = parts[0].split("@", 1)[0].lower()
    return command, parts[1:]


def build_help_text() -> str:
    return (
        "Comandi disponibili:\n"
        "/ultimi [giorni] [max] - legge gli ordini recenti e restituisce i CF trovati\n"
        "/ordine <order_id> - legge un ordine specifico\n"
        "/tutti [giorni] [max] - mostra tutti gli ordini anche senza CF\n"
        "/stato - mostra stato runtime bot/notifiche\n"
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
        params = {
            "chat_id": chat_id,
            "text": chunk,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
        try:
            telegram_request(token, "sendMessage", params)
        except TelegramApiError as exc:
            if "HTTP 400" not in str(exc):
                raise
            fallback_params = {
                "chat_id": chat_id,
                "text": chunk,
                "disable_web_page_preview": True,
            }
            telegram_request(token, "sendMessage", fallback_params)


def send_to_all_targets(token: str, chat_ids: Iterable[int], text: str) -> None:
    for chat_id in chat_ids:
        send_message(token, chat_id, text)


def ensure_parent_dir(path: str) -> None:
    directory = os.path.dirname(path)
    if directory:
        os.makedirs(directory, exist_ok=True)


def load_state(path: str) -> Dict[str, object]:
    if not os.path.exists(path):
        return {"notified_order_ids": [], "last_check": None}
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def save_state(path: str, state: Dict[str, object]) -> None:
    ensure_parent_dir(path)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(state, handle, indent=2, ensure_ascii=False)


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
    prefix = "Nuovo ordine eBay ricevuto\n\n"
    return prefix + format_record(record)


def format_status_message(
    telegram_config: TelegramConfig,
    ebay_environment: str,
    runtime_status: RuntimeStatus,
) -> str:
    state = load_state(telegram_config.state_path)
    notified_count = len(state.get("notified_order_ids", []))
    last_check = state.get("last_check") or "n/d"
    last_notify_ok = runtime_status.last_auto_notify_ok or "n/d"
    last_notify_error = runtime_status.last_auto_notify_error or "n/d"
    last_runtime_error = runtime_status.last_runtime_error or "n/d"
    return (
        "<b>Stato bot</b>\n"
        f"Ambiente eBay: <code>{html.escape(ebay_environment)}</code>\n"
        f"Poll Telegram (s): <code>{telegram_config.poll_timeout_seconds}</code>\n"
        f"Poll eBay (s): <code>{telegram_config.ebay_poll_interval_seconds}</code>\n"
        f"Notify target: <code>{len(telegram_config.notify_chat_ids)}</code>\n"
        f"Ordini notificati salvati: <code>{notified_count}</code>\n"
        f"Ultimo check stato locale: <code>{html.escape(str(last_check))}</code>\n"
        f"Ultima auto-notify OK: <code>{html.escape(last_notify_ok)}</code>\n"
        f"Ultimo errore auto-notify: <code>{html.escape(last_notify_error)}</code>\n"
        f"Ultimo errore runtime bot: <code>{html.escape(last_runtime_error)}</code>"
    )


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


def auto_notify_loop(
    telegram_config: TelegramConfig,
    ebay_environment: str,
    runtime_status: RuntimeStatus,
) -> None:
    while True:
        try:
            maybe_send_new_order_notifications(telegram_config, ebay_environment)
            runtime_status.last_auto_notify_ok = now_utc().isoformat().replace("+00:00", "Z")
            runtime_status.last_auto_notify_error = None
        except Exception as exc:  # pragma: no cover - loop resiliente
            runtime_status.last_auto_notify_error = str(exc)
            print(f"Errore auto notify: {exc}", file=sys.stderr)
        time.sleep(telegram_config.ebay_poll_interval_seconds)


def process_message(
    text: str,
    chat_id: int,
    telegram_config: TelegramConfig,
    ebay_environment: str,
    runtime_status: Optional[RuntimeStatus] = None,
) -> List[str]:
    if not is_authorized(chat_id, telegram_config):
        return ["Chat non autorizzata per questo bot."]

    command, args = parse_command(text)
    if command in ("", "/start", "/help"):
        return [build_help_text()]
    if command == "/stato":
        return [
            format_status_message(
                telegram_config=telegram_config,
                ebay_environment=ebay_environment,
                runtime_status=runtime_status or RuntimeStatus(),
            )
        ]

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

    runtime_status = RuntimeStatus()
    notifier_thread = threading.Thread(
        target=auto_notify_loop,
        args=(telegram_config, ebay_environment, runtime_status),
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
                        runtime_status=runtime_status,
                    )
                except (TelegramApiError, EbayApiError, ValueError) as exc:
                    replies = [f"Errore: {html.escape(str(exc))}"]
                for reply in replies:
                    send_message(telegram_config.token, chat_id, reply)
        except KeyboardInterrupt:
            return 0
        except Exception as exc:  # pragma: no cover - loop resiliente
            runtime_status.last_runtime_error = str(exc)
            print(f"Errore runtime bot: {exc}", file=sys.stderr)
            time.sleep(3)


if __name__ == "__main__":
    raise SystemExit(run_bot())
