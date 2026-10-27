# OAuth Flows

Flow-level OAuth guidance for the Authorization domain.

## OAuth token types

### Application access token

Use the `client_credentials` grant when the app is acting on its own behalf (for example, non-user-specific metadata lookups).

### User access token

Use the `authorization_code` grant when the app is acting on behalf of an eBay user.

The user-token flow has two stages:

1. Redirect the user through eBay consent using the application's **RuName** configuration.
2. Exchange the returned authorization code for an `access_token` and `refresh_token`.

## OAuth scopes

OAuth scopes grant your application access to different methods and resources. Each OAuth token must be minted with the scopes required by the methods it will call.

### Scope assignment and configuration

- Each application keyset is assigned a set of scopes when created in the Developer Program.
- View assigned scopes via the "OAuth Scopes" link in the Application Keys page.
- Different scopes may be assigned for Sandbox vs Production environments.

### Specifying scopes when minting tokens

- **Client credentials grant**: pass scopes in the `scope` parameter as a URL-encoded space-separated list.
- **Authorization code grant**: pass scopes in the consent request, then optionally in token/refresh requests.
- **Refresh token grant**: can specify scopes (must be equal to or subset of the original consent scopes) or omit to use the original scopes.

### Scope planning best practices

- Include all scopes needed for current and planned capabilities to avoid re-consent.
- Only include scopes your application actually needs.
- Do not include read-only scopes if a read-write scope is already specified.
- More scopes = more permissions users must consent to.

## RuName configuration (user tokens only)

The RuName (Redirect URL name) is required for user-token flows and contains:

- Accept URL: where eBay redirects users who grant consent
- Reject URL: where eBay redirects users who decline consent
- Privacy Policy URL: link to your application's privacy policy
- Display Title: title shown on the Grant Application Access page

Getting your RuName:

1. Navigate to the Application Keys page in the Developer Program.
2. Click the "User Tokens" link next to your Client ID.
3. Create a RuName if none exists.
4. Each application has separate RuName values for Sandbox and Production.

Note: application tokens do not need RuName configuration; only user tokens require it.

## Token endpoint requirements

For any OAuth grant against `/identity/v1/oauth2/token`:

- Send `Authorization: Basic <base64(client_id:client_secret)>`
  - Base64 encode the string `<client_id>:<client_secret>` (colon separator)
  - Prepend with the word `Basic ` in the Authorization header
- Send `Content-Type: application/x-www-form-urlencoded`
- Keep Sandbox credentials with Sandbox endpoints and Production credentials with Production endpoints
- Sandbox endpoint: `https://api.sandbox.ebay.com/identity/v1/oauth2/token`
- Production endpoint: `https://api.ebay.com/identity/v1/oauth2/token`

## Refresh and expiration

- Access tokens are short-lived, typically around two hours (7200 seconds).
- User access tokens are renewed with the `refresh_token` grant.
- Adding new scopes later requires a new user-consent step.
- Cache tokens until expiry instead of minting one per request.

### Refresh token lifecycle

- Refresh tokens are long-lived and can be used repeatedly to mint new access tokens.
- Refresh tokens will expire eventually, requiring new user consent.
- Refresh tokens can be revoked unexpectedly by:
  - user changing their eBay username
  - user revoking consent via their eBay account pages
  - eBay security actions

### Token refresh best practices

- Do not track expiry and refresh proactively; instead refresh after receiving an "Invalid access token" error.
- Store refresh tokens securely like you would store client secrets.
- Implement graceful handling of refresh token revocation.
- If a refresh token is revoked or expired, restart the consent flow from the beginning.

## Token endpoint rate limits

- `client_credentials`: 1,000 requests/day
- `authorization_code`: 10,000 requests/day
- `refresh_token`: 50,000 requests/day

## API-style applicability

- REST and GraphQL both require OAuth.
- The shared bearer-token pattern is:

```http
Authorization: Bearer <accessToken>
```

## OAuth best practices

### Security

- Treat access tokens and refresh tokens as confidential; never share or expose publicly.
- Store tokens in secure locations (encrypted databases, secure credential stores).
- For best performance and security, store access tokens in memory and reuse until expiry.
- Do not store access tokens in client-side code or cookies accessible to JavaScript.

### Token management

- Reuse access tokens until they expire; do not mint a new token for every request.
- Stay within daily rate limits: client_credentials (1,000/day), authorization_code (10,000/day), refresh_token (50,000/day).
- Create User access tokens with all scopes needed for current and planned features to avoid multiple consent requests.
- Only request scopes your application actually uses.

### Environment separation

- Tokens minted in Sandbox only work in Sandbox; tokens minted in Production only work in Production.
- Use environment-specific credentials and endpoints for each environment.
- Test with Sandbox user accounts, but get Production tokens from real users when ready to launch.

### Error handling

- Gracefully handle user access token revocations.
- If a refresh token is revoked, restart the full consent flow.
- Handle access token expiration errors by refreshing with refresh_token grant.

## Traditional-operation replacement reminders

- `GetSessionID`: replace with the OAuth user-consent step.
- `FetchToken`: replace with token exchange against `/identity/v1/oauth2/token`.
- `GetTokenStatus`: replace with OAuth token lifecycle handling and refresh logic.
- `RevokeToken`: replace with OAuth-oriented token management and re-consent flows when needed.
