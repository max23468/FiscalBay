# Set Return Preferences

- API Type: REST
- Operation: POST `/post-order/v2/return/preference`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Set Return Preferences](https://developer.ebay.com/Devzone/post-order/post-order_v2_return_preference__post.html)

## Description

This method sets whether the seller requires a Return Merchandise Authorization (RMA) number for returned items.

## When To Use

Use this method when the seller wants to enable or disable the RMA requirement for returns.

## Request

### Endpoint

```http
POST https://api.ebay.com/post-order/v2/return/preference
```

This call has no path parameters or query parameters.

### HTTP Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | This call uses standard authorization tokens. |

### Authentication Notes

- All requests made to eBay REST operations require the authorization HTTP header for authentication.
- This call uses standard authorization tokens.

### Request Body

The request payload uses `SetSellerReturnPreferenceRequest`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rmaRequired` | `boolean` | Yes | `true` to require RMA on returned items, `false` to disable the requirement. |

## Response

### Response Type

This call has no response payload.

### Success Behavior

- A successful request returns an HTTP success status
- No response body is returned

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/return/preference
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "rmaRequired": true
}
```

### Response

```http
HTTP/1.1 200 OK
```

## Related Operations

- `GET /post-order/v2/return/preference` to verify the current configuration
