# Authorization Intents

Use this file when the migration problem is easier to describe as a task than as a single traditional operation lookup.

Answer rule:

- When the selected `references/operation-mapping.md` entry includes guide-derived `Migration Guide:` bullets such as `Key changes`, `Key things to know`, prerequisites, sequencing, or caveats, include those points in the answer instead of returning only the replacement name.

## Intent: Replace Traditional Auth'n'Auth Token Bootstrap

When to use it:

- You are converting `ConfirmIdentity`, `FetchToken`, or `GetSessionID`.

Recommended workflow:

1. Confirm in `INDEX.md` whether the row is `No replacement` or `Replace with Oauth api/flow` rather than a direct REST endpoint.
2. Use `references/operation-mapping.md` under `Auth'n'Auth token bootstrap removal`.
3. Use `rules/oauth-grant-selection.md` to choose between application and user-token flows.
4. Preserve only the business intent of the traditional flow, not the ConfirmIdentity, SessionID, or FetchToken call shapes.

Navigate next:

- `references/operation-mapping.md`
- `references/operations/ConfirmIdentity_doc.md`
- `references/operations/GetSessionID_doc.md`
- `references/operations/FetchToken_doc.md`
- `rules/oauth-grant-selection.md`

## Intent: Retire Traditional Identity Confirmation

When to use it:

- You are converting `ConfirmIdentity` or explaining the old `IDVerification` consent path.

Recommended workflow:

1. Confirm in `INDEX.md` that `ConfirmIdentity` is now classified under Authorization with `No replacement`.
2. Use `references/operation-mapping.md` under `Auth'n'Auth token bootstrap removal`.
3. Explain that OAuth does not require a direct successor to the traditional IDVerification confirmation call.
4. Keep the migration answer focused on retiring the traditional consent mechanic rather than inventing a new endpoint.

Navigate next:

- `references/operation-mapping.md`
- `references/operations/ConfirmIdentity_doc.md`
- `references/traditional-flow.md`
- `references/oauth-flows.md`

## Intent: Plan OAuth Grant Type And Scope Strategy

When to use it:

- You need to decide whether the replacement flow needs an application token or a user token.
- You are redesigning authorization for a modern REST integration after removing traditional token calls.

Recommended workflow:

1. Decide whether the target capability accesses application-owned metadata or user-owned resources.
2. Use the client credentials grant flow for application access and the authorization code grant flow for user access.
3. Assemble the full scope set before minting tokens.
4. Keep environment-specific keysets, scopes, and token requests separated between Sandbox and Production.
5. Use the token endpoint guidance in `references/oauth-flows.md` when implementation detail is needed for `/identity/v1/oauth2/token` requests.

Navigate next:

- `rules/oauth-grant-selection.md`
- `rules/token-lifecycle-and-security.md`
- `references/oauth-flows.md`
- `references/operation-mapping.md`

## Intent: Evaluate Token Status Or Revocation Migration Safely

When to use it:

- You are converting `GetTokenStatus` or `RevokeToken`.

Recommended workflow:

1. Check `INDEX.md` first and treat both rows as confirmed OAuth lifecycle migration cases, not as one-to-one REST or GraphQL replacements.
2. Use `references/operation-mapping.md` under `Token lifecycle and revocation`.
3. For `GetTokenStatus`, keep the answer centered on expiry, refresh, revocation, and re-consent handling; do not reference a specific modern status API endpoint since the migration guide states "More details to follow" and no confirmed replacement endpoint exists in the primary sources.
4. For `RevokeToken`, use OAuth-oriented token management and revoked-token recovery guidance instead of recreating the SOAP revoke call surface.
5. Apply `rules/token-lifecycle-and-security.md` for scope, expiry, refresh, and revocation behavior that is already validated.
6. Use the merged OAuth and Auth'n'Auth flow references when you need to explain why the correct answer is lifecycle guidance rather than a one-to-one replacement call.

Navigate next:

- `INDEX.md`
- `references/operation-mapping.md`
- `references/operations/GetTokenStatus_doc.md`
- `references/operations/RevokeToken_doc.md`
- `references/oauth-flows.md`
- `references/traditional-flow.md`
- `rules/token-lifecycle-and-security.md`

## Intent: Use OAuth With Traditional APIs

When to use it:

- The integration still targets traditional, Post Order, or Business Policy Management APIs, but should stop using traditional Auth'n'Auth tokens where OAuth is supported.

Recommended workflow:

1. Confirm that the target traditional API supports OAuth.
2. Remove traditional `RequesterCredentials` token handling where the API documentation supports OAuth.
3. Apply the correct traditional-API OAuth header shape instead of assuming `Authorization: Bearer`.
4. Keep this guidance scoped to traditional APIs and do not generalize it to all XML or SOAP surfaces.

Navigate next:

- `references/traditional-api-oauth.md`
- `references/oauth-flows.md`
- `references/traditional-flow.md`

## Intent: Maintain Or Retire Traditional Auth'n'Auth Safely

When to use it:

- The request is explicitly about `RequesterCredentials`, `eBayAuthToken`, `HardExpirationWarning`, or temporary traditional maintenance during migration.

Recommended workflow:

1. Explain the old flow accurately so the migration boundary is clear.
2. Use the Auth'n'Auth flow reference for long-lived token facts, seven-day hard-expiration warnings, and error `932` behavior.
3. Then redirect the implementation plan to the OAuth path unless the integration must remain temporarily on a traditional API surface.

Navigate next:

- `references/traditional-flow.md`
- `references/migration-status.md`
- `references/oauth-flows.md`

## Intent: Remove Decommissioned Challenge Flow

When to use it:

- You are converting `GetChallengeToken`.

Recommended workflow:

1. Confirm in `INDEX.md` that the row is `Decommission` with no validated replacement.
2. Remove or redesign the traditional branch instead of searching for a like-for-like OAuth endpoint.
3. Do not confuse these rows with Notification API callback challenge verification, which is a separate compliance workflow.

Navigate next:

- `INDEX.md`
- `references/operation-mapping.md`
- `references/operations/GetChallengeToken_doc.md`

## Intent: Remove Traditional Test-User Registration Validation

When to use it:

- You are converting `ValidateTestUserRegistration`.

Recommended workflow:

1. Confirm in `INDEX.md` that the row is decommissioned with no validated replacement.
2. Replace the old assumption that auth requires a separate test-user registration validation call.
3. Move environment-specific testing to Sandbox OAuth credentials, Sandbox users, and environment-matched scope configuration.

Navigate next:

- `references/operation-mapping.md`
- `rules/oauth-grant-selection.md`
- `rules/token-lifecycle-and-security.md`

