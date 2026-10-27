# Mark Return Received

- API Type: REST
- Operation: POST `/post-order/v2/return/{returnId}/mark_as_received`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Mark Return Received](https://developer.ebay.com/Devzone/post-order/post-order_v2_return-returnid_mark_as_received__post.html)

## Description

This method allows a seller to mark a returned item as received.

## When To Use

Use this method after the seller has physically received the returned item and wants to advance the return workflow.

## Request

### Endpoint

```http
POST https://api.ebay.com/post-order/v2/return/{returnId}/mark_as_received
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `returnId` | string | Yes | The return request for which the item is being marked as received. |

### HTTP Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | This call uses standard authorization tokens. |

### Authentication Notes

- All requests made to eBay REST operations require the authorization HTTP header for authentication.
- This call uses standard authorization tokens.

### Request Body

The request payload uses `MarkAsReceivedRequest`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `comments` | `Text` | No | Optional comments about receiving the returned item. |

## Response

### Response Type

This call has no response payload.

### Success Behavior

- A successful request returns HTTP `200`
- No response body is returned

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/return/5********9/mark_as_received
Authorization: Bearer <access-token>
```

### Response

```http
HTTP/1.1 200 OK
```

## Notes

- The public sample sends no request payload, even though the model allows optional comments.

## Related Operations

- `GET /post-order/v2/return/{returnId}` to inspect return state
- `POST /post-order/v2/return/{returnId}/issue_refund` to issue the refund after receipt
