# Check Cancellation Eligibility

- API Type: REST
- Operation: POST `/post-order/v2/cancellation/check_eligibility`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Check Cancellation Eligibility](https://developer.ebay.com/Devzone/post-order/post-order_v2_cancellation_check_eligibility__post.html)

## Description

This method checks whether a specified order is eligible to be cancelled.

The response includes cancellation eligibility at both the order level and the order line-item level.

## When To Use

Use this method before creating a cancellation request.

Typical partner-facing use cases:

- Confirm whether an order can still be cancelled
- Surface failure reasons before asking the buyer or seller to continue
- Inspect line-item-level eligibility when debugging order state

## Request

### Endpoint

```http
POST https://api.ebay.com/post-order/v2/cancellation/check_eligibility
```

This call has no path or query parameters.

### HTTP Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | This call uses standard authorization tokens. |

### Authentication Notes

- All requests made to eBay REST operations require the authorization HTTP header for authentication.
- This call uses standard authorization tokens.

### Request Body

The request payload uses `OrderEligibilityCheckInfo`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `legacyOrderId` | `string` | Yes | The order identifier being checked for cancellation eligibility. For paid orders, use the paid-order ID. |

## Response

### Response Type

The response payload is `OrderEligibilityResult`.

### Key Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `eligible` | `boolean` | Whether the order is eligible for cancellation. |
| `eligibleCancelReason` | `array of string` | Reasons that can be used when the order is eligible. |
| `failureReason` | `array of string` | Reasons the order is not eligible, when applicable. |
| `itemEligibilityResult` | `array` | Eligibility details for each line item in the order. |
| `legacyOrderId` | `string` | The order identifier evaluated by the request. |

### `itemEligibilityResult`

| Field | Type | Description |
|-------|------|-------------|
| `itemId` | `string` | Listing identifier for the line item. |
| `transactionId` | `string` | Transaction identifier for the line item. |
| `eligible` | `boolean` | Whether the line item is eligible for cancellation. |
| `cancelQuantity` | `integer` | Quantity being cancelled for the line item, if returned. |
| `failureReason` | `array of string` | Reasons the line item is ineligible, if applicable. |

## Response Behavior

- Only full-order cancellations are supported by the traditional flow.
- For the overall order to be eligible, all line items in the order must be eligible.
- The source notes that it is still possible for some line items to be eligible even when the order-level result is not eligible.

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/cancellation/check_eligibility
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "legacyOrderId": "1**********6-8********7"
}
```

### Response Excerpt

This excerpt is based on the public sample shown on the Check Cancellation Eligibility reference page.

```json
{
  "legacyOrderId": "1**********6-8********7",
  "eligible": false,
  "failureReason": [
    "CANCELLATION_EXIST"
  ],
  "itemEligibilityResult": [
    {
      "itemId": "1**********6",
      "transactionId": "8********7",
      "eligible": false,
      "failureReason": [
        "CANCELLATION_EXIST"
      ]
    }
  ]
}
```

### Example Notes

- Public sample IDs are masked by the source.
- The example shows an ineligible order because a cancellation request already exists.

## Notes

- This operation is the recommended pre-check before creating a cancellation request.
- The migration mapping currently marks this traditional behavior as having no direct replacement, so this traditional doc is useful even when a migration note is needed.

## Related Operations

- `POST /post-order/v2/cancellation` to create a cancellation request
- `GET /post-order/v2/cancellation/{cancelId}` to inspect a created cancellation request
