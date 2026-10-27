# Token Lifecycle And Security

Use this rule when the migration task involves token expiry, refresh, revocation, reuse, or secure handling.

## Access token lifecycle

- Access tokens are short-lived (typically around two hours / 7200 seconds).
- Reuse access tokens until they expire; do not mint a new token for every request.

## Refresh token lifecycle

- Refresh tokens are long-lived and can be used repeatedly to mint new access tokens.
- Refresh tokens will expire eventually, requiring new user consent.
- Refresh tokens can be revoked unexpectedly by:
  - user changing their eBay username
  - user revoking consent via their eBay account pages
  - eBay security actions

## Refresh best practices

- Do not track expiry and refresh proactively; instead refresh after receiving an "Invalid access token" error.
- If a refresh token is revoked or expired, restart the consent flow from the beginning.

## Revocation-aware handling (traditional vs modern)

- Traditional Auth'n'Auth tokens were long-lived (typically 18 months), could emit `HardExpirationWarning` within seven days of expiry, and would fail with error `932` once hard-expired.
- In OAuth, treat revoked/expired tokens as expected runtime events and handle them gracefully.

## Security best practices

- Treat access tokens and refresh tokens as confidential; never share or expose publicly.
- Store refresh tokens securely like you would store client secrets.
- For best performance and security, store access tokens in memory and reuse until expiry.
- Do not store access tokens in client-side code or cookies accessible to JavaScript.

## Token minting rate limits

Plan token minting to stay within documented daily limits:

- `client_credentials`: 1,000 requests/day
- `authorization_code`: 10,000 requests/day
- `refresh_token`: 50,000 requests/day
