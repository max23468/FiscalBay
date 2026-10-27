# Escalate Inquiry

- API Type: REST
- Operation: POST `/post-order/v2/inquiry/{inquiryId}/escalate`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Escalate Inquiry](https://developer.ebay.com/Devzone/post-order/post-order_v2_inquiry-inquiryid_escalate__post.html)

## Description

This method escalates the specified Item Not Received inquiry to an INR case on behalf of the buyer or seller.

The source notes that a seller would typically escalate if the item was already shipped but the buyer refuses to close the inquiry.

## When To Use

Use this method when the inquiry can no longer be resolved within the standard inquiry flow and must be escalated into a case.

## Request

### Endpoint

```http
POST https://api.ebay.com/post-order/v2/inquiry/{inquiryId}/escalate
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `inquiryId` | string | Yes | The inquiry to escalate. |

### HTTP Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | This call uses standard authorization tokens. |

### Authentication Notes

- All requests made to eBay REST operations require the authorization HTTP header for authentication.
- This call uses standard authorization tokens.

### Request Body

The request payload uses `EscalateInquiryRequest`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `comments` | `Text` | Yes | Required explanation for why the inquiry is being escalated. |
| `escalateInquiryReason` | `string` | Yes | Enumeration value describing why the inquiry is being escalated. |

### Source Note On Field Naming

The request model documents the field as `escalateInquiryReason`, but the public sample uses `escalationReason`. Treat this as a source inconsistency that should be validated against live API behavior before implementation.

## Response

### Response Type

This call has no response payload.

### Success Behavior

- A successful request returns HTTP `200`
- No response body is returned

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/inquiry/5********7/escalate
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "escalationReason": "SELLER_NORESPONSE",
  "comments": {
    "content": "The seller has not addressed my inquiry."
  }
}
```

### Response

```http
HTTP/1.1 200 OK
```

### Example Notes

- Public sample IDs are masked by the source.
- The sample uses `escalationReason`, while the request model names the field `escalateInquiryReason`.

## Notes

- Migration mapping may point to a newer GraphQL referral flow, but this page documents the original traditional escalation endpoint.

## Related Operations

- `GET /post-order/v2/inquiry/{inquiryId}` to inspect the inquiry before escalating
- `GET /post-order/v2/casemanagement/{caseId}` to manage the resulting escalated case
