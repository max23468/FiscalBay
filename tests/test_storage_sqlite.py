import sqlite3
import tempfile
import unittest
from pathlib import Path

from src.ebay_cf.models import (
    OPERATION_STATUS_COMPLETED,
    OPERATION_STATUS_PENDING,
    OPERATION_STATUS_RUNNING,
    OPERATION_TYPE_APPLY_USER_ACCESS_STATE,
    TELEGRAM_USER_STATUS_APPROVED,
    TELEGRAM_USER_STATUS_BLOCKED,
    AuditLogEntry,
    BotMetrics,
    BotRuntimeState,
    EbayTokenSet,
    LinkedEbayAccount,
    NotificationSubscription,
    OauthLinkSession,
    OperationQueueEntry,
    RetryQueueEntry,
    TelegramChat,
    TelegramUser,
)
from src.ebay_cf.storage.sqlite import (
    SCHEMA_VERSION,
    append_audit_log_entry,
    apply_telegram_user_access_status,
    claim_pending_operation,
    create_oauth_link_session,
    disconnect_linked_ebay_account,
    enqueue_operation,
    list_notification_tenants,
    load_audit_log_entries,
    load_ebay_token_sets,
    load_latest_oauth_link_session,
    load_linked_ebay_accounts,
    load_notification_subscriptions,
    load_operation_queue_entries,
    load_retry_queue,
    load_state,
    load_telegram_chats,
    load_telegram_users,
    load_tenant_retry_queue_entries,
    load_tenant_runtime_state,
    resolve_linked_ebay_account,
    resolve_tenant_chat_context,
    save_retry_queue,
    save_state,
    save_tenant_retry_queue_entries,
    save_tenant_runtime_state,
    set_notification_subscription_enabled,
    summarize_operation_queue,
    update_operation_queue_entry,
    upsert_ebay_token_set,
    upsert_linked_ebay_account,
    upsert_notification_subscription,
    upsert_telegram_chat,
    upsert_telegram_user,
)


