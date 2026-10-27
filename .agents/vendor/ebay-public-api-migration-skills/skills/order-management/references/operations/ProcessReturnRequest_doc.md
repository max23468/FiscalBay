# Process Return Request

- API Type: REST
- Operation: POST `/post-order/v2/return/{returnId}/decide`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Process Return Request](https://developer.ebay.com/Devzone/post-order/post-order_v2_return-returnid_decide__post.html)

## Description

This method allows a seller or buyer to perform an action against a return request.

For seller workflows, the public source documents four relevant traditional actions:

- `APPROVE`
- `DECLINE`
- `OFFER_PARTIAL_REFUND`
- `PROVIDE_RMA`

The public source also mentions buyer-only actions for accepting or declining a partial refund offer. Those buyer actions are excluded from this seller-focused document.

## Migration Mapping

The migration mapping splits this traditional decision endpoint into different modern GraphQL mutations depending on the action:

| Traditional seller action | Modern target |
|---|---|
| `APPROVE` | `approveReturn` mutation |
| `DECLINE` | `declineReturn` mutation |
| `OFFER_PARTIAL_REFUND` | `proposeKeepItemWithPartialRefund` mutation |
| `PROVIDE_RMA` | `provideRmaNumber` mutation |

## When To Use

Use this method when the seller needs to make a decision on an open return request in the traditional Post-Order flow.

Typical partner-facing use cases:

- Approve an eligible buyer return request
- Decline a return request when policy or business rules allow
- Offer a keep-item partial refund instead of requiring return shipment
- Provide an RMA number when seller workflow requires it

## Request

### Endpoint

```http
POST https://api.ebay.com/post-order/v2/return/{returnId}/decide
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `returnId` | string | Yes | The return request being acted on. |

### HTTP Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | This call uses standard authorization tokens. |

### Authentication Notes

- All requests made to eBay REST operations require the authorization HTTP header for authentication.
- This call uses standard authorization tokens.

### Security Note

The public source says certain calls made on behalf of EU/UK sellers require Digital Signatures, including this method.

### Base Request Model

The request payload uses `DecideReturnRequest`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `decision` | `string` | Yes | Action to perform against the return request. |
| `comments` | `Text` | No | Optional explanatory text about the decision. |
| `keepOriginalItem` | `boolean` | No | Set to `true` if the seller allows the buyer to keep the original item. Relevant for partial-refund scenarios. |
| `partialRefundAmount` | `Amount` | Conditional | Required when `decision=OFFER_PARTIAL_REFUND`. |
| `RMANumber` | `string` | Conditional | Required when `decision=PROVIDE_RMA`. |
| `rMAProvided` | `boolean` | No | Indicates that an RMA number has been provided. |

## Response

### Response Type

The response payload is `DecideReturnResponse`.

### Key Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `refundStatus` | `string` | Returned only when a refund has been requested or initiated through the decision flow. |

## Action Summary

| Action | Seller purpose | Additional required fields |
|---|---|---|
| `APPROVE` | Approve the buyer's return request | None beyond `decision` |
| `DECLINE` | Decline the buyer's return request | None beyond `decision` |
| `OFFER_PARTIAL_REFUND` | Offer a keep-item partial refund settlement | `partialRefundAmount` |
| `PROVIDE_RMA` | Provide a Return Merchandise Authorization number | `RMANumber` |

## Seller Action: APPROVE

### Use Case

Approve a buyer-initiated return request so the return can proceed.

### Required Request Shape

| Field | Value |
|-------|-------|
| `decision` | `APPROVE` |
| `comments` | Optional |

### Public Sample

This is the only seller-action sample explicitly shown on the public reference page.

```http
POST https://api.ebay.com/post-order/v2/return/5********9/decide
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "decision": "APPROVE",
  "comments": {
    "content": "I approve your return request. Please ship the you want to return."
  }
}
```

### Response Behavior

- The public sample shows only HTTP `200` success.
- No response body is shown in the public sample.

## Seller Action: DECLINE

### Use Case

Decline the return request when the seller is permitted to reject it.

### Required Request Shape

This request shape is derived from the public request model. The public reference page does not provide a separate DECLINE sample.

Required fields for this action:

- `decision`: `DECLINE`
- `comments`: optional

### Response Behavior

- The page does not provide a separate DECLINE sample response.
- Use the generic `DecideReturnResponse` behavior documented at the method level.

## Seller Action: OFFER_PARTIAL_REFUND

### Use Case

Offer the buyer a partial refund as an alternative resolution, potentially allowing the buyer to keep the item.

### Required Request Shape

This request shape is derived from the public request model. The public reference page does not provide a separate `OFFER_PARTIAL_REFUND` sample.

Required fields for this action:

- `decision`: `OFFER_PARTIAL_REFUND`
- `partialRefundAmount`: required
- `keepOriginalItem`: optional
- `comments`: optional

### Response Behavior

- `partialRefundAmount` is conditionally required for this action.
- `refundStatus` may appear in the response if a refund has been requested or initiated.

### Caution

No separate public sample payload is provided for this action.

## Seller Action: PROVIDE_RMA

### Use Case

Provide the buyer with a Return Merchandise Authorization number when seller return workflow requires one.

### Required Request Shape

This request shape is derived from the public request model. The public reference page does not provide a separate `PROVIDE_RMA` sample.

Required fields for this action:

- `decision`: `PROVIDE_RMA`
- `RMANumber`: required
- `rMAProvided`: optional
- `comments`: optional

### Response Behavior

- `RMANumber` is conditionally required for this action.
- The source notes that eBay does not validate the RMA value, so the seller must ensure it is accurate.

### Caution

No separate public sample payload is provided for this action.

## Cross-Action Notes

- `decision` must always be supplied, and must be valid for the current return state and actor.
- The request fails unless the `decision` value is appropriate for the current return state.
- `keepOriginalItem` defaults to `false`.
- Buyer-only partial-refund acceptance or decline flows exist in the traditional API, but are intentionally omitted from this seller-facing doc.

## Related Operations

- `GET /post-order/v2/return/{returnId}` to inspect the current return state before deciding
- `GET /post-order/v2/return/search` to locate returns requiring seller action
- `POST /post-order/v2/return/{returnId}/issue_refund` when refund execution is handled outside this decision path
