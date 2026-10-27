# Approve Cancellation

- API Type: REST
- Operation: POST `/post-order/v2/cancellation/{cancelId}/approve`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Approve Cancellation](https://developer.ebay.com/devzone/post-order/post-order_v2_cancellation-cancelid_approve__post.html)

## Description

This method approves a buyer-initiated order cancellation request on behalf of the seller.

If the order is eligible for cancellation and the seller agrees, the call cancels the order and notifies the buyer. The request and response are both body-less; the `cancelId` path parameter identifies the cancellation request.

## When To Use

Use this method when the seller wants to approve an existing Post-Order cancellation request.

Typical partner-facing use cases:

- Approve a buyer cancellation request for an eligible order
- Complete seller-side cancellation approval without a request body
- Drive a seller workflow that needs a success/failure status only

## Request

### Endpoint

```http
POST https://api.ebay.com/post-order/v2/cancellation/{cancelId}/approve
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cancelId` | string | Yes | The unique eBay-assigned identifier of the cancellation request to approve. |

### HTTP Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | This call uses standard authorization tokens. |
| `Signature-Input` and `Signature` | Conditional | Required for certain EU and UK seller scenarios subject to digital-signature rules. |

### Authentication Notes

- All requests made to eBay REST operations require the `Authorization` HTTP header.
- This call uses standard authorization tokens.
- Digital-signature verification is required for certain EU and UK payments scenarios described by the source page.

### Request Body

This call has no request payload.

## Response

### Response Type

This call has no response payload.

### Response Behavior

- A successful call returns HTTP `200`.
- No response body is returned when the cancellation is successfully approved.

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/cancellation/5********6/approve
Authorization: Bearer <access-token>
```

### Response

Successful responses return HTTP `200` with no payload.

