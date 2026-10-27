# OAuth Grant Selection

Use this rule when replacing traditional Auth'n'Auth token flows with modern OAuth behavior.

## Core decision

- Use the `client_credentials` grant when the application is acting on its own behalf (application access token).
- Use the `authorization_code` grant when the application is acting on behalf of an eBay user (user access token + refresh token).

## Replace traditional bootstrap with OAuth flows (no one-to-one endpoint)

- `GetSessionID` and `FetchToken` are traditional mechanics; do not recreate them as a replacement REST call.
- Preserve the business intent (getting a token that can call eBay APIs) and implement it using OAuth.
- For user access, the consent step is driven by RuName configuration and redirect-based consent.

## Scope planning guidance

- Each token must be minted with the scopes required by the methods it will call.
- Include all scopes needed for current and planned capabilities to avoid re-consent.
- Only request scopes your application actually needs; more scopes = more permissions users must consent to.
- Do not include read-only scopes if a read-write scope is already specified.
- Keep Sandbox vs Production scope assignments and RuNames separated.

## Token endpoint rules

For token requests against `/identity/v1/oauth2/token`:

- Send `Authorization: Basic <base64(client_id:client_secret)>`.
- Send `Content-Type: application/x-www-form-urlencoded`.
- Use environment-matched endpoints and credentials:
  - Sandbox: `https://api.sandbox.ebay.com/identity/v1/oauth2/token`
  - Production: `https://api.ebay.com/identity/v1/oauth2/token`
