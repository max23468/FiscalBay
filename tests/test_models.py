import unittest

from src.ebay_cf.models import (
    EbayTokenSet,
    LinkedEbayAccount,
    NotificationSubscription,
    TelegramChat,
    TelegramUser,
    TenantChatContext,
)


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

    def test_telegram_chat_from_mapping_normalizes_fields(self) -> None:
        chat = TelegramChat.from_mapping(
            {
                "id": "7",
                "telegram_user_id": "123",
                "telegram_chat_id": "456",
                "chat_type": "group",
                "is_primary": "0",
                "notifications_enabled": "1",
                "created_at": "2026-04-06T10:15:00Z",
            }
        )

        self.assertEqual(chat.id, 7)
        self.assertEqual(chat.telegram_user_id, 123)
        self.assertEqual(chat.telegram_chat_id, 456)
        self.assertEqual(chat.chat_type, "group")
        self.assertFalse(chat.is_primary)
        self.assertTrue(chat.notifications_enabled)

    def test_ebay_token_set_from_mapping_normalizes_fields(self) -> None:
        token_set = EbayTokenSet.from_mapping(
            {
                "id": "4",
                "ebay_account_id": "9",
                "refresh_token_encrypted": "enc-token",
                "access_token": "short-lived",
                "scope_set": "sell.fulfillment.readonly",
                "expires_at": "2026-04-06T11:00:00Z",
                "status": "active",
            }
        )

        self.assertEqual(token_set.id, 4)
        self.assertEqual(token_set.ebay_account_id, 9)
        self.assertEqual(token_set.refresh_token_encrypted, "enc-token")
        self.assertEqual(token_set.as_dict()["status"], "active")

    def test_notification_subscription_from_mapping_normalizes_fields(self) -> None:
        subscription = NotificationSubscription.from_mapping(
            {
                "id": "5",
                "telegram_user_id": "123",
                "telegram_chat_id": "456",
                "enabled": "0",
                "filters": '{"only_found": true}',
            }
        )

        self.assertEqual(subscription.id, 5)
        self.assertEqual(subscription.telegram_user_id, 123)
        self.assertEqual(subscription.telegram_chat_id, 456)
        self.assertFalse(subscription.enabled)
        self.assertEqual(subscription.filters, '{"only_found": true}')

    def test_tenant_chat_context_from_mapping_normalizes_fields(self) -> None:
        tenant_context = TenantChatContext.from_mapping(
            {
                "telegram_user_id": "123",
                "telegram_chat_id": "456",
                "environment": "sandbox",
                "notifications_enabled": "1",
            }
        )

        self.assertEqual(tenant_context.telegram_user_id, 123)
        self.assertEqual(tenant_context.telegram_chat_id, 456)
        self.assertEqual(tenant_context.environment, "sandbox")
        self.assertTrue(tenant_context.notifications_enabled)


if __name__ == "__main__":
    unittest.main()
