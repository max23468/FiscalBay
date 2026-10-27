# Traditional Auth'n'Auth Flow

Traditional Auth'n'Auth guidance for migration planning.

## Core traditional model

Traditional API requests often embedded the user token in XML:

```xml
<RequesterCredentials>
  <eBayAuthToken>...</eBayAuthToken>
</RequesterCredentials>
```

## Token lifecycle facts

- Auth'n'Auth tokens are long-lived relative to OAuth, typically valid for 18 months.
- Tokens can be up to 2KB in length and are base64 encoded.
- When a token is within 7 days of expiry, SOAP responses may include `<HardExpirationWarning>` in the response header.
- Once hard-expired, calls fail with error `932` and the message `Auth token is hard expired.`
- Applications should track token creation date and assume 18-month validity.
- eBay recommends messaging users several months before expiration to ensure time to reauthorize.

## GetSessionID and FetchToken workflow

The traditional token acquisition follows this sequence:

1. Application calls `GetSessionID` to receive a session ID.
2. Application constructs a sign-in URL:
   `https://signin.ebay.com/ws/eBayISAPI.dll?SignIn&RUName=<RUName>&SessID=<SessionID>`
3. User signs in and grants consent on eBay's consent form.
4. Application calls `FetchToken` with the session ID to retrieve the user token.

## Application type differences

### Client/Desktop Applications

- No AcceptURL or RejectURL.
- User consent flow ends on eBay confirmation page.
- Application must call `FetchToken` to retrieve token.
- Wait 5-10 seconds after user consent before calling `FetchToken`.

### Web/Server Applications

- Configure AcceptURL and RejectURL in developer account.
- eBay redirects consenting users to AcceptURL, rejecting users to RejectURL.
- Can pass custom data via `ruparams` parameter (URL-encoded, returned in redirect).
- Application calls `FetchToken` after redirect.

## Traditional token management

- `GetTokenStatus` and `RevokeToken` were part of old token-management behavior.
- Treat these as traditional authorization mechanics, not as patterns to carry into modern REST or GraphQL integrations.

## Token revocation scenarios

Tokens can be revoked:

- **By user**: via "Third-party app access" page in My eBay (immediate revocation, error code 16110).
- **By eBay**: due to security concerns (immediate revocation, error code 17470).
- **By expiration**: 18 months after creation.