class SQLiteStorageIntegrationTests(unittest.TestCase):
    def test_audit_log_roundtrip(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            append_audit_log_entry(
                str(db_path),
                AuditLogEntry(
                    event_type="request_access",
                    created_at="2026-04-06T18:00:00Z",
                    actor_telegram_user_id=111,
                    target_telegram_user_id=111,
                    telegram_chat_id=222,
                    outcome="pending",
                    details_json='{"admin_notified": true}',
                ),
            )

            entries = load_audit_log_entries(str(db_path))
            self.assertEqual(len(entries), 1)
            self.assertEqual(entries[0].event_type, "request_access")
            self.assertEqual(entries[0].actor_telegram_user_id, 111)
            self.assertEqual(entries[0].telegram_chat_id, 222)
            self.assertEqual(entries[0].outcome, "pending")

    def test_operation_queue_roundtrip_and_claim(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            entry = enqueue_operation(
                str(db_path),
                OperationQueueEntry(
                    operation_type=OPERATION_TYPE_APPLY_USER_ACCESS_STATE,
                    created_at="2026-04-06T18:00:00Z",
                    actor_telegram_user_id=123,
                    target_telegram_user_id=456,
                    payload_json='{"requested_status":"approved"}',
                ),
            )

            entries = load_operation_queue_entries(str(db_path))
            self.assertEqual(len(entries), 1)
            self.assertEqual(entries[0].status, OPERATION_STATUS_PENDING)

            claimed = claim_pending_operation(str(db_path), now_iso="2026-04-06T18:01:00Z")
            self.assertIsNotNone(claimed)
            assert claimed is not None
            self.assertEqual(claimed.id, entry.id)
            self.assertEqual(claimed.status, OPERATION_STATUS_RUNNING)
            self.assertEqual(claimed.attempts, 1)

            updated = update_operation_queue_entry(
                str(db_path),
                claimed.id or 0,
                status=OPERATION_STATUS_COMPLETED,
                result_json='{"result":"applied"}',
                updated_at="2026-04-06T18:02:00Z",
            )
            self.assertIsNotNone(updated)
            assert updated is not None
            self.assertEqual(updated.status, OPERATION_STATUS_COMPLETED)
            self.assertEqual(summarize_operation_queue(str(db_path))["pending"], 0)

    def test_state_roundtrip_on_temp_sqlite_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"

            initial = load_state(str(db_path))
            self.assertEqual(initial["notified_order_ids"], [])
            self.assertEqual(initial["notified_hashes"], [])
            self.assertIsNone(initial["last_check"])

            state = {
                "notified_order_ids": ["order-1", "order-2"],
                "notified_hashes": ["hash-1", "hash-2"],
                "last_check": "2026-04-05T20:00:00Z",
                "last_error": "boom",
                "metrics": {
                    "orders_read": 7,
                    "orders_with_cf": 2,
                    "notifications_sent": 3,
                    "telegram_retries": 1,
                    "consecutive_error_cycles": 2,
                    "errors_by_type": {"telegram_send": 1},
                },
            }
            save_state(str(db_path), state)

            restored = load_state(str(db_path))
            self.assertEqual(restored["notified_order_ids"], ["order-1", "order-2"])
            self.assertEqual(restored["notified_hashes"], ["hash-1", "hash-2"])
            self.assertEqual(restored["last_check"], "2026-04-05T20:00:00Z")
            self.assertEqual(restored["last_error"], "boom")
            self.assertEqual(
                restored["metrics"],
                {
                    "orders_read": 7,
                    "orders_with_cf": 2,
                    "notifications_sent": 3,
                    "telegram_retries": 1,
                    "consecutive_error_cycles": 2,
                    "errors_by_type": {"telegram_send": 1},
                },
            )

    def test_retry_queue_roundtrip_on_temp_sqlite_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"

            self.assertEqual(load_retry_queue(str(db_path)), [])

            queue = [
                {"chat_id": 123, "text": "msg-1", "attempts": 1},
                {"chat_id": 456, "text": "msg-2", "attempts": 2},
            ]
            save_retry_queue(str(db_path), queue)

            restored = load_retry_queue(str(db_path))
            self.assertEqual(len(restored), 2)
            self.assertEqual(restored[0]["chat_id"], 123)
            self.assertEqual(restored[0]["text"], "msg-1")
            self.assertEqual(restored[0]["attempts"], 1)
            self.assertIn("id", restored[0])
            self.assertEqual(restored[1]["chat_id"], 456)
            self.assertEqual(restored[1]["text"], "msg-2")
            self.assertEqual(restored[1]["attempts"], 2)
            self.assertIn("id", restored[1])

    def test_legacy_notified_orders_table_is_migrated(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"

            with sqlite3.connect(db_path) as conn:
                conn.execute("CREATE TABLE notified_orders (order_id TEXT, hash TEXT)")
                conn.execute(
                    "CREATE TABLE retry_queue "
                    "("
                    "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                    "chat_id INTEGER, text TEXT, attempts INTEGER"
                    ")"
                )
                conn.execute("CREATE TABLE kv_store (key TEXT PRIMARY KEY, value TEXT)")
                conn.execute(
                    "INSERT INTO notified_orders (order_id, hash) VALUES (?, ?)",
                    ("legacy-order", "legacy-hash"),
                )
                conn.execute(
                    "INSERT INTO kv_store (key, value) VALUES (?, ?)",
                    ("last_check", "2026-04-05T20:00:00Z"),
                )

            restored = load_state(str(db_path))
            self.assertEqual(restored["notified_order_ids"], ["legacy-order"])
            self.assertEqual(restored["notified_hashes"], ["legacy-hash"])
            self.assertEqual(restored["last_check"], "2026-04-05T20:00:00Z")

            with sqlite3.connect(db_path) as conn:
                version = conn.execute("PRAGMA user_version").fetchone()[0]
                self.assertEqual(version, SCHEMA_VERSION)
                legacy = conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='notified_orders'"
                ).fetchone()
                self.assertIsNone(legacy)
                ids = conn.execute("SELECT order_id FROM notified_order_ids").fetchall()
                hashes = conn.execute("SELECT hash FROM notified_hashes").fetchall()
                self.assertEqual(ids[0][0], "legacy-order")
                self.assertEqual(hashes[0][0], "legacy-hash")

    def test_save_state_removes_stale_values_without_duplicates(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"

            save_state(
                str(db_path),
                {
                    "notified_order_ids": ["order-1", "order-2", "order-2"],
                    "notified_hashes": ["hash-1", "hash-2", "hash-2"],
                    "last_check": None,
                    "last_error": None,
                    "metrics": {},
                },
            )
            save_state(
                str(db_path),
                {
                    "notified_order_ids": ["order-2"],
                    "notified_hashes": ["hash-2"],
                    "last_check": None,
                    "last_error": None,
                    "metrics": {},
                },
            )

            restored = load_state(str(db_path))
            self.assertEqual(restored["notified_order_ids"], ["order-2"])
            self.assertEqual(restored["notified_hashes"], ["hash-2"])

    def test_retry_queue_updates_existing_rows_without_full_reset(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"

            save_retry_queue(
                str(db_path),
                [
                    {"chat_id": 123, "text": "msg-1", "attempts": 1},
                    {"chat_id": 456, "text": "msg-2", "attempts": 2},
                ],
            )
            initial = load_retry_queue(str(db_path))

            save_retry_queue(
                str(db_path),
                [
                    {
                        "id": initial[1]["id"],
                        "chat_id": 456,
                        "text": "msg-2-updated",
                        "attempts": 3,
                    },
                    {
                        "chat_id": 789,
                        "text": "msg-3",
                        "attempts": 0,
                    },
                ],
            )

            restored = load_retry_queue(str(db_path))
            self.assertEqual(len(restored), 2)
            self.assertEqual(restored[0]["id"], initial[1]["id"])
            self.assertEqual(restored[0]["chat_id"], 456)
            self.assertEqual(restored[0]["text"], "msg-2-updated")
            self.assertEqual(restored[0]["attempts"], 3)
            self.assertEqual(restored[1]["chat_id"], 789)
            self.assertEqual(restored[1]["text"], "msg-3")

    def test_legacy_json_state_file_is_migrated_to_sqlite(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "notified_orders.json"
            db_path.write_text(
                (
                    '{"notified_order_ids":["order-1"],'
                    '"notified_hashes":["hash-1"],'
                    '"last_check":"2026-04-05T20:00:00Z",'
                    '"last_error":null,'
                    '"metrics":{"orders_read":2,"orders_with_cf":1,"notifications_sent":1,"telegram_retries":0,"consecutive_error_cycles":0,"errors_by_type":{}}}'
                ),
                encoding="utf-8",
            )

            restored = load_state(str(db_path))

            self.assertEqual(restored["notified_order_ids"], ["order-1"])
            self.assertEqual(restored["notified_hashes"], ["hash-1"])
            self.assertEqual(restored["last_check"], "2026-04-05T20:00:00Z")
            self.assertTrue((Path(tmpdir) / "notified_orders.json.legacy-json.bak").exists())

            with sqlite3.connect(db_path) as conn:
                version = conn.execute("PRAGMA user_version").fetchone()[0]
                self.assertEqual(version, SCHEMA_VERSION)

    def test_legacy_json_retry_queue_file_is_migrated_to_sqlite(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "failed_notifications.json"
            db_path.write_text(
                '[{"chat_id":123,"text":"retry me","attempts":2}]',
                encoding="utf-8",
            )

            restored = load_retry_queue(str(db_path))

            self.assertEqual(len(restored), 1)
            self.assertEqual(restored[0]["chat_id"], 123)
            self.assertEqual(restored[0]["text"], "retry me")
            self.assertEqual(restored[0]["attempts"], 2)
            self.assertTrue((Path(tmpdir) / "failed_notifications.json.legacy-json.bak").exists())

    def test_tenant_runtime_state_roundtrip_on_shared_db(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"

            save_tenant_runtime_state(
                str(db_path),
                123,
                BotRuntimeState(
                    notified_order_ids=["order-1"],
                    notified_hashes=["hash-1"],
                    last_check="2026-04-06T10:00:00Z",
                    last_error=None,
                    metrics=BotMetrics(orders_read=3, orders_with_cf=1),
                ),
            )

            restored = load_tenant_runtime_state(str(db_path), 123)
            self.assertEqual(restored.notified_order_ids, ["order-1"])
            self.assertEqual(restored.notified_hashes, ["hash-1"])
            self.assertEqual(restored.last_check, "2026-04-06T10:00:00Z")
            self.assertEqual(restored.metrics.orders_with_cf, 1)

    def test_tenant_retry_queue_roundtrip_on_shared_db(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"

            save_tenant_retry_queue_entries(
                str(db_path),
                123,
                [RetryQueueEntry(chat_id=456, text="hello", attempts=1)],
            )

            restored = load_tenant_retry_queue_entries(str(db_path), 123)
            self.assertEqual(len(restored), 1)
            self.assertEqual(restored[0].chat_id, 456)
            self.assertEqual(restored[0].text, "hello")
            self.assertEqual(restored[0].attempts, 1)

    def test_multi_tenant_entities_and_notification_targets_roundtrip(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"

            upsert_telegram_user(
                str(db_path),
                TelegramUser(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    username="seller",
                    display_name="Mario Rossi",
                    created_at="2026-04-06T10:00:00Z",
                ),
            )
            upsert_telegram_chat(
                str(db_path),
                TelegramChat(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    chat_type="private",
                    is_primary=True,
                    notifications_enabled=True,
                    created_at="2026-04-06T10:00:00Z",
                ),
            )
            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=123,
                    ebay_user_id="seller-ebay",
                    environment="production",
                    scopes="sell.fulfillment.readonly",
                    linked_at="2026-04-06T10:05:00Z",
                    status="linked",
                ),
            )
            account = load_linked_ebay_accounts(str(db_path))[0]
            self.assertIsNotNone(account.id)
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=int(account.id),
                    refresh_token_encrypted="enc",
                    access_token="short",
                    scope_set="sell.fulfillment.readonly",
                    status="active",
                ),
            )
            upsert_notification_subscription(
                str(db_path),
                NotificationSubscription(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    enabled=True,
                    filters="",
                    created_at="2026-04-06T10:06:00Z",
                ),
            )

            self.assertEqual(len(load_telegram_users(str(db_path))), 1)
            self.assertEqual(len(load_telegram_chats(str(db_path))), 1)
            self.assertEqual(len(load_linked_ebay_accounts(str(db_path))), 1)
            self.assertEqual(len(load_ebay_token_sets(str(db_path))), 1)
            self.assertEqual(len(load_notification_subscriptions(str(db_path))), 1)

            tenants = list_notification_tenants(str(db_path))
            self.assertEqual(len(tenants), 1)
            self.assertEqual(tenants[0].telegram_user_id, 123)
            self.assertEqual(tenants[0].environment, "production")
            self.assertEqual(tenants[0].notify_chat_ids, {456})

    def test_resolve_tenant_chat_context_prefers_exact_user_mapping(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"

            upsert_telegram_user(
                str(db_path),
                TelegramUser(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    username="first",
                    display_name="First User",
                    created_at="2026-04-06T10:00:00Z",
                ),
            )
            upsert_telegram_chat(
                str(db_path),
                TelegramChat(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    notifications_enabled=True,
                    created_at="2026-04-06T10:00:00Z",
                    updated_at="2026-04-06T10:00:00Z",
                ),
            )
            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=123,
                    ebay_user_id="seller-1",
                    environment="production",
                    linked_at="2026-04-06T10:00:00Z",
                ),
            )

            upsert_telegram_user(
                str(db_path),
                TelegramUser(
                    telegram_user_id=124,
                    telegram_chat_id=456,
                    username="second",
                    display_name="Second User",
                    created_at="2026-04-06T10:01:00Z",
                ),
            )
            upsert_telegram_chat(
                str(db_path),
                TelegramChat(
                    telegram_user_id=124,
                    telegram_chat_id=456,
                    notifications_enabled=False,
                    created_at="2026-04-06T10:01:00Z",
                    updated_at="2026-04-06T10:01:00Z",
                ),
            )
            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=124,
                    ebay_user_id="seller-2",
                    environment="sandbox",
                    linked_at="2026-04-06T10:01:00Z",
                ),
            )

            exact = resolve_tenant_chat_context(str(db_path), 456, telegram_user_id=124)
            fallback = resolve_tenant_chat_context(str(db_path), 456)

            assert exact is not None
            assert fallback is not None
            self.assertEqual(exact.telegram_user_id, 124)
            self.assertEqual(exact.environment, "sandbox")
            self.assertFalse(exact.notifications_enabled)
            self.assertEqual(fallback.telegram_chat_id, 456)

    def test_resolve_linked_ebay_account_prefers_exact_environment(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"

            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=123,
                    ebay_user_id="seller-prod",
                    environment="production",
                    linked_at="2026-04-06T10:00:00Z",
                    status="linked",
                ),
            )
            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=123,
                    ebay_user_id="seller-sandbox",
                    environment="sandbox",
                    linked_at="2026-04-06T10:01:00Z",
                    status="linked",
                ),
            )

            exact = resolve_linked_ebay_account(str(db_path), 123, "sandbox")
            fallback = resolve_linked_ebay_account(str(db_path), 123, "staging")

            assert exact is not None
            assert fallback is not None
            self.assertEqual(exact.ebay_user_id, "seller-sandbox")
            self.assertEqual(fallback.telegram_user_id, 123)

    def test_create_and_load_latest_oauth_link_session(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"

            create_oauth_link_session(
                str(db_path),
                OauthLinkSession(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    oauth_state="state-1",
                    status="pending",
                    expires_at="2026-04-06T11:00:00Z",
                    created_at="2026-04-06T10:45:00Z",
                ),
            )

            session = load_latest_oauth_link_session(str(db_path), 123)

            assert session is not None
            self.assertEqual(session.telegram_chat_id, 456)
            self.assertEqual(session.oauth_state, "state-1")
            self.assertEqual(session.status, "pending")

    def test_disconnect_linked_ebay_account_revokes_local_token(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"

            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=123,
                    ebay_user_id="seller-ebay",
                    environment="sandbox",
                    scopes="sell.fulfillment",
                    linked_at="2026-04-06T10:00:00Z",
                    status="linked",
                ),
            )
            account = resolve_linked_ebay_account(str(db_path), 123, "sandbox")
            assert account is not None
            assert account.id is not None
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=account.id,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="access-token",
                    scope_set="scope",
                    status="active",
                ),
            )

            disconnected = disconnect_linked_ebay_account(str(db_path), 123, "sandbox")

            self.assertIsNotNone(disconnected)
            assert disconnected is not None
            self.assertEqual(disconnected.status, "disconnected")
            self.assertIsNone(resolve_linked_ebay_account(str(db_path), 123, "sandbox"))

            token_set = load_ebay_token_sets(str(db_path))[0]
            self.assertEqual(token_set.status, "revoked")
            self.assertEqual(token_set.refresh_token_encrypted, "")
            self.assertEqual(token_set.access_token, "")

    def test_set_notification_subscription_enabled_updates_chat_and_subscription(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"

            upsert_telegram_user(
                str(db_path),
                TelegramUser(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    username="seller_user",
                    display_name="Mario Rossi",
                    created_at="2026-04-06T10:00:00Z",
                ),
            )
            upsert_telegram_chat(
                str(db_path),
                TelegramChat(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    chat_type="private",
                    is_primary=True,
                    notifications_enabled=True,
                    created_at="2026-04-06T10:00:00Z",
                    updated_at="2026-04-06T10:00:00Z",
                ),
            )

            set_notification_subscription_enabled(
                str(db_path),
                123,
                456,
                False,
                created_at="2026-04-06T10:00:00Z",
                updated_at="2026-04-06T10:05:00Z",
            )

            subscriptions = load_notification_subscriptions(str(db_path))
            chats = load_telegram_chats(str(db_path))
            self.assertEqual(len(subscriptions), 1)
            self.assertFalse(subscriptions[0].enabled)
            self.assertEqual(len(chats), 1)
            self.assertFalse(chats[0].notifications_enabled)

    def test_apply_telegram_user_access_status_syncs_permissions_for_existing_chats(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"

            upsert_telegram_user(
                str(db_path),
                TelegramUser(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    username="seller_user",
                    display_name="Mario Rossi",
                    created_at="2026-04-06T10:00:00Z",
                    status="pending",
                ),
            )
            upsert_telegram_chat(
                str(db_path),
                TelegramChat(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    chat_type="private",
                    is_primary=True,
                    notifications_enabled=False,
                    created_at="2026-04-06T10:00:00Z",
                    updated_at="2026-04-06T10:00:00Z",
                ),
            )

            approved_user = apply_telegram_user_access_status(
                str(db_path),
                123,
                TELEGRAM_USER_STATUS_APPROVED,
                updated_at="2026-04-06T10:05:00Z",
                default_notify_chat_ids={456},
            )

            self.assertIsNotNone(approved_user)
            assert approved_user is not None
            self.assertEqual(approved_user.status, TELEGRAM_USER_STATUS_APPROVED)
            subscriptions = load_notification_subscriptions(str(db_path))
            chats = load_telegram_chats(str(db_path))
            self.assertEqual(len(subscriptions), 1)
            self.assertTrue(subscriptions[0].enabled)
            self.assertTrue(chats[0].notifications_enabled)

            blocked_user = apply_telegram_user_access_status(
                str(db_path),
                123,
                TELEGRAM_USER_STATUS_BLOCKED,
                updated_at="2026-04-06T10:06:00Z",
                default_notify_chat_ids={456},
            )

            self.assertIsNotNone(blocked_user)
            assert blocked_user is not None
            self.assertEqual(blocked_user.status, TELEGRAM_USER_STATUS_BLOCKED)
            subscriptions = load_notification_subscriptions(str(db_path))
            chats = load_telegram_chats(str(db_path))
            self.assertFalse(subscriptions[0].enabled)
            self.assertFalse(chats[0].notifications_enabled)


if __name__ == "__main__":
    unittest.main()
