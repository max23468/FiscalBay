# OAuth In Traditional APIs

This document summarizes OAuth guidance for supported traditional eBay APIs.

Reference guide:

- `Using OAuth with traditional APIs`

## Core Rule

Do not assume every traditional API must stay on Auth'n'Auth. If the target traditional API supports OAuth, prefer OAuth and remove the traditional `RequesterCredentials` token model.

## Header Patterns

### Trading API

- Remove `<RequesterCredentials>` from the XML payload.
- Add:

```http
X-EBAY-API-IAF-TOKEN: <accessToken>
```

### Post Order API

Send:

```http
Authorization: IAF <accessToken>
```

### Business Policy Management API

Replace the old security-token header with:

```http
X-EBAY-SOA-SECURITY-IAFTOKEN: <accessToken>
```

## Migration Notes

- This is still OAuth even when the header is not `Authorization: Bearer`.
- Do not generalize REST-specific header assumptions to traditional APIs unless the API documentation says so.
- Some traditional API features can have extra conditions, including public allowlist requirements for certain notification-management capabilities.