"""Verification and local processing for eBay marketplace account deletion."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import threading
import time
import urllib.parse
import urllib.request
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import cast

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec

from .clients.ebay import JsonObject, request_json
from .errors import ConfigurationError
from .storage.connection import _connect, init_db

ACCOUNT_DELETION_PATH = "/ebay/account-deletion"
APPLICATION_SCOPE = "https://api.ebay.com/oauth/api_scope"
PUBLIC_KEY_CACHE_SECONDS = 3600
PUBLIC_KEY_LOOKUP_LIMIT = 20
PUBLIC_KEY_LOOKUP_WINDOW_SECONDS = 60
PROCESSING_LEASE_SECONDS = 60
PUBLIC_KEY_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
VERIFICATION_TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{32,80}$")

_cache_lock = threading.Lock()
_application_token: tuple[str, float] | None = None
_public_keys: dict[str, tuple[str, str, float]] = {}
_public_key_lookups: deque[float] = deque()


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args: object, **kwargs: object) -> None:
        return None


_forward_opener = urllib.request.build_opener(_NoRedirectHandler())


class AccountDeletionError(Exception):
    """A request that must not be acknowledged as successfully processed."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def challenge_response(challenge_code: str, verification_token: str, endpoint_url: str) -> str:
    return hashlib.sha256(
        f"{challenge_code}{verification_token}{endpoint_url}".encode()
    ).hexdigest()


def account_deletion_config() -> tuple[str, str]:
    endpoint = os.getenv("EBAY_ACCOUNT_DELETION_ENDPOINT_URL", "").strip()
    token = os.getenv("EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN", "").strip()
    parsed = urllib.parse.urlparse(endpoint)
    if (
        parsed.scheme != "https"
        or not parsed.netloc
        or parsed.username
        or parsed.password
        or not VERIFICATION_TOKEN_PATTERN.fullmatch(token)
    ):
        raise ConfigurationError(
            "Configura EBAY_ACCOUNT_DELETION_ENDPOINT_URL e "
            "EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN."
        )
    return endpoint, token


def verify_notification(body: bytes, signature_header: str) -> dict[str, object]:
    header = _decode_signature_header(signature_header)
    key_id = str(header.get("kid") or "")
    signature = str(header.get("signature") or "")
    if not PUBLIC_KEY_ID_PATTERN.fullmatch(key_id) or not signature:
        raise AccountDeletionError("signature_malformed", "Firma eBay incompleta.")

    key, digest = _public_key(key_id)
    public_key = serialization.load_pem_public_key(key.encode())
    if not isinstance(public_key, ec.EllipticCurvePublicKey):
        raise AccountDeletionError("public_key_invalid", "Chiave pubblica eBay non valida.")
    try:
        hash_algorithm = hashes.SHA1() if digest == "SHA1" else hashes.SHA256()
        public_key.verify(_decode_base64(signature), body, ec.ECDSA(hash_algorithm))
    except InvalidSignature as exc:
        raise AccountDeletionError("signature_invalid", "Firma eBay non valida.") from exc
    return header


def parse_notification(body: bytes) -> tuple[str, list[str]]:
    try:
        payload = json.loads(body)
        metadata = cast(dict[str, object], payload["metadata"])
        notification = cast(dict[str, object], payload["notification"])
        data = cast(dict[str, object], notification["data"])
        notification_id = str(notification["notificationId"]).strip()
        identifiers = [
            str(data.get(name) or "").strip() for name in ("userId", "username", "eiasToken")
        ]
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise AccountDeletionError("payload_malformed", "Payload eBay non valido.") from exc
    if metadata.get("topic") != "MARKETPLACE_ACCOUNT_DELETION":
        raise AccountDeletionError("topic_unsupported", "Topic eBay non supportato.")
    identifiers = list(dict.fromkeys(value for value in identifiers if value))
    if not notification_id or not identifiers:
        raise AccountDeletionError("payload_malformed", "Identificativi eBay mancanti.")
    return notification_id, identifiers


def process_notification(state_path: str, body: bytes, signature_header: str) -> int:
    verify_notification(body, signature_header)
    notification_id, identifiers = parse_notification(body)
    _, verification_token = account_deletion_config()
    user_id_hash = hmac.new(
        verification_token.encode(), identifiers[0].encode(), hashlib.sha256
    ).hexdigest()

    now = datetime.now(timezone.utc)
    started_at = now.isoformat().replace("+00:00", "Z")
    stale_before = (
        (now - timedelta(seconds=PROCESSING_LEASE_SECONDS)).isoformat().replace("+00:00", "Z")
    )
    init_db(state_path)
    with _connect(state_path) as conn:
        inserted = conn.execute(
            "INSERT INTO ebay_account_deletion_requests "
            "(notification_id, user_id_hash, status, processing_started_at) "
            "VALUES (?, ?, 'processing', ?) "
            "ON CONFLICT(notification_id) DO NOTHING",
            (notification_id, user_id_hash, started_at),
        )
        if inserted.rowcount == 0:
            existing = conn.execute(
                "SELECT status FROM ebay_account_deletion_requests WHERE notification_id = ?",
                (notification_id,),
            ).fetchone()
            if existing is not None and existing["status"] == "processed":
                return 0
            claimed = conn.execute(
                "UPDATE ebay_account_deletion_requests "
                "SET user_id_hash = ?, status = 'processing', processing_started_at = ? "
                "WHERE notification_id = ? AND "
                "(status = 'retryable' OR processing_started_at <= ?)",
                (user_id_hash, started_at, notification_id, stale_before),
            )
            if claimed.rowcount == 0:
                raise AccountDeletionError(
                    "notification_processing", "Notifica eBay già in elaborazione."
                )

    try:
        _forward_to_hub(body, signature_header)
    except Exception:
        with _connect(state_path) as conn:
            conn.execute(
                "UPDATE ebay_account_deletion_requests SET status = 'retryable' "
                "WHERE notification_id = ? AND status = 'processing'",
                (notification_id,),
            )
        raise
    with _connect(state_path) as conn:
        conn.execute(
            "UPDATE ebay_account_deletion_requests SET status = 'processed', processed_at = ? "
            "WHERE notification_id = ?",
            (
                datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                notification_id,
            ),
        )
    return 0


