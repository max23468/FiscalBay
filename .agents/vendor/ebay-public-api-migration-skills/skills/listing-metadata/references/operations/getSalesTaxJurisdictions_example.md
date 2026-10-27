# GET : getSalesTaxJurisdictions Samples

Modern API:
- Sell Metadata `getSalesTaxJurisdictions`

Request:

```http
GET /sell/country/US/sales_tax_jurisdiction
Authorization: Bearer {oauth_token}
```

Notes:
- No bundled usage example exists for this operation in the current source set.
- `countryCode` path parameter accepts `US` or `CA` only.
- For US, the response covers five US territories and no US states or D.C.
- For CA, the response covers Canadian provinces.
- Replace `US` with `CA` for Canadian tax jurisdiction discovery.
