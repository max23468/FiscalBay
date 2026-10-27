# POST : ProcessReturnRequest Samples

## Example

### Seller Action: APPROVE

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

## Additional Seller Actions

The same traditional endpoint also supports these seller-side decisions, but the public source does not provide separate sample payloads for them:

- `DECLINE`
- `OFFER_PARTIAL_REFUND`
- `PROVIDE_RMA`

## Notes

- `decision` must always be supplied and must be valid for the current return state.
- `OFFER_PARTIAL_REFUND` requires `partialRefundAmount`.
- `PROVIDE_RMA` requires `RMANumber`.

## Related Operations

- `GET /post-order/v2/return/{returnId}` to inspect the current return state before deciding
- `GET /post-order/v2/return/search` to locate returns requiring seller action