def _decode_signature_header(value: str) -> dict[str, object]:
    if not value or len(value) > 8192:
        raise AccountDeletionError("signature_missing", "Firma eBay mancante.")
    try:
        decoded = json.loads(_decode_base64(value))
    except (UnicodeDecodeError, ValueError, json.JSONDecodeError) as exc:
        raise AccountDeletionError("signature_malformed", "Firma eBay non leggibile.") from exc
    if not isinstance(decoded, dict):
        raise AccountDeletionError("signature_malformed", "Firma eBay non valida.")
    return cast(dict[str, object], decoded)


def _decode_base64(value: str) -> bytes:
    padded = value + "=" * (-len(value) % 4)
    try:
        return base64.b64decode(padded, altchars=b"-_", validate=True)
    except ValueError as exc:
        raise AccountDeletionError("signature_malformed", "Base64 eBay non valido.") from exc


def _application_access_token() -> str:
    global _application_token
    now = time.monotonic()
    with _cache_lock:
        if _application_token and _application_token[1] > now:
            return _application_token[0]

    client_id = os.getenv("EBAY_CLIENT_ID", "").strip()
    client_secret = os.getenv("EBAY_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        raise ConfigurationError("Credenziali applicative eBay mancanti.")
    credentials = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    response = request_json(
        "POST",
        "https://api.ebay.com/identity/v1/oauth2/token",
        headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data=urllib.parse.urlencode(
            {"grant_type": "client_credentials", "scope": APPLICATION_SCOPE}
        ).encode(),
    )
    token = str(response.get("access_token") or "")
    if not token:
        raise AccountDeletionError("token_invalid", "Token applicativo eBay mancante.")
    expires_value = response.get("expires_in")
    try:
        expires_in = int(expires_value) if isinstance(expires_value, (int, float, str)) else 7200
    except ValueError as exc:
        raise AccountDeletionError("token_invalid", "Scadenza token eBay non valida.") from exc
    with _cache_lock:
        _application_token = (token, now + max(30, expires_in - 60))
    return token


def _public_key(key_id: str) -> tuple[str, str]:
    now = time.monotonic()
    with _cache_lock:
        cached = _public_keys.get(key_id)
        if cached and cached[2] > now:
            return cached[0], cached[1]
        while _public_key_lookups and _public_key_lookups[0] <= (
            now - PUBLIC_KEY_LOOKUP_WINDOW_SECONDS
        ):
            _public_key_lookups.popleft()
        if len(_public_key_lookups) >= PUBLIC_KEY_LOOKUP_LIMIT:
            raise AccountDeletionError(
                "public_key_lookup_limited",
                "Lookup delle chiavi pubbliche eBay temporaneamente limitato.",
            )
        # ponytail: limite globale; passare a quote distribuite solo con più processi.
        _public_key_lookups.append(now)
    response: JsonObject = request_json(
        "GET",
        "https://api.ebay.com/commerce/notification/v1/public_key/"
        + urllib.parse.quote(key_id, safe=""),
        headers={"Authorization": f"Bearer {_application_access_token()}"},
    )
    key = str(response.get("key") or "")
    algorithm = str(response.get("algorithm") or "").upper()
    digest = str(response.get("digest") or "").replace("-", "").upper()
    if not key or algorithm != "ECDSA" or digest not in {"SHA1", "SHA256"}:
        raise AccountDeletionError("public_key_invalid", "Chiave pubblica eBay mancante.")
    if "-----BEGIN PUBLIC KEY-----" in key and "\n" not in key:
        body = key.replace("-----BEGIN PUBLIC KEY-----", "").replace("-----END PUBLIC KEY-----", "")
        key = (
            "-----BEGIN PUBLIC KEY-----\n"
            + "\n".join(body[index : index + 64] for index in range(0, len(body), 64))
            + "\n-----END PUBLIC KEY-----"
        )
    with _cache_lock:
        _public_keys[key_id] = (key, digest, now + PUBLIC_KEY_CACHE_SECONDS)
    return key, digest


def _forward_to_hub(body: bytes, signature_header: str) -> None:
    endpoint = os.getenv("HUB_FATTURE_EBAY_ACCOUNT_DELETION_URL", "").strip()
    if not endpoint:
        raise ConfigurationError("Configura HUB_FATTURE_EBAY_ACCOUNT_DELETION_URL.")
    parsed = urllib.parse.urlparse(endpoint)
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        raise ConfigurationError("HUB_FATTURE_EBAY_ACCOUNT_DELETION_URL deve essere HTTPS.")
    request = urllib.request.Request(endpoint, data=body, method="POST")
    request.add_header("Content-Type", "application/json")
    request.add_header("X-EBAY-SIGNATURE", signature_header)
    with _forward_opener.open(request, timeout=5) as response:
        if response.status not in {200, 201, 202, 204}:
            raise AccountDeletionError(
                "hub_forward_failed", "Hub Fatture non ha accettato la richiesta."
            )
