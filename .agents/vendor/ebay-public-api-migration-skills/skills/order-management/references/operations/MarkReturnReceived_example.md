# POST : MarkReturnReceived Samples

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
