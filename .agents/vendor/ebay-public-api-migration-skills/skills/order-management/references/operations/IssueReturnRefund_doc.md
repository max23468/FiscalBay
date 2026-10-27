# Issue Return Refund

- API Type: REST
- Operation: POST `/post-order/v2/return/{returnId}/issue_refund`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Issue Return Refund](https://developer.ebay.com/Devzone/post-order/post-order_v2_return-returnid_issue_refund__post.html)

## Description

This method allows the seller to issue a refund to the buyer for a return request.

## When To Use

Use this method after the seller decides to refund the buyer in the return workflow.

Typical partner-facing use cases:

- Refund the purchase price after the item is returned
- Refund original or return shipping as part of a full or itemized refund
- Optionally relist or restock the returned item after refund completion

## Request

### Endpoint

```http
POST https://api.ebay.com/post-order/v2/return/{returnId}/issue_refund
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `returnId` | string | Yes | The return request being refunded. |

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

The request payload uses `IssueRefundRequest`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `comments` | `Text` | No | Optional seller note about the refund. |
| `refundDetail` | `RefundDetailType` | Yes | Required refund breakdown and total amount. |
| `relistItem` | `boolean` | No | Set to `true` if the seller wants the returned item automatically relisted/restocked after refund success. |

### `refundDetail`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `itemizedRefundDetail` | `array` | Yes | One entry for each refund type being issued. |
| `totalAmount` | `Amount` | Yes | Total refund amount. Must equal the sum of itemized refund amounts. |
| `feeCreditAmount` | `Amount` | No | Fee credit amount, if applicable. |

Each `itemizedRefundDetail` entry includes:

| Field | Type | Description |
|-------|------|-------------|
| `refundAmount` | `Amount` | Refund amount for the refund component. |
| `refundFeeType` | `string` | Refund component type, such as purchase price or shipping. |
| `restockingFeePercentage` | `string` | Deprecated. Do not use. |

## Response

### Response Type

The response payload is `IssueRefundResponse`.

### Key Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `refundStatus` | `string` | Indicates whether the refund succeeded, is pending, failed, or is otherwise unknown. |

## Response Behavior

- A `SUCCESS` response indicates the refund completed successfully.
- A `PENDING` response may indicate the refund is happening outside eBay systems.
- The source says sellers can inspect relist eligibility and relist outcome through `Get Return` fields such as `itemDetail.relistStatus` and `itemDetail.relistedItemId`.

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/return/5********2/issue_refund
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "comments": {
    "content": "Here is your refund for return request #5********2. I have refunded your purchase price, your original shipping costs, and your return shipping costs."
  },
  "refundDetail": {
    "itemizedRefundDetail": [
      {
        "refundAmount": {
          "value": 19.95,
          "currency": "USD"
        },
        "refundFeeType": "PURCHASE_PRICE"
      },
      {
        "refundAmount": {
          "value": 4.25,
          "currency": "USD"
        },
        "refundFeeType": "ORIGINAL_SHIPPING"
      },
      {
        "refundAmount": {
          "value": 4.25,
          "currency": "USD"
        },
        "refundFeeType": "RETURN_SHIPPING"
      }
    ],
    "totalAmount": {
      "value": 28.45,
      "currency": "USD"
    }
  }
}
```

### Response Excerpt

```json
{
  "refundStatus": "SUCCESS"
}
```

## Notes

- Public sample IDs are masked by the source.
- `donationAmount` exists in the model, but the source explicitly notes it is not applicable for this method.

## Related Operations

- `GET /post-order/v2/return/{returnId}` to inspect refund and relist outcome
- `POST /post-order/v2/return/{returnId}/mark_as_received` before refund, when appropriate
