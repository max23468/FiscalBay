# Authorization Operation Mapping

> Migration Guide context (source: sources/migration_guide_for_pilot.md, Authentication migration section):
> Auth'n'Auth authentication will be fully replaced by OAuth tokens with scopes. In some cases, the traditional authentication calls will have OAuth replacements, but other calls will not due to the differences in the types of authentication. The following table captures all of the traditional authentication calls and what's the future plan for each call:

## Auth'n'Auth token bootstrap removal

### ConfirmIdentity -> No replacement

Purpose:
- Confirm a user's identity during the traditional consent flow when the application used the old `IDVerification` authorization type.
- Unlike token-bearing calls, this operation confirmed identity without issuing a user token.

Modern API:
- No replacement. This functionality is not needed as a part of OAuth.

Key Differences:
- This traditional operation is part of the Auth'n'Auth `IDVerification` consent flow and is not carried forward under OAuth.
- OAuth identity is established through the authorization code grant consent flow, which grants an access token directly without a separate confirmation call.

Migration Guide:
- **None**; to be decommissioned
- This functionality is not needed as a part of OAuth

References:
- Full traditional doc extract: references/operations/ConfirmIdentity_doc.md
- OAuth flow reference: references/oauth-flows.md
- Auth'n'Auth flow reference: references/traditional-flow.md

---

### FetchToken -> Replace with Oauth api/flow

Purpose:
- Retrieve a traditional user token after the user completed the Auth'n'Auth consent flow by signing in through the redirect URL and consent page.

Modern API:
- Flow-level migration: replace the traditional `GetSessionID` + `FetchToken` handshake with the OAuth authorization code grant flow and token exchange against `/identity/v1/oauth2/token`.

Key Differences:
- OAuth does not preserve the traditional `GetSessionID` + `FetchToken` handshake.
- OAuth consent and token creation use scopes and OAuth grant flows instead of exchanging a `SessionID` for an `eBayAuthToken`.
- OAuth access tokens are short-lived (typically 7200 seconds) and paired with a separate long-lived `refresh_token`, unlike the 18-month `eBayAuthToken`.
- The modern token exchange happens server-to-server using `client_id` and `client_secret` credentials, not through a session handshake.
- OAuth token acquisition uses `POST /identity/v1/oauth2/token` with `grant_type=authorization_code`, the returned authorization code, and `redirect_uri`.
- The OAuth response returns `access_token`, `expires_in`, `refresh_token`, `refresh_token_expires_in`, and `token_type` instead of a long-lived `eBayAuthToken`.
- `redirect_uri` must match the `AcceptURL` configured in your RuName.
- For traditional APIs (Trading, Post Order, Business Policy Management), use the API-specific OAuth header instead of `Authorization: Bearer`; see `references/traditional-api-oauth.md`.

Migration Guide:
- **None**; to be decommissioned
- This functionality is not needed as a part of OAuth

References:
- Full traditional doc extract: references/operations/FetchToken_doc.md
- OAuth flow reference: references/oauth-flows.md
- Auth'n'Auth flow reference: references/traditional-flow.md

---

### GetSessionID -> Replace with Oauth api/flow

Purpose:
- Bootstrap the traditional Auth'n'Auth flow by obtaining a short-lived `SessionID` used in the consent redirect and later `FetchToken` exchange.

Modern API:
- Flow-level migration: remove `SessionID` bootstrap and use OAuth consent + token acquisition patterns.
- The consent step is browser-based; redirect the user to eBay's OAuth consent URL using your `RuName` configuration.

Key Differences:
- OAuth does not require a standalone `SessionID` generation step.
- OAuth introduces scope-based consent and token lifecycle semantics instead of the Auth'n'Auth `SessionID` exchange.
- The `RuName` concept is preserved: it still specifies `AcceptURL`, `RejectURL`, and display title, but is used in the OAuth consent URL rather than in a `GetSessionID` SOAP call.
- Redirect the user to `https://auth.ebay.com/oauth2/authorize` with `client_id`, `redirect_uri`, `response_type=code`, and the required scopes.
- No server-to-eBay API call is needed for this step; the consent initiation is a browser redirect.
- The authorization code returned to `AcceptURL` replaces `SessionID` as the value exchanged for a token.
- `redirect_uri` must match the `AcceptURL` registered in your RuName for the corresponding environment.
- `scope` must include all scopes the token will be used for; adding scopes later requires re-consent.

Migration Guide:
- **None**; to be decommissioned
- This functionality is not needed as a part of OAuth

References:
- Full traditional doc extract: references/operations/GetSessionID_doc.md
- OAuth flow reference: references/oauth-flows.md
- Auth'n'Auth flow reference: references/traditional-flow.md

---

## Token lifecycle and revocation

### GetTokenStatus -> The capability of this call will be migrated to OAuth tokens. More details to follow.

Purpose:
- Retrieve the status, expiration, and revocation state of a traditional user token.

Migration Guide:
- The capability of this call will be migrated to OAuth tokens. More details to follow.

References:
- Full traditional doc extract: references/operations/GetTokenStatus_doc.md

---

### RevokeToken -> The capability of this call will be migrated to OAuth tokens. More details to follow.

Purpose:
- Revoke a traditional user token before normal expiration, typically due to an unsubscribe event or security concerns.

Migration Guide:
- The capability of this call will be migrated to OAuth tokens. More details to follow.

References:
- Full traditional doc extract: references/operations/RevokeToken_doc.md

---

## Decommissioned operations

### GetChallengeToken (Decommissioned) -> No replacement

Purpose:
- Traditional authorization-adjacent challenge-token behavior used in older flows.

Modern API:
- Decommissioned with no replacement.
- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:
- This traditional operation is decommissioned and should be removed without a modern substitute.
- Do not confuse this with Notification API callback challenge verification, which is a separate compliance workflow.

References:
- No bundled traditional doc page available for this operation.

---

### ValidateTestUserRegistration (Decommissioned) -> No replacement

Purpose:
- Validate traditional test-user registration behavior in older authorization or sandbox onboarding flows.

Modern API:
- Decommissioned with no replacement.
- Mentioned operation/endpoint either could be decommed or already migrated and available in REST(GQL) apis.

Key Differences:
- This traditional operation is decommissioned and should be removed without a modern substitute.
- Modern Sandbox onboarding uses OAuth credentials, Sandbox users, and environment-matched scope configuration without a separate registration validation call.

References:
- No bundled traditional doc page available for this operation.
