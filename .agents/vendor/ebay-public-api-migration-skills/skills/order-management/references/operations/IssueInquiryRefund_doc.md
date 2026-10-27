# Issue Inquiry Refund

- API Type: REST
- Operation: POST `/post-order/v2/inquiry/{inquiryId}/issue_refund`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Issue Inquiry Refund](https://developer.ebay.com/Devzone/post-order/post-order_v2_inquiry-inquiryid_issue_refund__post.html)

## Description

This method is used on behalf of the seller to issue a full refund to the buyer for the missing line item.

The source says this is the expected path when the buyer wants a full refund and the seller has not yet shipped the line item.

## When To Use

Use this method when the seller is resolving an INR inquiry by refunding the buyer.

## Request

### Endpoint

```http
POST https://api.ebay.com/post-order/v2/inquiry/{inquiryId}/issue_refund
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `inquiryId` | string | Yes | The unique identifier of the inquiry for which a refund is issued. |

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

The request payload uses `InquiryVoluntaryRefundRequest`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `comments` | `Text` | No | Optional seller note explaining the refund. |

## Response

### Response Type

The response payload is `VoluntaryRefundResponse`.

### Key Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `refundResult.refundSource` | `string` | Funding source used for the refund. |
| `refundResult.refundStatus` | `string` | Result of the refund action. |

## Response Behavior

- The source documents this as a full-refund action.
- The response returns both refund status and refund source.

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/inquiry/5********9/issue_refund
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "comments": {
    "content": "Your refund is on its way."
  }
}
```

### Response Excerpt

```json
{
  "refundResult": {
    "refundSource": "INSTANT_REFUND",
    "refundStatus": "SUCCESS"
  }
}
```

### Example Notes

- Public sample IDs are masked by the source.
- The sample shows a successful instant refund.

## Notes

- This is a seller-side resolution action in the traditional inquiry flow.
- Migration mapping may point to newer GraphQL refund mutations, but this page documents the original traditional endpoint.

## Related Operations

- `GET /post-order/v2/inquiry/{inquiryId}` to inspect the inquiry
- `POST /post-order/v2/inquiry/{inquiryId}/provide_refund_info` to send refund information to the buyer
