---
name: authorization
description: |
  Migration guidance for traditional Auth'n'Auth retirement to Identity API OAuth flows and related authorization patterns.

  Trigger when user mentions: ConfirmIdentity/FetchToken/GetSessionID/GetTokenStatus/RevokeToken, consent or RuName handling, OAuth token lifecycle questions, "migrate Auth'n'Auth to OAuth", or asks "how do I replace traditional token calls".

  Covers 7 traditional operations including token bootstrap, token status and revocation, identity confirmation, and decommissioned challenge or test-user validation rows.
  Do NOT use for account profile, listing, or order API migrations.
---

# Authorization

Use this skill when the migration task belongs to the `Authorization` domain.

## What This Skill Covers

- Traditional identity-confirmation behavior: `ConfirmIdentity`.
- Traditional Auth'n'Auth token bootstrap and token-management calls: `FetchToken`, `GetSessionID`, `GetTokenStatus`, and `RevokeToken`.
- Decommissioned authorization-adjacent rows in the current reviewed migration inventory: `GetChallengeToken` and `ValidateTestUserRegistration`.
- OAuth grant selection, scope planning, RuName and consent handling, token lifecycle guidance, and environment separation using the bundled authorization guides and references.
- The merged guidance that previously lived in the separate `authorization-oauth` and `authorization-authn-auth` skills, including token endpoint mechanics, traditional-API OAuth header patterns, and traditional hard-expiration behavior.
- Flow-level OAuth migration handling for the rows marked `Replace with Oauth api/flow` in the authoritative Authorization CSV.

## Key Migration Patterns

- Auth’n’Auth authentication will be fully replaced by OAuth tokens with scopes. In some cases, the traditional authentication calls will have OAuth replacements, but other calls will not due to the differences in the types of authentication.
- `ConfirmIdentity` is marked **No replacement** in the authoritative Authorization CSV, while `FetchToken` and `GetSessionID` are marked **Replace with Oauth api/flow**.
- `GetTokenStatus` and `RevokeToken` are mapped in the authoritative Authorization CSV to the note: "The capability of this call will be migrated to OAuth tokens. More details to follow." Treat these as OAuth token-lifecycle migration guidance, not a confirmed one-to-one endpoint replacement.
- Do not invent one-to-one replacements for rows marked `Replace with Oauth api/flow`; answer with OAuth flow and token-lifecycle guidance.
- `GetChallengeToken` and `ValidateTestUserRegistration` are decommissioned with no replacement.
- For `FetchToken`: in OAuth-based migrations, replace the traditional `GetSessionID` + `FetchToken` handshake with the authorization code grant flow and token exchange at `/identity/v1/oauth2/token`.
- For `GetSessionID`: in OAuth-based migrations, replace the SOAP bootstrap step with a browser redirect to the eBay consent URL using your `RuName` and requested scopes.
- For traditional APIs still in use (traditional API, Post Order, Business Policy Management), use API-specific OAuth headers instead of `Authorization: Bearer`; see `references/traditional-api-oauth.md`.

## Workflow Notes

- Start with `INDEX.md` to confirm whether the traditional row is `No replacement`, `Replace with Oauth api/flow`, or `Decommission`.
- Use `references/operation-mapping.md` for the authoritative operation-by-operation narrative.
- Use `references/oauth-flows.md` for token endpoint mechanics, RuName/redirect guidance, scopes, refresh token lifecycle, and best practices.
- Use `references/traditional-flow.md` when the task is about traditional `RequesterCredentials`, `eBayAuthToken`, `HardExpirationWarning`, the `GetSessionID`+`FetchToken` handshake, application type differences (Client/Desktop vs Web/Server), or token revocation scenarios during retirement planning.
- Use `INDEX.md` for the authoritative operation inventory table.
- Use `rules/oauth-grant-selection.md` when replacing `FetchToken` or `GetSessionID` driven logic.
- Use `rules/token-lifecycle-and-security.md` when the task involves expiry, refresh, revocation, or scope strategy.

## Transport And Auth Notes

- OAuth scopes are assigned to the application keyset and must cover every method the token will be used for.
- Use the client credentials grant flow for application access tokens and the authorization code grant flow for user access tokens.
- User-token consent flows require a RuName; application-token flows do not.
- OAuth token requests go to `/identity/v1/oauth2/token` using `Authorization: Basic <base64(client_id:client_secret)>` and `Content-Type: application/x-www-form-urlencoded`.
- Sandbox and Production environments can differ in available scopes; keep environment-matched credentials, RuNames, and tokens separated.
- Treat refresh tokens as confidential and implement graceful handling for refresh token revocation or expiration (restart consent when needed).

## Open Items

- Current bundled materials do not provide traditional operation doc extracts for `GetChallengeToken` or `ValidateTestUserRegistration`; the support files for those rows record that gap explicitly.
- The pilot migration guide states "The capability of this call will be migrated to OAuth tokens. More details to follow." for both `GetTokenStatus` and `RevokeToken`; no specific modern replacement endpoint has been confirmed in the primary sources. The operation mapping uses OAuth lifecycle guidance as the current best answer.

## Navigation

- Use `INDEX.md` for the full Authorization operation table.
- Use `INTENTS.md` for task-oriented workflows.
- Use `references/operation-mapping.md` for the operation-level migration narrative.
- Use `references/oauth-flows.md`, `references/traditional-api-oauth.md`, `references/traditional-flow.md`, and `references/migration-status.md` for supporting Authorization guidance.
- Use `references/operations/` for supporting traditional extracts and non-authoritative evidence notes.
- Use `rules/` for reusable OAuth guidance.

## Field-Level Details

Field-level request and response details and field-by-field mapping are not provided in this skill, even if explicitly requested. For field definitions, refer to the official eBay developer documentation page.
