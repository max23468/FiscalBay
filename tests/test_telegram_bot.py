import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfoNotFoundError

from src.fiscalbay import telegram_commands as telegram_commands_module
from src.fiscalbay.bot import (
    CALLBACK_HELP,
    CALLBACK_OTHER_ACTIONS,
    CALLBACK_REQUEST_ACCESS,
    CALLBACK_SETTINGS,
    CALLBACK_STATO,
    CALLBACK_TUTTI,
    CALLBACK_ULTIMI,
    TELEGRAM_CMD_MAX_DAYS,
    TelegramApiError,
    TelegramConfig,
    _handle_orders_command,
    _normalize_grouped_command,
    acquire_process_lock,
    build_contextual_menu_markup,
    build_help_text,
    build_main_menu_markup,
    build_other_actions_text,
    callback_command_from_data,
    chunk_message,
    ensure_long_polling,
    extract_callback_context,
    format_auto_notification,
    format_records,
    has_fiscal_identifier,
    options_for_command,
    parse_command,
    process_message,
    release_process_lock,
    send_message,
    sync_runtime_branding,
    update_state_with_records,
)
from src.fiscalbay.clients.telegram import sync_bot_branding
from src.fiscalbay.errors import ConfigurationError, EbayApiError
from src.fiscalbay.fiscal_export import FiscalExportReport
from src.fiscalbay.models import BotRuntimeState, OrderRecord, TelegramUser
from src.fiscalbay.storage.sqlite import load_kv_value
from src.fiscalbay.telegram_commands import (
    BOT_DISPLAY_NAME,
    BOT_TAGLINE,
    CALLBACK_ADMIN_MAINTENANCE,
    CALLBACK_ADMIN_USERS_PENDING,
    CALLBACK_ORDINI,
    CALLBACK_ORDINI_EXPORT,
    CALLBACK_ORDINI_PRIORITY,
    CALLBACK_ORDINI_REPORT,
    CALLBACK_ORDINI_REVIEW,
    build_telegram_branding_profile,
    format_access_request_status,
    format_access_required_status,
    format_admin_command_help,
    format_admin_dashboard,
    format_admin_history,
    format_admin_maintenance_overview,
    format_admin_scale_readiness,
    format_admin_security_report,
    format_admin_user_list,
    format_disconnect_status,
    format_fiscal_export_messages,
    format_leave_status,
    format_notifications_status,
    format_onboarding_guide,
    format_order_date,
    format_order_notification_summary,
    format_priority_records,
    format_reconnect_reason_hint,
    format_report_summary,
    format_review_records,
    format_settings_status,
    format_why_not_notified_status,
    is_admin_authorized,
    looks_like_order_id,
)


class TelegramBotTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmpdir.cleanup)
        self._tmp_path = Path(self._tmpdir.name)

    def _base_config(self) -> TelegramConfig:
        return TelegramConfig(
            token="token",
            allowed_chat_ids={456},
            notify_chat_ids=set(),
            state_path=str(self._tmp_path / "state.db"),
            retry_queue_path=str(self._tmp_path / "retry.db"),
        )

    def _order(
        self,
        order_id: str,
        *,
        buyer_username: str = "buyer",
        taxpayer_id: str = "",
        tax_identifier_type: str = "",
        issuing_country: str = "IT",
        buyer_email: str = "buyer@example.com",
    ) -> OrderRecord:
        return OrderRecord(
            orderId=order_id,
            creationDate="2026-04-05T20:00:00Z",
            buyerUsername=buyer_username,
            buyerEmail=buyer_email,
            taxpayerId=taxpayer_id,
            taxIdentifierType=tax_identifier_type,
            issuingCountry=issuing_country,
        )

    @staticmethod
    def _run_backoff(callback, label=None):  # type: ignore[no-untyped-def]
        del label
        return callback()

    def test_build_main_menu_markup_contains_inline_keyboard(self) -> None:
        markup = build_main_menu_markup()
        keyboard = markup.get("inline_keyboard")
        self.assertIsInstance(keyboard, list)
        self.assertEqual(
            keyboard,
            [
                [
                    {"text": "Collega eBay", "callback_data": "menu:connect"},
                    {"text": "Account", "callback_data": "menu:account"},
                ],
                [
                    {"text": "Ordini fiscali", "callback_data": CALLBACK_ULTIMI},
                    {"text": "Tutti ordini", "callback_data": CALLBACK_TUTTI},
                ],
                [
                    {"text": "Stato", "callback_data": CALLBACK_STATO},
                    {"text": "Altre azioni", "callback_data": CALLBACK_OTHER_ACTIONS},
                ],
            ],
        )
        all_callbacks = [button.get("callback_data") for row in keyboard for button in row]
        self.assertIn(CALLBACK_ULTIMI, all_callbacks)
        self.assertIn(CALLBACK_TUTTI, all_callbacks)
        self.assertIn(CALLBACK_STATO, all_callbacks)
        self.assertIn(CALLBACK_OTHER_ACTIONS, all_callbacks)

    def test_build_main_menu_markup_can_reflect_unlinked_state(self) -> None:
        markup = build_main_menu_markup(
            account_linked=False,
            reconnect_required=False,
            notifications_enabled=False,
        )
        all_callbacks = [
            button.get("callback_data")
            for row in markup.get("inline_keyboard", [])
            for button in row
        ]
        self.assertIn(CALLBACK_OTHER_ACTIONS, all_callbacks)
        self.assertNotIn("menu:disconnect", all_callbacks)

    def test_build_contextual_menu_markup_for_orders_focuses_order_actions(self) -> None:
        markup = build_contextual_menu_markup("/ordini fiscali 7 20")
        keyboard = markup.get("inline_keyboard")
        self.assertEqual(
            keyboard,
            [
                [
                    {"text": "Ordini fiscali", "callback_data": CALLBACK_ULTIMI},
                    {"text": "Tutti ordini", "callback_data": CALLBACK_TUTTI},
                ],
                [
                    {"text": "Da controllare", "callback_data": CALLBACK_ORDINI_REVIEW},
                    {"text": "Report", "callback_data": CALLBACK_ORDINI_REPORT},
                ],
                [
                    {"text": "Priorità", "callback_data": CALLBACK_ORDINI_PRIORITY},
                    {"text": "Export", "callback_data": CALLBACK_ORDINI_EXPORT},
                ],
                [{"text": "Account", "callback_data": "menu:account"}],
                [{"text": "Guida", "callback_data": CALLBACK_HELP}],
            ],
        )

    def test_build_contextual_menu_markup_for_account_reflects_state(self) -> None:
        markup = build_contextual_menu_markup(
            "/account",
            account_linked=True,
            reconnect_required=True,
            notifications_enabled=False,
        )
        keyboard = markup.get("inline_keyboard")
        self.assertEqual(
            keyboard[0][0], {"text": "Ricollega eBay", "callback_data": "menu:connect"}
        )
        self.assertEqual(keyboard[0][1], {"text": "Scollega", "callback_data": "menu:disconnect"})
        self.assertIn(
            {"text": "Attiva notifiche", "callback_data": "menu:notifications_on"}, keyboard[2]
        )

    def test_build_contextual_menu_markup_for_admin_uses_admin_actions(self) -> None:
        markup = build_contextual_menu_markup("/admin", is_admin=True)
        all_callbacks = [
            button.get("callback_data")
            for row in markup.get("inline_keyboard", [])
            for button in row
        ]
        self.assertIn(CALLBACK_ADMIN_USERS_PENDING, all_callbacks)
        self.assertIn(CALLBACK_ADMIN_MAINTENANCE, all_callbacks)
        self.assertNotIn("menu:connect", all_callbacks)

    def test_build_contextual_menu_markup_covers_settings_other_actions_and_status(self) -> None:
        settings_markup = build_contextual_menu_markup(
            "/settings",
            account_linked=True,
            notifications_enabled=False,
        )
        settings_callbacks = [
            button.get("callback_data")
            for row in settings_markup.get("inline_keyboard", [])
            for button in row
        ]
        self.assertIn("menu:notifications_on", settings_callbacks)
        self.assertIn("menu:account", settings_callbacks)

        other_actions_markup = build_contextual_menu_markup(
            "/altre_azioni",
            account_linked=True,
            notifications_enabled=True,
        )
        other_actions_callbacks = [
            button.get("callback_data")
            for row in other_actions_markup.get("inline_keyboard", [])
            for button in row
        ]
        self.assertIn("menu:disconnect", other_actions_callbacks)
        self.assertIn(CALLBACK_REQUEST_ACCESS, other_actions_callbacks)

        status_markup = build_contextual_menu_markup("/service_status")
        status_callbacks = [
            button.get("callback_data")
            for row in status_markup.get("inline_keyboard", [])
            for button in row
        ]
        self.assertIn("menu:account", status_callbacks)
        self.assertIn(CALLBACK_HELP, status_callbacks)

    def test_callback_command_from_data_maps_buttons(self) -> None:
        self.assertEqual(callback_command_from_data(CALLBACK_ORDINI), "/ordini")
        self.assertEqual(callback_command_from_data(CALLBACK_ULTIMI), "/ordini fiscali 7 20")
        self.assertEqual(callback_command_from_data(CALLBACK_TUTTI), "/ordini tutti 7 20")
        self.assertEqual(
            callback_command_from_data(CALLBACK_ORDINI_REVIEW),
            "/ordini controlla 7 20",
        )
        self.assertEqual(
            callback_command_from_data(CALLBACK_ORDINI_REPORT),
            "/ordini report 7 20",
        )
        self.assertEqual(
            callback_command_from_data(CALLBACK_ORDINI_PRIORITY),
            "/ordini priorita 7 20",
        )
        self.assertEqual(callback_command_from_data(CALLBACK_STATO), "/stato")
        self.assertEqual(callback_command_from_data(CALLBACK_SETTINGS), "/settings")
        self.assertEqual(
            callback_command_from_data("menu:notifications_on"),
            "/settings notifiche on",
        )
        self.assertEqual(
            callback_command_from_data("menu:notifications_off"),
            "/settings notifiche off",
        )
        self.assertEqual(
            callback_command_from_data(CALLBACK_ADMIN_USERS_PENDING), "/admin_users pending"
        )
        self.assertEqual(
            callback_command_from_data(CALLBACK_ADMIN_MAINTENANCE), "/admin manutenzione"
        )
        self.assertEqual(callback_command_from_data(CALLBACK_OTHER_ACTIONS), "/altre_azioni")
        self.assertEqual(callback_command_from_data(CALLBACK_REQUEST_ACCESS), "/request_access")
        self.assertEqual(callback_command_from_data("access:approve:321"), "/approve_user 321")
        self.assertEqual(callback_command_from_data("access:reject:321"), "/reject_user 321")
        self.assertEqual(callback_command_from_data(CALLBACK_HELP), "/help")
        self.assertIsNone(callback_command_from_data("menu:unknown"))

    def test_normalize_grouped_command_maps_secondary_aliases(self) -> None:
        cases = [
            ("/account", ["status", "ora"], ("/account", ["ora"])),
            ("/account", ["reconnect-status"], ("/reconnect_status", [])),
            ("/settings", ["dati"], ("/data_request", [])),
            ("/settings", ["delete", "subito"], ("/data_request", ["delete", "subito"])),
            ("/settings", ["privacy"], ("/policy", [])),
            ("/stato", ["servizio"], ("/service_status", [])),
            ("/admin", ["service"], ("/service_mode", [])),
            ("/admin", ["support", "123"], ("/admin", ["support", "123"])),
        ]

        for command, args, expected in cases:
            with self.subTest(command=command, args=args):
                self.assertEqual(_normalize_grouped_command(command, args), expected)

    def test_simple_telegram_commands_process_message_core_paths(self) -> None:
        config = self._base_config()

        self.assertEqual(
            telegram_commands_module.process_message(
                "/ping",
                999,
                config,
                "production",
                load_state_fn=lambda _path: BotRuntimeState(),
                load_retry_queue_fn=lambda _path: [],
                fetch_records_for_environment_fn=lambda _env, _options: [],
                request_with_backoff_fn=self._run_backoff,
            ),
            ["Chat non autorizzata per questo bot."],
        )

        status_reply = telegram_commands_module.process_message(
            "/stato",
            456,
            config,
            "production",
            load_state_fn=lambda _path: BotRuntimeState(last_check="2026-04-05T20:00:00Z"),
            load_retry_queue_fn=lambda _path: [object()],
            fetch_records_for_environment_fn=lambda _env, _options: [],
            request_with_backoff_fn=self._run_backoff,
        )
        self.assertIn("Stato del Bot", status_reply[0])
        self.assertIn("2026-04-05T20:00:00Z", status_reply[0])

        self.assertEqual(
            telegram_commands_module.process_message(
                "/unknown",
                456,
                config,
                "production",
                load_state_fn=lambda _path: BotRuntimeState(),
                load_retry_queue_fn=lambda _path: [],
                fetch_records_for_environment_fn=lambda _env, _options: [],
                request_with_backoff_fn=self._run_backoff,
            ),
            ["Comando non riconosciuto. Usa /help per vedere i comandi disponibili."],
        )

        fetch_reply = telegram_commands_module.process_message(
            "/tutti 7 5",
            456,
            config,
            "sandbox",
            load_state_fn=lambda _path: BotRuntimeState(),
            load_retry_queue_fn=lambda _path: [],
            fetch_records_for_environment_fn=lambda _env, _options: [
                self._order("12-34567-89012", buyer_username="buyer-1")
            ],
            request_with_backoff_fn=self._run_backoff,
        )
        self.assertIn("12-34567-89012", fetch_reply[0])

    @patch("src.fiscalbay.bot.request_with_backoff")
    def test_handle_orders_command_help_lists_and_summary_paths(self, mock_backoff) -> None:
        config = self._base_config()
        mock_backoff.side_effect = self._run_backoff

        help_reply = _handle_orders_command(
            "/ordini",
            [],
            telegram_config=config,
            chat_id=456,
            resolved_environment="sandbox",
            resolved_telegram_user_id=123,
            load_state_fn=lambda _path: BotRuntimeState(),
            fetch_records_for_environment_fn=lambda _env, _options: [],
        )
        self.assertIsNotNone(help_reply)
        self.assertIn("Usa <code>/ordini</code>", help_reply[0])

        fiscali_reply = _handle_orders_command(
            "/ordini",
            ["fiscali", "7", "5"],
            telegram_config=config,
            chat_id=456,
            resolved_environment="sandbox",
            resolved_telegram_user_id=123,
            load_state_fn=lambda _path: BotRuntimeState(),
            fetch_records_for_environment_fn=lambda _env, _options: [
                self._order(
                    "12-34567-89012",
                    taxpayer_id="RSSMRA80A01H501U",
                    tax_identifier_type="CODICE_FISCALE",
                )
            ],
        )
        self.assertIn("12-34567-89012", fiscali_reply[0])

        tutti_reply = _handle_orders_command(
            "/ordini",
            ["tutti", "7", "5"],
            telegram_config=config,
            chat_id=456,
            resolved_environment="sandbox",
            resolved_telegram_user_id=123,
            load_state_fn=lambda _path: BotRuntimeState(),
            fetch_records_for_environment_fn=lambda _env, _options: [
                self._order("12-34567-89013", buyer_username="buyer-all")
            ],
        )
        self.assertIn("12-34567-89013", tutti_reply[0])

        search_reply = _handle_orders_command(
            "/ordini",
            ["cerca", "buyer-vat", "7", "20"],
            telegram_config=config,
            chat_id=456,
            resolved_environment="sandbox",
            resolved_telegram_user_id=123,
            load_state_fn=lambda _path: BotRuntimeState(),
            fetch_records_for_environment_fn=lambda _env, _options: [
                self._order("plain-order-1", buyer_username="other"),
                self._order(
                    "plain-order-2",
                    buyer_username="buyer-vat",
                    taxpayer_id="IT12345678901",
                    tax_identifier_type="VAT_NUMBER",
                ),
            ],
        )
        self.assertIn("buyer-vat", search_reply[0])
        self.assertNotIn("plain-order-1", search_reply[0])

        review_reply = _handle_orders_command(
            "/ordini",
            ["controlla", "7", "20"],
            telegram_config=config,
            chat_id=456,
            resolved_environment="sandbox",
            resolved_telegram_user_id=123,
            load_state_fn=lambda _path: BotRuntimeState(),
            fetch_records_for_environment_fn=lambda _env, _options: [
                self._order("order-missing"),
                self._order(
                    "order-ok",
                    taxpayer_id="IT12345678901",
                    tax_identifier_type="VAT_NUMBER",
                ),
            ],
        )
        self.assertIn("order-missing", review_reply[0])
        self.assertNotIn("order-ok", review_reply[0])

        report_reply = _handle_orders_command(
            "/ordini",
            ["report", "7", "20"],
            telegram_config=config,
            chat_id=456,
            resolved_environment="sandbox",
            resolved_telegram_user_id=123,
            load_state_fn=lambda _path: BotRuntimeState(),
            fetch_records_for_environment_fn=lambda _env, _options: [
                self._order("order-missing"),
                self._order(
                    "order-vat",
                    taxpayer_id="IT12345678901",
                    tax_identifier_type="VAT_NUMBER",
                    issuing_country="DE",
                ),
            ],
        )
        self.assertIn("Mini Report Fiscale", report_reply[0])
        self.assertIn("Senza dato fiscale: <code>1</code>", report_reply[0])

        priority_reply = _handle_orders_command(
            "/ordini",
            ["priorita", "7", "20"],
            telegram_config=config,
            chat_id=456,
            resolved_environment="sandbox",
            resolved_telegram_user_id=123,
            load_state_fn=lambda _path: BotRuntimeState(),
            fetch_records_for_environment_fn=lambda _env, _options: [
                self._order(
                    "order-cf",
                    taxpayer_id="RSSMRA80A01H501U",
                    tax_identifier_type="CODICE_FISCALE",
                ),
                self._order("order-review"),
                self._order(
                    "order-vat",
                    taxpayer_id="IT12345678901",
                    tax_identifier_type="VAT_NUMBER",
                ),
            ],
        )
        self.assertIn("Ordini Prioritari", priority_reply[0])
        self.assertLess(
            priority_reply[0].index("order-review"),
            priority_reply[0].index("order-vat"),
        )

        export_reply = _handle_orders_command(
            "/ordini",
            ["export", "7", "20"],
            telegram_config=config,
            chat_id=456,
            resolved_environment="sandbox",
            resolved_telegram_user_id=123,
            load_state_fn=lambda _path: BotRuntimeState(),
            fetch_records_for_environment_fn=lambda _env, _options: [
                self._order("order-export-1"),
                self._order(
                    "order-export-2",
                    taxpayer_id="IT12345678901",
                    tax_identifier_type="VAT_NUMBER",
                ),
            ],
        )
        self.assertEqual(len(export_reply), 2)
        self.assertIn("Export Fiscale Venditore", export_reply[0])
        self.assertIn("CSV export", export_reply[1])

        unknown_reply = _handle_orders_command(
            "/ordini",
            ["boh"],
            telegram_config=config,
            chat_id=456,
            resolved_environment="sandbox",
            resolved_telegram_user_id=123,
            load_state_fn=lambda _path: BotRuntimeState(),
            fetch_records_for_environment_fn=lambda _env, _options: [],
        )
        self.assertIn("Ordini", unknown_reply[0])

    def test_handle_orders_command_covers_usage_and_error_paths(self) -> None:
        config = self._base_config()

        self.assertEqual(
            _handle_orders_command(
                "/ordini",
                ["cerca"],
                telegram_config=config,
                chat_id=456,
                resolved_environment="sandbox",
                resolved_telegram_user_id=123,
                load_state_fn=lambda _path: BotRuntimeState(),
                fetch_records_for_environment_fn=lambda _env, _options: [],
            ),
            ["Uso corretto: <code>/ordini cerca &lt;order_id|testo&gt; [giorni] [max]</code>"],
        )

        invalid_search = _handle_orders_command(
            "/ordini",
            ["cerca", "buyer", "nope"],
            telegram_config=config,
            chat_id=456,
            resolved_environment="sandbox",
            resolved_telegram_user_id=123,
            load_state_fn=lambda _path: BotRuntimeState(),
            fetch_records_for_environment_fn=lambda _env, _options: [],
        )
        self.assertIn("Il numero di giorni deve essere un intero", invalid_search[0])

        with patch(
            "src.fiscalbay.bot.request_with_backoff",
            side_effect=lambda callback, label=None: (_ for _ in ()).throw(
                ConfigurationError("config mancante")
            ),
        ):
            for args in (
                ["fiscali", "7", "5"],
                ["tutti", "7", "5"],
                ["cerca", "buyer"],
                ["controlla", "7", "5"],
                ["report", "7", "5"],
                ["priorita", "7", "5"],
                ["export", "7", "5"],
            ):
                with self.subTest(args=args):
                    reply = _handle_orders_command(
                        "/ordini",
                        args,
                        telegram_config=config,
                        chat_id=456,
                        resolved_environment="sandbox",
                        resolved_telegram_user_id=123,
                        load_state_fn=lambda _path: BotRuntimeState(),
                        fetch_records_for_environment_fn=lambda _env, _options: [],
                    )
                    self.assertEqual(reply, ["⚠️ config mancante"])

        with patch(
            "src.fiscalbay.bot.request_with_backoff",
            side_effect=lambda callback, label=None: (_ for _ in ()).throw(
                EbayApiError("Invalid Order Id", status_code=400)
            ),
        ):
            search_error = _handle_orders_command(
                "/ordini",
                ["cerca", "12-34567-89012"],
                telegram_config=config,
                chat_id=456,
                resolved_environment="sandbox",
                resolved_telegram_user_id=123,
                load_state_fn=lambda _path: BotRuntimeState(),
                fetch_records_for_environment_fn=lambda _env, _options: [],
            )
            self.assertIn("eBay ha rifiutato questo orderId", search_error[0])

            explain_error = _handle_orders_command(
                "/ordini",
                ["spiega", "12-34567-89012"],
                telegram_config=config,
                chat_id=456,
                resolved_environment="sandbox",
                resolved_telegram_user_id=123,
                load_state_fn=lambda _path: BotRuntimeState(),
                fetch_records_for_environment_fn=lambda _env, _options: [],
            )
            self.assertIn("eBay ha rifiutato questo orderId", explain_error[0])

        self.assertEqual(
            _handle_orders_command(
                "/ordini",
                ["spiega"],
                telegram_config=config,
                chat_id=456,
                resolved_environment="sandbox",
                resolved_telegram_user_id=123,
                load_state_fn=lambda _path: BotRuntimeState(),
                fetch_records_for_environment_fn=lambda _env, _options: [],
            ),
            ["Uso corretto: <code>/ordini spiega &lt;order_id&gt;</code>"],
        )

    @patch("src.fiscalbay.bot.request_with_backoff")
    def test_handle_orders_command_detail_and_alias_success_paths(self, mock_backoff) -> None:
        config = self._base_config()
        mock_backoff.side_effect = self._run_backoff

        no_match_reply = _handle_orders_command(
            "/ordini",
            ["cerca", "12-34567-89012"],
            telegram_config=config,
            chat_id=456,
            resolved_environment="sandbox",
            resolved_telegram_user_id=123,
            load_state_fn=lambda _path: BotRuntimeState(),
            fetch_records_for_environment_fn=lambda _env, _options: [],
        )
        self.assertEqual(no_match_reply, ["🔎 Nessun ordine trovato nella selezione richiesta."])

        detail_reply = _handle_orders_command(
            "/ordini",
            ["cerca", "12-34567-89012"],
            telegram_config=config,
            chat_id=456,
            resolved_environment="sandbox",
            resolved_telegram_user_id=123,
            load_state_fn=lambda _path: BotRuntimeState(),
            fetch_records_for_environment_fn=lambda _env, _options: [
                self._order(
                    "12-34567-89012",
                    taxpayer_id="IT12345678901",
                    tax_identifier_type="VAT_NUMBER",
                )
            ],
        )
        self.assertIn("Notificabilità", detail_reply[0])
        self.assertIn("12-34567-89012", detail_reply[0])

        explain_not_found = _handle_orders_command(
            "/ordini",
            ["spiega", "12-34567-89012"],
            telegram_config=config,
            chat_id=456,
            resolved_environment="sandbox",
            resolved_telegram_user_id=123,
            load_state_fn=lambda _path: BotRuntimeState(),
            fetch_records_for_environment_fn=lambda _env, _options: [],
        )
        self.assertIn("order_not_found", explain_not_found[0])

        explain_reply = _handle_orders_command(
            "/ordini",
            ["spiega", "12-34567-89012"],
            telegram_config=config,
            chat_id=456,
            resolved_environment="sandbox",
            resolved_telegram_user_id=123,
            load_state_fn=lambda _path: BotRuntimeState(),
            fetch_records_for_environment_fn=lambda _env, _options: [
                self._order(
                    "12-34567-89012",
                    taxpayer_id="IT12345678901",
                    tax_identifier_type="VAT_NUMBER",
                )
            ],
        )
        self.assertIn("Why Not Notified", explain_reply[0])
        self.assertIn("would_notify", explain_reply[0])

        why_not_reply = _handle_orders_command(
            "/why_not_notified",
            ["12-34567-89012"],
            telegram_config=config,
            chat_id=456,
            resolved_environment="sandbox",
            resolved_telegram_user_id=123,
            load_state_fn=lambda _path: BotRuntimeState(),
            fetch_records_for_environment_fn=lambda _env, _options: [
                self._order(
                    "12-34567-89012",
                    taxpayer_id="IT12345678901",
                    tax_identifier_type="VAT_NUMBER",
                )
            ],
        )
        self.assertIn("Why Not Notified", why_not_reply[0])

        review_alias = _handle_orders_command(
            "/review_orders",
            ["7", "20"],
            telegram_config=config,
            chat_id=456,
            resolved_environment="sandbox",
            resolved_telegram_user_id=123,
            load_state_fn=lambda _path: BotRuntimeState(),
            fetch_records_for_environment_fn=lambda _env, _options: [
                self._order("order-missing"),
                self._order(
                    "order-ok",
                    taxpayer_id="IT12345678901",
                    tax_identifier_type="VAT_NUMBER",
                ),
            ],
        )
        self.assertIn("order-missing", review_alias[0])

        report_alias = _handle_orders_command(
            "/report_summary",
            ["7", "20"],
            telegram_config=config,
            chat_id=456,
            resolved_environment="sandbox",
            resolved_telegram_user_id=123,
            load_state_fn=lambda _path: BotRuntimeState(),
            fetch_records_for_environment_fn=lambda _env, _options: [
                self._order("order-missing"),
                self._order(
                    "order-vat",
                    taxpayer_id="IT12345678901",
                    tax_identifier_type="VAT_NUMBER",
                ),
            ],
        )
        self.assertIn("Mini Report Fiscale", report_alias[0])

        priority_alias = _handle_orders_command(
            "/priority_orders",
            ["7", "20"],
            telegram_config=config,
            chat_id=456,
            resolved_environment="sandbox",
            resolved_telegram_user_id=123,
            load_state_fn=lambda _path: BotRuntimeState(),
            fetch_records_for_environment_fn=lambda _env, _options: [
                self._order(
                    "order-cf",
                    taxpayer_id="RSSMRA80A01H501U",
                    tax_identifier_type="CODICE_FISCALE",
                ),
                self._order("order-review"),
            ],
        )
        self.assertIn("Ordini Prioritari", priority_alias[0])

        self.assertEqual(
            _handle_orders_command(
                "/ordine",
                [],
                telegram_config=config,
                chat_id=456,
                resolved_environment="sandbox",
                resolved_telegram_user_id=123,
                load_state_fn=lambda _path: BotRuntimeState(),
                fetch_records_for_environment_fn=lambda _env, _options: [],
            ),
            ["Uso corretto: <code>/ordine &lt;order_id&gt;</code>"],
        )

        detail_alias = _handle_orders_command(
            "/ordine",
            ["12-34567-89012"],
            telegram_config=config,
            chat_id=456,
            resolved_environment="sandbox",
            resolved_telegram_user_id=123,
            load_state_fn=lambda _path: BotRuntimeState(),
            fetch_records_for_environment_fn=lambda _env, _options: [
                self._order(
                    "12-34567-89012",
                    taxpayer_id="RSSMRA80A01H501U",
                    tax_identifier_type="CODICE_FISCALE",
                )
            ],
        )
        self.assertIn("Notificabilità", detail_alias[0])

    def test_format_admin_user_list_renders_telegram_user_rows(self) -> None:
        content = format_admin_user_list(
            [
                TelegramUser(
                    telegram_user_id=123,
                    telegram_chat_id=456,
                    username="seller_user",
                    display_name="Mario Rossi",
                    status="approved",
                )
            ]
        )

        self.assertIn("<code>123</code>", content)
        self.assertIn("status=<code>approved</code>", content)
        self.assertIn("user=<code>seller_user</code>", content)

    def test_format_access_required_status_covers_admin_pending_blocked_and_new(self) -> None:
        self.assertIn("Admin del bot", format_access_required_status("approved", is_admin=True))
        self.assertIn("Accesso in attesa", format_access_required_status("pending"))
        self.assertIn("Accesso non approvato", format_access_required_status("blocked"))
        self.assertIn("Accesso richiesto", format_access_required_status("new"))

    def test_format_access_request_status_covers_all_outcomes(self) -> None:
        self.assertIn("bloccato", format_access_request_status(blocked=True))
        self.assertIn("già in attesa", format_access_request_status(already_pending=True))
        self.assertIn("admin è stato notificato", format_access_request_status(admin_notified=True))
        self.assertIn("Richiesta registrata", format_access_request_status())

    def test_format_onboarding_guide_covers_full_user_journey(self) -> None:
        self.assertIn(
            "Onboarding admin",
            format_onboarding_guide(user_status="approved", is_admin=True),
        )
        self.assertIn(
            "Accesso non approvato",
            format_onboarding_guide(user_status="blocked", account_status={}),
        )
        self.assertIn(
            "Richiesta in revisione",
            format_onboarding_guide(user_status="pending", account_status={}),
        )
        self.assertIn(
            "Invito ricevuto",
            format_onboarding_guide(user_status="new", account_status={}),
        )
        self.assertIn(
            "Reconnect eBay",
            format_onboarding_guide(
                user_status="approved",
                account_status={
                    "account_status": "revoked",
                    "token_status": "expired",
                },
            ),
        )

    def test_format_misc_renderers_cover_remaining_edge_paths(self) -> None:
        self.assertIn("cruscotto operativo", format_admin_command_help())
        self.assertIn(
            "Link di collegamento non più valido",
            format_reconnect_reason_hint(
                {
                    "latest_reconnect_outcome": "session_unavailable",
                    "latest_reconnect_reason": "sessione chiusa",
                }
            ),
        )
        self.assertIn(
            "Autorizzazione annullata",
            format_reconnect_reason_hint({"latest_reconnect_outcome": "user_cancelled"}),
        )
        self.assertIn(
            "Problema di configurazione o salvataggio lato servizio",
            format_reconnect_reason_hint(
                {"latest_reconnect_outcome": "service_configuration_error"}
            ),
        )

        why_not = format_why_not_notified_status(
            {
                "order_id": "12-34567-89012",
                "environment": "sandbox",
                "status": "already_notified_fingerprint",
                "delivery_status": "chat_notifications_disabled",
                "headline": "Gia visto",
            }
        )
        self.assertIn("collide con una fingerprint", why_not)
        self.assertIn("/ordini cerca 12-34567-89012", why_not)

        why_not_delivery = format_why_not_notified_status(
            {
                "order_id": "12-34567-89012",
                "environment": "sandbox",
                "status": "would_notify",
                "delivery_status": "chat_notifications_disabled",
                "headline": "Recapito fermo",
            }
        )
        self.assertIn("/settings notifiche on", why_not_delivery)

        summary = format_order_notification_summary(
            {
                "status": "missing_order_id",
                "delivery_status": "chat_not_registered",
            }
        )
        self.assertIn("Manca un identificativo ordine stabile", summary)

        self.assertIn(
            "Nessun account eBay collegato",
            format_disconnect_status({"disconnected": False}),
        )
        self.assertIn(
            "non verificabile",
            format_disconnect_status(
                {
                    "disconnected": True,
                    "ebay_user_id": "seller",
                    "environment": "sandbox",
                    "remote_revocation_status": "missing_token",
                }
            ),
        )
        self.assertIn(
            "saltata",
            format_leave_status(
                {
                    "account_was_linked": True,
                    "ebay_user_id": "seller",
                    "environment": "sandbox",
                    "remote_revocation_status": "skipped",
                }
            ),
        )

        self.assertIn(
            "/account collega",
            format_notifications_status(
                {
                    "enabled": False,
                    "tenant_scope": "tenant:123",
                    "chat_id": 456,
                    "environment": "sandbox",
                    "account_linked": False,
                }
            ),
        )
        self.assertIn("Nessun ordine recente", format_review_records([])[0])
        self.assertIn("Nessun ordine disponibile", format_priority_records([])[0])

        unknown_identifier = self._order(
            "unknown-id",
            taxpayer_id="ABC123",
            tax_identifier_type="CUSTOM_ID",
            issuing_country="FR",
        )
        self.assertIn(
            "Con CF: <code>1</code>",
            format_report_summary([unknown_identifier], days=7, max_results=20),
        )
        self.assertIn(
            "motivo=<code>id_fiscale_presente</code>",
            format_priority_records([unknown_identifier])[0],
        )

        settings_admin = format_settings_status(
            {
                "tenant_scope": "tenant:123",
                "environment": "sandbox",
                "notifications_enabled": False,
                "account_linked": False,
                "user_status": "admin",
                "latest_session_status": "ready",
            }
        )
        self.assertIn("Accesso bot: <code>admin</code>", settings_admin)
        self.assertIn("Ultima sessione connect", settings_admin)

        settings_blocked = format_settings_status(
            {
                "tenant_scope": "tenant:123",
                "environment": "sandbox",
                "notifications_enabled": True,
                "account_linked": True,
                "user_status": "blocked",
                "session_ready": True,
                "latest_session_expires_at": "2099-01-01T00:00:00Z",
            }
        )
        self.assertIn("Accesso bot: <code>bloccato</code>", settings_blocked)
        self.assertIn("Sessione connect pronta", settings_blocked)

    def test_format_fiscal_export_messages_splits_large_csv(self) -> None:
        records = tuple(
            self._order(
                f"12-34567-{89000 + idx}",
                taxpayer_id="IT12345678901",
                tax_identifier_type="VAT_NUMBER",
            )
            for idx in range(80)
        )
        report = FiscalExportReport(
            generated_at="2026-04-05T20:00:00Z",
            period_start="2026-04-01T00:00:00Z",
            period_end="2026-04-05T20:00:00Z",
            records=records,
        )

        messages = format_fiscal_export_messages(report)

        self.assertGreater(len(messages), 2)
        self.assertIn("parte <code>2</code>", messages[2])
        self.assertIn(
            "Collega eBay",
            format_onboarding_guide(
                user_status="approved",
                account_status={"account_status": "unlinked"},
            ),
        )
        self.assertIn(
            "Accesso bot approvato e account eBay collegato",
            format_onboarding_guide(
                user_status="approved",
                account_status={
                    "account_status": "linked",
                    "token_status": "active",
                    "ebay_user_id": "seller-ebay",
                    "environment": "sandbox",
                },
            ),
        )

    def test_extract_callback_context_reads_callback_query(self) -> None:
        update = {
            "callback_query": {
                "id": "cb-1",
                "data": CALLBACK_STATO,
                "message": {
                    "chat": {"id": 123},
                    "message_thread_id": 9,
                },
            }
        }
        callback_id, chat_id, data, thread_id = extract_callback_context(update)
        self.assertEqual(callback_id, "cb-1")
        self.assertEqual(chat_id, 123)
        self.assertEqual(data, CALLBACK_STATO)
        self.assertEqual(thread_id, 9)

    def test_is_admin_authorized_requires_configured_admin(self) -> None:
        self.assertFalse(
            is_admin_authorized(
                123,
                123,
                TelegramConfig(token="x", allowed_chat_ids={123}, notify_chat_ids=set()),
            )
        )
        self.assertTrue(
            is_admin_authorized(
                123,
                123,
                TelegramConfig(
                    token="x",
                    allowed_chat_ids={123},
                    notify_chat_ids=set(),
                    admin_user_id=123,
                ),
            )
        )

    def test_parse_command_strips_bot_suffix(self) -> None:
        command, args = parse_command("/ultimi@mybot 7 5")
        self.assertEqual(command, "/ultimi")
        self.assertEqual(args, ["7", "5"])

    def test_options_for_command_ordine(self) -> None:
        options = options_for_command("/ordine", ["12-34567-89012"])
        self.assertEqual(options.order_ids, ["12-34567-89012"])
        self.assertFalse(options.only_found)
        self.assertTrue(options.include_details)

    def test_options_for_command_tutti_uses_summary_mode(self) -> None:
        options = options_for_command("/tutti", ["7", "20"])
        self.assertFalse(options.only_found)
        self.assertFalse(options.include_details)

    def test_options_for_command_rejects_days_out_of_range(self) -> None:
        with self.assertRaises(TelegramApiError):
            options_for_command("/ultimi", [str(TELEGRAM_CMD_MAX_DAYS + 1), "10"])

    def test_options_for_command_rejects_max_results_out_of_range(self) -> None:
        with self.assertRaises(TelegramApiError):
            options_for_command("/tutti", ["7", "9999"])

    def test_options_for_command_rejects_non_integer_days(self) -> None:
        with self.assertRaises(TelegramApiError):
            options_for_command("/ultimi", ["foo"])

    def test_chunk_message_splits_long_payload(self) -> None:
        chunks = chunk_message(("a" * 2000) + "\n" + ("b" * 2000))
        self.assertEqual(len(chunks), 2)

    def test_format_records_empty_only_found(self) -> None:
        content = format_records([], only_found=True)[0]
        self.assertIn("Nessun ordine con identificativo fiscale", content)

    def test_build_help_text_mentions_commands(self) -> None:
        text = build_help_text()
        self.assertIn("pulsanti rapidi", text)
        self.assertIn("Comandi principali", text)
        self.assertIn("Guide dettagliate", text)
        self.assertIn("/altre_azioni", text)
        self.assertIn("/ordini fiscali", text)
        self.assertIn("/settings", text)
        self.assertIn("/settings notifiche on", text)
        self.assertIn("/request_access", text)
        self.assertNotIn("/ping", text)
        self.assertNotIn("/ordini report", text)
        self.assertNotIn("/admin_users", text)
        self.assertIn(BOT_DISPLAY_NAME, text)

    def test_build_other_actions_text_collects_secondary_commands(self) -> None:
        text = build_other_actions_text()
        self.assertIn("Altre azioni", text)
        self.assertIn("/help", text)
        self.assertIn("/request_access", text)
        self.assertIn("/settings notifiche on", text)
        self.assertIn("/settings dati", text)
        self.assertNotIn("/admin_users", text)

        admin_text = build_other_actions_text(is_admin=True)
        self.assertIn("/admin_users", admin_text)

    def test_build_help_text_can_include_admin_shortcuts(self) -> None:
        text = build_help_text(is_admin=True)
        self.assertIn("Area admin", text)
        self.assertIn("/admin_users", text)
        self.assertIn("/admin help", text)
        self.assertIn("/ping", text)
        self.assertNotIn("/approve_user", text)

    def test_build_telegram_branding_profile_contains_expected_fields(self) -> None:
        profile = build_telegram_branding_profile()
        self.assertEqual(profile["name"], BOT_DISPLAY_NAME)
        self.assertEqual(profile["short_description"], BOT_TAGLINE)
        commands = profile["commands"]
        self.assertIsInstance(commands, list)
        self.assertEqual(len(commands), 4)
        self.assertEqual(commands[0]["command"], "stato")
        self.assertEqual(commands[-1]["command"], "altre_azioni")
        self.assertNotIn("help", {command["command"] for command in commands})
        self.assertNotIn("settings", {command["command"] for command in commands})
        self.assertNotIn("request_access", {command["command"] for command in commands})
        self.assertNotIn("ping", {command["command"] for command in commands})

    def test_admin_dashboard_includes_release_metadata(self) -> None:
        text = format_admin_dashboard(
            {
                "service_mode": "normal",
                "release": {
                    "package_version": "1.1.0",
                    "git_tag": "v1.1.0",
                    "git_latest_tag": "v1.1.0",
                    "git_short_commit": "abc1234",
                    "git_branch": "main",
                    "git_dirty": False,
                    "release_status": "tagged_clean",
                },
                "product_metrics": {},
                "metrics": {},
                "queue": {},
                "alerts": [],
                "recent_activity": [{"event_type": "data_request", "count": 2}],
            }
        )

        self.assertIn("Release", text)
        self.assertIn("1.1.0", text)
        self.assertIn("tagged_clean", text)
        self.assertIn("abc1234", text)
        self.assertIn("Attività 24h", text)
        self.assertIn("data_request", text)

    def test_format_admin_history_renders_compact_audit_rows(self) -> None:
        text = format_admin_history(
            [
                {
                    "created_at": "2026-04-28T10:00:00Z",
                    "event_type": "data_request",
                    "outcome": "delete_requested",
                    "actor_telegram_user_id": 999,
                    "target_telegram_user_id": 999,
                    "detail": "admin_notified=True account_status=linked",
                }
            ],
            target_user_id=999,
            limit=5,
        )

        self.assertIn("Storico operativo", text)
        self.assertIn("Filtro tenant: <code>999</code>", text)
        self.assertIn("data_request", text)
        self.assertIn("delete_requested", text)
        self.assertIn("admin_notified=True", text)

    def test_format_admin_security_report_redacts_secret_values(self) -> None:
        text = format_admin_security_report(
            {
                "status": "fail",
                "alerts": ["required_env_missing"],
                "warnings": ["backup_missing_or_stale"],
                "env_file": {"mode": "644", "expected_mode": "600"},
                "state_db": {"mode": "660", "expected_mode": "600_or_660"},
                "required_env": [
                    {"name": "TELEGRAM_BOT_TOKEN", "present": True},
                    {"name": "EBAY_TENANT_TOKEN_KEY", "present": False},
                ],
                "recommended_env": [{"name": "EBAY_OAUTH_RUNAME", "present": True}],
                "plaintext_tenant_tokens_enabled": False,
                "telegram_allow_all": True,
                "admin_configured": True,
                "public_service_model": "approved_public_small",
                "backup": {"age_hours": None, "max_age_hours": 36},
                "restore_drill": {"age_hours": 12, "max_age_hours": 192},
            }
        )

        self.assertIn("Security operations", text)
        self.assertIn("required_env_missing", text)
        self.assertIn("TELEGRAM_BOT_TOKEN", text)
        self.assertIn("EBAY_TENANT_TOKEN_KEY", text)
        self.assertIn("fiscalbay-security-check", text)

    def test_format_admin_scale_readiness_renders_triggers_and_plan(self) -> None:
        text = format_admin_scale_readiness(
            {
                "status": "migration_recommended",
                "summary": "Soglie vicine: prepara piano Postgres.",
                "signals": ["tenant_snapshot_stale"],
                "triggers": [
                    {
                        "name": "active_token_sets",
                        "current": 20,
                        "limit": 25,
                        "usage_percent": 80,
                        "level": "recommend",
                    }
                ],
                "next_actions": ["preparare prova di migrazione su copia offline"],
                "migration_plan": ["freeze temporaneo", "backup completo", "provisioning Postgres"],
            }
        )

        self.assertIn("Scale readiness", text)
        self.assertIn("migration_recommended", text)
        self.assertIn("active_token_sets", text)
        self.assertIn("tenant_snapshot_stale", text)
        self.assertIn("fiscalbay-scale-check", text)

    def test_admin_maintenance_overview_includes_release_metadata(self) -> None:
        text = format_admin_maintenance_overview(
            {
                "service_mode": "normal",
                "dashboard": {
                    "release": {
                        "package_version": "1.1.0",
                        "git_tag": "v1.1.0",
                        "git_latest_tag": "v1.1.0",
                        "git_short_commit": "abc1234",
                        "git_commits_since_latest_tag": 0,
                        "release_status": "tagged_clean",
                    },
                    "metrics": {},
                },
                "queue": {},
                "oauth_sessions": {},
                "retention": {},
                "queue_samples": [],
            }
        )

        self.assertIn("Release", text)
        self.assertIn("Latest tag", text)
        self.assertIn("abc1234", text)

    @patch("src.fiscalbay.bot.fetch_records")
    @patch("src.fiscalbay.bot.load_config")
    def test_process_message_for_other_actions(self, mock_load_config, mock_fetch_records) -> None:
        replies = process_message(
            text="/altre_azioni",
            chat_id=1,
            telegram_config=TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids=set(),
            ),
            ebay_environment="production",
        )
        self.assertEqual(len(replies), 1)
        self.assertIn("/settings", replies[0])
        self.assertIn("/request_access", replies[0])
        mock_load_config.assert_not_called()
        mock_fetch_records.assert_not_called()

    @patch("src.fiscalbay.bot.fetch_records")
    @patch("src.fiscalbay.bot.load_config")
    def test_process_message_for_help(self, mock_load_config, mock_fetch_records) -> None:
        replies = process_message(
            text="/help",
            chat_id=1,
            telegram_config=TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids=set(),
            ),
            ebay_environment="production",
        )
        self.assertEqual(len(replies), 1)
        self.assertIn("Benvenuto in FiscalBay", replies[0])
        mock_load_config.assert_not_called()
        mock_fetch_records.assert_not_called()

    def test_process_message_ping(self) -> None:
        replies = process_message(
            text="/ping",
            chat_id=1,
            telegram_config=TelegramConfig(
                token="x",
                allowed_chat_ids={1, 123, 456, 573159993},
                notify_chat_ids=set(),
            ),
            ebay_environment="production",
        )
        self.assertEqual(replies, ["pong ✅"])

    def test_update_state_with_records_tracks_ids(self) -> None:
        state = {"notified_order_ids": ["1"], "last_check": None}
        updated = update_state_with_records(
            state,
            [{"orderId": "2"}, {"orderId": "1"}],
            checked_at="2026-04-03T20:00:00Z",
        )
        self.assertEqual(updated["notified_order_ids"], ["1", "2"])
        self.assertEqual(updated["last_check"], "2026-04-03T20:00:00Z")

    def test_format_auto_notification_mentions_new_order(self) -> None:
        text = format_auto_notification(
            {
                "orderId": "12-345",
                "creationDate": "2026-04-03T10:00:00Z",
                "buyerUsername": "buyer",
                "buyerName": "Mario Rossi",
                "buyerEmail": "mario@example.com",
                "taxpayerId": "rssmra80a01h501u",
                "taxIdentifierType": "CODICE_FISCALE",
                "issuingCountry": "IT",
                "orderQuantity": "2",
                "productDescription": "Prodotto A",
                "total": "42.50 EUR",
                "transactionStatus": "PAID",
                "shippingAddress": "Mario Rossi, Via Roma 1, Milano",
            }
        )
        self.assertIn("Nuovo ordine eBay", text)
        self.assertIn("Ordine eBay", text)
        self.assertIn("ID ordine</b>", text)
        self.assertIn("<code>12-345</code>", text)
        self.assertIn("RSSMRA80A01H501U", text)
        self.assertNotIn("rssmra80a01h501u", text)
        self.assertIn("Data</b>: <code>03/04/2026 12:00</code>\n💰", text)
        self.assertIn("Nome</b>", text)
        self.assertNotIn("Nome completo", text)
        self.assertIn("Mario Rossi", text)
        self.assertEqual(text.count("Mario Rossi"), 1)
        self.assertIn("mario@example.com", text)
        self.assertIn("Descrizione prodotto", text)
        self.assertIn("Prodotto A", text)
        self.assertIn("Quantità ordine", text)
        self.assertIn("Stato transazione", text)
        self.assertIn("Pagato", text)
        self.assertNotIn("Tipo</b>", text)
        self.assertIn("Paese</b>: <code>IT</code>", text)
        self.assertNotIn("CODICE_FISCALE", text)
        self.assertNotIn("PAID", text)

    def test_format_order_date_falls_back_when_rome_timezone_is_unavailable(self) -> None:
        with patch(
            "src.fiscalbay.telegram_commands.ZoneInfo",
            side_effect=ZoneInfoNotFoundError("No time zone found with key Europe/Rome"),
        ):
            self.assertEqual(format_order_date("2026-04-03T10:00:00Z"), "03/04/2026 10:00")

    def test_looks_like_order_id_requires_ebay_numeric_segments(self) -> None:
        self.assertTrue(looks_like_order_id("12-34567-89012"))
        self.assertFalse(looks_like_order_id("mario-shop"))
        self.assertFalse(looks_like_order_id("order-1"))

    def test_format_order_fallback_when_missing_fiscal_fields(self) -> None:
        text = format_auto_notification(
            {
                "orderId": "12-345",
                "creationDate": "2026-04-03T10:00:00Z",
                "buyerUsername": "buyer",
                "taxpayerId": "",
                "taxIdentifierType": "",
                "issuingCountry": "",
            }
        )
        self.assertIn("Dati fiscali non presenti", text)
        self.assertNotIn("Paese</b>: <code>n/d</code>", text)

    def test_has_fiscal_identifier_requires_type_and_value(self) -> None:
        self.assertTrue(
            has_fiscal_identifier(
                {
                    "taxIdentifierType": "CODICE_FISCALE",
                    "taxpayerId": "RSSMRA80A01H501U",
                }
            )
        )
        self.assertTrue(
            has_fiscal_identifier(
                {
                    "taxIdentifierType": "VAT_NUMBER",
                    "taxpayerId": "IT123",
                }
            )
        )
        self.assertFalse(
            has_fiscal_identifier(
                {
                    "taxIdentifierType": "CODICE_FISCALE",
                    "taxpayerId": "",
                }
            )
        )

    def test_format_auto_notification_uses_vat_label_when_available(self) -> None:
        text = format_auto_notification(
            {
                "orderId": "12-346",
                "creationDate": "2026-04-03T10:00:00Z",
                "buyerUsername": "buyer-vat",
                "taxpayerId": "IT12345678901",
                "taxIdentifierType": "VAT_NUMBER",
                "issuingCountry": "IT",
            }
        )
        self.assertIn("P.IVA", text)
        self.assertNotIn("Tipo</b>", text)
        self.assertNotIn("VAT_NUMBER", text)

    @patch("src.fiscalbay.bot.telegram_request")
    def test_send_message_retries_without_parse_mode_on_http_400(
        self, mock_telegram_request
    ) -> None:
        mock_telegram_request.side_effect = [
            TelegramApiError("Errore Telegram su sendMessage: HTTP 400: Bad Request"),
            {"message_id": 1},
        ]
        send_message("token", 123, "ciao")
        self.assertEqual(mock_telegram_request.call_count, 2)
        first_call = mock_telegram_request.call_args_list[0].args[2]
        second_call = mock_telegram_request.call_args_list[1].args[2]
        self.assertEqual(first_call.get("parse_mode"), "HTML")
        self.assertNotIn("parse_mode", second_call)

    @patch("src.fiscalbay.bot.telegram_request")
    def test_send_message_includes_reply_markup(self, mock_telegram_request) -> None:
        mock_telegram_request.return_value = {"message_id": 1}
        reply_markup = build_main_menu_markup()
        send_message("token", 123, "ciao", reply_markup=reply_markup)
        params = mock_telegram_request.call_args.args[2]
        self.assertEqual(params.get("reply_markup"), reply_markup)

    @patch("src.fiscalbay.bot.telegram_request")
    def test_send_message_adds_copy_button_for_fiscal_identifier(
        self, mock_telegram_request
    ) -> None:
        mock_telegram_request.return_value = {"message_id": 1}
        text = format_auto_notification(
            {
                "orderId": "12-346",
                "creationDate": "2026-04-03T10:00:00Z",
                "buyerUsername": "buyer-vat",
                "taxpayerId": "IT12345678901",
                "taxIdentifierType": "VAT_NUMBER",
                "issuingCountry": "IT",
            }
        )

        send_message("token", 123, text)

        params = mock_telegram_request.call_args.args[2]
        self.assertEqual(
            params.get("reply_markup"),
            {
                "inline_keyboard": [
                    [
                        {
                            "text": "Copia P.IVA",
                            "copy_text": {"text": "IT12345678901"},
                        }
                    ]
                ]
            },
        )

    @patch("src.fiscalbay.bot.telegram_request")
    def test_send_message_merges_copy_button_with_existing_markup(
        self, mock_telegram_request
    ) -> None:
        mock_telegram_request.return_value = {"message_id": 1}
        text = format_auto_notification(
            {
                "orderId": "12-345",
                "creationDate": "2026-04-03T10:00:00Z",
                "buyerUsername": "buyer",
                "taxpayerId": "RSSMRA80A01H501U",
                "taxIdentifierType": "CODICE_FISCALE",
                "issuingCountry": "IT",
            }
        )
        reply_markup = build_main_menu_markup()

        send_message("token", 123, text, reply_markup=reply_markup)

        params = mock_telegram_request.call_args.args[2]
        keyboard = params["reply_markup"]["inline_keyboard"]
        self.assertEqual(
            keyboard[0],
            [
                {
                    "text": "Copia CF",
                    "copy_text": {"text": "RSSMRA80A01H501U"},
                }
            ],
        )
        self.assertEqual(keyboard[1:], reply_markup["inline_keyboard"])

    @patch("src.fiscalbay.bot.telegram_request")
    def test_send_message_does_not_add_copy_button_for_missing_fiscal_identifier(
        self, mock_telegram_request
    ) -> None:
        mock_telegram_request.return_value = {"message_id": 1}
        text = format_auto_notification(
            {
                "orderId": "12-345",
                "creationDate": "2026-04-03T10:00:00Z",
                "buyerUsername": "buyer",
                "taxpayerId": "",
                "taxIdentifierType": "",
                "issuingCountry": "",
            }
        )

        send_message("token", 123, text)

        params = mock_telegram_request.call_args.args[2]
        self.assertNotIn("reply_markup", params)

    @patch("src.fiscalbay.clients.telegram.telegram_request")
    def test_ensure_long_polling_deletes_existing_webhook(self, mock_telegram_request) -> None:
        ensure_long_polling("token")
        mock_telegram_request.assert_called_once_with(
            "token",
            "deleteWebhook",
            {"drop_pending_updates": False},
        )

    @patch("src.fiscalbay.clients.telegram.telegram_request")
    def test_sync_bot_branding_updates_profile_and_commands(self, mock_telegram_request) -> None:
        profile = build_telegram_branding_profile()
        sync_bot_branding(
            "token",
            name=profile["name"],
            short_description=profile["short_description"],
            description=profile["description"],
            commands=profile["commands"],
        )
        methods = [call.args[1] for call in mock_telegram_request.call_args_list]
        self.assertEqual(
            methods,
            [
                "setMyName",
                "setMyShortDescription",
                "setMyDescription",
                "setMyCommands",
                "setChatMenuButton",
            ],
        )

    @patch("src.fiscalbay.bot.sync_bot_branding")
    def test_sync_runtime_branding_skips_when_profile_is_unchanged(
        self,
        mock_sync_bot_branding,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="token",
                allowed_chat_ids=set(),
                notify_chat_ids=set(),
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )

            sync_runtime_branding(config)
            sync_runtime_branding(config)

            self.assertEqual(mock_sync_bot_branding.call_count, 1)
            self.assertIsNotNone(
                load_kv_value(str(db_path), "branding_sync:profile_hash"),
            )

    @patch("src.fiscalbay.bot.sync_bot_branding")
    def test_sync_runtime_branding_backs_off_after_rate_limit(
        self,
        mock_sync_bot_branding,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="token",
                allowed_chat_ids=set(),
                notify_chat_ids=set(),
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )
            mock_sync_bot_branding.side_effect = TelegramApiError(
                "Errore Telegram su setMyName: HTTP 429: Too Many Requests: retry_after_120",
                status_code=429,
            )

            sync_runtime_branding(config)
            sync_runtime_branding(config)

            self.assertEqual(mock_sync_bot_branding.call_count, 1)
            self.assertEqual(load_kv_value(str(db_path), "branding_sync:profile_hash"), None)
            self.assertIsNotNone(load_kv_value(str(db_path), "branding_sync:retry_at"))

    @patch("src.fiscalbay.bot.sync_bot_branding")
    def test_sync_runtime_branding_parses_telegram_retry_after_wording(
        self,
        mock_sync_bot_branding,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "state.db"
            config = TelegramConfig(
                token="token",
                allowed_chat_ids=set(),
                notify_chat_ids=set(),
                state_path=str(db_path),
                retry_queue_path=str(db_path),
            )
            mock_sync_bot_branding.side_effect = TelegramApiError(
                "Errore Telegram su setMyName: HTTP 429: Too Many Requests: retry after 120",
                status_code=429,
            )

            sync_runtime_branding(config)
            sync_runtime_branding(config)

            self.assertEqual(mock_sync_bot_branding.call_count, 1)
            self.assertIsNotNone(load_kv_value(str(db_path), "branding_sync:retry_at"))

    def test_process_lock_writes_metadata_and_removes_file_on_release(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            lock_path = Path(tmpdir) / "telegram_bot.lock"

            handle = acquire_process_lock(str(lock_path))
            self.assertTrue(lock_path.exists())
            content = lock_path.read_text(encoding="utf-8")
            self.assertIn("pid=", content)
            self.assertIn("started_at=", content)

            release_process_lock(handle, str(lock_path))
            self.assertFalse(lock_path.exists())

    def test_acquire_process_lock_reports_holder_details_when_already_locked(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            lock_path = Path(tmpdir) / "telegram_bot.lock"

            handle = acquire_process_lock(str(lock_path))
            try:
                with self.assertRaises(TelegramApiError) as ctx:
                    acquire_process_lock(str(lock_path))
            finally:
                release_process_lock(handle, str(lock_path))

            self.assertIn("pid=", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
