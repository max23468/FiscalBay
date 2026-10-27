# Create Cancellation Request

- API Type: REST
- Operation: POST `/post-order/v2/cancellation`
- Base URL: `https://api.ebay.com`
- Sandbox: The source states the method is not supported in Sandbox, while also noting a buyer test use case in Sandbox; treat production support as authoritative and validate your environment before use
- Source: [Post-Order API - Create Cancellation Request](https://developer.ebay.com/Devzone/post-order/post-order_v2_cancellation__post.html)

## Description

This method initiates an order cancellation on behalf of a seller and, if needed, can also be used to create an order cancellation on behalf of a buyer.

The source explicitly recommends calling `POST /post-order/v2/cancellation/check_eligibility` before this method.

## When To Use

Use this method when you want to create a cancellation request for an order.

Typical partner-facing use cases:

- Buyer requests cancellation soon after purchase
- Seller needs to cancel because the item cannot be fulfilled
- Seller wants to relist line items after a successful seller-initiated cancellation

## Request

### Endpoint

```http
POST https://api.ebay.com/post-order/v2/cancellation
```

This call has no path or query parameters.

### HTTP Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | This call uses standard authorization tokens. |

### Authentication Notes

- All requests made to eBay REST operations require the authorization HTTP header for authentication.
- This call uses standard authorization tokens.

### Security Note

The public source says certain calls made on behalf of EU/UK sellers require Digital Signatures, including this method.

### Request Body

The request payload uses `CreateCancelRequest`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `legacyOrderId` | `string` | Yes | Order identifier for the order being considered for cancellation. For paid orders, use the paid-order ID. |
| `cancelReason` | `string` | No | Cancellation reason. Strongly recommended by the source. |
| `buyerPaid` | `boolean` | Conditional | Set to `true` if the buyer paid and may need a refund; set to `false` for unpaid orders. |
| `buyerPaidDate` | `DateTime` | Conditional | Payment timestamp when `buyerPaid` is `true`. |
| `relistLineItem` | `array` | No | Seller-side relist instructions for one or more line items after successful cancellation. |

### `relistLineItem` Fields

| Field | Type | Description |
|-------|------|-------------|
| `itemId` | `integer` | Listing identifier for the line item. |
| `transactionId` | `integer` | Transaction identifier for the line item. |
| `quantity` | `integer` | Quantity to relist. Must be less than or equal to purchased quantity. |

## Response

### Response Type

The response payload is `CreateCancelResponse`.

### Key Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `cancelId` | `string` | Cancellation identifier returned when the cancellation request is successfully created. |
| `orderEligibilityResult` | `OrderEligibilityResult` | Returned when the order is not eligible to be cancelled, and may also provide item-level eligibility context. |
| `warnings` | `array of ErrorData` | Returned when the request triggers warnings or errors. |

### `orderEligibilityResult`

| Field | Type | Description |
|-------|------|-------------|
| `eligible` | `boolean` | Whether the order is eligible for cancellation. |
| `eligibleCancelReason` | `array of string` | Cancellation reasons that can be used when the order is eligible. |
| `failureReason` | `array of string` | Reasons why the order is ineligible, when applicable. |
| `itemEligibilityResult` | `array` | Eligibility details for each line item. |
| `legacyOrderId` | `string` | Order identifier associated with the evaluation. |

### `itemEligibilityResult`

| Field | Type | Description |
|-------|------|-------------|
| `itemId` | `string` | Listing identifier for the line item. |
| `transactionId` | `string` | Transaction identifier for the line item. |
| `eligible` | `boolean` | Whether this line item is eligible for cancellation. |
| `cancelQuantity` | `integer` | Quantity being cancelled for the line item, if returned. |
| `failureReason` | `array of string` | Reasons the line item is ineligible, if applicable. |

## Response Behavior

- If the cancellation request is created successfully, `cancelId` is returned.
- If the order is not eligible, `orderEligibilityResult` explains why.
- The source notes that only full-order cancellations are supported at this time.
- `warnings` can be returned alongside processing issues or request problems.

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/cancellation/
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "legacyOrderId": "1**********6-8********7",
  "cancelReason": "ORDER_MISTAKE",
  "buyerPaid": false
}
```

### Response Excerpt

This excerpt is based on the public sample shown on the Create Cancellation Request reference page.

```json
{
  "cancelId": "5********2",
  "orderEligibilityResult": {
    "eligible": true,
    "itemEligibilityResult": [
      {
        "eligible": true,
        "itemId": "1**********76",
        "transactionId": "8********7"
      }
    ],
    "legacyOrderId": "1**********6-8********7"
  }
}
```

### Example Notes

- Public sample IDs are masked by the source.
- The sample shows a successful buyer-side cancellation request.
- The public source recommends checking eligibility before creating the request.

## Notes

- Sellers may cancel directly in some seller-side scenarios, including inability to fulfill an order.
- Seller-initiated cancellations due to stock issues may have seller-account implications, per the source.
- This page documents the traditional cancellation endpoint itself; migration mapping may point to newer GraphQL cancellation flows.

## Related Operations

- `POST /post-order/v2/cancellation/check_eligibility` to pre-check the order
- `GET /post-order/v2/cancellation/{cancelId}` to inspect the created cancellation request
- `POST /post-order/v2/cancellation/{cancelId}/approve` to approve a buyer request
- `POST /post-order/v2/cancellation/{cancelId}/reject` to reject a buyer request
