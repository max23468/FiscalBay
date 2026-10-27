# Get Return Preferences

- API Type: REST
- Operation: GET `/post-order/v2/return/preference`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Get Return Preferences](https://developer.ebay.com/Devzone/post-order/post-order_v2_return_preference__get.html)

## Description

This method retrieves the return preferences currently active on the seller's account.

## When To Use

Use this method when you need to inspect seller-level return configuration before changing it or before aligning workflow behavior with current account settings.

## Request

### Endpoint

```http
GET https://api.ebay.com/post-order/v2/return/preference
```

This call has no path parameters, query parameters, or request body.

### HTTP Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | This call uses standard authorization tokens. |

### Authentication Notes

- All requests made to eBay REST operations require the authorization HTTP header for authentication.
- This call uses standard authorization tokens.

## Response

### Response Type

The response payload is `GetSellerReturnPreferenceResponse`.

### Key Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `advanceRulesEnabled` | `boolean` | `true` if the seller account is enabled for advanced return rules. |
| `rmaRequired` | `boolean` | `true` if the seller requires a Return Merchandise Authorization number for returns. |
| `versionId` | `integer` | Identifier for the seller's current return-rule configuration. |

## Example

### Request

```http
GET https://api.ebay.com/post-order/v2/return/preference
Authorization: Bearer <access-token>
```

### Response Excerpt

```json
{
  "advanceRulesEnabled": true,
  "rmaRequired": true,
  "versionId": 4
}
```

## Notes

- `versionId` changes when the seller updates return rules in My eBay.

## Related Operations

- `POST /post-order/v2/return/preference` to update the RMA requirement
