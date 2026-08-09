import base64
import json
import tempfile
import threading
import unittest
from collections import deque
from pathlib import Path
from unittest.mock import patch

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from src.fiscalbay import ebay_account_deletion
from src.fiscalbay.ebay_account_deletion import (
    AccountDeletionError,
    _public_key,
    parse_notification,
    process_notification,
    verify_notification,
)
from src.fiscalbay.models import LinkedEbayAccount, TelegramUser
from src.fiscalbay.storage.connection import _connect, init_db
from src.fiscalbay.storage.users import upsert_linked_ebay_account, upsert_telegram_user


def notification() -> bytes:
    return json.dumps(
        {
            "metadata": {"topic": "MARKETPLACE_ACCOUNT_DELETION"},
            "notification": {
                "notificationId": "notification-1",
                "data": {
                    "userId": "immutable-user-1",
                    "username": "seller-visible-1",
                    "eiasToken": "legacy-token-1",
                },
            },
        }
    ).encode()


class EbayAccountDeletionTests(unittest.TestCase):
    def test_parse_notification_rejects_another_topic(self) -> None:
        body = notification().replace(b"MARKETPLACE_ACCOUNT_DELETION", b"OTHER")
        with self.assertRaisesRegex(Exception, "Topic eBay non supportato"):
            parse_notification(body)

    def test_verify_notification_uses_the_digest_declared_by_the_public_key(self) -> None:
        private_key = ec.generate_private_key(ec.SECP256R1())
        public_key = (
            private_key.public_key()
            .public_bytes(
                serialization.Encoding.PEM,
                serialization.PublicFormat.SubjectPublicKeyInfo,
            )
            .decode()
        )
        signature = base64.b64encode(
            private_key.sign(notification(), ec.ECDSA(hashes.SHA256()))
        ).decode()
        header = base64.b64encode(
            json.dumps({"kid": "key-1", "signature": signature}).encode()
        ).decode()
        with patch(
            "src.fiscalbay.ebay_account_deletion._public_key",
            return_value=(public_key, "SHA256"),
        ):
            verify_notification(notification(), header)

    @patch("src.fiscalbay.ebay_account_deletion._application_access_token")
    @patch("src.fiscalbay.ebay_account_deletion.request_json")
    def test_public_key_lookup_budget_bounds_unknown_key_ids(self, request_json, _token) -> None:
        request_json.return_value = {
            "key": "-----BEGIN PUBLIC KEY-----key-----END PUBLIC KEY-----",
            "algorithm": "ECDSA",
            "digest": "SHA256",
        }
        with (
            patch.object(ebay_account_deletion, "_public_keys", {}),
            patch.object(ebay_account_deletion, "_public_key_lookups", deque()),
        ):
            for index in range(ebay_account_deletion.PUBLIC_KEY_LOOKUP_LIMIT):
                _public_key(f"unknown-{index}")
            with self.assertRaisesRegex(AccountDeletionError, "temporaneamente limitato"):
                _public_key("unknown-over-limit")

        self.assertEqual(request_json.call_count, ebay_account_deletion.PUBLIC_KEY_LOOKUP_LIMIT)

    @patch.dict(
        "os.environ",
        {
            "HUB_FATTURE_EBAY_ACCOUNT_DELETION_URL": (
                "https://hub.example.com/webhooks/ebay/account-deletion"
            )
        },
        clear=False,
    )
    def test_hub_forwarder_uses_an_opener_that_rejects_redirects(self) -> None:
        redirect_handler = next(
            handler
            for handler in ebay_account_deletion._forward_opener.handlers
            if isinstance(handler, ebay_account_deletion._NoRedirectHandler)
        )
        self.assertIsNone(redirect_handler.redirect_request())

    @patch.dict(
        "os.environ",
        {
            "EBAY_ACCOUNT_DELETION_ENDPOINT_URL": "https://example.com/ebay/account-deletion",
            "EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN": "v" * 32,
            "HUB_FATTURE_EBAY_ACCOUNT_DELETION_URL": "https://hub.example.com/webhooks/ebay/account-deletion",
        },
        clear=False,
    )
    @patch("src.fiscalbay.ebay_account_deletion._forward_to_hub")
    @patch("src.fiscalbay.ebay_account_deletion.verify_notification")
    def test_process_notification_forwards_once_without_deleting_seller(
        self, _verify, forward
    ) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            path = str(Path(tmpdir) / "state.db")
            upsert_telegram_user(
                path,
                TelegramUser(telegram_user_id=123, telegram_chat_id=456, status="approved"),
            )
            upsert_linked_ebay_account(
                path,
                LinkedEbayAccount(
                    telegram_user_id=123,
                    ebay_user_id="seller-visible-1",
                    environment="production",
                    status="linked",
                ),
            )

            forward.side_effect = [OSError("hub offline"), None]
            with self.assertRaisesRegex(OSError, "hub offline"):
                process_notification(path, notification(), "signature")
            self.assertEqual(process_notification(path, notification(), "signature"), 0)
            self.assertEqual(process_notification(path, notification(), "signature"), 0)
            self.assertEqual(forward.call_count, 2)
            forward.assert_called_with(notification(), "signature")

            init_db(path)
            with _connect(path) as conn:
                self.assertEqual(
                    conn.execute("SELECT COUNT(*) FROM telegram_users").fetchone()[0], 1
                )
                request = conn.execute(
                    "SELECT status, user_id_hash FROM ebay_account_deletion_requests"
                ).fetchone()
                self.assertEqual(request["status"], "processed")
                self.assertNotEqual(request["user_id_hash"], "immutable-user-1")

    @patch.dict(
        "os.environ",
        {
            "EBAY_ACCOUNT_DELETION_ENDPOINT_URL": "https://example.com/ebay/account-deletion",
            "EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN": "v" * 32,
        },
        clear=False,
    )
    @patch("src.fiscalbay.ebay_account_deletion._forward_to_hub")
    @patch("src.fiscalbay.ebay_account_deletion.verify_notification")
    def test_process_notification_claims_concurrent_delivery_once(self, _verify, forward) -> None:
        entered = threading.Event()
        release = threading.Event()

        def block_forward(*_args) -> None:
            entered.set()
            release.wait(timeout=2)

        forward.side_effect = block_forward
        with tempfile.TemporaryDirectory() as tmpdir:
            path = str(Path(tmpdir) / "state.db")
            init_db(path)
            worker = threading.Thread(
                target=process_notification,
                args=(path, notification(), "signature"),
            )
            worker.start()
            self.assertTrue(entered.wait(timeout=2))
            with self.assertRaisesRegex(Exception, "già in elaborazione"):
                process_notification(path, notification(), "signature")
            release.set()
            worker.join(timeout=2)

        self.assertFalse(worker.is_alive())
        self.assertEqual(forward.call_count, 1)


if __name__ == "__main__":
    unittest.main()
