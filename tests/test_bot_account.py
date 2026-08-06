import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src.fiscalbay.bot import process_message
from src.fiscalbay.bot_common import sync_runtime_contact
from src.fiscalbay.models import (
    TELEGRAM_USER_STATUS_APPROVED,
    AuditLogEntry,
    BotOperationalMemory,
    BotRuntimeState,
    Config,
    EbayTokenSet,
    LinkedEbayAccount,
    OauthLinkSession,
    TelegramConfig,
)
from src.fiscalbay.storage.oauth import create_oauth_link_session, load_latest_oauth_link_session
from src.fiscalbay.storage.queues import (
    append_audit_log_entry,
    load_audit_log_entries,
)
from src.fiscalbay.storage.runtime import (
    save_tenant_runtime_state,
)
from src.fiscalbay.storage.users import (
    resolve_linked_ebay_account,
    update_telegram_user_status,
    upsert_ebay_token_set,
    upsert_linked_ebay_account,
)


class BotAccountTests(unittest.TestCase):
    def test_start_for_approved_user_without_account_prompts_connect(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={456},
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=999,
                chat_id=456,
                username="other_user",
                display_name="Other User",
                chat_type="private",
            )
            update_telegram_user_status(
                str(db_path),
                999,
                TELEGRAM_USER_STATUS_APPROVED,
                updated_at="2026-04-06T10:00:00Z",
            )

            replies = process_message(
                text="/start",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=999,
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("accesso è approvato", replies[0])
            self.assertIn("/account collega", replies[0])

    def test_start_for_approved_user_with_linked_account_shows_operational_commands(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={456},
                admin_user_id=999,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=456,
                username="seller_user",
                display_name="Mario Rossi",
                chat_type="private",
            )
            update_telegram_user_status(
                str(db_path),
                123,
                TELEGRAM_USER_STATUS_APPROVED,
                updated_at="2026-04-06T10:00:00Z",
            )
            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=123,
                    ebay_user_id="seller-ebay",
                    environment="sandbox",
                    linked_at="2026-04-06T10:10:00Z",
                    status="linked",
                ),
            )
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=1,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="",
                    scope_set="scope",
                    status="active",
                ),
            )

            replies = process_message(
                text="/start",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("account eBay risulta collegato", replies[0])
            self.assertIn("seller-ebay", replies[0])
            self.assertIn("/ordini fiscali", replies[0])

    def test_onboarding_guides_new_user_to_request_access(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={123, 456},
                notify_chat_ids=set(),
                admin_user_id=123,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=456,
                chat_id=456,
                username="new_user",
                display_name="New User",
                chat_type="private",
            )

            replies = process_message(
                text="/onboarding",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=456,
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Onboarding FiscalBay", replies[0])
            self.assertIn("Invito ricevuto", replies[0])
            self.assertIn("/request_access", replies[0])
            self.assertIn("approvato manualmente", replies[0])

    def test_onboarding_guides_approved_user_to_connect_ebay(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={123, 456},
                notify_chat_ids=set(),
                admin_user_id=123,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=456,
                chat_id=456,
                username="approved_user",
                display_name="Approved User",
                chat_type="private",
            )
            update_telegram_user_status(
                str(db_path),
                456,
                TELEGRAM_USER_STATUS_APPROVED,
                updated_at="2026-04-06T10:00:00Z",
            )

            replies = process_message(
                text="/onboarding",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=456,
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Collega eBay", replies[0])
            self.assertIn("/account collega", replies[0])
            self.assertIn("registrazioni libere", replies[0])

    def test_non_approved_user_cannot_open_account_before_approval(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids=set(),
                admin_user_id=123,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=999,
                chat_id=456,
                username="other_user",
                display_name="Other User",
                chat_type="private",
            )

            replies = process_message(
                text="/account",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=999,
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("/request_access", replies[0])

    def test_repeated_connect_reuses_pending_oauth_session(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids=set(),
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=999,
                chat_id=456,
                username="other_user",
                display_name="Other User",
                chat_type="private",
            )

            first_replies = process_message(
                text="/account collega",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=999,
            )
            first_session = load_latest_oauth_link_session(str(db_path), 999)
            assert first_session is not None

            second_replies = process_message(
                text="/account collega",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=999,
            )
            second_session = load_latest_oauth_link_session(str(db_path), 999)
            assert second_session is not None

            self.assertEqual(first_session.id, second_session.id)
            self.assertEqual(first_session.oauth_state, second_session.oauth_state)
            self.assertEqual(len(first_replies), 1)
            self.assertIn("Sessione OAuth", first_replies[0])
            self.assertIn("Sessione OAuth", second_replies[0])
            self.assertIn("Sessione OAuth preparata correttamente", first_replies[0])
            self.assertIn("Sessione già pronta", second_replies[0])

            audit_entries = load_audit_log_entries(str(db_path), limit=5)
            self.assertEqual(audit_entries[0].event_type, "connect")
            self.assertEqual(audit_entries[0].outcome, "session_reused")

    def test_maintenance_mode_blocks_connect_but_not_account_reads(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={123, 456},
                notify_chat_ids=set(),
                admin_user_id=123,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=123,
                username="admin_user",
                display_name="Admin",
                chat_type="private",
            )
            sync_runtime_contact(
                config,
                telegram_user_id=999,
                chat_id=456,
                username="approved_user",
                display_name="Approved User",
                chat_type="private",
            )
            update_telegram_user_status(
                str(db_path),
                999,
                TELEGRAM_USER_STATUS_APPROVED,
                updated_at="2026-04-06T10:00:00Z",
            )

            mode_replies = process_message(
                text="/service_mode maintenance",
                chat_id=123,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=123,
            )
            self.assertIn("maintenance", mode_replies[0])

            connect_replies = process_message(
                text="/account collega",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=999,
            )
            self.assertIn("manutenzione", connect_replies[0])

            account_replies = process_message(
                text="/account",
                chat_id=456,
                telegram_config=config,
                ebay_environment="production",
                telegram_user_id=999,
            )
            self.assertIn("Account eBay", account_replies[0])

    def test_process_message_order_requires_connected_tenant_credentials(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={456},
                admin_user_id=999,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=456,
                username="seller_user",
                display_name="Mario Rossi",
                chat_type="private",
            )
            update_telegram_user_status(
                str(db_path),
                123,
                TELEGRAM_USER_STATUS_APPROVED,
                updated_at="2026-04-06T10:00:00Z",
            )

            replies = process_message(
                text="/ordini cerca 12-34567-89012",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Usa /account collega", replies[0])

    def test_process_message_account_reports_linked_account_status(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={456},
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=456,
                username="seller_user",
                display_name="Mario Rossi",
                chat_type="private",
            )
            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=123,
                    ebay_user_id="seller-ebay",
                    environment="sandbox",
                    linked_at="2026-04-06T10:10:00Z",
                    status="linked",
                ),
            )
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=1,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="",
                    scope_set="scope",
                    status="active",
                ),
            )

            replies = process_message(
                text="/account",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Utente eBay: <code>seller-ebay</code>", replies[0])
            self.assertIn("Ambiente: <code>sandbox</code>", replies[0])
            self.assertIn("Token: <code>active</code>", replies[0])
            self.assertIn("Chat corrente: <code>attive</code>", replies[0])
            self.assertIn("Prossimi passi", replies[0])

    def test_process_message_reconnect_status_reports_linked_account_as_ok(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={456},
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=456,
                username="seller_user",
                display_name="Mario Rossi",
                chat_type="private",
            )
            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=123,
                    ebay_user_id="seller-ebay",
                    environment="sandbox",
                    linked_at="2026-04-06T10:10:00Z",
                    status="linked",
                ),
            )
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=1,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="",
                    scope_set="scope",
                    status="active",
                ),
            )

            replies = process_message(
                text="/account reconnect",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Stato attuale: <code>linked</code>", replies[0])
            self.assertIn("Nessuna azione richiesta", replies[0])

    def test_process_message_reconnect_status_requires_connect_when_unlinked(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={456},
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=456,
                username="seller_user",
                display_name="Mario Rossi",
                chat_type="private",
            )

            replies = process_message(
                text="/account reconnect",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Stato attuale: <code>unlinked</code>", replies[0])
            self.assertIn("/account collega", replies[0])

    def test_process_message_reconnect_status_reports_reconnect_required_for_revoked_token(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={456},
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=456,
                username="seller_user",
                display_name="Mario Rossi",
                chat_type="private",
            )
            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=123,
                    ebay_user_id="seller-ebay",
                    environment="sandbox",
                    linked_at="2026-04-06T10:10:00Z",
                    status="linked",
                ),
            )
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=1,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="",
                    scope_set="scope",
                    status="revoked",
                ),
            )

            replies = process_message(
                text="/account reconnect",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Stato attuale: <code>reconnect_required</code>", replies[0])
            self.assertIn("Stato token: <code>revoked</code>", replies[0])
            self.assertIn("/account collega", replies[0])

    def test_process_message_reconnect_status_reports_ready_connect_session(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={456},
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=456,
                username="seller_user",
                display_name="Mario Rossi",
                chat_type="private",
            )
            create_oauth_link_session(
                str(db_path),
                OauthLinkSession(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    environment="production",
                    oauth_state="ready-state",
                    status="pending",
                    expires_at="2099-04-06T10:10:00Z",
                    created_at="2026-04-06T10:00:00Z",
                ),
            )

            replies = process_message(
                text="/account reconnect",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Sessione connect pronta", replies[0])
            self.assertIn("2099-04-06T10:10:00Z", replies[0])

    def test_process_message_reconnect_status_includes_last_known_failure_reason(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={456},
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=456,
                username="seller_user",
                display_name="Mario Rossi",
                chat_type="private",
            )
            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=123,
                    ebay_user_id="seller-ebay",
                    environment="sandbox",
                    linked_at="2026-04-06T10:10:00Z",
                    status="linked",
                ),
            )
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=1,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="",
                    scope_set="scope",
                    status="revoked",
                ),
            )
            append_audit_log_entry(
                str(db_path),
                AuditLogEntry(
                    event_type="oauth_failure",
                    created_at="2026-04-06T11:00:00Z",
                    actor_telegram_user_id=123,
                    target_telegram_user_id=123,
                    telegram_chat_id=456,
                    environment="sandbox",
                    outcome="session_expired",
                    details_json="La sessione OAuth è scaduta. Usa di nuovo /account collega.",
                ),
            )

            replies = process_message(
                text="/account reconnect",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Sessione OAuth scaduta", replies[0])
            self.assertIn("Usa di nuovo /account collega", replies[0])

    @patch.dict(
        "os.environ",
        {"EBAY_OAUTH_CONNECT_BASE_URL": "https://example.com/oauth/start"},
        clear=False,
    )
    def test_process_message_connect_includes_public_connect_url(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={456},
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=456,
                username="seller_user",
                display_name="Mario Rossi",
                chat_type="private",
            )

            replies = process_message(
                text="/account collega",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("https://example.com/oauth/start?state=", replies[0])
            self.assertIn("1. apri il link", replies[0])
            self.assertIn("/account reconnect", replies[0])

    def test_process_message_connect_reconnects_from_disconnected_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={456},
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=456,
                username="seller_user",
                display_name="Mario Rossi",
                chat_type="private",
            )
            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=123,
                    ebay_user_id="seller-ebay",
                    environment="production",
                    linked_at="2026-04-06T10:10:00Z",
                    status="disconnected",
                ),
            )

            replies = process_message(
                text="/account collega",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Collegamento account eBay", replies[0])
            self.assertIn("Stato account attuale: <code>disconnected</code>", replies[0])
            self.assertIn("seller-ebay", replies[0])

    def test_process_message_disconnect_revokes_local_account(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={456},
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=456,
                username="seller_user",
                display_name="Mario Rossi",
                chat_type="private",
            )
            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=123,
                    ebay_user_id="seller-ebay",
                    environment="sandbox",
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

            replies = process_message(
                text="/account scollega",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Utente eBay scollegato", replies[0])

            account_replies = process_message(
                text="/account",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )
            self.assertIn("Stato: <code>disconnected</code>", account_replies[0])
            self.assertIn("usa <code>/account collega</code>", account_replies[0])

    @patch("src.fiscalbay.services.account.load_tenant_config_from_storage")
    def test_process_message_disconnect_guides_manual_ebay_revocation(
        self,
        mock_load_tenant_config_from_storage,
    ) -> None:
        mock_load_tenant_config_from_storage.return_value = Config(
            client_id="cid",
            client_secret="secret",
            refresh_token="refresh-token",
            environment="production",
            scopes="scope",
        )
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids={456},
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=456,
                username="seller_user",
                display_name="Mario Rossi",
                chat_type="private",
            )
            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=123,
                    ebay_user_id="seller-ebay",
                    environment="production",
                    linked_at="2026-04-06T10:00:00Z",
                    status="linked",
                ),
            )
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=1,
                    refresh_token_encrypted="plain:tenant-refresh",
                    access_token="access-token",
                    scope_set="scope",
                    status="active",
                ),
            )

            replies = process_message(
                text="/account scollega",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            mock_load_tenant_config_from_storage.assert_called_once()
            self.assertIn("Revoca consenso eBay: <code>manuale</code>", replies[0])
            self.assertIn("Third-party app access", replies[0])
            self.assertIn("accesso al bot resta approvato", replies[0])

    def test_process_message_support_snapshot_for_approved_user(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="x",
                allowed_chat_ids={456},
                notify_chat_ids=set(),
                admin_user_id=999,
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )
            sync_runtime_contact(
                config,
                telegram_user_id=123,
                chat_id=456,
                username="seller_user",
                display_name="Mario Rossi",
                chat_type="private",
            )
            update_telegram_user_status(
                str(db_path),
                123,
                TELEGRAM_USER_STATUS_APPROVED,
                updated_at="2026-04-06T10:00:00Z",
            )
            upsert_linked_ebay_account(
                str(db_path),
                LinkedEbayAccount(
                    telegram_user_id=123,
                    ebay_user_id="seller-ebay",
                    environment="production",
                    linked_at="2026-04-06T10:10:00Z",
                    status="linked",
                ),
            )
            account = resolve_linked_ebay_account(str(db_path), 123, "production")
            assert account is not None and account.id is not None
            upsert_ebay_token_set(
                str(db_path),
                EbayTokenSet(
                    ebay_account_id=account.id,
                    refresh_token_encrypted="plain:tenant-refresh",
                    status="active",
                ),
            )
            save_tenant_runtime_state(
                str(db_path),
                123,
                BotRuntimeState(
                    last_check="2026-04-07T08:00:00Z",
                    memory=BotOperationalMemory(
                        last_fetch_end="2026-04-07T08:00:01Z",
                        last_fetch_count=1,
                        last_seen_order_id="order-1",
                    ),
                ),
            )

            replies = process_message(
                text="/support",
                chat_id=456,
                telegram_user_id=123,
                telegram_config=config,
                ebay_environment="production",
            )

            self.assertEqual(len(replies), 1)
            self.assertIn("Support Snapshot", replies[0])
            self.assertIn("seller-ebay", replies[0])
            self.assertIn("order-1", replies[0])
            self.assertIn("nessuna azione urgente", replies[0])


if __name__ == "__main__":
    unittest.main()
