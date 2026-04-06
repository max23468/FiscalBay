import unittest

from src.ebay_cf.models import LinkedEbayAccount, TelegramUser


class ModelsTests(unittest.TestCase):
    def test_telegram_user_from_mapping_normalizes_fields(self) -> None:
        user = TelegramUser.from_mapping(
            {
                "telegram_user_id": "123",
                "telegram_chat_id": 456,
                "username": "seller_bot_user",
                "display_name": "Mario Rossi",
                "created_at": "2026-04-06T10:00:00Z",
                "status": "active",
            }
        )

        self.assertEqual(user.telegram_user_id, 123)
        self.assertEqual(user.telegram_chat_id, 456)
        self.assertEqual(user.username, "seller_bot_user")
        self.assertEqual(user.display_name, "Mario Rossi")
        self.assertEqual(user.created_at, "2026-04-06T10:00:00Z")
        self.assertEqual(user.as_dict()["status"], "active")

    def test_linked_ebay_account_from_mapping_normalizes_fields(self) -> None:
        account = LinkedEbayAccount.from_mapping(
            {
                "id": "9",
                "telegram_user_id": "123",
                "ebay_user_id": "my-ebay-user",
                "environment": "sandbox",
                "scopes": "sell.fulfillment.readonly",
                "linked_at": "2026-04-06T10:10:00Z",
                "status": "linked",
            }
        )

        self.assertEqual(account.id, 9)
        self.assertEqual(account.telegram_user_id, 123)
        self.assertEqual(account.ebay_user_id, "my-ebay-user")
        self.assertEqual(account.environment, "sandbox")
        self.assertEqual(account.as_dict()["status"], "linked")


if __name__ == "__main__":
    unittest.main()
