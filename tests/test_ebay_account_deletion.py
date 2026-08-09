import base64
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from src.fiscalbay.ebay_account_deletion import (
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


if __name__ == "__main__":
    unittest.main()
