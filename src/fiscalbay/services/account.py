"""eBay account lifecycle coordination."""

from __future__ import annotations

from ..clients.ebay import revoke_user_refresh_token
from ..errors import ConfigurationError
from ..models import LinkedEbayAccount, TelegramConfig
from ..storage.oauth import disconnect_linked_ebay_account
from ..storage.users import resolve_linked_ebay_account
from ..tenant_credentials import load_tenant_config_from_storage


def disconnect_account_with_remote_revocation(
    *,
    telegram_config: TelegramConfig,
    telegram_user_id: int,
    environment: str,
) -> tuple[LinkedEbayAccount | None, str, str]:
    linked_account = resolve_linked_ebay_account(
        telegram_config.state_path,
        telegram_user_id,
        environment,
    )
    remote_status = "not_attempted"
    remote_detail = ""
    if linked_account is not None:
        try:
            tenant_config = load_tenant_config_from_storage(
                linked_account,
                environment,
                telegram_config.state_path,
            )
        except ConfigurationError as exc:
            tenant_config = None
            remote_status = "token_unavailable"
            remote_detail = str(exc)
        if tenant_config is not None:
            revocation = revoke_user_refresh_token(tenant_config)
            remote_status = str(revocation.get("status") or "not_attempted")
            remote_detail = str(revocation.get("user_action") or revocation.get("detail") or "")
        elif remote_status == "not_attempted":
            remote_status = "token_unavailable"
            remote_detail = "token tenant assente o non decifrabile"
    disconnected_account = disconnect_linked_ebay_account(
        telegram_config.state_path,
        telegram_user_id,
        environment,
    )
    return disconnected_account, remote_status, remote_detail
