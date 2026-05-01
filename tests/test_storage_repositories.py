import unittest
from unittest.mock import Mock, patch

from src.fiscalbay.models import AuditLogEntry, OauthLinkSession, OperationQueueEntry
from src.fiscalbay.storage.repositories import (
    AuditRepository,
    OAuthAccountRepository,
    OperationQueueRepository,
    RuntimeStateRepository,
    TelegramAccessRepository,
)


class StorageRepositoryTests(unittest.TestCase):
    @patch("src.fiscalbay.storage.repositories.sqlite")
    def test_runtime_state_repository_delegates_snapshot_operations(self, sqlite_mock) -> None:
        sqlite_mock.rebuild_all_tenant_status_snapshots.return_value = {"rebuilt": 2}
        sqlite_mock.load_tenant_status_snapshots.return_value = [{"telegram_user_id": 123}]
        repository = RuntimeStateRepository("state.db")

        self.assertEqual(
            repository.rebuild_tenant_snapshots(now_iso="2026-05-01T10:00:00Z"), {"rebuilt": 2}
        )
        self.assertEqual(repository.load_tenant_snapshots(), [{"telegram_user_id": 123}])
        sqlite_mock.rebuild_all_tenant_status_snapshots.assert_called_once_with(
            "state.db",
            now_iso="2026-05-01T10:00:00Z",
        )
        sqlite_mock.load_tenant_status_snapshots.assert_called_once_with("state.db")

    @patch("src.fiscalbay.storage.repositories.sqlite")
    def test_telegram_access_repository_delegates_user_reads(self, sqlite_mock) -> None:
        expected_user = Mock()
        sqlite_mock.load_telegram_user.return_value = expected_user
        sqlite_mock.load_telegram_users.return_value = [expected_user]
        repository = TelegramAccessRepository("state.db")

        self.assertIs(repository.load_user(123), expected_user)
        self.assertEqual(repository.load_users(), [expected_user])
        sqlite_mock.load_telegram_user.assert_called_once_with("state.db", 123)
        sqlite_mock.load_telegram_users.assert_called_once_with("state.db")

    @patch("src.fiscalbay.storage.repositories.sqlite")
    def test_oauth_account_repository_delegates_link_session_operations(self, sqlite_mock) -> None:
        session = OauthLinkSession(
            telegram_user_id=123,
            telegram_chat_id=456,
            oauth_state="state-1",
        )
        sqlite_mock.create_oauth_link_session.return_value = session
        sqlite_mock.load_latest_oauth_link_session.return_value = session
        repository = OAuthAccountRepository("state.db")

        self.assertIs(repository.create_link_session(session), session)
        self.assertIs(repository.latest_link_session(123), session)
        sqlite_mock.create_oauth_link_session.assert_called_once_with("state.db", session)
        sqlite_mock.load_latest_oauth_link_session.assert_called_once_with("state.db", 123)

    @patch("src.fiscalbay.storage.repositories.sqlite")
    def test_audit_and_operation_queue_repositories_delegate_writes_and_summary(
        self, sqlite_mock
    ) -> None:
        audit_entry = AuditLogEntry(event_type="access_approved", created_at="2026-05-01T10:00:00Z")
        queue_entry = OperationQueueEntry(
            operation_type="reconcile_runtime",
            created_at="2026-05-01T10:00:00Z",
        )
        sqlite_mock.append_audit_log_entry.return_value = audit_entry
        sqlite_mock.enqueue_operation.return_value = queue_entry
        sqlite_mock.summarize_operation_queue.return_value = {"pending": 1}

        self.assertIs(AuditRepository("state.db").append(audit_entry), audit_entry)
        queue_repository = OperationQueueRepository("state.db")
        self.assertIs(queue_repository.enqueue(queue_entry), queue_entry)
        self.assertEqual(queue_repository.summarize(), {"pending": 1})
        sqlite_mock.append_audit_log_entry.assert_called_once_with("state.db", audit_entry)
        sqlite_mock.enqueue_operation.assert_called_once_with("state.db", queue_entry)
        sqlite_mock.summarize_operation_queue.assert_called_once_with("state.db")


if __name__ == "__main__":
    unittest.main()
